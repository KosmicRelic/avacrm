import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import styles from "./SheetTemplate.module.css";
import RowComponent from "./Row Template/RowComponent";
import CardDetails from "./CardDetails/CardDetails";
import { CiFilter } from "react-icons/ci";
import { IoCloseCircle } from "react-icons/io5";
import { FaFolder } from "react-icons/fa";
import { HiMiniArrowsRightLeft } from "react-icons/hi2";

const SheetTemplate = ({
  headers,
  rows,
  filters = {},
  sheets,
  setSheets,
  activeSheetName,
  onSheetChange,
  onEditSheet,
  onFilter,
  onRowClick,
  onCardSave,
  onCardDelete,
}) => {
  const scrollContainerRef = useRef(null);
  const modalRef = useRef(null);
  const sheetTabsRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);
  const [isClosing, setIsClosing] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [openFolder, setOpenFolder] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addType, setAddType] = useState(null);
  const [newSheetName, setNewSheetName] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedSheets, setSelectedSheets] = useState([]);
  const [selectedHeaders, setSelectedHeaders] = useState([]);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragTarget, setDragTarget] = useState(null);
  const [dragTimer, setDragTimer] = useState(null);
  const [dropSide, setDropSide] = useState(null);
  const [dropPositionX, setDropPositionX] = useState(null); // New state for indicator position
  const [touchStartTime, setTouchStartTime] = useState(null);
  const [touchStartPosition, setTouchStartPosition] = useState(null);
  const [touchActive, setTouchActive] = useState(false);
  const [isOrderMode, setIsOrderMode] = useState(false);

  const visibleHeaders = useMemo(() => headers.filter((header) => header.visible), [headers]);
  const isMobile = windowWidth <= 1024;

  const folderSheets = useMemo(() => {
    const folderItems = sheets.structure.filter((item) => item.folderName);
    return folderItems.flatMap((folder) => folder.sheets);
  }, [sheets.structure]);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target) && isAddModalOpen) {
        setIsAddModalOpen(false);
        setAddType(null);
        setNewSheetName("");
        setNewFolderName("");
        setSelectedSheets([]);
        setSelectedHeaders([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isAddModalOpen]);

  useEffect(() => {
    const handleClickOutsideFolder = (event) => {
      if (openFolder && !event.target.closest(`.${styles.tabButton}`)) {
        setOpenFolder(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutsideFolder);
    document.addEventListener("touchstart", handleClickOutsideFolder);
    return () => {
      document.removeEventListener("mousedown", handleClickOutsideFolder);
      document.removeEventListener("touchstart", handleClickOutsideFolder);
    };
  }, [openFolder]);

  useEffect(() => {
    if (sheetTabsRef.current) {
      sheetTabsRef.current.scrollWidth;
      sheetTabsRef.current.style.width = 'auto';
    }
  }, [openFolder, draggedItem]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) =>
      Object.entries(filters).every(([headerKey, filter]) => {
        const header = headers.find((h) => h.key === headerKey);
        const rowValue = row[headerKey];
        if (!filter || !header) return true;

        switch (header.type) {
          case "number":
            if (!filter.start && !filter.end && !filter.value && !filter.sortOrder) return true;
            const numValue = Number(rowValue) || 0;
            if (filter.start || filter.end) {
              const startNum = filter.start ? Number(filter.start) : -Infinity;
              const endNum = filter.end ? Number(filter.end) : Infinity;
              return numValue >= startNum && numValue <= endNum;
            }
            if (!filter.value) return true;
            const filterNum = Number(filter.value);
            switch (filter.order) {
              case "greater": return numValue > filterNum;
              case "less": return numValue < filterNum;
              case "greaterOrEqual": return numValue >= filterNum;
              case "lessOrEqual": return numValue <= filterNum;
              default: return numValue === filterNum;
            }
          case "date":
            if (!filter.start && !filter.end && !filter.value) return true;
            const dateValue = new Date(rowValue);
            if (filter.start || filter.end) {
              const startDate = filter.start ? new Date(filter.start) : new Date(-8640000000000000);
              const endDate = filter.end ? new Date(filter.end) : new Date(8640000000000000);
              return dateValue >= startDate && dateValue <= endDate;
            }
            if (!filter.value) return true;
            const filterDate = new Date(filter.value);
            switch (filter.order) {
              case "before": return dateValue < filterDate;
              case "after": return dateValue > filterDate;
              default: return dateValue.toDateString() === filterDate.toDateString();
            }
          case "dropdown":
            if (!filter.values || filter.values.length === 0) return true;
            return filter.values.includes(rowValue);
          case "text":
            if (!filter.value) return true;
            const strValue = String(rowValue || "").toLowerCase();
            const filterStr = filter.value.toLowerCase();
            switch (filter.condition) {
              case "contains": return strValue.includes(filterStr);
              case "startsWith": return strValue.startsWith(filterStr);
              case "endsWith": return strValue.endsWith(filterStr);
              default: return strValue === filterStr;
            }
          default:
            return true;
        }
      })
    );
  }, [rows, filters, headers]);

  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];
    for (const [headerKey, filter] of Object.entries(filters)) {
      const header = headers.find((h) => h.key === headerKey);
      if (header && filter.sortOrder && header.type === "number") {
        sorted.sort((a, b) => {
          const aValue = Number(a[headerKey] || 0);
          const bValue = Number(b[headerKey] || 0);
          return filter.sortOrder === "ascending" ? aValue - bValue : bValue - aValue;
        });
      }
    }
    return sorted;
  }, [filteredRows, filters, headers]);

  const finalRows = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return sortedRows.filter((row) =>
      visibleHeaders.some((header) => String(row[header.key] || "").toLowerCase().includes(query))
    );
  }, [sortedRows, searchQuery, visibleHeaders]);

  const handleSheetClick = useCallback((sheetName) => {
    onSheetChange(sheetName);
    setOpenFolder(null);
  }, [onSheetChange]);

  const clearSearch = useCallback(() => setSearchQuery(""), []);

  const handleRowClick = useCallback((rowData) => {
    setSelectedRow(rowData);
    setIsClosing(false);
    onRowClick(rowData);
  }, [onRowClick]);

  const handleCardClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setSelectedRow(null);
      setIsClosing(false);
    }, 300);
  }, []);

  const handleCardSave = useCallback((updatedRow) => {
    onCardSave(updatedRow);
    setSelectedRow(updatedRow);
  }, [onCardSave]);

  const handleCardDelete = useCallback((rowData) => {
    onCardDelete(rowData);
    setSelectedRow(null);
  }, [onCardDelete]);

  const handleAddNewCard = useCallback(() => {
    const newId = `${Date.now()}`;
    let newCard;
    switch (activeSheetName) {
      case "Leads":
        newCard = { leadId: newId, name: "", phone: "", email: "", leadScore: "", nextActions: "", followUpDate: "" };
        break;
      case "Business Partners":
        newCard = { businessId: newId, fullName: "", address: "", status: "" };
        break;
      case "Vendors":
        newCard = { vendorId: newId, name: "", contact: "" };
        break;
      case "Tasks":
        newCard = { taskId: newId, description: "", dueDate: "", priority: "" };
        break;
      default:
        newCard = { [visibleHeaders[0]?.key]: newId };
    }
    onCardSave(newCard);
    setSelectedRow(newCard);
  }, [activeSheetName, visibleHeaders, onCardSave]);

  const toggleFolder = useCallback((folderName) => {
    setOpenFolder((prev) => {
      const newState = prev === folderName ? null : folderName;
      if (draggedItem && draggedItem.folderName === folderName) {
        setDraggedItem(null);
      }
      return newState;
    });
  }, [draggedItem]);

  const handleAddModalOpen = useCallback(() => {
    setIsAddModalOpen(true);
    setAddType(null);
    setNewSheetName("");
    setNewFolderName("");
    setSelectedSheets([]);
    setSelectedHeaders([]);
  }, []);

  const handleAddTypeChange = useCallback((type) => {
    setAddType(type);
    setNewSheetName("");
    setNewFolderName("");
    setSelectedSheets([]);
    setSelectedHeaders([]);
  }, []);

  const handleSheetSave = useCallback(() => {
    if (!newSheetName) {
      alert("Please provide a sheet name.");
      return;
    }
    setSheets((prevSheets) => {
      const newSheet = {
        sheetName: newSheetName,
        headers: selectedHeaders.map((key) => ({ key, visible: true, hidden: false })),
        pinnedHeaders: [],
        rows: [],
        isActive: true,
      };
      return {
        ...prevSheets,
        allSheets: prevSheets.allSheets.map((sheet) => ({
          ...sheet,
          isActive: false,
        })).concat(newSheet),
        structure: [...prevSheets.structure, { sheetName: newSheetName }],
      };
    });
    setIsAddModalOpen(false);
    onSheetChange(newSheetName);
  }, [newSheetName, selectedHeaders, setSheets, onSheetChange]);

  const handleFolderSave = useCallback(() => {
    if (!newFolderName) {
      alert("Please provide a folder name.");
      return;
    }
    setSheets((prevSheets) => ({
      ...prevSheets,
      structure: [
        ...prevSheets.structure,
        {
          folderName: newFolderName,
          sheets: selectedSheets,
        },
      ],
    }));
    setNewFolderName("");
    setSelectedSheets([]);
    setIsAddModalOpen(false);
  }, [newFolderName, selectedSheets, setSheets]);

  const toggleSheetSelection = useCallback((sheetName) => {
    setSelectedSheets((prev) =>
      prev.includes(sheetName) ? prev.filter((s) => s !== sheetName) : [...prev, sheetName]
    );
  }, []);

  const toggleHeaderSelection = useCallback((headerKey) => {
    setSelectedHeaders((prev) =>
      prev.includes(headerKey) ? prev.filter((h) => h !== headerKey) : [...prev, headerKey]
    );
  }, []);

  const availableHeaders = useMemo(() => {
    return headers.map((h, index) => ({
      key: h.key || `header-${index}`,
      name: h.name || Object.values(h)[0],
    }));
  }, [headers]);

  // Drag and Drop Handlers
  const handleDragStart = useCallback((e, item) => {
    e.preventDefault();
    const timer = setTimeout(() => {
      setDraggedItem(item);
      setDropSide(null);
      setDropPositionX(null);
    }, 300);
    setDragTimer(timer);
  }, []);

  const handleDragEnd = useCallback((e) => {
    e.preventDefault();
    if (dragTimer) {
      clearTimeout(dragTimer);
      setDragTimer(null);
    }
    if (draggedItem && dragTarget && dropSide) {
      const newStructure = [...sheets.structure];
      const draggedIndex = newStructure.findIndex(
        (i) => (i.sheetName && i.sheetName === draggedItem.sheetName) || 
               (i.folderName && i.folderName === draggedItem.folderName)
      );
      const targetIndex = newStructure.findIndex(
        (i) => (i.sheetName && i.sheetName === dragTarget.sheetName) || 
               (i.folderName && i.folderName === dragTarget.folderName)
      );

      if (draggedIndex !== -1 && targetIndex !== -1) {
        const [dragged] = newStructure.splice(draggedIndex, 1);
        const insertIndex = dropSide === 'left' ? targetIndex : targetIndex + 1;
        newStructure.splice(insertIndex, 0, dragged);
        setSheets((prev) => ({ ...prev, structure: newStructure }));
      }
    }
    setDraggedItem(null);
    setDragTarget(null);
    setDropSide(null);
    setDropPositionX(null);
  }, [draggedItem, dragTarget, sheets, setSheets, dragTimer, dropSide]);

  const handleDragEnter = useCallback((e, item) => {
    e.preventDefault();
    if (draggedItem && 
        ((item.sheetName && item.sheetName !== draggedItem.sheetName) || 
         (item.folderName && item.folderName !== draggedItem.folderName))) {
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const threshold = rect.width * 0.25;
      setDropSide(mouseX < threshold ? 'left' : 'right');
      setDragTarget(item);
      setDropPositionX(mouseX < threshold ? rect.left - 6 : rect.right + 6);
    }
  }, [draggedItem]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    if (!draggedItem || !isOrderMode || !sheetTabsRef.current) return;
  
    const rect = sheetTabsRef.current.getBoundingClientRect();
    const scrollSpeed = 15;
    const edgeThreshold = 50;
  
    // Scroll the container based on cursor position
    if (e.clientX < rect.left + edgeThreshold) {
      sheetTabsRef.current.scrollLeft -= scrollSpeed;
    } else if (e.clientX > rect.right - edgeThreshold) {
      sheetTabsRef.current.scrollLeft += scrollSpeed;
    }
  
    // Update drop indicator position to follow the cursor
    const containerRect = sheetTabsRef.current.getBoundingClientRect();
    const positionX = e.clientX - containerRect.left + sheetTabsRef.current.scrollLeft;
    setDropPositionX(positionX);
  
    // Determine the target tab and drop side
    const target = e.currentTarget;
    const itemName = target.dataset.sheetName || target.dataset.folderName;
    const item = sheets.structure.find(
      (i) => (i.sheetName === itemName) || (i.folderName === itemName)
    );
  
    if (!item || 
        (item.sheetName && item.sheetName === draggedItem.sheetName) || 
        (item.folderName && item.folderName === draggedItem.folderName)) {
      setDragTarget(null);
      setDropSide(null);
      return;
    }
  
    const targetRect = target.getBoundingClientRect();
    const mouseX = e.clientX - targetRect.left;
    const threshold = targetRect.width * 0.5;
    const newDropSide = mouseX < threshold ? 'left' : 'right';
  
    setDragTarget(item);
    setDropSide(newDropSide);
  }, [draggedItem, isOrderMode, sheets.structure]);

  const handleTouchStart = useCallback((e, item) => {
    e.stopPropagation();
    const touch = e.touches[0];
    setTouchStartTime(Date.now());
    setTouchStartPosition({ x: touch.clientX, y: touch.clientY });
    setTouchActive(true);
    if (isOrderMode) {
      const timer = setTimeout(() => {
        setDraggedItem(item);
        setDropSide(null);
        setDropPositionX(null);
      }, 300);
      setDragTimer(timer);
    }
  }, [isOrderMode]);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const distance = Math.sqrt(
      Math.pow(touchStartPosition.x - touch.clientX, 2) +
      Math.pow(touchStartPosition.y - touch.clientY, 2)
    );
  
    if (!isOrderMode && distance > 10) {
      setTouchActive(false);
    }
  
    if (sheetTabsRef.current) {
      const rect = sheetTabsRef.current.getBoundingClientRect();
      const scrollSpeed = 15;
      const edgeThreshold = 50;
  
      // Handle dragging and scrolling in order mode
      if (isOrderMode && draggedItem) {
        // Scroll the container based on cursor position
        if (touch.clientX < rect.left + edgeThreshold) {
          sheetTabsRef.current.scrollLeft -= scrollSpeed;
        } else if (touch.clientX > rect.right - edgeThreshold) {
          sheetTabsRef.current.scrollLeft += scrollSpeed;
        }
  
        // Update drop indicator position to follow the cursor
        const containerRect = sheetTabsRef.current.getBoundingClientRect();
        const positionX = touch.clientX - containerRect.left + sheetTabsRef.current.scrollLeft;
        setDropPositionX(positionX);
  
        // Determine the target tab and drop side
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        if (element) {
          const target = element.closest(`.${styles.tabButton}`);
          if (target) {
            const rect = target.getBoundingClientRect();
            const touchX = touch.clientX - rect.left;
            const threshold = rect.width * 0.5;
            const targetIndex = sheets.structure.findIndex(
              (i) => (i.sheetName === target.dataset.sheetName) || (i.folderName === target.dataset.folderName)
            );
  
            let newDropSide = touchX < threshold ? 'left' : 'right';
            const itemName = target.dataset.sheetName || target.dataset.folderName;
            const newTarget = sheets.structure.find(
              (i) => (i.sheetName === itemName) || (i.folderName === itemName)
            );
  
            if (newTarget && 
                ((newTarget.sheetName && newTarget.sheetName !== draggedItem.sheetName) || 
                 (newTarget.folderName && newTarget.folderName !== draggedItem.folderName))) {
              setDragTarget(newTarget);
              setDropSide(newDropSide);
            }
          } else {
            // If cursor is outside tabs, set to edge of list
            if (touch.clientX < sheetTabsRef.current.children[0].getBoundingClientRect().left) {
              setDragTarget(sheets.structure[0]);
              setDropSide('left');
            } else if (touch.clientX > sheetTabsRef.current.children[sheets.structure.length - 1].getBoundingClientRect().right) {
              setDragTarget(sheets.structure[sheets.structure.length - 1]);
              setDropSide('right');
            } else {
              setDragTarget(null);
              setDropSide(null);
            }
          }
        }
      }
      // Allow scrolling before dragging starts
      else if (isOrderMode && !draggedItem && distance > 10) {
        if (touch.clientX < rect.left + edgeThreshold) {
          sheetTabsRef.current.scrollLeft -= scrollSpeed;
        } else if (touch.clientX > rect.right - edgeThreshold) {
          sheetTabsRef.current.scrollLeft += scrollSpeed;
        }
      }
    }
  }, [isOrderMode, draggedItem, sheets.structure, touchStartPosition]);

  const handleTouchEnd = useCallback((e, item) => {
    e.preventDefault();
    const touchDuration = Date.now() - touchStartTime;
    const distance = touchStartPosition
      ? Math.sqrt(
          Math.pow(touchStartPosition.x - (e.changedTouches[0]?.clientX || touchStartPosition.x), 2) +
          Math.pow(touchStartPosition.y - (e.changedTouches[0]?.clientY || touchStartPosition.y), 2)
        )
      : 0;
  
    if (!isOrderMode && touchActive && touchDuration < 300 && distance < 10) {
      if (item.sheetName) handleSheetClick(item.sheetName);
      else if (item.folderName) toggleFolder(item.folderName);
    } else if (isOrderMode && touchDuration >= 300 && draggedItem && dragTarget && dropSide) {
      const newStructure = [...sheets.structure];
      const draggedIndex = newStructure.findIndex(
        (i) => (i.sheetName && i.sheetName === draggedItem.sheetName) || 
               (i.folderName && i.folderName === draggedItem.folderName)
      );
      const targetIndex = newStructure.findIndex(
        (i) => (i.sheetName && i.sheetName === dragTarget.sheetName) || 
               (i.folderName && i.folderName === dragTarget.folderName)
      );
  
      if (draggedIndex !== -1 && targetIndex !== -1) {
        const [dragged] = newStructure.splice(draggedIndex, 1);
        const insertIndex = dropSide === 'left' ? targetIndex : targetIndex + 1;
        newStructure.splice(insertIndex, 0, dragged);
        setSheets((prev) => ({ ...prev, structure: newStructure }));
  
        setTimeout(() => {
          if (sheetTabsRef.current) {
            const droppedElement = sheetTabsRef.current.children[insertIndex].querySelector(`.${styles.tabButton}`);
            if (droppedElement) {
              const rect = droppedElement.getBoundingClientRect();
              const containerRect = sheetTabsRef.current.getBoundingClientRect();
              const scrollLeft = rect.left - containerRect.left + sheetTabsRef.current.scrollLeft - (containerRect.width - rect.width) / 2;
              sheetTabsRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' });
            }
          }
        }, 0);
      }
    }
  
    if (dragTimer) {
      clearTimeout(dragTimer);
      setDragTimer(null);
    }
    setDraggedItem(null);
    setDragTarget(null);
    setDropSide(null);
    setDropPositionX(null);
    setTouchStartTime(null);
    setTouchStartPosition(null);
    setTouchActive(false);
  }, [draggedItem, dragTarget, sheets, setSheets, dragTimer, dropSide, touchStartTime, isOrderMode, handleSheetClick, toggleFolder]);

  const toggleOrderMode = useCallback(() => {
    setIsOrderMode((prev) => {
      if (prev) {
        setDraggedItem(null);
        setDragTarget(null);
        setDropSide(null);
        setDropPositionX(null);
        setDragTimer(null);
      }
      return !prev;
    });
  }, []);

  const TableContent = (
    <div className={styles.tableContent}>
      <div className={styles.controls}>
        <div className={styles.searchContainer}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className={styles.searchBar}
          />
          {searchQuery && (
            <button className={styles.clearButton} onClick={clearSearch}>
              <IoCloseCircle size={18} />
            </button>
          )}
        </div>
        <button className={styles.filterButton} onClick={onFilter}>
          <CiFilter size={20} />
        </button>
        <button className={styles.editHeaderButton} onClick={onEditSheet}>
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
          <RowComponent
            rowData={{ [visibleHeaders[0]?.key]: "Add New Card", isAddNew: true }}
            headerNames={visibleHeaders.map((h) => h.key)}
            onClick={handleAddNewCard}
          />
          {finalRows.length > 0 ? (
            finalRows.map((rowData, rowIndex) => (
              <RowComponent
                key={rowIndex}
                rowData={rowData}
                headerNames={visibleHeaders.map((h) => h.key)}
                onClick={() => handleRowClick(rowData)}
              />
            ))
          ) : (
            <div className={styles.noResults}>No results found</div>
          )}
        </div>
      </div>
      <div className={styles.sheetTabs} ref={sheetTabsRef}>
        {sheets.structure.map((item, index) => (
          item.folderName ? (
            <div key={item.folderName} className={styles.folderContainer}>
              <button
                className={`${styles.tabButton} ${openFolder === item.folderName ? styles.activeFolder : ""} ${
                  draggedItem?.folderName === item.folderName ? styles.dragging : ""
                } ${isOrderMode && !draggedItem ? styles.jiggle : ""}`}
                data-folder-name={item.folderName}
                onClick={!isOrderMode ? () => toggleFolder(item.folderName) : undefined} // Trigger folder toggle only outside order mode
                onMouseDown={isOrderMode ? (e) => handleDragStart(e, item) : undefined}
                onMouseUp={isOrderMode ? handleDragEnd : undefined}
                onMouseMove={isOrderMode ? handleDragOver : undefined}
                onMouseEnter={isOrderMode ? (e) => handleDragEnter(e, item) : undefined}
                onTouchStart={(e) => handleTouchStart(e, item)}
                onTouchMove={isOrderMode ? handleTouchMove : undefined}
                onTouchEnd={(e) => handleTouchEnd(e, item)}
              >
                <FaFolder className={styles.folderIcon} />
                {item.folderName}
                {openFolder === item.folderName && (
                  <span className={styles.folderSheets}>
                    {" > "}
                    {item.sheets.map((sheetName, idx) => (
                      <span key={sheetName}>
                        <span
                          className={`${styles.inlineSheet} ${
                            sheetName === activeSheetName ? styles.activeInlineSheet : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent folder toggle when clicking a sheet
                            handleSheetClick(sheetName);
                          }}
                        >
                          {sheetName}
                        </span>
                        {idx < item.sheets.length - 1 && " | "}
                      </span>
                    ))}
                  </span>
                )}
                {openFolder !== item.folderName && item.sheets.includes(activeSheetName) && (
                  <span className={styles.folderPath}> {` > ${activeSheetName}`}</span>
                )}
              </button>
            </div>
          ) : (
            !folderSheets.includes(item.sheetName) && (
              <div key={item.sheetName} className={styles.sheetContainer}>
                <button
                  className={`${styles.tabButton} ${
                    item.sheetName === activeSheetName ? styles.activeTab : ""
                  } ${draggedItem?.sheetName === item.sheetName ? styles.dragging : ""} ${
                    isOrderMode && !draggedItem ? styles.jiggle : ""
                  }`}
                  data-sheet-name={item.sheetName}
                  onClick={!isOrderMode ? () => handleSheetClick(item.sheetName) : undefined}
                  onMouseDown={isOrderMode ? (e) => handleDragStart(e, item) : undefined}
                  onMouseUp={isOrderMode ? handleDragEnd : undefined}
                  onMouseMove={isOrderMode ? handleDragOver : undefined}
                  onMouseEnter={isOrderMode ? (e) => handleDragEnter(e, item) : undefined}
                  onTouchStart={(e) => handleTouchStart(e, item)}
                  onTouchMove={isOrderMode ? handleTouchMove : undefined}
                  onTouchEnd={(e) => handleTouchEnd(e, item)}
                >
                  {item.sheetName}
                </button>
              </div>
            )
          )
        ))}
        {draggedItem && dropPositionX !== null && (
          <span className={styles.dropIndicator} style={{ left: `${dropPositionX}px` }}></span>
        )}
        <button
          className={`${styles.orderButton} ${isOrderMode ? styles.activeOrderButton : ""}`}
          onClick={toggleOrderMode}
        >
          {isOrderMode ? "Done" : <HiMiniArrowsRightLeft />}
        </button>
        <button className={styles.addTabButton} onClick={handleAddModalOpen}>
          +
        </button>
      </div>
      {isAddModalOpen && (
        <div className={styles.addModal} ref={modalRef}>
          <div className={styles.addTypeToggle}>
            <button
              className={`${styles.typeButton} ${addType === "sheet" ? styles.activeType : ""}`}
              onClick={() => handleAddTypeChange("sheet")}
            >
              Sheet
            </button>
            <button
              className={`${styles.typeButton} ${addType === "folder" ? styles.activeType : ""}`}
              onClick={() => handleAddTypeChange("folder")}
            >
              Folder
            </button>
          </div>
          {addType === "sheet" && (
            <div className={styles.addForm}>
              <input
                type="text"
                value={newSheetName}
                onChange={(e) => setNewSheetName(e.target.value)}
                placeholder="Sheet Name"
                className={styles.input}
              />
              <div className={styles.selectionList}>
                {availableHeaders.map((header) => (
                  <label key={header.key} className={styles.selectionItem}>
                    <input
                      type="checkbox"
                      checked={selectedHeaders.includes(header.key)}
                      onChange={() => toggleHeaderSelection(header.key)}
                    />
                    {header.name}
                  </label>
                ))}
              </div>
              <div className={styles.modalButtons}>
                <button onClick={handleSheetSave}>Save</button>
                <button onClick={() => setIsAddModalOpen(false)}>Cancel</button>
              </div>
            </div>
          )}
          {addType === "folder" && (
            <div className={styles.addForm}>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder Name"
                className={styles.input}
              />
              <div className={styles.selectionList}>
                {sheets.allSheets.map((sheet) => (
                  <label key={sheet.sheetName} className={styles.selectionItem}>
                    <input
                      type="checkbox"
                      checked={selectedSheets.includes(sheet.sheetName)}
                      onChange={() => toggleSheetSelection(sheet.sheetName)}
                    />
                    {sheet.sheetName}
                  </label>
                ))}
              </div>
              <div className={styles.modalButtons}>
                <button onClick={handleFolderSave}>Save</button>
                <button onClick={() => setIsAddModalOpen(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className={styles.sheetWrapper}>
      <div className={styles.tableContainer}>
        {TableContent}
        {isMobile && selectedRow && (
          <div className={`${styles.cardDetailsMobile} ${!isClosing ? styles.cardOpen : styles.cardClosed}`}>
            <CardDetails
              key={selectedRow[visibleHeaders[0]?.key] || Date.now()}
              rowData={selectedRow}
              headers={visibleHeaders}
              onClose={handleCardClose}
              onSave={handleCardSave}
              onDelete={handleCardDelete}
            />
          </div>
        )}
      </div>
      {!isMobile && (
        <div className={styles.cardDetailsContainer}>
          {selectedRow ? (
            <CardDetails
              key={selectedRow[visibleHeaders[0]?.key] || Date.now()}
              rowData={selectedRow}
              headers={visibleHeaders}
              onClose={handleCardClose}
              onSave={handleCardSave}
              onDelete={handleCardDelete}
            />
          ) : (
            <div className={styles.placeholder}>
              <p>Select a row to show its data</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SheetTemplate;