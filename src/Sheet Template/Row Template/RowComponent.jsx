import styles from "./RowComponent.module.css";

const RowComponent = ({ rowData, headerNames, onClick }) => {
  const isAddNew = rowData.isAddNew;

  return (
    <div
      className={`${styles.bodyRow} ${isAddNew ? styles.addNewRow : ""}`}
      onClick={onClick}
    >
      {headerNames.map((header, i) => (
        <div key={i} className={styles.bodyCell}>
          {isAddNew && i === 0
            ? "+ Add New Card"
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