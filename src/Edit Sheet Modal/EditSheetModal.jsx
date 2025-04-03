import { useState } from "react";
import styles from "./EditSheetModal.module.css";
import { BsFillPinAngleFill } from "react-icons/bs";

const EditSheetModal = ({ headerNames, pinnedHeaders, onSave, onPinToggle, onClose }) => {
  const [headers, setHeaders] = useState(headerNames);
  const [newHeader, setNewHeader] = useState("");

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

  const addHeader = () => {
    if (newHeader.trim() && !headers.includes(newHeader.trim().toUpperCase())) {
      setHeaders([...headers, newHeader.trim().toUpperCase()]);
      setNewHeader("");
    }
  };

  const deleteHeader = (index) => {
    if (!pinnedHeaders.includes(headers[index])) {
      setHeaders(headers.filter((_, i) => i !== index));
    }
  };

  const handleSave = () => {
    onSave(headers);
    onClose();
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2 className={styles.editTitle}>Edit Headers</h2>
        <div className={styles.headerList}>
          {headers.map((header, index) => (
            <div key={header} className={styles.headerItem}>
              <span>{header}</span>
              <div className={styles.buttons}>
              <button
                onClick={() => onPinToggle(header)}
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
                  onClick={() => deleteHeader(index)}
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
        <div className={styles.modalActions}>
          <button onClick={handleSave}>Save</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default EditSheetModal;