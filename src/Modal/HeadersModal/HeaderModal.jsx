import { useContext, useState, useCallback, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import styles from "./HeadersModal.module.css";
import { MainContext } from "../../Contexts/MainContext";
import { ModalNavigatorContext } from "../../Contexts/ModalNavigator";

const HeadersModal = ({ tempData, setTempData }) => {
  const { headers = [], isDarkTheme } = useContext(MainContext);
  const { registerModalSteps, setModalConfig, goToStep, currentStep, goBack } = useContext(ModalNavigatorContext);
  const [currentHeaders, setCurrentHeaders] = useState(() =>
    (tempData.currentHeaders || headers).map((h) => ({ ...h }))
  );
  const [newHeaderKey, setNewHeaderKey] = useState("");
  const [newHeaderName, setNewHeaderName] = useState("");
  const [newHeaderType, setNewHeaderType] = useState("text");
  const [newHeaderOptions, setNewHeaderOptions] = useState([]);
  const [newOption, setNewOption] = useState("");
  const [activeIndex, setActiveIndex] = useState(null);
  const [navigationDirection, setNavigationDirection] = useState(null); // Track navigation direction
  const hasInitialized = useRef(false);
  const prevHeadersRef = useRef(currentHeaders);
  const prevStepRef = useRef(currentStep); // Track previous step

  // Validation and utility functions
  const validateHeader = useCallback(
    (key, name, existingHeaders, isUpdate = false, index = null) => {
      const trimmedKey = key.trim().replace(/\s+/g, "");
      const trimmedName = name.trim();
      const loweredKey = trimmedKey.toLowerCase();
      const loweredName = trimmedName.toLowerCase();

      if (!trimmedKey || !trimmedName) {
        alert("Column key and name must be non-empty.");
        return false;
      }
      if (/\s/.test(trimmedKey)) {
        alert("Key must be a single word with no spaces.");
        return false;
      }

      const keyConflict = existingHeaders.some(
        (h, i) => h.key.toLowerCase() === loweredKey && (!isUpdate || i !== index)
      );
      const nameConflict = existingHeaders.some(
        (h, i) => h.name.toLowerCase() === loweredName && (!isUpdate || i !== index)
      );

      if (keyConflict || nameConflict) {
        alert(
          `A column with the ${keyConflict ? "key" : "name"} "${keyConflict ? trimmedKey : trimmedName}" already exists.`
        );
        return false;
      }
      return true;
    },
    []
  );

  const resetForm = useCallback(() => {
    setNewHeaderKey("");
    setNewHeaderName("");
    setNewHeaderType("text");
    setNewHeaderOptions([]);
    setNewOption("");
  }, []);

  const addHeader = useCallback(() => {
    if (!validateHeader(newHeaderKey, newHeaderName, currentHeaders)) return;

    const trimmedKey = newHeaderKey.trim().replace(/\s+/g, "");
    const trimmedName = newHeaderName.trim();
    const newHeader = {
      key: trimmedKey,
      name: trimmedName,
      type: newHeaderType,
      ...(newHeaderType === "dropdown" && { options: [...newHeaderOptions] }),
    };
    setCurrentHeaders((prev) => [...prev, newHeader]);
    resetForm();
  }, [newHeaderKey, newHeaderName, newHeaderType, newHeaderOptions, currentHeaders, validateHeader, resetForm]);

  const updateHeader = useCallback(
    (index) => {
      if (!validateHeader(newHeaderKey, newHeaderName, currentHeaders, true, index)) return;

      const trimmedKey = newHeaderKey.trim().replace(/\s+/g, "");
      const trimmedName = newHeaderName.trim();
      const updatedHeader = {
        key: trimmedKey,
        name: trimmedName,
        type: newHeaderType,
        ...(newHeaderType === "dropdown" && { options: [...newHeaderOptions] }),
      };
      setCurrentHeaders((prev) => prev.map((h, i) => (i === index ? updatedHeader : h)));
      resetForm();
    },
    [newHeaderKey, newHeaderName, newHeaderType, newHeaderOptions, currentHeaders, validateHeader, resetForm]
  );

  const deleteHeader = useCallback(
    (index) => {
      setCurrentHeaders((prev) => prev.filter((_, i) => i !== index));
      setActiveIndex(null);
      setNavigationDirection("backward");
      goToStep(1);
    },
    [goToStep]
  );

  const saveHeader = useCallback(() => {
    if (activeIndex === -1) {
      addHeader();
    } else if (activeIndex !== null) {
      updateHeader(activeIndex);
    }
    setActiveIndex(null);
    setNavigationDirection("backward");
    goToStep(1);
  }, [activeIndex, addHeader, updateHeader, goToStep]);

  // Initialize modal steps
  useEffect(() => {
    if (!hasInitialized.current) {
      registerModalSteps({
        steps: [
          {
            title: "Manage Headers",
            rightButton: null,
          },
          {
            title: () =>
              activeIndex === -1 ? "Create New Header" : currentHeaders[activeIndex]?.name || "Edit Header",
            rightButton: {
              label: "Save",
              onClick: saveHeader,
              isActive: true,
              isRemove: false,
            },
          },
        ],
      });
      setModalConfig({
        showTitle: true,
        showDoneButton: true,
        showBackButton: false,
        title: "Manage Headers",
        backButtonTitle: "",
        rightButton: null,
      });
      hasInitialized.current = true;
    }
  }, [registerModalSteps, setModalConfig, activeIndex, currentHeaders, saveHeader]);

  // Update modal config based on step and set navigation direction
  useEffect(() => {
    if (currentStep === 1) {
      setModalConfig({
        showTitle: true,
        showDoneButton: true,
        showBackButton: false,
        title: "Manage Headers",
        backButtonTitle: "",
        rightButton: null,
      });
    } else if (currentStep === 2) {
      setModalConfig({
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        title: activeIndex === -1 ? "Create New Header" : currentHeaders[activeIndex]?.name || "Edit Header",
        backButtonTitle: "Manage Headers",
        rightButton: {
          label: "Save",
          onClick: saveHeader,
          isActive: true,
          isRemove: false,
        },
      });
    }

    // Set navigation direction based on step change
    if (prevStepRef.current !== currentStep) {
      setNavigationDirection(currentStep > prevStepRef.current ? "forward" : "backward");
      prevStepRef.current = currentStep;
    }
  }, [currentStep, activeIndex, currentHeaders, setModalConfig, saveHeader]);

  // Sync currentHeaders to tempData
  useEffect(() => {
    const headersChanged = JSON.stringify(currentHeaders) !== JSON.stringify(prevHeadersRef.current);
    if (headersChanged) {
      setTempData({ currentHeaders });
      prevHeadersRef.current = currentHeaders;
    }
  }, [currentHeaders, setTempData]);

  const handleKeyPress = useCallback(
    (e) => {
      if (e.key === "Enter") {
        saveHeader();
      }
    },
    [saveHeader]
  );

  const toggleEdit = useCallback(
    (index) => {
      setActiveIndex(index);
      if (index !== -1 && index !== null) {
        const header = currentHeaders[index];
        setNewHeaderKey(header.key);
        setNewHeaderName(header.name);
        setNewHeaderType(header.type || "text");
        setNewHeaderOptions(header.options || []);
      } else if (index === -1) {
        resetForm();
      }
      setNavigationDirection("forward");
      goToStep(2);
    },
    [currentHeaders, resetForm, goToStep]
  );

  const addOption = useCallback(() => {
    if (newOption.trim() && !newHeaderOptions.includes(newOption.trim())) {
      setNewHeaderOptions((prev) => [...prev, newOption.trim()]);
      setNewOption("");
    }
  }, [newOption, newHeaderOptions]);

  const removeOption = useCallback((option) => {
    setNewHeaderOptions((prev) => prev.filter((opt) => opt !== option));
  }, []);

  return (
    <div className={`${styles.headersModal} ${isDarkTheme ? styles.darkTheme : ""}`}>
      <div className={styles.viewContainer}>
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
            style={{
              display: step !== currentStep ? "none" : "block",
            }}
          >
            {step === 1 && (
              <>
                <div
                  className={`${styles.createHeader} ${isDarkTheme ? styles.darkTheme : ""}`}
                  onClick={() => toggleEdit(-1)}
                >
                  <div className={styles.headerRow}>
                    <div className={`${styles.headerNameType} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      <span>Create New Header</span>
                    </div>
                  </div>
                </div>
                <div className={`${styles.headerList} ${isDarkTheme ? styles.darkTheme : ""}`}>
                  {currentHeaders.map((header, index) => (
                    <div
                      key={`${header.key}-${index}`}
                      className={`${styles.headerItem} ${isDarkTheme ? styles.darkTheme : ""}`}
                      onClick={() => toggleEdit(index)}
                    >
                      <div className={styles.headerRow}>
                        <div className={`${styles.headerNameType} ${isDarkTheme ? styles.darkTheme : ""}`}>
                          <span>{header.name}</span>
                          <span className={`${styles.headerType} ${isDarkTheme ? styles.darkTheme : ""}`}>
                            ({header.type})
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {step === 2 && (
              <div
                className={`${styles.editActions} ${isDarkTheme ? styles.darkTheme : ""}`}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  value={newHeaderKey}
                  onChange={(e) => setNewHeaderKey(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Key"
                  className={`${styles.inputField} ${isDarkTheme ? styles.darkTheme : ""}`}
                />
                <input
                  type="text"
                  value={newHeaderName}
                  onChange={(e) => setNewHeaderName(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Name"
                  className={`${styles.inputField} ${isDarkTheme ? styles.darkTheme : ""}`}
                />
                <select
                  value={newHeaderType}
                  onChange={(e) => setNewHeaderType(e.target.value)}
                  className={`${styles.selectField} ${isDarkTheme ? styles.darkTheme : ""}`}
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="dropdown">Pop-up Menu</option>
                </select>
                {newHeaderType === "dropdown" && (
                  <div className={styles.optionsSection}>
                    <div className={styles.optionInputRow}>
                      <input
                        type="text"
                        value={newOption}
                        onChange={(e) => setNewOption(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && addOption()}
                        placeholder="Add item"
                        className={`${styles.inputField} ${isDarkTheme ? styles.darkTheme : ""}`}
                      />
                      <button
                        onClick={addOption}
                        className={`${styles.addOptionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                      >
                        +
                      </button>
                    </div>
                    <div className={styles.optionsList}>
                      {newHeaderOptions.map((option) => (
                        <div key={option} className={`${styles.optionItem} ${isDarkTheme ? styles.darkTheme : ""}`}>
                          <span>{option}</span>
                          <button
                            onClick={() => removeOption(option)}
                            className={`${styles.removeOptionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {activeIndex !== -1 && activeIndex !== null && (
                  <div className={styles.editActionsButtons}>
                    <button
                      onClick={() => deleteHeader(activeIndex)}
                      className={`${styles.deleteButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

HeadersModal.propTypes = {
  tempData: PropTypes.shape({
    currentHeaders: PropTypes.arrayOf(
      PropTypes.shape({
        key: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        type: PropTypes.string.isRequired,
        options: PropTypes.arrayOf(PropTypes.string),
      })
    ),
  }).isRequired,
  setTempData: PropTypes.func.isRequired,
};

export default HeadersModal;