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
      pinnedHeaders: ["LEAD ID", "NAME"],
      rows: [
        {
          "LEAD ID": "100001",
          "NAME": "Periklis Papadopoulos",
          "PHONE": "6986600023",
          "EMAIL": "periklis@example.com",
          "LEAD SCORE": "80",
          "NEXT ACTIONS": "Call back",
          "FOLLOW UP DATE": "2025-04-05",
        },
        {
          "LEAD ID": "100002",
          "NAME": "Maria Ioannou",
          "PHONE": "6977554321",
          "EMAIL": "maria@example.com",
          "LEAD SCORE": "90",
          "NEXT ACTIONS": "Send offer",
          "FOLLOW UP DATE": "2025-04-06",
        },
        {
          "LEAD ID": "100003",
          "NAME": "Dimitris Georgiou",
          "PHONE": "6999887766",
          "EMAIL": "dimitris@example.com",
          "LEAD SCORE": "75",
          "NEXT ACTIONS": "Follow-up email",
          "FOLLOW UP DATE": "2025-04-07",
        },
        {
          "LEAD ID": "100004",
          "NAME": "Eleni Christodoulou",
          "PHONE": "6933445566",
          "EMAIL": "eleni@example.com",
          "LEAD SCORE": "85",
          "NEXT ACTIONS": "Schedule meeting",
          "FOLLOW UP DATE": "2025-04-08",
        },
        {
          "LEAD ID": "100005",
          "NAME": "Nikos Pappas",
          "PHONE": "6955332211",
          "EMAIL": "nikos@example.com",
          "LEAD SCORE": "60",
          "NEXT ACTIONS": "Send reminder",
          "FOLLOW UP DATE": "2025-04-09",
        },
        {
          "LEAD ID": "100006",
          "NAME": "Georgia Alexiou",
          "PHONE": "6900112233",
          "EMAIL": "georgia@example.com",
          "LEAD SCORE": "95",
          "NEXT ACTIONS": "Close deal",
          "FOLLOW UP DATE": "2025-04-10",
        },
        {
          "LEAD ID": "100007",
          "NAME": "Kostas Leventis",
          "PHONE": "6999001122",
          "EMAIL": "kostas@example.com",
          "LEAD SCORE": "70",
          "NEXT ACTIONS": "Cold call",
          "FOLLOW UP DATE": "2025-04-11",
        },
        {
          "LEAD ID": "100008",
          "NAME": "Sofia Karamanou",
          "PHONE": "6977889900",
          "EMAIL": "sofia@example.com",
          "LEAD SCORE": "88",
          "NEXT ACTIONS": "Send brochure",
          "FOLLOW UP DATE": "2025-04-12",
        },
        {
          "LEAD ID": "100009",
          "NAME": "Michalis Xanthopoulos",
          "PHONE": "6933556677",
          "EMAIL": "michalis@example.com",
          "LEAD SCORE": "78",
          "NEXT ACTIONS": "Call and pitch",
          "FOLLOW UP DATE": "2025-04-13",
        },
        {
          "LEAD ID": "100010",
          "NAME": "Vasiliki Antoniou",
          "PHONE": "6911223344",
          "EMAIL": "vasiliki@example.com",
          "LEAD SCORE": "92",
          "NEXT ACTIONS": "Confirm interest",
          "FOLLOW UP DATE": "2025-04-14",
        },
        {
          "LEAD ID": "100011",
          "NAME": "Panagiotis Kotsis",
          "PHONE": "6977112233",
          "EMAIL": "panagiotis@example.com",
          "LEAD SCORE": "82",
          "NEXT ACTIONS": "Send demo",
          "FOLLOW UP DATE": "2025-04-15",
        },
        {
          "LEAD ID": "100012",
          "NAME": "Eftychia Douka",
          "PHONE": "6988223344",
          "EMAIL": "eftychia@example.com",
          "LEAD SCORE": "67",
          "NEXT ACTIONS": "Follow up call",
          "FOLLOW UP DATE": "2025-04-16",
        },
        {
          "LEAD ID": "100013",
          "NAME": "Spyros Mavridis",
          "PHONE": "6999334455",
          "EMAIL": "spyros@example.com",
          "LEAD SCORE": "79",
          "NEXT ACTIONS": "Send case study",
          "FOLLOW UP DATE": "2025-04-17",
        },
        {
          "LEAD ID": "100014",
          "NAME": "Ioanna Fragou",
          "PHONE": "6900445566",
          "EMAIL": "ioanna@example.com",
          "LEAD SCORE": "91",
          "NEXT ACTIONS": "Book consultation",
          "FOLLOW UP DATE": "2025-04-18",
        },
        {
          "LEAD ID": "100015",
          "NAME": "Theodoros Karas",
          "PHONE": "6911556677",
          "EMAIL": "theodoros@example.com",
          "LEAD SCORE": "73",
          "NEXT ACTIONS": "Negotiate pricing",
          "FOLLOW UP DATE": "2025-04-19",
        },
        {
          "LEAD ID": "100016",
          "NAME": "Aris Liakos",
          "PHONE": "6922667788",
          "EMAIL": "aris@example.com",
          "LEAD SCORE": "86",
          "NEXT ACTIONS": "Arrange free trial",
          "FOLLOW UP DATE": "2025-04-20",
        },
        {
          "LEAD ID": "100017",
          "NAME": "Eirini Konstantinou",
          "PHONE": "6933778899",
          "EMAIL": "eirini@example.com",
          "LEAD SCORE": "94",
          "NEXT ACTIONS": "Finalize contract",
          "FOLLOW UP DATE": "2025-04-21",
        },
        {
          "LEAD ID": "100018",
          "NAME": "Leonidas Stavrou",
          "PHONE": "6944889900",
          "EMAIL": "leonidas@example.com",
          "LEAD SCORE": "68",
          "NEXT ACTIONS": "Send more info",
          "FOLLOW UP DATE": "2025-04-22",
        },
        {
          "LEAD ID": "100019",
          "NAME": "Zoi Manou",
          "PHONE": "6955990011",
          "EMAIL": "zoi@example.com",
          "LEAD SCORE": "83",
          "NEXT ACTIONS": "Check availability",
          "FOLLOW UP DATE": "2025-04-23",
        },
        {
          "LEAD ID": "100020",
          "NAME": "Alexandros Kouris",
          "PHONE": "6966001122",
          "EMAIL": "alexandros@example.com",
          "LEAD SCORE": "87",
          "NEXT ACTIONS": "Confirm details",
          "FOLLOW UP DATE": "2025-04-24",
        },
        {
          "LEAD ID": "100021",
          "NAME": "Christina Makri",
          "PHONE": "6977112233",
          "EMAIL": "christina@example.com",
          "LEAD SCORE": "65",
          "NEXT ACTIONS": "Send product list",
          "FOLLOW UP DATE": "2025-04-25",
        },
        {
          "LEAD ID": "100022",
          "NAME": "Giannis Fotiadis",
          "PHONE": "6988223344",
          "EMAIL": "giannis@example.com",
          "LEAD SCORE": "89",
          "NEXT ACTIONS": "Request review",
          "FOLLOW UP DATE": "2025-04-26",
        }
      ],
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
      />
      <LeadsTemplate
        headerNames={sheets[selectedSheet].headerNames}
        rows={sheets[selectedSheet].rows}
        onEditSheet={() => setIsEditModalOpen(true)}
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