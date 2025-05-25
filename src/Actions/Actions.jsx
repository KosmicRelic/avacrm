import React, { useContext, useState, useEffect } from 'react';
import { MainContext } from '../Contexts/MainContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase'; // Adjust path to your Firebase config
import styles from './Actions.module.css';
import { FaChevronLeft } from 'react-icons/fa';

const Actions = () => {
  const { cardTemplates, businessId, isDarkTheme, actions = [], setActions } = useContext(MainContext);
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [moneyHeader, setMoneyHeader] = useState('');
  const [serviceHeader, setServiceHeader] = useState('');
  const [moneyCoefficient, setMoneyCoefficient] = useState(25);
  const [decisionHeader, setDecisionHeader] = useState('');
  const [decisionConfigs, setDecisionConfigs] = useState([]);
  const [needHeader, setNeedHeader] = useState('');
  const [needConfigs, setNeedConfigs] = useState([]);
  const [urgencyHeader, setUrgencyHeader] = useState('');
  const [urgencyDays, setUrgencyDays] = useState(7);
  const [urgencyWeight, setUrgencyWeight] = useState(25);
  const [scoreHeaderKey, setScoreHeaderKey] = useState('');
  const [calculatedScore, setCalculatedScore] = useState(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [step, setStep] = useState(0); // 0: idle, 1: choose type, 2: configure
  const [editingActionId, setEditingActionId] = useState(null); // null for new, or action id for edit
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
  const templateObj = cardTemplates?.find(t => t.name === selectedTemplate);
  const templateHeaders = templateObj?.headers || [];

  // Filter headers by type
  const numberHeaders = templateHeaders.filter(header => header.type === 'number');
  const dropdownHeaders = templateHeaders.filter(header => header.type === 'dropdown');
  const textHeaders = templateHeaders.filter(header => header.type === 'text');
  const dateHeaders = templateHeaders.filter(header => header.type === 'date');

  // Get values for a dropdown header
  const getDropdownValues = headerKey => {
    const header = templateHeaders.find(h => h.key === headerKey);
    return header?.type === 'dropdown' && Array.isArray(header.options) ? header.options : [];
  };

  // Add a new match value for Decision or Need
  const addMatchValue = (setter, configs) => {
    setter([...configs, { matchValue: '', coefficient: 25 }]);
  };

  // Update match value or coefficient for Decision or Need
  const updateConfig = (setter, configs, index, field, value) => {
    setter(
      configs.map((config, i) =>
        i === index ? { ...config, [field]: value } : config
      )
    );
  };

  // Remove a match value for Decision or Need
  const removeMatchValue = (setter, configs, index) => {
    setter(configs.filter((_, i) => i !== index));
  };

  // Validate configuration
  const validateConfig = () => {
    if (!selectedTemplate) {
      return 'Please select a template.';
    }
    if (!scoreHeaderKey) {
      return 'Please select a header to store the lead score.';
    }
    if (!moneyHeader && !decisionHeader && !needHeader && !urgencyHeader) {
      return 'Please configure at least one criterion.';
    }
    if (moneyHeader) {
      if (!serviceHeader) {
        return 'Please select a service cost header for Money.';
      }
      if (isNaN(moneyCoefficient) || moneyCoefficient < 0 || moneyCoefficient > 100) {
        return 'Please set a valid coefficient (0-100) for Money.';
      }
    }
    if (decisionHeader && decisionConfigs.length === 0) {
      return 'Please add at least one match value for Authority.';
    }
    if (needHeader && needConfigs.length === 0) {
      return 'Please add at least one match value for Need.';
    }
    if (decisionHeader) {
      const header = templateHeaders.find(h => h.key === decisionHeader);
      const isDropdown = header?.type === 'dropdown';
      const validValues = isDropdown ? getDropdownValues(decisionHeader) : null;
      const invalidDecision = decisionConfigs.some(
        config =>
          !config.matchValue ||
          isNaN(config.coefficient) ||
          config.coefficient < 0 ||
          config.coefficient > 100 ||
          (isDropdown && !validValues.includes(config.matchValue))
      );
      if (invalidDecision) {
        return `Please ensure all Authority match values are ${
          isDropdown ? 'from the dropdown options' : 'non-empty'
        } and coefficients are 0-100.`;
      }
    }
    if (needHeader) {
      const header = templateHeaders.find(h => h.key === needHeader);
      const isDropdown = header?.type === 'dropdown';
      const validValues = isDropdown ? getDropdownValues(needHeader) : null;
      const invalidNeed = needConfigs.some(
        config =>
          !config.matchValue ||
          isNaN(config.coefficient) ||
          config.coefficient < 0 ||
          config.coefficient > 100 ||
          (isDropdown && !validValues.includes(config.matchValue))
      );
      if (invalidNeed) {
        return `Please ensure all Need match values are ${
          isDropdown ? 'from the dropdown options' : 'non-empty'
        } and coefficients are 0-100.`;
      }
    }
    if (urgencyHeader && (isNaN(urgencyDays) || urgencyDays < 1 || isNaN(urgencyWeight) || urgencyWeight < 0 || urgencyWeight > 100)) {
      return 'Please set valid urgency days (≥1) and weight (0-100).';
    }
    return '';
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
    let score = 0;

    // Money: Assume budget meets or exceeds service cost
    if (moneyHeader && serviceHeader) {
      score += parseInt(moneyCoefficient) || 0;
    }

    // Authority: Use highest coefficient
    if (decisionHeader) {
      const maxCoefficient = Math.max(
        ...decisionConfigs.map(config => parseInt(config.coefficient) || 0),
        0
      );
      score += maxCoefficient;
    }

    // Need: Use highest coefficient
    if (needHeader) {
      const maxCoefficient = Math.max(
        ...needConfigs.map(config => parseInt(config.coefficient) || 0),
        0
      );
      score += maxCoefficient;
    }

    // Urgency: Assume date is today (max urgency)
    if (urgencyHeader) {
      const urgencyScore = parseInt(urgencyWeight) || 0;
      score += urgencyScore;
    }

    // Normalize to 0-100
    const finalScore = Math.min(100, Math.max(0, Math.round(score)));
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
        type: selectedAction, // always save type
        templateName: selectedTemplate,
        scoreHeaderKey,
        money: moneyHeader && serviceHeader ? { moneyHeader, serviceHeader, coefficient: parseInt(moneyCoefficient) || 0 } : null,
        authority: decisionHeader ? { decisionHeader, configs: decisionConfigs } : null,
        need: needHeader ? { needHeader, configs: needConfigs } : null,
        urgency: urgencyHeader ? { urgencyHeader, days: parseInt(urgencyDays) || 1, weight: parseInt(urgencyWeight) || 0 } : null,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, `businesses/${businessId}/actions`, editingActionId || 'leadScoringConfig'), config);
      setSuccessMessage('Configuration saved successfully!');
      setError('');
    } catch (err) {
      setError('Failed to save configuration: ' + err.message);
      setSuccessMessage('');
    }
  };

  // When a saved action is selected, load its data
  const handleEditAction = (action) => {
    console.log('[handleEditAction] action:', action);
    // Infer type if missing
    let type = action.type;
    if (!type) {
      if (action.scoreHeaderKey) type = 'leadScore';
      // Add more inference for other types if needed
    }
    setEditingActionId(() => action.docId);
    setStep(() => 2);
    setSelectedAction(() => type || '');
    setSelectedTemplate(() => action.templateName || '');
    setMoneyHeader(() => action.money?.moneyHeader || '');
    setServiceHeader(() => action.money?.serviceHeader || '');
    setMoneyCoefficient(() => action.money?.coefficient ?? 25);
    setDecisionHeader(() => action.authority?.decisionHeader || '');
    setDecisionConfigs(() => action.authority?.configs || []);
    setNeedHeader(() => action.need?.needHeader || '');
    setNeedConfigs(() => action.need?.configs || []);
    setUrgencyHeader(() => action.urgency?.urgencyHeader || '');
    setUrgencyDays(() => action.urgency?.days ?? 7);
    setUrgencyWeight(() => action.urgency?.weight ?? 25);
    setScoreHeaderKey(() => action.scoreHeaderKey || '');
    setActionName(() => action.name || '');
    setCalculatedScore(() => null);
    setError(() => '');
    setSuccessMessage(() => '');
    setBackButtonLabel(() => action.name || action.type || 'Back');
    setTimeout(() => {
      console.log('[handleEditAction] State after set:', {
        editingActionId: action.docId,
        step: 2,
        selectedAction: type || '',
        selectedTemplate: action.templateName || '',
        moneyHeader: action.money?.moneyHeader || '',
        serviceHeader: action.money?.serviceHeader || '',
        moneyCoefficient: action.money?.coefficient ?? 25,
        decisionHeader: action.authority?.decisionHeader || '',
        decisionConfigs: action.authority?.configs || [],
        needHeader: action.need?.needHeader || '',
        needConfigs: action.need?.configs || [],
        urgencyHeader: action.urgency?.urgencyHeader || '',
        urgencyDays: action.urgency?.days ?? 7,
        urgencyWeight: action.urgency?.weight ?? 25,
        scoreHeaderKey: action.scoreHeaderKey || '',
        actionName: action.name || '',
      });
    }, 100);
  };

  // When 'Create Action' is clicked, go to step 1 and reset all form state
  const handleCreateAction = () => {
    setEditingActionId(null);
    setStep(1);
    setSelectedAction('');
    setSelectedTemplate('');
    setMoneyHeader('');
    setServiceHeader('');
    setMoneyCoefficient(25);
    setDecisionHeader('');
    setDecisionConfigs([]);
    setNeedHeader('');
    setNeedConfigs([]);
    setUrgencyHeader('');
    setUrgencyDays(7);
    setUrgencyWeight(25);
    setScoreHeaderKey('');
    setActionName('');
    setCalculatedScore(null);
    setError('');
    setSuccessMessage('');
  };

  // When type is chosen in step 1, go to step 2
  const handleChooseType = (type) => {
    setSelectedAction(type);
    setStep(2);
    const label = actionOptions.find(opt => opt.value === type)?.label || 'Back';
    setBackButtonLabel(label);
  };

  // Back button handler for both desktop and mobile
  const handleBack = () => {
    if (isMobile) {
      setIsClosing(true);
      setTimeout(() => {
        setStep(0);
        setEditingActionId(null);
        setIsClosing(false);
      }, 300); // match slide out duration
    } else {
      if (editingActionId) {
        setStep(0);
        setEditingActionId(null);
      } else {
        setStep(1);
      }
    }
  };

  // In the right panel, show the form if step === 2 and (editingActionId is set or selectedAction is set)
  console.log('[Actions render] step:', step, 'editingActionId:', editingActionId, 'selectedAction:', selectedAction);
  return (
    <div className={`${styles.sheetWrapper} ${isDarkTheme ? styles.darkTheme : ''}`}> {/* Main wrapper */}
      <div className={`${styles.tableContainer} ${isDarkTheme ? styles.darkTheme : ''}`}> {/* Sidebar */}
        <div className={`${styles.categoryList} ${isDarkTheme ? styles.darkTheme : ''}`}> {/* Sidebar list */}
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
        <div className={`${styles.cardDetailsContainer} ${isDarkTheme ? styles.darkTheme : ''}`}> {/* Main content */}
          {/* Step 1: Choose type */}
          {step === 1 && (
            <div className={styles.formContent}>
              {console.log('[Actions render] Showing step 1 (choose type)')}
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
          {/* Step 2: Configure action (show if editing or creating) */}
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
                    Update
                  </button>
                )}
              </div>
              {successMessage && <div className={styles.success}>{successMessage}</div>}
              {error && <div className={styles.error}>{error}</div>}
              {/* Only show form if an action is selected */}
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
                        setServiceHeader('');
                        setMoneyCoefficient(25);
                        setDecisionHeader('');
                        setNeedHeader('');
                        setUrgencyHeader('');
                        setDecisionConfigs([]);
                        setNeedConfigs([]);
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
                        <label htmlFor="template-select" className={styles.label}>Choose a card template</label>
                        <select
                          id="template-select"
                          value={selectedTemplate}
                          onChange={e => {
                            setSelectedTemplate(e.target.value);
                            setMoneyHeader('');
                            setServiceHeader('');
                            setMoneyCoefficient(25);
                            setDecisionHeader('');
                            setNeedHeader('');
                            setUrgencyHeader('');
                            setDecisionConfigs([]);
                            setNeedConfigs([]);
                            setScoreHeaderKey('');
                            setCalculatedScore(null);
                            setError('');
                            setSuccessMessage('');
                          }}
                          className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                        >
                          <option value="">Select a template...</option>
                          {cardTemplates?.map(template => (
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
                              Select a number field for budget (e.g., budget) and another for service cost (e.g., serviceCost).
                            </div>
                            {numberHeaders.length > 0 ? (
                              <>
                                <select
                                  value={moneyHeader}
                                  onChange={e => {
                                    setMoneyHeader(e.target.value);
                                    setServiceHeader('');
                                  }}
                                  className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                                >
                                  <option value="">Select a budget header...</option>
                                  {numberHeaders.map(header => (
                                    <option key={header.key} value={header.key}>
                                      {header.name}
                                    </option>
                                  ))}
                                </select>
                                {moneyHeader && numberHeaders.length > 1 && (
                                  <>
                                    <select
                                      value={serviceHeader}
                                      onChange={e => setServiceHeader(e.target.value)}
                                      className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                                    >
                                      <option value="">Select a service cost header...</option>
                                      {numberHeaders
                                        .filter(header => header.key !== moneyHeader)
                                        .map(header => (
                                          <option key={header.key} value={header.key}>
                                            {header.name}
                                          </option>
                                        ))}
                                    </select>
                                    {serviceHeader && (
                                      <div className={styles.configInputs}>
                                        <label className={styles.label}>Score Contribution (0-100)</label>
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          value={moneyCoefficient}
                                          onChange={e => setMoneyCoefficient(parseInt(e.target.value) || 0)}
                                          className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ''}`}
                                        />
                                      </div>
                                    )}
                                  </>
                                )}
                              </>
                            ) : (
                              <div className={styles.hint}>No number headers available</div>
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
                                        {templateHeaders.find(h => h.key === decisionHeader)?.type ===
                                        'dropdown' ? (
                                          <select
                                            value={config.matchValue}
                                            onChange={e =>
                                              updateConfig(
                                                setDecisionConfigs,
                                                decisionConfigs,
                                                index,
                                                'matchValue',
                                                e.target.value
                                              )
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
                                              updateConfig(
                                                setDecisionConfigs,
                                                decisionConfigs,
                                                index,
                                                'matchValue',
                                                e.target.value
                                              )
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
                                          onClick={() =>
                                            removeMatchValue(setDecisionConfigs, decisionConfigs, index)
                                          }
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
                                        {templateHeaders.find(h => h.key === needHeader)?.type ===
                                        'dropdown' ? (
                                          <select
                                            value={config.matchValue}
                                            onChange={e =>
                                              updateConfig(
                                                setNeedConfigs,
                                                needConfigs,
                                                index,
                                                'matchValue',
                                                e.target.value
                                              )
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
                                              updateConfig(
                                                setNeedConfigs,
                                                needConfigs,
                                                index,
                                                'matchValue',
                                                e.target.value
                                              )
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
                              Select a date field (e.g., deadline) and set urgency parameters.
                            </div>
                            <div className={styles.description}>
                              This section checks how soon the lead wants to buy. Set the maximum days for urgency and the score contribution.
                            </div>
                            {dateHeaders.length > 0 ? (
                              <>
                                <select
                                  value={urgencyHeader}
                                  onChange={e => setUrgencyHeader(e.target.value)}
                                  className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                                >
                                  <option value="">Select a date header...</option>
                                  {dateHeaders.map(header => (
                                    <option key={header.key} value={header.key}>
                                      {header.name}
                                    </option>
                                  ))}
                                </select>
                                {urgencyHeader && (
                                  <div className={styles.configInputs}>
                                    <label className={styles.label}>Max Days for Urgency</label>
                                    <input
                                      type="number"
                                      min="1"
                                      max="30"
                                      value={urgencyDays}
                                      onChange={e => setUrgencyDays(parseInt(e.target.value) || 1)}
                                      className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ''}`}
                                    />
                                    <label className={styles.label}>Urgency Score (0-100)</label>
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={urgencyWeight}
                                      onChange={e => setUrgencyWeight(parseInt(e.target.value) || 0)}
                                      className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ''}`}
                                    />
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className={styles.hint}>No date headers available</div>
                            )}
                          </div>
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
      {/* Mobile: slide-in panel with background and back button */}
      {isMobile && (
        <div className={`${styles.cardDetailsMobile} ${isDarkTheme ? styles.darkTheme : ''} ${(step === 1 || step === 2) && !isClosing ? styles.cardOpen : styles.cardClosed}`}> {/* Mobile content */}
          {step === 2 && (selectedAction || editingActionId) && (
            <div className={styles.formContent} style={{background: isDarkTheme ? '#1c1c1e' : '#fff', borderRadius: 24, minHeight: '100vh'}}>
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
                    Update
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
                        setServiceHeader('');
                        setMoneyCoefficient(25);
                        setDecisionHeader('');
                        setNeedHeader('');
                        setUrgencyHeader('');
                        setDecisionConfigs([]);
                        setNeedConfigs([]);
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
                        <label htmlFor="template-select" className={styles.label}>Choose a card template</label>
                        <select
                          id="template-select"
                          value={selectedTemplate}
                          onChange={e => {
                            setSelectedTemplate(e.target.value);
                            setMoneyHeader('');
                            setServiceHeader('');
                            setMoneyCoefficient(25);
                            setDecisionHeader('');
                            setNeedHeader('');
                            setUrgencyHeader('');
                            setDecisionConfigs([]);
                            setNeedConfigs([]);
                            setScoreHeaderKey('');
                            setCalculatedScore(null);
                            setError('');
                            setSuccessMessage('');
                          }}
                          className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                        >
                          <option value="">Select a template...</option>
                          {cardTemplates?.map(template => (
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
                              Select a number field for budget (e.g., budget) and another for service cost (e.g., serviceCost).
                            </div>
                            {numberHeaders.length > 0 ? (
                              <>
                                <select
                                  value={moneyHeader}
                                  onChange={e => {
                                    setMoneyHeader(e.target.value);
                                    setServiceHeader('');
                                  }}
                                  className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                                >
                                  <option value="">Select a budget header...</option>
                                  {numberHeaders.map(header => (
                                    <option key={header.key} value={header.key}>
                                      {header.name}
                                    </option>
                                  ))}
                                </select>
                                {moneyHeader && numberHeaders.length > 1 && (
                                  <>
                                    <select
                                      value={serviceHeader}
                                      onChange={e => setServiceHeader(e.target.value)}
                                      className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                                    >
                                      <option value="">Select a service cost header...</option>
                                      {numberHeaders
                                        .filter(header => header.key !== moneyHeader)
                                        .map(header => (
                                          <option key={header.key} value={header.key}>
                                            {header.name}
                                          </option>
                                        ))}
                                    </select>
                                    {serviceHeader && (
                                      <div className={styles.configInputs}>
                                        <label className={styles.label}>Score Contribution (0-100)</label>
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          value={moneyCoefficient}
                                          onChange={e => setMoneyCoefficient(parseInt(e.target.value) || 0)}
                                          className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ''}`}
                                        />
                                      </div>
                                    )}
                                  </>
                                )}
                              </>
                            ) : (
                              <div className={styles.hint}>No number headers available</div>
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
                                        {templateHeaders.find(h => h.key === decisionHeader)?.type ===
                                        'dropdown' ? (
                                          <select
                                            value={config.matchValue}
                                            onChange={e =>
                                              updateConfig(
                                                setDecisionConfigs,
                                                decisionConfigs,
                                                index,
                                                'matchValue',
                                                e.target.value
                                              )
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
                                              updateConfig(
                                                setDecisionConfigs,
                                                decisionConfigs,
                                                index,
                                                'matchValue',
                                                e.target.value
                                              )
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
                                          onClick={() =>
                                            removeMatchValue(setDecisionConfigs, decisionConfigs, index)
                                          }
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
                                        {templateHeaders.find(h => h.key === needHeader)?.type ===
                                        'dropdown' ? (
                                          <select
                                            value={config.matchValue}
                                            onChange={e =>
                                              updateConfig(
                                                setNeedConfigs,
                                                needConfigs,
                                                index,
                                                'matchValue',
                                                e.target.value
                                              )
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
                                              updateConfig(
                                                setNeedConfigs,
                                                needConfigs,
                                                index,
                                                'matchValue',
                                                e.target.value
                                              )
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
                              Select a date field (e.g., deadline) and set urgency parameters.
                            </div>
                            <div className={styles.description}>
                              This section checks how soon the lead wants to buy. Set the maximum days for urgency and the score contribution.
                            </div>
                            {dateHeaders.length > 0 ? (
                              <>
                                <select
                                  value={urgencyHeader}
                                  onChange={e => setUrgencyHeader(e.target.value)}
                                  className={`${styles.select} ${isDarkTheme ? styles.darkTheme : ''}`}
                                >
                                  <option value="">Select a date header...</option>
                                  {dateHeaders.map(header => (
                                    <option key={header.key} value={header.key}>
                                      {header.name}
                                    </option>
                                  ))}
                                </select>
                                {urgencyHeader && (
                                  <div className={styles.configInputs}>
                                    <label className={styles.label}>Max Days for Urgency</label>
                                    <input
                                      type="number"
                                      min="1"
                                      max="30"
                                      value={urgencyDays}
                                      onChange={e => setUrgencyDays(parseInt(e.target.value) || 1)}
                                      className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ''}`}
                                    />
                                    <label className={styles.label}>Urgency Score (0-100)</label>
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={urgencyWeight}
                                      onChange={e => setUrgencyWeight(parseInt(e.target.value) || 0)}
                                      className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ''}`}
                                    />
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className={styles.hint}>No date headers available</div>
                            )}
                          </div>
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