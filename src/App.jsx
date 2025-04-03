import { useContext, useState } from "react";
import LeadsTemplate from "./Leads Template/LeadsTemplate";
import AppHeader from "./App Header/AppHeader";
import SheetModal from "./SheetModal/SheetModal";
import FilterModal from "./FilterModal/FilterModal";
import { MainContext } from "./Contexts/MainContext";

function App() {
  const { sheets, setSheets, selectedSheet, setSelectedSheet } = useContext(MainContext);
  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
  const [isSheetModalEditMode, setIsSheetModalEditMode] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState({});

  const handleSheetChange = (sheetName) => {
    if (sheetName === "add-new-sheet") {
      setIsSheetModalEditMode(false);
      setIsSheetModalOpen(true);
    } else {
      setSelectedSheet(sheetName);
    }
  };

  const handleSaveSheet = (sheetNameOrHeaders, headers, pinnedHeaders) => {
    if (isSheetModalEditMode) {
      // Edit mode: sheetNameOrHeaders is an object with headers and sheetName
      const newSheetName = sheetNameOrHeaders.sheetName;
      setSheets((prevSheets) => {
        const updatedSheet = {
          ...prevSheets[selectedSheet],
          headers: sheetNameOrHeaders.headers,
          pinnedHeaders: pinnedHeaders || prevSheets[selectedSheet].pinnedHeaders,
          rows: prevSheets[selectedSheet].rows.map((row) => {
            const newRow = {};
            sheetNameOrHeaders.headers.forEach((header) => {
              newRow[header.name] = row[header.name] || "";
            });
            return newRow;
          }),
        };

        if (newSheetName && newSheetName !== selectedSheet) {
          const newSheets = { ...prevSheets };
          delete newSheets[selectedSheet];
          newSheets[newSheetName] = updatedSheet;
          setSelectedSheet(newSheetName);
          return newSheets;
        }
        return {
          ...prevSheets,
          [selectedSheet]: updatedSheet,
        };
      });
    } else {
      // Add mode
      if (sheetNameOrHeaders && headers.length > 0) {
        setSheets((prevSheets) => ({
          ...prevSheets,
          [sheetNameOrHeaders]: {
            headers,
            pinnedHeaders: pinnedHeaders || [],
            rows: [],
          },
        }));
        setSelectedSheet(sheetNameOrHeaders);
      } else {
        alert("Please provide a sheet name and at least one header.");
        return;
      }
    }
    setIsSheetModalOpen(false);
  };

  const handlePinToggle = (headerName) => {
    setSheets((prevSheets) => {
      const currentPinned = prevSheets[selectedSheet].pinnedHeaders || [];
      const newPinned = currentPinned.includes(headerName)
        ? currentPinned.filter((h) => h !== headerName)
        : [...currentPinned, headerName];
      return {
        ...prevSheets,
        [selectedSheet]: {
          ...prevSheets[selectedSheet],
          pinnedHeaders: newPinned,
        },
      };
    });
  };

  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters);
  };

  return (
    <div>
      <AppHeader
        sheets={Object.keys(sheets)}
        selectedSheet={selectedSheet}
        onSheetChange={handleSheetChange}
        onFilter={() => setIsFilterModalOpen(true)}
      />
      <LeadsTemplate
        headers={sheets[selectedSheet].headers}
        rows={sheets[selectedSheet].rows}
        filters={filters}
        onEditSheet={() => {
          setIsSheetModalEditMode(true);
          setIsSheetModalOpen(true);
        }}
      />
      {isSheetModalOpen && (
        <SheetModal
          isEditMode={isSheetModalEditMode}
          sheetName={isSheetModalEditMode ? selectedSheet : ""}
          headers={isSheetModalEditMode ? sheets[selectedSheet].headers : []}
          pinnedHeaders={isSheetModalEditMode ? sheets[selectedSheet].pinnedHeaders || [] : []}
          onSave={handleSaveSheet}
          onPinToggle={handlePinToggle}
          onClose={() => setIsSheetModalOpen(false)}
        />
      )}
      {isFilterModalOpen && (
        <FilterModal
          headers={sheets[selectedSheet].headers}
          rows={sheets[selectedSheet].rows}
          onApply={handleApplyFilters}
          onClose={() => setIsFilterModalOpen(false)}
        />
      )}
    </div>
  );
}

export default App;