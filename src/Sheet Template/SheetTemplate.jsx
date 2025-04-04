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
    
        const matchesFilters = Object.entries(filters).every(([headerKey, filter]) => {
            if (!filter || Object.keys(filter).length === 0) return true;
            const rowValue = row[headerKey];
            const header = headers.find((h) => h.key === headerKey);
            const type = header ? header.type : "text";
    
            switch (type) {
                case "number":
                    if (!filter.value) return true;
                    const numValue = Number(rowValue);
                    const filterNum = Number(filter.value);
                    switch (filter.order) {
                        case "greater": return numValue > filterNum;
                        case "less": return numValue < filterNum;
                        default: return numValue === filterNum;
                    }
                case "date":
                    if (!filter.start && !filter.end) return true;
                    const rowDate = new Date(rowValue);
                    const startDate = filter.start ? new Date(filter.start) : null;
                    const endDate = filter.end ? new Date(filter.end) : null;
                    if (startDate && endDate) {
                        return rowDate >= startDate && rowDate <= endDate;
                    }
                    if (startDate) return rowDate >= startDate;
                    if (endDate) return rowDate <= endDate;
                    return true;
                case "dropdown":
                    if (!filter.values || filter.values.length === 0) return true;
                    return filter.values.includes(String(rowValue));
                default:
                    if (!filter.value) return true;
                    return String(rowValue || "").toLowerCase().includes(filter.value.toLowerCase());
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