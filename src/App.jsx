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
import Modal from "./Modal/Modal"; // Adjust path as needed
import SheetsModal from "./Modal/Sheets Modal/SheetsModal";

function App() {
  const { sheets, setSheets, cards, setCards, headers } = useContext(MainContext);
  const sheetModal = useModal();
  const filterModal = useModal();
  const headersModal = useModal();
  const sheetsModal = useModal(); // New hook for SheetsModal
  const [isSheetModalEditMode, setIsSheetModalEditMode] = useState(false);
  const [filters, setFilters] = useState({});
  const [activeOption, setActiveOption] = useState("sheets");
  const [activeModal, setActiveModal] = useState(null);
  const [isModalClosing, setIsModalClosing] = useState(false);

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

  const resolvedRows = useMemo(() => {
    return activeSheet?.rows.map((leadId) => cards.find((card) => card[resolvedHeaders[0]?.key] === leadId) || {}) || [];
  }, [activeSheet, cards, resolvedHeaders]);

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

  const handleApplyFilters = useCallback((newFilters) => setFilters(newFilters), []);

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

  const handleSaveSheetOrder = useCallback((newOrder) => {
    // Optionally handle additional save logic if needed
    console.log("New sheet order:", newOrder);
  }, []);

  const sheetDisplayOrder = sheets.structure.map((item) => item.sheetName || item.folderName);

  const handleModalClose = useCallback(() => {
    setIsModalClosing(true);
    setTimeout(() => {
      setIsModalClosing(false);
      setActiveModal(null);
      sheetModal.close();
      filterModal.close();
      headersModal.close();
      sheetsModal.close();
    }, 300);
  }, [sheetModal, filterModal, headersModal, sheetsModal]);

  const renderModalContent = () => {
    if (!activeModal) return null;

    switch (activeModal.type) {
      case "sheet":
        return (
          <SheetModal
            isEditMode={isSheetModalEditMode}
            sheetName={isSheetModalEditMode ? activeSheetName : ""}
            headers={resolvedHeaders}
            pinnedHeaders={isSheetModalEditMode ? activeSheet?.pinnedHeaders || [] : []}
            sheets={sheets}
            onSave={(sheetNameOrObj, headerObjects, pinnedHeaders) =>
              handleSaveSheet(sheetNameOrObj, headerObjects, pinnedHeaders, isSheetModalEditMode)
            }
            onPinToggle={handlePinToggle}
          />
        );
      case "filter":
        return (
          <FilterModal
            headers={resolvedHeaders}
            rows={resolvedRows}
            filters={filters}
            onApply={handleApplyFilters}
          />
        );
      case "headers":
        return <HeadersModal />;
      case "sheets":
        return (
          <SheetsModal
            sheets={sheets}
            onSaveOrder={handleSaveSheetOrder}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.appContainer}>
      <AppHeader
        sheets={sheetDisplayOrder}
        activeSheet={activeSheetName}
        onSheetChange={handleSheetChange}
        setIsProfileModalOpen={() => {}}
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
            onOpenSheetsModal={onOpenSheetsModal} // Pass new prop
          />
        )}
        {/* <button onClick={onManageHeaders} style={{ margin: "10px" }}>
          Manage Headers
        </button> */}
        {activeModal && (
          <Modal
            title={
              activeModal.type === "sheet" ? (isSheetModalEditMode ? "Edit Sheet" : "New Sheet") :
              activeModal.type === "filter" ? "Filters" :
              activeModal.type === "headers" ? "Manage Columns" :
              activeModal.type === "sheets" ? "Manage Sheets" : ""
            }
            onClose={handleModalClose}
          >
            {renderModalContent()}
          </Modal>
        )}
      </div>
    </div>
  );
}

export default App;