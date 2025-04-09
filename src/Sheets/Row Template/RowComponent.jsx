import { useContext } from "react";
import styles from "./RowComponent.module.css";
import { MainContext } from "../../Contexts/MainContext";

const RowComponent = ({ rowData, headerNames, onClick }) => {
  const isAddNew = rowData.isAddNew;
  const { isDarkTheme } = useContext(MainContext);

  return (
    <div
      className={`${styles.bodyRow} ${isAddNew ? styles.addNewRow : ""} ${isDarkTheme ? styles.darkTheme : ""}`}
      onClick={onClick}
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

export default RowComponent;