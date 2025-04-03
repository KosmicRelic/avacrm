import { useContext, useState } from "react";
import SheetTemplate from "./Sheet Template/SheetTemplate";
import AppHeader from "./App Header/AppHeader";
import SheetModal from "./SheetModal/SheetModal";
import FilterModal from "./FilterModal/FilterModal";
import { MainContext } from "./Contexts/MainContext";
import ProfileModal from "./App Header/ProfileModal/ProfileModal";
import HeadersModal from "./HeadersModal/HeaderModal";

function App() {
    const { sheets, setSheets, cards, headers } = useContext(MainContext);
    const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
    const [isSheetModalEditMode, setIsSheetModalEditMode] = useState(false);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [isHeadersModalOpen, setIsHeadersModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [filters, setFilters] = useState({});

    const activeSheetName = Object.keys(sheets).find((name) => sheets[name].isActive);
    const activeSheet = sheets[activeSheetName];

    const resolvedHeaders = activeSheet.headers.map((sheetHeader) => {
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
    });

    const resolvedRows = activeSheet.rows.map((leadId) =>
        cards.find((card) => card.leadId === leadId) || {}
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

    const handleSaveSheet = (sheetNameOrObj, headerObjects, pinnedHeaders) => {
        if (isSheetModalEditMode) {
            const newSheetName = sheetNameOrObj.sheetName;
            setSheets((prevSheets) => {
                const updatedSheet = {
                    ...prevSheets[activeSheetName],
                    headers: headerObjects,
                    pinnedHeaders: pinnedHeaders || prevSheets[activeSheetName].pinnedHeaders,
                    rows: prevSheets[activeSheetName].rows,
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
            const newSheetName = sheetNameOrObj;
            if (newSheetName) {
                setSheets((prevSheets) => {
                    const newSheets = { ...prevSheets };
                    Object.keys(newSheets).forEach((name) => {
                        newSheets[name].isActive = false;
                    });
                    newSheets[newSheetName] = {
                        headers: headerObjects,
                        pinnedHeaders: pinnedHeaders || [],
                        rows: [],
                        isActive: true,
                    };
                    return newSheets;
                });
            } else {
                alert("Please provide a sheet name.");
                return;
            }
        }
        setIsSheetModalOpen(false);
    };

    const handlePinToggle = (headerKey) => {
        setSheets((prevSheets) => {
            const currentPinned = prevSheets[activeSheetName].pinnedHeaders || [];
            const newPinned = currentPinned.includes(headerKey)
                ? currentPinned.filter((h) => h !== headerKey)
                : [...currentPinned, headerKey];
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
                setIsProfileModalOpen={setIsProfileModalOpen}
            />
            <SheetTemplate
                headers={resolvedHeaders}
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
                    headers={resolvedHeaders}
                    pinnedHeaders={isSheetModalEditMode ? activeSheet.pinnedHeaders || [] : []}
                    onSave={handleSaveSheet}
                    onPinToggle={handlePinToggle}
                    onClose={() => setIsSheetModalOpen(false)}
                />
            )}
            {isFilterModalOpen && (
                <FilterModal
                    headers={resolvedHeaders}
                    rows={resolvedRows}
                    onApply={handleApplyFilters}
                    onClose={() => setIsFilterModalOpen(false)}
                />
            )}
            {isHeadersModalOpen && (
                <HeadersModal
                    onClose={() => setIsHeadersModalOpen(false)}
                />
            )}
            {isProfileModalOpen && (
                <ProfileModal
                    onClose={() => setIsProfileModalOpen(false)}
                    onManageHeaders={() => {
                        setIsHeadersModalOpen(true);
                        setIsProfileModalOpen(false);
                    }}
                />
            )}
        </div>
    );
}

export default App;