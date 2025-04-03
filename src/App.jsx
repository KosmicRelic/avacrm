import { useState } from "react";
import styles from "./App.module.css";
import LeadsTemplate from "./Leads Template/LeadsTemplate";
import AppHeader from "./App Header/AppHeader";
import EditSheetModal from "./Edit Sheet Modal/EditSheetModal";
import AddSheetModal from "./AddSheetModal/AddSheetModal";

function App() {
  const [sheets, setSheets] = useState({
    Leads: {
      headerNames: ["LEAD ID", "NAME", "PHONE", "EMAIL", "LEAD SCORE", "NEXT ACTIONS", "FOLLOW UP DATE"],
      pinnedHeaders: ["LEAD ID", "NAME"], // Add pinnedHeaders per sheet
      rows: [...Array(40)].map(() => ({
        "LEAD ID": "1234567899876",
        "NAME": "Periklis Papadopoulos",
        "PHONE": "6986600023",
        "EMAIL": "john@example.com",
        "LEAD SCORE": "80",
        "NEXT ACTIONS": "Call back",
        "FOLLOW UP DATE": "2025-04-05",
      })),
    },
  });
  const [selectedSheet, setSelectedSheet] = useState("Leads");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const handleSheetChange = (sheetName) => {
    if (sheetName === "add-new-sheet") {
      setIsAddModalOpen(true);
    } else {
      setSelectedSheet(sheetName);
    }
  };

  const handleSaveHeaders = (newHeaders) => {
    setSheets((prevSheets) => ({
      ...prevSheets,
      [selectedSheet]: {
        ...prevSheets[selectedSheet],
        headerNames: newHeaders,
        rows: prevSheets[selectedSheet].rows.map((row) => {
          const newRow = {};
          newHeaders.forEach((header) => {
            newRow[header] = row[header] || "";
          });
          return newRow;
        }),
      },
    }));
  };

  const handlePinToggle = (header) => {
    setSheets((prevSheets) => {
      const currentPinned = prevSheets[selectedSheet].pinnedHeaders || [];
      const newPinned = currentPinned.includes(header)
        ? currentPinned.filter((h) => h !== header)
        : [...currentPinned, header];
      return {
        ...prevSheets,
        [selectedSheet]: {
          ...prevSheets[selectedSheet],
          pinnedHeaders: newPinned,
        },
      };
    });
  };

  const handleAddSheet = (sheetName, headerNames, pinnedHeaders = []) => {
    setSheets((prevSheets) => ({
      ...prevSheets,
      [sheetName]: {
        headerNames,
        pinnedHeaders, // Store pinned headers for the new sheet
        rows: [],
      },
    }));
    setSelectedSheet(sheetName);
  };

  return (
    <div>
      <AppHeader
        sheets={Object.keys(sheets)}
        selectedSheet={selectedSheet}
        onSheetChange={handleSheetChange}
        onEditSheet={() => setIsEditModalOpen(true)}
      />
      <LeadsTemplate
        headerNames={sheets[selectedSheet].headerNames}
        rows={sheets[selectedSheet].rows}
      />
      {isEditModalOpen && (
        <EditSheetModal
          headerNames={sheets[selectedSheet].headerNames}
          pinnedHeaders={sheets[selectedSheet].pinnedHeaders || []}
          onSave={handleSaveHeaders}
          onPinToggle={handlePinToggle}
          onClose={() => setIsEditModalOpen(false)}
        />
      )}
      {isAddModalOpen && (
        <AddSheetModal
          onSave={handleAddSheet}
          onClose={() => setIsAddModalOpen(false)}
        />
      )}
    </div>
  );
}

export default App;