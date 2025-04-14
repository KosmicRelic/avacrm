import { useState, useContext, useCallback, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import styles from "./SheetFolderManager.module.css";
import { MainContext } from "../../Contexts/MainContext";
import { ModalNavigatorContext } from "../../Contexts/ModalNavigator";
import useClickOutside from "../Hooks/UseClickOutside";

const SheetFolderManager = ({
  tempData,
  setTempData,
  sheets,
  setSheets,
  headers,
  onSheetChange,
  handleSheetSave,
  handleFolderSave,
  handleClose,
}) => {
  const { isDarkTheme } = useContext(MainContext);
  const { setModalConfig } = useContext(ModalNavigatorContext);
  const [addType, setAddType] = useState("sheet");
  const [newSheetName, setNewSheetName] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedSheets, setSelectedSheets] = useState([]);
  const [selectedHeaders, setSelectedHeaders] = useState([]);
  const modalRef = useRef(null);
  const hasInitialized = useRef(false);

  useClickOutside(modalRef, true, handleClose);

  // Set modal title and config
  useEffect(() => {
    if (!hasInitialized.current) {
      setModalConfig({
        showTitle: true,
        showDoneButton: true,
        showBackButton: false,
        title: "Create Sheets & Folders",
        backButtonTitle: "",
        rightButton: null,
      });
      hasInitialized.current = true;
    }
  }, [setModalConfig]);

  const handleToggleType = useCallback(() => {
    setAddType((prev) => (prev === "sheet" ? "folder" : "sheet"));
    setNewSheetName("");
    setNewFolderName("");
    setSelectedSheets([]);
    setSelectedHeaders([]);
  }, []);

  const handleSheetSaveClick = useCallback(() => {
    if (!newSheetName.trim()) {
      alert("Please provide a sheet name.");
      return;
    }
    console.log("SheetFolderManager - Saving sheet:", { newSheetName, selectedHeaders });
    handleSheetSave(newSheetName, selectedHeaders);
    setTimeout(() => {
      setNewSheetName("");
      setSelectedHeaders([]);
      handleClose();
    }, 100); // Slight delay for state update
  }, [newSheetName, selectedHeaders, handleSheetSave, handleClose]);

  const handleFolderSaveClick = useCallback(() => {
    if (!newFolderName.trim()) {
      alert("Please provide a folder name.");
      return;
    }
    console.log("SheetFolderManager - Saving folder:", { newFolderName, selectedSheets });
    handleFolderSave(newFolderName, selectedSheets);
    setTimeout(() => {
      setNewFolderName("");
      setSelectedSheets([]);
      handleClose();
    }, 100); // Slight delay for state update
  }, [newFolderName, selectedSheets, handleFolderSave, handleClose]);

  const toggleSheetSelection = useCallback((sheetName) => {
    setSelectedSheets((prev) =>
      prev.includes(sheetName) ? prev.filter((s) => s !== sheetName) : [...prev, sheetName]
    );
  }, []);

  const toggleHeaderSelection = useCallback((headerKey) => {
    setSelectedHeaders((prev) =>
      prev.includes(headerKey) ? prev.filter((h) => h !== headerKey) : [...prev, headerKey]
    );
  }, []);

  const availableHeaders = headers.map((h, index) => ({
    key: h.key || `header-${index}`,
    name: h.name || Object.values(h)[0],
    type: h.type || "text",
  }));

  const folderSheets = sheets.structure
    .filter((item) => item.folderName)
    .flatMap((folder) => folder.sheets);
  const availableSheets = sheets.allSheets
    .filter((sheet) => !folderSheets.includes(sheet.sheetName))
    .map((sheet) => sheet.sheetName);

  return (
    <div className={`${styles.managerWrapper} ${isDarkTheme ? styles.darkTheme : ""}`} ref={modalRef}>
      <div className={`${styles.toggleContainer} ${isDarkTheme ? styles.darkTheme : ""}`}>
        <div
          className={`${styles.toggleButton} ${addType === "sheet" ? styles.activeToggle : ""} ${
            isDarkTheme ? styles.darkTheme : ""
          }`}
          onClick={() => setAddType("sheet")}
        >
          Sheets
        </div>
        <div
          className={`${styles.toggleButton} ${addType === "folder" ? styles.activeToggle : ""} ${
            isDarkTheme ? styles.darkTheme : ""
          }`}
          onClick={() => setAddType("folder")}
        >
          Folders
        </div>
        <div
          className={`${styles.toggleBackground} ${
            addType === "sheet" ? styles.sheetActive : styles.folderActive
          } ${isDarkTheme ? styles.darkTheme : ""}`}
        ></div>
      </div>
      <div className={`${styles.contentContainer} ${isDarkTheme ? styles.darkTheme : ""}`}>
        {addType === "sheet" && (
          <>
            <input
              type="text"
              value={newSheetName}
              onChange={(e) => setNewSheetName(e.target.value)}
              placeholder="Sheet Name"
              className={`${styles.inputField} ${isDarkTheme ? styles.darkTheme : ""}`}
            />
            <div className={`${styles.headerList} ${isDarkTheme ? styles.darkTheme : ""}`}>
              {availableHeaders.map((header) => (
                <div
                  key={header.key}
                  className={`${styles.headerItem} ${isDarkTheme ? styles.darkTheme : ""}`}
                  onClick={() => toggleHeaderSelection(header.key)}
                >
                  <div className={styles.headerRow}>
                    <div className={`${styles.headerNameType} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      <span
                        className={`${styles.customCheckbox} ${
                          selectedHeaders.includes(header.key) ? styles.checked : ""
                        } ${isDarkTheme ? styles.darkTheme : ""}`}
                      ></span>
                      <span>{header.name}</span>
                      <span className={`${styles.headerType} ${isDarkTheme ? styles.darkTheme : ""}`}>
                        ({header.type})
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.actionButtons}>
              <button
                onClick={handleSheetSaveClick}
                className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
              >
                Create Sheet
              </button>
            </div>
          </>
        )}
        {addType === "folder" && (
          <>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder Name"
              className={`${styles.inputField} ${isDarkTheme ? styles.darkTheme : ""}`}
            />
            <div className={`${styles.headerList} ${isDarkTheme ? styles.darkTheme : ""}`}>
              {availableSheets.length > 0 ? (
                availableSheets.map((sheetName) => (
                  <div
                    key={sheetName}
                    className={`${styles.headerItem} ${isDarkTheme ? styles.darkTheme : ""}`}
                    onClick={() => toggleSheetSelection(sheetName)}
                  >
                    <div className={styles.headerRow}>
                      <div className={`${styles.headerNameType} ${isDarkTheme ? styles.darkTheme : ""}`}>
                        <span
                          className={`${styles.customCheckbox} ${
                            selectedSheets.includes(sheetName) ? styles.checked : ""
                          } ${isDarkTheme ? styles.darkTheme : ""}`}
                        ></span>
                        <span>{sheetName}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.noItems}>No sheets available to add to a folder.</div>
              )}
            </div>
            <div className={styles.actionButtons}>
              <button
                onClick={handleFolderSaveClick}
                className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
              >
                Create Folder
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

SheetFolderManager.propTypes = {
  tempData: PropTypes.shape({
    sheets: PropTypes.object,
  }).isRequired,
  setTempData: PropTypes.func.isRequired,
  sheets: PropTypes.shape({
    allSheets: PropTypes.array.isRequired,
    structure: PropTypes.array.isRequired,
  }).isRequired,
  setSheets: PropTypes.func.isRequired,
  headers: PropTypes.array.isRequired,
  onSheetChange: PropTypes.func.isRequired,
  handleSheetSave: PropTypes.func.isRequired,
  handleFolderSave: PropTypes.func.isRequired,
  handleClose: PropTypes.func.isRequired,
};

export default SheetFolderManager;