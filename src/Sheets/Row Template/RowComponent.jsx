import { useContext, useEffect } from "react";
import PropTypes from "prop-types";
import styles from "./RowComponent.module.css";
import { MainContext } from "../../Contexts/MainContext";

const RowComponent = ({ rowData, headerNames, onClick, isSelected, onAddRow }) => {
  const isAddNew = rowData.isAddNew;
  const { isDarkTheme } = useContext(MainContext);

  const handleClick = () => {
    if (isAddNew && onAddRow) {
      onAddRow();
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <div
      className={`${styles.bodyRow} ${isAddNew ? styles.addNewRow : ""} ${
        isSelected ? styles.selectedRow : ""
      } ${isDarkTheme ? styles.darkTheme : ""}`}
      onClick={handleClick}
    >
      {headerNames.map((header, i) => (
        <div key={i} className={`${styles.bodyCell} ${isDarkTheme ? styles.darkTheme : ""}`}>
          {isAddNew && i === 0
            ? "+ Add"
            : isAddNew
            ? ""
            : rowData[header] !== undefined
            ? String(rowData[header])
            : ""}
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
};

RowComponent.defaultProps = {
  isSelected: false,
};

export default RowComponent;