import { useState, useContext } from "react";
import styles from "./CardDetails.module.css";
import { MainContext } from "../../Contexts/MainContext";
const CardDetails = ({ rowData, headers, onClose, onSave, onDelete }) => {
  const { headers: allHeaders } = useContext(MainContext);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ ...rowData });
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const getDropdownOptions = (headerKey) => {
    const header = allHeaders.find((h) => Object.keys(h)[0] === headerKey);
    return header && header.type === "dropdown" ? header.options || [] : [];
  };

  const handleInputChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(formData);
    setIsEditing(false);
  };

  const handleDeleteConfirm = () => {
    onDelete(rowData);
    setIsDeleteConfirmOpen(false);
  };

  return (
    <div className={styles.cardContent}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>{isEditing ? "Edit Details" : "Details"}</h2>
        <div className={styles.headerButtons}>
          {isEditing ? (
            <>
              <button className={styles.cancelButton} onClick={() => setIsEditing(false)}>
                Cancel
              </button>
              <button className={styles.saveButton} onClick={handleSave}>
                Save
              </button>
            </>
          ) : (
            <>
              <button className={styles.editButton} onClick={() => setIsEditing(true)}>
                Edit
              </button>
              <button className={styles.closeButton} onClick={onClose}>
                Done
              </button>
            </>
          )}
        </div>
      </div>
      <div className={styles.fieldList}>
        {headers.map((header) => (
          <div key={header.key} className={styles.fieldItem}>
            <span className={styles.fieldLabel}>{header.name}</span>
            {isEditing ? (
              header.type === "dropdown" ? (
                <select
                  value={formData[header.key] || ""}
                  onChange={(e) => handleInputChange(header.key, e.target.value)}
                  className={styles.fieldSelect}
                >
                  <option value="">Select an option</option>
                  {getDropdownOptions(header.key).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={header.type === "number" ? "number" : header.type === "date" ? "date" : "text"}
                  value={formData[header.key] || ""}
                  onChange={(e) => handleInputChange(header.key, e.target.value)}
                  className={styles.fieldInput}
                  placeholder={`Enter ${header.name}`}
                />
              )
            ) : (
              <span className={styles.fieldValue}>
                {formData[header.key] || "—"}
              </span>
            )}
          </div>
        ))}
      </div>
      {!isEditing && (
        <div className={styles.cardActions}>
          <button className={styles.deleteButton} onClick={() => setIsDeleteConfirmOpen(true)}>
            Delete
          </button>
        </div>
      )}
      {isDeleteConfirmOpen && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmDialog}>
            <h3 className={styles.confirmTitle}>Delete Row?</h3>
            <p className={styles.confirmMessage}>This action cannot be undone.</p>
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