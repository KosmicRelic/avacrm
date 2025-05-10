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
import { getFunctions, httpsCallable } from 'firebase/functions';
import { updateCardTemplatesAndCardsFunction } from '../Firebase/Firebase Functions/User Functions/updateCardTemplatesAndCardsFunction';

export const handleModalSave = async ({
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
  cardTemplates,
  businessId,
  cards,
  setCards,
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
              ? {
                  ...sheet,
                  filters: { ...data.filterValues },
                  isModified: true,
                  action: 'update',
                }
              : sheet
          ),
        }));
      }
      break;
    case 'sheet':
      if (data?.sheetName && data.currentHeaders && sheets) {
        // Clean cardTypeFilters to remove undefined values and empty filters
        const cleanedCardTypeFilters = {};
        Object.entries(data.cardTypeFilters || {}).forEach(([cardType, filters]) => {
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
                    typeOfCardsToDisplay: data.typeOfCardsToDisplay || [],
                    cardTypeFilters: cleanedCardTypeFilters, // Use cleaned filters
                    isModified: true,
                    action: 'update',
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
          if (activeSheetName !== data.sheetName) {
            updatedSheets.structure = { ...updatedSheets.structure, isModified: true, action: 'update' };
          }
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
            structure: Object.assign([...newStructure], { isModified: true, action: 'update' }),
            allSheets: prev.allSheets.map((sheet) => ({
              ...sheet,
              isActive: sheet.sheetName === newActiveSheetName,
            })),
          };
          return updatedSheets;
        });
        if (data.newOrder[0]?.sheetName) {
          handleSheetChange(data.newOrder[0].sheetName);
        } else if (data.newOrder[0]?.folderName && data.newOrder[0]?.sheets?.length > 0) {
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
    case 'cardsTemplate': {
      if (data?.currentCardTemplates && Array.isArray(data.currentCardTemplates)) {
        if (!businessId) {
          console.warn('Cannot update templates and cards: businessId is missing');
          alert('Error: Business ID is missing. Please ensure your account is properly configured.');
          return;
        }
    
        const updates = data.currentCardTemplates
          .map((newTemplate) => {
            const oldTemplate = cardTemplates.find((t) => t.docId === newTemplate.docId);
            if (!oldTemplate || !newTemplate.isModified) return null;
    
            const update = {
              docId: newTemplate.docId,
              typeOfCards: oldTemplate.typeOfCards,
            };
    
            if (
              newTemplate.action === 'update' &&
              oldTemplate.typeOfCards !== newTemplate.typeOfCards &&
              newTemplate.typeOfCards
            ) {
              update.newTypeOfCards = newTemplate.typeOfCards;
            }
    
            const oldKeys = oldTemplate.headers.map((h) => h.key);
            const newKeys = newTemplate.headers.map((h) => h.key);
            const deletedKeys = oldKeys.filter((key) => !newKeys.includes(key));
            if (deletedKeys.length > 0) {
              update.deletedKeys = deletedKeys;
            }
    
            if (newTemplate.action === 'add' || newTemplate.action === 'update') {
              update.newTemplate = {
                ...newTemplate,
                headers: newTemplate.headers,
                sections: newTemplate.sections,
                name: newTemplate.name || newTemplate.typeOfCards,
                typeOfCards: newTemplate.typeOfCards,
              };
            } else if (newTemplate.action === 'remove') {
              update.action = 'remove';
            }
    
            return Object.keys(update).length > 1 ? update : null;
          })
          .filter((update) => update !== null);
    
        try {
          if (updates.length > 0) {
            const result = await updateCardTemplatesAndCardsFunction({ businessId, updates });
    
            if (!result.success) {
              throw new Error(result.error || 'Failed to update templates and cards');
            }
    
            setCardTemplates([...data.currentCardTemplates]);
    
            const updatedCards = cards.map((card) => {
              const matchingUpdate = updates.find((update) => update.typeOfCards === card.typeOfCards);
              if (!matchingUpdate) return card;
    
              let updatedCard = { ...card };
    
              if (matchingUpdate.newTypeOfCards) {
                updatedCard.typeOfCards = matchingUpdate.newTypeOfCards;
              }
    
              if (matchingUpdate.deletedKeys && matchingUpdate.deletedKeys.length > 0) {
                matchingUpdate.deletedKeys.forEach((key) => {
                  if (key in updatedCard) {
                    delete updatedCard[key];
                  }
                });
              }
    
              return updatedCard;
            });
    
            setCards(updatedCards);
          }
        } catch (error) {
          console.error('Error updating templates and cards:', error);
          alert(`Failed to update card templates. Error: ${error.message}`);
          return;
        }
      } else {
        console.warn('Invalid or missing currentCardTemplates:', data?.currentCardTemplates);
      }
      break;
    }
    case 'folderOperations':
      if (data?.tempData?.actions && Array.isArray(data.tempData.actions)) {
        setSheets((prev) => {
          let currentStructure = [...prev.structure];
          const modifiedSheets = new Set();
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
              folderSheets.forEach((sheetName) => modifiedSheets.add(sheetName));
            }
          });
          return {
            ...prev,
            structure: [...currentStructure],
            allSheets: prev.allSheets.map((sheet) =>
              modifiedSheets.has(sheet.sheetName)
                ? { ...sheet, isModified: true, action: 'update' }
                : sheet
            ),
          };
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
            allSheets: prev.allSheets.map((sheet) =>
              folderSheets.includes(sheet.sheetName)
                ? { ...sheet, isModified: true, action: 'update' }
                : sheet
            ),
          };
        });
      }
      break;
    case 'folderModal':
      console.log('Saving folderModal, no action needed');
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
          const updatedWidgets = widgetExists
            ? dashboard.dashboardWidgets.map((w) =>
                w.id === data.updatedWidget.id
                  ? { ...data.updatedWidget, dashboardId: data.dashboardId }
                  : w
              )
            : [...dashboard.dashboardWidgets, { ...data.updatedWidget, dashboardId: data.dashboardId }];
          return {
            ...dashboard,
            dashboardWidgets: updatedWidgets,
            isModified: true,
            action: dashboard.action || 'update',
          };
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
  folderModal,
}) => {
  if (activeModal?.type === 'folderOperations') {
    if (options.fromSave || options.fromDelete) {
      const modalData = {
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
    // When EditSheetsModal closes with fromSave: true, this triggers handleModalSave for 'sheet'
    if (options.fromSave) {
      handleModalSave({ modalType: activeModal.type, data: activeModal.data });
    }
  }
  console.log('Closing modals, activeModal:', activeModal?.type);
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
  folderModal?.close();
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
  businessId,
}) => {
  if (!activeModal) return null;
  const setActiveModalData = (newData) =>
    setActiveModal((prev) =>
      prev ? { ...prev, data: { ...prev.data, ...newData } } : prev
    );

  switch (activeModal.type) {
    case 'sheet':
      // Renders EditSheetsModal with tempData including cardTypeFilters
      return (
        <EditSheetsModal
          isEditMode={isSheetModalEditMode}
          tempData={
            activeModal.data || {
              sheetName: isSheetModalEditMode ? activeSheetName : '',
              currentHeaders: resolvedHeaders,
              rows: activeSheet?.rows || [],
              typeOfCardsToDisplay: activeSheet?.typeOfCardsToDisplay || [],
              cardTypeFilters: activeSheet?.cardTypeFilters || {}, // Initialize with existing cardTypeFilters
            }
          }
          setTempData={setActiveModalData}
          sheets={sheets}
          onPinToggle={handlePinToggle}
          onDeleteSheet={handleDeleteSheet}
          handleClose={handleModalClose}
          setActiveSheetName={handleSheetChange}
          clearFetchedSheets={() => {}}
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
          businessId={businessId}
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
    case 'folderModal':
      return (
        <FolderOperations
          folderName={activeModal.data.folderName}
          onSheetSelect={activeModal.data.onSheetSelect}
          handleClose={activeModal.data.handleClose}
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
          onSelectSize={activeModal.data?.onSelectSize || (() => {})}
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
      typeOfCardsToDisplay: activeSheet?.typeOfCardsToDisplay || [],
      cardTypeFilters: activeSheet?.cardTypeFilters || {}, // Initialize with existing cardTypeFilters
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

export const onOpenFolderModal = ({
  folderName,
  sheets,
  setActiveModal,
  folderModal,
  onSheetSelect,
}) => {
  if (!sheets) return;
  console.log('Opening folderModal for:', folderName);
  setActiveModal({
    type: 'folderModal',
    data: {
      folderName,
      onSheetSelect,
      tempData: {},
      handleClose: () => {
        console.log('Closing folderModal');
        folderModal.close();
        setActiveModal(null);
      },
    },
  });
  folderModal.open();
};