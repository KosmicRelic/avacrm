import { useContext, useState, useCallback, useMemo } from "react";
import SheetTemplate from "./Sheet Template/SheetTemplate";
import AppHeader from "./App Header/AppHeader";
import FilterModal from "./Modal/FilterModal/FilterModal";
import HeadersModal from "./Modal/HeadersModal/HeaderModal";
import ProfileModal from "./App Header/ProfileModal/ProfileModal";
import SettingsModal from "./SettingsModal/SettingsModal";
import { MainContext } from "./Contexts/MainContext";
import styles from "./App.module.css";
import SheetModal from "./Modal/SheetModal/SheetModal";
import useModal from "./Modal/Hooks/UseModal";
import useSheets from "./Modal/Hooks/UseSheets";

function App() {
  const { sheets, setSheets, cards, setCards, headers } = useContext(MainContext);
  const sheetModal = useModal();
  const filterModal = useModal();
  const headersModal = useModal();
  const profileModal = useModal();
  const settingsModal = useModal();
  const [isSheetModalEditMode, setIsSheetModalEditMode] = useState(false);
  const [filters, setFilters] = useState({});
  const [activeOption, setActiveOption] = useState("sheets");

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
    sheetModal.open();
  }, [sheetModal]);

  const onFilter = useCallback(() => filterModal.open(), [filterModal]);

  const sheetDisplayOrder = sheets.structure.map((item) => item.sheetName || item.folderName);

  return (
    <div className={styles.appContainer}>
      <AppHeader
        sheets={sheetDisplayOrder}
        activeSheet={activeSheetName}
        onSheetChange={handleSheetChange}
        setIsProfileModalOpen={profileModal.open}
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
          />
        )}
        {sheetModal.isOpen && (
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
            onClose={sheetModal.close}
          />
        )}
        {filterModal.isOpen && (
          <FilterModal
            headers={resolvedHeaders}
            rows={resolvedRows}
            filters={filters}
            onApply={handleApplyFilters}
            onClose={filterModal.close}
          />
        )}
        {headersModal.isOpen && <HeadersModal onClose={headersModal.close} />}
        {profileModal.isOpen && (
          <ProfileModal
            onClose={profileModal.close}
            onManageHeaders={() => {
              headersModal.open();
              profileModal.close();
            }}
            onOptionChange={(option) => {
              setActiveOption(option);
              if (option === "sheets" && activeSheetName) handleSheetChange(activeSheetName);
            }}
            activeOption={activeOption}
            isMobile={window.innerWidth <= 768}
            setIsSettingsModalOpen={settingsModal.open}
          />
        )}
        {settingsModal.isOpen && (
          <SettingsModal
            onClose={settingsModal.close}
            onManageHeaders={() => {
              headersModal.open();
              settingsModal.close();
            }}
          />
        )}
      </div>
    </div>
  );
}

export default App;