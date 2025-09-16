import React from 'react';
import EditSheetsModal from '../Modal/Edit Sheets Modal/EditSheetsModal';
import FilterModal from '../Modal/FilterModal/FilterModal';
import ReOrderModal from '../Modal/Re Order Modal/ReOrderModal';
import TransportModal from '../Modal/Cards Transportaion Modal/TransportModal';
import CardsTemplate from '../Modal/Cards Template/CardsTemplate';
import CreateSheetsAndFolders from '../Modal/Create Sheets And Folders/CreateSheetsAndFolders';
import FolderModal from '../Modal/Folder Modal/FolderModal';
import WidgetSizeModal from '../Modal/WidgetSizeModal/WidgetSizeModal';
import MetricsCategories from '../Metrics/MetricsEdit/MetricsEdit';
import WidgetSetupModal from '../Dashboard/WidgetSetupModal/WidgetSetupModal';
import MetricsModal from '../Modal/MetricsModal/MetricsModal';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { updateCardTemplatesAndCardsFunction } from '../Firebase/Firebase Functions/User Functions/updateCardTemplatesAndCardsFunction';

// Utility function to recursively clean objects and arrays, converting undefined to null and removing null if desired
const cleanObject = (obj, convertUndefinedToNull = true) => {
  if (Array.isArray(obj)) {
    return obj
      .map((item) => cleanObject(item, convertUndefinedToNull))
      .filter((item) => item !== undefined); // Keep null if convertUndefinedToNull is true
  }
  if (obj && typeof obj === 'object') {
    const cleaned = {};
    Object.entries(obj).forEach(([key, value]) => {
      if (value === undefined && convertUndefinedToNull) {
        cleaned[key] = null; // Convert undefined to null
      } else if (value !== undefined) {
        const cleanedValue = cleanObject(value, convertUndefinedToNull);
        if (cleanedValue !== undefined) {
          cleaned[key] = cleanedValue;
        }
      }
    });
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }
  return obj;
};

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
              ? { ...sheet, filters: { ...data.filterValues } }
              : sheet
          ),
        }));
      }
      break;
    case 'sheet':
      if (data?.sheetName && data.currentHeaders && sheets) {
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
          // Update allSheets as before
          const updatedAllSheets = prev.allSheets.map((sheet) =>
            sheet.sheetName === activeSheetName
              ? {
                  ...sheet,
                  sheetName: data.sheetName,
                  headers: data.currentHeaders,
                  typeOfCardsToDisplay: data.typeOfCardsToDisplay || [],
                  cardTypeFilters: cleanedCardTypeFilters,
                  cardsPerSearch: data.cardsPerSearch ?? sheet.cardsPerSearch,
                  isModified: true,
                  action: 'update',
                }
              : sheet
          );

          // Update structure: replace old sheetName with new one, do not leave empty/null/empty string
          const updatedStructure = prev.structure.map((item) => {
            if (item.sheetName === activeSheetName) {
              return { sheetName: data.sheetName };
            }
            if (item.folderName && Array.isArray(item.sheets)) {
              // Replace old sheet name with new one, filter out empty/falsey
              const newSheets = item.sheets.map((s) => (s === activeSheetName ? data.sheetName : s)).filter((s) => !!s && typeof s === 'string' && s.trim() !== '');
              return { ...item, sheets: newSheets };
            }
            return item;
          }).filter(Boolean); // Remove any null/undefined

          return {
            ...prev,
            allSheets: updatedAllSheets,
            structure: updatedStructure,
          };
        });
        handleSheetChange(data.sheetName);
      } else {
        console.warn('Missing required data for sheet modal save:', {
          data,
          sheets,
        });
      }
      break;
    case 'sheets':
      if (data?.newOrder && sheets) {
        setSheets((prev) => {
          // Clean up newOrder: remove empty/falsey, empty string, and duplicate sheet names in folders
          const cleanStructure = (structure) => {
            const seenSheets = new Set();
            return structure
              .map((item) => {
                if (item.sheetName && typeof item.sheetName === 'string' && item.sheetName.trim() !== '') {
                  if (seenSheets.has(item.sheetName)) return null;
                  seenSheets.add(item.sheetName);
                  return { sheetName: item.sheetName };
                }
                if (item.folderName && Array.isArray(item.sheets)) {
                  // Remove empty/falsey/duplicate sheet names in folder
                  const cleanSheets = item.sheets.filter(
                    (s) => s && typeof s === 'string' && s.trim() !== '' && !seenSheets.has(s) && seenSheets.add(s)
                  );
                  return { folderName: item.folderName, sheets: cleanSheets };
                }
                return null;
              })
              .filter(Boolean);
          };

          const prevStructure = prev.structure || [];
          const newStructure = cleanStructure(data.newOrder);

          // Only update if structure actually changed
          if (JSON.stringify(prevStructure) !== JSON.stringify(newStructure)) {
            // Mark only changed sheets/folders as isModified for local state, but do not persist isModified to Firestore
            const prevFlat = JSON.stringify(prevStructure);
            const newFlat = JSON.stringify(newStructure);
            const allSheets = prev.allSheets.map((sheet) => {
              // If the sheet's position or folder changed, mark as isModified (for local, not for Firestore)
              const wasInFolder = prevStructure.some(
                (item) => item.folderName && item.sheets && item.sheets.includes(sheet.sheetName)
              );
              const isInFolder = newStructure.some(
                (item) => item.folderName && item.sheets && item.sheets.includes(sheet.sheetName)
              );
              if (prevFlat !== newFlat && (wasInFolder !== isInFolder)) {
                return { ...sheet, isModified: true };
              }
              return { ...sheet };
            });
            // Remove isModified before saving to Firestore
            const allSheetsNoIsModified = allSheets.map(({ isModified, ...rest }) => rest);
            return {
              ...prev,
              structure: newStructure,
              allSheets: allSheetsNoIsModified,
            };
          } else {
            // No change, return previous state
            return prev;
          }
        });
        // Set active sheet if needed
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
      case 'cardsTemplate':
      console.log('CardsTemplate modal save - received data:', data);
      if (data?.templateEntities && Array.isArray(data.templateEntities)) {
        // New entity-based system
        if (!businessId) {
          console.warn('Cannot update templates and cards: businessId is missing');
          alert('Error: Business ID is missing. Please ensure your account is properly configured.');
          return;
        }

        try {
          // Prepare entities with their templates 
          const entitiesWithTemplates = data.templateEntities.map(entity => {
            console.log('Processing entity:', entity.name, 'with stored templates:', entity.templates);
            console.log('Entity pipelines:', entity.pipelines);
            
            // Always use the current edited templates from currentCardTemplates 
            // as they reflect the user's latest changes, not the old database state
            const entityTemplates = (data.currentCardTemplates || []).filter(template => 
              template.entityId === entity.id && template.action !== "remove"
            ).map(template => {
              const { isModified, action, ...cleanTemplate } = template;
              return cleanTemplate;
            });            console.log('Using current edited templates from currentCardTemplates:', entityTemplates);
            
            console.log('Final templates for entity', entity.name, ':', entityTemplates);
            console.log('Including pipelines for entity', entity.name, ':', entity.pipelines);
            
            return {
              id: entity.id,
              name: entity.name,
              templates: entityTemplates,
              pipelines: entity.pipelines || []
            };
          });

          // Check if there are any actual changes before sending to backend
          const hasActualChanges = data.currentCardTemplates?.some(template => 
            template.isModified || template.action === 'add' || template.action === 'remove'
          ) || data.deletedHeaderKeys?.length > 0;

          if (!hasActualChanges) {
            console.log('[ModalUtils] No changes detected, skipping backend update');
            console.log('Template entities saved successfully (no changes)');
            return;
          }

          console.log('[ModalUtils] Changes detected, proceeding with backend update');

          const totalPipelines = entitiesWithTemplates.reduce((total, entity) => total + (entity.pipelines?.length || 0), 0);
          console.log(`Sending ${entitiesWithTemplates.length} entities with total ${totalPipelines} pipelines to backend`);
          console.log('Sending entities to backend:', { businessId, entities: entitiesWithTemplates });

          const result = await updateCardTemplatesAndCardsFunction({
            businessId,
            entities: entitiesWithTemplates,
          });

          if (!result.success) {
            throw new Error(result.error || 'Failed to update template entities');
          }

          // Update local state - flatten all templates from all entities
          const allTemplates = entitiesWithTemplates.flatMap(entity => 
            entity.templates || []
          );
          setCardTemplates(allTemplates);

          console.log('Template entities saved successfully');
        } catch (error) {
          console.error('Error updating template entities:', error);
          alert(`Failed to update template entities. Error: ${error.message}`);
          return;
        }
      } else if (data?.currentCardTemplates && Array.isArray(data.currentCardTemplates)) {
        // Fallback to legacy template handling for backward compatibility
        if (!businessId) {
          console.warn('Cannot update templates and cards: businessId is missing');
          alert('Error: Business ID is missing. Please ensure your account is properly configured.');
          return;
        }

        const updates = data.currentCardTemplates
          .map((newTemplate) => {
            const oldTemplate = cardTemplates.find((t) => t.docId === newTemplate.docId);
            // Allow new templates (action: 'add') even if oldTemplate is undefined
            if ((!oldTemplate && newTemplate.action !== 'add') || !newTemplate.isModified) return null;

            const update = {
              docId: newTemplate.docId,
              typeOfCards: newTemplate.typeOfCards,
            };

            if (newTemplate.action === 'add') {
              // For new templates, send the full template
              const { isModified, action, ...cleanTemplate } = newTemplate;
              update.newTemplate = {
                ...cleanTemplate,
                headers: cleanTemplate.headers,
                sections: cleanTemplate.sections,
                name: cleanTemplate.name || cleanTemplate.typeOfCards,
                typeOfCards: cleanTemplate.typeOfCards,
              };
              update.action = 'add';
            } else if (
              newTemplate.action === 'update' &&
              oldTemplate &&
              oldTemplate.typeOfCards !== newTemplate.typeOfCards &&
              newTemplate.typeOfCards
            ) {
              update.newTypeOfCards = newTemplate.typeOfCards;
            }

            if (oldTemplate) {
              const oldKeys = oldTemplate.headers.map((h) => h.key);
              const newKeys = newTemplate.headers.map((h) => h.key);
              const deletedKeys = oldKeys.filter((key) => !newKeys.includes(key));
              if (deletedKeys.length > 0) {
                update.deletedKeys = deletedKeys;
              }
            }

            if (newTemplate.action === 'update') {
              const { isModified, action, ...cleanTemplate } = newTemplate;
              update.newTemplate = {
                ...cleanTemplate,
                headers: cleanTemplate.headers,
                sections: cleanTemplate.sections,
                name: cleanTemplate.name || cleanTemplate.typeOfCards,
                typeOfCards: cleanTemplate.typeOfCards,
              };
            } else if (newTemplate.action === 'remove') {
              update.action = 'remove';
            }

            return Object.keys(update).length > 1 ? update : null;
          })
          .filter((update) => update !== null);

        try {
          if (updates.length > 0) {
            const result = await updateCardTemplatesAndCardsFunction({
              businessId,
              updates,
            });

            if (!result.success) {
              throw new Error(result.error || 'Failed to update templates and cards');
            }

            setCardTemplates(
              data.currentCardTemplates.map((template) => {
                const { isModified, action, ...cleanTemplate } = template;
                return cleanTemplate;
              })
            );

            const updatedCards = cards.map((card) => {
              const matchingUpdate = updates.find(
                (update) => update.typeOfCards === card.typeOfCards
              );
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

              const { isModified, action, ...cleanCard } = updatedCard;
              return cleanCard;
            });

            setCards(updatedCards);
          }
        } catch (error) {
          console.error('Error updating templates and cards:', error);
          alert(`Failed to update card templates. Error: ${error.message}`);
          return;
        }
      } else {
        console.warn('No template entities or card templates found to save. Data received:', {
          templateEntities: data?.templateEntities,
          currentCardTemplates: data?.currentCardTemplates,
          dataKeys: Object.keys(data || {})
        });
      }
      break;
    case 'folderModal':
      if (data?.tempData) {
        if (data.tempData.actions) {
        } else {
        }
        if (data.tempData.action) {
        }
      } else {
      }
      if (data?.tempData?.actions && Array.isArray(data.tempData.actions)) {
        setSheets((prev) => {
          let currentStructure = [...prev.structure];
          const modifiedSheets = new Set();
          data.tempData.actions.forEach((actionData, idx) => {
            if (
              actionData.action === 'removeSheets' &&
              actionData.selectedSheets &&
              actionData.folderName
            ) {
              const folder = currentStructure.find(
                (item) => item.folderName === actionData.folderName
              );
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
                ...currentStructure.filter(
                  (item) => item.folderName !== actionData.folderName
                ),
                { folderName: actionData.folderName, sheets: remainingSheets },
                ...newSheetsToAdd.map((sheetName) => ({ sheetName })),
              ];
              removedSheets.forEach((sheetName) => modifiedSheets.add(sheetName));
            } else if (
              actionData.action === 'addSheets' &&
              actionData.selectedSheets &&
              actionData.folderName
            ) {
              const folder = currentStructure.find(
                (item) => item.folderName === actionData.folderName
              );
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
                newSheets.forEach((sheetName) => modifiedSheets.add(sheetName));
              }
            } else if (
              actionData.action === 'deleteFolder' &&
              actionData.folderName
            ) {
              // Move all sheets out of the folder and delete the folder
              const folder = currentStructure.find(
                (item) => item.folderName === actionData.folderName
              );
              const folderSheets = folder?.sheets || [];
              const existingSheetNames = currentStructure
                .filter((item) => item.sheetName)
                .map((item) => item.sheetName);
              const newSheetsToAdd = folderSheets.filter(
                (sheetName) => !existingSheetNames.includes(sheetName)
              );
              currentStructure = [
                ...currentStructure.filter(
                  (item) => item.folderName !== actionData.folderName
                ),
                ...newSheetsToAdd.map((sheetName) => ({ sheetName })),
              ];
              folderSheets.forEach((sheetName) => modifiedSheets.add(sheetName));
            }
          });
          // Clean up structure: remove empty/falsey/empty string sheet names
          const cleanStructure = (structure) =>
            structure
              .map((item) => {
                if (item.sheetName && typeof item.sheetName === 'string' && item.sheetName.trim() !== '') {
                  return { sheetName: item.sheetName };
                }
                if (item.folderName && Array.isArray(item.sheets)) {
                  const cleanSheets = item.sheets.filter(
                    (s) => s && typeof s === 'string' && s.trim() !== ''
                  );
                  return { folderName: item.folderName, sheets: cleanSheets };
                }
                return null;
              })
              .filter(Boolean);
          const cleaned = cleanStructure(currentStructure);
          return {
            ...prev,
            structure: cleaned,
            allSheets: prev.allSheets.map((sheet) =>
              modifiedSheets.has(sheet.sheetName)
                ? { ...sheet, isModified: true, action: 'update' }
                : sheet
            ),
          };
        });
      } else if (data?.tempData?.action === 'deleteFolder' && data.tempData.folderName) {
        setSheets((prev) => {
          const folderSheets = prev.structure.find(
            (item) => item.folderName === data.tempData.folderName
          )?.sheets || [];
          const existingSheetNames = prev.structure
            .filter((item) => item.sheetName)
            .map((item) => item.sheetName);
          const newSheetsToAdd = folderSheets.filter(
            (sheetName) => !existingSheetNames.includes(sheetName)
          );
          const newStructure = [
            ...prev.structure.filter(
              (item) => item.folderName !== data.tempData.folderName
            ),
            ...newSheetsToAdd.map((sheetName) => ({ sheetName })),
          ];
          return {
            ...prev,
            structure: newStructure,
            allSheets: prev.allSheets.map((sheet) =>
              folderSheets.includes(sheet.sheetName)
                ? { ...sheet, isModified: true, action: 'update' }
                : sheet
            ),
          };
        });
      } else {
      }
      break;
    case 'widgetView':
      if (data?.action === 'deleteCategories' && data?.deletedCategories && metrics) {
        setMetrics((prev) => {
          const updatedMetrics = prev
            .map((category) => {
              if (data.deletedCategories.includes(category.category)) {
                return { ...category, isModified: true, action: 'remove' };
              }
              return category;
            })
            .filter((category) => !data.deletedCategories.includes(category.category));
          return updatedMetrics;
        });
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
            : [
                ...dashboard.dashboardWidgets,
                { ...data.updatedWidget, dashboardId: data.dashboardId },
              ];
          const { isModified, action, ...cleanDashboard } = dashboard;
          return {
            ...cleanDashboard,
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
        setMetrics((prev) => {
          const existingCategories = new Set(prev.map((c) => c.category));
          return data.currentCategories.map((category) => {
            const cleanedCategory = cleanObject(category, true);
            const existingCategory = prev.find((c) => c.category === category.category);
            let isNew = !existingCategories.has(category.category);
            let hasChanged = true;
            if (existingCategory) {
              // Deep compare metrics array and force update if any metric property (including name) changes
              const prevMetrics = (existingCategory.metrics || []).map(cleanObject);
              const newMetrics = (cleanedCategory.metrics || []).map(cleanObject);
              // Check for any difference in metrics length or any property (including name)
              if (prevMetrics.length !== newMetrics.length) {
                hasChanged = true;
              } else {
                hasChanged = prevMetrics.some((m, idx) => JSON.stringify(m) !== JSON.stringify(newMetrics[idx]));
              }
              // Also check if any other category property (besides metrics) changed
              if (!hasChanged) {
                const { metrics: _nm, ...restNew } = cleanedCategory;
                const { metrics: _om, ...restOld } = existingCategory;
                hasChanged = JSON.stringify(restNew) !== JSON.stringify(cleanObject(restOld, true));
              }
            }
            return {
              ...cleanedCategory,
              isModified: isNew || hasChanged,
              action: isNew ? 'add' : hasChanged ? 'update' : undefined,
            };
          }).filter((category) => category !== undefined);
        });
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
  widgetSizeModal,
  widgetViewModal,
  widgetSetupModal,
  metricsModal,
  activeDashboard,
  folderModal,
}) => {
  if (activeModal?.type === 'folderModal') {
    // Special handling for folderModal: if fromSave and tempData.action or tempData.actions, pass them to handleModalSave
    if (options.fromSave) {
      let modalData = activeModal.data || {};
      // Prefer tempData from options if present (e.g. from deleteFolder)
      if (options.tempData) {
        modalData = { ...modalData, tempData: options.tempData };
      }
      handleModalSave({ modalType: 'folderModal', data: modalData });
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
    widgetSetupModal?.open();
  } else if (activeModal?.type !== 'widgetView' && activeModal?.data) {
    if (options.fromSave) {
      handleModalSave({ modalType: activeModal.type, data: activeModal.data });
    }
  }
  setActiveModal(null);
  setEditMode(false);
  setSelectedTemplateIndex(null);
  setCurrentSectionIndex(null);
  sheetModal?.close();
  filterModal?.close();
  sheetsModal?.close();
  transportModal?.close();
  cardsTemplateModal?.close();
  sheetFolderModal?.close();
  widgetSizeModal?.close();
  widgetViewModal?.close();
  widgetSetupModal?.close();
  metricsModal?.close();
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
  clearFetchedSheets,
}) => {
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
              currentHeaders: resolvedHeaders || [],
              typeOfCardsToDisplay: activeSheet?.typeOfCardsToDisplay || [],
              cardTypeFilters: activeSheet?.cardTypeFilters || {},
              cardsPerSearch: activeSheet?.cardsPerSearch ?? null,
            }
          }
          setTempData={setActiveModalData}
          sheets={sheets}
          onPinToggle={handlePinToggle}
          onDeleteSheet={handleDeleteSheet}
          handleClose={handleModalClose}
          setActiveSheetName={handleSheetChange}
          clearFetchedSheets={clearFetchedSheets}
        />
      );
    case 'filter':
      return (
        <FilterModal
          headers={resolvedHeaders || []}
          rows={resolvedRows || []}
          tempData={activeModal.data || { filterValues: activeSheet?.filters || {} }}
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
          tempData={activeModal.data || { currentCardTemplates: [...(cardTemplates || [])] }}
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
    case 'folderModal':
      return (
        <FolderModal
          folderName={activeModal.data?.folderName}
          onSheetSelect={handleSheetChange}
          handleClose={handleModalClose}
          tempData={activeModal.data?.tempData || {}}
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
          tempData={activeModal.data || { currentCategories: [...(metrics || [])] }}
          setTempData={setActiveModalData}
          handleClose={handleModalClose}
        />
      );
    // pipelineManagement removed - now integrated into Card Templates workflow
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
  clearFetchedSheets,
}) => {
  if (!sheets) return;
  setIsSheetModalEditMode(true);
  setActiveModal({
    type: 'sheet',
    data: {
      sheetName: activeSheetName,
      currentHeaders: resolvedHeaders || [],
      typeOfCardsToDisplay: activeSheet?.typeOfCardsToDisplay || [],
      cardTypeFilters: activeSheet?.cardTypeFilters || {},
      cardsPerSearch: activeSheet?.cardsPerSearch ?? null,
    },
  });
  sheetModal?.open();
};

export const onFilter = ({
  sheets,
  setActiveModal,
  filterModal,
  activeSheet,
}) => {
  if (!sheets) return;
  setActiveModal({
    type: 'filter',
    data: { filterValues: activeSheet?.filters || {} },
  });
  filterModal?.open();
};

export const onManageMetrics = ({
  metrics,
  setActiveModal,
  metricsModal,
}) => {
  if (!metrics) return;
  setActiveModal({
    type: 'metrics',
    data: { currentCategories: [...metrics] },
  });
  metricsModal?.open();
};

export const onOpenSheetsModal = ({
  sheets,
  setActiveModal,
  sheetsModal,
}) => {
  if (!sheets) return;
  setActiveModal({
    type: 'sheets',
    data: { newOrder: [...(sheets?.structure || [])] },
  });
  sheetsModal?.open();
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
  transportModal?.open();
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
    data: { currentCardTemplates: [...(cardTemplates || [])] },
  });
  cardsTemplateModal?.open();
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
    data: { sheets, handleSheetSave, handleFolderSave },
  });
  sheetFolderModal?.open();
};

export const onOpenFolderModal = ({
  folderName,
  sheets,
  setActiveModal,
  folderModal,
  onSheetSelect,
}) => {
  if (!sheets) return;
  setActiveModal({
    type: 'folderModal',
    data: {
      folderName,
      onSheetSelect,
      tempData: {},
      handleClose: () => {
        folderModal?.close();
        setActiveModal(null);
      },
    },
  });
  folderModal?.open();
};

// onOpenPipelineManagementModal removed - pipeline management now integrated into Card Templates workflow