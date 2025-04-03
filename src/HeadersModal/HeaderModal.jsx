import { useContext, useState, useEffect, useRef } from "react";
import styles from "./HeadersModal.module.css";
import { MainContext } from "../Contexts/MainContext";

const HeadersModal = ({ onClose }) => {
    const { headers, setHeaders } = useContext(MainContext);
    const [currentHeaders, setCurrentHeaders] = useState(headers);
    const [newHeaderKey, setNewHeaderKey] = useState("");
    const [newHeaderName, setNewHeaderName] = useState("");
    const [newHeaderType, setNewHeaderType] = useState("text");
    const [editIndex, setEditIndex] = useState(null);
    const modalRef = useRef(null);

    const addOrUpdateHeader = () => {
        const trimmedKey = newHeaderKey.trim();
        const trimmedName = newHeaderName.trim().toUpperCase();
        if (!trimmedKey || !trimmedName || currentHeaders.some((h, i) => Object.keys(h)[0] === trimmedKey && i !== editIndex)) {
            alert("Header key and name must be unique and non-empty.");
            return;
        }

        const newHeader = { [trimmedKey]: trimmedName, type: newHeaderType };
        if (editIndex !== null) {
            const updatedHeaders = [...currentHeaders];
            updatedHeaders[editIndex] = newHeader;
            setCurrentHeaders(updatedHeaders);
            setEditIndex(null); // Reset edit mode after update
        } else {
            setCurrentHeaders([...currentHeaders, newHeader]);
        }
        setNewHeaderKey("");
        setNewHeaderName("");
        setNewHeaderType("text");
    };

    const handleKeyPress = (e) => {
        if (e.key === "Enter") addOrUpdateHeader();
    };

    const editHeader = (index) => {
        setEditIndex(index);
        const header = currentHeaders[index];
        setNewHeaderKey(Object.keys(header)[0]);
        setNewHeaderName(header[Object.keys(header)[0]]);
        setNewHeaderType(header.type);
    };

    const deleteHeader = (index) => {
        setCurrentHeaders(currentHeaders.filter((_, i) => i !== index));
    };

    const clearForm = () => {
        setNewHeaderKey("");
        setNewHeaderName("");
        setNewHeaderType("text");
        setEditIndex(null); // Exit edit mode
    };

    const handleSave = () => {
        setHeaders(currentHeaders);
        onClose();
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent} ref={modalRef}>
                <button className={styles.closeButton} onClick={onClose}>
                    ✕
                </button>
                <h2>Manage Headers</h2>
                <div className={styles.headerList}>
                    {currentHeaders.map((header, index) => {
                        const key = Object.keys(header)[0];
                        return (
                            <div key={key} className={styles.headerItem}>
                                <span>{key}: {header[key]} ({header.type})</span>
                                <div className={styles.headerActions}>
                                    <button onClick={() => editHeader(index)}>Edit</button>
                                    <button onClick={() => deleteHeader(index)}>Delete</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className={styles.addHeaderSection}>
                    <div className={styles.addHeaderRow}>
                        <input
                            type="text"
                            value={newHeaderKey}
                            onChange={(e) => setNewHeaderKey(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Header Key (e.g., leadId)"
                        />
                        <input
                            type="text"
                            value={newHeaderName}
                            onChange={(e) => setNewHeaderName(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Header Name (e.g., ID)"
                        />
                    </div>
                    <div className={styles.addHeaderRow}>
                        <select
                            value={newHeaderType}
                            onChange={(e) => setNewHeaderType(e.target.value)}
                        >
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                            <option value="date">Date</option>
                            <option value="dropdown">Dropdown</option>
                        </select>
                        <div className={styles.addHeaderButtons}>
                            <button onClick={addOrUpdateHeader}>
                                {editIndex !== null ? "Update" : "Add"}
                            </button>
                            {(newHeaderKey || newHeaderName || editIndex !== null) && (
                                <button onClick={clearForm}>Clear</button>
                            )}
                        </div>
                    </div>
                </div>
                <div className={styles.modalActions}>
                    <button onClick={handleSave}>Save</button>
                </div>
            </div>
        </div>
    );
};

export default HeadersModal;