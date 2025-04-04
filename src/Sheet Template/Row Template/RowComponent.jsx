import styles from "./RowComponent.module.css";

const RowComponent = ({ rowData, headerNames }) => {
  return (
    <div className={styles.bodyRow}>
      {headerNames.map((header, i) => (
        <div key={i} className={styles.bodyCell}>
          {rowData[header] !== undefined ? String(rowData[header]) : ""}
        </div>
      ))}
    </div>
  );
};

export default RowComponent;