import { useState, useEffect, useRef, useContext } from "react";
import styles from "./SheetModal.module.css";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { MdFilterAlt, MdFilterAltOff } from "react-icons/md";
import { MainContext } from "../Contexts/MainContext";

const SheetModal = ({
    isEditMode = false,
    sheetName: initialSheetName = "",
    headers: initialHeaders = [],
    pinnedHeaders: initialPinnedHeaders = [],
    onSave,
    onPinToggle,
    onClose,
}) => {
    const { headers: allHeaders } = useContext(MainContext);
    const [sheetName, setSheetName] = useState(initialSheetName);
    const [currentHeaders, setCurrentHeaders] = useState(
        initialHeaders.map((h) => ({
            key: h.key,
            visible: h.visible ?? true,
            hidden: h.hidden ?? false,
        }))
    );
    const [pinnedHeaders, setPinnedHeaders] = useState(initialPinnedHeaders);
    const [editIndex, setEditIndex] = useState(null);
    const modalRef = useRef(null);

    const resolvedHeaders = currentHeaders.map((header) => {
        const globalHeader = allHeaders.find((h) => Object.keys(h)[0] === header.key);
        return globalHeader
            ? { ...header, name: globalHeader[header.key], type: globalHeader.type }
            : { ...header, name: header.key, type: "text" };
    });

    const moveUp = (index) => {
        if (index === 0) return;
        const newHeaders = [...currentHeaders];
        [newHeaders[index - 1], newHeaders[index]] = [newHeaders[index], newHeaders[index - 1]];
        setCurrentHeaders(newHeaders);
    };

    const moveDown = (index) => {
        if (index === currentHeaders.length - 1) return;
        const newHeaders = [...currentHeaders];
        [newHeaders[index], newHeaders[index + 1]] = [newHeaders[index + 1], newHeaders[index]];
        setCurrentHeaders(newHeaders);
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

    const toggleVisible = (index) => {
        const newHeaders = [...currentHeaders];
        newHeaders[index].visible = !newHeaders[index].visible;
        setCurrentHeaders(newHeaders);
    };

    const toggleHidden = (index) => {
        const newHeaders = [...currentHeaders];
        newHeaders[index].hidden = !newHeaders[index].hidden;
        setCurrentHeaders(newHeaders);
    };

    const handleSave = () => {
        if (isEditMode) {
            onSave({ sheetName: sheetName.trim() }, currentHeaders, pinnedHeaders);
        } else {
            if (sheetName.trim() && currentHeaders.length > 0) {
                onSave(sheetName.trim(), currentHeaders, pinnedHeaders);
            } else {
                alert("Please provide a sheet name and select at least one header.");
                return;
            }
        }
        onClose();
    };

    const editHeader = (index) => {
        setEditIndex(index);
    };

    const removeHeader = () => {
        if (editIndex !== null) {
            const key = currentHeaders[editIndex].key;
            if (!pinnedHeaders.includes(key)) {
                setCurrentHeaders(currentHeaders.filter((_, i) => i !== editIndex));
                setEditIndex(null);
            }
        }
    };

    const addHeader = (headerKey) => {
        if (!currentHeaders.some((h) => h.key === headerKey)) {
            setCurrentHeaders([...currentHeaders, { key: headerKey, visible: true, hidden: false }]);
        }
    };

    const cancelEdit = () => {
        setEditIndex(null);
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
                    <h2 className={styles.modalTitle}>
                        {isEditMode ? "Edit Sheet" : "New Sheet"}
                    </h2>
                    <button className={styles.closeButton} onClick={onClose}>Done</button>
                </div>
                <input
                    type="text"
                    value={sheetName}
                    onChange={(e) => setSheetName(e.target.value)}
                    placeholder={isEditMode ? "Rename sheet" : "Sheet Name"}
                    className={styles.sheetNameInput}
                />
                <div className={styles.headerList}>
                    {resolvedHeaders.map((header, index) => (
                        <div
                            key={header.key}
                            className={`${styles.headerItem} ${editIndex === index ? styles.activeItem : ''}`}
                        >
                            <div className={styles.headerRow}>
                                <div className={styles.headerNameType}>
                                    <span>{header.name}</span>
                                    <span className={styles.headerType}>({header.type})</span>
                                </div>
                                <div className={styles.primaryButtons}>
                                    <button
                                        onClick={() => toggleVisible(index)}
                                        className={styles.iconButton}
                                        disabled={editIndex !== null && editIndex !== index}
                                    >
                                        {header.visible ? <FaEye /> : <FaEyeSlash />}
                                    </button>
                                    <button
                                        onClick={() => toggleHidden(index)}
                                        className={styles.iconButton}
                                        disabled={editIndex !== null && editIndex !== index}
                                    >
                                        {header.hidden ? <MdFilterAltOff /> : <MdFilterAlt />}
                                    </button>
                                    <button
                                        onClick={() => editHeader(index)}
                                        className={styles.editButton}
                                        disabled={editIndex !== null && editIndex !== index}
                                    >
                                        Edit
                                    </button>
                                </div>
                            </div>
                            {editIndex === index && (
                                <div className={styles.editActions}>
                                    <button onClick={() => togglePin(header.key)} className={styles.actionButton}>
                                        {pinnedHeaders.includes(header.key) ? "Unpin" : "Pin"}
                                    </button>
                                    <button onClick={() => moveUp(index)} disabled={index === 0} className={styles.actionButton}>
                                        Move Up
                                    </button>
                                    <button onClick={() => moveDown(index)} disabled={index === currentHeaders.length - 1} className={styles.actionButton}>
                                        Move Down
                                    </button>
                                    <button onClick={removeHeader} disabled={pinnedHeaders.includes(header.key)} className={styles.deleteButton}>
                                        Remove Header
                                    </button>
                                    <button onClick={cancelEdit} className={styles.cancelButton}>
                                        Done
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <select
                    onChange={(e) => {
                        const selectedKey = e.target.value;
                        if (selectedKey) addHeader(selectedKey);
                        e.target.value = "";
                    }}
                    className={styles.addHeaderSelect}
                >
                    <option value="">Add Header</option>
                    {allHeaders
                        .filter((h) => !currentHeaders.some((ch) => ch.key === Object.keys(h)[0]))
                        .map((header) => {
                            const key = Object.keys(header)[0];
                            return (
                                <option key={key} value={key}>
                                    {header[key]} ({header.type})
                                </option>
                            );
                        })}
                </select>
                <button onClick={handleSave} className={styles.saveButton}>
                    Save
                </button>
            </div>
        </div>
    );
};

export default SheetModal;