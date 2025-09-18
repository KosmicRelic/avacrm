// RowComponent.js
import { useContext, useState } from 'react';
import PropTypes from 'prop-types';
import styles from './RowComponent.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { FaRegCircle, FaRegCheckCircle } from 'react-icons/fa';
import { FiEdit } from 'react-icons/fi';
import { formatFirestoreTimestamp } from '../../Utils/firestoreUtils';

const RowComponent = ({ rowData, headers, onClick, isSelected, onAddRow, isSelectMode, onSelect, getTeamMemberName, onEdit, onInlineSave }) => {
  const isAddNew = rowData.isAddNew;
  const { isDarkTheme, user, businessId } = useContext(MainContext);
  const isBusinessUser = user && user.uid === businessId;
  const [isHovered, setIsHovered] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');

  const handleClick = () => {
    if (isAddNew && onAddRow) {
      onAddRow();
    } else if (onClick) {
      onClick(rowData);
    }
  };

  const handleEditClick = (e) => {
    e.stopPropagation();
    if (onEdit && !isAddNew) {
      onEdit(rowData);
    }
  };

  const handleSelectClick = (e) => {
    e.stopPropagation();
    if (!isAddNew) {
      onSelect(rowData);
    } else {
      onSelect();
    }
  };

  const handleCellClick = (e) => {
    // Prevent row click when clicking on cells
    e.stopPropagation();
  };

  const handleCellDoubleClick = (e, headerKey, currentValue) => {
    // Prevent row click when double-clicking on cells
    e.stopPropagation();
    if (isAddNew) return;
    setEditingCell(headerKey);
    setEditValue(currentValue || '');
  };

  const handleEditSave = () => {
    if (editingCell && onInlineSave) {
      const updatedRowData = { ...rowData, [editingCell]: editValue };
      onInlineSave(updatedRowData);
    }
    setEditingCell(null);
    setEditValue('');
  };

  const handleEditCancel = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleEditSave();
    } else if (e.key === 'Escape') {
      handleEditCancel();
    }
  };

  return (
    <div
      className={`${styles.bodyRow} ${isAddNew ? styles.addNewRow : ''} ${
        isSelected ? styles.selectedRow : ''
      } ${isDarkTheme ? styles.darkTheme : ''}`}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Only show select button for business user */}
      {!isAddNew && isSelectMode && isBusinessUser && (
        <div
          className={`${styles.bodyCell} ${styles.selectCell} ${styles.selectMode} ${
            isDarkTheme ? styles.darkTheme : ''
          }`}
          onClick={handleCellClick}
        >
          <div
            className={`${styles.selectIcon} ${isSelected ? styles.selected : ''} ${
              isDarkTheme ? styles.darkTheme : ''
            }`}
            onClick={handleSelectClick}
          >
            {isSelected ? <FaRegCheckCircle size={18} /> : <FaRegCircle size={18} />}
          </div>
        </div>
      )}
      {/* Edit button that appears on hover */}
      {!isAddNew && isHovered && (
        <div className={`${styles.editButtonContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
          <button
            className={`${styles.editButton} ${isDarkTheme ? styles.darkTheme : ''}`}
            onClick={handleEditClick}
            title="Edit card"
          >
            <FiEdit size={16} />
          </button>
        </div>
      )}
      {isAddNew ? (
        <>
          <div
            className={`${styles.bodyCell} ${styles.addCell} ${isDarkTheme ? styles.darkTheme : ''}`}
            onClick={handleCellClick}
          >
            {/* Only show select button for business user in add new row */}
            {isBusinessUser && (
              <button
                className={`${styles.selectButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                onClick={handleSelectClick}
              >
                Select
              </button>
            )}
          </div>
          <div
            className={`${styles.bodyCell} ${isDarkTheme ? styles.darkTheme : ''}`}
            onClick={handleCellClick}
          >
            + Add
          </div>
          {headers.slice(2).map((header, i) => (
            <div
              key={i}
              className={`${styles.bodyCell} ${isDarkTheme ? styles.darkTheme : ''}`}
              onClick={handleCellClick}
            ></div>
          ))}
        </>
      ) : (
        headers.map((header, i) => {
          const value = rowData[header.key];
          let displayValue;
          if (header.key === 'assignedTo' && typeof getTeamMemberName === 'function') {
            displayValue = getTeamMemberName(value);
          } else if (value && typeof value === 'object' && ('seconds' in value || 'toDate' in value)) {
            // Format any Firestore Timestamp or Timestamp-like object as dd/mm/yyyy
            displayValue = formatFirestoreTimestamp(value);
          } else if (header.type === 'multi-select' && Array.isArray(value)) {
            displayValue = value.join(', ');
          } else {
            displayValue = value !== undefined ? String(value) : '';
          }
          return (
            <div
              key={i}
              className={`${styles.bodyCell} ${isDarkTheme ? styles.darkTheme : ''} ${editingCell === header.key ? styles.editingCell : ''}`}
              onClick={handleCellClick}
              onDoubleClick={(e) => handleCellDoubleClick(e, header.key, displayValue)}
            >
              {editingCell === header.key ? (
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={handleEditSave}
                  onKeyDown={handleKeyDown}
                  className={`${styles.editInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                  autoFocus
                />
              ) : (
                displayValue
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

RowComponent.propTypes = {
  rowData: PropTypes.shape({
    isAddNew: PropTypes.bool,
    docId: PropTypes.string,
  }).isRequired,
  headers: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      type: PropTypes.string,
      visible: PropTypes.bool,
    })
  ).isRequired,
  onClick: PropTypes.func,
  isSelected: PropTypes.bool,
  onAddRow: PropTypes.func,
  isSelectMode: PropTypes.bool,
  onSelect: PropTypes.func,
  getTeamMemberName: PropTypes.func,
  onEdit: PropTypes.func,
  onInlineSave: PropTypes.func,
};

RowComponent.defaultProps = {
  isSelected: false,
  isSelectMode: false,
};

export default RowComponent;