import { useContext, useState, useCallback, useMemo, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import styles from "./SheetModal.module.css";
import { MainContext } from "../../Contexts/MainContext";
import { ModalNavigatorContext } from "../../Contexts/ModalNavigator";
import { FaEye, FaEyeSlash, FaThumbtack } from "react-icons/fa";
import { MdFilterAlt, MdFilterAltOff } from "react-icons/md";

const SheetModal = ({
 isEditMode = false,
 tempData,
 setTempData,
 sheets = [],
 onPinToggle,
}) => {
 const { headers: allHeaders, isDarkTheme } = useContext(MainContext);
 const { registerModalSteps, setModalConfig } = useContext(ModalNavigatorContext);
 const [sheetName, setSheetName] = useState(tempData.sheetName || "");
 const [currentHeaders, setCurrentHeaders] = useState(() => {
 const uniqueHeaders = [];
 const seenKeys = new Set();
 (tempData.currentHeaders || []).forEach((header) => {
 if (!seenKeys.has(header.key)) {
 seenKeys.add(header.key);
 uniqueHeaders.push({ ...header });
 } else {
 console.warn(`Duplicate key "${header.key}" removed from initial currentHeaders`);
 }
 });
 return uniqueHeaders;
 });
 const [rows] = useState(tempData.rows || []);
 const [pinnedStates, setPinnedStates] = useState({});
 const [draggedIndex, setDraggedIndex] = useState(null);
 const [touchStartY, setTouchStartY] = useState(null);
 const [touchTargetIndex, setTouchTargetIndex] = useState(null);
 const headerRefs = useRef(new Map());
 const hasInitialized = useRef(false);

 // Initialize modal config
 useEffect(() => {
 if (!hasInitialized.current) {
 registerModalSteps({
 steps: [
 {
 title: isEditMode ? "Edit Sheet" : "Create Sheet",
 rightButton: null, // Use default Done button
 },
 ],
 });
 setModalConfig({
 showTitle: true,
 showDoneButton: true,
 showBackButton: false,
 title: isEditMode ? "Edit Sheet" : "Create Sheet",
 backButtonTitle: "",
 rightButton: null,
 });
 hasInitialized.current = true;
 }
 }, [registerModalSteps, setModalConfig, isEditMode]);

 // Sync tempData
 useEffect(() => {
 const newTempData = { sheetName, currentHeaders, rows };
 if (
 newTempData.sheetName !== tempData.sheetName ||
 JSON.stringify(newTempData.currentHeaders) !== JSON.stringify(tempData.currentHeaders) ||
 JSON.stringify(newTempData.rows) !== JSON.stringify(tempData.rows)
 ) {
 setTempData(newTempData);
 }
 }, [sheetName, currentHeaders, rows, setTempData]);

 const resolvedHeaders = useMemo(
 () =>
 currentHeaders.map((header) => {
 const globalHeader = allHeaders.find((h) => h.key === header.key);
 return {
 ...header,
 name: header.name || (globalHeader ? globalHeader.name : header.key),
 type: header.type || (globalHeader ? globalHeader.type : "text"),
 };
 }),
 [currentHeaders, allHeaders]
 );

 const handleDragStart = useCallback((e, index) => {
 setDraggedIndex(index);
 e.dataTransfer.effectAllowed = "move";
 const element = headerRefs.current.get(index);
 if (element) element.classList.add(styles.dragging);
 }, []);

 const handleTouchStart = useCallback((e, index) => {
 if (e.target.classList.contains(styles.dragIcon)) {
 e.preventDefault();
 setDraggedIndex(index);
 setTouchStartY(e.touches[0].clientY);
 setTouchTargetIndex(index);
 const element = headerRefs.current.get(index);
 if (element) element.classList.add(styles.dragging);
 }
 }, []);

 const handleDragOver = useCallback(
 (e, index) => {
 e.preventDefault();
 if (draggedIndex === null || draggedIndex === index) return;

 setCurrentHeaders((prev) => {
 const newHeaders = [...prev];
 const [draggedItem] = newHeaders.splice(draggedIndex, 1);
 newHeaders.splice(index, 0, draggedItem);
 setDraggedIndex(index);
 return newHeaders;
 });
 },
 [draggedIndex]
 );

 const handleTouchMove = useCallback(
 (e, index) => {
 if (draggedIndex === null || touchStartY === null) return;
 e.preventDefault();

 const touchY = e.touches[0].clientY;
 const itemHeight = 48;
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
 },
 [draggedIndex, touchStartY, touchTargetIndex, currentHeaders.length]
 );

 const handleDragEnd = useCallback(() => {
 const element = headerRefs.current.get(draggedIndex);
 if (element) element.classList.remove(styles.dragging);
 setDraggedIndex(null);
 }, [draggedIndex]);

 const handleTouchEnd = useCallback(() => {
 const element = headerRefs.current.get(draggedIndex);
 if (element) element.classList.remove(styles.dragging);
 setDraggedIndex(null);
 setTouchStartY(null);
 setTouchTargetIndex(null);
 }, [draggedIndex]);

 const togglePin = useCallback(
 (headerKey) => {
 setPinnedStates((prev) => ({
 ...prev,
 [headerKey]: !prev[headerKey],
 }));
 onPinToggle(headerKey);
 },
 [onPinToggle]
 );

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
 setCurrentHeaders((prev) => {
 if (prev.some((h) => h.key === headerKey)) {
 console.warn(`Duplicate header key "${headerKey}" ignored`);
 return prev;
 }
 return [
 ...prev,
 { key: headerKey, visible: true, hidden: false },
 ];
 });
 }, []);

 const handleSheetNameChange = useCallback((e) => {
 setSheetName(e.target.value); // Allow spaces, no trimming
 }, []);

 return (
 <div className={`${styles.sheetModal} ${isDarkTheme ? styles.darkTheme : ""}`}>
 <input
 type="text"
 value={sheetName}
 onChange={handleSheetNameChange}
 placeholder={isEditMode ? "Rename sheet" : "Sheet Name"}
 className={`${styles.sheetNameInput} ${isDarkTheme ? styles.darkTheme : ""}`}
 />
 <select
 onChange={(e) => {
 const selectedKey = e.target.value;
 if (selectedKey) addHeader(selectedKey);
 e.target.value = "";
 }}
 className={`${styles.addHeaderSelect} ${isDarkTheme ? styles.darkTheme : ""}`}
 >
 <option value="">Add Column</option>
 {allHeaders
 .filter((h) => !currentHeaders.some((ch) => ch.key === h.key))
 .map((header, index) => (
 <option key={`${header.key}-${index}`} value={header.key}>
 {header.name} ({header.type})
 </option>
 ))}
 </select>
 <div className={`${styles.headerList} ${isDarkTheme ? styles.darkTheme : ""}`}>
 {resolvedHeaders.map((header, index) => (
 <div
 ref={(el) => headerRefs.current.set(index, el)}
 key={header.key}
 className={`${styles.headerItem} ${draggedIndex === index ? styles.dragging : ""} ${
 isDarkTheme ? styles.darkTheme : ""
 }`}
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
 <button
 onClick={() => togglePin(header.key)}
 className={`${styles.actionButton} ${pinnedStates[header.key] ? styles.pinned : ""} ${
 isDarkTheme ? styles.darkTheme : ""
 }`}
 >
 <FaThumbtack />
 </button>
 {pinnedStates[header.key] && (
 <button
 onClick={() => removeHeader(header.key)}
 className={`${styles.removeTextButton} ${isDarkTheme ? styles.darkTheme : ""}`}
 >
 Remove
 </button>
 )}
 <span className={styles.headerName}>{header.name}</span>
 </div>
 <div className={styles.actions}>
 <button
 onClick={() => toggleHidden(index)}
 className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
 >
 {header.hidden ? <MdFilterAltOff /> : <MdFilterAlt />}
 </button>
 <button
 onClick={() => toggleVisible(index)}
 className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
 >
 {header.visible ? <FaEye /> : <FaEyeSlash />}
 </button>
 <div className={styles.buttonSpacer}></div>
 <span className={`${styles.dragIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
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

SheetModal.propTypes = {
 isEditMode: PropTypes.bool,
 tempData: PropTypes.shape({
 sheetName: PropTypes.string,
 currentHeaders: PropTypes.arrayOf(PropTypes.object),
 rows: PropTypes.array,
 }).isRequired,
 setTempData: PropTypes.func.isRequired,
 sheets: PropTypes.array,
 onPinToggle: PropTypes.func.isRequired,
};

export default SheetModal;