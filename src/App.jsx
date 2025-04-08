import { useContext, useState, useCallback, useMemo } from "react";
import SheetTemplate from "./Sheet Template/SheetTemplate";
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

function App() {
  const { sheets, setSheets, cards, setCards, headers, setHeaders } = useContext(MainContext);
  const sheetModal = useModal();
  const filterModal = useModal();
  const headersModal = useModal();
  const sheetsModal = useModal();
  const [isSheetModalEditMode, setIsSheetModalEditMode] = useState(false);
  const [filters, setFilters] = useState({});
  const [activeOption, setActiveOption] = useState("sheets");
  const [activeModal, setActiveModal] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const activeSheet = useMemo(() => sheets.allSheets.find((sheet) => sheet.isActive) || null, [sheets]);
  const activeSheetName = activeSheet?.sheetName;
  const { handleSheetChange, handleSaveSheet } = useSheets(sheets, setSheets, activeSheetName);

  const resolvedHeaders = useMemo(() => {
    return activeSheet?.headers.map((sheetHeader) => {
      const header = headers.find((h) => Object.keys(h)[0] === sheetHeader.key);
      return header
        ? { key: sheetHeader.key, name: header[sheetHeader.key], type: header.type, visible: sheetHeader.visible, hidden: sheetHeader.hidden }
        : { key: sheetHeader.key, name: sheetHeader.key, type: "text", visible: sheetHeader.visible, hidden: sheetHeader.hidden };
    }) || [];
  }, [activeSheet, headers]);

  const getRowIdKey = useCallback(() => {
    switch (activeSheetName) {
      case "Leads":
        return "leadId";
      case "Business Partners":
        return "businessId";
      case "Vendors":
        return "vendorId";
      case "Tasks":
        return "taskId";
      default:
        return resolvedHeaders[0]?.key || "id";
    }
  }, [activeSheetName, resolvedHeaders]);

  const resolvedRows = useMemo(() => {
    const rowIdKey = getRowIdKey();
    return activeSheet?.rows.map((rowId) => cards.find((card) => card[rowIdKey] === rowId) || {}) || [];
  }, [activeSheet, cards, getRowIdKey]);

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

  const handleCardSave = useCallback(
    (updatedRow) => {
      setCards((prevCards) =>
        prevCards.map((card) => (card[resolvedHeaders[0]?.key] === updatedRow[resolvedHeaders[0]?.key] ? updatedRow : card))
      );
      setSheets((prevSheets) => ({
        ...prevSheets,
        allSheets: prevSheets.allSheets.map((sheet) =>
          sheet.sheetName === activeSheetName
            ? {
                ...sheet,
                rows: sheet.rows.map((id) => (id === updatedRow[resolvedHeaders[0]?.key] ? updatedRow[resolvedHeaders[0]?.key] : id)),
              }
            : sheet
        ),
      }));
    },
    [activeSheetName, setCards, setSheets, resolvedHeaders]
  );

  const handleDelete = useCallback(
    (rowData) => {
      setCards((prevCards) => prevCards.filter((card) => card[resolvedHeaders[0]?.key] !== rowData[resolvedHeaders[0]?.key]));
      setSheets((prevSheets) => ({
        ...prevSheets,
        allSheets: prevSheets.allSheets.map((sheet) =>
          sheet.sheetName === activeSheetName
            ? { ...sheet, rows: sheet.rows.filter((id) => id !== rowData[resolvedHeaders[0]?.key]) }
            : sheet
        ),
      }));
    },
    [activeSheetName, setCards, setSheets, resolvedHeaders]
  );

  const onEditSheet = useCallback(() => {
    setIsSheetModalEditMode(true);
    setActiveModal({ type: "sheet", data: { isEditMode: true } });
    sheetModal.open();
  }, [sheetModal]);

  const onFilter = useCallback(() => {
    setActiveModal({ type: "filter" });
    filterModal.open();
  }, [filterModal]);

  const onManageHeaders = useCallback(() => {
    setActiveModal({ type: "headers" });
    headersModal.open();
  }, [headersModal]);

  const onOpenSheetsModal = useCallback(() => {
    setActiveModal({ type: "sheets" });
    sheetsModal.open();
  }, [sheetsModal]);

  const handleModalClose = useCallback(() => {
    setActiveModal(null);
    sheetModal.close();
    filterModal.close();
    headersModal.close();
    sheetsModal.close();
  }, [sheetModal, filterModal, headersModal, sheetsModal]);

  // ProfileModal handlers
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
            tempData={{
              sheetName: isSheetModalEditMode ? activeSheetName : "",
              currentHeaders: resolvedHeaders,
              rows: activeSheet?.rows || [],
            }}
            setTempData={(newData) => {
              if (isSheetModalEditMode) {
                setSheets((prev) => ({
                  ...prev,
                  allSheets: prev.allSheets.map((sheet) =>
                    sheet.sheetName === activeSheetName ? { ...sheet, ...newData } : sheet
                  ),
                }));
              } else {
                handleSaveSheet(newData.sheetName, newData.currentHeaders);
              }
            }}
            sheets={sheets}
            onPinToggle={handlePinToggle}
          />
        );
      case "filter":
        return <FilterModal headers={resolvedHeaders} rows={resolvedRows} />;
      case "headers":
        return <HeadersModal />;
      case "sheets":
        return <SheetsModal sheets={sheets} />;
      default:
        return null;
    }
  };

  return (
    <div className={styles.appContainer}>
      <AppHeader
        sheets={sheets.structure.map((item) => item.sheetName || item.folderName)}
        activeSheet={activeSheetName}
        onSheetChange={handleSheetChange}
        setIsProfileModalOpen={handleOpenProfileModal}
        activeOption={activeOption}
        setActiveOption={setActiveOption}
      />
      <div className={styles.contentWrapper}>
        {activeOption === "sheets" && activeSheetName && (
          <SheetTemplate
            headers={resolvedHeaders}
            rows={resolvedRows}
            filters={filters}
            sheets={sheets}
            setSheets={setSheets}
            activeSheetName={activeSheetName}
            onSheetChange={handleSheetChange}
            onEditSheet={onEditSheet}
            onFilter={onFilter}
            onRowClick={() => {}}
            onCardSave={handleCardSave}
            onCardDelete={handleDelete}
            onOpenSheetsModal={onOpenSheetsModal}
          />
        )}
        {activeModal && (
          <Modal
            title={
              activeModal.type === "sheet" ? (isSheetModalEditMode ? "Edit Sheet" : "New Sheet") :
              activeModal.type === "filter" ? "Filters" :
              activeModal.type === "headers" ? "Manage Columns" :
              activeModal.type === "sheets" ? "Manage Sheets" : ""
            }
            onClose={handleModalClose}
            onSave={setFilters}
            initialData={
              activeModal.type === "sheet" ? {
                sheetName: isSheetModalEditMode ? activeSheetName : "",
                currentHeaders: resolvedHeaders,
                rows: activeSheet?.rows || [], // Pass rows to SheetModal
              } :
              activeModal.type === "filter" ? { filterValues: filters } :
              activeModal.type === "headers" ? { currentHeaders: headers } :
              activeModal.type === "sheets" ? { newOrder: sheets.structure.map((item) => item.sheetName || item.folderName) } : {}
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
        />
      </div>
    </div>
  );
}

export default App;