import { useState, useEffect, useRef } from "react";
import styles from "./AppHeader.module.css";
import { CgProfile } from "react-icons/cg";
import { ImProfile } from "react-icons/im";
import { TfiDashboard } from "react-icons/tfi";
import { FaFileInvoice } from "react-icons/fa";

export default function AppHeader({ setIsProfileModalOpen, activeOption, setActiveOption }) {
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const mobileNavRef = useRef(null);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        if (isMobile && mobileNavRef.current && activeOption) {
            const activeElement = mobileNavRef.current.querySelector(
                `.${styles.navButton}.${styles[`active${activeOption.charAt(0).toUpperCase() + activeOption.slice(1)}`]}`
            );
            if (activeElement) {
                activeElement.scrollIntoView({ behavior: "smooth", inline: "center" });
            }
        }
    }, [activeOption]);

    const handleOptionClick = (option) => {
        setActiveOption(option);
    };

    const isMobile = windowWidth <= 1024;

    return (
        <header className={styles.headerContainer}>
            <div className={styles.headerTop}>
                <h1 className={styles.avaTitle}>AVA</h1>
                {!isMobile && (
                    <nav className={styles.desktopNav}>
                        <button
                            className={`${styles.navButton} ${activeOption === "dashboard" ? styles.activeDashboard : ""}`}
                            onClick={() => handleOptionClick("dashboard")}
                        >
                            <TfiDashboard size={20} />
                            <span>Dashboard</span>
                        </button>
                        <button
                            className={`${styles.navButton} ${activeOption === "sheets" ? styles.activeSheets : ""}`}
                            onClick={() => handleOptionClick("sheets")}
                        >
                            <span className={styles.iconWrapper}>
                                <TfiDashboard size={20} /> {/* Replace with appropriate icon if needed */}
                            </span>
                            <span>Sheets</span>
                        </button>
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
            </div>
            {isMobile && (
                <nav ref={mobileNavRef} className={styles.mobileNav}>
                    <button
                        className={`${styles.navButton} ${activeOption === "dashboard" ? styles.activeDashboard : ""}`}
                        onClick={() => handleOptionClick("dashboard")}
                    >
                        <TfiDashboard size={20} />
                        <span>Dashboard</span>
                    </button>
                    <button
                        className={`${styles.navButton} ${activeOption === "sheets" ? styles.activeSheets : ""}`}
                        onClick={() => handleOptionClick("sheets")}
                    >
                        <span className={styles.iconWrapper}>
                            <TfiDashboard size={20} />
                        </span>
                        <span>Sheets</span>
                    </button>
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
        </header>
    );
}