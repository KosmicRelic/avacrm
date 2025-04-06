import { useEffect, useState, useContext, useRef, useMemo, useCallback } from "react";
import styles from "./SheetModal.module.css";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { MdFilterAlt, MdFilterAltOff } from "react-icons/md";
import { MainContext } from "../Contexts/MainContext";

const SheetModal = ({
  isEditMode = false,
  sheetName: initialSheetName = "",
  headers: initialHeaders = [],
  pinnedHeaders: initialPinnedHeaders = [],
  sheets = [],
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

  const resolvedHeaders = useMemo(() =>
    currentHeaders.map((header) => {
      const globalHeader = allHeaders.find((h) => Object.keys(h)[0] === header.key);
      return globalHeader
        ? { ...header, name: globalHeader[header.key], type: globalHeader.type }
        : { ...header, name: header.key, type: "text" };
    }), [currentHeaders, allHeaders]);

  const moveUp = useCallback((index) => {
    if (index === 0) return;
    setCurrentHeaders((prev) => {
      const newHeaders = [...prev];
      [newHeaders[index - 1], newHeaders[index]] = [newHeaders[index], newHeaders[index - 1]];
      return newHeaders;
    });
    setEditIndex(index - 1);
  }, []);

  const moveDown = useCallback((index) => {
    if (index === currentHeaders.length - 1) return;
    setCurrentHeaders((prev) => {
      const newHeaders = [...prev];
      [newHeaders[index], newHeaders[index + 1]] = [newHeaders[index + 1], newHeaders[index]];
      return newHeaders;
    });
    setEditIndex(index + 1);
  }, [currentHeaders.length]);

  const togglePin = useCallback((headerKey) => {
    setPinnedHeaders((prev) => {
      const newPinned = prev.includes(headerKey) ? prev.filter((h) => h !== headerKey) : [...prev, headerKey];
      if (isEditMode && onPinToggle) onPinToggle(headerKey);
      return newPinned;
    });
  }, [isEditMode, onPinToggle]);

  const toggleVisible = useCallback((index) => {
    setCurrentHeaders((prev) => {
      const newHeaders = [...prev];
      newHeaders[index].visible = !newHeaders[index].visible;
      return newHeaders;
    });
  }, []);

  const toggleHidden = useCallback((index) => {
    setCurrentHeaders((prev) => {
      const newHeaders = [...prev];
      newHeaders[index].hidden = !newHeaders[index].hidden;
      return newHeaders;
    });
  }, []);

  const handleSave = useCallback(() => {
    const trimmedName = sheetName.trim();
    const existingSheetNames = sheets.map((sheet) => sheet.sheetName);
    const isDuplicate = isEditMode
      ? trimmedName !== initialSheetName && existingSheetNames.includes(trimmedName)
      : existingSheetNames.includes(trimmedName);

    if (isDuplicate) {
      alert("A sheet with this name already exists. Please choose a different name.");
      return;
    }
    if (!trimmedName) {
      alert("Please provide a sheet name.");
      return;
    }
    if (currentHeaders.length === 0) {
      alert("Please select at least one header.");
      return;
    }

    if (isEditMode) {
      onSave({ sheetName: trimmedName }, currentHeaders, pinnedHeaders);
    } else {
      onSave(trimmedName, currentHeaders, pinnedHeaders);
    }
    onClose();
  }, [sheetName, sheets, isEditMode, initialSheetName, currentHeaders, pinnedHeaders, onSave, onClose]);

  const editHeader = useCallback((index) => setEditIndex(index), []);
  const removeHeader = useCallback(() => {
    if (editIndex !== null && !pinnedHeaders.includes(currentHeaders[editIndex].key)) {
      setCurrentHeaders((prev) => prev.filter((_, i) => i !== editIndex));
      setEditIndex(null);
    }
  }, [editIndex, pinnedHeaders, currentHeaders]);
  const addHeader = useCallback((headerKey) => {
    if (!currentHeaders.some((h) => h.key === headerKey)) {
      setCurrentHeaders((prev) => [...prev, { key: headerKey, visible: true, hidden: false }]);
    }
  }, [currentHeaders]);
  const cancelEdit = useCallback(() => setEditIndex(null), []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} ref={modalRef}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{isEditMode ? "Edit Sheet" : "New Sheet"}</h2>
          <button className={styles.closeButton} onClick={onClose}>Close</button>
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
              className={`${styles.headerItem} ${editIndex === index ? styles.activeItem : ""}`}
            >
              <div className={styles.headerRow}>
                <div className={styles.headerNameType}>
                  <span>{header.name}</span>
                  {/* <span className={styles.headerType}>({header.type})</span> */}
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
                    Modify
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
                  <button
                    onClick={() => moveDown(index)}
                    disabled={index === currentHeaders.length - 1}
                    className={styles.actionButton}
                  >
                    Move Down
                  </button>
                  <button
                    onClick={removeHeader}
                    disabled={pinnedHeaders.includes(header.key)}
                    className={styles.deleteButton}
                  >
                    Remove
                  </button>
                  <button onClick={cancelEdit} className={styles.cancelButton}>
                    Close
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
          <option value="">Add Column</option>
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