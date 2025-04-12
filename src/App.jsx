import { createContext, useState, useCallback, useMemo, useContext } from "react";
import PropTypes from "prop-types";
import Sheets from "./Sheets/Sheets";
import AppHeader from "./App Header/AppHeader";
import FilterModal from "./Modal/FilterModal/FilterModal";
import HeadersModal from "./Modal/HeadersModal/HeaderModal";
import { MainContext } from "./Contexts/MainContext";
import styles from "./App.module.css";
import SheetModal from "./Modal/SheetModal/SheetModal";
import useModal from "./Modal/Hooks/UseModal";
import useSheets from "./Modal/Hooks/UseSheets";
import Modal from "./Modal/Modal";
import SheetsModal from "./Modal/Sheets Modal/SheetsModal";
import ProfileModal from "./Profile Modal/ProfileModal";
import CardsTransportationModal from "./Modal/Cards Transportaion Modal/CardsTransportaionModal";
import CardsTemplate from "./Modal/Cards Template/CardsTemplate";

function App() {
  const {
    sheets,
    setSheets,
    cards,
    setCards,
    headers,
    setHeaders,
    setModalConfig,
    cardTemplates,
    currentStep,
    editMode,
    setEditMode,
    registerModalSteps,
    goToStep,
  } = useContext(MainContext);

  const sheetModal = useModal();
  const filterModal = useModal();
  const headersModal = useModal();
  const sheetsModal = useModal();
  const transportModal = useModal();
  const cardsTemplateModal = useModal();
  const [isSheetModalEditMode, setIsSheetModalEditMode] = useState(false);
  const [activeOption, setActiveOption] = useState("sheets");
  const [activeModal, setActiveModal] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const activeSheet = useMemo(() => sheets?.allSheets?.find((sheet) => sheet.isActive) || null, [sheets]);
  const activeSheetName = activeSheet?.sheetName;
  const { handleSheetChange, handleSaveSheet } = useSheets(sheets, setSheets, activeSheetName);

  const resolvedHeaders = useMemo(() => {
    return activeSheet?.headers?.map((sheetHeader) => {
      const header = (headers || []).find((h) => h.key === sheetHeader.key);
      return header
        ? { key: sheetHeader.key, name: header.name, type: header.type, visible: sheetHeader.visible, hidden: sheetHeader.hidden }
        : { key: sheetHeader.key, name: sheetHeader.key, type: "text", visible: sheetHeader.visible, hidden: sheetHeader.hidden };
    }) || [];
  }, [activeSheet, headers]);

  const resolvedRows = useMemo(() => {
    return activeSheet?.rows?.map((rowId) => cards.find((card) => card.id === rowId) || {}) || [];
  }, [activeSheet, cards]);

  const resetModalState = useCallback(() => {
    registerModalSteps({ steps: [] });
    setModalConfig({
      showTitle: false,
      showDoneButton: false,
      showBackButton: false,
      title: "",
      backButtonTitle: "",
    });
    goToStep(1);
  }, [registerModalSteps, setModalConfig, goToStep]);

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

  const onEditSheet = useCallback(() => {
    resetModalState();
    setIsSheetModalEditMode(true);
    setActiveModal({
      type: "sheet",
      data: {
        sheetName: activeSheetName,
        currentHeaders: resolvedHeaders,
        rows: activeSheet?.rows || [],
      },
    });
    sheetModal.open();
  }, [sheetModal, resetModalState, activeSheetName, resolvedHeaders, activeSheet]);

  const onFilter = useCallback(() => {
    resetModalState();
    setActiveModal({ type: "filter", data: { filterValues: activeSheet?.filters || {} } });
    filterModal.open();
  }, [filterModal, resetModalState, activeSheet]);

  const onManageHeaders = useCallback(() => {
    resetModalState();
    setActiveModal({ type: "headers", data: { currentHeaders: headers || [] } });
    headersModal.open();
  }, [headersModal, resetModalState, headers]);

  const onOpenSheetsModal = useCallback(() => {
    resetModalState();
    setActiveModal({ type: "sheets", data: { newOrder: sheets?.structure || [] } });
    sheetsModal.open();
  }, [sheetsModal, resetModalState, sheets]);

  const onOpenTransportModal = useCallback(
    (action, selectedRowIds, onComplete) => {
      resetModalState();
      setActiveModal({ type: "transport", data: { action, selectedRowIds, onComplete } });
      transportModal.open();
    },
    [transportModal, resetModalState]
  );

  const onOpenCardsTemplateModal = useCallback(() => {
    resetModalState();
    setActiveModal({ type: "cardsTemplate" });
    cardsTemplateModal.open();
  }, [cardsTemplateModal, resetModalState]);

  const handleModalClose = useCallback(() => {
    if (currentStep !== 1) {
      return;
    }
    setActiveModal(null);
    resetModalState();
    setEditMode(false);
    sheetModal.close();
    filterModal.close();
    headersModal.close();
    sheetsModal.close();
    transportModal.close();
    cardsTemplateModal.close();
  }, [
    currentStep,
    sheetModal,
    filterModal,
    headersModal,
    sheetsModal,
    transportModal,
    cardsTemplateModal,
    setEditMode,
    resetModalState,
  ]);

  const handleOpenProfileModal = useCallback(() => {
    setIsProfileModalOpen(true);
  }, []);

  const handleCloseProfileModal = useCallback(() => {
    setIsProfileModalOpen(false);
  }, []);

  const renderModalContent = () => {
    if (!activeModal) return null;

    switch (activeModal.type) {
      case "sheet":
        return (
          <SheetModal
            isEditMode={isSheetModalEditMode}
            tempData={activeModal.data || {
              sheetName: isSheetModalEditMode ? activeSheetName : "",
              currentHeaders: resolvedHeaders,
              rows: activeSheet?.rows || [],
            }}
            setTempData={(newData) => setActiveModal((prev) => ({ ...prev, data: newData }))}
            sheets={sheets}
            onPinToggle={handlePinToggle}
            onSave={() => {
              handleSaveSheet(
                activeModal.data.sheetName,
                activeModal.data.currentHeaders,
                activeSheet?.pinnedHeaders || [],
                isSheetModalEditMode
              );
            }}
          />
        );
      case "filter":
        return (
          <FilterModal
            headers={resolvedHeaders}
            rows={resolvedRows}
            tempData={activeModal.data || { filterValues: activeSheet?.filters || {} }}
            setTempData={(newData) => setActiveModal((prev) => ({ ...prev, data: newData }))}
          />
        );
      case "headers":
        return (
          <HeadersModal
            tempData={activeModal.data || { currentHeaders: headers || [] }}
            setTempData={(newData) => setActiveModal((prev) => ({ ...prev, data: newData }))}
          />
        );
      case "sheets":
        return (
          <SheetsModal
            sheets={sheets || { structure: [] }}
            tempData={activeModal.data || { newOrder: sheets?.structure || [] }}
            setTempData={(newData) => setActiveModal((prev) => ({ ...prev, data: newData }))}
            onSave={() => {
              setSheets((prev) => ({
                ...prev,
                structure: activeModal.data?.newOrder || prev.structure,
              }));
            }}
          />
        );
      case "transport":
        return (
          <CardsTransportationModal
            tempData={activeModal.data}
            setTempData={(data) => setActiveModal((prev) => ({ ...prev, data }))}
            onSave={handleModalClose}
          />
        );
      case "cardsTemplate":
        return (
          <CardsTemplate
            onSave={handleModalClose}
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
      />
      <div className={styles.contentWrapper}>
        {activeOption === "sheets" && activeSheetName && (
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
          />
        )}
        {activeModal && (
          <Modal
            onClose={handleModalClose}
            onSave={
              activeModal.type === "headers"
                ? () => setHeaders(activeModal.data?.currentHeaders || headers || [])
                : activeModal.type === "sheet"
                ? () => {
                    handleSaveSheet(
                      activeModal.data.sheetName,
                      activeModal.data.currentHeaders,
                      activeSheet?.pinnedHeaders || [],
                      isSheetModalEditMode
                    );
                  }
                : activeModal.type === "sheets"
                ? () => {
                    setSheets((prev) => ({
                      ...prev,
                      structure: activeModal.data?.newOrder || prev.structure,
                    }));
                  }
                : activeModal.type === "filter"
                ? () => {
                    setSheets((prev) => ({
                      ...prev,
                      allSheets: prev.allSheets.map((sheet) =>
                        sheet.sheetName === activeSheetName
                          ? { ...sheet, filters: activeModal.data?.filterValues || {} }
                          : sheet
                      ),
                    }));
                  }
                : () => handleModalClose
            }
            initialData={
              activeModal.type === "sheet"
                ? activeModal.data || {
                    sheetName: isSheetModalEditMode ? activeSheetName : "",
                    currentHeaders: resolvedHeaders,
                    rows: activeSheet?.rows || [],
                  }
                : activeModal.type === "filter"
                ? activeModal.data || { filterValues: activeSheet?.filters || {} }
                : activeModal.type === "headers"
                ? activeModal.data || { currentHeaders: headers || [] }
                : activeModal.type === "sheets"
                ? activeModal.data || { newOrder: sheets?.structure || [] }
                : activeModal.type === "transport"
                ? activeModal.data
                : activeModal.type === "cardsTemplate"
                ? cardTemplates
                : {}
            }
            modalType={activeModal.type}
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