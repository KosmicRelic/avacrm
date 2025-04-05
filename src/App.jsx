import { useContext, useState } from "react";
import SheetTemplate from "./Sheet Template/SheetTemplate";
import AppHeader from "./App Header/AppHeader";
import SheetModal from "./SheetModal/SheetModal";
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

  const activeSheet = sheets.find((sheet) => sheet.isActive);
  const activeSheetName = activeSheet?.sheetName;

  const resolvedHeaders = activeSheet?.headers.map((sheetHeader) => {
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

  const resolvedRows = activeSheet?.rows.map((leadId) =>
    cards.find((card) => card.leadId === leadId) || {}
  ) || [];

  const handleSheetChange = (sheetName) => {
    if (sheetName === "add-new-sheet") {
      setIsSheetModalEditMode(false);
      setIsSheetModalOpen(true);
    } else if (sheetName) {
      setSheets((prevSheets) =>
        prevSheets.map((sheet) => ({
          ...sheet,
          isActive: sheet.sheetName === sheetName,
        }))
      );
    }
  };

  const handleSaveSheet = (sheetNameOrObj, headerObjects, pinnedHeaders) => {
    if (isSheetModalEditMode) {
      const newSheetName = typeof sheetNameOrObj === "string" ? sheetNameOrObj : sheetNameOrObj.sheetName;
      setSheets((prevSheets) => {
        const updatedSheet = {
          ...activeSheet,
          headers: headerObjects,
          pinnedHeaders: pinnedHeaders || activeSheet.pinnedHeaders,
          rows: activeSheet.rows,
          isActive: true,
        };
        if (newSheetName && newSheetName !== activeSheetName) {
          return prevSheets.map((sheet) =>
            sheet.sheetName === activeSheetName
              ? { ...updatedSheet, sheetName: newSheetName }
              : { ...sheet, isActive: false }
          );
        }
        return prevSheets.map((sheet) =>
          sheet.sheetName === activeSheetName ? updatedSheet : { ...sheet, isActive: false }
        );
      });
    } else {
      const newSheetName = sheetNameOrObj;
      if (newSheetName) {
        setSheets((prevSheets) => [
          ...prevSheets.map((sheet) => ({ ...sheet, isActive: false })),
          {
            sheetName: newSheetName,
            headers: headerObjects,
            pinnedHeaders: pinnedHeaders || [],
            rows: [],
            isActive: true,
          },
        ]);
      } else {
        alert("Please provide a sheet name.");
        return;
      }
    }
    setIsSheetModalOpen(false);
  };

  const handlePinToggle = (headerKey) => {
    setSheets((prevSheets) =>
      prevSheets.map((sheet) =>
        sheet.sheetName === activeSheetName
          ? {
              ...sheet,
              pinnedHeaders: sheet.pinnedHeaders.includes(headerKey)
                ? sheet.pinnedHeaders.filter((h) => h !== headerKey)
                : [...sheet.pinnedHeaders, headerKey],
            }
          : sheet
      )
    );
  };

  const handleApplyFilters = (newFilters) => setFilters(newFilters);

  const handleRowClick = (rowData) => {
    console.log("App: Row clicked:", rowData); // Debug
  };

  const handleCardSave = (updatedRow) => {
    console.log("Saving:", updatedRow);
    setCards((prevCards) =>
      prevCards.map((card) => (card.leadId === updatedRow.leadId ? updatedRow : card))
    );
    setSheets((prevSheets) =>
      prevSheets.map((sheet) =>
        sheet.sheetName === activeSheetName
          ? {
              ...sheet,
              rows: sheet.rows.map((leadId) =>
                leadId === updatedRow.leadId ? updatedRow.leadId : leadId
              ),
            }
          : sheet
      )
    );
  };

  const handleDelete = (rowData) => {
    console.log("Deleting:", rowData);
    setCards((prevCards) => prevCards.filter((card) => card.leadId !== rowData.leadId));
    setSheets((prevSheets) =>
      prevSheets.map((sheet) =>
        sheet.sheetName === activeSheetName
          ? { ...sheet, rows: sheet.rows.filter((leadId) => leadId !== rowData.leadId) }
          : sheet
      )
    );
  };

  return (
    <div className={styles.appContainer}>
      <AppHeader
        sheets={sheets.map((sheet) => sheet.sheetName)}
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
            activeSheetName={activeSheetName}
            onSheetChange={handleSheetChange}
            onEditSheet={() => {
              setIsSheetModalEditMode(true);
              setIsSheetModalOpen(true);
            }}
            onFilter={() => setIsFilterModalOpen(true)}
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