import { useState, useEffect, useRef } from "react";
import styles from "./SheetModal.module.css";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { MdFilterAlt, MdFilterAltOff } from "react-icons/md";

const SheetModal = ({ 
  isEditMode = false, 
  sheetName: initialSheetName = "", 
  headers: initialHeaders = [], 
  pinnedHeaders: initialPinnedHeaders = [], 
  onSave, 
  onPinToggle, 
  onClose 
}) => {
  const [sheetName, setSheetName] = useState(initialSheetName);
  const [currentHeaders, setCurrentHeaders] = useState(initialHeaders);
  const [pinnedHeaders, setPinnedHeaders] = useState(initialPinnedHeaders);
  const [newHeaderName, setNewHeaderName] = useState("");
  const [menuOpen, setMenuOpen] = useState(null);
  const [typeModalOpen, setTypeModalOpen] = useState(null);
  const menuRef = useRef(null);
  const typeModalRef = useRef(null);

  const moveUp = (index) => {
    if (index === 0) return;
    const newHeaders = [...currentHeaders];
    [newHeaders[index - 1], newHeaders[index]] = [newHeaders[index], newHeaders[index - 1]];
    setCurrentHeaders(newHeaders);
  };

  const moveDown = (index) => {
    if (index === currentHeaders.length - 1) return;
    const newHeaders = [...currentHeaders];
    [newHeaders[index], newHeaders[index + 1]] = [newHeaders[index + 1], newHeaders[index]];
    setCurrentHeaders(newHeaders);
  };

  const addHeader = () => {
    if (newHeaderName.trim() && !currentHeaders.some((h) => h.name === newHeaderName.trim().toUpperCase())) {
      const headerUpper = newHeaderName.trim().toUpperCase();
      setCurrentHeaders([...currentHeaders, { name: headerUpper, type: "text", hidden: false, visible: true }]);
      setNewHeaderName("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      addHeader();
    }
  };

  const deleteHeader = (index) => {
    if (!pinnedHeaders.includes(currentHeaders[index].name)) {
      setCurrentHeaders(currentHeaders.filter((_, i) => i !== index));
    }
  };

  const handleTypeChange = (index, newType) => {
    const newHeaders = [...currentHeaders];
    newHeaders[index] = { ...newHeaders[index], type: newType };
    setCurrentHeaders(newHeaders);
    setTypeModalOpen(null);
  };

  const toggleVisible = (index) => {
    const newHeaders = [...currentHeaders];
    newHeaders[index] = { ...newHeaders[index], visible: !newHeaders[index].visible };
    setCurrentHeaders(newHeaders);
  };

  const toggleHidden = (index) => {
    const newHeaders = [...currentHeaders];
    newHeaders[index] = { ...newHeaders[index], hidden: !newHeaders[index].hidden };
    setCurrentHeaders(newHeaders);
  };

  const togglePin = (headerName) => {
    const newPinned = pinnedHeaders.includes(headerName)
      ? pinnedHeaders.filter((h) => h !== headerName)
      : [...pinnedHeaders, headerName];
    setPinnedHeaders(newPinned);
    if (isEditMode && onPinToggle) {
      onPinToggle(headerName);
    }
  };

  const handleSave = () => {
    if (isEditMode) {
      onSave({ headers: currentHeaders, sheetName: sheetName.trim() });
    } else {
      if (sheetName.trim() && currentHeaders.length > 0) {
        onSave(sheetName.trim(), currentHeaders, pinnedHeaders);
      } else {
        alert("Please provide a sheet name and at least one header.");
        return;
      }
    }
    onClose();
  };

  const toggleMenu = (index) => {
    setMenuOpen(menuOpen === index ? null : index);
    setTypeModalOpen(null);
  };

  const toggleTypeModal = (index) => {
    setTypeModalOpen(typeModalOpen === index ? null : index);
    setMenuOpen(null);
  };

  const handleMenuAction = (action, index, e) => {
    e.stopPropagation();
    action(index);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(null);
      }
      if (typeModalRef.current && !typeModalRef.current.contains(event.target)) {
        setTypeModalOpen(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2 className={styles.editTitle}>
          {isEditMode ? "Edit Headers" : "Add New Sheet"}
        </h2>
        {(isEditMode || !isEditMode) && (
          <div className={styles.addHeaderSection}>
            <label className={styles.headerLabel}>Sheet Name:</label>
            <input
              type="text"
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              placeholder={isEditMode ? "Rename sheet" : "e.g., Contacts"}
              className={styles.sheetNameInput}
            />
          </div>
        )}
        <div className={styles.headerList}>
          {currentHeaders.map((header, index) => (
            <div key={header.name} className={styles.headerItem}>
              <div className={styles.headerRow}>
                <div className={styles.headerNameType}>
                  <span>{header.name}</span>
                </div>
                <div className={styles.primaryButtons}>
                  <button onClick={() => toggleMenu(index)} className={styles.moreButton}>
                    {header.type.charAt(0).toUpperCase() + header.type.slice(1)}{" "}
                    {header.visible ? <FaEye /> : <FaEyeSlash />}
                    {header.hidden ? <MdFilterAlt /> : <MdFilterAltOff />}
                    {" ⋯"}
                  </button>
                  {menuOpen === index && (
                    <div className={styles.menu} ref={menuRef}>
                      <button onClick={(e) => handleMenuAction(() => toggleTypeModal(index), index, e)}>
                        Change Type
                      </button>
                      <button onClick={(e) => handleMenuAction(toggleVisible, index, e)}>
                        {header.visible ? "Hide in Table" : "Show in Table"}{" "}
                        {header.visible ? <FaEye /> : <FaEyeSlash />}
                      </button>
                      <button onClick={(e) => handleMenuAction(toggleHidden, index, e)}>
                        {header.hidden ? "Unhide in Filters" : "Hide in Filters"}{" "}
                        {header.hidden ? <MdFilterAlt /> : <MdFilterAltOff />}
                      </button>
                      <button onClick={(e) => handleMenuAction(() => togglePin(header.name), index, e)}>
                        {pinnedHeaders.includes(header.name) ? "Unpin" : "Pin"}
                      </button>
                      <button
                        onClick={(e) => handleMenuAction(moveUp, index, e)}
                        disabled={index === 0}
                      >
                        Move Up
                      </button>
                      <button
                        onClick={(e) => handleMenuAction(moveDown, index, e)}
                        disabled={index === currentHeaders.length - 1}
                      >
                        Move Down
                      </button>
                      <button
                        onClick={(e) => handleMenuAction(deleteHeader, index, e)}
                        disabled={pinnedHeaders.includes(header.name)}
                        className={pinnedHeaders.includes(header.name) ? styles.disabledMenuButton : styles.deleteButton}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                  {typeModalOpen === index && (
                    <div className={styles.typeModal} ref={typeModalRef}>
                      <h3>Change Type for {header.name}</h3>
                      <select
                        value={header.type}
                        onChange={(e) => handleTypeChange(index, e.target.value)}
                        className={styles.typeSelect}
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="dropdown">Dropdown</option>
                      </select>
                      <button onClick={() => setTypeModalOpen(null)}>Close</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.addHeaderSection}>
          <input
            type="text"
            value={newHeaderName}
            onChange={(e) => setNewHeaderName(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="New Header Name (Press Enter to Add)"
          />
        </div>
        <div className={styles.modalActions}>
          <button onClick={handleSave}>Save</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default SheetModal;