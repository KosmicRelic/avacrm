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

        {/* Section Title */}
        <div className={styles.section}>
          <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>
            Create New Content
          </h2>
          <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>
            Choose what you'd like to create and configure the details below.
          </p>
        </div>

        {/* Toggle Container */}
        <div className={`${styles.toggleContainer} ${isDarkTheme ? styles.darkTheme : ""}`}>
          <div
            className={`${styles.tabButton} ${addType === "sheet" ? styles.activeTab : ""} ${
              isDarkTheme ? styles.darkTheme : ""
            }`}
            onClick={() => setAddType("sheet")}
          >
            Sheets
          </div>
          <div
            className={`${styles.tabButton} ${addType === "folder" ? styles.activeTab : ""} ${
              isDarkTheme ? styles.darkTheme : ""
            }`}
            onClick={() => setAddType("folder")}
          >
            Folders
          </div>
        </div>

        <div className={`${styles.contentContainer} ${isDarkTheme ? styles.darkTheme : ""}`}>
          {addType === "sheet" && (
            <div className={styles.section}>
              <h3 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>
                New Sheet
              </h3>
              <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>
                Create a new sheet to organize your data and metrics.
              </p>

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
                <h3 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>
                  New Folder
                </h3>
                <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>
                  Create a folder to organize multiple sheets together.
                </p>

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

              <div className={styles.section}>
                <h3 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>
                  Select Sheets
                </h3>
                <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>
                  Choose which sheets to include in this folder.
                </p>

                <div className={styles.inputWrapper}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Sheets"
                    className={`${styles.searchBar} ${isDarkTheme ? styles.darkTheme : ""}`}
                  />
                </div>

                <div className={styles.configGrid}>
                  {availableSheets.length > 0 ? (
                    availableSheets.map((sheetName) => (
                      <div
                        key={`sheet-${sheetName}`}
                        className={`${styles.configCard} ${isDarkTheme ? styles.darkTheme : ""}`}
                        onClick={() => toggleSheetSelection(sheetName)}
                      >
                        <div className={styles.cardIcon}>
                          <FaFileAlt size={20} />
                        </div>
                        <div className={styles.cardContent}>
                          <h4 className={`${styles.cardTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>
                            {sheetName}
                          </h4>
                          <p className={`${styles.cardDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>
                            Sheet available for organization
                          </p>
                        </div>
                        <div className={`${styles.cardArrow} ${isDarkTheme ? styles.darkTheme : ""}`}>
                          {selectedSheets.includes(sheetName) ? (
                            <FaRegCheckCircle size={20} />
                          ) : (
                            <FaRegCircle size={20} />
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={`${styles.noItems} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      No sheets available to add.
                    </div>
                  )}
                </div>
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