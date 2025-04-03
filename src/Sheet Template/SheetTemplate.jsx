import { useRef, useState } from "react";
import styles from "./SheetTemplate.module.css";
import RowComponent from "./Row Template/RowComponent";

const SheetTemplate = ({ headers, rows, filters = {}, onEditSheet }) => {
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
                    placeholder="Find a row..."
                    className={styles.searchBar}
                />
                <button className={styles.addHeader} onClick={onEditSheet}>
                    Edit
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