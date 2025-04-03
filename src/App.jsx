import { useContext, useState } from "react";
import SheetTemplate from "./Sheet Template/SheetTemplate";
import AppHeader from "./App Header/AppHeader";
import SheetModal from "./SheetModal/SheetModal";
import FilterModal from "./FilterModal/FilterModal";
import { MainContext } from "./Contexts/MainContext";

function App() {
    const { sheets, setSheets, cards } = useContext(MainContext);
    const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
    const [isSheetModalEditMode, setIsSheetModalEditMode] = useState(false);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [filters, setFilters] = useState({});

    const activeSheetName = Object.keys(sheets).find((name) => sheets[name].isActive);
    const activeSheet = sheets[activeSheetName];

    // Resolve rows by finding cards with matching IDs
    const resolvedRows = activeSheet.rows.map((id) =>
        cards.find((card) => card.id === id) || {}
    );

    const handleSheetChange = (sheetName) => {
        if (sheetName === "add-new-sheet") {
            setIsSheetModalEditMode(false);
            setIsSheetModalOpen(true);
        } else {
            setSheets((prevSheets) => {
                const newSheets = { ...prevSheets };
                Object.keys(newSheets).forEach((name) => {
                    newSheets[name].isActive = name === sheetName;
                });
                return newSheets;
            });
        }
    };

    const handleSaveSheet = (sheetNameOrHeaders, headers, pinnedHeaders) => {
        if (isSheetModalEditMode) {
            const newSheetName = sheetNameOrHeaders.sheetName;
            setSheets((prevSheets) => {
                const updatedSheet = {
                    ...prevSheets[activeSheetName],
                    headers: sheetNameOrHeaders.headers,
                    pinnedHeaders: pinnedHeaders || prevSheets[activeSheetName].pinnedHeaders,
                    rows: prevSheets[activeSheetName].rows, // Keep rows as IDs
                    isActive: true,
                };

                if (newSheetName && newSheetName !== activeSheetName) {
                    const newSheets = { ...prevSheets };
                    delete newSheets[activeSheetName];
                    newSheets[newSheetName] = updatedSheet;
                    return newSheets;
                }
                return {
                    ...prevSheets,
                    [activeSheetName]: updatedSheet,
                };
            });
        } else {
            if (sheetNameOrHeaders && headers.length > 0) {
                setSheets((prevSheets) => {
                    const newSheets = { ...prevSheets };
                    Object.keys(newSheets).forEach((name) => {
                        newSheets[name].isActive = false;
                    });
                    newSheets[sheetNameOrHeaders] = {
                        headers,
                        pinnedHeaders: pinnedHeaders || [],
                        rows: [], // New sheets start with empty ID list
                        isActive: true,
                    };
                    return newSheets;
                });
            } else {
                alert("Please provide a sheet name and at least one header.");
                return;
            }
        }
        setIsSheetModalOpen(false);
    };

    const handlePinToggle = (headerName) => {
        setSheets((prevSheets) => {
            const currentPinned = prevSheets[activeSheetName].pinnedHeaders || [];
            const newPinned = currentPinned.includes(headerName)
                ? currentPinned.filter((h) => h !== headerName)
                : [...currentPinned, headerName];
            return {
                ...prevSheets,
                [activeSheetName]: {
                    ...prevSheets[activeSheetName],
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
                activeSheet={activeSheetName}
                onSheetChange={handleSheetChange}
                onFilter={() => setIsFilterModalOpen(true)}
            />
            <SheetTemplate
                headers={activeSheet.headers}
                rows={resolvedRows}
                filters={filters}
                onEditSheet={() => {
                    setIsSheetModalEditMode(true);
                    setIsSheetModalOpen(true);
                }}
            />
            {isSheetModalOpen && (
                <SheetModal
                    isEditMode={isSheetModalEditMode}
                    sheetName={isSheetModalEditMode ? activeSheetName : ""}
                    headers={isSheetModalEditMode ? activeSheet.headers : []}
                    pinnedHeaders={isSheetModalEditMode ? activeSheet.pinnedHeaders || [] : []}
                    onSave={handleSaveSheet}
                    onPinToggle={handlePinToggle}
                    onClose={() => setIsSheetModalOpen(false)}
                />
            )}
            {isFilterModalOpen && (
                <FilterModal
                    headers={activeSheet.headers}
                    rows={resolvedRows}
                    onApply={handleApplyFilters}
                    onClose={() => setIsFilterModalOpen(false)}
                />
            )}
        </div>
    );
}

export default App;