import { useContext, useState, useCallback, useRef, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import styles from "./SheetsModal.module.css";
import { MainContext } from "../../Contexts/MainContext";
import { ModalNavigatorContext } from "../../Contexts/ModalNavigator";

const SheetsModal = ({ sheets, tempData, setTempData }) => {
  const { isDarkTheme } = useContext(MainContext);
  const { registerModalSteps, setModalConfig } = useContext(ModalNavigatorContext);
  const [orderedItems, setOrderedItems] = useState(() => {
    const structure = sheets?.structure || [];
    return structure.map((item) => ({
      ...item,
      displayName: item.sheetName || item.folderName,
    }));
  });
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchTargetIndex, setTouchTargetIndex] = useState(null);
  const dragItemRef = useRef(null);
  const hasInitialized = useRef(false);

  // Initialize modal config
  useEffect(() => {
    if (!hasInitialized.current) {
      registerModalSteps({
        steps: [
          {
            title: "Manage Sheets",
            rightButton: null, // Use default Done button
          },
        ],
      });
      setModalConfig({
        showTitle: true,
        showDoneButton: true,
        showBackButton: false,
        title: "Manage Sheets",
        backButtonTitle: "",
        rightButton: null,
      });
      hasInitialized.current = true;
    }
  }, [registerModalSteps, setModalConfig]);

  // Sync orderedItems only on sheets.structure change, not during drags
  useEffect(() => {
    if (draggedIndex !== null) return; // Skip sync during drag
    const structure = sheets?.structure || [];
    const newItems = structure.map((item) => ({
      ...item,
      displayName: item.sheetName || item.folderName,
    }));
    if (JSON.stringify(newItems) !== JSON.stringify(orderedItems)) {
      setOrderedItems(newItems);
    }
  }, [sheets?.structure, orderedItems]);

  // Stabilize orderedItems for tempData
  const stableOrderedItems = useMemo(() => orderedItems, [orderedItems]);

  // Update tempData on orderedItems change
  useEffect(() => {
    const newStructure = stableOrderedItems.map((item) => {
      if (item.folderName) {
        return { folderName: item.folderName, sheets: item.sheets };
      }
      return { sheetName: item.sheetName };
    });
    const newTempData = { newOrder: newStructure };
    const currentTempData = tempData.newOrder || [];
    // Compare without displayName
    const newStr = JSON.stringify(newStructure);
    const currStr = JSON.stringify(currentTempData);
    if (newStr !== currStr) {
      setTempData(newTempData);
    }
  }, [stableOrderedItems, setTempData, tempData]);

  const handleDragStart = useCallback((e, index) => {
    setDraggedIndex(index);
    dragItemRef.current = e.target.closest(`.${styles.sheetItem}`);
    e.dataTransfer.effectAllowed = "move";
    if (dragItemRef.current) {
      dragItemRef.current.classList.add(styles.dragging);
    }
  }, []);

  const handleDragOver = useCallback(
    (e, index) => {
      e.preventDefault();
      if (draggedIndex === null || draggedIndex === index) return;

      setOrderedItems((prev) => {
        const newItems = [...prev];
        const [draggedItem] = newItems.splice(draggedIndex, 1);
        newItems.splice(index, 0, draggedItem);
        setDraggedIndex(index);
        return newItems;
      });
    },
    [draggedIndex]
  );

  const handleDragEnd = useCallback(() => {
    if (dragItemRef.current) {
      dragItemRef.current.classList.remove(styles.dragging);
      dragItemRef.current = null;
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
      if (dragItemRef.current) {
        dragItemRef.current.classList.add(styles.dragging);
      }
    }
  }, []);

  const handleTouchMove = useCallback(
    (e) => {
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
    },
    [draggedIndex, touchStartY, touchTargetIndex, orderedItems.length]
  );

  const handleTouchEnd = useCallback(() => {
    if (dragItemRef.current) {
      dragItemRef.current.classList.remove(styles.dragging);
      dragItemRef.current = null;
    }
    setDraggedIndex(null);
    setTouchStartY(null);
    setTouchTargetIndex(null);
  }, []);

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
            <span className={styles.sheetName}>{item.displayName}</span>
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

SheetsModal.propTypes = {
  sheets: PropTypes.shape({
    structure: PropTypes.arrayOf(
      PropTypes.oneOfType([
        PropTypes.shape({ sheetName: PropTypes.string.isRequired }),
        PropTypes.shape({
          folderName: PropTypes.string.isRequired,
          sheets: PropTypes.arrayOf(PropTypes.string).isRequired,
        }),
      ])
    ),
  }).isRequired,
  tempData: PropTypes.shape({
    newOrder: PropTypes.array,
  }).isRequired,
  setTempData: PropTypes.func.isRequired,
};

export default SheetsModal;