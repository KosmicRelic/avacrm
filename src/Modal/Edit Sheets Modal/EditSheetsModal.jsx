import { useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import styles from './EditSheetsModal.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { ModalNavigatorContext } from '../../Contexts/ModalNavigator';
import { FaEye, FaEyeSlash, FaThumbtack, FaFilter } from 'react-icons/fa';
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
      } else {
        console.warn(`Duplicate key "${header.key}" removed from initial currentHeaders`);
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
  const [selectedCardTypeForFilter, setSelectedCardTypeForFilter] = useState(null);
  const headerRefs = useRef(new Map());
  const hasInitialized = useRef(false);
  const prevStepRef = useRef(currentStep);
  const prevModalConfig = useRef(null);

  // Find sheet ID
  const sheetId = sheets.allSheets?.find((s) => s.sheetName === sheetName)?.id;

  // Get all available headers from sheets and card templates
  const allHeaders = useMemo(() => {
    const headersBySheet = sheets.allSheets
      .filter((sheet) => sheet.sheetName !== sheetName)
      .map((sheet) => ({
        sheetName: sheet.sheetName,
        headers: (sheet.headers || []).map((header) => ({
          key: header.key,
          name: header.name,
          type: header.type,
          options: header.options || [],
        })),
      }));

    const currentSheetHeaders = {
      sheetName: sheetName || 'Current Sheet',
      headers: currentHeaders.map((header) => ({
        key: header.key,
        name: header.name,
        type: header.type,
        options: header.options || [],
      })),
    };

    const commonHeaders = [];
    if (cardTemplates.length > 0) {
      const firstTemplateHeaders = cardTemplates[0].headers.filter(
        (header) => header.isUsed !== false && ['id', 'typeOfCards'].includes(header.key)
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
      currentSheetHeaders,
      ...headersBySheet,
      ...templateHeaders,
    ];
  }, [sheets.allSheets, sheetName, currentHeaders, cardTemplates]);

  // Function to generate filter summary for a card type
  const getFilterSummary = useCallback(
    (cardType) => {
      const filters = tempData.cardTypeFilters?.[cardType] || {};
      const summaries = [];

      Object.entries(filters).forEach(([headerKey, filter]) => {
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
    console.log('[EditSheetsModal] Saving sheet:', { sheetName, currentHeaders, selectedCardTypes });
    setTempData({ 
      sheetName, 
      currentHeaders, 
      rows, 
      typeOfCardsToDisplay: selectedCardTypes, 
      cardTypeFilters: tempData.cardTypeFilters || {} 
    });
    if (sheetName !== tempData.sheetName) {
      console.log('[EditSheetsModal] Updating activeSheetName:', sheetName);
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
  }, [goBack]);

  // Initialize modal steps (run once)
  useEffect(() => {
    if (!hasInitialized.current) {
      const steps = [
        { title: isEditMode ? 'Edit Sheet' : 'Create Sheet', rightButton: null },
        { title: 'Select Card Types', rightButton: null },
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

  // Update navigation direction
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
        title: 'Select Card Types',
        backButtonTitle: step1Title,
        backButton: {
          label: `< ${step1Title}`,
          onClick: handleBackClick,
        },
        leftButton: null,
        rightButton: null,
      };
    } else if (currentStep === 3) {
      const cardTypeName = cardTemplates.find((t) => t.typeOfCards === selectedCardTypeForFilter)?.name || selectedCardTypeForFilter;
      config = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        allowClose: false,
        title: `Filters for ${cardTypeName}`,
        backButtonTitle: 'Select Card Types',
        backButton: {
          label: `< Select Card Types`,
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
  }, [currentStep, isEditMode, handleBackClick, setModalConfig, onDoneClick, selectedCardTypeForFilter, cardTemplates]);

  // Sync tempData
  useEffect(() => {
    const newTempData = { 
      sheetName, 
      currentHeaders, 
      rows, 
      typeOfCardsToDisplay: selectedCardTypes, 
      cardTypeFilters: tempData.cardTypeFilters || {} 
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
        return prev.filter((t) => t !== type);
      } else {
        return [...prev, type];
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

  const addHeader = useCallback((headerKey, headerDetails) => {
    setCurrentHeaders((prev) => {
      if (prev.some((h) => h.key === headerKey)) {
        console.warn(`Duplicate header key "${headerKey}" ignored`);
        return prev;
      }
      return [
        ...prev,
        {
          key: headerKey,
          name: headerDetails.name,
          type: headerDetails.type,
          options: headerDetails.options || [],
          visible: true,
          hidden: false,
        },
      ];
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

  const handleFilterClick = useCallback((typeOfCards) => {
    setSelectedCardTypeForFilter(typeOfCards);
    setNavigationDirection('forward');
    goToStep(3);
  }, [goToStep]);

  return (
    <div className={`${styles.sheetModal} ${isDarkTheme ? styles.darkTheme : ''}`}>
      <div className={styles.viewContainer}>
        {[1, 2, 3].map((step) => (
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
                  <button
                    onClick={() => {
                      setNavigationDirection('forward');
                      goToStep(2);
                    }}
                    className={`${styles.cardsButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                    aria-label="Select Card Types"
                  >
                    Cards
                  </button>
                </div>
                <select
                  onChange={(e) => {
                    const [sourceName, headerKey] = e.target.value.split(':');
                    if (headerKey) {
                      const source = allHeaders.find((sh) => sh.sheetName === sourceName);
                      const headerDetails = source?.headers.find((h) => h.key === headerKey);
                      if (headerDetails) {
                        addHeader(headerKey, headerDetails);
                      }
                    }
                    e.target.value = '';
                  }}
                  className={`${styles.addHeaderSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
                >
                  <option value="">Add Column</option>
                  {allHeaders.map((source) =>
                    source.sheetName === 'Common' ? (
                      source.headers.map((header) => (
                        <option
                          key={`Common:${header.key}`}
                          value={`Common:${header.key}`}
                          disabled={currentHeaders.some((ch) => ch.key === header.key)}
                        >
                          {header.name} ({header.type})
                        </option>
                      ))
                    ) : (
                      <optgroup key={source.sheetName} label={source.sheetName}>
                        {source.headers
                          .filter((h) => !currentHeaders.some((ch) => ch.key === h.key))
                          .map((header) => (
                            <option
                              key={`${source.sheetName}:${header.key}`}
                              value={`${source.sheetName}:${header.key}`}
                            >
                              {header.name} ({header.type})
                            </option>
                          ))}
                      </optgroup>
                    )
                  )}
                </select>
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
              <div className={`${styles.cardTypeList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                {cardTemplates.length === 0 ? (
                  <div className={`${styles.noCards} ${isDarkTheme ? styles.darkTheme : ''}`}>
                    No card types available
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
                        <div className={styles.cardTypeActions}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFilterClick(template.typeOfCards);
                            }}
                            className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                            aria-label={`Filter ${template.name || template.typeOfCards}`}
                          >
                            <FaFilter />
                            <span className={styles.filterSummary}>{getFilterSummary(template.typeOfCards)}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            {step === 3 && (
              <CardTypeFilter
                cardType={selectedCardTypeForFilter}
                headers={cardTemplates.find((t) => t.typeOfCards === selectedCardTypeForFilter)?.headers || []}
                tempData={tempData}
                setTempData={setTempData}
              />
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