import { useContext, useState, useCallback, useRef, useEffect } from "react";
import styles from "./SheetsModal.module.css";
import { MainContext } from "../../Contexts/MainContext";

const SheetsModal = ({ sheets, onSaveOrder, tempData, setTempData }) => {
  const { setSheets, isDarkTheme } = useContext(MainContext);
  const [orderedItems, setOrderedItems] = useState(() => {
    return sheets.structure.map(item => ({
      ...item,
      displayName: item.sheetName || item.folderName
    }));
  });
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchTargetIndex, setTouchTargetIndex] = useState(null);
  const dragItemRef = useRef(null);

  useEffect(() => {
    const newStructure = orderedItems.map(item => {
      if (item.folderName) {
        return { folderName: item.folderName, sheets: item.sheets };
      }
      return { sheetName: item.sheetName };
    });
    setTempData((prev) => ({
      ...prev,
      newOrder: newStructure
    }));
  }, [orderedItems, setTempData]);

  const handleDragStart = useCallback((e, index) => {
    setDraggedIndex(index);
    dragItemRef.current = e.target.closest(`.${styles.sheetItem}`);
    e.dataTransfer.effectAllowed = "move";
    dragItemRef.current.classList.add(styles.dragging);
  }, []);

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    setOrderedItems((prev) => {
      const newItems = [...prev];
      const [draggedItem] = newItems.splice(draggedIndex, 1);
      newItems.splice(index, 0, draggedItem);
      setDraggedIndex(index);
      return newItems;
    });
  }, [draggedIndex]);

  const handleDragEnd = useCallback(() => {
    if (dragItemRef.current) {
      dragItemRef.current.classList.remove(styles.dragging);
    }
    setDraggedIndex(null);
  }, []);

  const handleTouchStart = useCallback((e, index) => {
    if (e.target.classList.contains(styles.dragIcon)) {
      e.preventDefault();
      setDraggedIndex(index);
      setTouchStartY(e.touches[0].clientY);
      setTouchTargetIndex(index);
      dragItemRef.current = e.target.closest(`.${styles.sheetItem}`);
      dragItemRef.current.classList.add(styles.dragging);
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (draggedIndex === null || touchStartY === null) return;
    e.preventDefault();

    const touchY = e.touches[0].clientY;
    const itemHeight = 48;
    const delta = Math.round((touchY - touchStartY) / itemHeight);

    const newIndex = Math.max(0, Math.min(touchTargetIndex + delta, orderedItems.length - 1));
    if (newIndex !== draggedIndex) {
      setOrderedItems((prev) => {
        const newItems = [...prev];
        const [draggedItem] = newItems.splice(draggedIndex, 1);
        newItems.splice(newIndex, 0, draggedItem);
        setDraggedIndex(newIndex);
        return newItems;
      });
    }
  }, [draggedIndex, touchStartY, touchTargetIndex, orderedItems.length]);

  const handleTouchEnd = useCallback(() => {
    if (dragItemRef.current) {
      dragItemRef.current.classList.remove(styles.dragging);
    }
    setDraggedIndex(null);
    setTouchStartY(null);
    setTouchTargetIndex(null);
  }, []);

  useEffect(() => {
    setOrderedItems(sheets.structure.map(item => ({
      ...item,
      displayName: item.sheetName || item.folderName
    })));
  }, [sheets.structure]);

  return (
    <div className={`${styles.sheetList} ${isDarkTheme ? styles.darkTheme : ""}`}>
      {orderedItems.map((item, index) => (
        <div
          key={item.displayName}
          className={`${styles.sheetItem} ${draggedIndex === index ? styles.dragging : ""} ${
            isDarkTheme ? styles.darkTheme : ""
          }`}
          onDragOver={(e) => handleDragOver(e, index)}
        >
          <div className={styles.sheetRow}>
            <span className={styles.sheetName}>
              {item.displayName}
            </span>
            <span
              className={`${styles.dragIcon} ${isDarkTheme ? styles.darkTheme : ""}`}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => handleTouchStart(e, index)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              ☰
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SheetsModal;