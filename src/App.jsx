import { useContext, useState, useCallback, useMemo } from "react";
import SheetTemplate from "./Sheet Template/SheetTemplate";
import AppHeader from "./App Header/AppHeader";
import SheetModal from "./Sheet Template/SheetModal/SheetModal";
import FilterModal from "./FilterModal/FilterModal";
import { MainContext } from "./Contexts/MainContext";
import ProfileModal from "./App Header/ProfileModal/ProfileModal";
import HeadersModal from "./HeadersModal/HeaderModal";
import SettingsModal from "./SettingsModal/SettingsModal";
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

  // Find the active sheet
  const activeSheet = useMemo(() => {
    return sheets.allSheets.find((sheet) => sheet.isActive) || null;
  }, [sheets]);

  const activeSheetName = activeSheet?.sheetName;

  const resolvedHeaders = useMemo(() => {
    return activeSheet?.headers.map((sheetHeader) => {
      const header = headers.find((h) => Object.keys(h)[0] === sheetHeader.key);
      return header
        ? {
            key: sheetHeader.key,
            name: header[sheetHeader.key],
            type: header.type,
            visible: sheetHeader.visible,
            hidden: sheetHeader.hidden,
          }
        : {
            key: sheetHeader.key,
            name: sheetHeader.key,
            type: "text",
            visible: sheetHeader.visible,
            hidden: sheetHeader.hidden,
          };
    }) || [];
  }, [activeSheet, headers]);

  const resolvedRows = useMemo(() => {
    return activeSheet?.rows.map((leadId) => cards.find((card) => card[resolvedHeaders[0]?.key] === leadId) || {}) || [];
  }, [activeSheet, cards, resolvedHeaders]);

  // Handle sheet change
  const handleSheetChange = useCallback((sheetName) => {
    if (sheetName === "add-new-sheet") {
      setIsSheetModalEditMode(false);
      setIsSheetModalOpen(true);
    } else if (sheetName) {
      setSheets((prevSheets) => ({
        ...prevSheets,
        allSheets: prevSheets.allSheets.map((sheet) => ({
          ...sheet,
          isActive: sheet.sheetName === sheetName,
        })),
      }));
    }
  }, [setSheets]);

  const handleSaveSheet = useCallback((sheetNameOrObj, headerObjects, pinnedHeaders) => {
    if (isSheetModalEditMode) {
      const newSheetName = typeof sheetNameOrObj === "string" ? sheetNameOrObj : sheetNameOrObj.sheetName;
      setSheets((prevSheets) => ({
        ...prevSheets,
        allSheets: prevSheets.allSheets.map((sheet) =>
          sheet.sheetName === activeSheetName
            ? {
                ...sheet,
                sheetName: newSheetName || sheet.sheetName,
                headers: headerObjects,
                pinnedHeaders: pinnedHeaders || sheet.pinnedHeaders,
                rows: sheet.rows,
                isActive: true,
              }
            : { ...sheet, isActive: false }
        ),
        structure: prevSheets.structure.map((item) =>
          item.sheetName === activeSheetName
            ? { sheetName: newSheetName || item.sheetName }
            : item.folderName
            ? {
                ...item,
                sheets: item.sheets.map((s) => (s === activeSheetName ? newSheetName || s : s)),
              }
            : item
        ),
      }));
    } else {
      const newSheetName = sheetNameOrObj;
      if (newSheetName) {
        setSheets((prevSheets) => ({
          ...prevSheets,
          allSheets: [
            ...prevSheets.allSheets.map((sheet) => ({ ...sheet, isActive: false })),
            {
              sheetName: newSheetName,
              headers: headerObjects,
              pinnedHeaders: pinnedHeaders || [],
              rows: [],
              isActive: true,
            },
          ],
          structure: [...prevSheets.structure, { sheetName: newSheetName }],
        }));
      } else {
        alert("Please provide a sheet name.");
        return;
      }
    }
    setIsSheetModalOpen(false);
  }, [isSheetModalEditMode, activeSheetName, setSheets]);

  const handlePinToggle = useCallback((headerKey) => {
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
  }, [activeSheetName, setSheets]);

  const handleApplyFilters = useCallback((newFilters) => setFilters(newFilters), []);

  const handleRowClick = useCallback((rowData) => {}, []);

  const handleCardSave = useCallback((updatedRow) => {
    setCards((prevCards) =>
      prevCards.map((card) => (card[resolvedHeaders[0]?.key] === updatedRow[resolvedHeaders[0]?.key] ? updatedRow : card))
    );
    setSheets((prevSheets) => ({
      ...prevSheets,
      allSheets: prevSheets.allSheets.map((sheet) =>
        sheet.sheetName === activeSheetName
          ? {
              ...sheet,
              rows: sheet.rows.map((id) =>
                id === updatedRow[resolvedHeaders[0]?.key] ? updatedRow[resolvedHeaders[0]?.key] : id
              ),
            }
          : sheet
      ),
    }));
  }, [activeSheetName, setCards, setSheets, resolvedHeaders]);

  const handleDelete = useCallback((rowData) => {
    setCards((prevCards) => prevCards.filter((card) => card[resolvedHeaders[0]?.key] !== rowData[resolvedHeaders[0]?.key]));
    setSheets((prevSheets) => ({
      ...prevSheets,
      allSheets: prevSheets.allSheets.map((sheet) =>
        sheet.sheetName === activeSheetName
          ? { ...sheet, rows: sheet.rows.filter((id) => id !== rowData[resolvedHeaders[0]?.key]) }
          : sheet
      ),
    }));
  }, [activeSheetName, setCards, setSheets, resolvedHeaders]);

  const onEditSheet = useCallback(() => {
    setIsSheetModalEditMode(true);
    setIsSheetModalOpen(true);
  }, []);

  const onFilter = useCallback(() => setIsFilterModalOpen(true), []);

  // Updated to use sheets.structure for display order
  const sheetDisplayOrder = useMemo(() => {
    return sheets.structure.map((item) => item.sheetName || item.folderName);
  }, [sheets.structure]);

  return (
    <div className={styles.appContainer}>
      <AppHeader
        sheets={sheetDisplayOrder} // Use the ordered structure
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