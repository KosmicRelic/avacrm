import React, { useState, useCallback, useMemo, useContext, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import Sheets from './Sheets/Sheets';
import AppHeader from './App Header/AppHeader';
import FilterModal from './Modal/FilterModal/FilterModal';
import { MainContext } from './Contexts/MainContext';
import styles from './App.module.css';
import EditSheetsModal from './Modal/Edit Sheets Modal/EditSheetsModal';
import useModal from './Modal/Hooks/UseModal';
import useSheets from './Modal/Hooks/UseSheets';
import Modal from './Modal/Modal';
import ReOrderModal from './Modal/Re Order Modal/ReOrderModal';
import ProfileModal from './Profile Modal/ProfileModal';
import CardsTemplate from './Modal/Cards Template/CardsTemplate';
import CreateSheetsAndFolders from './Modal/Create Sheets And Folders/CreateSheetsAndFolders';
import TransportModal from './Modal/Cards Transportaion Modal/TransportModal';
import FolderOperations from './Modal/Folder Modal/FolderModal';
import Dashboard from './Dashboard/Dashboard';
import WidgetSizeModal from './Modal/WidgetSizeModal/WidgetSizeModal';
import MetricsCategories from './Metrics/MetricsEdit/MetricsEdit';
import WidgetSetupModal from './Dashboard/WidgetSetupModal/WidgetSetupModal';
import MetricsModal from './Modal/MetricsModal/MetricsModal';
import Metrics from './Metrics/Metrics';

function App() {
  const {
    sheets,
    setSheets,
    cards,
    setCards,
    cardTemplates,
    setCardTemplates,
    editMode,
    setEditMode,
    tempData,
    setTempData,
    selectedTemplateIndex,
    setSelectedTemplateIndex,
    currentSectionIndex,
    setCurrentSectionIndex,
    dashboards,
    setDashboards,
    metrics,
    setMetrics,
    isDarkTheme,
  } = useContext(MainContext);

  const navigate = useNavigate();
  const location = useLocation();
  const sheetModal = useModal();
  const filterModal = useModal();
  const sheetsModal = useModal();
  const transportModal = useModal();
  const cardsTemplateModal = useModal();
  const sheetFolderModal = useModal();
  const folderOperationsModal = useModal();
  const widgetSizeModal = useModal();
  const widgetViewModal = useModal();
  const widgetSetupModal = useModal();
  const metricsModal = useModal();
  const [isSheetModalEditMode, setIsSheetModalEditMode] = useState(false);
  const [activeOption, setActiveOption] = useState('dashboard');
  const [activeModal, setActiveModal] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [activeDashboardId, setActiveDashboardId] = useState(dashboards[0]?.id || 'dashboard-1');
  const [selectedMetricData, setSelectedMetricData] = useState(null);

  const activeSheet = useMemo(() => sheets?.allSheets?.find((sheet) => sheet.isActive) || null, [sheets]);
  const activeSheetName = activeSheet?.sheetName;

  const activeDashboard = useMemo(() => {
    const dashboard = dashboards.find((d) => d.id === activeDashboardId) || dashboards[0];
    return dashboard;
  }, [dashboards, activeDashboardId]);

  const { handleSheetChange, handleSaveSheet } = useSheets(sheets, setSheets, activeSheetName);

  // Get headers directly from active sheet
  const resolvedHeaders = useMemo(() => {
    return (activeSheet?.headers || []).map((header) => ({
      key: header.key,
      name: header.name,
      type: header.type,
      options: header.options || [],
      visible: header.visible !== false,
      hidden: header.hidden || false,
    }));
  }, [activeSheet]);

  const resolvedRows = useMemo(() => {
    return activeSheet?.rows?.map((rowId) => cards.find((card) => card.id === rowId) || {}) || [];
  }, [activeSheet, cards]);

  // Sync activeOption with route
  useEffect(() => {
    if (location.pathname === '/dashboard') {
      setActiveOption('dashboard');
    } else if (location.pathname === '/sheets') {
      setActiveOption('sheets');
    } else if (location.pathname === '/metrics') {
      setActiveOption('metrics');
    }
  }, [location.pathname]);

  const handlePinToggle = useCallback(
    (headerKey) => {
      setSheets((prevSheets) => ({
        ...prevSheets,
        allSheets: prevSheets.allSheets.map((sheet) =>
          sheet.sheetName === activeSheetName
            ? {
                ...sheet,
                pinnedHeaders: sheet.pinnedHeaders.includes(headerKey)
                  ? sheet.pinnedHeaders.filter((h) => h !== headerKey)
                  : [...sheet.pinnedHeaders, headerKey],
              }
            : sheet
        ),
      }));
    },
    [activeSheetName, setSheets]
  );

  const handleDeleteSheet = useCallback(
    (sheetName) => {
      setSheets((prev) => {
        const updatedAllSheets = prev.allSheets.filter((sheet) => sheet.sheetName !== sheetName);
        const updatedStructure = prev.structure
          .map((item) => {
            if (item.sheetName === sheetName) {
              return null;
            }
            if (item.folderName) {
              const updatedSheets = item.sheets.filter((s) => s !== sheetName);
              return { ...item, sheets: updatedSheets };
            }
            return item;
          })
          .filter((item) => item !== null);

        let newActiveSheet = updatedAllSheets[0]?.sheetName;
        if (updatedStructure.length > 0) {
          const firstItem = updatedStructure[0];
          newActiveSheet = firstItem.sheetName || updatedStructure[0].sheets?.[0] || null;
        }

        return {
          ...prev,
          allSheets: updatedAllSheets.map((sheet, index) => ({
            ...sheet,
            isActive: index === 0 && !newActiveSheet ? true : sheet.sheetName === newActiveSheet,
          })),
          structure: updatedStructure,
        };
      });
    },
    [setSheets]
  );

  const handleSheetSave = useCallback(
    (newSheetName, selectedHeaders) => {
      setSheets((prevSheets) => {
        const newSheetId = `sheet${prevSheets.allSheets.length + 1}`;
        const newSheet = {
          id: newSheetId,
          sheetName: newSheetName,
          headers: selectedHeaders.map((key) => {
            const header = prevSheets.allSheets
              .flatMap((sheet) => sheet.headers)
              .find((h) => h.key === key) || { key, name: key, type: 'text' };
            return {
              key: header.key,
              name: header.name,
              type: header.type,
              options: header.options || [],
              visible: true,
              hidden: false,
            };
          }),
          pinnedHeaders: [],
          rows: [],
          filters: {},
          isActive: true,
        };
        return {
          allSheets: [
            ...prevSheets.allSheets.map((sheet) => ({
              ...sheet,
              isActive: false,
            })),
            newSheet,
          ],
          structure: [...prevSheets.structure, { sheetName: newSheetName }],
        };
      });
      handleSheetChange(newSheetName);
    },
    [setSheets, handleSheetChange]
  );

  const handleFolderSave = useCallback(
    (newFolderName, selectedSheets) => {
      setSheets((prevSheets) => {
        const existingFolder = prevSheets.structure.find(
          (item) => item.folderName === newFolderName
        );
        if (existingFolder) {
          const existingSheets = existingFolder.sheets || [];
          const newSheets = selectedSheets.filter(
            (sheet) => !existingSheets.includes(sheet)
          );
          if (newSheets.length === 0) {
            return prevSheets;
          }
          return {
            ...prevSheets,
            structure: prevSheets.structure.map((item) =>
              item.folderName === newFolderName
                ? { ...item, sheets: [...existingSheets, ...newSheets] }
                : item
            ),
          };
        }
        return {
          ...prevSheets,
          structure: [
            ...prevSheets.structure,
            {
              folderName: newFolderName,
              sheets: selectedSheets,
            },
          ],
        };
      });
    },
    [setSheets]
  );

  const handleModalSave = useCallback(
    (modalType, data) => {
      switch (modalType) {
        case 'headers':
          break;
        case 'filter':
          if (data?.filterValues) {
            setSheets((prev) => ({
              ...prev,
              allSheets: prev.allSheets.map((sheet) =>
                sheet.sheetName === activeSheetName
                  ? { ...sheet, filters: { ...data.filterValues } }
                  : sheet
              ),
            }));
          }
          break;
        case 'sheet':
          if (data?.sheetName && data.currentHeaders) {
            setSheets((prev) => {
              const updatedSheets = {
                ...prev,
                allSheets: prev.allSheets.map((sheet) =>
                  sheet.sheetName === activeSheetName && isSheetModalEditMode
                    ? {
                        ...sheet,
                        sheetName: data.sheetName,
                        headers: data.currentHeaders.map((h) => ({
                          key: h.key,
                          name: h.name,
                          type: h.type,
                          options: h.options || [],
                          visible: h.visible,
                          hidden: h.hidden,
                        })),
                      }
                    : sheet
                ),
                structure: prev.structure.map((item) => {
                  if (item.sheetName === activeSheetName) {
                    return { sheetName: data.sheetName };
                  }
                  if (item.folderName) {
                    const updatedSheets = item.sheets.map((sheet) =>
                      sheet === activeSheetName ? data.sheetName : sheet
                    );
                    return { ...item, sheets: updatedSheets };
                  }
                  return item;
                }),
              };
              return updatedSheets;
            });
            handleSheetChange(data.sheetName);
          }
          break;
        case 'sheets':
          if (data?.newOrder) {
            setSheets((prev) => {
              const newStructure = [...data.newOrder];
              let newActiveSheetName = null;
              for (const item of newStructure) {
                if (item.sheetName) {
                  newActiveSheetName = item.sheetName;
                  break;
                } else if (item.folderName && item.sheets?.length > 0) {
                  newActiveSheetName = item.sheets[0];
                  break;
                }
              }
              const updatedSheets = {
                ...prev,
                structure: newStructure,
                allSheets: prev.allSheets.map((sheet) => ({
                  ...sheet,
                  isActive: sheet.sheetName === newActiveSheetName,
                })),
              };
              return updatedSheets;
            });
            if (data.newOrder[0]?.sheetName) {
              handleSheetChange(data.newOrder[0].sheetName);
            } else if (data.newOrder[0]?.folderName && data.newOrder[0].sheets?.length > 0) {
              handleSheetChange(data.newOrder[0].sheets[0]);
            }
          } else {
            console.warn('No newOrder provided for sheets modal');
          }
          break;
        case 'transport':
          if (data?.onComplete) {
            data.onComplete();
          }
          break;
        case 'cardsTemplate':
          if (data?.currentCardTemplates && Array.isArray(data.currentCardTemplates)) {
            setCardTemplates([...data.currentCardTemplates]);
          }
          break;
        case 'folderOperations':
          if (data?.tempData?.actions && Array.isArray(data.tempData.actions)) {
            setSheets((prev) => {
              let currentStructure = [...prev.structure];
              data.tempData.actions.forEach((actionData) => {
                if (actionData.action === 'removeSheets' && actionData.selectedSheets && actionData.folderName) {
                  const folder = currentStructure.find((item) => item.folderName === actionData.folderName);
                  const folderSheets = folder?.sheets || [];
                  const remainingSheets = folderSheets.filter(
                    (sheet) => !actionData.selectedSheets.includes(sheet)
                  );
                  const removedSheets = folderSheets.filter((sheet) =>
                    actionData.selectedSheets.includes(sheet)
                  );
                  const existingSheetNames = currentStructure
                    .filter((item) => item.sheetName)
                    .map((item) => item.sheetName);
                  const newSheetsToAdd = removedSheets.filter(
                    (sheetName) => !existingSheetNames.includes(sheetName)
                  );
                  currentStructure = [
                    ...currentStructure.filter((item) => item.folderName !== actionData.folderName),
                    { folderName: actionData.folderName, sheets: remainingSheets },
                    ...newSheetsToAdd.map((sheetName) => ({ sheetName })),
                  ];
                } else if (actionData.action === 'addSheets' && actionData.selectedSheets && actionData.folderName) {
                  const folder = currentStructure.find((item) => item.folderName === actionData.folderName);
                  const existingSheets = folder?.sheets || [];
                  const newSheets = actionData.selectedSheets.filter(
                    (sheet) => !existingSheets.includes(sheet)
                  );
                  if (newSheets.length > 0) {
                    currentStructure = currentStructure.map((item) =>
                      item.folderName === actionData.folderName
                        ? { ...item, sheets: [...existingSheets, ...newSheets] }
                        : item
                    );
                  }
                } else if (actionData.action === 'deleteFolder' && actionData.folderName) {
                  const folder = currentStructure.find((item) => item.folderName === actionData.folderName);
                  const folderSheets = folder?.sheets || [];
                  const existingSheetNames = currentStructure
                    .filter((item) => item.sheetName)
                    .map((item) => item.sheetName);
                  const newSheetsToAdd = folderSheets.filter(
                    (sheetName) => !existingSheetNames.includes(sheetName)
                  );
                  currentStructure = [
                    ...currentStructure.filter((item) => item.folderName !== actionData.folderName),
                    ...newSheetsToAdd.map((sheetName) => ({ sheetName })),
                  ];
                }
              });
              return { ...prev, structure: currentStructure };
            });
          } else if (data?.tempData?.action === 'deleteFolder' && data.tempData.folderName) {
            setSheets((prev) => {
              const folderSheets = prev.structure.find((item) => item.folderName === data.tempData.folderName)?.sheets || [];
              const existingSheetNames = prev.structure
                .filter((item) => item.sheetName)
                .map((item) => item.sheetName);
              const newSheetsToAdd = folderSheets.filter(
                (sheetName) => !existingSheetNames.includes(sheetName)
              );
              return {
                ...prev,
                structure: [
                  ...prev.structure.filter((item) => item.folderName !== data.tempData.folderName),
                  ...newSheetsToAdd.map((sheetName) => ({ sheetName })),
                ],
              };
            });
          }
          break;
        case 'widgetView':
          if (data?.action === 'deleteCategories' && data?.deletedCategories) {
            setMetrics((prev) =>
              prev.filter((category) => !data.deletedCategories.includes(category.category))
            );
          }
          break;
        case 'widgetSetup':
          if (!data?.updatedWidget || !data?.dashboardId) {
            console.error('Invalid widget data or dashboardId:', data);
            break;
          }
          setDashboards((prev) => {
            const newDashboards = prev.map((dashboard) =>
              dashboard.id === data.dashboardId
                ? {
                    ...dashboard,
                    dashboardWidgets: dashboard.dashboardWidgets.map((w) =>
                      w.id === data.updatedWidget.id ? { ...data.updatedWidget, dashboardId: data.dashboardId } : w
                    ),
                  }
                : dashboard
            );
            return newDashboards;
          });
          break;
        case 'metrics':
          if (data?.currentCategories) {
            setMetrics([...data.currentCategories]);
          }
          break;
        default:
          break;
      }
      setActiveModal(null);
      setEditMode(false);
      setSelectedTemplateIndex(null);
      setCurrentSectionIndex(null);
      setTempData({});
    },
    [
      setSheets,
      activeSheetName,
      isSheetModalEditMode,
      setCardTemplates,
      setEditMode,
      setSelectedTemplateIndex,
      setCurrentSectionIndex,
      setTempData,
      handleSheetChange,
      setDashboards,
      activeDashboard,
      setMetrics,
    ]
  );

  const handleModalClose = useCallback(
    (options = {}) => {
      if (activeModal?.type === 'folderOperations') {
        if (options.fromSave || options.fromDelete) {
          const modalData = {
            ...activeModal.data,
            tempData: options.tempData || activeModal.data.tempData || {},
          };
          handleModalSave('folderOperations', modalData);
        }
      } else if (options.fromSave && options.openWidgetSetup) {
        setActiveModal({
          type: 'widgetSetup',
          data: {
            widget: options.openWidgetSetup.widget,
            updatedWidget: {
              ...options.openWidgetSetup.widget,
              title: options.openWidgetSetup.widget.title || '',
              metricId: options.openWidgetSetup.metric?.id || null,
            },
            category: options.openWidgetSetup.widget.title || null,
            metric: options.openWidgetSetup.metric?.id || null,
            dashboardId: options.openWidgetSetup.widget.dashboardId || activeDashboard.id,
            initialStep: 1,
          },
        });
        widgetSetupModal.open();
      } else if (activeModal?.type !== 'widgetView' && activeModal?.data) {
        if (!options.animationComplete) {
          handleModalSave(activeModal.type, activeModal.data);
        }
      }
      setActiveModal(null);
      setEditMode(false);
      setSelectedTemplateIndex(null);
      setCurrentSectionIndex(null);
      sheetModal.close();
      filterModal.close();
      sheetsModal.close();
      transportModal.close();
      cardsTemplateModal.close();
      sheetFolderModal.close();
      folderOperationsModal.close();
      widgetSizeModal.close();
      widgetViewModal.close();
      widgetSetupModal.close();
      metricsModal.close();
    },
    [
      activeModal,
      handleModalSave,
      setEditMode,
      setSelectedTemplateIndex,
      setCurrentSectionIndex,
      sheetModal,
      filterModal,
      sheetsModal,
      transportModal,
      cardsTemplateModal,
      sheetFolderModal,
      folderOperationsModal,
      widgetSizeModal,
      widgetViewModal,
      widgetSetupModal,
      metricsModal,
      activeDashboard,
    ]
  );

  const onEditSheet = useCallback(
    () => {
      setIsSheetModalEditMode(true);
      setActiveModal({
        type: 'sheet',
        data: {
          sheetName: activeSheetName,
          currentHeaders: resolvedHeaders,
          rows: activeSheet?.rows || [],
        },
      });
      sheetModal.open();
    },
    [sheetModal, activeSheetName, resolvedHeaders, activeSheet]
  );

  const onFilter = useCallback(
    () => {
      setActiveModal({ type: 'filter', data: { filterValues: activeSheet?.filters || {} } });
      filterModal.open();
    },
    [filterModal, activeSheet]
  );

  const onManageMetrics = useCallback(
    () => {
      setActiveModal({ type: 'metrics', data: { currentCategories: [...metrics] } });
      metricsModal.open();
    },
    [metricsModal, metrics]
  );

  const onOpenSheetsModal = useCallback(
    () => {
      setActiveModal({ type: 'sheets', data: { newOrder: [...sheets.structure] } });
      sheetsModal.open();
    },
    [sheetsModal, sheets]
  );

  const onOpenTransportModal = useCallback(
    (action, selectedRowIds, onComplete) => {
      setActiveModal({ type: 'transport', data: { action, selectedRowIds, onComplete } });
      transportModal.open();
    },
    [transportModal]
  );

  const onOpenCardsTemplateModal = useCallback(
    () => {
      setEditMode(false);
      setActiveModal({ type: 'cardsTemplate', data: { currentCardTemplates: [...cardTemplates] } });
      cardsTemplateModal.open();
    },
    [cardsTemplateModal, setEditMode, cardTemplates]
  );

  const onOpenSheetFolderModal = useCallback(
    () => {
      setActiveModal({
        type: 'sheetFolder',
        data: {
          sheets,
          handleSheetSave,
          handleFolderSave,
        },
      });
      sheetFolderModal.open();
    },
    [sheetFolderModal, sheets, handleSheetSave, handleFolderSave]
  );

  const onOpenFolderOperationsModal = useCallback(
    (folderName) => {
      setActiveModal({
        type: 'folderOperations',
        data: { folderName, tempData: {} },
      });
      folderOperationsModal.open();
    },
    [folderOperationsModal]
  );

  const handleWidgetClick = useCallback(
    ({ type, widget, metric, initialStep }) => {
      if (!widget.dashboardId) {
        console.warn('Widget missing dashboardId:', widget);
        return;
      }
      if (type === 'widgetSetup') {
        setActiveModal({
          type: 'widgetSetup',
          data: {
            widget: { ...widget },
            updatedWidget: {
              ...widget,
              title: widget.title || '',
              metricId: widget.metricId || null,
            },
            category: widget.title || null,
            metric: widget.metricId || null,
            dashboardId: widget.dashboardId || activeDashboard.id,
            initialStep: initialStep || 1,
          },
        });
        widgetSetupModal.open();
      } else if (type === 'metric') {
        const categoryObj = metrics.find((cat) =>
          cat.metrics.some((m) => m.id === metric.id)
        );
        if (!categoryObj) {
          console.warn('Category not found for metric:', metric);
          return;
        }
        setSelectedMetricData({
          category: categoryObj,
          metric: { ...metric },
        });
        setActiveOption('metrics');
        navigate('/metrics');
      }
    },
    [widgetSetupModal, activeDashboard, metrics, setActiveOption, setSelectedMetricData, navigate]
  );

  const handleMetricDataChange = useCallback(
    (newMetricData) => {
      setSelectedMetricData(newMetricData);
    },
    [setSelectedMetricData]
  );

  const handleOpenProfileModal = useCallback(() => {
    setIsProfileModalOpen(true);
  }, []);

  const handleCloseProfileModal = useCallback(() => {
    setIsProfileModalOpen(false);
  }, []);

  const handleDashboardChange = useCallback(
    (dashboardId) => {
      setActiveDashboardId(dashboardId);
    },
    []
  );

  useEffect(() => {
    if (activeOption !== 'metrics') {
      setSelectedMetricData(null);
    }
  }, [activeOption]);

  const renderModalContent = () => {
    if (!activeModal) return null;
    const setActiveModalData = (newData) =>
      setActiveModal((prev) => (prev ? { ...prev, data: { ...prev.data, ...newData } } : prev));

    switch (activeModal.type) {
      case 'sheet':
        return (
          <EditSheetsModal
            isEditMode={isSheetModalEditMode}
            tempData={
              activeModal.data || {
                sheetName: isSheetModalEditMode ? activeSheetName : '',
                currentHeaders: resolvedHeaders,
                rows: activeSheet?.rows || [],
              }
            }
            setTempData={setActiveModalData}
            sheets={sheets}
            onPinToggle={handlePinToggle}
            onDeleteSheet={handleDeleteSheet}
            handleClose={handleModalClose}
          />
        );
      case 'filter':
        return (
          <FilterModal
            headers={resolvedHeaders}
            rows={resolvedRows}
            tempData={activeModal.data || { filterValues: activeSheet?.filters || {} }}
            setTempData={setActiveModalData}
            handleClose={handleModalClose}
          />
        );
      case 'sheets':
        return (
          <ReOrderModal
            sheets={sheets || { structure: [] }}
            tempData={activeModal.data || { newOrder: [...sheets.structure] }}
            setTempData={setActiveModalData}
            handleClose={handleModalClose}
          />
        );
      case 'transport':
        return (
          <TransportModal
            tempData={activeModal.data || { action: 'copy', selectedRowIds: [], onComplete: null }}
            handleClose={handleModalClose}
          />
        );
      case 'cardsTemplate':
        return (
          <CardsTemplate
            tempData={activeModal.data || { currentCardTemplates: [...cardTemplates] }}
            setTempData={setActiveModalData}
            handleClose={handleModalClose}
          />
        );
      case 'sheetFolder':
        return (
          <CreateSheetsAndFolders
            tempData={activeModal.data || { sheets }}
            setTempData={setActiveModalData}
            sheets={sheets}
            setSheets={setSheets}
            cardTemplates={cardTemplates}
            onSheetChange={handleSheetChange}
            handleSheetSave={handleSheetSave}
            handleFolderSave={handleFolderSave}
            handleClose={handleModalClose}
          />
        );
      case 'folderOperations':
        return (
          <FolderOperations
            folderName={activeModal.data.folderName}
            onSheetSelect={handleSheetChange}
            handleClose={handleModalClose}
            tempData={activeModal.data.tempData || {}}
            setTempData={(newData) =>
              setActiveModal((prev) =>
                prev ? { ...prev, data: { ...prev.data, tempData: newData } } : prev
              )
            }
          />
        );
      case 'widgetSize':
        return (
          <WidgetSizeModal
            handleClose={handleModalClose}
            onSelectSize={() => {}}
          />
        );
      case 'widgetView':
        return (
          <MetricsCategories
            widget={activeModal.data?.widget}
            tempData={activeModal.data || { step: 1 }}
            setTempData={setActiveModalData}
            handleClose={handleModalClose}
          />
        );
      case 'widgetSetup':
        return (
          <WidgetSetupModal
            tempData={
              activeModal.data || {
                widget: activeModal.data?.widget || {},
                category: null,
                metric: null,
                dashboardId: activeDashboard.id,
              }
            }
            setTempData={setActiveModalData}
            setActiveModalData={setActiveModalData}
            handleClose={handleModalClose}
          />
        );
      case 'metrics':
        return (
          <MetricsModal
            tempData={activeModal.data || { currentCategories: [...metrics] }}
            setTempData={setActiveModalData}
            handleClose={handleModalClose}
          />
        );
      default:
        return null;
    }
  };

  // Determine if AppHeader should be shown
  const showHeader = !['/signin', '/signup'].includes(location.pathname);

  return (
    <div className={`${styles.appContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
      {showHeader && (
        <AppHeader
          sheets={(sheets?.structure || []).map((item) => item.sheetName || item.folderName)}
          activeSheet={activeSheetName}
          onSheetChange={handleSheetChange}
          setIsProfileModalOpen={handleOpenProfileModal}
          activeOption={activeOption}
          setActiveOption={setActiveOption}
          onOpenFolderModal={onOpenFolderOperationsModal}
          onOpenMetricsModal={onManageMetrics}
        />
      )}
      <div className={styles.contentWrapper}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={
              <Dashboard
                onWidgetClick={handleWidgetClick}
                activeDashboardId={activeDashboardId}
                onDashboardChange={handleDashboardChange}
              />
            }
          />
          <Route
            path="/sheets"
            element={
              <Sheets
                headers={resolvedHeaders}
                rows={resolvedRows}
                sheets={sheets}
                setSheets={setSheets}
                activeSheetName={activeSheetName}
                onSheetChange={handleSheetChange}
                onEditSheet={onEditSheet}
                onFilter={onFilter}
                onRowClick={() => {}}
                onCardSave={() => {}}
                onCardDelete={() => {}}
                onOpenSheetsModal={onOpenSheetsModal}
                onOpenTransportModal={onOpenTransportModal}
                onOpenSheetFolderModal={onOpenSheetFolderModal}
                onOpenFolderModal={onOpenFolderOperationsModal}
              />
            }
          />
          <Route
            path="/metrics"
            element={
              <Metrics
                selectedMetricData={selectedMetricData}
                onEditMetrics={onManageMetrics}
                onMetricDataChange={handleMetricDataChange}
              />
            }
          />
          {/* Placeholder routes for signin/signup */}
          <Route path="/signin" element={<div>Sign In (To be implemented)</div>} />
          <Route path="/signup" element={<div>Sign Up (To be implemented)</div>} />
        </Routes>
        {activeModal && (
          <Modal
            onClose={handleModalClose}
            onSave={() => handleModalSave(activeModal.type, activeModal.data)}
            modalType={activeModal.type}
            tempData={activeModal.data}
          >
            {renderModalContent()}
          </Modal>
        )}
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={handleCloseProfileModal}
          onOpenCardsTemplateModal={onOpenCardsTemplateModal}
          onOpenMetricsModal={onManageMetrics}
        />
      </div>
    </div>
  );
}

App.propTypes = {};

export default App;