import { useState } from "react";
import styles from "./CardDetails.module.css";

const CardDetails = ({ rowData, headers, onClose, onSave, onDelete }) => {
  const [formData, setFormData] = useState({ ...rowData });
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const handleInputChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(formData);
    onClose(); // Close after saving (optional, remove if you want to keep it open)
  };

  const handleDeleteConfirm = () => {
    onDelete(rowData);
    setIsDeleteConfirmOpen(false);
  };

  return (
    <div className={styles.cardContent}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Details</h2>
        <button className={styles.closeButton} onClick={onClose}>
          Done
        </button>
      </div>
      <div className={styles.fieldList}>
        {headers.map((header) => (
          <div key={header.key} className={styles.fieldItem}>
            <label className={styles.fieldLabel}>{header.name}</label>
            <input
              type={header.type === "number" ? "number" : header.type === "date" ? "date" : "text"}
              value={formData[header.key] || ""}
              onChange={(e) => handleInputChange(header.key, e.target.value)}
              className={styles.fieldInput}
              placeholder={`Enter ${header.name}`}
            />
          </div>
        ))}
      </div>
      <div className={styles.cardActions}>
        <button className={styles.deleteButton} onClick={() => setIsDeleteConfirmOpen(true)}>
          Delete
        </button>
        <div className={styles.actionButtons}>
          <button className={styles.saveButton} onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
      {isDeleteConfirmOpen && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmDialog}>
            <h3 className={styles.confirmTitle}>Confirm Delete</h3>
            <p className={styles.confirmMessage}>Are you sure you want to delete this row?</p>
            <div className={styles.confirmActions}>
              <button className={styles.confirmCancel} onClick={() => setIsDeleteConfirmOpen(false)}>
                Cancel
              </button>
              <button className={styles.confirmDelete} onClick={handleDeleteConfirm}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardDetails;