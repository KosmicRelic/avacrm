import { useState } from "react";
import styles from "./AddSheetModal.module.css";
import { BsFillPinAngleFill } from "react-icons/bs";

const AddSheetModal = ({ onSave, onClose }) => {
  const [sheetName, setSheetName] = useState("");
  const [headers, setHeaders] = useState([]);
  const [pinnedHeaders, setPinnedHeaders] = useState([]);
  const [newHeader, setNewHeader] = useState("");

  const addHeader = () => {
    if (newHeader.trim() && !headers.includes(newHeader.trim().toUpperCase())) {
      setHeaders([...headers, newHeader.trim().toUpperCase()]);
      setNewHeader("");
    }
  };

  const removeHeader = (index) => {
    if (!pinnedHeaders.includes(headers[index])) {
      setHeaders(headers.filter((_, i) => i !== index));
    }
  };

  const moveUp = (index) => {
    if (index === 0) return;
    const newHeaders = [...headers];
    [newHeaders[index - 1], newHeaders[index]] = [newHeaders[index], newHeaders[index - 1]];
    setHeaders(newHeaders);
  };

  const moveDown = (index) => {
    if (index === headers.length - 1) return;
    const newHeaders = [...headers];
    [newHeaders[index], newHeaders[index + 1]] = [newHeaders[index + 1], newHeaders[index]];
    setHeaders(newHeaders);
  };

  const togglePin = (header) => {
    setPinnedHeaders((prev) =>
      prev.includes(header) ? prev.filter((h) => h !== header) : [...prev, header]
    );
  };

  const handleSave = () => {
    if (sheetName.trim() && headers.length > 0) {
      onSave(sheetName.trim(), headers, pinnedHeaders); // Pass pinnedHeaders to parent
      onClose();
    } else {
      alert("Please provide a sheet name and at least one header.");
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2 className={styles.addTitle}>Add New Sheet</h2>
        <div className={styles.inputSection}>
          <label className={styles.sheetNameTitle}>Sheet Name:</label>
          <input
            type="text"
            value={sheetName}
            onChange={(e) => setSheetName(e.target.value)}
            placeholder="e.g., Contacts"
            className={styles.sheetNameInput}
          />
        </div>
        <div className={styles.headerSection}>
          <label className={styles.headerLabel}>Headers:</label>
          <div className={styles.headerList}>
            {headers.map((header, index) => (
              <div key={header} className={styles.headerItem}>
                <span>{header}</span>
                <div className={styles.buttons}>
                <button
                  onClick={() => togglePin(header)}
                  className={pinnedHeaders.includes(header) ? styles.pinned : styles.unpinned}
                >
                  <BsFillPinAngleFill />
                </button>
                  <button onClick={() => moveUp(index)} disabled={index === 0}>
                    ↑
                  </button>
                  <button onClick={() => moveDown(index)} disabled={index === headers.length - 1}>
                    ↓
                  </button>
                  <button
                    onClick={() => removeHeader(index)}
                    disabled={pinnedHeaders.includes(header)}
                    className={pinnedHeaders.includes(header) ? styles.disabledDeleteButton : styles.enabledDeleteButton}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.addHeaderSection}>
            <input
              type="text"
              value={newHeader}
              onChange={(e) => setNewHeader(e.target.value)}
              placeholder="New Header Name"
            />
            <button onClick={addHeader}>Add</button>
          </div>
        </div>
        <div className={styles.modalActions}>
          <button onClick={handleSave}>Save</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default AddSheetModal;