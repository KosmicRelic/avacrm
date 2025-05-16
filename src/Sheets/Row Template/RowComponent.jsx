// RowComponent.js
import { useContext } from 'react';
import PropTypes from 'prop-types';
import styles from './RowComponent.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { FaRegCircle, FaRegCheckCircle } from 'react-icons/fa';
import { formatFirestoreTimestamp } from '../../Utils/firestoreUtils';

const RowComponent = ({ rowData, headers, onClick, isSelected, onAddRow, isSelectMode, onSelect }) => {
  const isAddNew = rowData.isAddNew;
  const { isDarkTheme, user, businessId } = useContext(MainContext);
  const isBusinessUser = user && user.uid === businessId;

  const handleClick = () => {
    if (isAddNew && onAddRow) {
      onAddRow();
    } else if (onClick) {
      onClick(rowData);
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

  return (
    <div
      className={`${styles.bodyRow} ${isAddNew ? styles.addNewRow : ''} ${
        isSelected ? styles.selectedRow : ''
      } ${isDarkTheme ? styles.darkTheme : ''}`}
      onClick={handleClick}
    >
      {/* Only show select button for business user */}
      {!isAddNew && isSelectMode && isBusinessUser && (
        <div
          className={`${styles.bodyCell} ${styles.selectCell} ${styles.selectMode} ${
            isDarkTheme ? styles.darkTheme : ''
          }`}
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
      {isAddNew ? (
        <>
          <div
            className={`${styles.bodyCell} ${styles.addCell} ${isDarkTheme ? styles.darkTheme : ''}`}
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
          >
            + Add
          </div>
          {headers.slice(2).map((header, i) => (
            <div
              key={i}
              className={`${styles.bodyCell} ${isDarkTheme ? styles.darkTheme : ''}`}
            ></div>
          ))}
        </>
      ) : (
        headers.map((header, i) => {
          const value = rowData[header.key];
          const displayValue =
            header.type === 'date'
              ? formatFirestoreTimestamp(value) || ''
              : value !== undefined
              ? String(value)
              : '';
          return (
            <div
              key={i}
              className={`${styles.bodyCell} ${isDarkTheme ? styles.darkTheme : ''}`}
            >
              {displayValue}
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
};

RowComponent.defaultProps = {
  isSelected: false,
  isSelectMode: false,
};

export default RowComponent;