import { useContext } from "react";
import PropTypes from "prop-types";
import styles from "./RowComponent.module.css";
import { MainContext } from "../../Contexts/MainContext";
import { FaRegCircle, FaRegCheckCircle } from "react-icons/fa";

const RowComponent = ({ rowData, headerNames, onClick, isSelected, onAddRow, isSelectMode, onSelect }) => {
  const isAddNew = rowData.isAddNew;
  const { isDarkTheme } = useContext(MainContext);

  const handleClick = () => {
    if (isAddNew && onAddRow) {
      onAddRow();
    } else if (onClick) {
      onClick(rowData);
    }
  };

  const handleSelectClick = (e) => {
    e.stopPropagation(); // Prevent row click
    if (!isAddNew) {
      onSelect(rowData);
    } else {
      onSelect(); // Trigger select mode toggle
    }
  };

  // Don't render the Add row when in select mode
  if (isAddNew && isSelectMode) {
    return null;
  }

  return (
    <div
      className={`${styles.bodyRow} ${isAddNew ? styles.addNewRow : ""} ${
        isSelected ? styles.selectedRow : ""
      } ${isDarkTheme ? styles.darkTheme : ""}`}
      onClick={handleClick}
    >
      {!isAddNew && isSelectMode && (
        <div
          className={`${styles.bodyCell} ${styles.selectCell} ${styles.selectMode} ${
            isDarkTheme ? styles.darkTheme : ""
          }`}
        >
          <div
            className={`${styles.selectIcon} ${isSelected ? styles.selected : ""} ${
              isDarkTheme ? styles.darkTheme : ""
            }`}
            onClick={handleSelectClick}
          >
            {isSelected ? <FaRegCheckCircle size={18} /> : <FaRegCircle size={18} />}
          </div>
        </div>
      )}
      {headerNames.map((header, i) => (
        <div
          key={i}
          className={`${styles.bodyCell} ${
            isAddNew && i === 0 ? styles.addCell : ""
          } ${isDarkTheme ? styles.darkTheme : ""}`}
        >
          {isAddNew && i === 0 ? (
            <button
              className={`${styles.selectButton} ${isDarkTheme ? styles.darkTheme : ""}`}
              onClick={handleSelectClick}
            >
              Select
            </button>
          ) : isAddNew && i === 1 ? (
            "+ Add"
          ) : isAddNew ? (
            ""
          ) : rowData[header] !== undefined ? (
            String(rowData[header])
          ) : (
            ""
          )}
        </div>
      ))}
    </div>
  );
};

RowComponent.propTypes = {
  rowData: PropTypes.shape({
    isAddNew: PropTypes.bool,
    id: PropTypes.string,
  }).isRequired,
  headerNames: PropTypes.arrayOf(PropTypes.string).isRequired,
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