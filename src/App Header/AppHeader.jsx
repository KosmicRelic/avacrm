import { useState, useEffect } from "react";
import styles from "./AppHeader.module.css";
import { CgProfile } from "react-icons/cg";
import { ImProfile } from "react-icons/im";
import { SiGoogleads } from "react-icons/si";
import { TfiDashboard } from "react-icons/tfi";
import { FaFileInvoice } from "react-icons/fa";

export default function AppHeader({ sheets, activeSheet, onSheetChange, setIsProfileModalOpen, activeOption, setActiveOption }) {
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const handleOptionClick = (option) => {
        setActiveOption(option);
        if (option === "sheets" && sheets.length > 0 && !activeSheet) {
            onSheetChange(sheets[0]);
        }
    };

    const isMobile = windowWidth <= 768;

    return (
        <header className={styles.headerContainer}>
            <h1 className={styles.avaTitle}>AVA</h1>
            {isMobile ? (
                <nav className={styles.mobileNav}>
                    <button
                        className={`${styles.navButton} ${activeOption === "dashboard" ? styles.activeDashboard : ""}`}
                        onClick={() => handleOptionClick("dashboard")}
                    >
                        <TfiDashboard size={20} className={styles.navIcon} />
                        <span>Dashboard</span>
                    </button>
                    <div className={styles.sheetButtonWrapper}>
                        <button
                            className={`${styles.navButton} ${activeOption === "sheets" ? styles.activeSheets : ""}`}
                            onClick={() => handleOptionClick("sheets")}
                        >
                            <SiGoogleads size={20} className={styles.navIcon} />
                            <span>{activeSheet || "Sheets"}</span>
                        </button>
                        <select
                            value={activeSheet || ""}
                            onChange={(e) => {
                                onSheetChange(e.target.value);
                                setActiveOption("sheets");
                            }}
                            className={styles.sheetDropdown}
                        >
                            <option value="" disabled>Select Sheet</option>
                            {sheets.map((sheet) => (
                                <option key={sheet} value={sheet}>
                                    {sheet}
                                </option>
                            ))}
                            <option value="add-new-sheet">Add New Sheet</option>
                        </select>
                    </div>
                    <button
                        className={`${styles.navButton} ${activeOption === "cards" ? styles.activeCards : ""}`}
                        onClick={() => handleOptionClick("cards")}
                    >
                        <ImProfile size={20} className={styles.navIcon} />
                        <span>Cards</span>
                    </button>
                    <button
                        className={`${styles.navButton} ${activeOption === "invoices" ? styles.activeInvoices : ""}`}
                        onClick={() => handleOptionClick("invoices")}
                    >
                        <FaFileInvoice size={20} className={styles.navIcon} />
                        <span>Invoices</span>
                    </button>
                </nav>
            ) : (
                <nav className={styles.desktopNav}>
                    <button
                        className={`${styles.navButton} ${activeOption === "dashboard" ? styles.activeDashboard : ""}`}
                        onClick={() => handleOptionClick("dashboard")}
                    >
                        <TfiDashboard size={20} className={styles.navIcon} />
                        <span>Dashboard</span>
                    </button>
                    <div className={styles.sheetButtonWrapper}>
                        <button
                            className={`${styles.navButton} ${activeOption === "sheets" ? styles.activeSheets : ""}`}
                            onClick={() => handleOptionClick("sheets")}
                        >
                            <SiGoogleads size={20} className={styles.navIcon} />
                            <span>{activeSheet || "Sheets"}</span>
                        </button>
                        <select
                            value={activeSheet || ""}
                            onChange={(e) => {
                                onSheetChange(e.target.value);
                                setActiveOption("sheets");
                            }}
                            className={styles.sheetDropdown}
                        >
                            <option value="" disabled>Select Sheet</option>
                            {sheets.map((sheet) => (
                                <option key={sheet} value={sheet}>
                                    {sheet}
                                </option>
                            ))}
                            <option value="add-new-sheet">Add New Sheet</option>
                        </select>
                    </div>
                    <button
                        className={`${styles.navButton} ${activeOption === "cards" ? styles.activeCards : ""}`}
                        onClick={() => handleOptionClick("cards")}
                    >
                        <ImProfile size={20} className={styles.navIcon} />
                        <span>Cards</span>
                    </button>
                    <button
                        className={`${styles.navButton} ${activeOption === "invoices" ? styles.activeInvoices : ""}`}
                        onClick={() => handleOptionClick("invoices")}
                    >
                        <FaFileInvoice size={20} className={styles.navIcon} />
                        <span>Invoices</span>
                    </button>
                </nav>
            )}
            <button
                className={styles.profileButton}
                onClick={() => setIsProfileModalOpen(true)}
                aria-label="Profile"
            >
                <CgProfile size={24} className={styles.profileIcon} />
            </button>
        </header>
    );
}