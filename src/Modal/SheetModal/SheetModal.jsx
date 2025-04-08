import { useContext, useState, useCallback, useRef, useMemo, useEffect } from "react";
import styles from "./SheetModal.module.css";
import { MainContext } from "../../Contexts/MainContext";
import { FaEye, FaEyeSlash, FaLock, FaUnlock } from "react-icons/fa";
import { MdFilterAlt, MdFilterAltOff } from "react-icons/md";

const SheetModal = ({
  isEditMode = false,
  sheetName: initialSheetName = "",
  headers: initialHeaders = [],
  pinnedHeaders: initialPinnedHeaders = [],
  sheets = [],
  onSave, // Still passed but not used for manual save; kept for compatibility
  onPinToggle,
}) => {
  const { headers: allHeaders } = useContext(MainContext);
  const [sheetName, setSheetName] = useState(initialSheetName);
  const [currentHeaders, setCurrentHeaders] = useState(
    initialHeaders.map((h) => ({ key: h.key, visible: h.visible ?? true, hidden: h.hidden ?? false }))
  );
  const [pinnedHeaders, setPinnedHeaders] = useState(initialPinnedHeaders);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const dragItemRef = useRef(null);

  const resolvedHeaders = useMemo(() =>
    currentHeaders.map((header) => {
      const globalHeader = allHeaders.find((h) => Object.keys(h)[0] === header.key);
      return globalHeader
        ? { ...header, name: globalHeader[header.key], type: globalHeader.type }
        : { ...header, name: header.key, type: "text" };
    }), [currentHeaders, allHeaders]);

  // Update context with current state
  const updateContext = useCallback(() => {
    onSave(isEditMode ? { sheetName } : sheetName, currentHeaders, pinnedHeaders, false, isEditMode);
  }, [onSave, isEditMode, sheetName, currentHeaders, pinnedHeaders]);

  // Drag handlers
  const handleDragStart = useCallback((e, index) => {
    setDraggedIndex(index);
    dragItemRef.current = e.target.closest(`.${styles.headerItem}`);
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => dragItemRef.current.classList.add(styles.dragging), 0);
  }, []);

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newHeaders = [...currentHeaders];
    const [draggedItem] = newHeaders.splice(draggedIndex, 1);
    newHeaders.splice(index, 0, draggedItem);
    setCurrentHeaders(newHeaders);
    setDraggedIndex(index);
    updateContext(); // Update context on drag
  }, [draggedIndex, currentHeaders, updateContext]);

  const handleDragEnd = useCallback(() => {
    if (dragItemRef.current) {
      dragItemRef.current.classList.remove(styles.dragging);
    }
    setDraggedIndex(null);
  }, []);

  // Touch handlers for mobile
  const handleTouchStart = useCallback((e, index) => {
    e.stopPropagation();
    setDraggedIndex(index);
    dragItemRef.current = e.target.closest(`.${styles.headerItem}`);
    dragItemRef.current.classList.add(styles.dragging);
    document.body.style.touchAction = "none";
  }, []);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    if (draggedIndex === null || !dragItemRef.current) return;

    const touch = e.touches[0];
    const elements = document.elementsFromPoint(touch.clientX, touch.clientY);
    const targetItem = elements.find((el) => el.classList.contains(styles.headerItem));
    if (targetItem) {
      const targetIndex = Array.from(targetItem.parentNode.children).indexOf(targetItem);
      if (targetIndex !== draggedIndex) {
        const newHeaders = [...currentHeaders];
        const [draggedItem] = newHeaders.splice(draggedIndex, 1);
        newHeaders.splice(targetIndex, 0, draggedItem);
        setCurrentHeaders(newHeaders);
        setDraggedIndex(targetIndex);
        updateContext(); // Update context on touch move
      }
    }
  }, [draggedIndex, currentHeaders, updateContext]);

  const handleTouchEnd = useCallback(() => {
    if (dragItemRef.current) {
      dragItemRef.current.classList.remove(styles.dragging);
    }
    setDraggedIndex(null);
    document.body.style.touchAction = "";
  }, []);

  const togglePin = useCallback((index) => {
    const headerKey = currentHeaders[index].key;
    setPinnedHeaders((prev) => {
      const newPinned = prev.includes(headerKey) ? prev.filter((h) => h !== headerKey) : [...prev, headerKey];
      if (isEditMode && onPinToggle) onPinToggle(headerKey);
      updateContext(); // Update context on pin toggle
      return newPinned;
    });
  }, [currentHeaders, isEditMode, onPinToggle, updateContext]);

  const toggleVisible = useCallback((index) => {
    setCurrentHeaders((prev) => {
      const newHeaders = [...prev];
      newHeaders[index].visible = !newHeaders[index].visible;
      updateContext(); // Update context on visibility toggle
      return newHeaders;
    });
  }, [updateContext]);

  const toggleHidden = useCallback((index) => {
    setCurrentHeaders((prev) => {
      const newHeaders = [...prev];
      newHeaders[index].hidden = !newHeaders[index].hidden;
      updateContext(); // Update context on hidden toggle
      return newHeaders;
    });
  }, [updateContext]);

  const removeHeader = useCallback((index) => {
    const headerKey = currentHeaders[index].key;
    if (!pinnedHeaders.includes(headerKey)) {
      setCurrentHeaders((prev) => {
        const newHeaders = prev.filter((_, i) => i !== index);
        updateContext(); // Update context on header removal
        return newHeaders;
      });
    }
  }, [pinnedHeaders, currentHeaders, updateContext]);

  const addHeader = useCallback((headerKey) => {
    if (!currentHeaders.some((h) => h.key === headerKey)) {
      setCurrentHeaders((prev) => {
        const newHeaders = [...prev, { key: headerKey, visible: true, hidden: false }];
        updateContext(); // Update context on header addition
        return newHeaders;
      });
    }
  }, [currentHeaders, updateContext]);

  const handleSheetNameChange = useCallback((e) => {
    setSheetName(e.target.value);
    updateContext(); // Update context on sheet name change
  }, [updateContext]);

  // Sync headers with props if they change externally
  useEffect(() => {
    setCurrentHeaders(initialHeaders);
    setPinnedHeaders(initialPinnedHeaders);
  }, [initialHeaders, initialPinnedHeaders]);

  return (
    <div>
      <input
        type="text"
        value={sheetName}
        onChange={handleSheetNameChange}
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
            className={`${styles.headerItem} ${draggedIndex === index ? styles.dragging : ""}`}
            onDragOver={(e) => handleDragOver(e, index)}
          >
            <div className={styles.headerRow}>
              <span className={styles.headerName}>{header.name}</span>
              <div className={styles.actions}>
                <button
                  onClick={() => toggleVisible(index)}
                  className={styles.actionButton}
                >
                  {header.visible ? <FaEye /> : <FaEyeSlash />}
                </button>
                <button
                  onClick={() => toggleHidden(index)}
                  className={styles.actionButton}
                >
                  {header.hidden ? <MdFilterAltOff /> : <MdFilterAlt />}
                </button>
                <button
                  onClick={() => togglePin(index)}
                  className={`${styles.actionButton} ${pinnedHeaders.includes(header.key) ? styles.pinned : ""}`}
                >
                  {pinnedHeaders.includes(header.key) ? <FaLock /> : <FaUnlock />}
                </button>
                {!pinnedHeaders.includes(header.key) && (
                  <button
                    onClick={() => removeHeader(index)}
                    className={`${styles.actionButton} ${styles.removeButton}`}
                  >
                    ✕
                  </button>
                )}
                <span
                  className={styles.dragIcon}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnd={handleDragEnd}
                  onTouchStart={(e) => handleTouchStart(e, index)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  ☰
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SheetModal;