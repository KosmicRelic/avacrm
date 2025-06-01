import React, { useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import styles from './EditSheetsModal.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { ModalNavigatorContext } from '../../Contexts/ModalNavigator';
import { FaEye, FaEyeSlash, FaThumbtack, FaRegCircle, FaRegCheckCircle } from 'react-icons/fa';
import { MdFilterAlt, MdFilterAltOff } from 'react-icons/md';

// Utility function to convert various date formats to milliseconds
function toMillis(dateValue) {
  if (
    dateValue &&
    typeof dateValue === 'object' &&
    typeof dateValue.seconds === 'number' &&
    typeof dateValue.nanoseconds === 'number'
  ) {
    return dateValue.seconds * 1000 + Math.floor(dateValue.nanoseconds / 1e6);
  }
  if (dateValue && typeof dateValue.toDate === 'function') {
    return dateValue.toDate().getTime();
  }
  if (dateValue instanceof Date) {
    return dateValue.getTime();
  }
  if (typeof dateValue === 'string') {
    const parsed = Date.parse(dateValue);
    if (!isNaN(parsed)) return parsed;
  }
  return NaN;
}

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
        uniqueHeaders.push({ ...header, options: header.options || [] });
      }
    });
    return uniqueHeaders;
  });
  const [pinnedStates, setPinnedStates] = useState({});
  const [selectedCardTypes, setSelectedCardTypes] = useState(tempData.typeOfCardsToDisplay || []);
  const [navigationDirection, setNavigationDirection] = useState(null);
  const [selectedTemplateForHeaders, setSelectedTemplateForHeaders] = useState(null);
  const [selectedCardTypeForFilter, setSelectedCardTypeForFilter] = useState(null);
  const [cardsPerSearch, setCardsPerSearch] = useState(tempData.cardsPerSearch || '');
  const [filterType, setFilterType] = useState(null);
  const [filterOrder, setFilterOrder] = useState(tempData.filterOrder || ['user', 'text', 'number', 'date', 'dropdown']);
  const headerRefs = useRef(new Map());
  const filterRefs = useRef(new Map());
  const hasInitialized = useRef(false);
  const prevStepRef = useRef(currentStep);
  const prevModalConfig = useRef(null);

  // Ensure cardTypeFilters, cardsPerSearch, and filterOrder are initialized in tempData
  useEffect(() => {
    if (!tempData.cardTypeFilters || !('cardsPerSearch' in tempData) || !tempData.filterOrder) {
      setTempData({
        ...tempData,
        cardTypeFilters: tempData.cardTypeFilters || {},
        cardsPerSearch: tempData.cardsPerSearch || null,
        filterOrder: tempData.filterOrder || ['user', 'text', 'number', 'date', 'dropdown'],
      });
    }
  }, [tempData, setTempData]);

  const sheetId = sheets.allSheets?.find((s) => s.sheetName === sheetName)?.docId;

  // Ensure cardTypeFilters always has all headers for each selected card type
  useEffect(() => {
    if (!cardTemplates || selectedCardTypes.length === 0) return;

    let changed = false;
    const updatedCardTypeFilters = { ...(tempData.cardTypeFilters || {}) };

    selectedCardTypes.forEach((typeOfCards) => {
      const template = cardTemplates.find((t) => t.typeOfCards === typeOfCards);
      if (!template) return;
      if (!updatedCardTypeFilters[typeOfCards]) {
        updatedCardTypeFilters[typeOfCards] = {};
        changed = true;
      }
      template.headers
        .filter((h) => h.key)
        .forEach((header) => {
          if (!(header.key in updatedCardTypeFilters[typeOfCards])) {
            updatedCardTypeFilters[typeOfCards][header.key] = {};
            changed = true;
          }
        });
    });

    Object.keys(updatedCardTypeFilters).forEach((typeOfCards) => {
      if (!selectedCardTypes.includes(typeOfCards)) {
        delete updatedCardTypeFilters[typeOfCards];
        changed = true;
      }
    });

    if (changed) {
      setTempData({
        ...tempData,
        cardTypeFilters: updatedCardTypeFilters,
      });
    }
  }, [selectedCardTypes, cardTemplates, tempData, setTempData]);

  // Compute filter summary for display
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
          const sortOrder = filter.sortOrder ? ` (${filter.sortOrder})` : '';
          summaries.push(`${headerName}: ${start}${start && end ? ' – ' : ''}${end}${sortOrder}`);
        } else if (header.type === 'date' && filter.sortOrder) {
          summaries.push(`${headerName}: Sorted ${filter.sortOrder}`);
        } else if (header.type === 'dropdown' && filter.values?.length) {
          const sortOrder = filter.sortOrder ? ` (${filter.sortOrder})` : '';
          summaries.push(`${headerName}: ${filter.values.join(', ')}${sortOrder}`);
        } else if (filter.value) {
          const condition = filter.condition || filter.order || 'equals';
          const prefix = header.type === 'number'
            ? { equals: '=', greater: '>', less: '<', greaterOrEqual: '≥', lessOrEqual: '≤' }[condition] || ''
            : condition;
          const sortOrder = filter.sortOrder ? ` (${filter.sortOrder})` : '';
          summaries.push(`${headerName}: ${prefix} ${filter.value}${sortOrder}`);
        } else if (filter.sortOrder) {
          summaries.push(`${headerName}: (${filter.sortOrder})`);
        }
      });

      return summaries.length > 0 ? summaries.join('; ') : 'None';
    },
    [tempData.cardTypeFilters, cardTemplates]
  );

  // Handle save action
  const onDoneClick = useCallback(() => {
    let updatedCardTypeFilters = { ...(tempData.cardTypeFilters || {}) };
    selectedCardTypes.forEach((typeOfCards) => {
      const template = cardTemplates.find((t) => t.typeOfCards === typeOfCards);
      if (!template) return;
      if (!updatedCardTypeFilters[typeOfCards]) updatedCardTypeFilters[typeOfCards] = {};
      template.headers
        .filter((h) => h.key)
        .forEach((header) => {
          if (!(header.key in updatedCardTypeFilters[typeOfCards])) {
            updatedCardTypeFilters[typeOfCards][header.key] = {};
          }
        });
    });
    Object.keys(updatedCardTypeFilters).forEach((typeOfCards) => {
      if (!selectedCardTypes.includes(typeOfCards)) {
        delete updatedCardTypeFilters[typeOfCards];
      }
    });

    const cleanedCardTypeFilters = {};
    Object.entries(updatedCardTypeFilters).forEach(([cardType, filters]) => {
      const cleanedFilters = {};
      Object.entries(filters).forEach(([key, filter]) => {
        const cleanedFilter = {};
        Object.entries(filter).forEach(([field, value]) => {
          if (value !== undefined && value !== null) {
            cleanedFilter[field] = value;
          }
        });
        if (Object.keys(cleanedFilter).length > 0) {
          cleanedFilters[key] = cleanedFilter;
        }
      });
      if (Object.keys(cleanedFilters).length > 0) {
        cleanedCardTypeFilters[cardType] = cleanedFilters;
      }
    });

    setTempData({
      sheetName,
      currentHeaders,
      typeOfCardsToDisplay: selectedCardTypes,
      cardTypeFilters: cleanedCardTypeFilters,
      cardsPerSearch,
      filterOrder,
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
    cardsPerSearch,
    filterOrder,
    setTempData,
    tempData.sheetName,
    tempData.cardTypeFilters,
    setActiveSheetName,
    clearFetchedSheets,
    handleClose,
    cardTemplates,
  ]);

  const handleBackClick = useCallback(() => {
    setNavigationDirection('backward');
    goBack();
  }, [goBack]);

  // Initialize modal steps and configuration
  useEffect(() => {
    if (!hasInitialized.current) {
      const steps = [
        { title: isEditMode ? 'Edit Sheet' : 'Create Sheet', rightButton: null },
        { title: 'Headers', rightButton: null },
        { title: 'Select Templates', rightButton: null },
        { title: 'Select Headers', rightButton: null },
        { title: 'Filters', rightButton: null },
        { title: 'Select Card Templates', rightButton: null },
        { title: 'Filters for Card Type', rightButton: null },
        { title: 'Add Filter', rightButton: null },
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

  // Track navigation direction
  useEffect(() => {
    if (prevStepRef.current !== currentStep) {
      setNavigationDirection(currentStep > prevStepRef.current ? 'forward' : 'backward');
      prevStepRef.current = currentStep;
    }
  }, [currentStep]);

  // Configure modal for each step
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
        title: 'Filters',
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
        backButtonTitle: 'Filters',
        backButton: {
          label: `< Filters`,
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
        title: `Filters for ${cardTypeName}`,
        backButtonTitle: 'Filters',
        backButton: {
          label: `< Filters`,
          onClick: handleBackClick,
        },
        leftButton: null,
        rightButton: null,
      };
    } else if (currentStep === 8) {
      const filterTypeTitle = {
        text: 'Add Text Filter',
        number: 'Add Number Filter',
        date: 'Add Date Filter',
        user: 'Restrict by User',
        dropdown: 'Add Dropdown Filter',
      }[filterType] || 'Add Filter';
      config = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        allowClose: false,
        title: filterTypeTitle,
        backButtonTitle: `Filters for ${cardTemplates.find((t) => t.typeOfCards === selectedCardTypeForFilter)?.name || selectedCardTypeForFilter || 'Unknown'}`,
        backButton: {
          label: `< Filters for ${cardTemplates.find((t) => t.typeOfCards === selectedCardTypeForFilter)?.name || selectedCardTypeForFilter || 'Unknown'}`,
          onClick: handleBackClick,
        },
        leftButton: null,
        rightButton: null,
      };
    }

    if (JSON.stringify(config) !== JSON.stringify(prevModalConfig.current)) {
      setModalConfig(config);
      prevModalConfig.current = config;
    }
  }, [currentStep, isEditMode, handleBackClick, setModalConfig, onDoneClick, selectedTemplateForHeaders, selectedCardTypeForFilter, cardTemplates, filterType]);

  // Sync tempData with state changes
  useEffect(() => {
    const newTempData = {
      sheetName,
      currentHeaders,
      typeOfCardsToDisplay: selectedCardTypes,
      cardTypeFilters: tempData.cardTypeFilters || {},
      cardsPerSearch,
      filterOrder,
    };
    if (
      newTempData.sheetName !== tempData.sheetName ||
      JSON.stringify(newTempData.currentHeaders) !== JSON.stringify(tempData.currentHeaders) ||
      JSON.stringify(newTempData.typeOfCardsToDisplay) !== JSON.stringify(tempData.typeOfCardsToDisplay) ||
      JSON.stringify(newTempData.cardTypeFilters) !== JSON.stringify(tempData.cardTypeFilters) ||
      newTempData.cardsPerSearch !== tempData.cardsPerSearch ||
      JSON.stringify(newTempData.filterOrder) !== JSON.stringify(tempData.filterOrder)
    ) {
      setTempData(newTempData);
    }
  }, [sheetName, currentHeaders, selectedCardTypes, cardsPerSearch, filterOrder, tempData, setTempData]);

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
      if (!typeOfCards) return;
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
      goToStep(7);
    },
    [goToStep, tempData, setTempData]
  );

  const handleAddFilterClick = useCallback(
    (typeOfCards, filterType) => {
      setSelectedCardTypeForFilter(typeOfCards);
      setFilterType(filterType);
      setNavigationDirection('forward');
      goToStep(8);
    },
    [goToStep]
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

  const handleCardsPerSearchChange = useCallback(
    (e) => {
      const value = e.target.value;
      const numValue = value === '' ? null : parseInt(value, 10);

      if (value === '' || (numValue >= 1 && !isNaN(numValue))) {
        setCardsPerSearch(value);
        setTempData((prev) => ({
          ...prev,
          cardsPerSearch: numValue,
        }));
      }
    },
    [setTempData]
  );

  const isFilterEmpty = useCallback(
    (filter) =>
      Object.keys(filter).length === 0 ||
      (!filter.start && !filter.end && !filter.value && !filter.values?.length && !filter.headerKey),
    []
  );

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
                    aria-label="Manage Filters"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setNavigationDirection('forward');
                        goToStep(5);
                      }
                    }}
                  >
                    <span className={styles.navName}>Filters</span>
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
                <div className={styles.buttonContainer}>
                  <button
                    className={`${styles.addHeaderButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                    type="button"
                    style={{ width: '100%', marginBottom: 12, textAlign: 'left' }}
                    onClick={() => {
                      setNavigationDirection('forward');
                      goToStep(3);
                    }}
                  >
                    Add column
                  </button>
                  <div className={`${styles.prioritizedHeadersList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                    {currentHeaders.length === 0 && (
                      <div className={`${styles.noPrioritizedHeaders} ${isDarkTheme ? styles.darkTheme : ''}`}>
                        No columns added yet.
                      </div>
                    )}
                    {currentHeaders.map((header, index) => (
                      <div
                        ref={(el) => headerRefs.current.set(index, el)}
                        key={header.key}
                        className={`${styles.headerItem} ${isDarkTheme ? styles.darkTheme : ''}`}
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
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
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
                        <span className={styles.cardTypeName}>
                          {template.name ? template.name.charAt(0).toUpperCase() + template.name.slice(1).toLowerCase() : template.typeOfCards.charAt(0).toUpperCase() + template.typeOfCards.slice(1).toLowerCase()}
                        </span>
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
                    .filter((header) => header.isUsed !== false)
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
                          <span className={styles.cardTypeName}>
                            {header.name ? header.name.charAt(0).toUpperCase() + header.name.slice(1).toLowerCase() : header.key.charAt(0).toUpperCase() + header.key.slice(1).toLowerCase()}
                          </span>
                        </div>
                      </div>
                    ))
                  );
                })()}
              </div>
            )}
            {step === 5 && (
              <div className={styles.buttonContainer}>
                <button
                  onClick={handleAddCardTemplateClick}
                  className={`${styles.addHeaderButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                  type="button"
                  aria-label="Add Card Template"
                  style={{ width: '100%', marginBottom: 12, textAlign: 'left' }}
                >
                  Add card template
                </button>
                <div className={`${styles.prioritizedHeadersList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  {selectedCardTypes.length === 0 && (
                    <div className={`${styles.noPrioritizedHeaders} ${isDarkTheme ? styles.darkTheme : ''}`}>
                      No card templates selected.
                    </div>
                  )}
                  {selectedCardTypes.map((typeOfCards) => {
                    const template = cardTemplates.find((t) => t.typeOfCards === typeOfCards);
                    return (
                      <div
                        key={typeOfCards}
                        onClick={() => handleFilterClick(typeOfCards)}
                        className={`${styles.prioritizedHeaderItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                        role="button"
                        aria-label={`Filters for ${template?.name || typeOfCards}`}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            handleFilterClick(typeOfCards);
                          }
                        }}
                      >
                        <span className={styles.headerName}>
                          {template?.name
                            ? template.name.charAt(0).toUpperCase() + template.name.slice(1).toLowerCase()
                            : typeOfCards.charAt(0).toUpperCase() + typeOfCards.slice(1).toLowerCase()}
                        </span>
                        <span className={`${styles.filterSummary} ${isDarkTheme ? styles.darkTheme : ''}`}>
                          {getFilterSummary(typeOfCards)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
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
                        <span className={styles.cardTypeName}>
                          {template.name ? template.name.charAt(0).toUpperCase() + template.name.slice(1).toLowerCase() : template.typeOfCards.charAt(0).toUpperCase() + template.typeOfCards.slice(1).toLowerCase()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            {step === 7 && (
              selectedCardTypeForFilter ? (
                <div className={styles.sortByFiltersContainer}>
                  <div className={styles.inputContainer}>
                    <input
                      type="number"
                      value={cardsPerSearch}
                      onChange={handleCardsPerSearchChange}
                      placeholder="Enter cards fetch limit"
                      className={`${styles.fetchLimitInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                      min="1"
                      step="1"
                      aria-label="Cards Fetch Limit"
                    />
                  </div>
                  <div className={`${styles.filterListSection}`}>
                    <CardTypeFilterLikeFilterModal
                      cardType={selectedCardTypeForFilter}
                      headers={cardTemplates.find((t) => t.typeOfCards === selectedCardTypeForFilter)?.headers || []}
                      tempData={tempData}
                      setTempData={setTempData}
                      isDarkTheme={isDarkTheme}
                      showOnlyUserFilter={false}
                      filterType={null}
                    />
                  </div>
                  <div className={`${styles.footer} ${isDarkTheme ? styles.darkTheme : ''}`}>
                    <button
                      onClick={() => {
                        setTempData({
                          ...tempData,
                          cardTypeFilters: {
                            ...tempData.cardTypeFilters,
                            [selectedCardTypeForFilter]: {},
                          },
                          cardsPerSearch: null,
                        });
                        setCardsPerSearch('');
                      }}
                      className={`${styles.resetButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                      disabled={
                        !Object.entries(tempData.cardTypeFilters?.[selectedCardTypeForFilter] || {}).some(
                          ([key, filter]) =>
                            Object.keys(filter).length > 0 &&
                            (key !== 'userFilter' || (key === 'userFilter' && filter.headerKey)) &&
                            !isFilterEmpty(filter)
                        ) && !tempData.cardsPerSearch
                      }
                    >
                      Reset All
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`${styles.noCards} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  No card type selected for filtering
                </div>
              )
            )}
            {step === 8 && (
              <div className={`${styles.filterList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                {selectedCardTypeForFilter && (
                  <CardTypeFilterLikeFilterModal
                    cardType={selectedCardTypeForFilter}
                    headers={cardTemplates.find((t) => t.typeOfCards === selectedCardTypeForFilter)?.headers || []}
                    tempData={tempData}
                    setTempData={setTempData}
                    isDarkTheme={isDarkTheme}
                    showOnlyUserFilter={filterType === 'user'}
                    filterType={filterType}
                  />
                )}
              </div>
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
        options: PropTypes.arrayOf(PropTypes.string),
        visible: PropTypes.bool,
        hidden: PropTypes.bool,
      })
    ),
    typeOfCardsToDisplay: PropTypes.arrayOf(PropTypes.string),
    cardTypeFilters: PropTypes.object,
    cardsPerSearch: PropTypes.number,
    filterOrder: PropTypes.arrayOf(PropTypes.string),
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

function CardTypeFilterLikeFilterModal({ cardType, headers, tempData, setTempData, isDarkTheme, showOnlyUserFilter, filterType }) {
  const { user } = useContext(MainContext);
  const [numberRangeMode, setNumberRangeMode] = useState(() => {
    const initial = {};
    Object.entries(tempData.cardTypeFilters?.[cardType] || {}).forEach(([key, filter]) => {
      if (filter.start || filter.end) initial[key] = true;
    });
    return initial;
  });
  const [activeFilterIndex, setActiveFilterIndex] = useState(null);
  const filterActionsRef = useRef(null);
  const filterValues = tempData.cardTypeFilters?.[cardType] || {};

  // Build visibleHeaders for the main filter list (exclude user fields)
  const visibleHeaders = useMemo(() => {
    let filteredHeaders = headers
      .filter((header) => {
        if (showOnlyUserFilter) {
          // Only show user fields in the user filter dropdown
          return header.key === 'assignedTo' || header.key === 'user' || header.key === 'createdBy';
        }
        // Exclude user fields and only allow text or dropdown types in the main filter list
        return !header.hidden && !['assignedTo', 'user', 'createdBy'].includes(header.key) && (header.type === 'text' || header.type === 'dropdown');
      })
      .map((header) => ({
        ...header,
        name: header.name || header.key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()),
        type: header.type || 'text',
        options: header.options || [],
      }));

    if (filterType && !showOnlyUserFilter) {
      filteredHeaders = filteredHeaders.filter((header) => header.type === filterType);
    }

    return filteredHeaders;
  }, [headers, showOnlyUserFilter, filterType]);

  // Build userHeaders for the Restrict by User dropdown (always include user fields)
  const userHeaders = useMemo(() =>
    headers.filter(
      (header) => ['assignedTo', 'user', 'createdBy'].includes(header.key)
    ).map((header) => ({
      ...header,
      name: header.name || header.key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()),
    })),
    [headers]
  );

  const applyFilters = useCallback(
    (filters) => {
      setTempData({
        ...tempData,
        cardTypeFilters: {
          ...tempData.cardTypeFilters,
          [cardType]: filters,
        },
      });
    },
    [setTempData, tempData, cardType]
  );

  const handleFilterChange = useCallback(
    (headerKey, value, type = 'default') => {
      const header = visibleHeaders.find((h) => h.key === headerKey);
      let newValue = value;
      if (header && header.type === 'text' && type === 'value') {
        newValue = String(value);
      }
      const newFilter = { ...filterValues[headerKey], [type]: newValue };
      if (type === 'start' || type === 'end' || type === 'value' || type === 'sortOrder') {
        if (value === '') delete newFilter[type];
      }
      const updatedFilters = { ...filterValues, [headerKey]: newFilter };
      applyFilters(updatedFilters);
    },
    [filterValues, applyFilters, visibleHeaders]
  );

  const handleUserFilterChange = useCallback(
    (headerKey) => {
      const newFilter = {
        headerKey: headerKey || undefined,
        condition: 'equals',
        value: headerKey ? user?.uid : undefined,
      };
      const updatedFilters = { ...filterValues, userFilter: headerKey ? newFilter : {} };
      applyFilters(updatedFilters);
    },
    [filterValues, applyFilters, user?.uid]
  );

  const handleDropdownChange = useCallback(
    (headerKey, e) => {
      const selectedValues = Array.from(e.target.selectedOptions, (option) => option.value);
      handleFilterChange(headerKey, selectedValues, 'values');
    },
    [handleFilterChange]
  );

  const toggleNumberRangeMode = useCallback(
    (headerKey) => {
      setNumberRangeMode((prev) => {
        const newMode = !prev[headerKey];
        const updatedFilters = {
          ...filterValues,
          [headerKey]: newMode
            ? { start: filterValues[headerKey]?.start || '', end: filterValues[headerKey]?.end || '' }
            : { value: filterValues[headerKey]?.value || '', order: 'equals' },
        };
        applyFilters(updatedFilters);
        return { ...prev, [headerKey]: newMode };
      });
    },
    [filterValues, applyFilters]
  );

  const clearFilter = useCallback(
    (headerKey) => {
      const updatedFilters = { ...filterValues, [headerKey]: {} };
      applyFilters(updatedFilters);
      setNumberRangeMode((prev) => ({ ...prev, [headerKey]: false }));
    },
    [filterValues, applyFilters]
  );

  const clearUserFilter = useCallback(() => {
    const updatedFilters = { ...filterValues, userFilter: {} };
    applyFilters(updatedFilters);
  }, [filterValues, applyFilters]);

  const handleReset = useCallback(() => {
    let clearedFilters = { ...filterValues };
    if (showOnlyUserFilter) {
      clearedFilters = { ...filterValues, userFilter: {} };
    } else if (filterType) {
      Object.keys(clearedFilters).forEach((key) => {
        if (key !== 'userFilter') {
          const header = visibleHeaders.find((h) => h.key === key);
          if (header && header.type === filterType) {
            clearedFilters[key] = {};
          }
        }
      });
    } else {
      clearedFilters = {};
    }
    applyFilters(clearedFilters);
    setNumberRangeMode({});
    setActiveFilterIndex(null);
  }, [filterValues, applyFilters, filterType, visibleHeaders, showOnlyUserFilter]);

  const isFilterEmpty = (filter) =>
    Object.keys(filter).length === 0 ||
    (!filter.start && !filter.end && !filter.value && !filter.values?.length && !filter.headerKey);

  const getFilterSummary = useCallback(
    (header) => {
      const filter = filterValues[header.key] || {};
      if (isFilterEmpty(filter)) return 'None';

      switch (header.type) {
        case 'number':
          if (numberRangeMode[header.key]) {
            const start = filter.start || '';
            const end = filter.end || '';
            return `${start}${start && end ? ' – ' : ''}${end}`.trim();
          } else {
            const order = filter.order || 'equals';
            const value = filter.value || '';
            const orderText = { equals: '=', greaterOrEqual: '≥', lessOrEqual: '≤', greater: '>', less: '<' }[order];
            return `${orderText}${value ? ` ${value}` : ''}`.trim();
          }
        case 'date':
          return 'Date Filter';
        case 'dropdown':
          const values = filter.values || [];
          return values.length > 0 ? `${values.join(', ')}` : 'None';
        case 'text':
          const condition = filter.condition || 'equals';
          const value = filter.value !== undefined && filter.value !== null ? String(filter.value) : '';
          return value ? `${condition} "${value}"` : 'None';
        default:
          return filter.value !== undefined && filter.value !== null
            ? `"${String(filter.value)}"`
            : 'None';
      }
    },
    [filterValues, numberRangeMode]
  );

  return (
    <div className={`${styles.filterList} ${isDarkTheme ? styles.darkTheme : ''}`}>
      {/* Always show Restrict by User filter at the top */}
      <div
        className={`${styles.filterItem} ${isDarkTheme ? styles.darkTheme : ''} ${styles.singleHeader}`}
        onClick={() => setActiveFilterIndex('user')}
      >
        <div className={styles.filterRow}>
          <div className={styles.filterNameType}>
            <span>Restrict by User</span>
          </div>
          <div className={styles.primaryButtons}>
            <span className={styles.filterSummary}>
              {filterValues.userFilter?.headerKey
                ? `${
                    userHeaders.find((h) => h.key === filterValues.userFilter.headerKey)?.name ||
                    filterValues.userFilter.headerKey
                  } = Current User`
                : 'None'}
            </span>
          </div>
        </div>
        {activeFilterIndex === 'user' && (
          <div
            className={`${styles.filterActions} ${styles.singleHeader} ${isDarkTheme ? styles.darkTheme : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <select
              value={filterValues.userFilter?.headerKey || ''}
              onChange={(e) => handleUserFilterChange(e.target.value || '')}
              className={`${styles.filterSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
            >
              <option value="">No User Filter</option>
              {userHeaders.map((header) => (
                <option key={header.key} value={header.key}>
                  {header.name}
                </option>
              ))}
            </select>
            <button
              onClick={clearUserFilter}
              className={`${styles.clearButton} ${isDarkTheme ? styles.darkTheme : ''}`}
            >
              Clear
            </button>
          </div>
        )}
      </div>
      {/* Then show all other header filters */}
      {visibleHeaders.length === 0 ? (
        <div className={`${styles.noCards} ${isDarkTheme ? styles.darkTheme : ''}`}>
          No {filterType || 'headers'} available
        </div>
      ) : (
        visibleHeaders.map((header, index) => (
          <div
            key={header.key}
            className={`${styles.filterItem} ${activeFilterIndex === index ? styles.activeItem : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
            onClick={() => setActiveFilterIndex((prev) => (prev === index ? null : index))}
          >
            <div className={styles.filterRow}>
              <div className={styles.filterNameType}>
                <span>{header.name}</span>
              </div>
              <div className={styles.primaryButtons}>
                <span className={styles.filterSummary}>{getFilterSummary(header)}</span>
              </div>
            </div>
            {activeFilterIndex === index && (
              <div
                className={`${styles.filterActions} ${isDarkTheme ? styles.darkTheme : ''}`}
                ref={filterActionsRef}
                onClick={(e) => e.stopPropagation()}
              >
                {header.type === 'number' ? (
                  numberRangeMode[header.key] ? (
                    <>
                      <input
                        type="number"
                        value={filterValues[header.key]?.start || ''}
                        onChange={(e) => handleFilterChange(header.key, e.target.value, 'start')}
                        placeholder="From"
                        className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                      />
                      <span className={styles.separator}>–</span>
                      <input
                        type="number"
                        value={filterValues[header.key]?.end || ''}
                        onChange={(e) => handleFilterChange(header.key, e.target.value, 'end')}
                        placeholder="To"
                        className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                      />
                      <button
                        onClick={() => toggleNumberRangeMode(header.key)}
                        className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                      >
                        Value
                      </button>
                    </>
                  ) : (
                    <>
                      <select
                        value={filterValues[header.key]?.order || 'equals'}
                        onChange={(e) => handleFilterChange(header.key, e.target.value, 'order')}
                        className={`${styles.filterSelectNoChevron} ${isDarkTheme ? styles.darkTheme : ''}`}
                      >
                        <option value="equals">=</option>
                        <option value="greater">{'>'}</option>
                        <option value="less">{'<'}</option>
                        <option value="greaterOrEqual">≥</option>
                        <option value="lessOrEqual">≤</option>
                      </select>
                      <input
                        type="number"
                        value={filterValues[header.key]?.value || ''}
                        onChange={(e) => handleFilterChange(header.key, e.target.value, 'value')}
                        placeholder="Value"
                        className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                      />
                      <button
                        onClick={() => toggleNumberRangeMode(header.key)}
                        className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                      >
                        Range
                      </button>
                    </>
                  )
                ) : header.type === 'date' ? (
                  <>
                    <input
                      type="date"
                      value={filterValues[header.key]?.start || ''}
                      onChange={(e) => handleFilterChange(header.key, e.target.value, 'start')}
                      className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                    />
                    <span className={styles.separator}>–</span>
                    <input
                      type="date"
                      value={filterValues[header.key]?.end || ''}
                      onChange={(e) => handleFilterChange(header.key, e.target.value, 'end')}
                      className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                    />
                  </>
                ) : header.type === 'dropdown' ? (
                  <select
                    multiple
                    value={filterValues[header.key]?.values || []}
                    onChange={(e) => handleDropdownChange(header.key, e)}
                    className={`${styles.filterMultiSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
                  >
                    {header.options.map((option, idx) => (
                      <option key={`${header.key}-option-${idx}`} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    <select
                      value={filterValues[header.key]?.condition || 'equals'}
                      onChange={(e) => handleFilterChange(header.key, e.target.value, 'condition')}
                      className={`${styles.filterSelectNoChevron} ${isDarkTheme ? styles.darkTheme : ''}`}
                    >
                      <option value="equals">Equals</option>
                      <option value="contains">Contains</option>
                      <option value="startsWith">Starts with</option>
                      <option value="endsWith">Ends with</option>
                    </select>
                    <input
                      type="text"
                      value={filterValues[header.key]?.value || ''}
                      onChange={(e) => handleFilterChange(header.key, e.target.value, 'value')}
                      placeholder="Value"
                      className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                    />
                  </>
                )}
                <button
                  onClick={() => clearFilter(header.key)}
                  className={`${styles.clearButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

CardTypeFilterLikeFilterModal.propTypes = {
  cardType: PropTypes.string.isRequired,
  headers: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      name: PropTypes.string,
      type: PropTypes.string,
      hidden: PropTypes.bool,
      options: PropTypes.arrayOf(PropTypes.string),
    })
  ).isRequired,
  tempData: PropTypes.shape({
    cardTypeFilters: PropTypes.object,
  }).isRequired,
  setTempData: PropTypes.func.isRequired,
  isDarkTheme: PropTypes.bool.isRequired,
  showOnlyUserFilter: PropTypes.bool,
  filterType: PropTypes.string,
};

CardTypeFilterLikeFilterModal.defaultProps = {
  showOnlyUserFilter: false,
  filterType: null,
};

export default EditSheetsModal;