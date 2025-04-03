import { createContext, useState } from "react";
export const MainContext = createContext();

export const MainContextProvider = ({ children }) => {
    const [sheets, setSheets] = useState({
        Leads: {
            headers: [
                { key: "leadId", visible: true, hidden: false },
                { key: "name", visible: true, hidden: false },
                { key: "phone", visible: true, hidden: false },
                { key: "email", visible: true, hidden: false },
                { key: "leadScore", visible: true, hidden: false },
                { key: "nextActions", visible: true, hidden: false },
                { key: "followUpDate", visible: true, hidden: false },
            ],
            pinnedHeaders: ["leadId", "name"],
            rows: [
                "100001", "100002", "100003", "100004", "100005", "100006", "100007", "100008", "100009", "100010",
                "100011", "100012", "100013", "100014", "100015", "100016", "100017", "100018", "100019", "100020",
                "100021", "100022",
            ],
            isActive: true,
        },
        Business_Partners: {
            headers: [
                { key: "businessId", visible: true, hidden: false },
                { key: "fullName", visible: true, hidden: false },
                { key: "address", visible: true, hidden: false },
                { key: "status", visible: true, hidden: false },
            ],
            pinnedHeaders: ["businessId"],
            rows: [],
            isActive: false,
        },
        Tasks: {
            headers: [
                { key: "taskId", visible: true, hidden: false },
                { key: "description", visible: true, hidden: false },
                { key: "dueDate", visible: true, hidden: false },
                { key: "priority", visible: true, hidden: false },
            ],
            pinnedHeaders: ["taskId"],
            rows: [],
            isActive: false,
        },
    });

    const [cards, setCards] = useState([
        // Leads
        { leadId: "100001", name: "Periklis Papadopoulos", phone: "6986600023", email: "periklis@example.com", leadScore: "80", nextActions: "Call back", followUpDate: "2025-04-05" },
        { leadId: "100002", name: "Maria Ioannou", phone: "6977554321", email: "maria@example.com", leadScore: "90", nextActions: "Send offer", followUpDate: "2025-04-06" },
        { leadId: "100003", name: "Dimitris Georgiou", phone: "6999887766", email: "dimitris@example.com", leadScore: "75", nextActions: "Follow-up email", followUpDate: "2025-04-07" },
        { leadId: "100004", name: "Eleni Christodoulou", phone: "6933445566", email: "eleni@example.com", leadScore: "85", nextActions: "Schedule meeting", followUpDate: "2025-04-08" },
        { leadId: "100005", name: "Nikos Pappas", phone: "6955332211", email: "nikos@example.com", leadScore: "60", nextActions: "Send reminder", followUpDate: "2025-04-09" },
        { leadId: "100006", name: "Georgia Alexiou", phone: "6900112233", email: "georgia@example.com", leadScore: "95", nextActions: "Close deal", followUpDate: "2025-04-10" },
        { leadId: "100007", name: "Kostas Leventis", phone: "6999001122", email: "kostas@example.com", leadScore: "70", nextActions: "Cold call", followUpDate: "2025-04-11" },
        { leadId: "100008", name: "Sofia Karamanou", phone: "6977889900", email: "sofia@example.com", leadScore: "88", nextActions: "Send brochure", followUpDate: "2025-04-12" },
        { leadId: "100009", name: "Michalis Xanthopoulos", phone: "6933556677", email: "michalis@example.com", leadScore: "78", nextActions: "Call and pitch", followUpDate: "2025-04-13" },
        { leadId: "100010", name: "Vasiliki Antoniou", phone: "6911223344", email: "vasiliki@example.com", leadScore: "92", nextActions: "Confirm interest", followUpDate: "2025-04-14" },
        { leadId: "100011", name: "Panagiotis Kotsis", phone: "6977112233", email: "panagiotis@example.com", leadScore: "82", nextActions: "Send demo", followUpDate: "2025-04-15" },
        { leadId: "100012", name: "Eftychia Douka", phone: "6988223344", email: "eftychia@example.com", leadScore: "67", nextActions: "Follow up call", followUpDate: "2025-04-16" },
        { leadId: "100013", name: "Spyros Mavridis", phone: "6999334455", email: "spyros@example.com", leadScore: "79", nextActions: "Send case study", followUpDate: "2025-04-17" },
        { leadId: "100014", name: "Ioanna Fragou", phone: "6900445566", email: "ioanna@example.com", leadScore: "91", nextActions: "Book consultation", followUpDate: "2025-04-18" },
        { leadId: "100015", name: "Theodoros Karas", phone: "6911556677", email: "theodoros@example.com", leadScore: "73", nextActions: "Negotiate pricing", followUpDate: "2025-04-19" },
        { leadId: "100016", name: "Aris Liakos", phone: "6922667788", email: "aris@example.com", leadScore: "86", nextActions: "Arrange free trial", followUpDate: "2025-04-20" },
        { leadId: "100017", name: "Eirini Konstantinou", phone: "6933778899", email: "eirini@example.com", leadScore: "94", nextActions: "Finalize contract", followUpDate: "2025-04-21" },
        { leadId: "100018", name: "Leonidas Stavrou", phone: "6944889900", email: "leonidas@example.com", leadScore: "68", nextActions: "Send more info", followUpDate: "2025-04-22" },
        { leadId: "100019", name: "Zoi Manou", phone: "6955990011", email: "zoi@example.com", leadScore: "83", nextActions: "Check availability", followUpDate: "2025-04-23" },
        { leadId: "100020", name: "Alexandros Kouris", phone: "6966001122", email: "alexandros@example.com", leadScore: "87", nextActions: "Confirm details", followUpDate: "2025-04-24" },
        { leadId: "100021", name: "Christina Makri", phone: "6977112233", email: "christina@example.com", leadScore: "65", nextActions: "Send product list", followUpDate: "2025-04-25" },
        { leadId: "100022", name: "Giannis Fotiadis", phone: "6988223344", email: "giannis@example.com", leadScore: "89", nextActions: "Request review", followUpDate: "2025-04-26" },
    ]);

    const [headers, setHeaders] = useState([
        { leadId: "LEAD ID", type: "number" },
        { name: "NAME", type: "text" },
        { phone: "PHONE", type: "text" },
        { email: "EMAIL", type: "text" },
        { leadScore: "LEAD SCORE", type: "number" },
        { nextActions: "NEXT ACTIONS", type: "dropdown" },
        { followUpDate: "FOLLOW UP DATE", type: "date" },
        { businessId: "BUSINESS ID", type: "number" },
        { fullName: "FULL NAME", type: "text" },
        { address: "ADDRESS", type: "text" },
        { status: "STATUS", type: "dropdown" },
        { taskId: "TASK ID", type: "number" },
        { description: "DESCRIPTION", type: "text" },
        { dueDate: "DUE DATE", type: "date" },
        { priority: "PRIORITY", type: "dropdown" },
    ]);

    return (
        <MainContext.Provider value={{ sheets, setSheets, cards, setCards, headers, setHeaders }}>
            {children}
        </MainContext.Provider>
    );
};

export default MainContextProvider;