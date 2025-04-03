import { useState, useEffect, useRef, useContext } from "react";
import styles from "./SheetModal.module.css";
import { MainContext } from "../Contexts/MainContext";

const SheetModal = ({
    isEditMode = false,
    sheetName: initialSheetName = "",
    headers: initialHeaders = [], // Expecting resolved headers from App.jsx
    pinnedHeaders: initialPinnedHeaders = [],
    onSave,
    onPinToggle,
    onClose,
}) => {
    const { headers: allHeaders } = useContext(MainContext);
    const [sheetName, setSheetName] = useState(initialSheetName);
    const [currentHeaderKeys, setCurrentHeaderKeys] = useState(initialHeaders.map((h) => h.key));
    const [pinnedHeaders, setPinnedHeaders] = useState(initialPinnedHeaders);
    const [menuOpen, setMenuOpen] = useState(null);
    const menuRef = useRef(null);

    // Resolve current headers from keys
    const currentHeaders = currentHeaderKeys.map((key) => {
        const header = allHeaders.find((h) => Object.keys(h)[0] === key);
        return header
            ? { key, name: header[key], type: header.type }
            : { key, name: key, type: "text" }; // Fallback if header not found
    });

    const moveUp = (index) => {
        if (index === 0) return;
        const newHeaderKeys = [...currentHeaderKeys];
        [newHeaderKeys[index - 1], newHeaderKeys[index]] = [newHeaderKeys[index], newHeaderKeys[index - 1]];
        setCurrentHeaderKeys(newHeaderKeys);
    };

    const moveDown = (index) => {
        if (index === currentHeaderKeys.length - 1) return;
        const newHeaderKeys = [...currentHeaderKeys];
        [newHeaderKeys[index], newHeaderKeys[index + 1]] = [newHeaderKeys[index + 1], newHeaderKeys[index]];
        setCurrentHeaderKeys(newHeaderKeys);
    };

    const togglePin = (headerKey) => {
        const newPinned = pinnedHeaders.includes(headerKey)
            ? pinnedHeaders.filter((h) => h !== headerKey)
            : [...pinnedHeaders, headerKey];
        setPinnedHeaders(newPinned);
        if (isEditMode && onPinToggle) {
            onPinToggle(headerKey);
        }
    };

    const handleSave = () => {
        if (isEditMode) {
            onSave({ sheetName: sheetName.trim() }, currentHeaderKeys, pinnedHeaders);
        } else {
            if (sheetName.trim() && currentHeaderKeys.length > 0) {
                onSave(sheetName.trim(), currentHeaderKeys, pinnedHeaders);
            } else {
                alert("Please provide a sheet name and select at least one header.");
                return;
            }
        }
        onClose();
    };

    const toggleMenu = (index) => {
        setMenuOpen(menuOpen === index ? null : index);
    };

    const handleMenuAction = (action, index, e) => {
        e.stopPropagation();
        action(index);
    };

    const addHeader = (headerKey) => {
        if (!currentHeaderKeys.includes(headerKey)) {
            setCurrentHeaderKeys([...currentHeaderKeys, headerKey]);
        }
    };

    const removeHeader = (index) => {
        const key = currentHeaderKeys[index];
        if (!pinnedHeaders.includes(key)) {
            setCurrentHeaderKeys(currentHeaderKeys.filter((_, i) => i !== index));
        }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setMenuOpen(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <h2 className={styles.editTitle}>
                    {isEditMode ? "Edit Sheet" : "Add New Sheet"}
                </h2>
                <div className={styles.addHeaderSection}>
                    <label className={styles.headerLabel}>Sheet Name:</label>
                    <input
                        type="text"
                        value={sheetName}
                        onChange={(e) => setSheetName(e.target.value)}
                        placeholder={isEditMode ? "Rename sheet" : "e.g., Contacts"}
                        className={styles.sheetNameInput}
                    />
                </div>
                <div className={styles.headerList}>
                    {currentHeaders.map((header, index) => (
                        <div key={header.key} className={styles.headerItem}>
                            <div className={styles.headerRow}>
                                <div className={styles.headerNameType}>
                                    <span>{header.name} ({header.type})</span>
                                </div>
                                <div className={styles.primaryButtons}>
                                    <button onClick={() => toggleMenu(index)} className={styles.moreButton}>
                                        {" ⋯"}
                                    </button>
                                    {menuOpen === index && (
                                        <div className={styles.menu} ref={menuRef}>
                                            <button onClick={(e) => handleMenuAction(() => togglePin(header.key), index, e)}>
                                                {pinnedHeaders.includes(header.key) ? "Unpin" : "Pin"}
                                            </button>
                                            <button
                                                onClick={(e) => handleMenuAction(moveUp, index, e)}
                                                disabled={index === 0}
                                            >
                                                Move Up
                                            </button>
                                            <button
                                                onClick={(e) => handleMenuAction(moveDown, index, e)}
                                                disabled={index === currentHeaderKeys.length - 1}
                                            >
                                                Move Down
                                            </button>
                                            <button
                                                onClick={(e) => handleMenuAction(removeHeader, index, e)}
                                                disabled={pinnedHeaders.includes(header.key)}
                                                className={pinnedHeaders.includes(header.key) ? styles.disabledMenuButton : styles.deleteButton}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className={styles.addHeaderSection}>
                    <select
                        onChange={(e) => {
                            const selectedKey = e.target.value;
                            if (selectedKey) addHeader(selectedKey);
                            e.target.value = ""; // Reset dropdown
                        }}
                    >
                        <option value="">Add Header</option>
                        {allHeaders
                            .filter((h) => !currentHeaderKeys.includes(Object.keys(h)[0]))
                            .map((header) => {
                                const key = Object.keys(header)[0];
                                return (
                                    <option key={key} value={key}>
                                        {header[key]} ({header.type})
                                    </option>
                                );
                            })}
                    </select>
                </div>
                <div className={styles.modalActions}>
                    <button onClick={handleSave}>Save</button>
                    <button onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
};

export default SheetModal;