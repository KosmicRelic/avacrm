import { useContext, useState, useCallback, useRef, useMemo } from "react";
import Modal from "../../Modal/Modal";
import styles from "./SheetModal.module.css";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { MdFilterAlt, MdFilterAltOff } from "react-icons/md";
import { MainContext } from "../../Contexts/MainContext";
import useClickOutside from "../../hooks/UseClickOutside";

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
    initialHeaders.map((h) => ({ key: h.key, visible: h.visible ?? true, hidden: h.hidden ?? false }))
  );
  const [pinnedHeaders, setPinnedHeaders] = useState(initialPinnedHeaders);
  const [activeIndex, setActiveIndex] = useState(null);
  const editActionsRef = useRef(null); // Single ref for active editActions

  const resolvedHeaders = useMemo(() =>
    currentHeaders.map((header) => {
      const globalHeader = allHeaders.find((h) => Object.keys(h)[0] === header.key);
      return globalHeader
        ? { ...header, name: globalHeader[header.key], type: globalHeader.type }
        : { ...header, name: header.key, type: "text" };
    }), [currentHeaders, allHeaders]);

  const handleSaveAndClose = useCallback(() => {
    const trimmedName = sheetName.trim();
    const sheetStructure = sheets.structure || sheets;
    const existingSheetNames = Array.isArray(sheetStructure)
      ? sheetStructure.map((item) => item.sheetName || item.folderName)
      : [];
    const isDuplicate = isEditMode
      ? trimmedName !== initialSheetName && existingSheetNames.includes(trimmedName)
      : existingSheetNames.includes(trimmedName);

    if (isDuplicate) {
      alert("A sheet or folder with this name already exists.");
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

  const moveHeader = useCallback((index, direction) => {
    const isUp = direction === "up";
    if (isUp && index === 0) return;
    if (!isUp && index === currentHeaders.length - 1) return;

    setCurrentHeaders((prev) => {
      const newHeaders = [...prev];
      const targetIndex = isUp ? index - 1 : index + 1;
      const temp = newHeaders[index];
      newHeaders[index] = { ...newHeaders[targetIndex], [isUp ? "movingUp" : "movingDown"]: true };
      newHeaders[targetIndex] = { ...temp, [isUp ? "movingDown" : "movingUp"]: true };
      setTimeout(() => {
        setCurrentHeaders((prev) => {
          const cleaned = [...prev];
          delete cleaned[index][isUp ? "movingUp" : "movingDown"];
          delete cleaned[targetIndex][isUp ? "movingDown" : "movingUp"];
          return cleaned;
        });
      }, 300);
      return newHeaders;
    });
    setActiveIndex(isUp ? index - 1 : index + 1);
  }, [currentHeaders.length]);

  const moveUp = (index) => moveHeader(index, "up");
  const moveDown = (index) => moveHeader(index, "down");

  const togglePin = useCallback(
    (headerKey) => {
      setPinnedHeaders((prev) => {
        const newPinned = prev.includes(headerKey) ? prev.filter((h) => h !== headerKey) : [...prev, headerKey];
        if (isEditMode && onPinToggle) onPinToggle(headerKey);
        return newPinned;
      });
    },
    [isEditMode, onPinToggle]
  );

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

  const toggleEdit = useCallback((index) => {
    setActiveIndex((prev) => (prev === index ? null : index));
  }, []);

  const removeHeader = useCallback(
    (index) => {
      if (!pinnedHeaders.includes(currentHeaders[index].key)) {
        setCurrentHeaders((prev) => prev.filter((_, i) => i !== index));
        setActiveIndex(null);
      }
    },
    [pinnedHeaders, currentHeaders]
  );

  const addHeader = useCallback(
    (headerKey) => {
      if (!currentHeaders.some((h) => h.key === headerKey)) {
        setCurrentHeaders((prev) => [...prev, { key: headerKey, visible: true, hidden: false }]);
      }
    },
    [currentHeaders]
  );

  useClickOutside(
    editActionsRef,
    activeIndex !== null,
    () => setActiveIndex(null)
  );

  return (
    <Modal title={isEditMode ? "Edit Sheet" : "New Sheet"} onClose={handleSaveAndClose}>
      <input
        type="text"
        value={sheetName}
        onChange={(e) => setSheetName(e.target.value)}
        placeholder={isEditMode ? "Rename sheet" : "Sheet Name"}
        className={styles.sheetNameInput}
      />
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
      <div className={styles.headerList}>
        {resolvedHeaders.map((header, index) => (
          <div
            key={header.key}
            className={`${styles.headerItem} ${activeIndex === index ? styles.activeItem : ""} ${header.movingUp ? styles.movingUp : ""} ${header.movingDown ? styles.movingDown : ""}`}
            onClick={(e) => {
              if (!e.target.closest("button")) toggleEdit(index);
            }}
          >
            <div className={styles.headerRow}>
              <div className={styles.headerNameType}>
                <span>{header.name}</span>
              </div>
              <div className={styles.primaryButtons}>
                <button onClick={() => toggleVisible(index)} className={styles.visibilityIconButton}>
                  {header.visible ? <FaEye /> : <FaEyeSlash />}
                </button>
                <button onClick={() => toggleHidden(index)} className={styles.filterIconButton}>
                  {header.hidden ? <MdFilterAltOff /> : <MdFilterAlt />}
                </button>
              </div>
            </div>
            {activeIndex === index && (
              <div
                className={styles.editActions}
                ref={editActionsRef}
              >
                <button
                  onClick={() => removeHeader(index)}
                  disabled={pinnedHeaders.includes(header.key)}
                  className={styles.deleteButton}
                >
                  Remove
                </button>
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
              </div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
};

export default SheetModal;