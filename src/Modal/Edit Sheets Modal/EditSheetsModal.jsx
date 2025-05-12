import { useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import styles from './EditSheetsModal.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { ModalNavigatorContext } from '../../Contexts/ModalNavigator';
import { FaEye, FaEyeSlash, FaThumbtack, FaFilter, FaChevronRight } from 'react-icons/fa';
import { MdFilterAlt, MdFilterAltOff } from 'react-icons/md';
import { FaRegCircle, FaRegCheckCircle } from 'react-icons/fa';
import CardTypeFilter from './CardTypeFilter/CardTypeFilter';

const EditSheetsModal = ({
  isEditMode = false,
  tempData,
  setTempData,
  sheets = [],
  onPinToggle,
  onDeleteSheet,
  handleClose,
  setActiveSheetName,
  clearFetchedSheets,
}) => {
  const { isDarkTheme, cardTemplates } = useContext(MainContext);
  const { registerModalSteps, goToStep, goBack, currentStep, setModalConfig } = useContext(ModalNavigatorContext);
  const [sheetName, setSheetName] = useState(tempData.sheetName || '');
  const [currentHeaders, setCurrentHeaders] = useState(() => {
    const uniqueHeaders = [];
    const seenKeys = new Set();
    (tempData.currentHeaders || []).forEach((header) => {
      if (!seenKeys.has(header.key)) {
        seenKeys.add(header.key);
        uniqueHeaders.push({ ...header });
      }
    });
    return uniqueHeaders;
  });
  const [rows] = useState(tempData.rows || []);
  const [pinnedStates, setPinnedStates] = useState({});
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchTargetIndex, setTouchTargetIndex] = useState(null);
  const [selectedCardTypes, setSelectedCardTypes] = useState(tempData.typeOfCardsToDisplay || []);
  const [navigationDirection, setNavigationDirection] = useState(null);
  const [selectedTemplateForHeaders, setSelectedTemplateForHeaders] = useState(null);
  const [selectedCardTypeForFilter, setSelectedCardTypeForFilter] = useState(null);
  const headerRefs = useRef(new Map());
  const hasInitialized = useRef(false);
  const prevStepRef = useRef(currentStep);
  const prevModalConfig = useRef(null);

  // Initialize tempData.cardTypeFilters if undefined
  useEffect(() => {
    if (!tempData.cardTypeFilters) {
      setTempData({
        ...tempData,
        cardTypeFilters: {},
      });
    }
  }, [tempData, setTempData]);

  // Find sheet ID
  const sheetId = sheets.allSheets?.find((s) => s.sheetName === sheetName)?.docId;

  // Get all available headers from templates
  const allHeaders = useMemo(() => {
    const commonHeaders = [];
    if (cardTemplates.length > 0) {
      const firstTemplateHeaders = cardTemplates[0].headers.filter(
        (header) => header.isUsed !== false && !['id', 'typeOfCards'].includes(header.key)
      );
      commonHeaders.push(
        ...firstTemplateHeaders.map((header) => ({
          key: header.key,
          name: header.name,
          type: header.type,
          options: header.options || [],
        }))
      );
    }

    const templateHeaders = cardTemplates.map((template) => ({
      sheetName: `${template.name} (Template)`,
      headers: template.headers
        .filter((header) => header.isUsed !== false && !['id', 'typeOfCards'].includes(header.key))
        .map((header) => ({
          key: header.key,
          name: header.name,
          type: header.type,
          options: header.options || [],
        })),
    }));

    return [
      { sheetName: 'Common', headers: commonHeaders },
      ...templateHeaders,
    ];
  }, [cardTemplates]);

  // Function to generate filter summary for a card type
  const getFilterSummary = useCallback(
    (cardType) => {
      const filters = tempData.cardTypeFilters?.[cardType] || {};
      const summaries = [];

      Object.entries(filters).forEach(([headerKey, filter]) => {
        if (headerKey === 'userFilter') {
          if (filter.headerKey) {
            const header = cardTemplates
              .find((t) => t.typeOfCards === cardType)
              ?.headers.find((h) => h.key === filter.headerKey);
            summaries.push(`${header?.name || filter.headerKey} = Current User`);
          }
          return;
        }
        const header = cardTemplates
          .find((t) => t.typeOfCards === cardType)
          ?.headers.find((h) => h.key === headerKey);
        if (!header) return;

        const headerName = header.name || headerKey;
        if (header.type === 'number' && (filter.start || filter.end)) {
          const start = filter.start || '';
          const end = filter.end || '';
          summaries.push(`${headerName}: ${start}${start && end ? ' – ' : ''}${end}`);
        } else if (header.type === 'date' && (filter.start || filter.end)) {
          const start = filter.start || '';
          const end = filter.end || '';
          summaries.push(`${headerName}: ${start}${start && end ? ' – ' : ''}${end}`);
        } else if (header.type === 'dropdown' && filter.values?.length) {
          summaries.push(`${headerName}: ${filter.values.join(', ')}`);
        } else if (filter.value) {
          const condition = filter.condition || filter.order || 'equals';
          const prefix = header.type === 'number' ? { equals: '=', greater: '>', less: '<', greaterOrEqual: '≥', lessOrEqual: '≤' }[condition] || '' : condition;
          summaries.push(`${headerName}: ${prefix} ${filter.value}`);
        }
      });

      return summaries.length > 0 ? summaries.join('; ') : 'None';
    },
    [tempData.cardTypeFilters, cardTemplates]
  );

  // Define onDoneClick callback
  const onDoneClick = useCallback(() => {
    setTempData({
      sheetName,
      currentHeaders,
      rows,
      typeOfCardsToDisplay: selectedCardTypes,
      cardTypeFilters: tempData.cardTypeFilters || {},
    });
    if (sheetName !== tempData.sheetName) {
      setActiveSheetName(sheetName);
      clearFetchedSheets();
    }
    handleClose({ fromSave: true });
  }, [
    sheetName,
    currentHeaders,
    selectedCardTypes,
    rows,
    setTempData,
    tempData.sheetName,
    tempData.cardTypeFilters,
    setActiveSheetName,
    clearFetchedSheets,
    handleClose,
  ]);

  // Define back button callback
  const handleBackClick = useCallback(() => {
    setNavigationDirection('backward');
    goBack();
  }, [goBack, currentStep]);

  // Initialize modal steps (run once)
  useEffect(() => {
    if (!hasInitialized.current) {
      const steps = [
        { title: isEditMode ? 'Edit Sheet' : 'Create Sheet', rightButton: null },
        { title: 'Headers', rightButton: null },
        { title: 'Select Templates', rightButton: null },
        { title: 'Select Headers', rightButton: null },
        { title: 'Cards', rightButton: null },
        { title: 'Select Card Templates', rightButton: null },
        { title: 'Template Options', rightButton: null },
        { title: 'Filters', rightButton: null },
      ];
      registerModalSteps({ steps });
      const initialConfig = {
        showTitle: true,
        showDoneButton: true,
        showBackButton: false,
        title: isEditMode ? 'Edit Sheet' : 'Create Sheet',
        backButtonTitle: '',
        rightButton: null,
        leftButton: null,
        onDoneClick,
      };
      setModalConfig(initialConfig);
      prevModalConfig.current = initialConfig;
      hasInitialized.current = true;
    }
  }, [isEditMode, registerModalSteps, setModalConfig, onDoneClick]);

  // Update navigation direction and debug step changes
  useEffect(() => {
    if (prevStepRef.current !== currentStep) {
      setNavigationDirection(currentStep > prevStepRef.current ? 'forward' : 'backward');
      prevStepRef.current = currentStep;
    }
  }, [currentStep]);

  // Update modal config based on step
  useEffect(() => {
    const step1Title = isEditMode ? 'Edit Sheet' : 'Create Sheet';
    let config;
    if (currentStep === 1) {
      config = {
        showTitle: true,
        showDoneButton: true,
        showBackButton: false,
        allowClose: true,
        title: step1Title,
        backButtonTitle: '',
        leftButton: null,
        rightButton: null,
        onDoneClick,
      };
    } else if (currentStep === 2) {
      config = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        allowClose: false,
        title: 'Headers',
        backButtonTitle: step1Title,
        backButton: {
          label: `< ${step1Title}`,
          onClick: handleBackClick,
        },
        leftButton: null,
        rightButton: null,
      };
    } else if (currentStep === 3) {
      config = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        allowClose: false,
        title: 'Select Templates',
        backButtonTitle: 'Headers',
        backButton: {
          label: `< Headers`,
          onClick: handleBackClick,
        },
        leftButton: null,
        rightButton: null,
      };
    } else if (currentStep === 4) {
      const templateName = cardTemplates.find((t) => t.typeOfCards === selectedTemplateForHeaders)?.name || selectedTemplateForHeaders || 'Unknown';
      config = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        allowClose: false,
        title: `Headers for ${templateName}`,
        backButtonTitle: 'Select Templates',
        backButton: {
          label: `< Select Templates`,
          onClick: handleBackClick,
        },
        leftButton: null,
        rightButton: null,
      };
    } else if (currentStep === 5) {
      config = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        allowClose: false,
        title: 'Cards',
        backButtonTitle: step1Title,
        backButton: {
          label: `< ${step1Title}`,
          onClick: handleBackClick,
        },
        leftButton: null,
        rightButton: null,
      };
    } else if (currentStep === 6) {
      config = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        allowClose: false,
        title: 'Select Card Templates',
        backButtonTitle: 'Cards',
        backButton: {
          label: `< Cards`,
          onClick: handleBackClick,
        },
        leftButton: null,
        rightButton: null,
      };
    } else if (currentStep === 7) {
      const cardTypeName = cardTemplates.find((t) => t.typeOfCards === selectedCardTypeForFilter)?.name || selectedCardTypeForFilter || 'Unknown';
      config = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        allowClose: false,
        title: `Options for ${cardTypeName}`,
        backButtonTitle: 'Cards',
        backButton: {
          label: `< Cards`,
          onClick: handleBackClick,
        },
        leftButton: null,
        rightButton: null,
      };
    } else if (currentStep === 8) {
      const cardTypeName = cardTemplates.find((t) => t.typeOfCards === selectedCardTypeForFilter)?.name || selectedCardTypeForFilter || 'Unknown';
      config = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        allowClose: false,
        title: `Filters for ${cardTypeName}`,
        backButtonTitle: 'Template Options',
        backButton: {
          label: `< Template Options`,
          onClick: handleBackClick,
        },
        leftButton: null,
        rightButton: null,
      };
    }

    // Only update modalConfig if it has changed
    if (JSON.stringify(config) !== JSON.stringify(prevModalConfig.current)) {
      setModalConfig(config);
      prevModalConfig.current = config;
    }
  }, [currentStep, isEditMode, handleBackClick, setModalConfig, onDoneClick, selectedTemplateForHeaders, selectedCardTypeForFilter, cardTemplates]);

  // Sync tempData
  useEffect(() => {
    const newTempData = {
      sheetName,
      currentHeaders,
      rows,
      typeOfCardsToDisplay: selectedCardTypes,
      cardTypeFilters: tempData.cardTypeFilters || {},
    };
    if (
      newTempData.sheetName !== tempData.sheetName ||
      JSON.stringify(newTempData.currentHeaders) !== JSON.stringify(tempData.currentHeaders) ||
      JSON.stringify(newTempData.rows) !== JSON.stringify(tempData.rows) ||
      JSON.stringify(newTempData.typeOfCardsToDisplay) !== JSON.stringify(tempData.typeOfCardsToDisplay) ||
      JSON.stringify(newTempData.cardTypeFilters) !== JSON.stringify(tempData.cardTypeFilters)
    ) {
      setTempData(newTempData);
    }
  }, [sheetName, currentHeaders, rows, selectedCardTypes, tempData, setTempData]);

  // Toggle card type selection
  const toggleCardTypeSelection = useCallback((type) => {
    setSelectedCardTypes((prev) => {
      if (prev.includes(type)) {
        const updatedFilters = { ...tempData.cardTypeFilters };
        delete updatedFilters[type];
        setTempData({ ...tempData, cardTypeFilters: updatedFilters });
        return prev.filter((t) => t !== type);
      } else {
        return [...prev, type];
      }
    });
  }, [tempData, setTempData]);

  // Toggle header selection
  const toggleHeaderSelection = useCallback((header) => {
    setCurrentHeaders((prev) => {
      const exists = prev.some((h) => h.key === header.key);
      if (exists) {
        return prev.filter((h) => h.key !== header.key);
      } else {
        return [
          ...prev,
          {
            key: header.key,
            name: header.name,
            type: header.type,
            options: header.options || [],
            visible: true,
            hidden: false,
          },
        ];
      }
    });
  }, []);

  // Drag-and-drop and touch handlers
  const handleDragStart = useCallback((e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    const element = headerRefs.current.get(index);
    if (element) element.classList.add(styles.dragging);
  }, []);

  const handleTouchStart = useCallback((e, index) => {
    if (e.target.classList.contains(styles.dragIcon)) {
      e.preventDefault();
      setDraggedIndex(index);
      setTouchStartY(e.touches[0].clientY);
      setTouchTargetIndex(index);
      const element = headerRefs.current.get(index);
      if (element) element.classList.add(styles.dragging);
    }
  }, []);

  const handleDragOver = useCallback(
    (e, index) => {
      e.preventDefault();
      if (draggedIndex === null || draggedIndex === index) return;

      setCurrentHeaders((prev) => {
        const newHeaders = [...prev];
        const [draggedItem] = newHeaders.splice(draggedIndex, 1);
        newHeaders.splice(index, 0, draggedItem);
        setDraggedIndex(index);
        return newHeaders;
      });
    },
    [draggedIndex]
  );

  const handleTouchMove = useCallback(
    (e, index) => {
      if (draggedIndex === null || touchStartY === null) return;
      e.preventDefault();

      const touchY = e.touches[0].clientY;
      const itemHeight = 48;
      const delta = Math.round((touchY - touchStartY) / itemHeight);

      const newIndex = Math.max(0, Math.min(touchTargetIndex + delta, currentHeaders.length - 1));
      if (newIndex !== draggedIndex) {
        setCurrentHeaders((prev) => {
          const newHeaders = [...prev];
          const [draggedItem] = newHeaders.splice(draggedIndex, 1);
          newHeaders.splice(newIndex, 0, draggedItem);
          setDraggedIndex(newIndex);
          return newHeaders;
        });
      }
    },
    [draggedIndex, touchStartY, touchTargetIndex, currentHeaders.length]
  );

  const handleDragEnd = useCallback(() => {
    const element = headerRefs.current.get(draggedIndex);
    if (element) element.classList.remove(styles.dragging);
    setDraggedIndex(null);
  }, [draggedIndex]);

  const handleTouchEnd = useCallback(() => {
    const element = headerRefs.current.get(draggedIndex);
    if (element) element.classList.remove(styles.dragging);
    setDraggedIndex(null);
    setTouchStartY(null);
    setTouchTargetIndex(null);
  }, [draggedIndex]);

  const togglePin = useCallback(
    (headerKey) => {
      setPinnedStates((prev) => ({
        ...prev,
        [headerKey]: !prev[headerKey],
      }));
      onPinToggle(headerKey);
    },
    [onPinToggle]
  );

  const toggleVisible = useCallback((index) => {
    setCurrentHeaders((prev) => {
      const newHeaders = [...prev];
      newHeaders[index] = { ...newHeaders[index], visible: !newHeaders[index].visible };
      return newHeaders;
    });
  }, []);

  const toggleHidden = useCallback((index) => {
    setCurrentHeaders((prev) => {
      const newHeaders = [...prev];
      newHeaders[index] = { ...newHeaders[index], hidden: !newHeaders[index].hidden };
      return newHeaders;
    });
  }, []);

  const removeHeader = useCallback((headerKey) => {
    setCurrentHeaders((prev) => {
      const newHeaders = prev.filter((h) => h.key !== headerKey);
      setPinnedStates((prev) => {
        const newPinned = { ...prev };
        delete newPinned[headerKey];
        return newPinned;
      });
      return newHeaders;
    });
  }, []);

  const handleSheetNameChange = useCallback(
    (e) => {
      if (sheetId === 'primarySheet') {
        return;
      }
      setSheetName(e.target.value);
    },
    [sheetId]
  );

  const handleFilterClick = useCallback(
    (typeOfCards) => {
      if (!typeOfCards) {
        return;
      }
      if (!tempData.cardTypeFilters?.[typeOfCards]) {
        setTempData({
          ...tempData,
          cardTypeFilters: {
            ...tempData.cardTypeFilters,
            [typeOfCards]: {},
          },
        });
      }
      setSelectedCardTypeForFilter(typeOfCards);
      setNavigationDirection('forward');
      setTimeout(() => {
        goToStep(8);
      }, 50);
    },
    [goToStep, tempData, setTempData]
  );

  const handleTemplateClick = useCallback(
    (typeOfCards) => {
      setSelectedTemplateForHeaders(typeOfCards);
      setNavigationDirection('forward');
      goToStep(4);
    },
    [goToStep]
  );

  const handleAddCardTemplateClick = useCallback((e) => {
    e.stopPropagation();
    setNavigationDirection('forward');
    goToStep(6);
  }, [goToStep]);

  const handleTemplateOptionsClick = useCallback(
    (typeOfCards) => {
      setSelectedCardTypeForFilter(typeOfCards);
      setNavigationDirection('forward');
      goToStep(7);
    },
    [goToStep]
  );

  const handleSortClick = useCallback((typeOfCards) => {
    // Placeholder for sort functionality
    alert(`Sort functionality for ${typeOfCards} is not yet implemented.`);
  }, []);

  return (
    <div className={`${styles.sheetModal} ${isDarkTheme ? styles.darkTheme : ''}`}>
      <div className={styles.viewContainer}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((step) => (
          <div
            key={step}
            className={`${styles.view} ${isDarkTheme ? styles.darkTheme : ''} ${
              step !== currentStep ? styles.hidden : ''
            } ${
              step === currentStep && navigationDirection === 'forward' ? styles.animateForward : ''
            } ${
              step === currentStep && navigationDirection === 'backward' ? styles.animateBackward : ''
            }`}
            style={{ display: step !== currentStep ? 'none' : 'block' }}
          >
            {step === 1 && (
              <>
                <input
                  type="text"
                  value={sheetName}
                  onChange={handleSheetNameChange}
                  placeholder={isEditMode ? 'Rename sheet' : 'Sheet Name'}
                  className={`${styles.sheetNameInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                  disabled={sheetId === 'primarySheet'}
                />
                <div className={styles.buttonContainer}>
                  <div
                    onClick={() => {
                      setNavigationDirection('forward');
                      goToStep(2);
                    }}
                    className={`${styles.navItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                    role="button"
                    aria-label="Manage Headers"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setNavigationDirection('forward');
                        goToStep(2);
                      }
                    }}
                  >
                    <span className={styles.navName}>Headers</span>
                  </div>
                  <div
                    onClick={() => {
                      setNavigationDirection('forward');
                      goToStep(5);
                    }}
                    className={`${styles.navItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                    role="button"
                    aria-label="Manage Cards"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setNavigationDirection('forward');
                        goToStep(5);
                      }
                    }}
                  >
                    <span className={styles.navName}>Cards</span>
                  </div>
                </div>
                {isEditMode && sheetId !== 'primarySheet' && (
                  <div className={styles.deleteButtonContainer}>
                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            `Are you sure you want to delete the sheet "${sheetName}"? This action cannot be undone.`
                          )
                        ) {
                          onDeleteSheet(sheetName);
                          handleClose({ fromDelete: true });
                        }
                      }}
                      className={`${styles.deleteSheetButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                      aria-label="Delete Sheet"
                    >
                      Delete Sheet
                    </button>
                  </div>
                )}
              </>
            )}
            {step === 2 && (
              <>
                <div
                  onClick={() => {
                    setNavigationDirection('forward');
                    goToStep(3);
                  }}
                  className={`${styles.navItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                  role="button"
                  aria-label="Add Column"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setNavigationDirection('forward');
                      goToStep(3);
                    }
                  }}
                >
                  <span className={styles.navName}>Add Column</span>
                </div>
                <div className={`${styles.headerList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  {currentHeaders.map((header, index) => (
                    <div
                      ref={(el) => headerRefs.current.set(index, el)}
                      key={header.key}
                      className={`${styles.headerItem} ${draggedIndex === index ? styles.dragging : ''} ${
                        isDarkTheme ? styles.darkTheme : ''
                      }`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      onTouchStart={(e) => handleTouchStart(e, index)}
                      onTouchMove={(e) => handleTouchMove(e, index)}
                      onTouchEnd={handleTouchEnd}
                    >
                      <div className={styles.headerRow}>
                        <div className={styles.headerLeft}>
                          <button
                            onClick={() => togglePin(header.key)}
                            className={`${styles.actionButton} ${
                              pinnedStates[header.key] ? styles.pinned : ''
                            } ${isDarkTheme ? styles.darkTheme : ''}`}
                          >
                            <FaThumbtack />
                          </button>
                          {pinnedStates[header.key] && (
                            <button
                              onClick={() => removeHeader(header.key)}
                              className={`${styles.removeTextButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                            >
                              Remove
                            </button>
                          )}
                          <span className={styles.headerName}>{header.name}</span>
                        </div>
                        <div className={styles.actions}>
                          <button
                            onClick={() => toggleHidden(index)}
                            className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                          >
                            {header.hidden ? <MdFilterAltOff /> : <MdFilterAlt />}
                          </button>
                          <button
                            onClick={() => toggleVisible(index)}
                            className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                          >
                            {header.visible ? <FaEye /> : <FaEyeSlash />}
                          </button>
                          <div className={styles.buttonSpacer}></div>
                          <span className={`${styles.dragIcon} ${isDarkTheme ? styles.darkTheme : ''}`}>
                            ☰
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {step === 3 && (
              <div className={`${styles.cardTypeList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                {cardTemplates.length === 0 ? (
                  <div className={`${styles.noCards} ${isDarkTheme ? styles.darkTheme : ''}`}>
                    No templates available
                  </div>
                ) : (
                  cardTemplates.map((template) => (
                    <div
                      key={template.typeOfCards}
                      className={`${styles.cardTypeItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                      onClick={() => handleTemplateClick(template.typeOfCards)}
                    >
                      <div className={styles.cardTypeRow}>
                        <span className={styles.cardTypeName}>{template.name || template.typeOfCards}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            {step === 4 && (
              <div className={`${styles.cardTypeList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                {(() => {
                  const selectedTemplate = cardTemplates.find((t) => t.typeOfCards === selectedTemplateForHeaders);
                  const templateHeaders = selectedTemplate?.headers
                    .filter((header) => header.isUsed !== false && !['id', 'typeOfCards'].includes(header.key))
                    .map((header) => ({
                      key: header.key,
                      name: header.name,
                      type: header.type,
                      options: header.options || [],
                    })) || [];
                  return templateHeaders.length === 0 ? (
                    <div className={`${styles.noCards} ${isDarkTheme ? styles.darkTheme : ''}`}>
                      No headers available
                    </div>
                  ) : (
                    templateHeaders.map((header) => (
                      <div
                        key={header.key}
                        className={`${styles.cardTypeItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                        onClick={() => toggleHeaderSelection(header)}
                      >
                        <div className={styles.cardTypeRow}>
                          <span className={`${styles.customCheckbox} ${isDarkTheme ? styles.darkTheme : ''}`}>
                            {currentHeaders.some((h) => h.key === header.key) ? (
                              <FaRegCheckCircle size={18} className={styles.checked} />
                            ) : (
                              <FaRegCircle size={18} />
                            )}
                          </span>
                          <span className={styles.cardTypeName}>{header.name || header.key}</span>
                        </div>
                      </div>
                    ))
                  );
                })()}
              </div>
            )}
            {step === 5 && (
              <>
                <div className={styles.buttonContainer}>
                  <div
                    onClick={handleAddCardTemplateClick}
                    className={`${styles.navItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                    role="button"
                    aria-label="Add Card Template"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleAddCardTemplateClick(e);
                      }
                    }}
                  >
                    <span className={styles.navName}>Add Card Template</span>
                  </div>
                  {selectedCardTypes.map((typeOfCards) => {
                    const template = cardTemplates.find((t) => t.typeOfCards === typeOfCards);
                    return (
                      <div
                        key={typeOfCards}
                        onClick={() => handleTemplateOptionsClick(typeOfCards)}
                        className={`${styles.navItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                        role="button"
                        aria-label={`Options for ${template?.name || typeOfCards}`}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            handleTemplateOptionsClick(typeOfCards);
                          }
                        }}
                      >
                        <span className={styles.navName}>{template?.name || typeOfCards}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {step === 6 && (
              <div className={`${styles.cardTypeList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                {cardTemplates.length === 0 ? (
                  <div className={`${styles.noCards} ${isDarkTheme ? styles.darkTheme : ''}`}>
                    No card templates available
                  </div>
                ) : (
                  cardTemplates.map((template) => (
                    <div
                      key={template.typeOfCards}
                      className={`${styles.cardTypeItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                      onClick={() => toggleCardTypeSelection(template.typeOfCards)}
                    >
                      <div className={styles.cardTypeRow}>
                        <span className={`${styles.customCheckbox} ${isDarkTheme ? styles.darkTheme : ''}`}>
                          {selectedCardTypes.includes(template.typeOfCards) ? (
                            <FaRegCheckCircle size={18} className={styles.checked} />
                          ) : (
                            <FaRegCircle size={18} />
                          )}
                        </span>
                        <span className={styles.cardTypeName}>{template.name || template.typeOfCards}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            {step === 7 && (
              <div className={styles.buttonContainer}>
                <div
                  onClick={() => handleFilterClick(selectedCardTypeForFilter)}
                  className={`${styles.navItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                  role="button"
                  aria-label="Filters"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleFilterClick(selectedCardTypeForFilter);
                    }
                  }}
                >
                  <span className={styles.navName}>Filters</span>
                </div>
                <div
                  onClick={() => handleSortClick(selectedCardTypeForFilter)}
                  className={`${styles.navItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                  role="button"
                  aria-label="Sort"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleSortClick(selectedCardTypeForFilter);
                    }
                  }}
                >
                  <span className={styles.navName}>Sort</span>
                </div>
              </div>
            )}
            {step === 8 && (
              <>
                <div className={`${styles.debugMessage} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  Filters Step (Step 8) - Card Type: {selectedCardTypeForFilter || 'None'}
                </div>
                {selectedCardTypeForFilter ? (
                  <CardTypeFilter
                    cardType={selectedCardTypeForFilter}
                    headers={cardTemplates.find((t) => t.typeOfCards === selectedCardTypeForFilter)?.headers || []}
                    tempData={tempData}
                    setTempData={setTempData}
                    showFilterSummary={true}
                  />
                ) : (
                  <div className={`${styles.noCards} ${isDarkTheme ? styles.darkTheme : ''}`}>
                    No card type selected for filtering
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

EditSheetsModal.propTypes = {
  isEditMode: PropTypes.bool,
  tempData: PropTypes.shape({
    sheetName: PropTypes.string,
    currentHeaders: PropTypes.arrayOf(
      PropTypes.shape({
        key: PropTypes.string.isRequired,
        name: PropTypes.string,
        type: PropTypes.string,
        options: PropTypes.array,
        visible: PropTypes.bool,
        hidden: PropTypes.bool,
      })
    ),
    rows: PropTypes.array,
    typeOfCardsToDisplay: PropTypes.arrayOf(PropTypes.string),
    cardTypeFilters: PropTypes.object,
  }).isRequired,
  setTempData: PropTypes.func.isRequired,
  sheets: PropTypes.shape({
    allSheets: PropTypes.arrayOf(
      PropTypes.shape({
        sheetName: PropTypes.string,
        headers: PropTypes.arrayOf(PropTypes.object),
      })
    ),
  }),
  onPinToggle: PropTypes.func.isRequired,
  onDeleteSheet: PropTypes.func.isRequired,
  handleClose: PropTypes.func,
  setActiveSheetName: PropTypes.func.isRequired,
  clearFetchedSheets: PropTypes.func.isRequired,
};

EditSheetsModal.defaultProps = {
  isEditMode: false,
  sheets: { allSheets: [] },
  handleClose: null,
};

export default EditSheetsModal;