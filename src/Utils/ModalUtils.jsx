// src/utils/modal/modalUtils.js
import React from 'react';
import EditSheetsModal from '../Modal/Edit Sheets Modal/EditSheetsModal';
import FilterModal from '../Modal/FilterModal/FilterModal';
import ReOrderModal from '../Modal/Re Order Modal/ReOrderModal';
import TransportModal from '../Modal/Cards Transportaion Modal/TransportModal';
import CardsTemplate from '../Modal/Cards Template/CardsTemplate';
import CreateSheetsAndFolders from '../Modal/Create Sheets And Folders/CreateSheetsAndFolders';
import FolderOperations from '../Modal/Folder Modal/FolderModal';
import WidgetSizeModal from '../Modal/WidgetSizeModal/WidgetSizeModal';
import MetricsCategories from '../Metrics/MetricsEdit/MetricsEdit';
import WidgetSetupModal from '../Dashboard/WidgetSetupModal/WidgetSetupModal';
import MetricsModal from '../Modal/MetricsModal/MetricsModal';

export const handleModalSave = ({
  modalType,
  data,
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
  sheets,
  metrics,
  dashboards,
  setActiveModal,
}) => {
  switch (modalType) {
    case 'headers':
      break;
    case 'filter':
      if (data?.filterValues && sheets) {
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
      if (data?.sheetName && data.currentHeaders && sheets) {
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
      if (data?.newOrder && sheets) {
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
      if (data?.action === 'deleteCategories' && data?.deletedCategories && metrics) {
        setMetrics((prev) =>
          prev.filter((category) => !data.deletedCategories.includes(category.category))
        );
      }
      break;
    case 'widgetSetup':
      if (!data?.updatedWidget || !data?.dashboardId || !dashboards) {
        console.error('Invalid widget data or dashboardId:', data);
        break;
      }
      setDashboards((prev) => {
        const targetDashboard = prev.find((d) => d.id === data.dashboardId);
        if (!targetDashboard) {
          console.error('Dashboard not found:', data.dashboardId);
          return prev;
        }
        const widgetExists = targetDashboard.dashboardWidgets.some(
          (w) => w.id === data.updatedWidget.id
        );
        const newDashboards = prev.map((dashboard) => {
          if (dashboard.id !== data.dashboardId) return dashboard;
          if (widgetExists) {
            // Update existing widget
            return {
              ...dashboard,
              dashboardWidgets: dashboard.dashboardWidgets.map((w) =>
                w.id === data.updatedWidget.id
                  ? { ...data.updatedWidget, dashboardId: data.dashboardId }
                  : w
              ),
            };
          } else {
            // Add new widget
            return {
              ...dashboard,
              dashboardWidgets: [
                ...dashboard.dashboardWidgets,
                { ...data.updatedWidget, dashboardId: data.dashboardId },
              ],
            };
          }
        });
        return newDashboards;
      });
      break;
    case 'metrics':
      if (data?.currentCategories && metrics) {
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
};

export const handleModalClose = ({
  options = {},
  activeModal,
  handleModalSave,
  setEditMode,
  setSelectedTemplateIndex,
  setCurrentSectionIndex,
  setActiveModal,
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
}) => {
  if (activeModal?.type === 'folderOperations') {
    if (options.fromSave || options.fromDelete) {
      const modalData = {
        ...activeModal.data,
        tempData: options.tempData || activeModal.data.tempData || {},
      };
      handleModalSave({ modalType: 'folderOperations', data: modalData });
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
        dashboardId: options.openWidgetSetup.widget.dashboardId || activeDashboard?.id,
        initialStep: 1,
      },
    });
    widgetSetupModal.open();
  } else if (activeModal?.type !== 'widgetView' && activeModal?.data) {
    if (options.fromSave) {
      // Call handleModalSave for save actions, regardless of animationComplete
      handleModalSave({ modalType: activeModal.type, data: activeModal.data });
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
};

export const renderModalContent = ({
  activeModal,
  setActiveModal,
  isSheetModalEditMode,
  activeSheetName,
  resolvedHeaders,
  activeSheet,
  sheets,
  handlePinToggle,
  handleDeleteSheet,
  handleModalClose,
  resolvedRows,
  cardTemplates,
  handleSheetChange,
  handleSheetSave,
  handleFolderSave,
  setSheets,
  activeDashboard,
  metrics,
}) => {
  if (!activeModal) return null;
  const setActiveModalData = (newData) =>
    setActiveModal((prev) =>
      prev ? { ...prev, data: { ...prev.data, ...newData } } : prev
    );

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
          tempData={
            activeModal.data || { filterValues: activeSheet?.filters || {} }
          }
          setTempData={setActiveModalData}
          handleClose={handleModalClose}
        />
      );
    case 'sheets':
      return (
        <ReOrderModal
          sheets={sheets || { structure: [] }}
          tempData={activeModal.data || { newOrder: [...(sheets?.structure || [])] }}
          setTempData={setActiveModalData}
          handleClose={handleModalClose}
        />
      );
    case 'transport':
      return (
        <TransportModal
          tempData={
            activeModal.data || {
              action: 'copy',
              selectedRowIds: [],
              onComplete: null,
            }
          }
          handleClose={handleModalClose}
        />
      );
    case 'cardsTemplate':
      return (
        <CardsTemplate
          tempData={
            activeModal.data || { currentCardTemplates: [...(cardTemplates || [])] }
          }
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
    // Update in src/utils/modal/modalUtils.js Miss to match previous version
    case 'widgetSetup':
      return (
        <WidgetSetupModal
          tempData={
            activeModal.data || {
              widget: activeModal.data?.widget || {},
              category: null,
              metric: null,
              dashboardId: activeDashboard?.id,
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
          tempData={
            activeModal.data || { currentCategories: [...(metrics || [])] }
          }
          setTempData={setActiveModalData}
          handleClose={handleModalClose}
        />
      );
    default:
      return null;
  }
};

export const onEditSheet = ({
  sheets,
  setIsSheetModalEditMode,
  setActiveModal,
  sheetModal,
  activeSheetName,
  resolvedHeaders,
  activeSheet,
}) => {
  if (!sheets) return;
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
};

export const onFilter = ({ sheets, setActiveModal, filterModal, activeSheet }) => {
  if (!sheets) return;
  setActiveModal({
    type: 'filter',
    data: { filterValues: activeSheet?.filters || {} },
  });
  filterModal.open();
};

export const onManageMetrics = ({ metrics, setActiveModal, metricsModal }) => {
  if (!metrics) return;
  setActiveModal({
    type: 'metrics',
    data: { currentCategories: [...metrics] },
  });
  metricsModal.open();
};

export const onOpenSheetsModal = ({ sheets, setActiveModal, sheetsModal }) => {
  if (!sheets) return;
  setActiveModal({
    type: 'sheets',
    data: { newOrder: [...sheets.structure] },
  });
  sheetsModal.open();
};

export const onOpenTransportModal = ({
  action,
  selectedRowIds,
  onComplete,
  setActiveModal,
  transportModal,
}) => {
  setActiveModal({
    type: 'transport',
    data: { action, selectedRowIds, onComplete },
  });
  transportModal.open();
};

export const onOpenCardsTemplateModal = ({
  cardTemplates,
  setEditMode,
  setActiveModal,
  cardsTemplateModal,
}) => {
  if (!cardTemplates) return;
  setEditMode(false);
  setActiveModal({
    type: 'cardsTemplate',
    data: { currentCardTemplates: [...cardTemplates] },
  });
  cardsTemplateModal.open();
};

export const onOpenSheetFolderModal = ({
  sheets,
  setActiveModal,
  sheetFolderModal,
  handleSheetSave,
  handleFolderSave,
}) => {
  if (!sheets) return;
  setActiveModal({
    type: 'sheetFolder',
    data: {
      sheets,
      handleSheetSave,
      handleFolderSave,
    },
  });
  sheetFolderModal.open();
};

export const onOpenFolderOperationsModal = ({
  folderName,
  sheets,
  setActiveModal,
  folderOperationsModal,
}) => {
  if (!sheets) return;
  setActiveModal({
    type: 'folderOperations',
    data: { folderName, tempData: {} },
  });
  folderOperationsModal.open();
};