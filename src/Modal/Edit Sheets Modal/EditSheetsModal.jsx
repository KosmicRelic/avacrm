import { useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import styles from './EditSheetsModal.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { ModalNavigatorContext } from '../../Contexts/ModalNavigator';
import { FaEye, FaEyeSlash, FaThumbtack, FaFilter, FaChevronRight, FaRegCircle, FaRegCheckCircle } from 'react-icons/fa';
import { MdFilterAlt, MdFilterAltOff } from 'react-icons/md';
import CardTypeFilter from './CardTypeFilter/CardTypeFilter';
import CardsFetchSorting from './CardsFetchSorting/CardsFetchSorting';

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
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchTargetIndex, setTouchTargetIndex] = useState(null);
  const [selectedCardTypes, setSelectedCardTypes] = useState(tempData.typeOfCardsToDisplay || []);
  const [navigationDirection, setNavigationDirection] = useState(null);
  const [selectedTemplateForHeaders, setSelectedTemplateForHeaders] = useState(null);
  const [selectedCardTypeForFilter, setSelectedCardTypeForFilter] = useState(null);
  const [cardsPerSearch, setCardsPerSearch] = useState(tempData.cardsPerSearch || '');
  const [prioritizedHeaders, setPrioritizedHeaders] = useState(() => {
    return (tempData.prioritizedHeaders || []).map((header) => {
      let options = header.options || [];
      if (header.type === 'dropdown' && options.length === 0) {
        const template = cardTemplates.find((t) => t.typeOfCards === (tempData.typeOfCardsToDisplay?.[0] || 'Leads'));
        if (template) {
          const templateHeader = template.headers.find((h) => h.key === header.key);
          options = templateHeader?.options || [];
        }
      }
      return { ...header, options };
    });
  });
  const [selectedPrioritizedHeader, setSelectedPrioritizedHeader] = useState(null);
  const [showHeaderSelectForSort, setShowHeaderSelectForSort] = useState(false);
  const headerRefs = useRef(new Map());
  const hasInitialized = useRef(false);
  const prevStepRef = useRef(currentStep);
  const prevModalConfig = useRef(null);
  const [isSortEditMode, setIsSortEditMode] = useState(false);
  const [draggedSortIdx, setDraggedSortIdx] = useState(null);
  const [dragOverSortIdx, setDragOverSortIdx] = useState(null);
  const prioritizedHeaderRefs = useRef(new Map());

  const memoizedPrioritizedHeaders = useMemo(() => prioritizedHeaders, [prioritizedHeaders]);

  useEffect(() => {
    if (!tempData.cardTypeFilters || !('cardsPerSearch' in tempData) || !('prioritizedHeaders' in tempData)) {
      setTempData({
        ...tempData,
        cardTypeFilters: tempData.cardTypeFilters || {},
        cardsPerSearch: tempData.cardsPerSearch || null,
        prioritizedHeaders: tempData.prioritizedHeaders || [],
      });
    }
  }, [tempData, setTempData]);

  const setModalUtils = useCallback((updates) => {}, []);

  const sheetId = sheets.allSheets?.find((s) => s.sheetName === sheetName)?.docId;

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

  const onDoneClick = useCallback(() => {
    setTempData({
      sheetName,
      currentHeaders,
      typeOfCardsToDisplay: selectedCardTypes,
      cardTypeFilters: tempData.cardTypeFilters || {},
      cardsPerSearch,
      prioritizedHeaders,
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
    prioritizedHeaders,
    setTempData,
    tempData.sheetName,
    tempData.cardTypeFilters,
    setActiveSheetName,
    clearFetchedSheets,
    handleClose,
  ]);

  const handleBackClick = useCallback(() => {
    setNavigationDirection('backward');
    goBack();
  }, [goBack]);

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
        { title: 'Sort Options', rightButton: null },
        { title: 'Cards Fetch Limit', rightButton: null },
        { title: 'Sort by Filters', rightButton: null },
        { title: 'Select Header to Prioritize', rightButton: null },
        { title: 'Header Sort Options', rightButton: null },
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

  useEffect(() => {
    if (prevStepRef.current !== currentStep) {
      setNavigationDirection(currentStep > prevStepRef.current ? 'forward' : 'backward');
      prevStepRef.current = currentStep;
    }
  }, [currentStep]);

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
    } else if (currentStep === 9) {
      const cardTypeName = cardTemplates.find((t) => t.typeOfCards === selectedCardTypeForFilter)?.name || selectedCardTypeForFilter || 'Unknown';
      config = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        allowClose: false,
        title: `Sort Options for ${cardTypeName}`,
        backButtonTitle: 'Template Options',
        backButton: {
          label: `< Template Options`,
          onClick: handleBackClick,
        },
        leftButton: null,
        rightButton: null,
      };
    } else if (currentStep === 10) {
      const cardTypeName = cardTemplates.find((t) => t.typeOfCards === selectedCardTypeForFilter)?.name || selectedCardTypeForFilter || 'Unknown';
      config = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        allowClose: false,
        title: `Cards Fetch Limit for ${cardTypeName}`,
        backButtonTitle: 'Sort Options',
        backButton: {
          label: `< Sort Options`,
          onClick: handleBackClick,
        },
        leftButton: null,
        rightButton: null,
      };
    } else if (currentStep === 11) {
      config = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        allowClose: false,
        title: 'Sort by Filters',
        backButtonTitle: 'Sort Options',
        backButton: {
          label: `< Sort Options`,
          onClick: handleBackClick,
        },
        leftButton: null,
        rightButton: {
          label: isSortEditMode ? "Done" : "Edit",
          onClick: () => setIsSortEditMode((v) => !v),
          isActive: true,
          isRemove: false,
        },
      };
    } else if (currentStep === 12) {
      config = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        allowClose: false,
        title: 'Select Header to Prioritize',
        backButtonTitle: 'Sort by Filters',
        backButton: {
          label: `< Sort by Filters`,
          onClick: () => {
            setNavigationDirection('backward');
            goToStep(11);
          },
        },
        leftButton: null,
        rightButton: null,
      };
    } else if (currentStep === 13) {
      config = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        allowClose: false,
        title: 'Header Sort Options',
        backButtonTitle: 'Sort by Filters',
        backButton: {
          label: `< Sort by Filters`,
          onClick: () => {
            setNavigationDirection('backward');
            goToStep(11);
          },
        },
        leftButton: null,
        rightButton: null,
      };
    }

    if (JSON.stringify(config) !== JSON.stringify(prevModalConfig.current)) {
      setModalConfig(config);
      prevModalConfig.current = config;
    }
  }, [currentStep, isEditMode, handleBackClick, setModalConfig, onDoneClick, selectedTemplateForHeaders, selectedCardTypeForFilter, cardTemplates, isSortEditMode]);

  useEffect(() => {
    const newTempData = {
      sheetName,
      currentHeaders,
      typeOfCardsToDisplay: selectedCardTypes,
      cardTypeFilters: tempData.cardTypeFilters || {},
      cardsPerSearch,
      prioritizedHeaders,
    };
    if (
      newTempData.sheetName !== tempData.sheetName ||
      JSON.stringify(newTempData.currentHeaders) !== JSON.stringify(tempData.currentHeaders) ||
      JSON.stringify(newTempData.typeOfCardsToDisplay) !== JSON.stringify(tempData.typeOfCardsToDisplay) ||
      JSON.stringify(newTempData.cardTypeFilters) !== JSON.stringify(tempData.cardTypeFilters) ||
      newTempData.cardsPerSearch !== tempData.cardsPerSearch ||
      JSON.stringify(newTempData.prioritizedHeaders) !== JSON.stringify(tempData.prioritizedHeaders)
    ) {
      setTempData(newTempData);
    }
  }, [sheetName, currentHeaders, selectedCardTypes, cardsPerSearch, prioritizedHeaders, tempData, setTempData]);

  useEffect(() => {
    if (JSON.stringify(prioritizedHeaders) !== JSON.stringify(tempData.prioritizedHeaders)) {
      setTempData({
        ...tempData,
        prioritizedHeaders,
      });
    }
  }, [prioritizedHeaders, tempData, setTempData]);

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
      goToStep(8);
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

  const handleSortClick = useCallback(
    (typeOfCards) => {
      setSelectedCardTypeForFilter(typeOfCards);
      setNavigationDirection('forward');
      goToStep(9);
    },
    [goToStep]
  );

  const handleFetchLimitClick = useCallback(() => {
    setNavigationDirection('forward');
    goToStep(10);
  }, [goToStep]);

  const handleSortByFiltersClick = useCallback(() => {
    setNavigationDirection('forward');
    goToStep(11);
  }, [goToStep]);

  const handleAddHeaderToPrioritize = useCallback(() => {
    setNavigationDirection('forward');
    goToStep(12);
  }, [goToStep]);

  const handleSelectHeaderToPrioritize = useCallback((header) => {
    setPrioritizedHeaders((prev) => {
      if (!prev.some((h) => h.key === header.key)) {
        let options = header.options || [];
        if (header.type === 'dropdown' && options.length === 0) {
          const template = cardTemplates.find((t) => t.typeOfCards === (selectedCardTypes[0] || 'Leads'));
          if (template) {
            const templateHeader = template.headers.find((h) => h.key === header.key);
            options = templateHeader?.options || [];
          }
        }
        const sortOptions = header.type === 'dropdown' ? (prev.find((h) => h.key === header.key)?.sortOptions || []) : {};
        const newHeader = {
          key: header.key,
          name: header.name,
          type: header.type,
          options,
          sortOptions,
        };
        return [...prev, newHeader];
      } else {
        // If already present, remove it (toggle behavior)
        return prev.filter((h) => h.key !== header.key);
      }
    });
    // Do NOT go back a step here
  }, [cardTemplates, selectedCardTypes]);

  const handleRemovePrioritizedHeader = useCallback((headerKey) => {
    setPrioritizedHeaders((prev) => prev.filter((h) => h.key !== headerKey));
  }, []);

  const handlePrioritizedHeaderClick = useCallback((header) => {
    setSelectedPrioritizedHeader(header);
    setNavigationDirection('forward');
    goToStep(13);
  }, [goToStep]);

  const handleUpdateHeaderSortOptions = useCallback((headerKey, sortOptions) => {
    setPrioritizedHeaders((prev) =>
      prev.map((h) =>
        h.key === headerKey ? { ...h, sortOptions } : h
      )
    );
  }, []);

  const handleRemovePrioritizedHeaderFromOptions = useCallback((headerKey) => {
    setPrioritizedHeaders((prev) => {
      const newPrioritizedHeaders = prev.filter((h) => h.key !== headerKey);
      setTempData((prevTempData) => ({
        ...prevTempData,
        prioritizedHeaders: newPrioritizedHeaders,
      }));
      return newPrioritizedHeaders;
    });
    setNavigationDirection('backward');
    goBack();
  }, [goBack, setTempData]);

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
        setModalUtils({ cardsPerSearch: numValue });
      }
    },
    [setTempData, setModalUtils]
  );

  const handleSortDragStart = (idx) => {
    setDraggedSortIdx(idx);
    setDragOverSortIdx(idx);
  };

  const handleSortDragOver = (e, idx) => {
    if (draggedSortIdx === null || draggedSortIdx === idx) return;
    e.preventDefault();
    setDragOverSortIdx(idx);
  };

  const handleSortDrop = (idx) => {
    if (draggedSortIdx === null || draggedSortIdx === idx) {
      setDraggedSortIdx(null);
      setDragOverSortIdx(null);
      return;
    }
    setPrioritizedHeaders((prev) => {
      const newOrder = [...prev];
      const [dragged] = newOrder.splice(draggedSortIdx, 1);
      newOrder.splice(idx, 0, dragged);
      return newOrder;
    });
    setDraggedSortIdx(null);
    setDragOverSortIdx(null);
  };

  const handleSortDragEnd = () => {
    setDraggedSortIdx(null);
    setDragOverSortIdx(null);
  };

  return (
    <div className={`${styles.sheetModal} ${isDarkTheme ? styles.darkTheme : ''}`}>
      <div className={styles.viewContainer}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((step) => (
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
              </div>
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
                        onClick={() => handleTemplateOptionsClick(typeOfCards)}
                        className={`${styles.prioritizedHeaderItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                        role="button"
                        aria-label={`Options for ${template?.name || typeOfCards}`}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            handleTemplateOptionsClick(typeOfCards);
                          }
                        }}
                      >
                        <span className={styles.headerName}>
                          {template?.name
                            ? template.name.charAt(0).toUpperCase() + template.name.slice(1).toLowerCase()
                            : typeOfCards.charAt(0).toUpperCase() + typeOfCards.slice(1).toLowerCase()}
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
            {step === 9 && (
              <div className={styles.buttonContainer}>
                <div
                  onClick={handleFetchLimitClick}
                  className={`${styles.navItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                  role="button"
                  aria-label="Cards Fetch Limit"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleFetchLimitClick();
                    }
                  }}
                >
                  <span className={styles.navName}>Cards Fetch Limit</span>
                </div>
                <div
                  onClick={handleSortByFiltersClick}
                  className={`${styles.navItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                  role="button"
                  aria-label="Sort by Filters"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleSortByFiltersClick();
                    }
                  }}
                >
                  <span className={styles.navName}>Sort by Filters</span>
                </div>
              </div>
            )}
            {step === 10 && (
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
            )}
            {step === 11 && (
              <div className={`${styles.sortByFiltersContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <button
                  className={`${styles.addHeaderButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                  onClick={handleAddHeaderToPrioritize}
                  type="button"
                  aria-label="Add Header to Prioritize"
                  disabled={isSortEditMode}
                >
                  Add header to prioritize
                </button>
                <div className={`${styles.prioritizedHeadersList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  {memoizedPrioritizedHeaders.length === 0 && (
                    <div className={`${styles.noPrioritizedHeaders} ${isDarkTheme ? styles.darkTheme : ''}`}>
                      No prioritized headers yet.
                    </div>
                  )}
                  {memoizedPrioritizedHeaders.map((header, idx) => (
                    <div
                      ref={el => prioritizedHeaderRefs.current.set(idx, el)}
                      key={header.key}
                      className={`
                        ${styles.prioritizedHeaderItem}
                        ${isDarkTheme ? styles.darkTheme : ''}
                        ${isSortEditMode && draggedSortIdx === idx ? styles.dragging : ''}
                        ${isSortEditMode && dragOverSortIdx === idx && draggedSortIdx !== null && draggedSortIdx !== idx ? styles.dragOver : ''}
                      `}
                      style={{ cursor: isSortEditMode ? 'grab' : 'pointer', userSelect: 'none' }}
                      draggable={isSortEditMode}
                      onDragStart={isSortEditMode ? () => handleSortDragStart(idx) : undefined}
                      onDragOver={isSortEditMode ? (e) => handleSortDragOver(e, idx) : undefined}
                      onDrop={isSortEditMode ? () => handleSortDrop(idx) : undefined}
                      onDragEnd={isSortEditMode ? handleSortDragEnd : undefined}
                      onClick={!isSortEditMode ? () => handlePrioritizedHeaderClick(header) : undefined}
                      tabIndex={0}
                      aria-label={`Edit sort options for ${header.name || header.key}`}
                      onKeyDown={!isSortEditMode ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          handlePrioritizedHeaderClick(header);
                        }
                      } : undefined}
                    >
                      <span className={styles.headerName}>
                        {header.name ? header.name.charAt(0).toUpperCase() + header.name.slice(1).toLowerCase() : header.key.charAt(0).toUpperCase() + header.key.slice(1).toLowerCase()}
                      </span>
                      <span className="prioritizedHeaderRightIcon">
                        {isSortEditMode ? (
                          <span className={`${styles.dragIcon} ${isDarkTheme ? styles.darkTheme : ''}`} title="Drag to reorder" style={{ marginLeft: 8 }}>
                            ☰
                          </span>
                        ) : (
                          <span className="prioritizedHeaderChevron">
                            <FaChevronRight size={18} />
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {step === 12 && (
              <div className={styles.headerSelectList}>
                <div className={`${styles.prioritizedHeadersList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  {(() => {
                    const template = cardTemplates.find((t) => t.typeOfCards === selectedCardTypes[0]);
                    const headers = template?.headers
                      .filter((header) => header.isUsed !== false && !['id', 'typeOfCards'].includes(header.key))
                      .map((header) => ({
                        key: header.key,
                        name: header.name,
                        type: header.type,
                        options: header.options || [],
                      })) || [];
                    if (headers.length === 0) {
                      return (
                        <div className={styles.noCards}>
                          No headers available to prioritize.
                        </div>
                      );
                    }
                    return headers.map((header) => {
                      const isChecked = memoizedPrioritizedHeaders.some((h) => h.key === header.key);
                      return (
                        <div
                          key={header.key}
                          className={styles.cardTypeItem}
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleSelectHeaderToPrioritize(header)}
                        >
                          <div className={styles.cardTypeRow} style={{ gap: 4 }}>
                            <span
                              className={`${styles.customCheckbox} ${isDarkTheme ? styles.darkTheme : ''}`}
                              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                            >
                              {isChecked ? (
                                <FaRegCheckCircle size={18} />
                              ) : (
                                <FaRegCircle size={18} />
                              )}
                              <span className={styles.cardTypeName}>
                                {header.name ? header.name.charAt(0).toUpperCase() + header.name.slice(1).toLowerCase() : header.key.charAt(0).toUpperCase() + header.key.slice(1).toLowerCase()}
                              </span>
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
                <div style={{ marginTop: 16, textAlign: 'right' }}>
                  <button
                    className={`${styles.addHeaderButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                    type="button"
                    onClick={() => {
                      setNavigationDirection('backward');
                      goToStep(11);
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
            {step === 13 && selectedPrioritizedHeader && (
              <CardsFetchSorting
                header={selectedPrioritizedHeader}
                onSave={(sortOptions) => handleUpdateHeaderSortOptions(selectedPrioritizedHeader.key, sortOptions)}
                onRemove={() => handleRemovePrioritizedHeaderFromOptions(selectedPrioritizedHeader.key)}
                isDarkTheme={isDarkTheme}
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
        options: PropTypes.arrayOf(PropTypes.string),
        visible: PropTypes.bool,
        hidden: PropTypes.bool,
      })
    ),
    typeOfCardsToDisplay: PropTypes.arrayOf(PropTypes.string),
    cardTypeFilters: PropTypes.object,
    cardsPerSearch: PropTypes.number,
    prioritizedHeaders: PropTypes.arrayOf(
      PropTypes.shape({
        key: PropTypes.string.isRequired,
        name: PropTypes.string,
        type: PropTypes.string,
        options: PropTypes.arrayOf(PropTypes.string),
        sortOptions: PropTypes.oneOfType([
          PropTypes.arrayOf(PropTypes.string),
          PropTypes.shape({
            sortType: PropTypes.string,
            prioritizedValues: PropTypes.arrayOf(PropTypes.string),
            equalValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
          }),
        ]),
      })
    ),
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