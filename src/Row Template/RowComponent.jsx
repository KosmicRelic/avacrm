import styles from "./RowComponent.module.css";

const RowComponent = ({ rowData }) => {
  return (
    <div className={styles.bodyRow}>
      {rowData.map((text, i) => (
        <div key={i} className={styles.bodyCell}>{text}</div>
      ))}
    </div>
  );
};

export default RowComponent;