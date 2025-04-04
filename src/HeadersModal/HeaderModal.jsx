import { useContext, useState, useEffect, useRef } from "react";
import styles from "./HeadersModal.module.css";
import { MainContext } from "../Contexts/MainContext";

const HeadersModal = ({ onClose }) => {
    const { headers, setHeaders } = useContext(MainContext);
    const [currentHeaders, setCurrentHeaders] = useState(headers.map(h => ({ ...h })));
    const [newHeaderKey, setNewHeaderKey] = useState("");
    const [newHeaderName, setNewHeaderName] = useState("");
    const [newHeaderType, setNewHeaderType] = useState("text");
    const [newHeaderOptions, setNewHeaderOptions] = useState([]);
    const [newOption, setNewOption] = useState("");
    const [editIndex, setEditIndex] = useState(null);
    const modalRef = useRef(null);

    const addOrUpdateHeader = () => {
        const trimmedKey = newHeaderKey.trim();
        const trimmedName = newHeaderName.trim().toUpperCase();
        if (!trimmedKey || !trimmedName || currentHeaders.some((h, i) => Object.keys(h)[0] === trimmedKey && i !== editIndex)) {
            alert("Header key and name must be unique and non-empty.");
            return;
        }

        const newHeader = { 
            [trimmedKey]: trimmedName, 
            type: newHeaderType,
            ...(newHeaderType === "dropdown" && { options: newHeaderOptions })
        };
        
        if (editIndex !== null) {
            const updatedHeaders = [...currentHeaders];
            updatedHeaders[editIndex] = newHeader;
            setCurrentHeaders(updatedHeaders);
            setEditIndex(null);
        } else {
            setCurrentHeaders([...currentHeaders, newHeader]);
        }
        clearForm();
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
        setNewHeaderOptions(header.options || []);
    };

    const deleteHeader = () => {
        if (editIndex !== null) {
            setCurrentHeaders(currentHeaders.filter((_, i) => i !== editIndex));
            clearForm();
        }
    };

    const clearForm = () => {
        setNewHeaderKey("");
        setNewHeaderName("");
        setNewHeaderType("text");
        setNewHeaderOptions([]);
        setNewOption("");
        setEditIndex(null);
    };

    const addOption = () => {
        if (newOption.trim() && !newHeaderOptions.includes(newOption.trim())) {
            setNewHeaderOptions([...newHeaderOptions, newOption.trim()]);
            setNewOption("");
        }
    };

    const removeOption = (option) => {
        setNewHeaderOptions(newHeaderOptions.filter(opt => opt !== option));
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
                <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle}>Edit Headers</h2>
                    <button className={styles.closeButton} onClick={onClose}>Done</button>
                </div>
                <div className={styles.headerList}>
                    {currentHeaders.map((header, index) => {
                        const key = Object.keys(header)[0];
                        return (
                            <div key={key} className={`${styles.headerItem} ${editIndex === index ? styles.activeItem : ''}`}>
                                <span>{header[key]}</span>
                                <span className={styles.headerType}>({header.type})</span>
                                <button 
                                    onClick={() => editHeader(index)} 
                                    className={styles.editButton}
                                    disabled={editIndex !== null && editIndex !== index}
                                >
                                    Edit
                                </button>
                            </div>
                        );
                    })}
                </div>
                <div className={styles.addHeaderSection}>
                    <input
                        type="text"
                        value={newHeaderKey}
                        onChange={(e) => setNewHeaderKey(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Key"
                        className={styles.inputField}
                    />
                    <input
                        type="text"
                        value={newHeaderName}
                        onChange={(e) => setNewHeaderName(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Name"
                        className={styles.inputField}
                    />
                    <select
                        value={newHeaderType}
                        onChange={(e) => setNewHeaderType(e.target.value)}
                        className={styles.selectField}
                    >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="dropdown">Dropdown</option>
                    </select>
                    {newHeaderType === "dropdown" && (
                        <div className={styles.optionsSection}>
                            <div className={styles.optionInputRow}>
                                <input
                                    type="text"
                                    value={newOption}
                                    onChange={(e) => setNewOption(e.target.value)}
                                    onKeyPress={(e) => e.key === "Enter" && addOption()}
                                    placeholder="Add option"
                                    className={styles.inputField}
                                />
                                <button onClick={addOption} className={styles.addOptionButton}>+</button>
                            </div>
                            <div className={styles.optionsList}>
                                {newHeaderOptions.map((option) => (
                                    <div key={option} className={styles.optionItem}>
                                        <span>{option}</span>
                                        <button
                                            onClick={() => removeOption(option)}
                                            className={styles.removeOptionButton}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className={styles.editActions}>
                        {editIndex !== null && (
                            <button onClick={deleteHeader} className={styles.deleteButton}>
                                Delete Header
                            </button>
                        )}
                        <button onClick={addOrUpdateHeader} className={styles.actionButton}>
                            {editIndex !== null ? "Update" : "Add"}
                        </button>
                    </div>
                </div>
                <button onClick={handleSave} className={styles.saveButton}>
                    Save
                </button>
            </div>
        </div>
    );
};

export default HeadersModal;