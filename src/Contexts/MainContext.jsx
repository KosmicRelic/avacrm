import { createContext, useState } from "react";

export const MainContext = createContext();

export const MainContextProvider = ({ children }) => {
    const [sheets, setSheets] = useState({
        Leads: {
            headers: [
                { name: "LEAD ID", type: "number", hidden: false, visible: true },
                { name: "NAME", type: "text", hidden: false, visible: true },
                { name: "PHONE", type: "text", hidden: false, visible: true },
                { name: "EMAIL", type: "text", hidden: false, visible: true },
                { name: "LEAD SCORE", type: "number", hidden: false, visible: true },
                { name: "NEXT ACTIONS", type: "dropdown", hidden: false, visible: true },
                { name: "FOLLOW UP DATE", type: "date", hidden: false, visible: true },
            ],
            pinnedHeaders: ["LEAD ID", "NAME"],
            rows: [
                "100001", "100002", "100003", "100004", "100005", "100006", "100007", "100008", "100009", "100010",
                "100011", "100012", "100013", "100014", "100015", "100016", "100017", "100018", "100019", "100020",
                "100021", "100022",
            ],
            isActive: true,
        },
        Business_Partners: {
            headers: [
                { name: "CONTACT ID", type: "number", hidden: false, visible: true },
                { name: "FULL NAME", type: "text", hidden: false, visible: true },
                { name: "ADDRESS", type: "text", hidden: false, visible: true },
                { name: "STATUS", type: "dropdown", hidden: false, visible: true },
            ],
            pinnedHeaders: ["CONTACT ID"],
            rows: [],
            isActive: false,
        },
        Tasks: {
            headers: [
                { name: "TASK ID", type: "number", hidden: false, visible: true },
                { name: "DESCRIPTION", type: "text", hidden: false, visible: true },
                { name: "DUE DATE", type: "date", hidden: false, visible: true },
                { name: "PRIORITY", type: "dropdown", hidden: false, visible: true },
            ],
            pinnedHeaders: ["TASK ID"],
            rows: [],
            isActive: false,
        },
    });

    const [cards, setCards] = useState([
        // Leads
        { id: "100001", "LEAD ID": "100001", "NAME": "Periklis Papadopoulos", "PHONE": "6986600023", "EMAIL": "periklis@example.com", "LEAD SCORE": "80", "NEXT ACTIONS": "Call back", "FOLLOW UP DATE": "2025-04-05" },
        { id: "100002", "LEAD ID": "100002", "NAME": "Maria Ioannou", "PHONE": "6977554321", "EMAIL": "maria@example.com", "LEAD SCORE": "90", "NEXT ACTIONS": "Send offer", "FOLLOW UP DATE": "2025-04-06" },
        { id: "100003", "LEAD ID": "100003", "NAME": "Dimitris Georgiou", "PHONE": "6999887766", "EMAIL": "dimitris@example.com", "LEAD SCORE": "75", "NEXT ACTIONS": "Follow-up email", "FOLLOW UP DATE": "2025-04-07" },
        { id: "100004", "LEAD ID": "100004", "NAME": "Eleni Christodoulou", "PHONE": "6933445566", "EMAIL": "eleni@example.com", "LEAD SCORE": "85", "NEXT ACTIONS": "Schedule meeting", "FOLLOW UP DATE": "2025-04-08" },
        { id: "100005", "LEAD ID": "100005", "NAME": "Nikos Pappas", "PHONE": "6955332211", "EMAIL": "nikos@example.com", "LEAD SCORE": "60", "NEXT ACTIONS": "Send reminder", "FOLLOW UP DATE": "2025-04-09" },
        { id: "100006", "LEAD ID": "100006", "NAME": "Georgia Alexiou", "PHONE": "6900112233", "EMAIL": "georgia@example.com", "LEAD SCORE": "95", "NEXT ACTIONS": "Close deal", "FOLLOW UP DATE": "2025-04-10" },
        { id: "100007", "LEAD ID": "100007", "NAME": "Kostas Leventis", "PHONE": "6999001122", "EMAIL": "kostas@example.com", "LEAD SCORE": "70", "NEXT ACTIONS": "Cold call", "FOLLOW UP DATE": "2025-04-11" },
        { id: "100008", "LEAD ID": "100008", "NAME": "Sofia Karamanou", "PHONE": "6977889900", "EMAIL": "sofia@example.com", "LEAD SCORE": "88", "NEXT ACTIONS": "Send brochure", "FOLLOW UP DATE": "2025-04-12" },
        { id: "100009", "LEAD ID": "100009", "NAME": "Michalis Xanthopoulos", "PHONE": "6933556677", "EMAIL": "michalis@example.com", "LEAD SCORE": "78", "NEXT ACTIONS": "Call and pitch", "FOLLOW UP DATE": "2025-04-13" },
        { id: "100010", "LEAD ID": "100010", "NAME": "Vasiliki Antoniou", "PHONE": "6911223344", "EMAIL": "vasiliki@example.com", "LEAD SCORE": "92", "NEXT ACTIONS": "Confirm interest", "FOLLOW UP DATE": "2025-04-14" },
        { id: "100011", "LEAD ID": "100011", "NAME": "Panagiotis Kotsis", "PHONE": "6977112233", "EMAIL": "panagiotis@example.com", "LEAD SCORE": "82", "NEXT ACTIONS": "Send demo", "FOLLOW UP DATE": "2025-04-15" },
        { id: "100012", "LEAD ID": "100012", "NAME": "Eftychia Douka", "PHONE": "6988223344", "EMAIL": "eftychia@example.com", "LEAD SCORE": "67", "NEXT ACTIONS": "Follow up call", "FOLLOW UP DATE": "2025-04-16" },
        { id: "100013", "LEAD ID": "100013", "NAME": "Spyros Mavridis", "PHONE": "6999334455", "EMAIL": "spyros@example.com", "LEAD SCORE": "79", "NEXT ACTIONS": "Send case study", "FOLLOW UP DATE": "2025-04-17" },
        { id: "100014", "LEAD ID": "100014", "NAME": "Ioanna Fragou", "PHONE": "6900445566", "EMAIL": "ioanna@example.com", "LEAD SCORE": "91", "NEXT ACTIONS": "Book consultation", "FOLLOW UP DATE": "2025-04-18" },
        { id: "100015", "LEAD ID": "100015", "NAME": "Theodoros Karas", "PHONE": "6911556677", "EMAIL": "theodoros@example.com", "LEAD SCORE": "73", "NEXT ACTIONS": "Negotiate pricing", "FOLLOW UP DATE": "2025-04-19" },
        { id: "100016", "LEAD ID": "100016", "NAME": "Aris Liakos", "PHONE": "6922667788", "EMAIL": "aris@example.com", "LEAD SCORE": "86", "NEXT ACTIONS": "Arrange free trial", "FOLLOW UP DATE": "2025-04-20" },
        { id: "100017", "LEAD ID": "100017", "NAME": "Eirini Konstantinou", "PHONE": "6933778899", "EMAIL": "eirini@example.com", "LEAD SCORE": "94", "NEXT ACTIONS": "Finalize contract", "FOLLOW UP DATE": "2025-04-21" },
        { id: "100018", "LEAD ID": "100018", "NAME": "Leonidas Stavrou", "PHONE": "6944889900", "EMAIL": "leonidas@example.com", "LEAD SCORE": "68", "NEXT ACTIONS": "Send more info", "FOLLOW UP DATE": "2025-04-22" },
        { id: "100019", "LEAD ID": "100019", "NAME": "Zoi Manou", "PHONE": "6955990011", "EMAIL": "zoi@example.com", "LEAD SCORE": "83", "NEXT ACTIONS": "Check availability", "FOLLOW UP DATE": "2025-04-23" },
        { id: "100020", "LEAD ID": "100020", "NAME": "Alexandros Kouris", "PHONE": "6966001122", "EMAIL": "alexandros@example.com", "LEAD SCORE": "87", "NEXT ACTIONS": "Confirm details", "FOLLOW UP DATE": "2025-04-24" },
        { id: "100021", "LEAD ID": "100021", "NAME": "Christina Makri", "PHONE": "6977112233", "EMAIL": "christina@example.com", "LEAD SCORE": "65", "NEXT ACTIONS": "Send product list", "FOLLOW UP DATE": "2025-04-25" },
        { id: "100022", "LEAD ID": "100022", "NAME": "Giannis Fotiadis", "PHONE": "6988223344", "EMAIL": "giannis@example.com", "LEAD SCORE": "89", "NEXT ACTIONS": "Request review", "FOLLOW UP DATE": "2025-04-26" },
    ]);

    return (
        <MainContext.Provider value={{ sheets, setSheets, cards, setCards }}>
            {children}
        </MainContext.Provider>
    );
};

export default MainContextProvider;