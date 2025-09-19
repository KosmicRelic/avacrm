import React, { useContext, useState, useEffect } from 'react';
import { MainContext } from '../Contexts/MainContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase'; // Adjust path to your Firebase config
import styles from './Actions.module.css';
import { FaChevronLeft } from 'react-icons/fa';

const Actions = () => {
  const { recordTemplates, businessId, isDarkTheme, actions = [], setActions } = useContext(MainContext);
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [moneyHeader, setMoneyHeader] = useState('');
  const [moneyConfigs, setMoneyConfigs] = useState([]);
  const [decisionHeader, setDecisionHeader] = useState('');
  const [decisionConfigs, setDecisionConfigs] = useState([]);
  const [needHeader, setNeedHeader] = useState('');
  const [needConfigs, setNeedConfigs] = useState([]);
  const [urgencyHeader, setUrgencyHeader] = useState('');
  const [urgencyConfigs, setUrgencyConfigs] = useState([]);
  const [scoreHeaderKey, setScoreHeaderKey] = useState('');
  const [calculatedScore, setCalculatedScore] = useState(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [step, setStep] = useState(0); // 0: idle, 1: choose type, 2: configure
  const [editingActionId, setEditingActionId] = useState(null);
  const [actionName, setActionName] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [backButtonLabel, setBackButtonLabel] = useState('Back');
  const isMobile = windowWidth <= 767;

  const actionOptions = [
    { value: '', label: 'Select an action...' },
    { value: 'sms', label: 'Send SMS' },
    { value: 'email', label: 'Send Email' },
    { value: 'leadScore', label: 'Configure Lead Score' },
  ];

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Find the selected template object
  const templateObj = recordTemplates?.find(t => t.name === selectedTemplate);
  const templateHeaders = templateObj?.headers || [];

  // Filter headers by type
  const numberHeaders = templateHeaders.filter(header => header.type === 'number');
  const dropdownHeaders = templateHeaders.filter(header => header.type === 'dropdown');
  const textHeaders = templateHeaders.filter(header => header.type === 'text');

  // Get values for a dropdown header
  const getDropdownValues = headerKey => {
    const header = templateHeaders.find(h => h.key === headerKey);
    return header?.type === 'dropdown' && Array.isArray(header.options) ? header.options : [];
  };

  // Add a new match value for any criterion
  const addMatchValue = (setter, configs) => {
    setter([...configs, { matchValue: '', coefficient: 25 }]);
  };

  // Update match value or coefficient
  const updateConfig = (setter, configs, index, field, value) => {
    setter(
      configs.map((config, i) =>
        i === index ? { ...config, [field]: value } : config
      )
    );
  };

  // Remove a match value
  const removeMatchValue = (setter, configs, index) => {
    setter(configs.filter((_, i) => i !== index));
  };

  // Validate configuration
  const validateConfig = () => {
    if (!selectedTemplate) return 'Please select a template.';
    if (!scoreHeaderKey) return 'Please select a header to store the lead score.';
    if (!moneyHeader && !decisionHeader && !needHeader && !urgencyHeader) {
      return 'Please configure at least one criterion.';
    }

    const validateSection = (header, configs, sectionName) => {
      if (!header) return true;
      if (configs.length === 0) return `Please add at least one match value for ${sectionName}.`;
      const headerObj = templateHeaders.find(h => h.key === header);
      const isDropdown = headerObj?.type === 'dropdown';
      const validValues = isDropdown ? getDropdownValues(header) : null;
      const invalid = configs.some(
        config =>
          !config.matchValue ||
          isNaN(config.coefficient) ||
          config.coefficient < 0 ||
          config.coefficient > 100 ||
          (isDropdown && !validValues.includes(config.matchValue))
      );
      return invalid
        ? `Please ensure all ${sectionName} match values are ${
            isDropdown ? 'from the dropdown options' : 'non-empty'
          } and coefficients are 0-100.`
        : true;
    };

    const errors = [
      validateSection(moneyHeader, moneyConfigs, 'Money'),
      validateSection(decisionHeader, decisionConfigs, 'Authority'),
      validateSection(needHeader, needConfigs, 'Need'),
      validateSection(urgencyHeader, urgencyConfigs, 'Urgency'),
    ].filter(v => typeof v === 'string');

    return errors.length > 0 ? errors[0] : '';
  };

  // Calculate preview lead score (maximum potential)
  const calculateLeadScore = () => {
    const validationError = validateConfig();
    if (validationError) {
      setError(validationError);
      setCalculatedScore(null);
      return;
    }

    setError('');
    let totalScore = 0;

    // Money: Use highest coefficient
    if (moneyHeader && moneyConfigs.length > 0) {
      const maxCoefficient = Math.max(
        ...moneyConfigs.map(config => parseInt(config.coefficient) || 0),
        0
      );
      totalScore += maxCoefficient;
    }

    // Authority: Use highest coefficient
    if (decisionHeader && decisionConfigs.length > 0) {
      const maxCoefficient = Math.max(
        ...decisionConfigs.map(config => parseInt(config.coefficient) || 0),
        0
      );
      totalScore += maxCoefficient;
    }

    // Need: Use highest coefficient
    if (needHeader && needConfigs.length > 0) {
      const maxCoefficient = Math.max(
        ...needConfigs.map(config => parseInt(config.coefficient) || 0),
        0
      );
      totalScore += maxCoefficient;
    }

    // Urgency: Use highest coefficient
    if (urgencyHeader && urgencyConfigs.length > 0) {
      const maxCoefficient = Math.max(
        ...urgencyConfigs.map(config => parseInt(config.coefficient) || 0),
        0
      );
      totalScore += maxCoefficient;
    }

    // Average to 0-100 (divide by 4)
    const finalScore = Math.round(totalScore / 4);
    setCalculatedScore(finalScore);
  };

  // Save configuration to Firestore
  const saveConfiguration = async () => {
    const validationError = validateConfig();
    if (validationError) {
      setError(validationError);
      setSuccessMessage('');
      return;
    }

    if (!businessId) {
      setError('Business ID is missing.');
      setSuccessMessage('');
      return;
    }

    try {
      const config = {
        name: actionName,
        type: selectedAction,
        templateName: selectedTemplate,
        scoreHeaderKey,
        money: moneyHeader ? { moneyHeader, configs: moneyConfigs } : null,
        authority: decisionHeader ? { decisionHeader, configs: decisionConfigs } : null,
        need: needHeader ? { needHeader, configs: needConfigs } : null,
        urgency: urgencyHeader ? { urgencyHeader, configs: urgencyConfigs } : null,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, `businesses/${businessId}/actions`, editingActionId || 'leadScoringConfig'), config);
      setSuccessMessage('Configuration saved successfully!');
      setError('');
    } catch (error) {
      setError('Failed to save configuration: ' + error.message);
      setSuccessMessage('');
    }
  };

  // Handle edit action
  const handleEditAction = (action) => {
    let type = action.type;
    if (!type && action.scoreHeaderKey) type = 'leadScore';
    setEditingActionId(action.docId);
    setStep(2);
    setSelectedAction(type || '');
    setSelectedTemplate(action.templateName || '');
    setMoneyHeader(action.money?.moneyHeader || '');
    setMoneyConfigs(action.money?.configs || []);
    setDecisionHeader(action.authority?.decisionHeader || '');
    setDecisionConfigs(action.authority?.configs || []);
    setNeedHeader(action.need?.needHeader || '');
    setNeedConfigs(action.need?.configs || []);
    setUrgencyHeader(action.urgency?.urgencyHeader || '');
    setUrgencyConfigs(action.urgency?.configs || []);
    setScoreHeaderKey(action.scoreHeaderKey || '');
    setActionName(action.name || '');
    setCalculatedScore(null);
    setError('');
    setSuccessMessage('');
    setBackButtonLabel(action.name || action.type || 'Back');
  };

  // Handle create action
  const handleCreateAction = () => {
    setEditingActionId(null);
    setStep(1);
    setSelectedAction('');
    setSelectedTemplate('');
    setMoneyHeader('');
    setMoneyConfigs([]);
    setDecisionHeader('');
    setDecisionConfigs([]);
    setNeedHeader('');
    setNeedConfigs([]);
    setUrgencyHeader('');
    setUrgencyConfigs([]);
    setScoreHeaderKey('');
    setActionName('');
    setCalculatedScore(null);
    setError('');
    setSuccessMessage('');
  };

  // Handle type selection
  const handleChooseType = (type) => {
    setSelectedAction(type);
    setStep(2);
    const label = actionOptions.find(opt => opt.value === type)?.label || 'Back';
    setBackButtonLabel(label);
  };

  // Back button handler
  const handleBack = () => {
    if (isMobile) {
      setIsClosing(true);
      setTimeout(() => {
        setStep(0);
        setEditingActionId(null);
        setIsClosing(false);
      }, 300);
    } else {
      if (editingActionId) {
        setStep(0);
        setEditingActionId(null);
      } else {
        setStep(1);
      }
    }
  };

  return (
    <div className={`${styles.sheetWrapper} ${isDarkTheme ? styles.darkTheme : ''}`}>
      <div className={`${styles.tableContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
        <div className={`${styles.categoryList} ${isDarkTheme ? styles.darkTheme : ''}`}>
          <div className={styles.titleContainer}>
            <h3 className={`${styles.titleActions} ${isDarkTheme ? styles.darkTheme : ''}`}>Actions</h3>
          </div>
          <button
            className={`${styles.createActionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
            onClick={handleCreateAction}
          >
            + Create Action
          </button>
          {actions.length > 0 ? (
            actions.map((action) => (
              <button
                key={action.docId}
                className={`${styles.categoryItem} ${isDarkTheme ? styles.darkTheme : ''} ${editingActionId === action.docId ? styles.activeItem : ''}`}
                onClick={() => handleEditAction(action)}
              >
                <span>{action.name || action.type || 'Unnamed Action'}</span>
              </button>
            ))
          ) : (
            <div className={styles.hint}>No actions saved yet</div>
          )}
        </div>
      </div>
      {/* Right panel: configuration form */}
      {!isMobile && (
        <div className={`${styles.recordDetailsContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
          {/* Step 1: Choose type */}
          {step === 1 && (
            <div className={styles.formContent}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Choose Action Type</label>
                <div className={styles.actionTypeButtons}>
                  {actionOptions.slice(1).map(option => (
                    <button
                      key={option.value}
                      className={`${styles.actionTypeButton} ${selectedAction === option.value ? styles.activeType : ''}`}
                      onClick={() => handleChooseType(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* Step 2: Configure action */}
          {step === 2 && (selectedAction || editingActionId) && (
            <div className={styles.formContent}>
              <button
                className={styles.backButton}
                type="button"
                onClick={handleBack}
              >
                <FaChevronLeft style={{ marginRight: 8 }} /> {backButtonLabel}
              </button>
              <div className={styles.inputGroup}>
                <label htmlFor="action-title" className={styles.label}>Action Title</label>
                <input
                  id="action-title"
                  type="text"
                  className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ''}`}
                  placeholder="Enter a name for this action"
                  value={actionName}
                  onChange={e => setActionName(e.target.value)}
                  maxLength={64}
                  required
                />
              </div>
              <div className={styles.header}>
                {selectedAction === 'leadScore' && selectedTemplate && (
                  <button onClick={saveConfiguration} className={styles.updateButton}>
                    Save
                  </button>
                )}
              </div>
              {successMessage && <div className={styles.success}>{successMessage}</div>}
              {error && <div className={styles.error}>{error}</div>}
              {selectedAction && (
                <div className={styles.formContent}>
                  <div className={styles.inputGroup}>
                    <label htmlFor="action-select" className={styles.label}>Choose an action</label>
                    <select
                      id="action-select"
                      value={selectedAction}
                      onChange={e => {
                        setSelectedAction(e.target.value);
                        setSelectedTemplate('');
                        setMoneyHeader('');
                        setMoneyConfigs([]);
                        setDecisionHeader('');
                        setNeedHeader('');
                        setUrgencyHeader('');
                        setDecisionConfigs([]);
                        setNeedConfigs([]);
                        setUrgencyConfigs([]);
                        setScoreHeaderKey('');
                        setCalculatedScore(null);
                        setError('');
                        setSuccessMessage('');
                      }}
                      className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                    >
                      {actionOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedAction === 'leadScore' && (
                    <>
                      <div className={styles.inputGroup}>
                        <label htmlFor="template-select" className={styles.label}>Choose a record template</label>
                        <select
                          id="template-select"
                          value={selectedTemplate}
                          onChange={e => {
                            setSelectedTemplate(e.target.value);
                            setMoneyHeader('');
                            setMoneyConfigs([]);
                            setDecisionHeader('');
                            setNeedHeader('');
                            setUrgencyHeader('');
                            setDecisionConfigs([]);
                            setNeedConfigs([]);
                            setUrgencyConfigs([]);
                            setScoreHeaderKey('');
                            setCalculatedScore(null);
                            setError('');
                            setSuccessMessage('');
                          }}
                          className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                        >
                          <option value="">Select a template...</option>
                          {recordTemplates?.map(template => (
                            <option key={template.name} value={template.name}>
                              {template.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedTemplate && numberHeaders.length > 0 && (
                        <div className={styles.inputGroup}>
                          <label htmlFor="score-header-select" className={styles.label}>
                            Select Header for Lead Score
                          </label>
                          <select
                            id="score-header-select"
                            value={scoreHeaderKey}
                            onChange={e => setScoreHeaderKey(e.target.value)}
                            className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                          >
                            <option value="">Select a header...</option>
                            {numberHeaders.map(header => (
                              <option key={header.key} value={header.key}>
                                {header.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {selectedTemplate && (
                        <>
                          {/* Money Section */}
                          <div className={`${styles.sectionGroup} ${isDarkTheme ? styles.darkTheme : ''}`}>
                            <h2 className={styles.sectionTitle}>Do they have the money?</h2>
                            <div className={styles.hint}>
                              Select a dropdown or text field (e.g., serviceType) and define match values.
                            </div>
                            {(dropdownHeaders.length > 0 || textHeaders.length > 0) ? (
                              <>
                                <select
                                  value={moneyHeader}
                                  onChange={e => {
                                    setMoneyHeader(e.target.value);
                                    setMoneyConfigs([]);
                                  }}
                                  className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                                >
                                  <option value="">Select a header...</option>
                                  {dropdownHeaders.map(header => (
                                    <option key={header.key} value={header.key}>
                                      {header.name} (Dropdown)
                                    </option>
                                  ))}
                                  {textHeaders.map(header => (
                                    <option key={header.key} value={header.key}>
                                      {header.name} (Text)
                                    </option>
                                  ))}
                                </select>
                                {moneyHeader && (
                                  <div className={`${styles.headerConfig} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                    {moneyConfigs.map((config, index) => (
                                      <div key={index} className={styles.configRow}>
                                        {templateHeaders.find(h => h.key === moneyHeader)?.type === 'dropdown' ? (
                                          <select
                                            value={config.matchValue}
                                            onChange={e =>
                                              updateConfig(setMoneyConfigs, moneyConfigs, index, 'matchValue', e.target.value)
                                            }
                                            className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                                          >
                                            <option value="">Select a value...</option>
                                            {getDropdownValues(moneyHeader).map(value => (
                                              <option key={value} value={value}>
                                                {value}
                                              </option>
                                            ))}
                                          </select>
                                        ) : (
                                          <input
                                            type="text"
                                            placeholder="e.g., Deep Cleaning"
                                            value={config.matchValue}
                                            onChange={e =>
                                              updateConfig(setMoneyConfigs, moneyConfigs, index, 'matchValue', e.target.value)
                                            }
                                            className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ''}`}
                                          />
                                        )}
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          placeholder="Score (0-100)"
                                          value={config.coefficient}
                                          onChange={e =>
                                            updateConfig(
                                              setMoneyConfigs,
                                              moneyConfigs,
                                              index,
                                              'coefficient',
                                              parseInt(e.target.value) || 0
                                            )
                                          }
                                          className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ''}`}
                                        />
                                        <button
                                          onClick={() => removeMatchValue(setMoneyConfigs, moneyConfigs, index)}
                                          className={styles.removeButton}
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    ))}
                                    <button
                                      onClick={() => addMatchValue(setMoneyConfigs, moneyConfigs)}
                                      className={styles.addButton}
                                    >
                                      Add Match Value
                                    </button>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className={styles.hint}>No dropdown or text headers available</div>
                            )}
                          </div>

                          {/* Authority Section */}
                          <div className={`${styles.sectionGroup} ${isDarkTheme ? styles.darkTheme : ''}`}>
                            <h2 className={styles.sectionTitle}>Authority to make the decision?</h2>
                            <div className={styles.hint}>
                              Select a dropdown or text field (e.g., decisionMaker) and define match values.
                            </div>
                            {(dropdownHeaders.length > 0 || textHeaders.length > 0) ? (
                              <>
                                <select
                                  value={decisionHeader}
                                  onChange={e => {
                                    setDecisionHeader(e.target.value);
                                    setDecisionConfigs([]);
                                  }}
                                  className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                                >
                                  <option value="">Select a header...</option>
                                  {dropdownHeaders.map(header => (
                                    <option key={header.key} value={header.key}>
                                      {header.name} (Dropdown)
                                    </option>
                                  ))}
                                  {textHeaders.map(header => (
                                    <option key={header.key} value={header.key}>
                                      {header.name} (Text)
                                    </option>
                                  ))}
                                </select>
                                {decisionHeader && (
                                  <div className={`${styles.headerConfig} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                    {decisionConfigs.map((config, index) => (
                                      <div key={index} className={styles.configRow}>
                                        {templateHeaders.find(h => h.key === decisionHeader)?.type === 'dropdown' ? (
                                          <select
                                            value={config.matchValue}
                                            onChange={e =>
                                              updateConfig(setDecisionConfigs, decisionConfigs, index, 'matchValue', e.target.value)
                                            }
                                            className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                                          >
                                            <option value="">Select a value...</option>
                                            {getDropdownValues(decisionHeader).map(value => (
                                              <option key={value} value={value}>
                                                {value}
                                              </option>
                                            ))}
                                          </select>
                                        ) : (
                                          <input
                                            type="text"
                                            placeholder="e.g., Yes"
                                            value={config.matchValue}
                                            onChange={e =>
                                              updateConfig(setDecisionConfigs, decisionConfigs, index, 'matchValue', e.target.value)
                                            }
                                            className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ''}`}
                                          />
                                        )}
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          placeholder="Score (0-100)"
                                          value={config.coefficient}
                                          onChange={e =>
                                            updateConfig(
                                              setDecisionConfigs,
                                              decisionConfigs,
                                              index,
                                              'coefficient',
                                              parseInt(e.target.value) || 0
                                            )
                                          }
                                          className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ''}`}
                                        />
                                        <button
                                          onClick={() => removeMatchValue(setDecisionConfigs, decisionConfigs, index)}
                                          className={styles.removeButton}
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    ))}
                                    <button
                                      onClick={() => addMatchValue(setDecisionConfigs, decisionConfigs)}
                                      className={styles.addButton}
                                    >
                                      Add Match Value
                                    </button>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className={styles.hint}>No dropdown or text headers available</div>
                            )}
                          </div>

                          {/* Need Section */}
                          <div className={`${styles.sectionGroup} ${isDarkTheme ? styles.darkTheme : ''}`}>
                            <h2 className={styles.sectionTitle}>Do they need this thing?</h2>
                            <div className={styles.hint}>
                              Select a dropdown or text field (e.g., interestLevel) and define match values.
                            </div>
                            {(dropdownHeaders.length > 0 || textHeaders.length > 0) ? (
                              <>
                                <select
                                  value={needHeader}
                                  onChange={e => {
                                    setNeedHeader(e.target.value);
                                    setNeedConfigs([]);
                                  }}
                                  className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                                >
                                  <option value="">Select a header...</option>
                                  {dropdownHeaders.map(header => (
                                    <option key={header.key} value={header.key}>
                                      {header.name} (Dropdown)
                                    </option>
                                  ))}
                                  {textHeaders.map(header => (
                                    <option key={header.key} value={header.key}>
                                      {header.name} (Text)
                                    </option>
                                  ))}
                                </select>
                                {needHeader && (
                                  <div className={`${styles.headerConfig} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                    {needConfigs.map((config, index) => (
                                      <div key={index} className={styles.configRow}>
                                        {templateHeaders.find(h => h.key === needHeader)?.type === 'dropdown' ? (
                                          <select
                                            value={config.matchValue}
                                            onChange={e =>
                                              updateConfig(setNeedConfigs, needConfigs, index, 'matchValue', e.target.value)
                                            }
                                            className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                                          >
                                            <option value="">Select a value...</option>
                                            {getDropdownValues(needHeader).map(value => (
                                              <option key={value} value={value}>
                                                {value}
                                              </option>
                                            ))}
                                          </select>
                                        ) : (
                                          <input
                                            type="text"
                                            placeholder="e.g., High"
                                            value={config.matchValue}
                                            onChange={e =>
                                              updateConfig(setNeedConfigs, needConfigs, index, 'matchValue', e.target.value)
                                            }
                                            className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ''}`}
                                          />
                                        )}
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          placeholder="Score (0-100)"
                                          value={config.coefficient}
                                          onChange={e =>
                                            updateConfig(
                                              setNeedConfigs,
                                              needConfigs,
                                              index,
                                              'coefficient',
                                              parseInt(e.target.value) || 0
                                            )
                                          }
                                          className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ''}`}
                                        />
                                        <button
                                          onClick={() => removeMatchValue(setNeedConfigs, needConfigs, index)}
                                          className={styles.removeButton}
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    ))}
                                    <button
                                      onClick={() => addMatchValue(setNeedConfigs, needConfigs)}
                                      className={styles.addButton}
                                    >
                                      Add Match Value
                                    </button>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className={styles.hint}>No dropdown or text headers available</div>
                            )}
                          </div>

                          {/* Urgency Section */}
                          <div className={`${styles.sectionGroup} ${isDarkTheme ? styles.darkTheme : ''}`}>
                            <h2 className={styles.sectionTitle}>Is it now they want to buy?</h2>
                            <div className={styles.hint}>
                              Select a dropdown or text field (e.g., urgencyLevel) and define match values.
                            </div>
                            {(dropdownHeaders.length > 0 || textHeaders.length > 0) ? (
                              <>
                                <select
                                  value={urgencyHeader}
                                  onChange={e => {
                                    setUrgencyHeader(e.target.value);
                                    setUrgencyConfigs([]);
                                  }}
                                  className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                                >
                                  <option value="">Select a header...</option>
                                  {dropdownHeaders.map(header => (
                                    <option key={header.key} value={header.key}>
                                      {header.name} (Dropdown)
                                    </option>
                                  ))}
                                  {textHeaders.map(header => (
                                    <option key={header.key} value={header.key}>
                                      {header.name} (Text)
                                    </option>
                                  ))}
                                </select>
                                {urgencyHeader && (
                                  <div className={`${styles.headerConfig} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                    {urgencyConfigs.map((config, index) => (
                                      <div key={index} className={styles.configRow}>
                                        {templateHeaders.find(h => h.key === urgencyHeader)?.type === 'dropdown' ? (
                                          <select
                                            value={config.matchValue}
                                            onChange={e =>
                                              updateConfig(setUrgencyConfigs, urgencyConfigs, index, 'matchValue', e.target.value)
                                            }
                                            className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                                          >
                                            <option value="">Select a value...</option>
                                            {getDropdownValues(urgencyHeader).map(value => (
                                              <option key={value} value={value}>
                                                {value}
                                              </option>
                                            ))}
                                          </select>
                                        ) : (
                                          <input
                                            type="text"
                                            placeholder="e.g., Immediately"
                                            value={config.matchValue}
                                            onChange={e =>
                                              updateConfig(setUrgencyConfigs, urgencyConfigs, index, 'matchValue', e.target.value)
                                            }
                                            className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ''}`}
                                          />
                                        )}
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          placeholder="Score (0-100)"
                                          value={config.coefficient}
                                          onChange={e =>
                                            updateConfig(
                                              setUrgencyConfigs,
                                              urgencyConfigs,
                                              index,
                                              'coefficient',
                                              parseInt(e.target.value) || 0
                                            )
                                          }
                                          className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ''}`}
                                        />
                                        <button
                                          onClick={() => removeMatchValue(setUrgencyConfigs, urgencyConfigs, index)}
                                          className={styles.removeButton}
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    ))}
                                    <button
                                      onClick={() => addMatchValue(setUrgencyConfigs, urgencyConfigs)}
                                      className={styles.addButton}
                                    >
                                      Add Match Value
                                    </button>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className={styles.hint}>No dropdown or text headers available</div>
                            )}
                          </div>

                          {/* Display Calculated Score */}
                          {calculatedScore !== null && (
                            <div className={styles.inputGroup}>
                              <label className={styles.label}>Maximum Lead Score (out of 100)</label>
                              <div className={styles.typeOfRecordsDisplay}>{calculatedScore}</div>
                            </div>
                          )}

                          {/* Display Type of Records for the selected template */}
                          {selectedTemplate && (
                            <div className={styles.inputGroup}>
                              <label className={styles.label}>Type of Records for this Template</label>
                              <div className={styles.typeOfRecordsDisplay}>
                                {recordTemplates.find(t => t.name === selectedTemplate)?.typeOfRecord || 'N/A'}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {/* Mobile: slide-in panel */}
      {isMobile && (
        <div
          className={`${styles.recordDetailsMobile} ${isDarkTheme ? styles.darkTheme : ''} ${
            (step === 1 || step === 2) && !isClosing ? styles.recordOpen : styles.recordClosed
          }`}
        >
          {step === 1 && (
            <div className={styles.formContent}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Choose Action Type</label>
                <div className={styles.actionTypeButtons}>
                  {actionOptions.slice(1).map(option => (
                    <button
                      key={option.value}
                      className={`${styles.actionTypeButton} ${selectedAction === option.value ? styles.activeType : ''}`}
                      onClick={() => handleChooseType(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {step === 2 && (selectedAction || editingActionId) && (
            <div
              className={styles.formContent}
              style={{ background: isDarkTheme ? '#1c1c1e' : '#fff', borderRadius: 24, minHeight: '100vh' }}
            >
              <button className={styles.backButton} type="button" onClick={handleBack}>
                <FaChevronLeft style={{ marginRight: 8 }} /> {backButtonLabel}
              </button>
              <div className={styles.inputGroup}>
                <label htmlFor="action-title" className={styles.label}>
                  Action Title
                </label>
                <input
                  id="action-title"
                  type="text"
                  className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ''}`}
                  placeholder="Enter a name for this action"
                  value={actionName}
                  onChange={e => setActionName(e.target.value)}
                  maxLength={64}
                  required
                />
              </div>
              <div className={styles.header}>
                {selectedAction === 'leadScore' && selectedTemplate && (
                  <button onClick={saveConfiguration} className={styles.updateButton}>
                    Save
                  </button>
                )}
              </div>
              {successMessage && <div className={styles.success}>{successMessage}</div>}
              {error && <div className={styles.error}>{error}</div>}
              {selectedAction && (
                <div className={styles.formContent}>
                  <div className={styles.inputGroup}>
                    <label htmlFor="action-select" className={styles.label}>
                      Choose an action
                    </label>
                    <select
                      id="action-select"
                      value={selectedAction}
                      onChange={e => {
                        setSelectedAction(e.target.value);
                        setSelectedTemplate('');
                        setMoneyHeader('');
                        setMoneyConfigs([]);
                        setDecisionHeader('');
                        setNeedHeader('');
                        setUrgencyHeader('');
                        setDecisionConfigs([]);
                        setNeedConfigs([]);
                        setUrgencyConfigs([]);
                        setScoreHeaderKey('');
                        setCalculatedScore(null);
                        setError('');
                        setSuccessMessage('');
                      }}
                      className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                    >
                      {actionOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedAction === 'leadScore' && (
                    <>
                      <div className={styles.inputGroup}>
                        <label htmlFor="template-select" className={styles.label}>
                          Choose a record template
                        </label>
                        <select
                          id="template-select"
                          value={selectedTemplate}
                          onChange={e => {
                            setSelectedTemplate(e.target.value);
                            setMoneyHeader('');
                            setMoneyConfigs([]);
                            setDecisionHeader('');
                            setNeedHeader('');
                            setUrgencyHeader('');
                            setDecisionConfigs([]);
                            setNeedConfigs([]);
                            setUrgencyConfigs([]);
                            setScoreHeaderKey('');
                            setCalculatedScore(null);
                            setError('');
                            setSuccessMessage('');
                          }}
                          className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                        >
                          <option value="">Select a template...</option>
                          {recordTemplates?.map(template => (
                            <option key={template.name} value={template.name}>
                              {template.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedTemplate && numberHeaders.length > 0 && (
                        <div className={styles.inputGroup}>
                          <label htmlFor="score-header-select" className={styles.label}>
                            Select Header for Lead Score
                          </label>
                          <select
                            id="score-header-select"
                            value={scoreHeaderKey}
                            onChange={e => setScoreHeaderKey(e.target.value)}
                            className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                          >
                            <option value="">Select a header...</option>
                            {numberHeaders.map(header => (
                              <option key={header.key} value={header.key}>
                                {header.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {selectedTemplate && (
                        <>
                          {/* Money Section */}
                          <div className={`${styles.sectionGroup} ${isDarkTheme ? styles.darkTheme : ''}`}>
                            <h2 className={styles.sectionTitle}>Do they have the money?</h2>
                            <div className={styles.hint}>
                              Select a dropdown or text field (e.g., serviceType) and define match values.
                            </div>
                            {(dropdownHeaders.length > 0 || textHeaders.length > 0) ? (
                              <>
                                <select
                                  value={moneyHeader}
                                  onChange={e => {
                                    setMoneyHeader(e.target.value);
                                    setMoneyConfigs([]);
                                  }}
                                  className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                                >
                                  <option value="">Select a header...</option>
                                  {dropdownHeaders.map(header => (
                                    <option key={header.key} value={header.key}>
                                      {header.name} (Dropdown)
                                    </option>
                                  ))}
                                  {textHeaders.map(header => (
                                    <option key={header.key} value={header.key}>
                                      {header.name} (Text)
                                    </option>
                                  ))}
                                </select>
                                {moneyHeader && (
                                  <div className={`${styles.headerConfig} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                    {moneyConfigs.map((config, index) => (
                                      <div key={index} className={styles.configRow}>
                                        {templateHeaders.find(h => h.key === moneyHeader)?.type === 'dropdown' ? (
                                          <select
                                            value={config.matchValue}
                                            onChange={e =>
                                              updateConfig(setMoneyConfigs, moneyConfigs, index, 'matchValue', e.target.value)
                                            }
                                            className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                                          >
                                            <option value="">Select a value...</option>
                                            {getDropdownValues(moneyHeader).map(value => (
                                              <option key={value} value={value}>
                                                {value}
                                              </option>
                                            ))}
                                          </select>
                                        ) : (
                                          <input
                                            type="text"
                                            placeholder="e.g., Deep Cleaning"
                                            value={config.matchValue}
                                            onChange={e =>
                                              updateConfig(setMoneyConfigs, moneyConfigs, index, 'matchValue', e.target.value)
                                            }
                                            className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ''}`}
                                          />
                                        )}
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          placeholder="Score (0-100)"
                                          value={config.coefficient}
                                          onChange={e =>
                                            updateConfig(
                                              setMoneyConfigs,
                                              moneyConfigs,
                                              index,
                                              'coefficient',
                                              parseInt(e.target.value) || 0
                                            )
                                          }
                                          className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ''}`}
                                        />
                                        <button
                                          onClick={() => removeMatchValue(setMoneyConfigs, moneyConfigs, index)}
                                          className={styles.removeButton}
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    ))}
                                    <button
                                      onClick={() => addMatchValue(setMoneyConfigs, moneyConfigs)}
                                      className={styles.addButton}
                                    >
                                      Add Match Value
                                    </button>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className={styles.hint}>No dropdown or text headers available</div>
                            )}
                          </div>

                          {/* Authority Section */}
                          <div className={`${styles.sectionGroup} ${isDarkTheme ? styles.darkTheme : ''}`}>
                            <h2 className={styles.sectionTitle}>Authority to make the decision?</h2>
                            <div className={styles.hint}>
                              Select a dropdown or text field (e.g., decisionMaker) and define match values.
                            </div>
                            {(dropdownHeaders.length > 0 || textHeaders.length > 0) ? (
                              <>
                                <select
                                  value={decisionHeader}
                                  onChange={e => {
                                    setDecisionHeader(e.target.value);
                                    setDecisionConfigs([]);
                                  }}
                                  className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                                >
                                  <option value="">Select a header...</option>
                                  {dropdownHeaders.map(header => (
                                    <option key={header.key} value={header.key}>
                                      {header.name} (Dropdown)
                                    </option>
                                  ))}
                                  {textHeaders.map(header => (
                                    <option key={header.key} value={header.key}>
                                      {header.name} (Text)
                                    </option>
                                  ))}
                                </select>
                                {decisionHeader && (
                                  <div className={`${styles.headerConfig} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                    {decisionConfigs.map((config, index) => (
                                      <div key={index} className={styles.configRow}>
                                        {templateHeaders.find(h => h.key === decisionHeader)?.type === 'dropdown' ? (
                                          <select
                                            value={config.matchValue}
                                            onChange={e =>
                                              updateConfig(setDecisionConfigs, decisionConfigs, index, 'matchValue', e.target.value)
                                            }
                                            className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                                          >
                                            <option value="">Select a value...</option>
                                            {getDropdownValues(decisionHeader).map(value => (
                                              <option key={value} value={value}>
                                                {value}
                                              </option>
                                            ))}
                                          </select>
                                        ) : (
                                          <input
                                            type="text"
                                            placeholder="e.g., Yes"
                                            value={config.matchValue}
                                            onChange={e =>
                                              updateConfig(setDecisionConfigs, decisionConfigs, index, 'matchValue', e.target.value)
                                            }
                                            className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ''}`}
                                          />
                                        )}
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          placeholder="Score (0-100)"
                                          value={config.coefficient}
                                          onChange={e =>
                                            updateConfig(
                                              setDecisionConfigs,
                                              decisionConfigs,
                                              index,
                                              'coefficient',
                                              parseInt(e.target.value) || 0
                                            )
                                          }
                                          className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ''}`}
                                        />
                                        <button
                                          onClick={() => removeMatchValue(setDecisionConfigs, decisionConfigs, index)}
                                          className={styles.removeButton}
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    ))}
                                    <button
                                      onClick={() => addMatchValue(setDecisionConfigs, decisionConfigs)}
                                      className={styles.addButton}
                                    >
                                      Add Match Value
                                    </button>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className={styles.hint}>No dropdown or text headers available</div>
                            )}
                          </div>

                          {/* Need Section */}
                          <div className={`${styles.sectionGroup} ${isDarkTheme ? styles.darkTheme : ''}`}>
                            <h2 className={styles.sectionTitle}>Do they need this thing?</h2>
                            <div className={styles.hint}>
                              Select a dropdown or text field (e.g., interestLevel) and define match values.
                            </div>
                            {(dropdownHeaders.length > 0 || textHeaders.length > 0) ? (
                              <>
                                <select
                                  value={needHeader}
                                  onChange={e => {
                                    setNeedHeader(e.target.value);
                                    setNeedConfigs([]);
                                  }}
                                  className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                                >
                                  <option value="">Select a header...</option>
                                  {dropdownHeaders.map(header => (
                                    <option key={header.key} value={header.key}>
                                      {header.name} (Dropdown)
                                    </option>
                                  ))}
                                  {textHeaders.map(header => (
                                    <option key={header.key} value={header.key}>
                                      {header.name} (Text)
                                    </option>
                                  ))}
                                </select>
                                {needHeader && (
                                  <div className={`${styles.headerConfig} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                    {needConfigs.map((config, index) => (
                                      <div key={index} className={styles.configRow}>
                                        {templateHeaders.find(h => h.key === needHeader)?.type === 'dropdown' ? (
                                          <select
                                            value={config.matchValue}
                                            onChange={e =>
                                              updateConfig(setNeedConfigs, needConfigs, index, 'matchValue', e.target.value)
                                            }
                                            className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                                          >
                                            <option value="">Select a value...</option>
                                            {getDropdownValues(needHeader).map(value => (
                                              <option key={value} value={value}>
                                                {value}
                                              </option>
                                            ))}
                                          </select>
                                        ) : (
                                          <input
                                            type="text"
                                            placeholder="e.g., High"
                                            value={config.matchValue}
                                            onChange={e =>
                                              updateConfig(setNeedConfigs, needConfigs, index, 'matchValue', e.target.value)
                                            }
                                            className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ''}`}
                                          />
                                        )}
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          placeholder="Score (0-100)"
                                          value={config.coefficient}
                                          onChange={e =>
                                            updateConfig(
                                              setNeedConfigs,
                                              needConfigs,
                                              index,
                                              'coefficient',
                                              parseInt(e.target.value) || 0
                                            )
                                          }
                                          className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ''}`}
                                        />
                                        <button
                                          onClick={() => removeMatchValue(setNeedConfigs, needConfigs, index)}
                                          className={styles.removeButton}
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    ))}
                                    <button
                                      onClick={() => addMatchValue(setNeedConfigs, needConfigs)}
                                      className={styles.addButton}
                                    >
                                      Add Match Value
                                    </button>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className={styles.hint}>No dropdown or text headers available</div>
                            )}
                          </div>

                          {/* Urgency Section */}
                          <div className={`${styles.sectionGroup} ${isDarkTheme ? styles.darkTheme : ''}`}>
                            <h2 className={styles.sectionTitle}>Is it now they want to buy?</h2>
                            <div className={styles.hint}>
                              Select a dropdown or text field (e.g., urgencyLevel) and define match values.
                            </div>
                            {(dropdownHeaders.length > 0 || textHeaders.length > 0) ? (
                              <>
                                <select
                                  value={urgencyHeader}
                                  onChange={e => {
                                    setUrgencyHeader(e.target.value);
                                    setUrgencyConfigs([]);
                                  }}
                                  className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                                >
                                  <option value="">Select a header...</option>
                                  {dropdownHeaders.map(header => (
                                    <option key={header.key} value={header.key}>
                                      {header.name} (Dropdown)
                                    </option>
                                  ))}
                                  {textHeaders.map(header => (
                                    <option key={header.key} value={header.key}>
                                      {header.name} (Text)
                                    </option>
                                  ))}
                                </select>
                                {urgencyHeader && (
                                  <div className={`${styles.headerConfig} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                    {urgencyConfigs.map((config, index) => (
                                      <div key={index} className={styles.configRow}>
                                        {templateHeaders.find(h => h.key === urgencyHeader)?.type === 'dropdown' ? (
                                          <select
                                            value={config.matchValue}
                                            onChange={e =>
                                              updateConfig(setUrgencyConfigs, urgencyConfigs, index, 'matchValue', e.target.value)
                                            }
                                            className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                                          >
                                            <option value="">Select a value...</option>
                                            {getDropdownValues(urgencyHeader).map(value => (
                                              <option key={value} value={value}>
                                                {value}
                                              </option>
                                            ))}
                                          </select>
                                        ) : (
                                          <input
                                            type="text"
                                            placeholder="e.g., Immediately"
                                            value={config.matchValue}
                                            onChange={e =>
                                              updateConfig(setUrgencyConfigs, urgencyConfigs, index, 'matchValue', e.target.value)
                                            }
                                            className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ''}`}
                                          />
                                        )}
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          placeholder="Score (0-100)"
                                          value={config.coefficient}
                                          onChange={e =>
                                            updateConfig(
                                              setUrgencyConfigs,
                                              urgencyConfigs,
                                              index,
                                              'coefficient',
                                              parseInt(e.target.value) || 0
                                            )
                                          }
                                          className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ''}`}
                                        />
                                        <button
                                          onClick={() => removeMatchValue(setUrgencyConfigs, urgencyConfigs, index)}
                                          className={styles.removeButton}
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    ))}
                                    <button
                                      onClick={() => addMatchValue(setUrgencyConfigs, urgencyConfigs)}
                                      className={styles.addButton}
                                    >
                                      Add Match Value
                                    </button>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className={styles.hint}>No dropdown or text headers available</div>
                            )}
                          </div>

                          {/* Display Calculated Score */}
                          {calculatedScore !== null && (
                            <div className={styles.inputGroup}>
                              <label className={styles.label}>Maximum Lead Score (out of 100)</label>
                              <div className={styles.typeOfRecordsDisplay}>{calculatedScore}</div>
                            </div>
                          )}

                          {/* Display Type of Records for the selected template */}
                          {selectedTemplate && (
                            <div className={styles.inputGroup}>
                              <label className={styles.label}>Type of Records for this Template</label>
                              <div className={styles.typeOfRecordsDisplay}>
                                {recordTemplates.find(t => t.name === selectedTemplate)?.typeOfRecord || 'N/A'}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Actions;