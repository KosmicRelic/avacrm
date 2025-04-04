// AppHeader.jsx
import { useState, useEffect, useRef } from "react";
import styles from "./AppHeader.module.css";
import { CgProfile } from "react-icons/cg";
import { ImProfile } from "react-icons/im";
import { SiGoogleads } from "react-icons/si";
import { TfiDashboard } from "react-icons/tfi";
import { FaFileInvoice } from "react-icons/fa";
import { FaChevronDown } from "react-icons/fa";

export default function AppHeader({ sheets, activeSheet, onSheetChange, setIsProfileModalOpen, activeOption, setActiveOption }) {
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const buttonRef = useRef(null);
    const mobileNavRef = useRef(null);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                dropdownRef.current && 
                !dropdownRef.current.contains(event.target) &&
                buttonRef.current && 
                !buttonRef.current.contains(event.target)
            ) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (isMobile && mobileNavRef.current && activeOption) {
            const activeElement = mobileNavRef.current.querySelector(`.${styles.navButton}.${styles[`active${activeOption.charAt(0).toUpperCase() + activeOption.slice(1)}`]}`);
            if (activeElement) {
                activeElement.scrollIntoView({ behavior: "smooth", inline: "center" });
            }
        }
    }, [activeOption]);

    const handleOptionClick = (option) => {
        setActiveOption(option);
        if (option === "sheets" && sheets.length > 0 && !activeSheet) {
            onSheetChange(sheets[0]);
        }
    };

    const handleSheetSelectDirect = (e) => {
        e.stopPropagation();
        if (activeSheet) {
            onSheetChange(activeSheet);
            setActiveOption("sheets");
        }
    };

    const handleChevronClick = (e) => {
        e.stopPropagation();
        setIsDropdownOpen(!isDropdownOpen);
    };

    const handleSheetSelect = (sheet) => {
        onSheetChange(sheet);
        setActiveOption("sheets");
        setIsDropdownOpen(false);
    };

    const isMobile = windowWidth <= 768;

    return (
        <header className={styles.headerContainer}>
            <h1 className={styles.avaTitle}>AVA</h1>
            {isMobile ? (
                <nav ref={mobileNavRef} className={styles.mobileNav}>
                    <button
                        className={`${styles.navButton} ${activeOption === "dashboard" ? styles.activeDashboard : ""}`}
                        onClick={() => handleOptionClick("dashboard")}
                    >
                        <TfiDashboard size={20} />
                        <span>Dashboard</span>
                    </button>
                    <div className={styles.sheetButtonWrapper}>
                        <button
                            ref={buttonRef}
                            className={`${styles.navButton} ${activeOption === "sheets" ? styles.activeSheets : ""}`}
                            onClick={handleSheetSelectDirect}
                        >
                            <span className={styles.iconWrapper}>
                                <SiGoogleads size={20} />
                            </span>
                            <span>
                                {activeSheet || "Sheets"}
                            </span>
                            <span
                                onClick={handleChevronClick}
                            >
                                <FaChevronDown size={16} />
                            </span>
                        </button>
                        {isDropdownOpen && (
                            <div ref={dropdownRef} className={styles.sheetDropdown}>
                                {sheets.map((sheet) => (
                                    <div
                                        key={sheet}
                                        className={styles.dropdownItem}
                                        onClick={() => handleSheetSelect(sheet)}
                                    >
                                        {sheet}
                                    </div>
                                ))}
                                <div
                                    className={styles.dropdownItem}
                                    onClick={() => handleSheetSelect("add-new-sheet")}
                                >
                                    Add New Sheet
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        className={`${styles.navButton} ${activeOption === "cards" ? styles.activeCards : ""}`}
                        onClick={() => handleOptionClick("cards")}
                    >
                        <ImProfile size={20} />
                        <span>Cards</span>
                    </button>
                    <button
                        className={`${styles.navButton} ${activeOption === "invoices" ? styles.activeInvoices : ""}`}
                        onClick={() => handleOptionClick("invoices")}
                    >
                        <FaFileInvoice size={20} />
                        <span>Invoices</span>
                    </button>
                </nav>
            ) : (
                <nav className={styles.desktopNav}>
                    <button
                        className={`${styles.navButton} ${activeOption === "dashboard" ? styles.activeDashboard : ""}`}
                        onClick={() => handleOptionClick("dashboard")}
                    >
                        <TfiDashboard size={20} />
                        <span>Dashboard</span>
                    </button>
                    <div className={styles.sheetButtonWrapper}>
                        <button
                            ref={buttonRef}
                            className={`${styles.navButton} ${activeOption === "sheets" ? styles.activeSheets : ""}`}
                            onClick={handleSheetSelectDirect}
                        >
                            <span className={styles.iconWrapper}>
                                <SiGoogleads size={20} />
                            </span>
                            <span>
                                {activeSheet || "Sheets"}
                            </span>
                            <span
                                onClick={handleChevronClick}
                            >
                                <FaChevronDown size={14} />
                            </span>
                        </button>
                        {isDropdownOpen && (
                            <div ref={dropdownRef} className={styles.sheetDropdown}>
                                {sheets.map((sheet) => (
                                    <div
                                        key={sheet}
                                        className={styles.dropdownItem}
                                        onClick={() => handleSheetSelect(sheet)}
                                    >
                                        {sheet}
                                    </div>
                                ))}
                                <div
                                    className={styles.dropdownItem}
                                    onClick={() => handleSheetSelect("add-new-sheet")}
                                >
                                    Add New Sheet
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        className={`${styles.navButton} ${activeOption === "cards" ? styles.activeCards : ""}`}
                        onClick={() => handleOptionClick("cards")}
                    >
                        <ImProfile size={20} />
                        <span>Cards</span>
                    </button>
                    <button
                        className={`${styles.navButton} ${activeOption === "invoices" ? styles.activeInvoices : ""}`}
                        onClick={() => handleOptionClick("invoices")}
                    >
                        <FaFileInvoice size={20} />
                        <span>Invoices</span>
                    </button>
                </nav>
            )}
            <button
                className={styles.profileButton}
                onClick={() => setIsProfileModalOpen(true)}
                aria-label="Profile"
            >
                <CgProfile size={24} />
            </button>
        </header>
    );
}