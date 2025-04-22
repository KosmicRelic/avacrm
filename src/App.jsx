import React, { useState, useCallback, useMemo, useContext } from 'react';
import PropTypes from 'prop-types';
import Sheets from './Sheets/Sheets';
import AppHeader from './App Header/AppHeader';
import FilterModal from './Modal/FilterModal/FilterModal';
import HeadersModal from './Modal/HeadersModal/HeaderModal';
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
import MetricsCategories from './Dashboard/MetricsCategories/MetricsCategories';
import WidgetSetupModal from './Dashboard/WidgetSetupModal/WidgetSetupModal';

function App() {
  const {
    sheets,
    setSheets,
    cards,
    setCards,
    headers,
    setHeaders,
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
  } = useContext(MainContext);

  const sheetModal = useModal();
  const filterModal = useModal();
  const headersModal = useModal();
  const sheetsModal = useModal();
  const transportModal = useModal();
  const cardsTemplateModal = useModal();
  const sheetFolderModal = useModal();
  const folderOperationsModal = useModal();
  const widgetSizeModal = useModal();
  const widgetViewModal = useModal();
  const widgetSetupModal = useModal();
  const [isSheetModalEditMode, setIsSheetModalEditMode] = useState(false);
  const [activeOption, setActiveOption] = useState('dashboard');
  const [activeModal, setActiveModal] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [activeDashboardId, setActiveDashboardId] = useState(dashboards[0]?.id || 'dashboard-1');

  const activeSheet = useMemo(() => sheets?.allSheets?.find((sheet) => sheet.isActive) || null, [sheets]);
  const activeSheetName = activeSheet?.sheetName;

  const activeDashboard = useMemo(() => {
    const dashboard = dashboards.find((d) => d.id === activeDashboardId) || dashboards[0];
    return dashboard;
  }, [dashboards, activeDashboardId]);

  const { handleSheetChange, handleSaveSheet } = useSheets(sheets, setSheets, activeSheetName);

  const resolvedHeaders = useMemo(() => {
    return activeSheet?.headers?.map((sheetHeader) => {
      const header = (headers || []).find((h) => h.key === sheetHeader.key);
      return header
        ? { key: sheetHeader.key, name: header.name, type: header.type, visible: sheetHeader.visible, hidden: sheetHeader.hidden }
        : { key: sheetHeader.key, name: sheetHeader.key, type: 'text', visible: sheetHeader.visible, hidden: sheetHeader.hidden };
    }) || [];
  }, [activeSheet, headers]);

  const resolvedRows = useMemo(() => {
    return activeSheet?.rows?.map((rowId) => cards.find((card) => card.id === rowId) || {}) || [];
  }, [activeSheet, cards]);

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
              return updatedSheets.length > 0 ? { ...item, sheets: [...updatedSheets] } : null;
            }
            return { ...item };
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
          structure: [...updatedStructure],
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
          headers: selectedHeaders.map((key) => ({
            key,
            visible: true,
            hidden: false,
          })),
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
      setSheets((prevSheets) => ({
        ...prevSheets,
        structure: [
          ...prevSheets.structure,
          {
            folderName: newFolderName,
            sheets: selectedSheets,
          },
        ],
      }));
    },
    [setSheets]
  );

  const handleModalSave = useCallback(
    (modalType, data) => {
      switch (modalType) {
        case 'headers':
          if (data?.currentHeaders) {
            setHeaders([...data.currentHeaders]);
          }
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
            handleSaveSheet(
              data.sheetName,
              data.currentHeaders,
              activeSheet?.pinnedHeaders || [],
              isSheetModalEditMode
            );
            handleSheetChange(data.sheetName);
          }
          break;
        case 'sheets':
          if (data?.newOrder) {
            setSheets((prev) => ({
              ...prev,
              structure: [...data.newOrder],
            }));
          }
          break;
        case 'cardsTemplate':
          if (data?.currentCardTemplates && Array.isArray(data.currentCardTemplates)) {
            setCardTemplates([...data.currentCardTemplates]);
          }
          break;
        case 'folderOperations':
          if (data?.tempData?.action === 'removeSheets' && data.tempData.selectedSheets && data.tempData.folderName) {
            setSheets((prev) => {
              const folder = prev.structure.find((item) => item.folderName === data.tempData.folderName);
              const folderSheets = folder?.sheets || [];
              const remainingSheets = folderSheets.filter(
                (sheet) => !data.tempData.selectedSheets.includes(sheet)
              );
              const removedSheets = folderSheets.filter((sheet) =>
                data.tempData.selectedSheets.includes(sheet)
              );
              const newStructure = [
                ...prev.structure.filter((item) => item.folderName !== data.tempData.folderName),
                { folderName: data.tempData.folderName, sheets: remainingSheets },
                ...removedSheets.map((sheetName) => ({ sheetName })),
              ];
              return {
                ...prev,
                structure: newStructure,
              };
            });
          } else if (data?.tempData?.action === 'deleteFolder' && data.tempData.folderName) {
            setSheets((prev) => {
              const folderSheets = prev.structure.find((item) => item.folderName === data.tempData.folderName)?.sheets || [];
              const newStructure = [
                ...prev.structure.filter((item) => item.folderName !== data.tempData.folderName),
                ...folderSheets.map((sheetName) => ({ sheetName })),
              ];
              return {
                ...prev,
                structure: newStructure,
              };
            });
          }
          break;
        case 'widgetView':
          if (data?.updatedWidget && data?.dashboardId) {
            setDashboards((prev) => {
              const newDashboards = prev.map((dashboard) =>
                dashboard.id === data.dashboardId
                  ? {
                      ...dashboard,
                      dashboardWidgets: dashboard.dashboardWidgets.map((w) =>
                        w.id === data.updatedWidget.id ? { ...data.updatedWidget } : w
                      ),
                    }
                  : dashboard
              );
              return newDashboards;
            });
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
                      w.id === data.updatedWidget.id ? { ...data.updatedWidget } : w
                    ),
                  }
                : dashboard
            );
            return newDashboards;
          });
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
      setHeaders,
      setSheets,
      handleSaveSheet,
      activeSheetName,
      activeSheet,
      isSheetModalEditMode,
      setCardTemplates,
      setEditMode,
      setSelectedTemplateIndex,
      setCurrentSectionIndex,
      setTempData,
      handleSheetChange,
      setDashboards,
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

  const onManageHeaders = useCallback(
    () => {
      setActiveModal({ type: 'headers', data: { currentHeaders: [...headers] } });
      headersModal.open();
    },
    [headersModal, headers]
  );

  const onOpenSheetsModal = useCallback(
    () => {
      setActiveModal({ type: 'sheets', data: { newOrder: sheets?.structure || [] } });
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
          headers,
          handleSheetSave,
          handleFolderSave,
        },
      });
      sheetFolderModal.open();
    },
    [sheetFolderModal, sheets, headers, handleSheetSave, handleFolderSave]
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
    ({ type, widget, metric, step }) => {
      if (type === 'widgetSetup') {
        setActiveModal({
          type: 'widgetSetup',
          data: {
            widget: { ...widget },
            category: widget.category || null,
            metric: widget.metrics?.[0]?.id || null,
            dashboardId: widget.dashboardId || activeDashboard.id,
          },
        });
        widgetSetupModal.open();
      } else if (type === 'category') {
        setActiveModal({
          type: 'widgetView',
          data: { widget, selectedMetric: null, step: step || 1, dashboardId: widget.dashboardId || activeDashboard.id },
        });
        widgetViewModal.open();
      } else if (type === 'metric') {
        setActiveModal({
          type: 'widgetView',
          data: { widget, selectedMetric: metric, step: step || 2, dashboardId: widget.dashboardId || activeDashboard.id },
        });
        widgetViewModal.open();
      }
    },
    [widgetViewModal, widgetSetupModal, activeDashboard]
  );

  const handleModalClose = useCallback(
    (options = {}) => {
      if (options.fromDelete && activeModal?.type === 'folderOperations' && activeModal?.data) {
        const dataToSave = {
          ...activeModal.data,
          tempData: options.tempData || activeModal.data.tempData,
        };
        handleModalSave(activeModal.type, dataToSave);
      } else if (!options.fromDelete && activeModal?.data && !options.fromSave) {
        handleModalSave(activeModal.type, activeModal.data);
      }
      setActiveModal(null);
      setEditMode(false);
      setSelectedTemplateIndex(null);
      setCurrentSectionIndex(null);
      sheetModal.close();
      filterModal.close();
      headersModal.close();
      sheetsModal.close();
      transportModal.close();
      cardsTemplateModal.close();
      sheetFolderModal.close();
      folderOperationsModal.close();
      widgetSizeModal.close();
      widgetViewModal.close();
      widgetSetupModal.close();
    },
    [
      activeModal,
      handleModalSave,
      setEditMode,
      setSelectedTemplateIndex,
      setCurrentSectionIndex,
      sheetModal,
      filterModal,
      headersModal,
      sheetsModal,
      transportModal,
      cardsTemplateModal,
      sheetFolderModal,
      folderOperationsModal,
      widgetSizeModal,
      widgetViewModal,
      widgetSetupModal,
    ]
  );

  const handleOpenProfileModal = useCallback(() => {
    setIsProfileModalOpen(true);
  }, []);

  const handleCloseProfileModal = useCallback(() => {
    setIsProfileModalOpen(false);
  }, []);

  const handleDashboardChange = useCallback((dashboardId) => {
    setActiveDashboardId(dashboardId);
  }, []);

  const renderModalContent = () => {
    if (!activeModal) {
      return null;
    }
    const setActiveModalData = (newData) =>
      setActiveModal((prev) => ({ ...prev, data: { ...prev.data, ...newData } }));

    switch (activeModal.type) {
      case 'sheet':
        return (
          <EditSheetsModal
            isEditMode={isSheetModalEditMode}
            tempData={activeModal.data || {
              sheetName: isSheetModalEditMode ? activeSheetName : '',
              currentHeaders: resolvedHeaders,
              rows: activeSheet?.rows || [],
            }}
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
      case 'headers':
        return (
          <HeadersModal
            tempData={activeModal.data || { currentHeaders: [...headers] }}
            setTempData={setActiveModalData}
            handleClose={handleModalClose}
          />
        );
      case 'sheets':
        return (
          <ReOrderModal
            sheets={sheets || { structure: [] }}
            tempData={activeModal.data || { newOrder: sheets?.structure || [] }}
            setTempData={setActiveModalData}
            handleClose={handleModalClose}
          />
        );
      case 'transport':
        return (
          <TransportModal
            tempData={
              activeModal.data || { action: 'copy', selectedRowIds: [], onComplete: null }
            }
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
            headers={headers}
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
              setActiveModal((prev) => ({
                ...prev,
                data: { ...prev.data, tempData: newData },
              }))
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
            tempData={activeModal.data || { widget: activeModal.data?.widget || {}, category: null, metric: null, dashboardId: activeDashboard.id }}
            setTempData={setActiveModalData}
            setActiveModalData={setActiveModalData}
            handleClose={handleModalClose}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.appContainer}>
      <AppHeader
        sheets={(sheets?.structure || []).map((item) => item.sheetName || item.folderName)}
        activeSheet={activeSheetName}
        onSheetChange={handleSheetChange}
        setIsProfileModalOpen={handleOpenProfileModal}
        activeOption={activeOption}
        setActiveOption={setActiveOption}
        onOpenFolderModal={onOpenFolderOperationsModal}
      />
      <div className={styles.contentWrapper}>
        {activeOption === 'sheets' && activeSheetName && (
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
        )}
        {activeOption === 'dashboard' && (
          <Dashboard
            onWidgetClick={handleWidgetClick}
            activeDashboardId={activeDashboardId}
            onDashboardChange={handleDashboardChange}
          />
        )}
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
          onOpenHeadersModal={onManageHeaders}
          setActiveOption={setActiveOption}
          onOpenCardsTemplateModal={onOpenCardsTemplateModal}
        />
      </div>
    </div>
  );
}

App.propTypes = {};

export default App;