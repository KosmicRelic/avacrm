import { useContext, useState, useCallback, useMemo, useEffect } from "react";
import styles from "./SheetModal.module.css";
import { MainContext } from "../../Contexts/MainContext";
import { FaEye, FaEyeSlash, FaThumbtack } from "react-icons/fa";
import { MdFilterAlt, MdFilterAltOff } from "react-icons/md";

const SheetModal = ({
  isEditMode = false,
  tempData,
  setTempData,
  sheets = [],
  onPinToggle,
}) => {
  const { headers: allHeaders } = useContext(MainContext);
  const [sheetName, setSheetName] = useState(tempData.sheetName || "");
  const [currentHeaders, setCurrentHeaders] = useState(tempData.currentHeaders || []);
  const [rows] = useState(tempData.rows || []); // Preserve rows from tempData
  const [pinnedStates, setPinnedStates] = useState({});
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchTargetIndex, setTouchTargetIndex] = useState(null);

  // Sync tempData with local state changes after render
  useEffect(() => {
    setTempData((prev) => ({
      ...prev,
      sheetName,
      currentHeaders,
      rows, // Include rows in tempData
    }));
  }, [sheetName, currentHeaders, rows, setTempData]);

  const resolvedHeaders = useMemo(() =>
    currentHeaders.map((header) => {
      const globalHeader = allHeaders.find((h) => Object.keys(h)[0] === header.key);
      return globalHeader
        ? { ...header, name: globalHeader[header.key], type: globalHeader.type }
        : { ...header, name: header.key, type: "text" };
    }), [currentHeaders, allHeaders]);

  const handleDragStart = useCallback((e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.target.classList.add(styles.dragging);
  }, []);

  const handleTouchStart = useCallback((e, index) => {
    e.preventDefault();
    setDraggedIndex(index);
    setTouchStartY(e.touches[0].clientY);
    setTouchTargetIndex(index);
    e.target.classList.add(styles.dragging);
  }, []);

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    setCurrentHeaders((prev) => {
      const newHeaders = [...prev];
      const [draggedItem] = newHeaders.splice(draggedIndex, 1);
      newHeaders.splice(index, 0, draggedItem);
      setDraggedIndex(index);
      return newHeaders;
    });
  }, [draggedIndex]);

  const handleTouchMove = useCallback((e, index) => {
    e.preventDefault();
    if (draggedIndex === null || touchStartY === null) return;

    const touchY = e.touches[0].clientY;
    const itemHeight = 48; // Adjust based on your CSS
    const delta = Math.round((touchY - touchStartY) / itemHeight);

    const newIndex = Math.max(0, Math.min(touchTargetIndex + delta, currentHeaders.length - 1));
    if (newIndex !== draggedIndex) {
      setCurrentHeaders((prev) => {
        const newHeaders = [...prev];
        const [draggedItem] = newHeaders.splice(draggedIndex, 1);
        newHeaders.splice(newIndex, 0, draggedItem);
        setDraggedIndex(newIndex);
        return newHeaders;
      });
    }
  }, [draggedIndex, touchStartY, touchTargetIndex, currentHeaders.length]);

  const handleDragEnd = useCallback((e) => {
    e.target.classList.remove(styles.dragging);
    setDraggedIndex(null);
  }, []);

  const handleTouchEnd = useCallback((e) => {
    e.preventDefault();
    const target = e.target.closest(`.${styles.headerItem}`);
    if (target) target.classList.remove(styles.dragging);
    setDraggedIndex(null);
    setTouchStartY(null);
    setTouchTargetIndex(null);
  }, []);

  const togglePin = useCallback((headerKey) => {
    setPinnedStates((prev) => ({
      ...prev,
      [headerKey]: !prev[headerKey],
    }));
    onPinToggle(headerKey);
  }, [onPinToggle]);

  const toggleVisible = useCallback((index) => {
    setCurrentHeaders((prev) => {
      const newHeaders = [...prev];
      newHeaders[index] = { ...newHeaders[index], visible: !newHeaders[index].visible };
      return newHeaders;
    });
  }, []);

  const toggleHidden = useCallback((index) => {
    setCurrentHeaders((prev) => {
      const newHeaders = [...prev];
      newHeaders[index] = { ...newHeaders[index], hidden: !newHeaders[index].hidden };
      return newHeaders;
    });
  }, []);

  const removeHeader = useCallback((headerKey) => {
    setCurrentHeaders((prev) => {
      const newHeaders = prev.filter((h) => h.key !== headerKey);
      setPinnedStates((prev) => {
        const newPinned = { ...prev };
        delete newPinned[headerKey];
        return newPinned;
      });
      return newHeaders;
    });
  }, []);

  const addHeader = useCallback((headerKey) => {
    if (!currentHeaders.some((h) => h.key === headerKey)) {
      setCurrentHeaders((prev) => [
        ...prev,
        { key: headerKey, visible: true, hidden: false },
      ]);
    }
  }, [currentHeaders]);

  const handleSheetNameChange = useCallback((e) => {
    setSheetName(e.target.value);
  }, []);

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
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            onTouchStart={(e) => handleTouchStart(e, index)}
            onTouchMove={(e) => handleTouchMove(e, index)}
            onTouchEnd={handleTouchEnd}
          >
            <div className={styles.headerRow}>
              <div className={styles.headerLeft}>
                <span className={styles.headerName}>{header.name}</span>
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
              </div>
              <div className={styles.actions}>
                <button
                  onClick={() => togglePin(header.key)}
                  className={`${styles.actionButton} ${pinnedStates[header.key] ? styles.pinned : ""}`}
                >
                  <FaThumbtack />
                </button>
                {pinnedStates[header.key] && (
                  <button
                    onClick={() => removeHeader(header.key)}
                    className={`${styles.removeTextButton}`}
                  >
                    Remove
                  </button>
                )}
                <span className={styles.dragIcon}>☰</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SheetModal;