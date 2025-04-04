import { useRef, useState } from "react";
import styles from "./SheetTemplate.module.css";
import RowComponent from "./Row Template/RowComponent";
import { CiFilter } from "react-icons/ci";
import { FaEdit } from "react-icons/fa";

const SheetTemplate = ({ headers, rows, filters = {}, onEditSheet, onFilter }) => {
    const scrollContainerRef = useRef(null);
    const [searchQuery, setSearchQuery] = useState("");

    const visibleHeaders = headers.filter((header) => header.visible);

    const filteredRows = rows.filter((row) => {
        const matchesSearch = searchQuery
            ? headers.some((header) =>
                  String(row[header.key] || "").toLowerCase().includes(searchQuery.toLowerCase())
              )
            : true;

        const matchesFilters = Object.entries(filters).every(([headerKey, value]) => {
            if (!value) return true;
            const rowValue = String(row[headerKey] || "").toLowerCase();
            const filterValue = String(value).toLowerCase();
            const header = headers.find((h) => h.key === headerKey);
            const type = header ? header.type : "text";

            switch (type) {
                case "number":
                    return Number(rowValue) === Number(filterValue);
                case "date":
                    return rowValue === filterValue;
                case "dropdown":
                    return rowValue === filterValue;
                default:
                    return rowValue.includes(filterValue);
            }
        });

        return matchesSearch && matchesFilters;
    });

    return (
        <div className={styles.tableContainer}>
            <div className={styles.controls}>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search"
                    className={styles.searchBar}
                />
                <button className={styles.filterButton} onClick={onFilter}>
                    <CiFilter size={20} className={styles.filterIcon} />
                </button>
                <button className={styles.editHeaderButton} onClick={onEditSheet}>
                    <FaEdit size={20} className={styles.editHeaderIcon} />
                </button>
            </div>
            <div className={styles.tableWrapper} ref={scrollContainerRef}>
                <div className={styles.header}>
                    {visibleHeaders.map((header) => (
                        <div key={header.key} className={styles.headerCell}>
                            {header.name}
                        </div>
                    ))}
                </div>
                <div className={styles.bodyContainer}>
                    {filteredRows.map((rowData, rowIndex) => (
                        <RowComponent
                            key={rowIndex}
                            rowData={rowData}
                            headerNames={visibleHeaders.map((h) => h.key)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SheetTemplate;