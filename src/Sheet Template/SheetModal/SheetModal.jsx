import { useEffect, useState, useContext, useRef, useMemo, useCallback } from "react";
import styles from "./SheetModal.module.css";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { MdFilterAlt, MdFilterAltOff } from "react-icons/md";
import { MainContext } from "../../Contexts/MainContext";

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
  const [activeIndex, setActiveIndex] = useState(null);
  const [isClosing, setIsClosing] = useState(false);
  const modalRef = useRef(null);
  const headerRefs = useRef([]);

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
      alert("A sheet or folder with this name already exists. Please choose a different name.");
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
    handleClose();
  }, [sheetName, sheets, isEditMode, initialSheetName, currentHeaders, pinnedHeaders, onSave]);

  const handleClose = useCallback(() => {
    if (window.innerWidth <= 767) {
      setIsClosing(true);
      setTimeout(() => {
        onClose();
      }, 300);
    } else {
      onClose();
    }
  }, [onClose]);

  const moveUp = useCallback((index) => {
    if (index === 0) return;
    setCurrentHeaders((prev) => {
      const newHeaders = [...prev];
      const temp = newHeaders[index];
      newHeaders[index] = { ...newHeaders[index - 1], movingUp: true };
      newHeaders[index - 1] = { ...temp, movingDown: true };
      setTimeout(() => {
        setCurrentHeaders((prev) => {
          const cleaned = [...prev];
          delete cleaned[index].movingUp;
          delete cleaned[index - 1].movingDown;
          return cleaned;
        });
      }, 300);
      return newHeaders;
    });
    setActiveIndex(index - 1);
  }, []);

  const moveDown = useCallback((index) => {
    if (index === currentHeaders.length - 1) return;
    setCurrentHeaders((prev) => {
      const newHeaders = [...prev];
      const temp = newHeaders[index];
      newHeaders[index] = { ...newHeaders[index + 1], movingDown: true };
      newHeaders[index + 1] = { ...temp, movingUp: true };
      setTimeout(() => {
        setCurrentHeaders((prev) => {
          const cleaned = [...prev];
          delete cleaned[index].movingDown;
          delete cleaned[index + 1].movingUp;
          return cleaned;
        });
      }, 300);
      return newHeaders;
    });
    setActiveIndex(index + 1);
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

  const toggleEdit = useCallback((index) => {
    setActiveIndex(index); // Always set to the clicked index, even if another is open
  }, []);

  const removeHeader = useCallback((index) => {
    if (!pinnedHeaders.includes(currentHeaders[index].key)) {
      setCurrentHeaders((prev) => prev.filter((_, i) => i !== index));
      setActiveIndex(null);
    }
  }, [pinnedHeaders, currentHeaders]);

  const addHeader = useCallback((headerKey) => {
    if (!currentHeaders.some((h) => h.key === headerKey)) {
      setCurrentHeaders((prev) => [...prev, { key: headerKey, visible: true, hidden: false }]);
    }
  }, [currentHeaders]);

  useEffect(() => {
    const handleClickOutsideModal = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        handleSaveAndClose();
      } else {
        const activeHeaderRef = headerRefs.current[activeIndex];
        if (
          activeIndex !== null &&
          activeHeaderRef &&
          !activeHeaderRef.contains(event.target) &&
          !event.target.closest(`.${styles.doneButton}`) &&
          !event.target.closest(`.${styles.headerItem}`) // Don’t collapse if clicking another header
        ) {
          setActiveIndex(null);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutsideModal);

    return () => {
      document.removeEventListener("mousedown", handleClickOutsideModal);
    };
  }, [handleSaveAndClose, activeIndex]);

  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalContent} ${isClosing ? styles.closing : ""}`} ref={modalRef}>
        <div
          style={{
            width: "40px",
            height: "5px",
            backgroundColor: "rgba(0, 0, 0, 0.2)",
            borderRadius: "2.5px",
            margin: "0 auto 10px",
            display: "none",
            "@media (maxWidth: 767px)": {
              display: "block",
            },
          }}
        />
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{isEditMode ? "Edit Sheet" : "New Sheet"}</h2>
          <button className={styles.doneButton} onClick={handleSaveAndClose}>
            Done
          </button>
        </div>
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
              ref={(el) => (headerRefs.current[index] = el)}
              onClick={(e) => {
                if (!e.target.closest("button")) {
                  toggleEdit(index);
                }
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
                <div className={styles.editActions}>
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
      </div>
    </div>
  );
};

export default SheetModal;