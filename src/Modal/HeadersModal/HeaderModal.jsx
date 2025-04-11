import { useContext, useState, useCallback, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import styles from "./HeadersModal.module.css";
import { MainContext } from "../../Contexts/MainContext";
import useClickOutside from "../Hooks/UseClickOutside";

const HeadersModal = ({ tempData, setTempData }) => {
  const { headers, setHeaders, isDarkTheme, registerModalSteps, setModalConfig, goToStep } = useContext(MainContext);
  const [currentHeaders, setCurrentHeaders] = useState(tempData.currentHeaders || headers);
  const [newHeaderKey, setNewHeaderKey] = useState("");
  const [newHeaderName, setNewHeaderName] = useState("");
  const [newHeaderType, setNewHeaderType] = useState("text");
  const [newHeaderOptions, setNewHeaderOptions] = useState([]);
  const [newOption, setNewOption] = useState("");
  const [activeIndex, setActiveIndex] = useState(null);
  const editActionsRef = useRef(null);
  const hasInitialized = useRef(false); // Add ref to track initialization

  // Register modal title only once on mount
  useEffect(() => {
    if (!hasInitialized.current) {
      registerModalSteps({
        steps: [
          {
            title: () => "Manage Headers",
            rightButtons: () => [],
          },
        ],
      });
      setModalConfig({
        showTitle: true,
        showDoneButton: true,
        showBackButton: false, // Explicitly set to false for clarity
        title: "Manage Headers",
        backButtonTitle: "",
      });
      goToStep(1);
      hasInitialized.current = true; // Mark as initialized
    }
  }, [registerModalSteps, setModalConfig, goToStep]); // Dependencies are stable context functions

  useEffect(() => {
    setTempData((prev) => ({ ...prev, currentHeaders }));
  }, [currentHeaders, setTempData]);

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
      if (/\s/.test(key)) {
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
        alert(`A column with the ${keyConflict ? "key" : "name"} "${keyConflict ? trimmedKey : trimmedName}" already exists.`);
        return false;
      }
      return true;
    },
    []
  );

  const addHeader = useCallback(() => {
    if (!validateHeader(newHeaderKey, newHeaderName, currentHeaders)) return;

    const trimmedKey = newHeaderKey.trim().replace(/\s+/g, "");
    const trimmedName = newHeaderName.trim();
    const newHeader = {
      key: trimmedKey,
      name: trimmedName,
      type: newHeaderType,
      ...(newHeaderType === "dropdown" && { options: newHeaderOptions }),
    };
    setCurrentHeaders((prev) => [...prev, newHeader]);
    setHeaders((prev) => [...prev, newHeader]);
    setNewHeaderKey("");
    setNewHeaderName("");
    setNewHeaderType("text");
    setNewHeaderOptions([]);
    setNewOption("");
    setActiveIndex(null);
  }, [newHeaderKey, newHeaderName, newHeaderType, newHeaderOptions, currentHeaders, validateHeader, setHeaders]);

  const updateHeader = useCallback(
    (index) => {
      if (!validateHeader(newHeaderKey, newHeaderName, currentHeaders, true, index)) return;

      const trimmedKey = newHeaderKey.trim().replace(/\s+/g, "");
      const trimmedName = newHeaderName.trim();
      const updatedHeader = {
        key: trimmedKey,
        name: trimmedName,
        type: newHeaderType,
        ...(newHeaderType === "dropdown" && { options: newHeaderOptions }),
      };
      setCurrentHeaders((prev) => prev.map((h, i) => (i === index ? updatedHeader : h)));
      setHeaders((prev) => prev.map((h, i) => (i === index ? updatedHeader : h)));
      setActiveIndex(null);
    },
    [newHeaderKey, newHeaderName, newHeaderType, newHeaderOptions, currentHeaders, validateHeader, setHeaders]
  );

  const resetForm = useCallback(() => {
    setNewHeaderKey("");
    setNewHeaderName("");
    setNewHeaderType("text");
    setNewHeaderOptions([]);
    setNewOption("");
  }, []);

  const handleKeyPress = useCallback(
    (e) => {
      if (e.key === "Enter" && activeIndex === -1) addHeader();
    },
    [activeIndex, addHeader]
  );

  const toggleEdit = useCallback(
    (index) => {
      setActiveIndex((prev) => (prev === index ? null : index));
      if (index !== -1 && index !== null) {
        const header = currentHeaders[index];
        setNewHeaderKey(header.key);
        setNewHeaderName(header.name);
        setNewHeaderType(header.type || "text");
        setNewHeaderOptions(header.options || []);
      } else if (index === -1) {
        resetForm();
      }
    },
    [currentHeaders, resetForm]
  );

  const deleteHeader = useCallback(
    (index) => {
      setCurrentHeaders((prev) => prev.filter((_, i) => i !== index));
      setHeaders((prev) => prev.filter((_, i) => i !== index));
      setActiveIndex(null);
    },
    [setHeaders]
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

  useClickOutside(editActionsRef, activeIndex !== null, () => setActiveIndex(null));

  return (
    <div className={`${styles.headersModal} ${isDarkTheme ? styles.darkTheme : ""}`}>
      <div
        className={`${styles.createHeader} ${activeIndex === -1 ? styles.activeItem : ""} ${isDarkTheme ? styles.darkTheme : ""}`}
        onClick={() => toggleEdit(-1)}
      >
        <div className={styles.headerRow}>
          <div className={`${styles.headerNameType} ${isDarkTheme ? styles.darkTheme : ""}`}>
            <span>Create New Header</span>
          </div>
        </div>
        {activeIndex === -1 && (
          <div
            className={`${styles.editActions} ${isDarkTheme ? styles.darkTheme : ""}`}
            ref={editActionsRef}
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
            <div className={styles.editActionsButtons}>
              <button onClick={addHeader} className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}>
                Add
              </button>
            </div>
          </div>
        )}
      </div>
      <div className={`${styles.headerList} ${isDarkTheme ? styles.darkTheme : ""}`}>
        {currentHeaders.map((header, index) => (
          <div
            key={`${header.key}-${index}`}
            className={`${styles.headerItem} ${activeIndex === index ? styles.activeItem : ""} ${isDarkTheme ? styles.darkTheme : ""}`}
            onClick={() => toggleEdit(index)}
          >
            <div className={styles.headerRow}>
              <div className={`${styles.headerNameType} ${isDarkTheme ? styles.darkTheme : ""}`}>
                <span>{header.name}</span>
                <span className={`${styles.headerType} ${isDarkTheme ? styles.darkTheme : ""}`}>({header.type})</span>
              </div>
            </div>
            {activeIndex === index && (
              <div
                className={`${styles.editActions} ${isDarkTheme ? styles.darkTheme : ""}`}
                ref={editActionsRef}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={styles.editActionsButtons}>
                  <button
                    onClick={() => deleteHeader(index)}
                    className={`${styles.deleteButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                  >
                    Remove
                  </button>
                  <button
                    onClick={() => updateHeader(index)}
                    className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                  >
                    Update
                  </button>
                </div>
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