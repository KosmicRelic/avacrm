import { useState, useContext, useCallback, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import styles from "./CreateSheetsAndFolders.module.css";
import { MainContext } from "../../Contexts/MainContext";
import { ModalNavigatorContext } from "../../Contexts/ModalNavigator";
import { FaRegCircle, FaRegCheckCircle } from "react-icons/fa";

const CreateSheetsAndFolders = ({
  tempData,
  setTempData,
  sheets,
  setSheets,
  onSheetChange,
  handleSheetSave,
  handleFolderSave,
  handleClose,
}) => {
  const { isDarkTheme } = useContext(MainContext);
  const { setModalConfig, registerModalSteps } = useContext(ModalNavigatorContext);
  const [addType, setAddType] = useState("sheet");
  const [newSheetName, setNewSheetName] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedSheets, setSelectedSheets] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const hasInitialized = useRef(false);
  const handlersRef = useRef({ addType: "sheet", handleSheetSaveClick: () => {}, handleFolderSaveClick: () => {} });

  // Define callbacks
  const handleSheetSaveClick = useCallback(() => {
    const trimmedName = newSheetName.trim();
    if (!trimmedName) {
      setError("Please provide a sheet name.");
      return;
    }

    const sheetExists = sheets.allSheets.some(
      (sheet) => sheet.sheetName.toLowerCase() === trimmedName.toLowerCase()
    );
    if (sheetExists) {
      alert(`A sheet named "${trimmedName}" already exists. Please choose a different name.`);
      return;
    }

    setError("");
    const sheetId = `sheet_${Date.now()}`;
    handleSheetSave(trimmedName, [], sheetId);
    setNewSheetName("");
    setSearchQuery("");
    handleClose();
  }, [newSheetName, sheets.allSheets, handleSheetSave, handleClose]);

  const handleFolderSaveClick = useCallback(() => {
    const trimmedName = newFolderName.trim();
    if (!trimmedName) {
      setError("Please provide a folder name.");
      return;
    }

    const folderExists = sheets.structure.some(
      (item) => item.folderName && item.folderName.toLowerCase() === trimmedName.toLowerCase()
    );
    if (folderExists) {
      alert(`A folder named "${trimmedName}" already exists. Please choose a different name.`);
      return;
    }

    if (selectedSheets.includes("primarySheet")) {
      setError("The primary sheet cannot be added to a folder.");
      return;
    }

    setError("");
    handleFolderSave(trimmedName, selectedSheets);
    setNewFolderName("");
    setSelectedSheets([]);
    setSearchQuery("");
    handleClose();
  }, [newFolderName, selectedSheets, sheets.structure, handleFolderSave, handleClose]);

  // Update handlers ref
  useEffect(() => {
    handlersRef.current = {
      addType,
      handleSheetSaveClick,
      handleFolderSaveClick,
    };
  }, [addType, handleSheetSaveClick, handleFolderSaveClick]);

  // Initialize modal steps and config
  useEffect(() => {
    if (!hasInitialized.current) {
      registerModalSteps({
        steps: [{ title: "Create Sheets & Folders", rightButton: null }],
      });
      setModalConfig({
        showTitle: true,
        showDoneButton: true,
        showBackButton: false,
        title: "Create Sheets & Folders",
        backButtonTitle: "",
        leftButton: {
          label: "Create",
          onClick: () => {
            const { addType, handleSheetSaveClick, handleFolderSaveClick } = handlersRef.current;
            if (addType === "sheet") {
              handleSheetSaveClick();
            } else {
              handleFolderSaveClick();
            }
          },
        },
        onBackdropClick: handleClose,
      });
      hasInitialized.current = true;
    }
  }, [setModalConfig, registerModalSteps, handleClose]);

  const handleToggleType = useCallback(() => {
    setAddType((prev) => (prev === "sheet" ? "folder" : "sheet"));
    setNewSheetName("");
    setNewFolderName("");
    setSelectedSheets([]);
    setSearchQuery("");
    setError("");
  }, []);

  const toggleSheetSelection = useCallback((sheetName) => {
    setSelectedSheets((prev) =>
      prev.includes(sheetName) ? prev.filter((s) => s !== sheetName) : [...prev, sheetName]
    );
  }, []);

  // Get all sheet names that are already nested in folders
  const nestedSheetNames = sheets.structure
    .filter((item) => item.folderName)
    .flatMap((item) => item.sheets || []);

  // Get available sheets (excluding primarySheet and nested sheets)
  const availableSheets = sheets.allSheets
    .filter((sheet) => sheet.sheetName !== "primarySheet" && !nestedSheetNames.includes(sheet.sheetName))
    .map((sheet) => sheet.sheetName)
    .filter((sheetName) => sheetName.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className={`${styles.managerWrapper} ${isDarkTheme ? styles.darkTheme : ""}`}>
      <div className={`${styles.scrollContainer} ${isDarkTheme ? styles.darkTheme : ""}`}>
        {error && <div className={styles.error}>{error}</div>}
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
              <div className={styles.inputWrapper}>
                <input
                  key="sheet-input"
                  type="text"
                  value={newSheetName}
                  onChange={(e) => {
                    setNewSheetName(e.target.value);
                    setError("");
                  }}
                  placeholder="Enter Sheet Name"
                  className={`${styles.inputField} ${isDarkTheme ? styles.darkTheme : ""}`}
                />
              </div>
            </>
          )}
          {addType === "folder" && (
            <>
              <div className={styles.inputWrapper}>
                <input
                  key="folder-input"
                  type="text"
                  value={newFolderName}
                  onChange={(e) => {
                    setNewFolderName(e.target.value);
                    setError("");
                  }}
                  placeholder="Enter Folder Name"
                  className={`${styles.inputField} ${isDarkTheme ? styles.darkTheme : ""}`}
                />
              </div>
              <div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Sheets"
                  className={`${styles.inputField} ${isDarkTheme ? styles.darkTheme : ""}`}
                  style={{ marginBottom: "16px" }}
                />
              </div>
              <div className={`${styles.headerList} ${isDarkTheme ? styles.darkTheme : ""}`}>
                {availableSheets.length > 0 ? (
                  availableSheets.map((sheetName) => (
                    <div
                      key={`sheet-${sheetName}`}
                      className={`${styles.headerItem} ${isDarkTheme ? styles.darkTheme : ""}`}
                      onClick={() => toggleSheetSelection(sheetName)}
                    >
                      <div className={styles.headerRow}>
                        <div className={`${styles.headerNameType} ${isDarkTheme ? styles.darkTheme : ""}`}>
                          {selectedSheets.includes(sheetName) ? (
                            <FaRegCheckCircle
                              className={`${styles.customCheckbox} ${styles.checked} ${
                                isDarkTheme ? styles.darkTheme : ""
                              }`}
                              size={18}
                            />
                          ) : (
                            <FaRegCircle
                              className={`${styles.customCheckbox} ${
                                isDarkTheme ? styles.darkTheme : ""
                              }`}
                              size={18}
                            />
                          )}
                          <span>{sheetName}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={`${styles.noItems} ${isDarkTheme ? styles.darkTheme : ""}`}>
                    No sheets available to add.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

CreateSheetsAndFolders.propTypes = {
  tempData: PropTypes.shape({
    sheets: PropTypes.object,
  }).isRequired,
  setTempData: PropTypes.func.isRequired,
  sheets: PropTypes.shape({
    allSheets: PropTypes.array.isRequired,
    structure: PropTypes.array.isRequired,
  }).isRequired,
  setSheets: PropTypes.func.isRequired,
  onSheetChange: PropTypes.func.isRequired,
  handleSheetSave: PropTypes.func.isRequired,
  handleFolderSave: PropTypes.func.isRequired,
  handleClose: PropTypes.func.isRequired,
};

export default CreateSheetsAndFolders;