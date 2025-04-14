import { useState, useContext, useCallback, useRef, useEffect } from "react";
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
  const hasInitialized = useRef(false);

  // Define callbacks first to ensure they're initialized
  const handleSheetSaveClick = useCallback(() => {
    if (!newSheetName.trim()) {
      alert("Please provide a sheet name.");
      return;
    }
    const sheetId = `sheet_${Date.now()}`; // Generate timestamp-based ID
    console.log("SheetFolderManager - Saving sheet:", { id: sheetId, newSheetName, selectedHeaders });
    handleSheetSave(newSheetName, selectedHeaders, sheetId); // Pass ID to handleSheetSave
    setNewSheetName("");
    setSelectedHeaders([]);
    setSearchQuery("");
    handleClose();
  }, [newSheetName, selectedHeaders, handleSheetSave, handleClose]);

  const handleFolderSaveClick = useCallback(() => {
    if (!newFolderName.trim()) {
      alert("Please provide a folder name.");
      return;
    }
    console.log("SheetFolderManager - Saving folder:", { newFolderName, selectedSheets });
    handleFolderSave(newFolderName, selectedSheets);
    setNewFolderName("");
    setSelectedSheets([]);
    handleClose();
  }, [newFolderName, selectedSheets, handleFolderSave, handleClose]);

  // Initialize modal steps and config
  useEffect(() => {
    if (!hasInitialized.current) {
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
            if (addType === "sheet") {
              handleSheetSaveClick();
            } else {
              handleFolderSaveClick();
            }
          },
        },
      });
      hasInitialized.current = true;
    }
  }, [setModalConfig, registerModalSteps, addType]); // Removed handleSheetSaveClick, handleFolderSaveClick from dependencies

  // Update leftButton handler when addType changes
  useEffect(() => {
    setModalConfig((prev) => ({
      ...prev,
      leftButton: {
        label: "Create",
        onClick: () => {
          if (addType === "sheet") {
            handleSheetSaveClick();
          } else {
            handleFolderSaveClick();
          }
        },
      },
    }));
  }, [addType, setModalConfig, handleSheetSaveClick, handleFolderSaveClick]);

  const handleToggleType = useCallback(() => {
    setAddType((prev) => (prev === "sheet" ? "folder" : "sheet"));
    setNewSheetName("");
    setNewFolderName("");
    setSelectedSheets([]);
    setSelectedHeaders([]);
    setSearchQuery("");
  }, []);

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

  // Filter unselected headers based on search query
  const filteredHeaders = availableHeaders.filter(
    (header) =>
      !selectedHeaders.includes(header.key) &&
      header.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const folderSheets = sheets.structure
    .filter((item) => item.folderName)
    .flatMap((folder) => folder.sheets);
  const availableSheets = sheets.allSheets
    .filter((sheet) => !folderSheets.includes(sheet.sheetName))
    .map((sheet) => sheet.sheetName);

  return (
    <div className={`${styles.managerWrapper} ${isDarkTheme ? styles.darkTheme : ""}`}>
      <div className={`${styles.scrollContainer} ${isDarkTheme ? styles.darkTheme : ""}`}>
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
                  style={{ marginBottom: "16px" }} /* Separate section */
                />
              </div>
              <div className={`${styles.headerList} ${isDarkTheme ? styles.darkTheme : ""}`}>
                {filteredHeaders.length > 0 ? (
                  filteredHeaders.map((header) => (
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
                  ))
                ) : (
                  <div className={`${styles.noItems} ${isDarkTheme ? styles.darkTheme : ""}`}>
                    No unselected headers found.
                  </div>
                )}
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