import { useContext, useState, useEffect, useRef, useCallback } from "react";
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
  const [isClosing, setIsClosing] = useState(false);
  const modalRef = useRef(null);
  const headerRefs = useRef([]);
  const createHeaderRef = useRef(null);

  const addHeader = useCallback(() => {
    const rawKey = newHeaderKey;
    const rawName = newHeaderName;
  
    const trimmedKey = rawKey.trim().replace(/\s+/g, "");
    const trimmedName = rawName.trim();
    const loweredKey = trimmedKey.toLowerCase();
    const loweredName = trimmedName.toLowerCase();
  
    const keyExists = currentHeaders.some((h) => Object.keys(h)[0].toLowerCase() === loweredKey);
    const nameExists = currentHeaders.some((h) => Object.values(h)[0].toLowerCase() === loweredName);
  
    if (!trimmedKey || !trimmedName) {
      alert("Column key and name must be non-empty.");
      return;
    }
    if (/\s/.test(rawKey)) {
      alert("Key must be a single word with no spaces.");
      return;
    }
    if (keyExists || nameExists) {
      alert(`A column with the ${keyExists ? "key" : "name"} "${keyExists ? trimmedKey : trimmedName}" already exists.`);
      return;
    }
  
    const newHeader = {
      [trimmedKey]: trimmedName,
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
  }, [newHeaderKey, newHeaderName, newHeaderType, newHeaderOptions, currentHeaders, setHeaders]);

  const updateHeader = useCallback(
    (index) => {
      const rawKey = newHeaderKey;
      const rawName = newHeaderName;
  
      const trimmedKey = rawKey.trim().replace(/\s+/g, "");
      const trimmedName = rawName.trim();
      const loweredKey = trimmedKey.toLowerCase();
      const loweredName = trimmedName.toLowerCase();
  
      const keyConflict = currentHeaders.some(
        (h, i) => Object.keys(h)[0].toLowerCase() === loweredKey && i !== index
      );
      const nameConflict = currentHeaders.some(
        (h, i) => Object.values(h)[0].toLowerCase() === loweredName && i !== index
      );
  
      if (!trimmedKey || !trimmedName) {
        alert("Column key and name must be non-empty.");
        return;
      }
      if (/\s/.test(rawKey)) {
        alert("Key must be a single word with no spaces.");
        return;
      }
      if (keyConflict || nameConflict) {
        alert(`Column ${keyConflict ? "key" : "name"} must be unique.`);
        return;
      }
  
      const updatedHeader = {
        [trimmedKey]: trimmedName,
        type: newHeaderType,
        ...(newHeaderType === "dropdown" && { options: newHeaderOptions }),
      };
      setCurrentHeaders((prev) => {
        const updatedHeaders = [...prev];
        updatedHeaders[index] = updatedHeader;
        return updatedHeaders;
      });
      setHeaders((prev) => {
        const updatedHeaders = [...prev];
        updatedHeaders[index] = updatedHeader;
        return updatedHeaders;
      });
      setActiveIndex(null); // Collapse after update
    },
    [newHeaderKey, newHeaderName, newHeaderType, newHeaderOptions, currentHeaders, setHeaders]
  );

  const handleKeyPress = useCallback(
    (e) => {
      if (e.key === "Enter") activeIndex === -1 ? addHeader() : null; // Only add on Enter, not update
    },
    [activeIndex, addHeader]
  );

  const toggleEdit = useCallback((index) => {
    if (activeIndex !== index) {
      setActiveIndex(index);
      if (index >= 0) {
        const header = currentHeaders[index];
        setNewHeaderKey(Object.keys(header)[0]);
        setNewHeaderName(header[Object.keys(header)[0]]);
        setNewHeaderType(header.type);
        setNewHeaderOptions(header.options || []);
      } else if (index === -1) {
        setNewHeaderKey("");
        setNewHeaderName("");
        setNewHeaderType("text");
        setNewHeaderOptions([]);
        setNewOption("");
      }
    }
  }, [currentHeaders, activeIndex]);

  const deleteHeader = useCallback((index) => {
    setCurrentHeaders((prev) => prev.filter((_, i) => i !== index));
    setHeaders((prev) => prev.filter((_, i) => i !== index));
    setActiveIndex(null);
  }, [setHeaders]);

  const addOption = useCallback(() => {
    if (newOption.trim() && !newHeaderOptions.includes(newOption.trim())) {
      setNewHeaderOptions((prev) => [...prev, newOption.trim()]);
      setNewOption("");
    }
  }, [newOption, newHeaderOptions]);

  const removeOption = useCallback((option) => {
    setNewHeaderOptions((prev) => prev.filter((opt) => opt !== option));
  }, []);

  const handleClose = () => {
    if (window.innerWidth <= 767) {
      setIsClosing(true);
      setTimeout(() => {
        onClose();
      }, 300);
    } else {
      onClose();
    }
  };

  // Effect for closing the modal when clicking outside
  useEffect(() => {
    const handleClickOutsideModal = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        handleClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutsideModal);

    return () => {
      document.removeEventListener("mousedown", handleClickOutsideModal);
    };
  }, [onClose]);

  // New effect for collapsing edit actions when clicking outside them
  useEffect(() => {
    const handleClickOutsideEdit = (event) => {
      if (activeIndex === null) return; // No edit actions open

      const isClickInsideModal = modalRef.current && modalRef.current.contains(event.target);
      if (!isClickInsideModal) return; // Let modal close handler deal with it

      const activeRef = activeIndex === -1 ? createHeaderRef.current : headerRefs.current[activeIndex];
      const isClickInsideActiveItem = activeRef && activeRef.contains(event.target);

      if (!isClickInsideActiveItem) {
        setActiveIndex(null); // Collapse edit actions
      }
    };

    document.addEventListener("mousedown", handleClickOutsideEdit);

    return () => {
      document.removeEventListener("mousedown", handleClickOutsideEdit);
    };
  }, [activeIndex]);

  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalContent} ${isClosing ? styles.closing : ""}`} ref={modalRef}>
        <div
          style={{
            width: "40px",
            height: "5px",
            backgroundColor: "rgba(0, 0, 0, 0.2)",
            borderRadius: "2.5px",
            margin: "0 auto 10px",
            display: "none",
            "@media (maxWidth: 767px)": {
              display: "block",
            },
          }}
        />
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Manage Columns</h2>
          <button className={styles.doneButton} onClick={handleClose}>
            Done
          </button>
        </div>
        <div
          className={`${styles.createHeader} ${activeIndex === -1 ? styles.activeItem : ""}`}
          ref={createHeaderRef}
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
                ref={(el) => (headerRefs.current[index] = el)}
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
                  <div className={styles.primaryButtons}></div>
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
      </div>
    </div>
  );
};

export default HeadersModal;