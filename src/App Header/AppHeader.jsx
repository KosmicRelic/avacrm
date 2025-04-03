import styles from "./AppHeader.module.css";
import { CgProfile } from "react-icons/cg";
import { FaChevronDown } from "react-icons/fa";
import { IoFilterCircle } from "react-icons/io5";
import { SiGoogleads } from "react-icons/si";

export default function AppHeader({ sheets, selectedSheet, onSheetChange }) {
  return (
    <div className={styles.headerContainer}>
      <h2 className={styles.avaTitle}>AVA</h2>
      <div className={styles.buttonWrapper}>
        <button className={styles.avaSubTitle}>
          <SiGoogleads />
          {selectedSheet}
          <FaChevronDown />
        </button>
        <button className={styles.filterIcon}><IoFilterCircle /></button>
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
      <CgProfile className={styles.profile} />
    </div>
  );
}