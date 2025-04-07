import { useContext, useState, useCallback } from "react";
import Modal from "../Modal/Modal"; // Adjust the path based on your structure
import styles from "./HeadersModal.module.css";
import { MainContext } from "../Contexts/MainContext";

const HeadersModal = ({ onClose }) => {
  const { headers, setHeaders } = useContext(MainContext);
  const [currentHeaders, setCurrentHeaders] = useState(() => {
    const uniqueHeaders = [];
    const seenKeys = new Set();
    headers.forEach((h) => {
      const key = Object.keys(h)[0];
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueHeaders.push({ ...h });
      }
    });
    return uniqueHeaders;
  });
  const [newHeaderKey, setNewHeaderKey] = useState("");
  const [newHeaderName, setNewHeaderName] = useState("");
  const [newHeaderType, setNewHeaderType] = useState("text");
  const [newHeaderOptions, setNewHeaderOptions] = useState([]);
  const [newOption, setNewOption] = useState("");
  const [activeIndex, setActiveIndex] = useState(null);

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
        (h, i) => Object.keys(h)[0].toLowerCase() === loweredKey && (!isUpdate || i !== index)
      );
      const nameConflict = existingHeaders.some(
        (h, i) => Object.values(h)[0].toLowerCase() === loweredName && (!isUpdate || i !== index)
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
      [trimmedKey]: trimmedName,
      type: newHeaderType,
      ...(newHeaderType === "dropdown" && { options: newHeaderOptions }),
    };
    setCurrentHeaders((prev) => [...prev, newHeader]);
    setHeaders((prev) => [...prev, newHeader]);
    resetForm();
  }, [newHeaderKey, newHeaderName, newHeaderType, newHeaderOptions, currentHeaders, setHeaders, validateHeader]);

  const updateHeader = useCallback(
    (index) => {
      if (!validateHeader(newHeaderKey, newHeaderName, currentHeaders, true, index)) return;

      const trimmedKey = newHeaderKey.trim().replace(/\s+/g, "");
      const trimmedName = newHeaderName.trim();
      const updatedHeader = {
        [trimmedKey]: trimmedName,
        type: newHeaderType,
        ...(newHeaderType === "dropdown" && { options: newHeaderOptions }),
      };
      setCurrentHeaders((prev) => prev.map((h, i) => (i === index ? updatedHeader : h)));
      setHeaders((prev) => prev.map((h, i) => (i === index ? updatedHeader : h)));
      setActiveIndex(null);
    },
    [newHeaderKey, newHeaderName, newHeaderType, newHeaderOptions, currentHeaders, setHeaders, validateHeader]
  );

  const resetForm = useCallback(() => {
    setNewHeaderKey("");
    setNewHeaderName("");
    setNewHeaderType("text");
    setNewHeaderOptions([]);
    setNewOption("");
    setActiveIndex(null);
  }, []);

  const handleKeyPress = useCallback(
    (e) => {
      if (e.key === "Enter" && activeIndex === -1) addHeader();
    },
    [activeIndex, addHeader]
  );

  const toggleEdit = useCallback(
    (index) => {
      if (activeIndex !== index) {
        setActiveIndex(index);
        if (index >= 0) {
          const header = currentHeaders[index];
          setNewHeaderKey(Object.keys(header)[0]);
          setNewHeaderName(header[Object.keys(header)[0]]);
          setNewHeaderType(header.type);
          setNewHeaderOptions(header.options || []);
        } else if (index === -1) {
          resetForm();
          setActiveIndex(-1);
        }
      } else {
        setActiveIndex(null);
      }
    },
    [activeIndex, currentHeaders, resetForm]
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

  return (
    <Modal title="Manage Columns" onClose={onClose}>
      <div
        className={`${styles.createHeader} ${activeIndex === -1 ? styles.activeItem : ""}`}
        onClick={(e) => {
          if (!e.target.closest("button")) {
            toggleEdit(-1);
          }
        }}
      >
        <div className={styles.headerRow}>
          <div className={styles.headerNameType}>
            <span>Create New Header</span>
          </div>
        </div>
        {activeIndex === -1 && (
          <div className={styles.editActions}>
            <input
              type="text"
              value={newHeaderKey}
              onChange={(e) => setNewHeaderKey(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Key"
              className={styles.inputField}
            />
            <input
              type="text"
              value={newHeaderName}
              onChange={(e) => setNewHeaderName(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Name"
              className={styles.inputField}
            />
            <select
              value={newHeaderType}
              onChange={(e) => setNewHeaderType(e.target.value)}
              className={styles.selectField}
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
                    className={styles.inputField}
                  />
                  <button onClick={addOption} className={styles.addOptionButton}>
                    +
                  </button>
                </div>
                <div className={styles.optionsList}>
                  {newHeaderOptions.map((option) => (
                    <div key={option} className={styles.optionItem}>
                      <span>{option}</span>
                      <button onClick={() => removeOption(option)} className={styles.removeOptionButton}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={addHeader} className={styles.actionButton}>
              Add
            </button>
          </div>
        )}
      </div>
      <div className={styles.headerList}>
        {currentHeaders.map((header, index) => {
          const key = Object.keys(header)[0];
          const isActive = activeIndex === index;
          return (
            <div
              key={key}
              className={`${styles.headerItem} ${isActive ? styles.activeItem : ""}`}
              onClick={(e) => {
                if (!e.target.closest("button")) {
                  toggleEdit(index);
                }
              }}
            >
              <div className={styles.headerRow}>
                <div className={styles.headerNameType}>
                  <span>{header[key]}</span>
                  <span className={styles.headerType}>({header.type})</span>
                </div>
              </div>
              {isActive && (
                <div className={styles.editActions}>
                  <div className={styles.editActionsButtons}>
                    <button onClick={() => deleteHeader(index)} className={styles.deleteButton}>
                      Remove
                    </button>
                    <button onClick={() => updateHeader(index)} className={styles.actionButton}>
                      Update
                    </button>
                  </div>
                  <input
                    type="text"
                    value={newHeaderKey}
                    onChange={(e) => setNewHeaderKey(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Key"
                    className={styles.inputField}
                  />
                  <input
                    type="text"
                    value={newHeaderName}
                    onChange={(e) => setNewHeaderName(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Name"
                    className={styles.inputField}
                  />
                  <select
                    value={newHeaderType}
                    onChange={(e) => setNewHeaderType(e.target.value)}
                    className={styles.selectField}
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
                          className={styles.inputField}
                        />
                        <button onClick={addOption} className={styles.addOptionButton}>
                          +
                        </button>
                      </div>
                      <div className={styles.optionsList}>
                        {newHeaderOptions.map((option) => (
                          <div key={option} className={styles.optionItem}>
                            <span>{option}</span>
                            <button onClick={() => removeOption(option)} className={styles.removeOptionButton}>
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
          );
        })}
      </div>
    </Modal>
  );
};

export default HeadersModal;