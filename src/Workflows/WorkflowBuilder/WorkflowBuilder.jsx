import { useContext, useState, useEffect, useMemo } from 'react';
import { MainContext } from '../../Contexts/MainContext';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { IoAdd, IoTrash, IoCopy, IoCheckmark, IoChevronDown } from 'react-icons/io5';
import { addDebugLog } from '../../Utils/DebugPanel';
import styles from './WorkflowBuilder.module.css';
import PropTypes from 'prop-types';

const WorkflowBuilder = ({ workflow, onBack }) => {
  const { isDarkTheme, businessId, user, templateObjects } = useContext(MainContext);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [workflowId, setWorkflowId] = useState(workflow?.workflowId || workflow?.id || '');
  const [originalConfig, setOriginalConfig] = useState(null); // Track the loaded config for change detection
  
  const [config, setConfig] = useState({
    mapping: {
      createObject: true,
      objectType: '',
      objectId: '',
      recordTemplate: '',
      templateId: '',
      fieldMappings: [] // { formField: '', crmField: '', required: false }
    },
    notifications: {
      emailOnSubmission: false,
      emailsToNotify: []
    },
    autoActions: {
      assignToUser: '',
      addToSheet: ''
    }
  });

  const [testFormData, setTestFormData] = useState({});
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!originalConfig) return true; // If no original config loaded yet, consider it as needing save
    // Deep comparison of config objects
    const currentConfigStr = JSON.stringify(config, Object.keys(config).sort());
    const originalConfigStr = JSON.stringify(originalConfig, Object.keys(originalConfig).sort());
    return currentConfigStr !== originalConfigStr;
  }, [config, originalConfig]);

  // Determine the appropriate starting step based on config completeness
  const getStartingStep = (configData) => {
    if (!configData || !configData.mapping) {
      addDebugLog('WorkflowBuilder', 'getStartingStep: No config data, starting at step 1');
      return 1;
    }

    const { mapping } = configData;

    // If no object is selected, start at step 1
    if (!mapping.objectId) {
      addDebugLog('WorkflowBuilder', 'getStartingStep: No objectId, starting at step 1', { mapping });
      return 1;
    }

    // If object is selected but no template, start at step 2
    if (!mapping.templateId) {
      addDebugLog('WorkflowBuilder', 'getStartingStep: Has objectId but no templateId, starting at step 2', { mapping });
      return 2;
    }

    // If template is selected but no field mappings, start at step 3
    if (!mapping.fieldMappings || mapping.fieldMappings.length === 0) {
      addDebugLog('WorkflowBuilder', 'getStartingStep: Has templateId but no fieldMappings, starting at step 3', { mapping });
      return 3;
    }

    // If field mappings exist, start at step 4 (final step)
    addDebugLog('WorkflowBuilder', 'getStartingStep: Has fieldMappings, starting at step 4', { mapping });
    return 4;
  };

  // Generate webhook URL
  const webhookUrl = useMemo(() => {
    if (!workflowId) return '';
    return `https://us-central1-avacrm-6900e.cloudfunctions.net/submitFormData?workflowId=${workflowId}`;
  }, [workflowId]);

  // Load workflow configuration
  useEffect(() => {
    const loadConfig = async () => {
      addDebugLog('WorkflowBuilder', 'Loading workflow configuration', {
        workflowId: workflow?.id,
        businessId,
        workflowWorkflowId: workflow?.workflowId
      });

      if (!workflow || !businessId) {
        addDebugLog('WorkflowBuilder', 'Load config aborted - missing workflow or businessId', {
          workflow: !!workflow,
          businessId: !!businessId
        });
        return;
      }

      try {
        setIsLoading(true);
        
        // Ensure workflowId is set correctly in the workflow document
        if (!workflow.workflowId || workflow.workflowId === '' || workflow.workflowId !== workflow.id) {
          addDebugLog('WorkflowBuilder', 'Setting workflowId in document', {
            oldWorkflowId: workflow.workflowId,
            newWorkflowId: workflow.id
          });
          await setDoc(
            doc(db, 'businesses', businessId, 'workflows', workflow.id),
            { workflowId: workflow.id },
            { merge: true }
          );
          setWorkflowId(workflow.id);
        } else {
          setWorkflowId(workflow.workflowId);
        }
        
        addDebugLog('WorkflowBuilder', 'Fetching config from subcollection', {
          path: `businesses/${businessId}/workflows/${workflow.id}/config/main`
        });
        
        const configDoc = await getDoc(
          doc(db, 'businesses', businessId, 'workflows', workflow.id, 'config', 'main')
        );

        if (configDoc.exists()) {
          const data = configDoc.data();
          addDebugLog('WorkflowBuilder', 'Config loaded successfully', {
            configKeys: Object.keys(data),
            hasMapping: !!data.mapping,
            hasNotifications: !!data.notifications
          });
          
          // Store the original config for change detection
          setOriginalConfig(JSON.parse(JSON.stringify(data)));
          
          setConfig(prev => ({
            ...prev,
            ...data
          }));

          // Determine the appropriate starting step based on config completeness
          setTimeout(() => {
            const newStep = getStartingStep(data);
            addDebugLog('WorkflowBuilder', 'Setting starting step', {
              loadedConfig: data,
              determinedStep: newStep
            });
            setCurrentStep(newStep);
          }, 100); // Small delay to ensure config state is updated
        } else {
          addDebugLog('WorkflowBuilder', 'No config document found, using defaults');
          // For new workflows, original config is null until first save
          setOriginalConfig(null);
        }
      } catch (error) {
        addDebugLog('WorkflowBuilder', 'Error loading workflow config', {
          error: error.message,
          stack: error.stack
        });
        console.error('Error loading workflow config:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [workflow, businessId]);

  // Debug: Log config changes
  useEffect(() => {
    addDebugLog('WorkflowBuilder', 'Config state changed', {
      configKeys: Object.keys(config),
      mapping: {
        objectId: config.mapping?.objectId,
        fieldMappingsCount: config.mapping?.fieldMappings?.length || 0
      },
      notifications: {
        emailOnSubmission: config.notifications?.emailOnSubmission,
        emailsCount: config.notifications?.emailsToNotify?.length || 0
      }
    });
  }, [config]);

  // Save workflow configuration
  const saveConfig = async () => {
    addDebugLog('WorkflowBuilder', 'Manual save triggered', {
      workflowId: workflow?.id,
      businessId,
      hasUnsavedChanges,
      configKeys: Object.keys(config)
    });

    if (!hasUnsavedChanges) {
      addDebugLog('WorkflowBuilder', 'Save aborted - no unsaved changes');
      return;
    }

    if (!workflow || !businessId) {
      addDebugLog('WorkflowBuilder', 'Manual save aborted - missing workflow or businessId', {
        workflow: !!workflow,
        businessId: !!businessId
      });
      return;
    }

    try {
      setIsSaving(true);
      const configData = {
        ...config,
        updatedAt: Timestamp.now(),
        updatedBy: user?.uid
      };

      addDebugLog('WorkflowBuilder', 'Saving to config subcollection', {
        path: `businesses/${businessId}/workflows/${workflow.id}/config/main`,
        configData
      });

      // Save to config subcollection
      await setDoc(
        doc(db, 'businesses', businessId, 'workflows', workflow.id, 'config', 'main'),
        configData
      );

      addDebugLog('WorkflowBuilder', 'Saving to main workflow document', {
        path: `businesses/${businessId}/workflows/${workflow.id}`,
        configData
      });

      // Also save config data to the main workflow document for webhook access
      await setDoc(
        doc(db, 'businesses', businessId, 'workflows', workflow.id),
        {
          ...config,
          updatedAt: Timestamp.now(),
          updatedBy: user?.uid
        },
        { merge: true }
      );

      // Update original config to reflect the saved state
      setOriginalConfig(JSON.parse(JSON.stringify(config)));

      addDebugLog('WorkflowBuilder', 'Manual save completed successfully');
      console.log('Workflow configuration saved');
    } catch (error) {
      addDebugLog('WorkflowBuilder', 'Manual save failed', {
        error: error.message,
        stack: error.stack
      });
      console.error('Error saving workflow configuration:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Test webhook submission
  const testWebhook = async () => {
    if (!webhookUrl) {
      setTestResult({
        success: false,
        error: 'No webhook URL available. Please save your workflow configuration first.',
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (!workflowId) {
      setTestResult({
        success: false,
        error: 'No workflow ID available. Please save your workflow configuration first.',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Check if workflow configuration has been saved
    if (hasUnsavedChanges) {
      setTestResult({
        success: false,
        error: 'You have unsaved changes. Please save your workflow configuration before testing.',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Check if workflow configuration is complete
    if (!config.mapping || !config.mapping.objectType || !config.mapping.fieldMappings || config.mapping.fieldMappings.length === 0) {
      setTestResult({
        success: false,
        error: 'Workflow configuration is incomplete. Please complete all required steps before testing.',
        timestamp: new Date().toISOString()
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      addDebugLog('WorkflowBuilder', 'Testing webhook submission', {
        webhookUrl,
        workflowId,
        testFormData,
        testFormDataKeys: Object.keys(testFormData)
      });

      console.log('Testing webhook:', webhookUrl);
      console.log('With data:', testFormData);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(testFormData)
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      let result;
      try {
        result = await response.json();
        console.log('Response data:', result);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        // Try to get text response for better error messages
        try {
          const textResponse = await response.text();
          result = { error: textResponse || 'Invalid JSON response from server' };
        } catch (textError) {
          result = { error: 'Invalid response from server' };
        }
      }

      if (!response.ok) {
        // Handle specific error cases
        let errorMessage = result.error || `HTTP ${response.status}: ${response.statusText}`;
        
        if (response.status === 400) {
          errorMessage = result.error || 'Bad request - please check your workflow configuration';
        } else if (response.status === 404) {
          errorMessage = 'Workflow not found - please save your configuration first';
        } else if (response.status === 500) {
          errorMessage = 'Server error - please try again later';
        }
        
        setTestResult({
          success: false,
          status: response.status,
          error: errorMessage,
          timestamp: new Date().toISOString()
        });
      } else {
        setTestResult({
          success: true,
          status: response.status,
          data: result,
          timestamp: new Date().toISOString()
        });
      }

      addDebugLog('WorkflowBuilder', 'Webhook test completed', {
        success: response.ok,
        status: response.status,
        result
      });

    } catch (error) {
      console.error('Webhook test error:', error);
      setTestResult({
        success: false,
        error: `Network error: ${error.message}`,
        timestamp: new Date().toISOString()
      });

      addDebugLog('WorkflowBuilder', 'Webhook test failed', {
        error: error.message,
        stack: error.stack
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Get selected object data
  const selectedObject = useMemo(() => {
    if (!config.mapping.objectId || !templateObjects) return null;
    return templateObjects.find(obj => obj.id === config.mapping.objectId);
  }, [config.mapping.objectId, templateObjects]);

  // Get available templates for selected object
  const availableTemplates = useMemo(() => {
    if (!selectedObject) return [];
    return selectedObject.templates || [];
  }, [selectedObject]);

  // Get selected template data
  const selectedTemplate = useMemo(() => {
    if (!config.mapping.templateId || !availableTemplates) return null;
    return availableTemplates.find(t => t.docId === config.mapping.templateId);
  }, [config.mapping.templateId, availableTemplates]);

  // Get all available CRM fields (basicFields + template fields)
  const availableFields = useMemo(() => {
    const fields = [];
    
    if (selectedObject?.basicFields) {
      selectedObject.basicFields.forEach(field => {
        fields.push({
          key: `basicFields.${field.key}`,
          name: `${field.name} (Object Field)`,
          type: field.type,
          section: 'Basic Information'
        });
      });
    }

    if (selectedTemplate?.headers) {
      selectedTemplate.headers.forEach(header => {
        // Skip system fields
        if (['docId', 'linkId', 'typeOfRecord', 'typeOfObject', 'assignedTo'].includes(header.key)) {
          return;
        }
        fields.push({
          key: `templateFields.${header.key}`,
          name: `${header.name} (Template Field)`,
          type: header.type,
          section: header.section || 'Template Fields'
        });
      });
    }

    return fields;
  }, [selectedObject, selectedTemplate]);

  // Handle object selection
  const handleObjectSelect = (objectId) => {
    const obj = templateObjects.find(o => o.id === objectId);
    setConfig(prev => ({
      ...prev,
      mapping: {
        ...prev.mapping,
        objectId,
        objectType: obj?.name || '',
        templateId: '',
        recordTemplate: '',
        fieldMappings: [] // Reset field mappings when changing object
      }
    }));
    setCurrentStep(2);
  };

  // Handle template selection
  const handleTemplateSelect = (templateId) => {
    const template = availableTemplates.find(t => t.docId === templateId);
    setConfig(prev => ({
      ...prev,
      mapping: {
        ...prev.mapping,
        templateId,
        recordTemplate: template?.name || template?.typeOfRecord || ''
      }
    }));
    setCurrentStep(3);
  };

  // Add field mapping
  const addFieldMapping = () => {
    setConfig(prev => ({
      ...prev,
      mapping: {
        ...prev.mapping,
        fieldMappings: [
          ...prev.mapping.fieldMappings,
          { formField: '', crmField: '', required: false }
        ]
      }
    }));
  };

  // Update field mapping
  const updateFieldMapping = (index, field, value) => {
    setConfig(prev => ({
      ...prev,
      mapping: {
        ...prev.mapping,
        fieldMappings: prev.mapping.fieldMappings.map((fm, i) =>
          i === index ? { ...fm, [field]: value } : fm
        )
      }
    }));
  };

  // Remove field mapping
  const removeFieldMapping = (index) => {
    setConfig(prev => ({
      ...prev,
      mapping: {
        ...prev.mapping,
        fieldMappings: prev.mapping.fieldMappings.filter((_, i) => i !== index)
      }
    }));
  };

  // Add email to notify list
  const addEmail = () => {
    if (newEmail && newEmail.includes('@')) {
      setConfig(prev => ({
        ...prev,
        notifications: {
          ...prev.notifications,
          emailsToNotify: [...prev.notifications.emailsToNotify, newEmail]
        }
      }));
      setNewEmail('');
    }
  };

  // Remove email from notify list
  const removeEmail = (index) => {
    setConfig(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        emailsToNotify: prev.notifications.emailsToNotify.filter((_, i) => i !== index)
      }
    }));
  };

  // Copy webhook URL to clipboard
  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // Generate integration code
  const generateIntegrationCode = () => {
    const formFieldNames = config.mapping.fieldMappings
      .map(fm => fm.formField)
      .filter(Boolean);

    return `<!-- Add this to your website -->
<form id="contactForm">
${formFieldNames.map(field => `  <input name="${field}" placeholder="${field}" required>`).join('\n')}
  <button type="submit">Submit</button>
</form>

<script>
document.getElementById('contactForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);

  try {
    const response = await fetch('${webhookUrl}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (response.ok) {
      alert('Thank you! We\\'ll be in touch soon.');
      e.target.reset();
    }
  } catch (error) {
    alert('Error submitting form. Please try again.');
  }
});
</script>`;
  };

  if (isLoading) {
    return (
      <div className={`${styles.container} ${isDarkTheme ? styles.darkTheme : ''}`}>
        <div className={styles.loading}>Loading workflow configuration...</div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${isDarkTheme ? styles.darkTheme : ''}`}>
      {/* Progress Steps */}
      <div className={styles.stepsContainer}>
        <div className={`${styles.step} ${currentStep >= 1 ? styles.active : ''}`}>
          <div className={styles.stepNumber}>1</div>
          <div className={styles.stepLabel}>Choose Object</div>
        </div>
        <div className={styles.stepLine}></div>
        <div className={`${styles.step} ${currentStep >= 2 ? styles.active : ''}`}>
          <div className={styles.stepNumber}>2</div>
          <div className={styles.stepLabel}>Choose Template</div>
        </div>
        <div className={styles.stepLine}></div>
        <div className={`${styles.step} ${currentStep >= 3 ? styles.active : ''}`}>
          <div className={styles.stepNumber}>3</div>
          <div className={styles.stepLabel}>Map Fields</div>
        </div>
        <div className={styles.stepLine}></div>
        <div className={`${styles.step} ${currentStep >= 4 ? styles.active : ''}`}>
          <div className={styles.stepNumber}>4</div>
          <div className={styles.stepLabel}>Get Webhook</div>
        </div>
      </div>

      {/* Step 1: Object Selection */}
      {currentStep === 1 && (
        <div className={styles.stepContent}>
          <h3 className={styles.stepTitle}>Select Object Type</h3>
          <p className={styles.stepDescription}>
            Choose which type of object to create when form data is received.
          </p>
          <div className={styles.objectGrid}>
            {templateObjects && templateObjects.map(obj => (
              <button
                key={obj.id}
                className={`${styles.objectCard} ${config.mapping.objectId === obj.id ? styles.selected : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                onClick={() => handleObjectSelect(obj.id)}
              >
                <div className={styles.objectIcon}>📦</div>
                <div className={styles.objectName}>{obj.name}</div>
                <div className={styles.objectInfo}>
                  {obj.basicFields?.length || 0} fields
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Template Selection */}
      {currentStep === 2 && (
        <div className={styles.stepContent}>
          <h3 className={styles.stepTitle}>Select Record Template</h3>
          <p className={styles.stepDescription}>
            Choose which record template to use for {config.mapping.objectType}.
          </p>
          <div className={styles.templateGrid}>
            {availableTemplates.map(template => (
              <button
                key={template.docId}
                className={`${styles.templateCard} ${config.mapping.templateId === template.docId ? styles.selected : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                onClick={() => handleTemplateSelect(template.docId)}
              >
                <div className={styles.templateIcon}>📄</div>
                <div className={styles.templateName}>{template.name || template.typeOfRecord}</div>
                <div className={styles.templateInfo}>
                  {template.headers?.length || 0} fields
                </div>
              </button>
            ))}
          </div>
          <button
            className={`${styles.backButton} ${isDarkTheme ? styles.darkTheme : ''}`}
            onClick={() => setCurrentStep(1)}
          >
            ← Back
          </button>
        </div>
      )}

      {/* Step 3: Field Mapping */}
      {currentStep === 3 && (
        <div className={styles.stepContent}>
          <h3 className={styles.stepTitle}>Map Form Fields to CRM</h3>
          <p className={styles.stepDescription}>
            Map your website form field names to CRM fields in {config.mapping.objectType}.
          </p>
          
          <div className={styles.fieldMappingsContainer}>
            {config.mapping.fieldMappings.map((mapping, index) => (
              <div key={index} className={`${styles.fieldMappingRow} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <div className={styles.fieldMappingInputs}>
                  <input
                    type="text"
                    placeholder="Form field name (e.g., email)"
                    value={mapping.formField}
                    onChange={(e) => updateFieldMapping(index, 'formField', e.target.value)}
                    className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ''}`}
                  />
                  <span className={styles.arrow}>→</span>
                  <select
                    value={mapping.crmField}
                    onChange={(e) => updateFieldMapping(index, 'crmField', e.target.value)}
                    className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                  >
                    <option value="">Select CRM field...</option>
                    {availableFields.map(field => (
                      <option key={field.key} value={field.key}>
                        {field.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className={`${styles.deleteButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                  onClick={() => removeFieldMapping(index)}
                  title="Remove mapping"
                >
                  <IoTrash />
                </button>
              </div>
            ))}
            
            <button
              className={`${styles.addButton} ${isDarkTheme ? styles.darkTheme : ''}`}
              onClick={addFieldMapping}
            >
              <IoAdd /> Add Field Mapping
            </button>
          </div>

          {/* Email Notifications */}
          <div className={styles.settingGroup}>
            <label className={styles.label}>
              <input
                type="checkbox"
                checked={config.notifications.emailOnSubmission}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  notifications: { ...prev.notifications, emailOnSubmission: e.target.checked }
                }))}
              />
              Send email notifications
            </label>
            
            {config.notifications.emailOnSubmission && (
              <div className={styles.emailList}>
                {config.notifications.emailsToNotify.map((email, index) => (
                  <div key={index} className={styles.emailItem}>
                    <span>{email}</span>
                    <button
                      onClick={() => removeEmail(index)}
                      className={styles.deleteButton}
                    >
                      <IoTrash />
                    </button>
                  </div>
                ))}
                <div className={styles.emailInput}>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addEmail()}
                    className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ''}`}
                  />
                  <button onClick={addEmail} className={`${styles.addButton} ${isDarkTheme ? styles.darkTheme : ''}`}>
                    <IoAdd />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className={styles.buttonRow}>
            <button
              className={`${styles.backButton} ${isDarkTheme ? styles.darkTheme : ''}`}
              onClick={() => setCurrentStep(2)}
            >
              ← Back
            </button>
            <button
              className={`${styles.nextButton} ${isDarkTheme ? styles.darkTheme : ''}`}
              onClick={() => setCurrentStep(4)}
              disabled={config.mapping.fieldMappings.length === 0}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Webhook URL */}
      {currentStep === 4 && (
        <div className={styles.stepContent}>
          <h3 className={styles.stepTitle}>Test Your Webhook</h3>
          <p className={styles.stepDescription}>
            Preview your form and test the webhook integration.
          </p>

          <div className={`${styles.webhookUrlBox} ${isDarkTheme ? styles.darkTheme : ''}`}>
            <code>{webhookUrl}</code>
            <button
              className={`${styles.copyButton} ${copiedUrl ? styles.copied : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
              onClick={copyWebhookUrl}
            >
              {copiedUrl ? <><IoCheckmark /> Copied!</> : <><IoCopy /> Copy</>}
            </button>
          </div>

          {/* Form Preview */}
          <div className={styles.previewSection}>
            <h4>Form Preview</h4>
            <p>Fill out this form to test your webhook:</p>

            <div className={`${styles.testForm} ${isDarkTheme ? styles.darkTheme : ''}`}>
              {config.mapping.fieldMappings.map((mapping, index) => {
                if (!mapping.formField) return null;

                const fieldType = availableFields.find(f => f.key === mapping.crmField)?.type || 'text';

                return (
                  <div key={index} className={styles.formField}>
                    <label className={styles.fieldLabel}>
                      {mapping.formField}
                      {mapping.required && <span className={styles.required}>*</span>}
                    </label>
                    {fieldType === 'textarea' ? (
                      <textarea
                        value={testFormData[mapping.formField] || ''}
                        onChange={(e) => setTestFormData(prev => ({
                          ...prev,
                          [mapping.formField]: e.target.value
                        }))}
                        placeholder={`Enter ${mapping.formField}`}
                        className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ''}`}
                        required={mapping.required}
                      />
                    ) : (
                      <input
                        type={fieldType === 'email' ? 'email' : fieldType === 'number' ? 'number' : 'text'}
                        value={testFormData[mapping.formField] || ''}
                        onChange={(e) => setTestFormData(prev => ({
                          ...prev,
                          [mapping.formField]: e.target.value
                        }))}
                        placeholder={`Enter ${mapping.formField}`}
                        className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ''}`}
                        required={mapping.required}
                      />
                    )}
                  </div>
                );
              })}

              <button
                className={`${styles.testButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                onClick={testWebhook}
                disabled={isTesting || config.mapping.fieldMappings.length === 0}
              >
                {isTesting ? 'Testing...' : 'Test Webhook'}
              </button>
            </div>
          </div>

          {/* Test Results */}
          {testResult && (
            <div className={styles.resultsSection}>
              <h4>Test Results</h4>
              <div className={`${styles.testResult} ${testResult.success ? styles.success : styles.error} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <div className={styles.resultHeader}>
                  <span className={styles.resultStatus}>
                    {testResult.success ? '✅ Success' : '❌ Failed'}
                  </span>
                  <span className={styles.resultTime}>
                    {new Date(testResult.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {testResult.error ? (
                  <div className={styles.resultError}>
                    <strong>Error:</strong> {testResult.error}
                  </div>
                ) : (
                  <div className={styles.resultData}>
                    <div><strong>Status:</strong> {testResult.status}</div>
                    <div><strong>Message:</strong> {testResult.data?.message || 'Success'}</div>
                    <div><strong>Records Created:</strong> {testResult.data?.recordsCreated || 0}</div>
                    <div><strong>Objects Created:</strong> {testResult.data?.objectsCreated || 0}</div>
                    {testResult.data?.recordIds && testResult.data.recordIds.length > 0 && (
                      <div>
                        <strong>Record IDs:</strong>
                        <ul>
                          {testResult.data.recordIds.map((id, index) => (
                            <li key={index}>{id}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {testResult.data?.objectIds && testResult.data.objectIds.length > 0 && (
                      <div>
                        <strong>Object IDs:</strong>
                        <ul>
                          {testResult.data.objectIds.map((id, index) => (
                            <li key={index}>{id}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Integration Code (Collapsible) */}
          <details className={styles.codeSection}>
            <summary className={styles.codeSummary}>Show Integration Code</summary>
            <p>Copy and paste this code into your website:</p>
            <pre className={`${styles.codeBlock} ${isDarkTheme ? styles.darkTheme : ''}`}>
              {generateIntegrationCode()}
            </pre>
          </details>

          <div className={styles.buttonRow}>
            <button
              className={`${styles.backButton} ${isDarkTheme ? styles.darkTheme : ''}`}
              onClick={() => setCurrentStep(3)}
            >
              ← Back
            </button>
            <button
              className={`${styles.saveButton} ${isDarkTheme ? styles.darkTheme : ''}`}
              onClick={saveConfig}
              disabled={isSaving || !hasUnsavedChanges}
            >
              {isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save Configuration' : 'Configuration Saved'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

WorkflowBuilder.propTypes = {
  workflow: PropTypes.object.isRequired,
  onBack: PropTypes.func.isRequired,
};

export default WorkflowBuilder;
