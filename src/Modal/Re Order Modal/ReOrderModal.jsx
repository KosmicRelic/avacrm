import { useContext, useState, useCallback, useRef, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import styles from "./ReOrderModal.module.css";
import { MainContext } from "../../Contexts/MainContext";
import { ModalNavigatorContext } from "../../Contexts/ModalNavigator";
import { IoArrowBack, IoChevronForward } from "react-icons/io5";
import { FaFolder } from "react-icons/fa";
import { BiSolidSpreadsheet } from "react-icons/bi";

const ReOrderModal = ({ sheets, tempData, setTempData }) => {
  const { isDarkTheme } = useContext(MainContext);
  const { registerModalSteps, setModalConfig, goToStep, currentStep } = useContext(ModalNavigatorContext);
  const [orderedItems, setOrderedItems] = useState(() => {
    const structure = sheets?.structure || [];
    return structure.map((item, index) => ({
      ...item,
      displayName: index === 0 ? "Search Cards" : item.sheetName || item.folderName,
      id: item.sheetName || item.folderName || `item-${index}`,
    }));
  });
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchTargetIndex, setTouchTargetIndex] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [orderedFolderSheets, setOrderedFolderSheets] = useState([]);
  const [navigationDirection, setNavigationDirection] = useState(null); // Track navigation direction
  const dragItemRef = useRef(null);
  const hasInitialized = useRef(false);
  const prevStepRef = useRef(currentStep); // Track previous step

  // Initialize modal steps
  useEffect(() => {
    if (!hasInitialized.current) {
      const steps = [
        {
          title: "Reorder Sheets",
          rightButton: null,
        },
        {
          title: () => selectedFolder || "Folder Sheets",
          rightButton: null,
        },
      ];
      registerModalSteps({ steps });
      setModalConfig({
        showTitle: true,
        showDoneButton: true,
        showBackButton: false,
        title: "Reorder Sheets",
        backButtonTitle: "",
        rightButton: null,
      });
      hasInitialized.current = true;
    }
  }, [registerModalSteps, setModalConfig, selectedFolder]);

  // Update modal config and navigation direction
  useEffect(() => {
    setModalConfig((prev) => ({
      ...prev,
      title: currentStep === 1 ? "Reorder Sheets" : selectedFolder || "Folder Sheets",
      showDoneButton: currentStep === 1,
      showBackButton: currentStep === 2,
      rightButton: null,
    }));

    // Set navigation direction based on step change
    if (prevStepRef.current !== currentStep) {
      setNavigationDirection(currentStep > prevStepRef.current ? "forward" : "backward");
      prevStepRef.current = currentStep;
    }
  }, [currentStep, selectedFolder, setModalConfig]);

  // Initialize folder sheets when entering step 2
  useEffect(() => {
    if (currentStep === 2 && selectedFolder) {
      const folder = orderedItems.find((item) => item.folderName === selectedFolder);
      const folderSheets = folder?.sheets || [];
      setOrderedFolderSheets(folderSheets.map((sheetName) => ({ sheetName, displayName: sheetName })));
    }
  }, [currentStep, selectedFolder, orderedItems]);

  // Update tempData for main structure
  useEffect(() => {
    const newStructure = orderedItems.map((item) => {
      if (item.folderName) {
        return {
          folderName: item.folderName,
          sheets: item.sheets?.length && selectedFolder === item.folderName
            ? orderedFolderSheets.map((sheet) => sheet.sheetName)
            : item.sheets || [],
        };
      }
      return { sheetName: item.sheetName };
    });
    const newTempData = { newOrder: newStructure };
    const currentTempData = tempData.newOrder || [];
    if (JSON.stringify(newStructure) !== JSON.stringify(currentTempData)) {
      setTempData(newTempData);
    }
  }, [orderedItems, orderedFolderSheets, selectedFolder, setTempData, tempData]);

  const handleDragStart = useCallback((e, index) => {
    if (index === 0) return;
    setDraggedIndex(index);
    dragItemRef.current = e.target.closest(`.${styles.sheetItem}`);
    e.dataTransfer.effectAllowed = "move";
    dragItemRef.current?.classList.add(styles.dragging);
  }, []);

  const handleDragOver = useCallback(
    (e, index) => {
      e.preventDefault();
      if (draggedIndex === null || draggedIndex === index || index === 0 || draggedIndex === 0) return;
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
    if (index === 0) return;
    if (e.target.classList.contains(styles.dragIcon)) {
      e.preventDefault();
      setDraggedIndex(index);
      setTouchStartY(e.touches[0].clientY);
      setTouchTargetIndex(index);
      dragItemRef.current = e.target.closest(`.${styles.sheetItem}`);
      dragItemRef.current?.classList.add(styles.dragging);
    }
  }, []);

  const handleTouchMove = useCallback(
    (e) => {
      if (draggedIndex === null || touchStartY === null) return;
      e.preventDefault();

      const touchY = e.touches[0].clientY;
      const itemHeight = 48;
      const delta = Math.round((touchY - touchStartY) / itemHeight);

      const newIndex = Math.max(1, Math.min(touchTargetIndex + delta, orderedItems.length - 1));
      if (newIndex !== draggedIndex) {
        setOrderedItems((prev) => {
          const newItems = [...prev];
          const [draggedItem] = newItems.splice(draggedIndex, 1);
          newItems.splice(newIndex, 0, draggedItem);
          setDraggedIndex(newIndex);
          return newItems;
        });
        setTouchTargetIndex(newIndex);
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

  const handleFolderClick = useCallback(
    (folderName) => {
      setSelectedFolder(folderName);
      setNavigationDirection("forward");
      goToStep(2);
    },
    [goToStep]
  );

  const handleFolderSheetDragStart = useCallback((e, index) => {
    setDraggedIndex(index);
    dragItemRef.current = e.target.closest(`.${styles.sheetItem}`);
    e.dataTransfer.effectAllowed = "move";
    dragItemRef.current?.classList.add(styles.dragging);
  }, []);

  const handleFolderSheetDragOver = useCallback(
    (e, index) => {
      e.preventDefault();
      if (draggedIndex === null || draggedIndex === index) return;

      setOrderedFolderSheets((prev) => {
        const newItems = [...prev];
        const [draggedItem] = newItems.splice(draggedIndex, 1);
        newItems.splice(index, 0, draggedItem);
        setDraggedIndex(index);
        return newItems;
      });
    },
    [draggedIndex]
  );

  const handleFolderSheetDragEnd = useCallback(() => {
    if (dragItemRef.current) {
      dragItemRef.current.classList.remove(styles.dragging);
      dragItemRef.current = null;
    }
    setDraggedIndex(null);
  }, []);

  const handleFolderSheetTouchStart = useCallback((e, index) => {
    if (e.target.classList.contains(styles.dragIcon)) {
      e.preventDefault();
      setDraggedIndex(index);
      setTouchStartY(e.touches[0].clientY);
      setTouchTargetIndex(index);
      dragItemRef.current = e.target.closest(`.${styles.sheetItem}`);
      dragItemRef.current?.classList.add(styles.dragging);
    }
  }, []);

  const handleFolderSheetTouchMove = useCallback(
    (e) => {
      if (draggedIndex === null || touchStartY === null) return;
      e.preventDefault();

      const touchY = e.touches[0].clientY;
      const itemHeight = 48;
      const delta = Math.round((touchY - touchStartY) / itemHeight);

      const newIndex = Math.max(0, Math.min(touchTargetIndex + delta, orderedFolderSheets.length - 1));
      if (newIndex !== draggedIndex) {
        setOrderedFolderSheets((prev) => {
          const newItems = [...prev];
          const [draggedItem] = newItems.splice(draggedIndex, 1);
          newItems.splice(newIndex, 0, draggedItem);
          setDraggedIndex(newIndex);
          return newItems;
        });
        setTouchTargetIndex(newIndex);
      }
    },
    [draggedIndex, touchStartY, touchTargetIndex, orderedFolderSheets.length]
  );

  const handleFolderSheetTouchEnd = useCallback(() => {
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
      {[1, 2].map((step) => (
        <div
          key={step}
          className={`${styles.view} ${isDarkTheme ? styles.darkTheme : ""} ${
            step !== currentStep ? styles.hidden : ""
          } ${
            step === currentStep && navigationDirection === "forward" ? styles.animateForward : ""
          } ${
            step === currentStep && navigationDirection === "backward" ? styles.animateBackward : ""
          }`}
          style={{ display: step !== currentStep ? "none" : "block" }}
        >
          {step === 1 &&
            orderedItems.map((item, index) => (
              <div
                key={item.id}
                className={`${styles.sheetItem} ${draggedIndex === index ? styles.dragging : ""} ${
                  isDarkTheme ? styles.darkTheme : ""
                }`}
                onDragOver={(e) => handleDragOver(e, index)}
              >
                <div
                  className={`${styles.sheetRow} ${item.folderName ? styles.folderRow : ""}`}
                  onClick={() => item.folderName && handleFolderClick(item.folderName)}
                >
                  <span className={styles.sheetName}>
                    {item.folderName ? (
                      <>
                        <FaFolder className={styles.folderIcon} />
                        {item.displayName}
                        <IoChevronForward className={styles.folderChevron} />
                      </>
                    ) : (
                      <>
                        <BiSolidSpreadsheet className={styles.folderIcon} />
                        {item.displayName}
                      </>
                    )}
                  </span>
                  {index !== 0 && (
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
                  )}
                </div>
              </div>
            ))}
          {step === 2 && selectedFolder && (
            <div className={styles.folderSheetsContainer}>
              {orderedFolderSheets.length > 0 ? (
                orderedFolderSheets.map((sheet, index) => (
                  <div
                    key={sheet.sheetName || `sheet-${index}`}
                    className={`${styles.sheetItem} ${draggedIndex === index ? styles.dragging : ""} ${
                      isDarkTheme ? styles.darkTheme : ""
                    }`}
                    onDragOver={(e) => handleFolderSheetDragOver(e, index)}
                  >
                    <div className={styles.sheetRow}>
                      <span className={styles.sheetName}>
                        <BiSolidSpreadsheet className={styles.folderIcon} />
                        {sheet.displayName || sheet.sheetName}
                      </span>
                      <span
                        className={`${styles.dragIcon} ${isDarkTheme ? styles.darkTheme : ""}`}
                        draggable
                        onDragStart={(e) => handleFolderSheetDragStart(e, index)}
                        onDragEnd={handleFolderSheetDragEnd}
                        onTouchStart={(e) => handleFolderSheetTouchStart(e, index)}
                        onTouchMove={handleFolderSheetTouchMove}
                        onTouchEnd={handleFolderSheetTouchEnd}
                      >
                        ☰
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.emptyMessage}>No sheets in this folder</div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

ReOrderModal.propTypes = {
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

export default ReOrderModal;