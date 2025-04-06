import { useContext, useState, useEffect, useRef, useCallback } from "react";
import styles from "./HeadersModal.module.css";
import { MainContext } from "../Contexts/MainContext";

const HeadersModal = ({ onClose }) => {
  const { headers, setHeaders } = useContext(MainContext);
  const [currentHeaders, setCurrentHeaders] = useState(headers.map((h) => ({ ...h })));
  const [newHeaderKey, setNewHeaderKey] = useState("");
  const [newHeaderName, setNewHeaderName] = useState("");
  const [newHeaderType, setNewHeaderType] = useState("text");
  const [newHeaderOptions, setNewHeaderOptions] = useState([]);
  const [newOption, setNewOption] = useState("");
  const [editIndex, setEditIndex] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const modalRef = useRef(null);

  const addHeader = useCallback(() => {
    const trimmedKey = newHeaderKey.trim();
    const trimmedName = newHeaderName.trim().toUpperCase();
    if (!trimmedKey || !trimmedName || currentHeaders.some((h) => Object.keys(h)[0] === trimmedKey)) {
      alert("Column key and name must be unique and non-empty.");
      return;
    }
    setCurrentHeaders((prev) => [
      ...prev,
      {
        [trimmedKey]: trimmedName,
        type: newHeaderType,
        ...(newHeaderType === "dropdown" && { options: newHeaderOptions }),
      },
    ]);
    clearForm();
  }, [newHeaderKey, newHeaderName, newHeaderType, newHeaderOptions, currentHeaders]);

  const updateHeader = useCallback(
    (index) => {
      const trimmedKey = newHeaderKey.trim();
      const trimmedName = newHeaderName.trim().toUpperCase();
      if (!trimmedKey || !trimmedName || currentHeaders.some((h, i) => Object.keys(h)[0] === trimmedKey && i !== index)) {
        alert("Column key and name must be unique and non-empty.");
        return;
      }
      setCurrentHeaders((prev) => {
        const updatedHeaders = [...prev];
        updatedHeaders[index] = {
          [trimmedKey]: trimmedName,
          type: newHeaderType,
          ...(newHeaderType === "dropdown" && { options: newHeaderOptions }),
        };
        return updatedHeaders;
      });
      clearForm();
    },
    [newHeaderKey, newHeaderName, newHeaderType, newHeaderOptions, currentHeaders]
  );

  const handleKeyPress = useCallback(
    (e) => {
      if (e.key === "Enter") editIndex !== null ? updateHeader(editIndex) : isAdding ? addHeader() : null;
    },
    [editIndex, isAdding, updateHeader, addHeader]
  );

  const editHeader = useCallback((index) => {
    setEditIndex(index);
    setIsAdding(false);
    const header = currentHeaders[index];
    setNewHeaderKey(Object.keys(header)[0]);
    setNewHeaderName(header[Object.keys(header)[0]]);
    setNewHeaderType(header.type);
    setNewHeaderOptions(header.options || []);
  }, [currentHeaders]);

  const deleteHeader = useCallback((index) => {
    setCurrentHeaders((prev) => prev.filter((_, i) => i !== index));
    clearForm();
  }, []);

  const clearForm = useCallback(() => {
    setNewHeaderKey("");
    setNewHeaderName("");
    setNewHeaderType("text");
    setNewHeaderOptions([]);
    setNewOption("");
    setEditIndex(null);
    setIsAdding(false);
  }, []);

  const addOption = useCallback(() => {
    if (newOption.trim() && !newHeaderOptions.includes(newOption.trim())) {
      setNewHeaderOptions((prev) => [...prev, newOption.trim()]);
      setNewOption("");
    }
  }, [newOption, newHeaderOptions]);

  const removeOption = useCallback((option) => {
    setNewHeaderOptions((prev) => prev.filter((opt) => opt !== option));
  }, []);

  const handleSave = useCallback(() => {
    setHeaders(currentHeaders);
    onClose();
  }, [currentHeaders, setHeaders, onClose]);

  const toggleAddForm = useCallback(() => {
    setIsAdding((prev) => !prev);
    setEditIndex(null);
    setNewHeaderKey("");
    setNewHeaderName("");
    setNewHeaderType("text");
    setNewHeaderOptions([]);
    setNewOption("");
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} ref={modalRef}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Manage Columns</h2>
          <button className={styles.closeButton} onClick={onClose}>Close</button>
        </div>
        <div className={styles.headerList}>
          {currentHeaders.map((header, index) => {
            const key = Object.keys(header)[0];
            const isEditing = editIndex === index;
            return (
              <div key={key} className={`${styles.headerItem} ${isEditing ? styles.activeItem : ""}`}>
                <div className={styles.headerRow}>
                  {!isEditing ? (
                    <>
                      <span>{header[key]}</span>
                      <span className={styles.headerType}>({header.type})</span>
                      <button
                        onClick={() => editHeader(index)}
                        className={styles.editButton}
                        disabled={editIndex !== null || isAdding}
                      >
                        Modify
                      </button>
                    </>
                  ) : (
                    <div className={styles.editFields}>
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
                      <div className={styles.editActions}>
                        <button onClick={() => deleteHeader(index)} className={styles.deleteButton}>
                          Remove
                        </button>
                        <button onClick={() => updateHeader(index)} className={styles.actionButton}>
                          Update
                        </button>
                        <button onClick={clearForm} className={styles.cancelButton}>
                          Close
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div className={`${styles.headerItem} ${isAdding ? styles.activeItem : ""}`}>
            <div className={styles.headerRow}>
              {!isAdding ? (
                <button onClick={toggleAddForm} className={styles.addButton} disabled={editIndex !== null}>
                  New Column
                </button>
              ) : (
                <div className={styles.editFields}>
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
                  <div className={styles.editActions}>
                    <button onClick={addHeader} className={styles.actionButton}>
                      Add
                    </button>
                    <button onClick={clearForm} className={styles.cancelButton}>
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <button onClick={handleSave} className={styles.saveButton}>
          Save
        </button>
      </div>
    </div>
  );
};

export default HeadersModal;