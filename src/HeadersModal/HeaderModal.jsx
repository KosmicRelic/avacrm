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
    const [isAdding, setIsAdding] = useState(false);
    const modalRef = useRef(null);

    const addHeader = () => {
        const trimmedKey = newHeaderKey.trim();
        const trimmedName = newHeaderName.trim().toUpperCase();
        if (!trimmedKey || !trimmedName || currentHeaders.some((h) => Object.keys(h)[0] === trimmedKey)) {
            alert("Header key and name must be unique and non-empty.");
            return;
        }

        const newHeader = { 
            [trimmedKey]: trimmedName, 
            type: newHeaderType,
            ...(newHeaderType === "dropdown" && { options: newHeaderOptions })
        };
        
        setCurrentHeaders([...currentHeaders, newHeader]);
        clearForm();
    };

    const updateHeader = (index) => {
        const trimmedKey = newHeaderKey.trim();
        const trimmedName = newHeaderName.trim().toUpperCase();
        if (!trimmedKey || !trimmedName || currentHeaders.some((h, i) => Object.keys(h)[0] === trimmedKey && i !== index)) {
            alert("Header key and name must be unique and non-empty.");
            return;
        }

        const updatedHeader = { 
            [trimmedKey]: trimmedName, 
            type: newHeaderType,
            ...(newHeaderType === "dropdown" && { options: newHeaderOptions })
        };

        const updatedHeaders = [...currentHeaders];
        updatedHeaders[index] = updatedHeader;
        setCurrentHeaders(updatedHeaders);
        clearForm();
    };

    const handleKeyPress = (e) => {
        if (e.key === "Enter") {
            editIndex !== null ? updateHeader(editIndex) : isAdding ? addHeader() : null;
        }
    };

    const editHeader = (index) => {
        setEditIndex(index);
        setIsAdding(false); // Ensure add form closes when editing
        const header = currentHeaders[index];
        setNewHeaderKey(Object.keys(header)[0]);
        setNewHeaderName(header[Object.keys(header)[0]]);
        setNewHeaderType(header.type);
        setNewHeaderOptions(header.options || []);
    };

    const deleteHeader = (index) => {
        setCurrentHeaders(currentHeaders.filter((_, i) => i !== index));
        clearForm();
    };

    const clearForm = () => {
        setNewHeaderKey("");
        setNewHeaderName("");
        setNewHeaderType("text");
        setNewHeaderOptions([]);
        setNewOption("");
        setEditIndex(null);
        setIsAdding(false);
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

    const toggleAddForm = () => {
        setIsAdding(!isAdding);
        setEditIndex(null); // Ensure edit mode closes when adding
        setNewHeaderKey("");
        setNewHeaderName("");
        setNewHeaderType("text");
        setNewHeaderOptions([]);
        setNewOption("");
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
                        const isEditing = editIndex === index;
                        return (
                            <div key={key} className={`${styles.headerItem} ${isEditing ? styles.activeItem : ''}`}>
                                <div className={styles.headerRow}>
                                    {!isEditing ? (
                                        <>
                                            <span>{header[key]}</span>
                                            <span className={styles.headerType}>({header.type})</span>
                                            <button 
                                                onClick={() => editHeader(index)} 
                                                className={styles.editButton}
                                                disabled={editIndex !== null || isAdding}
                                            >
                                                Edit
                                            </button>
                                        </>
                                    ) : (
                                        <div className={styles.editFields}>
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
                                                <button onClick={() => deleteHeader(index)} className={styles.deleteButton}>
                                                    Delete Header
                                                </button>
                                                <button onClick={() => updateHeader(index)} className={styles.actionButton}>
                                                    Update
                                                </button>
                                                <button onClick={clearForm} className={styles.cancelButton}>
                                                    Done
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    <div className={`${styles.headerItem} ${isAdding ? styles.activeItem : ''}`}>
                        <div className={styles.headerRow}>
                            {!isAdding ? (
                                <button 
                                    onClick={toggleAddForm} 
                                    className={styles.addButton}
                                    disabled={editIndex !== null}
                                >
                                    Add New Header
                                </button>
                            ) : (
                                <div className={styles.editFields}>
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
                                        <button onClick={addHeader} className={styles.actionButton}>
                                            Add
                                        </button>
                                        <button onClick={clearForm} className={styles.cancelButton}>
                                            Done
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
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