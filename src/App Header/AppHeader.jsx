import styles from "./AppHeader.module.css";
import { CgProfile } from "react-icons/cg";
import { FaChevronDown } from "react-icons/fa";
import { SiGoogleads } from "react-icons/si";

export default function AppHeader({ sheets, selectedSheet, onSheetChange, onEditSheet }) {
  return (
    <div className={styles.headerContainer}>
      <h2 className={styles.avaTitle}>AVA</h2>
      <div className={styles.buttonWrapper}>
        <button className={styles.avaSubTitle}>
          <SiGoogleads />
          {selectedSheet}
          <FaChevronDown />
        </button>
        <select
          value={selectedSheet}
          onChange={(e) => onSheetChange(e.target.value)}
          className={styles.sheetDropdown}
        >
          {sheets.map((sheet) => (
            <option key={sheet} value={sheet}>
              {sheet}
            </option>
          ))}
          <option value="add-new-sheet">Add New Sheet</option>
        </select>
      </div>
      <button className={styles.addHeader} onClick={onEditSheet}>
        Edit Sheet
      </button>
      <CgProfile className={styles.profile} />
    </div>
  );
}