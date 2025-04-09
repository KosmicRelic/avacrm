import { createContext, useState, useEffect, useRef } from "react";

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
        sheetName: "Leads",
        headers: [
          { key: "id", visible: true, hidden: false },
          { key: "name", visible: true, hidden: false },
          { key: "phone", visible: true, hidden: false },
          { key: "email", visible: true, hidden: false },
          { key: "leadScore", visible: true, hidden: false },
          { key: "nextActions", visible: true, hidden: false },
          { key: "followUpDate", visible: true, hidden: false },
        ],
        pinnedHeaders: ["id", "name"],
        rows: [
          "100001", "100002", "100003", "100004", "100005", "100006", "100007", "100008", "100009", "100010",
          "100011", "100012", "100013", "100014", "100015", "100016", "100017", "100018", "100019", "100020",
          "100021", "100022",
        ],
        isActive: true,
      },
      {
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
      { sheetName: "Leads" },
      {
        folderName: "Partners",
        sheets: ["Business Partners", "Vendors"],
      },
      { sheetName: "Tasks" },
    ],
  });

  const [cards, setCards] = useState([
    { id: "100001", name: "Periklis Papadopoulos", phone: "6986600023", email: "periklis@example.com", leadScore: "80", nextActions: "Call back", followUpDate: "2025-04-05" },
    { id: "100002", name: "Maria Ioannou", phone: "6977554321", email: "maria@example.com", leadScore: "90", nextActions: "Send offer", followUpDate: "2025-04-06" },
    { id: "100003", name: "Dimitris Georgiou", phone: "6999887766", email: "dimitris@example.com", leadScore: "75", nextActions: "Follow-up email", followUpDate: "2025-04-07" },
    { id: "100004", name: "Eleni Christodoulou", phone: "6933445566", email: "eleni@example.com", leadScore: "85", nextActions: "Schedule meeting", followUpDate: "2025-04-08" },
    { id: "100005", name: "Nikos Pappas", phone: "6955332211", email: "nikos@example.com", leadScore: "60", nextActions: "Send reminder", followUpDate: "2025-04-09" },
    { id: "100006", name: "Georgia Alexiou", phone: "6900112233", email: "georgia@example.com", leadScore: "95", nextActions: "Close deal", followUpDate: "2025-04-10" },
    { id: "100007", name: "Kostas Leventis", phone: "6999001122", email: "kostas@example.com", leadScore: "70", nextActions: "Cold call", followUpDate: "2025-04-11" },
    { id: "100008", name: "Sofia Karamanou", phone: "6977889900", email: "sofia@example.com", leadScore: "88", nextActions: "Send brochure", followUpDate: "2025-04-12" },
    { id: "100009", name: "Michalis Xanthopoulos", phone: "6933556677", email: "michalis@example.com", leadScore: "78", nextActions: "Call and pitch", followUpDate: "2025-04-13" },
    { id: "100010", name: "Vasiliki Antoniou", phone: "6911223344", email: "vasiliki@example.com", leadScore: "92", nextActions: "Confirm interest", followUpDate: "2025-04-14" },
    { id: "100011", name: "Panagiotis Kotsis", phone: "6977112233", email: "panagiotis@example.com", leadScore: "82", nextActions: "Send demo", followUpDate: "2025-04-15" },
    { id: "100012", name: "Eftychia Douka", phone: "6988223344", email: "eftychia@example.com", leadScore: "67", nextActions: "Follow up call", followUpDate: "2025-04-16" },
    { id: "100013", name: "Spyros Mavridis", phone: "6999334455", email: "spyros@example.com", leadScore: "79", nextActions: "Send case study", followUpDate: "2025-04-17" },
    { id: "100014", name: "Ioanna Fragou", phone: "6900445566", email: "ioanna@example.com", leadScore: "91", nextActions: "Book consultation", followUpDate: "2025-04-18" },
    { id: "100015", name: "Theodoros Karas", phone: "6911556677", email: "theodoros@example.com", leadScore: "73", nextActions: "Negotiate pricing", followUpDate: "2025-04-19" },
    { id: "100016", name: "Aris Liakos", phone: "6922667788", email: "aris@example.com", leadScore: "86", nextActions: "Arrange free trial", followUpDate: "2025-04-20" },
    { id: "100017", name: "Eirini Konstantinou", phone: "6933778899", email: "eirini@example.com", leadScore: "94", nextActions: "Finalize contract", followUpDate: "2025-04-21" },
    { id: "100018", name: "Leonidas Stavrou", phone: "6944889900", email: "leonidas@example.com", leadScore: "68", nextActions: "Send more info", followUpDate: "2025-04-22" },
    { id: "100019", name: "Zoi Manou", phone: "6955990011", email: "zoi@example.com", leadScore: "83", nextActions: "Check availability", followUpDate: "2025-04-23" },
    { id: "100020", name: "Alexandros Kouris", phone: "6966001122", email: "alexandros@example.com", leadScore: "87", nextActions: "Confirm details", followUpDate: "2025-04-23" },
    { id: "100021", name: "Christina Makri", phone: "6977112233", email: "christina@example.com", leadScore: "65", nextActions: "Send product list", followUpDate: "2025-04-25" },
    { id: "100022", name: "Giannis Fotiadis", phone: "6988223344", email: "giannis@example.com", leadScore: "89", nextActions: "Request review", followUpDate: "2025-04-26" },
  ]);

  const [headers, setHeaders] = useState([
    { id: "ID", type: "number" },
    { name: "NAME", type: "text" },
    { phone: "PHONE", type: "text" },
    { email: "EMAIL", type: "text" },
    { leadScore: "LEAD SCORE", type: "number" },
    { nextActions: "NEXT ACTION", type: "dropdown", options: ["Call back", "Send offer", "Follow-up email", "Schedule meeting", "Close deal"] },
    { followUpDate: "FOLLOW UP DATE", type: "date" },
    { fullName: "FULL NAME", type: "text" },
    { address: "ADDRESS", type: "text" },
    { status: "STATUS", type: "dropdown", options: ["Active", "Inactive", "Pending"] },
    { contact: "CONTACT", type: "text" },
    { description: "DESCRIPTION", type: "text" },
    { dueDate: "DUE DATE", type: "date" },
    { priority: "PRIORITY", type: "dropdown", options: ["High", "Medium", "Low"] },
  ]);

  useEffect(() => {
    themeRef.current = isDarkTheme ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", themeRef.current);
    document.body.style.backgroundColor = isDarkTheme ? "black" : "rgb(255, 255, 255)";
    document.body.style.color = isDarkTheme ? "rgb(255, 255, 255)" : "rgb(29, 29, 31)";
    if (localStorage.getItem("theme") !== null) {
      localStorage.setItem("theme", themeRef.current);
    }
  }, [isDarkTheme]);

  return (
    <MainContext.Provider
      value={{ sheets, setSheets, cards, setCards, headers, setHeaders, isDarkTheme, setIsDarkTheme, themeRef }}
    >
      {children}
    </MainContext.Provider>
  );
};

export default MainContextProvider;