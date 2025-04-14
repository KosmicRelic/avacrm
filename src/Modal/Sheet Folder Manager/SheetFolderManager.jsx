import { useState, useContext, useCallback, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import styles from "./SheetFolderManager.module.css";
import { MainContext } from "../../Contexts/MainContext";
import { ModalNavigatorContext } from "../../Contexts/ModalNavigator";

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
  const { setModalConfig, registerModalSteps } = useContext(ModalNavigatorContext);
  const [addType, setAddType] = useState("sheet");
  const [newSheetName, setNewSheetName] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedSheets, setSelectedSheets] = useState([]);
  const [selectedHeaders, setSelectedHeaders] = useState([]);
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

    // Check for duplicate sheet name (case-insensitive)
    const sheetExists = sheets.allSheets.some(
      (sheet) => sheet.sheetName.toLowerCase() === trimmedName.toLowerCase()
    );
    if (sheetExists) {
      alert(`A sheet named "${trimmedName}" already exists. Please choose a different name.`);
      return;
    }

    setError("");
    const sheetId = `sheet_${Date.now()}`;
    console.log("Saving sheet:", { id: sheetId, newSheetName: trimmedName, selectedHeaders });
    handleSheetSave(trimmedName, selectedHeaders, sheetId);
    setNewSheetName("");
    setSelectedHeaders([]);
    setSearchQuery("");
    handleClose();
  }, [newSheetName, selectedHeaders, sheets.allSheets, handleSheetSave, handleClose]);

  const handleFolderSaveClick = useCallback(() => {
    const trimmedName = newFolderName.trim();
    if (!trimmedName) {
      setError("Please provide a folder name.");
      return;
    }

    // Check for duplicate folder name (case-insensitive)
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
    console.log("Saving folder:", { newFolderName: trimmedName, selectedSheets });
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
      console.log("Setting modal config, addType:", addType);
      registerModalSteps({
        steps: [
          {
            title: "Create Sheets & Folders",
            rightButton: null,
          },
        ],
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
            console.log("Modal Create button clicked, addType:", addType);
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
    setSelectedHeaders([]);
    setSearchQuery("");
    setError("");
    console.log("Toggled to:", addType === "sheet" ? "folder" : "sheet");
  }, [addType]);

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

  const filteredHeaders = availableHeaders.filter((header) =>
    header.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const folderSheets = sheets.structure
    .filter((item) => item.folderName)
    .flatMap((folder) => folder.sheets);
  const availableSheets = sheets.allSheets
    .filter((sheet) => !folderSheets.includes(sheet.sheetName) && sheet.sheetName !== "primarySheet")
    .map((sheet) => sheet.sheetName);

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
                    console.log("Sheet input changed:", e.target.value);
                    setNewSheetName(e.target.value);
                    setError("");
                  }}
                  placeholder="Enter Sheet Name"
                  className={`${styles.inputField} ${isDarkTheme ? styles.darkTheme : ""}`}
                  autoFocus
                />
              </div>
              <div>
                <h3 className={`${styles.headerSectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>
                  Add Headers
                </h3>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Headers"
                  className={`${styles.inputField} ${isDarkTheme ? styles.darkTheme : ""}`}
                  style={{ marginBottom: "16px" }}
                />
              </div>
              <div className={`${styles.headerList} ${isDarkTheme ? styles.darkTheme : ""}`}>
                {filteredHeaders.length > 0 ? (
                  filteredHeaders.map((header) => (
                    <div
                      key={header.key}
                      className={`${styles.headerItem} ${
                        selectedHeaders.includes(header.key) ? styles.selected : ""
                      } ${isDarkTheme ? styles.darkTheme : ""}`}
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
                  ))
                ) : (
                  <div className={`${styles.noItems} ${isDarkTheme ? styles.darkTheme : ""}`}>
                    No headers found.
                  </div>
                )}
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
                    console.log("Folder input changed:", e.target.value);
                    setNewFolderName(e.target.value);
                    setError("");
                  }}
                  placeholder="Enter Folder Name"
                  className={`${styles.inputField} ${isDarkTheme ? styles.darkTheme : ""}`}
                  autoFocus
                />
              </div>
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
            </>
          )}
        </div>
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