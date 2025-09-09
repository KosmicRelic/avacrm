import { useState, useContext, useCallback, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import styles from "./CreateSheetsAndFolders.module.css";
import { MainContext } from "../../Contexts/MainContext";
import { ModalNavigatorContext } from "../../Contexts/ModalNavigator";
import { FaRegCircle, FaRegCheckCircle, FaFileAlt, FaFolder, FaPlus, FaSearch } from "react-icons/fa";

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
        onBackdropClick: handleClose,
      });
      hasInitialized.current = true;
    }
  }, [setModalConfig, registerModalSteps, handleClose]);

  // Update modal config to ensure Done button is shown
  useEffect(() => {
    setModalConfig((prev) => ({
      ...prev,
      showDoneButton: true,
      showBackButton: false,
      rightButton: null,
    }));
  }, [setModalConfig]);

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
        {error && <div className={`${styles.error} ${isDarkTheme ? styles.darkTheme : ""}`}>{error}</div>}

        {/* Toggle Container */}
        <div className={`${styles.toggleContainer} ${isDarkTheme ? styles.darkTheme : ""}`}>
          <div
            className={`${styles.tabButton} ${addType === "sheet" ? styles.activeTab : ""} ${
              isDarkTheme ? styles.darkTheme : ""
            }`}
            onClick={() => setAddType("sheet")}
          >
            <FaFileAlt size={16} />
            New Sheet
          </div>
          <div
            className={`${styles.tabButton} ${addType === "folder" ? styles.activeTab : ""} ${
              isDarkTheme ? styles.darkTheme : ""
            }`}
            onClick={() => setAddType("folder")}
          >
            <FaFolder size={16} />
            New Folder
          </div>
        </div>

        <div className={`${styles.contentContainer} ${isDarkTheme ? styles.darkTheme : ""}`}>
          {addType === "sheet" && (
            <div className={styles.section}>
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
                  className={`${styles.searchBar} ${isDarkTheme ? styles.darkTheme : ""}`}
                />
              </div>

              <div className={styles.buttonWrapper}>
                <button
                  className={`${styles.createButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                  onClick={handleSheetSaveClick}
                  disabled={!newSheetName.trim()}
                >
                  <FaPlus size={16} />
                  Create Sheet
                </button>
              </div>
            </div>
          )}

          {addType === "folder" && (
            <>
              <div className={styles.section}>
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
                    className={`${styles.searchBar} ${isDarkTheme ? styles.darkTheme : ""}`}
                  />
                </div>

                <div className={styles.buttonWrapper}>
                  <button
                    className={`${styles.createButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                    onClick={handleFolderSaveClick}
                    disabled={!newFolderName.trim()}
                  >
                    <FaPlus size={16} />
                    Create Folder
                  </button>
                </div>
              </div>

              {availableSheets.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.inputWrapper}>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search sheets to add..."
                      className={`${styles.searchBar} ${styles.small} ${isDarkTheme ? styles.darkTheme : ""}`}
                    />
                  </div>

                  <div className={`${styles.sheetSelection} ${isDarkTheme ? styles.darkTheme : ""}`}>
                    {availableSheets.map((sheetName) => (
                      <div
                        key={`sheet-${sheetName}`}
                        className={`${styles.sheetOption} ${selectedSheets.includes(sheetName) ? styles.selected : ""} ${isDarkTheme ? styles.darkTheme : ""}`}
                        onClick={() => toggleSheetSelection(sheetName)}
                      >
                        <FaFileAlt size={14} />
                        <span className={styles.sheetName}>{sheetName}</span>
                        {selectedSheets.includes(sheetName) && (
                          <FaRegCheckCircle size={14} className={styles.checkIcon} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
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