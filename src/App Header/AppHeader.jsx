import { useState, useEffect } from "react";
import styles from "./AppHeader.module.css";
import { CgProfile } from "react-icons/cg";
import { FaChevronDown } from "react-icons/fa";
import { ImProfile } from "react-icons/im";
import { IoFilterCircle } from "react-icons/io5";
import { SiGoogleads } from "react-icons/si";
import { TfiDashboard } from "react-icons/tfi";
import { FaFileInvoice } from "react-icons/fa";

export default function AppHeader({ sheets, activeSheet, onSheetChange, onFilter, setIsProfileModalOpen, activeOption, setActiveOption }) {
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
    const isDesktop = windowWidth > 1024;

    return (
        <div className={styles.headerContainer}>
            <h2 className={styles.avaTitle}>AVA</h2>
            {isMobile ? (
                <div className={styles.mobileActiveOption}>
                    {activeOption === "dashboard" && (
                        <button
                            className={`${styles.dashboardSubTitle} ${styles.active}`}
                            onClick={() => handleOptionClick("dashboard")}
                        >
                            <TfiDashboard size={20} />
                            <span>Dashboard</span>
                        </button>
                    )}
                    {activeOption === "sheets" && (
                        <div className={styles.sheetButtonWrapper}>
                            <button className={styles.filterIcon} onClick={onFilter}>
                                <IoFilterCircle />
                            </button>
                            <button
                                className={`${styles.avaSubTitle} ${styles.active}`}
                                onClick={() => handleOptionClick("sheets")}
                            >
                                <SiGoogleads />
                                <span>{activeSheet || "Select Sheet"}</span>
                                <FaChevronDown />
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
                    )}
                    {activeOption === "cards" && (
                        <button
                            className={`${styles.cardsSubTitle} ${styles.active}`}
                            onClick={() => handleOptionClick("cards")}
                        >
                            <ImProfile size={20} />
                            <span>Cards</span>
                        </button>
                    )}
                    {activeOption === "invoices" && (
                        <button
                            className={`${styles.invoicesSubTitle} ${styles.active}`}
                            onClick={() => handleOptionClick("invoices")}
                        >
                            <FaFileInvoice size={20} />
                            <span>Invoices</span>
                        </button>
                    )}
                </div>
            ) : (
                <div className={styles.buttonWrapper}>
                    <button
                        className={`${styles.dashboardSubTitle} ${activeOption === "dashboard" ? styles.active : ""}`}
                        onClick={() => handleOptionClick("dashboard")}
                    >
                        <TfiDashboard size={20} />
                        <span>Dashboard</span>
                    </button>
                    <div className={styles.sheetButtonWrapper}>
                        {activeOption === "sheets" && (
                            <button className={styles.filterIcon} onClick={onFilter}>
                                <IoFilterCircle />
                            </button>
                        )}
                        <button
                            className={`${styles.avaSubTitle} ${activeOption === "sheets" ? styles.active : ""}`}
                            onClick={() => handleOptionClick("sheets")}
                        >
                            <SiGoogleads />
                            <span>{activeSheet || "Select Sheet"}</span>
                            {activeOption === "sheets" && <FaChevronDown />}
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
                        className={`${styles.cardsSubTitle} ${activeOption === "cards" ? styles.active : ""}`}
                        onClick={() => handleOptionClick("cards")}
                    >
                        <ImProfile size={20} />
                        <span>Cards</span>
                    </button>
                    <button
                        className={`${styles.invoicesSubTitle} ${activeOption === "invoices" ? styles.active : ""}`}
                        onClick={() => handleOptionClick("invoices")}
                    >
                        <FaFileInvoice size={20} />
                        <span>Invoices</span>
                    </button>
                </div>
            )}
            <button
                className={styles.profileButton}
                onClick={() => setIsProfileModalOpen(true)}
            >
                <CgProfile size={24} />
            </button>
        </div>
    );
}