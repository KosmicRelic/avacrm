import { createContext, useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";

export const MainContext = createContext();

export const MainContextProvider = ({ children }) => {
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme) return storedTheme === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const themeRef = useRef(isDarkTheme ? "dark" : "light");

  const [sheets, setSheets] = useState({
    allSheets: [
      {
        id: "primarySheet",
        sheetName: "All Cards",
        headers: [
          { key: "id", visible: true, hidden: false },
          { key: "name", visible: true, hidden: false },
          { key: "phone", visible: true, hidden: false },
          { key: "email", visible: true, hidden: false },
          { key: "leadScore", visible: true, hidden: false },
          { key: "nextActions", visible: true, offcanvas: true },
          { key: "followUpDate", visible: true, hidden: false },
        ],
        pinnedHeaders: ["id", "name"],
        rows: [
          "100001",
          "100002",
          "100003",
          "100004",
          "100005",
          "100006",
          "100007",
          "100008",
          "100009",
          "100010",
          "100011",
          "100012",
          "100013",
          "100014",
          "100015",
          "100016",
          "100017",
          "100018",
          "100019",
          "100020",
        ],
        isActive: true,
      },
      {
        id: "sheet2",
        sheetName: "Business Partners",
        headers: [
          { key: "id", visible: true, hidden: false },
          { key: "fullName", visible: true, hidden: false },
          { key: "address", visible: true, hidden: false },
          { key: "status", visible: true, hidden: false },
        ],
        pinnedHeaders: ["id"],
        rows: [],
        isActive: false,
      },
      {
        id: "sheet3",
        sheetName: "Vendors",
        headers: [
          { key: "id", visible: true, hidden: false },
          { key: "name", visible: true, hidden: false },
          { key: "contact", visible: true, hidden: false },
        ],
        pinnedHeaders: ["id"],
        rows: [],
        isActive: false,
      },
      {
        id: "sheet4",
        sheetName: "Tasks",
        headers: [
          { key: "id", visible: true, hidden: false },
          { key: "description", visible: true, hidden: false },
          { key: "dueDate", visible: true, hidden: false },
          { key: "priority", visible: true, hidden: false },
        ],
        pinnedHeaders: ["id"],
        rows: [],
        isActive: false,
      },
    ],
    structure: [
      { sheetName: "All Cards" },
      {
        folderName: "Partners",
        sheets: ["Business Partners", "Vendors"],
      },
      { sheetName: "Tasks" },
    ],
  });

  const [cards, setCards] = useState([
    {
      id: "100001",
      typeOfCards: "Leads",
      name: "Periklis Papadopoulos",
      phone: "6986600023",
      email: "periklis@example.com",
      leadScore: "80",
      nextActions: "Call back",
      followUpDate: "2025-04-05",
    },
    {
      id: "100002",
      typeOfCards: "Leads",
      name: "Maria Ioannou",
      phone: "6977554321",
      email: "maria@example.com",
      leadScore: "90",
      nextActions: "Send offer",
      followUpDate: "2025-04-06",
    },
    {
      id: "100003",
      typeOfCards: "Leads",
      name: "Dimitris Georgiou",
      phone: "6999887766",
      email: "dimitris@example.com",
      leadScore: "75",
      nextActions: "Follow-up email",
      followUpDate: "2025-04-07",
    },
    {
      id: "100004",
      typeOfCards: "Leads",
      name: "Eleni Christodoulou",
      phone: "6933445566",
      email: "eleni@example.com",
      leadScore: "85",
      nextActions: "Schedule meeting",
      followUpDate: "2025-04-08",
    },
    {
      id: "100005",
      typeOfCards: "Leads",
      name: "Nikos Pappas",
      phone: "6955332211",
      email: "nikos@example.com",
      leadScore: "60",
      nextActions: "Send reminder",
      followUpDate: "2025-04-09",
    },
    {
      id: "100006",
      typeOfCards: "Leads",
      name: "Georgia Alexiou",
      phone: "6900112233",
      email: "georgia@example.com",
      leadScore: "95",
      nextActions: "Close deal",
      followUpDate: "2025-04-10",
    },
    {
      id: "100007",
      typeOfCards: "Leads",
      name: "Kostas Leventis",
      phone: "6999001122",
      email: "kostas@example.com",
      leadScore: "70",
      nextActions: "Cold call",
      followUpDate: "2025-04-11",
    },
    {
      id: "100008",
      typeOfCards: "Leads",
      name: "Sofia Karamanou",
      phone: "6977889900",
      email: "sofia@example.com",
      leadScore: "88",
      nextActions: "Send brochure",
      followUpDate: "2025-04-12",
    },
    {
      id: "100009",
      typeOfCards: "Leads",
      name: "Michalis Xanthopoulos",
      phone: "6933556677",
      email: "michalis@example.com",
      leadScore: "78",
      nextActions: "Call and pitch",
      followUpDate: "2025-04-13",
    },
    {
      id: "100010",
      typeOfCards: "Leads",
      name: "Vasiliki Antoniou",
      phone: "6911223344",
      email: "vasiliki@example.com",
      leadScore: "92",
      nextActions: "Confirm interest",
      followUpDate: "2025-04-14",
    },
    {
      id: "100011",
      typeOfCards: "Leads",
      name: "Giannis Korres",
      phone: "6901122334",
      email: "giannis@example.com",
      leadScore: "73",
      nextActions: "Send follow-up",
      followUpDate: "2025-04-15",
    },
    {
      id: "100012",
      typeOfCards: "Leads",
      name: "Katerina Liosi",
      phone: "6944332211",
      email: "katerina@example.com",
      leadScore: "81",
      nextActions: "Call again",
      followUpDate: "2025-04-16",
    },
    {
      id: "100013",
      typeOfCards: "Leads",
      name: "Panagiotis Rizos",
      phone: "6988112233",
      email: "panagiotis@example.com",
      leadScore: "68",
      nextActions: "Schedule call",
      followUpDate: "2025-04-17",
    },
    {
      id: "100014",
      typeOfCards: "Leads",
      name: "Anna Petridou",
      phone: "6990001122",
      email: "anna@example.com",
      leadScore: "94",
      nextActions: "Close deal",
      followUpDate: "2025-04-18",
    },
    {
      id: "100015",
      typeOfCards: "Leads",
      name: "Stelios Nikas",
      phone: "6977223344",
      email: "stelios@example.com",
      leadScore: "76",
      nextActions: "Final meeting",
      followUpDate: "2025-04-19",
    },
    {
      id: "100016",
      typeOfCards: "Leads",
      name: "Eirini Valasi",
      phone: "6955887766",
      email: "eirini@example.com",
      leadScore: "89",
      nextActions: "Confirm schedule",
      followUpDate: "2025-04-20",
    },
    {
      id: "100017",
      typeOfCards: "Leads",
      name: "Apostolos Zannis",
      phone: "6900332211",
      email: "apostolos@example.com",
      leadScore: "84",
      nextActions: "Send contract",
      followUpDate: "2025-04-21",
    },
    {
      id: "100018",
      typeOfCards: "Leads",
      name: "Ioanna Michou",
      phone: "6933221100",
      email: "ioanna@example.com",
      leadScore: "91",
      nextActions: "Onboard",
      followUpDate: "2025-04-22",
    },
    {
      id: "100019",
      typeOfCards: "Leads",
      name: "Christos Makris",
      phone: "6988776655",
      email: "christos@example.com",
      leadScore: "67",
      nextActions: "Check-in call",
      followUpDate: "2025-04-23",
    },
    {
      id: "100020",
      typeOfCards: "Leads",
      name: "Zoi Karra",
      phone: "6911220088",
      email: "zoi@example.com",
      leadScore: "86",
      nextActions: "Upsell offer",
      followUpDate: "2025-04-24",
    },
  ]);

  const [headers, setHeaders] = useState([
    { key: "typeOfCards", name: "TYPE OF CARDS", type: "text" },
    { key: "id", name: "ID", type: "number" },
    { key: "name", name: "NAME", type: "text" },
    { key: "phone", name: "PHONE", type: "text" },
    { key: "email", name: "EMAIL", type: "text" },
    { key: "leadScore", name: "LEAD SCORE", type: "number" },
    {
      key: "nextActions",
      name: "NEXT ACTION",
      type: "dropdown",
      options: [
        "Call back",
        "Send offer",
        "Follow-up email",
        "Schedule meeting",
        "Close deal",
      ],
    },
    { key: "followUpDate", name: "FOLLOW UP DATE", type: "date" },
    { key: "fullName", name: "FULL NAME", type: "text" },
    { key: "address", name: "ADDRESS", type: "text" },
    {
      key: "status",
      name: "STATUS",
      type: "dropdown",
      options: ["Active", "Inactive", "Pending"],
    },
    { key: "contact", name: "CONTACT", type: "text" },
    { key: "description", name: "DESCRIPTION", type: "text" },
    { key: "dueDate", name: "DUE DATE", type: "date" },
    {
      key: "priority",
      name: "PRIORITY",
      type: "dropdown",
      options: ["High", "Medium", "Low"],
    },
  ]);

  const [cardTemplates, setCardTemplates] = useState([
    {
      name: "Leads",
      typeOfCards: "Leads",
      sections: [
        {
          name: "Contact Information",
          keys: ["id", "name", "phone", "email", "leadScore", "nextActions", "followUpDate"],
        },
        {
          name: "Sales Process",
          keys: [],
        },
      ],
    },
    {
      name: "Business",
      typeOfCards: "Business",
      sections: [
        {
          name: "Business Details",
          keys: ["id", "fullName", "address", "status"],
        },
      ],
    },
  ]);

  const [tempData, setTempData] = useState(null);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(null);
  const [editMode, setEditMode] = useState(false);

  // Sync "All Cards" sheet rows with all card IDs
  useEffect(() => {
    setSheets((prev) => ({
      ...prev,
      allSheets: prev.allSheets.map((sheet) =>
        sheet.id === "primarySheet"
          ? { ...sheet, rows: cards.map((card) => card.id) }
          : sheet
      ),
    }));
  }, [cards]);

  useEffect(() => {
    themeRef.current = isDarkTheme ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", themeRef.current);
    document.body.style.backgroundColor = isDarkTheme ? "black" : "rgb(243, 242, 248)";
    document.body.style.color = isDarkTheme ? "rgb(243, 242, 248)" : "rgb(29, 29, 31)";
    if (localStorage.getItem("theme") !== null) {
      localStorage.setItem("theme", themeRef.current);
    }
  }, [isDarkTheme]);

    const [dashboards, setDashboards] = useState([
      {
        id: 'dashboard-1',
        widgets: [
          {
            id: 'widget-revenue-1',
            size: 'verySmall',
            title: 'Total Revenue',
            data: '$10,000',
            section: 'Financials',
            position: { row: 0, col: 1 },
          },
          {
            id: 'widget-revenue-3',
            size: 'small',
            title: 'Total Revenue',
            data: '$10,000',
            section: 'Financials',
            position: { row: 0, col: 0 },
          },
          {
            id: 'widget-pending-4',
            size: 'verySmall',
            title: 'Pending Payouts',
            data: '$1,200',
            section: 'Financials',
            position: { row: 1, col: 1 },
          },
          {
            id: 'widget-pending-2',
            size: 'medium',
            title: 'Pending Payouts',
            data: '$1,200',
            section: 'Financials',
            position: { row: 2, col: 0 },
          },
        ],
      },
      {
        id: 'dashboard-2',
        widgets: [
          {
            id: 'widget-close-rate',
            size: 'medium',
            title: 'Close Rate',
            data: '15%',
            section: 'Lead Metrics',
            position: { row: 0, col: 0 },
          },
          {
            id: 'widget-cost-per-lead',
            size: 'small',
            title: 'Cost Per Lead',
            data: '$25.00',
            section: 'Lead Metrics',
            position: { row: 2, col: 0 },
          },
          {
            id: 'widget-bottleneck',
            size: 'verySmall',
            title: 'Bottleneck',
            data: 'Low close rate',
            section: 'Lead Metrics',
            position: { row: 2, col: 1 },
          },
        ],
      },
      {
        id: 'dashboard-3',
        widgets: [
          {
            id: 'widget-campaign-roi',
            size: 'small',
            title: 'Campaign ROI',
            data: '2.5x',
            section: 'Marketing',
            position: { row: 0, col: 0 },
          },
          {
            id: 'widget-top-campaign-1',
            size: 'small',
            title: 'Top Campaign: FB Ad',
            data: '5 leads, $20/lead',
            section: 'Marketing',
            position: { row: 0, col: 1 },
          },
          {
            id: 'widget-top-campaign-2',
            size: 'small',
            title: 'Top Campaign: Google Ad',
            data: '3 leads, $25/lead',
            section: 'Marketing',
            position: { row: 2, col: 0 },
          },
          {
            id: 'widget-campaign-status',
            size: 'verySmall',
            title: 'Campaign Status',
            data: 'Active',
            section: 'Marketing',
            position: { row: 2, col: 1 },
          },
        ],
      },
    ]);
  
  return (
    <MainContext.Provider
      value={{
        sheets,
        setSheets,
        cards,
        setCards,
        headers,
        setHeaders,
        isDarkTheme,
        setIsDarkTheme,
        themeRef,
        cardTemplates,
        setCardTemplates,
        tempData,
        setTempData,
        selectedTemplateIndex,
        setSelectedTemplateIndex,
        currentSectionIndex,
        setCurrentSectionIndex,
        editMode,
        setEditMode,
        dashboards,
        setDashboards,
      }}
    >
      {children}
    </MainContext.Provider>
  );
};

MainContextProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default MainContextProvider;