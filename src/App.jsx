import { useContext, useState, useCallback, useMemo } from "react";
import SheetTemplate from "./Sheet Template/SheetTemplate";
import AppHeader from "./App Header/AppHeader";
import SheetModal from "./Sheet Template/SheetModal/SheetModal";
import FilterModal from "./FilterModal/FilterModal";
import HeadersModal from "./HeadersModal/HeaderModal";
import ProfileModal from "./App Header/ProfileModal/ProfileModal";
import SettingsModal from "./SettingsModal/SettingsModal";
import { MainContext } from "./Contexts/MainContext";
import styles from "./App.module.css";

function App() {
  const { sheets, setSheets, cards, setCards, headers } = useContext(MainContext);
  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
  const [isSheetModalEditMode, setIsSheetModalEditMode] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isHeadersModalOpen, setIsHeadersModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [filters, setFilters] = useState({});
  const [activeOption, setActiveOption] = useState("sheets");

  const activeSheet = useMemo(() => sheets.allSheets.find((sheet) => sheet.isActive) || null, [sheets]);
  const activeSheetName = activeSheet?.sheetName;

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

  const handleSheetChange = useCallback((sheetName) => {
    if (sheetName === "add-new-sheet") {
      setIsSheetModalEditMode(false);
      setIsSheetModalOpen(true);
    } else if (sheetName) {
      setSheets((prevSheets) => ({
        ...prevSheets,
        allSheets: prevSheets.allSheets.map((sheet) => ({ ...sheet, isActive: sheet.sheetName === sheetName })),
      }));
    }
  }, [setSheets]);

  const handleSheetUpdate = useCallback(
    (sheetNameOrObj, headerObjects, pinnedHeaders, shouldSave = false) => {
      const trimmedName = typeof sheetNameOrObj === "string" ? sheetNameOrObj : sheetNameOrObj.sheetName;
      const sheetStructure = sheets.structure || sheets;
      const existingSheetNames = Array.isArray(sheetStructure)
        ? sheetStructure.map((item) => item.sheetName || item.folderName)
        : [];
      const isDuplicate = isSheetModalEditMode
        ? trimmedName !== activeSheetName && existingSheetNames.includes(trimmedName)
        : existingSheetNames.includes(trimmedName);

      if (shouldSave) {
        if (isDuplicate) {
          alert("A sheet or folder with this name already exists.");
          return;
        }
        if (!trimmedName) {
          alert("Please provide a sheet name.");
          return;
        }
        if (headerObjects.length === 0) {
          alert("Please select at least one header.");
          return;
        }
      }

      if (isDuplicate) return;

      setSheets((prevSheets) => {
        if (isSheetModalEditMode) {
          return {
            ...prevSheets,
            allSheets: prevSheets.allSheets.map((sheet) =>
              sheet.sheetName === activeSheetName
                ? { ...sheet, sheetName: trimmedName, headers: headerObjects, pinnedHeaders, isActive: true }
                : { ...sheet, isActive: false }
            ),
            structure: prevSheets.structure.map((item) =>
              item.sheetName === activeSheetName
                ? { sheetName: trimmedName }
                : item.folderName
                ? { ...item, sheets: item.sheets.map((s) => (s === activeSheetName ? trimmedName : s)) }
                : item
            ),
          };
        } else if (trimmedName) {
          return {
            ...prevSheets,
            allSheets: [
              ...prevSheets.allSheets.map((sheet) => ({ ...sheet, isActive: false })),
              { sheetName: trimmedName, headers: headerObjects, pinnedHeaders: pinnedHeaders || [], rows: [], isActive: true },
            ],
            structure: [...prevSheets.structure, { sheetName: trimmedName }],
          };
        }
        return prevSheets;
      });
    },
    [isSheetModalEditMode, activeSheetName, sheets, setSheets]
  );

  const handleSaveSheet = (sheetNameOrObj, headerObjects, pinnedHeaders) =>
    handleSheetUpdate(sheetNameOrObj, headerObjects, pinnedHeaders, true);

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

  const handleRowClick = () => {};

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
    setIsSheetModalOpen(true);
  }, []);

  const onFilter = useCallback(() => setIsFilterModalOpen(true), []);

  const sheetDisplayOrder = sheets.structure.map((item) => item.sheetName || item.folderName);

  return (
    <div className={styles.appContainer}>
      <AppHeader
        sheets={sheetDisplayOrder}
        activeSheet={activeSheetName}
        onSheetChange={handleSheetChange}
        setIsProfileModalOpen={setIsProfileModalOpen}
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
            onRowClick={handleRowClick}
            onCardSave={handleCardSave}
            onCardDelete={handleDelete}
          />
        )}
        {isSheetModalOpen && (
          <SheetModal
            isEditMode={isSheetModalEditMode}
            sheetName={isSheetModalEditMode ? activeSheetName : ""}
            headers={resolvedHeaders}
            pinnedHeaders={isSheetModalEditMode ? activeSheet?.pinnedHeaders || [] : []}
            sheets={sheets}
            onSave={handleSaveSheet}
            onPinToggle={handlePinToggle}
            onClose={() => setIsSheetModalOpen(false)}
          />
        )}
        {isFilterModalOpen && (
          <FilterModal
            headers={resolvedHeaders}
            rows={resolvedRows}
            filters={filters}
            onApply={handleApplyFilters}
            onClose={() => setIsFilterModalOpen(false)}
          />
        )}
        {isHeadersModalOpen && <HeadersModal onClose={() => setIsHeadersModalOpen(false)} />}
        {isProfileModalOpen && (
          <ProfileModal
            onClose={() => setIsProfileModalOpen(false)}
            onManageHeaders={() => {
              setIsHeadersModalOpen(true);
              setIsProfileModalOpen(false);
            }}
            onOptionChange={(option) => {
              setActiveOption(option);
              if (option === "sheets" && activeSheetName) handleSheetChange(activeSheetName);
            }}
            activeOption={activeOption}
            isMobile={window.innerWidth <= 768}
            setIsSettingsModalOpen={setIsSettingsModalOpen}
          />
        )}
        {isSettingsModalOpen && (
          <SettingsModal
            onClose={() => setIsSettingsModalOpen(false)}
            onManageHeaders={() => {
              setIsHeadersModalOpen(true);
              setIsSettingsModalOpen(false);
            }}
          />
        )}
      </div>
    </div>
  );
}

export default App;