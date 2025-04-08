import { useContext, useState, useCallback, useRef, useEffect } from "react";
import styles from "./SheetsModal.module.css";
import { MainContext } from "../../Contexts/MainContext";

const SheetsModal = ({ sheets, onSaveOrder }) => {
  const { sheets: contextSheets, setSheets } = useContext(MainContext);
  const [orderedItems, setOrderedItems] = useState(sheets.structure);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const dragItemRef = useRef(null);
  const sheetListRef = useRef(null);

  const handleDragStart = useCallback((e, index) => {
    setDraggedIndex(index);
    dragItemRef.current = e.target.closest(`.${styles.sheetItem}`);
    e.dataTransfer.effectAllowed = "move";
    // Add a slight delay to ensure dragging visuals kick in
    setTimeout(() => dragItemRef.current.classList.add(styles.dragging), 0);
  }, []);

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newItems = [...orderedItems];
    const [draggedItem] = newItems.splice(draggedIndex, 1);
    newItems.splice(index, 0, draggedItem);
    setOrderedItems(newItems);
    setDraggedIndex(index);
  }, [draggedIndex, orderedItems]);

  const handleDragEnd = useCallback(() => {
    if (dragItemRef.current) {
      dragItemRef.current.classList.remove(styles.dragging);
    }
    setDraggedIndex(null);
    setSheets((prev) => ({
      ...prev,
      structure: orderedItems,
    }));
    onSaveOrder(orderedItems);
  }, [orderedItems, setSheets, onSaveOrder]);

  // Touch handlers for mobile
  const handleTouchStart = useCallback((e, index) => {
    e.stopPropagation();
    setDraggedIndex(index);
    dragItemRef.current = e.target.closest(`.${styles.sheetItem}`);
    dragItemRef.current.classList.add(styles.dragging);
    document.body.style.touchAction = "none"; // Prevent pull-to-refresh
  }, []);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    if (draggedIndex === null || !dragItemRef.current) return;

    const touch = e.touches[0];
    const elements = document.elementsFromPoint(touch.clientX, touch.clientY);
    const targetItem = elements.find((el) => el.classList.contains(styles.sheetItem));
    if (targetItem) {
      const targetIndex = Array.from(targetItem.parentNode.children).indexOf(targetItem);
      if (targetIndex !== draggedIndex) {
        const newItems = [...orderedItems];
        const [draggedItem] = newItems.splice(draggedIndex, 1);
        newItems.splice(targetIndex, 0, draggedItem);
        setOrderedItems(newItems);
        setDraggedIndex(targetIndex);
      }
    }
  }, [draggedIndex, orderedItems]);

  const handleTouchEnd = useCallback(() => {
    if (dragItemRef.current) {
      dragItemRef.current.classList.remove(styles.dragging);
    }
    setDraggedIndex(null);
    setSheets((prev) => ({
      ...prev,
      structure: orderedItems,
    }));
    onSaveOrder(orderedItems);
    document.body.style.touchAction = ""; // Restore default touch behavior
  }, [orderedItems, setSheets, onSaveOrder]);

  // Ensure all items are draggable, including the first
  useEffect(() => {
    setOrderedItems(sheets.structure); // Sync with prop changes
  }, [sheets.structure]);

  return (
    <div className={styles.sheetList} ref={sheetListRef}>
      {orderedItems.map((item, index) => (
        <div
          key={item.sheetName || item.folderName}
          className={`${styles.sheetItem} ${draggedIndex === index ? styles.dragging : ""}`}
          onDragOver={(e) => handleDragOver(e, index)}
        >
          <div className={styles.sheetRow}>
            <span className={styles.sheetName}>
              {item.sheetName || item.folderName}
            </span>
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
      ))}
    </div>
  );
};

export default SheetsModal;