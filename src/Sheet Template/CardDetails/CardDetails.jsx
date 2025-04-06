import { useState, useContext, useMemo, useCallback } from "react";
import styles from "./CardDetails.module.css";
import { MainContext } from "../../Contexts/MainContext";

const CardDetails = ({ rowData, headers: sheetHeaders, onClose, onSave, onDelete }) => {
  const { headers: allHeaders } = useContext(MainContext);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(rowData);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const allFields = useMemo(() => {
    return Object.keys(rowData).map((key) => {
      const header = allHeaders.find((h) => Object.keys(h)[0] === key);
      return header
        ? {
            key,
            name: header[key],
            type: header.type,
            options: header.options || [],
          }
        : {
            key,
            name: key.charAt(0).toUpperCase() + key.slice(1),
            type: "text",
            options: [],
          };
    });
  }, [rowData, allHeaders]);

  const getDropdownOptions = useCallback((headerKey) => {
    const header = allHeaders.find((h) => Object.keys(h)[0] === headerKey);
    return header && header.type === "dropdown" ? header.options || [] : [];
  }, [allHeaders]);

  const handleInputChange = useCallback((key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(() => {
    onSave(formData);
    setIsEditing(false);
  }, [formData, onSave]);

  const handleDeleteConfirm = useCallback(() => {
    onDelete(rowData);
    setIsDeleteConfirmOpen(false);
  }, [rowData, onDelete]);

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
        {allFields.length > 0 ? (
          allFields.map((field) => (
            <div key={field.key} className={styles.fieldItem}>
              <span className={styles.fieldLabel}>{field.name}</span>
              {isEditing ? (
                field.type === "dropdown" ? (
                  <select
                    value={formData[field.key] || ""}
                    onChange={(e) => handleInputChange(field.key, e.target.value)}
                    className={styles.fieldSelect}
                  >
                    <option value="">Select an option</option>
                    {getDropdownOptions(field.key).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                    value={formData[field.key] || ""}
                    onChange={(e) => handleInputChange(field.key, e.target.value)}
                    className={styles.fieldInput}
                    placeholder={`Enter ${field.name}`}
                  />
                )
              ) : (
                <span className={styles.fieldValue}>{formData[field.key] || "—"}</span>
              )}
            </div>
          ))
        ) : (
          <p>No fields available</p>
        )}
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