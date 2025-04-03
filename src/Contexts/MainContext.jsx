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
                { "LEAD ID": "100001", "NAME": "Periklis Papadopoulos", "PHONE": "6986600023", "EMAIL": "periklis@example.com", "LEAD SCORE": "80", "NEXT ACTIONS": "Call back", "FOLLOW UP DATE": "2025-04-05" },
                { "LEAD ID": "100002", "NAME": "Maria Ioannou", "PHONE": "6977554321", "EMAIL": "maria@example.com", "LEAD SCORE": "90", "NEXT ACTIONS": "Send offer", "FOLLOW UP DATE": "2025-04-06" },
                { "LEAD ID": "100003", "NAME": "Dimitris Georgiou", "PHONE": "6999887766", "EMAIL": "dimitris@example.com", "LEAD SCORE": "75", "NEXT ACTIONS": "Follow-up email", "FOLLOW UP DATE": "2025-04-07" },
                { "LEAD ID": "100004", "NAME": "Eleni Christodoulou", "PHONE": "6933445566", "EMAIL": "eleni@example.com", "LEAD SCORE": "85", "NEXT ACTIONS": "Schedule meeting", "FOLLOW UP DATE": "2025-04-08" },
                { "LEAD ID": "100005", "NAME": "Nikos Pappas", "PHONE": "6955332211", "EMAIL": "nikos@example.com", "LEAD SCORE": "60", "NEXT ACTIONS": "Send reminder", "FOLLOW UP DATE": "2025-04-09" },
                { "LEAD ID": "100006", "NAME": "Georgia Alexiou", "PHONE": "6900112233", "EMAIL": "georgia@example.com", "LEAD SCORE": "95", "NEXT ACTIONS": "Close deal", "FOLLOW UP DATE": "2025-04-10" },
                { "LEAD ID": "100007", "NAME": "Kostas Leventis", "PHONE": "6999001122", "EMAIL": "kostas@example.com", "LEAD SCORE": "70", "NEXT ACTIONS": "Cold call", "FOLLOW UP DATE": "2025-04-11" },
                { "LEAD ID": "100008", "NAME": "Sofia Karamanou", "PHONE": "6977889900", "EMAIL": "sofia@example.com", "LEAD SCORE": "88", "NEXT ACTIONS": "Send brochure", "FOLLOW UP DATE": "2025-04-12" },
                { "LEAD ID": "100009", "NAME": "Michalis Xanthopoulos", "PHONE": "6933556677", "EMAIL": "michalis@example.com", "LEAD SCORE": "78", "NEXT ACTIONS": "Call and pitch", "FOLLOW UP DATE": "2025-04-13" },
                { "LEAD ID": "100010", "NAME": "Vasiliki Antoniou", "PHONE": "6911223344", "EMAIL": "vasiliki@example.com", "LEAD SCORE": "92", "NEXT ACTIONS": "Confirm interest", "FOLLOW UP DATE": "2025-04-14" },
                { "LEAD ID": "100011", "NAME": "Panagiotis Kotsis", "PHONE": "6977112233", "EMAIL": "panagiotis@example.com", "LEAD SCORE": "82", "NEXT ACTIONS": "Send demo", "FOLLOW UP DATE": "2025-04-15" },
                { "LEAD ID": "100012", "NAME": "Eftychia Douka", "PHONE": "6988223344", "EMAIL": "eftychia@example.com", "LEAD SCORE": "67", "NEXT ACTIONS": "Follow up call", "FOLLOW UP DATE": "2025-04-16" },
                { "LEAD ID": "100013", "NAME": "Spyros Mavridis", "PHONE": "6999334455", "EMAIL": "spyros@example.com", "LEAD SCORE": "79", "NEXT ACTIONS": "Send case study", "FOLLOW UP DATE": "2025-04-17" },
                { "LEAD ID": "100014", "NAME": "Ioanna Fragou", "PHONE": "6900445566", "EMAIL": "ioanna@example.com", "LEAD SCORE": "91", "NEXT ACTIONS": "Book consultation", "FOLLOW UP DATE": "2025-04-18" },
                { "LEAD ID": "100015", "NAME": "Theodoros Karas", "PHONE": "6911556677", "EMAIL": "theodoros@example.com", "LEAD SCORE": "73", "NEXT ACTIONS": "Negotiate pricing", "FOLLOW UP DATE": "2025-04-19" },
                { "LEAD ID": "100016", "NAME": "Aris Liakos", "PHONE": "6922667788", "EMAIL": "aris@example.com", "LEAD SCORE": "86", "NEXT ACTIONS": "Arrange free trial", "FOLLOW UP DATE": "2025-04-20" },
                { "LEAD ID": "100017", "NAME": "Eirini Konstantinou", "PHONE": "6933778899", "EMAIL": "eirini@example.com", "LEAD SCORE": "94", "NEXT ACTIONS": "Finalize contract", "FOLLOW UP DATE": "2025-04-21" },
                { "LEAD ID": "100018", "NAME": "Leonidas Stavrou", "PHONE": "6944889900", "EMAIL": "leonidas@example.com", "LEAD SCORE": "68", "NEXT ACTIONS": "Send more info", "FOLLOW UP DATE": "2025-04-22" },
                { "LEAD ID": "100019", "NAME": "Zoi Manou", "PHONE": "6955990011", "EMAIL": "zoi@example.com", "LEAD SCORE": "83", "NEXT ACTIONS": "Check availability", "FOLLOW UP DATE": "2025-04-23" },
                { "LEAD ID": "100020", "NAME": "Alexandros Kouris", "PHONE": "6966001122", "EMAIL": "alexandros@example.com", "LEAD SCORE": "87", "NEXT ACTIONS": "Confirm details", "FOLLOW UP DATE": "2025-04-24" },
                { "LEAD ID": "100021", "NAME": "Christina Makri", "PHONE": "6977112233", "EMAIL": "christina@example.com", "LEAD SCORE": "65", "NEXT ACTIONS": "Send product list", "FOLLOW UP DATE": "2025-04-25" },
                { "LEAD ID": "100022", "NAME": "Giannis Fotiadis", "PHONE": "6988223344", "EMAIL": "giannis@example.com", "LEAD SCORE": "89", "NEXT ACTIONS": "Request review", "FOLLOW UP DATE": "2025-04-26" }
            ],
        },
    });
    const [selectedSheet, setSelectedSheet] = useState("Leads");

    return (
        <MainContext.Provider value={{
            sheets, 
            setSheets,
            selectedSheet,
            setSelectedSheet
        }}>
            {children}
        </MainContext.Provider>
    );
};

export default MainContextProvider;