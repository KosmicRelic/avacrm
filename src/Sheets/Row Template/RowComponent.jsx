// RowComponent.js
import React, { useContext, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import styles from './RowComponent.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { FaRegCircle, FaRegCheckCircle } from 'react-icons/fa';
import { formatFirestoreTimestamp } from '../../Utils/firestoreUtils';

const RowComponent = ({ rowData, headers, onClick, isSelected, onAddRow, isSelectMode, onSelect, getTeamMemberName, onInlineSave, teamMembers }) => {
  const isAddNew = rowData.isAddNew;
  const { isDarkTheme, user, businessId } = useContext(MainContext);
  const isBusinessUser = user && user.uid === businessId;
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const dropdownMenuRef = useRef(null);

  // Helper function to render dropdown menu via portal
  const renderDropdownPortal = (dropdownContent) => {
    if (!isDropdownOpen) return null;
    
    return createPortal(
      <div 
        ref={dropdownMenuRef}
        className={`${styles.dropdownMenu} ${isDarkTheme ? styles.darkTheme : ''}`}
        style={{
          position: 'fixed',
          top: dropdownPosition.top,
          left: dropdownPosition.left,
          width: dropdownPosition.width || 150,
          zIndex: 99999
        }}
        onClick={(e) => e.stopPropagation()} // Prevent clicks from bubbling up
        onMouseDown={(e) => e.preventDefault()} // Prevent losing focus
      >
        {dropdownContent}
      </div>,
      document.body
    );
  };

  // Helper function to determine if a field is read-only
  const isFieldReadOnly = (fieldKey) => {
    const readOnlyFields = ['typeOfProfile', 'typeOfRecords', 'docId', 'linkId'];
    return readOnlyFields.includes(fieldKey);
  };

  // Helper function to get field type from header
  const getFieldType = (header) => {
    if (header.key === 'assignedTo') return 'assignedTo'; // Special case
    return header.type || 'text';
  };

  // Helper function to format date for input
  const formatDateForInput = (dateValue) => {
    if (!dateValue) return '';
    
    let date;
    if (typeof dateValue === 'object' && dateValue.seconds) {
      // Firestore Timestamp
      date = new Date(dateValue.seconds * 1000);
    } else if (typeof dateValue === 'object' && typeof dateValue.toDate === 'function') {
      // Firestore Timestamp with toDate method
      date = dateValue.toDate();
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'string') {
      date = new Date(dateValue);
    } else {
      return '';
    }
    
    if (isNaN(date.getTime())) return '';
    
    // Format as YYYY-MM-DD for date input
    return date.toISOString().split('T')[0];
  };

  const handleEditSave = useCallback(() => {
    if (editingCell && onInlineSave) {
      const header = headers.find(h => h.key === editingCell);
      let processedValue = editValue;
      
      // Process value based on field type
      if (header) {
        const fieldType = getFieldType(header);
        
        if (fieldType === 'multi-select') {
          // Convert comma-separated string to array
          if (typeof editValue === 'string') {
            processedValue = editValue.split(',').map(v => v.trim()).filter(v => v);
          } else if (Array.isArray(editValue)) {
            processedValue = editValue;
          } else {
            processedValue = [];
          }
        } else if (fieldType === 'number') {
          // Convert to number if it's a number field
          const numValue = parseFloat(editValue);
          processedValue = isNaN(numValue) ? '' : numValue;
        } else if (fieldType === 'date') {
          // Convert date string to appropriate format
          if (editValue) {
            processedValue = new Date(editValue);
            if (isNaN(processedValue.getTime())) {
              processedValue = editValue; // Keep original if invalid
            }
          } else {
            processedValue = '';
          }
        }
      }
      
      const updatedRowData = { ...rowData, [editingCell]: processedValue };
      onInlineSave(updatedRowData);
    }
    setEditingCell(null);
    setEditValue('');
    setIsDropdownOpen(false);
  }, [editingCell, editValue, headers, onInlineSave, rowData]);

  const handleEditCancel = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
    setIsDropdownOpen(false);
  }, []);

  // Calculate dropdown position for fixed positioning
  const calculateDropdownPosition = useCallback(() => {
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is outside both the dropdown trigger and the dropdown menu
      const isClickOutsideTrigger = dropdownRef.current && !dropdownRef.current.contains(event.target);
      const isClickOutsideMenu = dropdownMenuRef.current && !dropdownMenuRef.current.contains(event.target);
      
      if (isClickOutsideTrigger && isClickOutsideMenu && editingCell) {
        setIsDropdownOpen(false);
        handleEditSave();
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && editingCell) {
        setIsDropdownOpen(false);
        handleEditCancel();
      }
    };

    if (editingCell) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [editingCell, handleEditSave, handleEditCancel]);

  // Calculate dropdown position when editing starts
  useEffect(() => {
    if (editingCell && dropdownRef.current) {
      // Small delay to ensure the input is rendered
      const timer = setTimeout(() => {
        calculateDropdownPosition();
      }, 10);
      
      // Recalculate on window resize
      const handleResize = () => {
        calculateDropdownPosition();
      };
      
      window.addEventListener('resize', handleResize);
      
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [editingCell, calculateDropdownPosition]);

  const handleClick = () => {
    if (isAddNew && onAddRow) {
      onAddRow();
    } else if (onClick) {
      onClick(rowData);
    }
  };

  const handleSelectClick = (e) => {
    e.stopPropagation();
    if (!isAddNew) {
      onSelect(rowData);
    } else {
      onSelect();
    }
  };

  const handleCellClick = (e, headerKey, currentValue, rawValue, header) => {
    // If row is selected (not in select mode), clicking a cell should edit that cell
    if (!isSelectMode && isSelected && !isFieldReadOnly(headerKey)) {
      e.stopPropagation();
      setEditingCell(headerKey);
      
      // Initialize editValue based on field type
      const fieldType = getFieldType(header);
      if (fieldType === 'multi-select' && Array.isArray(rawValue)) {
        setEditValue(rawValue.join(', '));
      } else if (fieldType === 'date') {
        setEditValue(formatDateForInput(rawValue));
      } else {
        setEditValue(rawValue || '');
      }
      
      // Calculate dropdown position for multi-select fields
      if (fieldType === 'multi-select' || fieldType === 'dropdown' || fieldType === 'assignedTo') {
        setTimeout(() => {
          calculateDropdownPosition();
          setIsDropdownOpen(true);
        }, 10);
      }
      return;
    }
    // Only prevent row click when clicking on cells if in select mode
    // Allow row click for selection when not in select mode
    if (isSelectMode) {
      e.stopPropagation();
    }
  };

  const handleCellDoubleClick = (e, headerKey, currentValue, rawValue, header) => {
    // Prevent row click when double-clicking on cells
    e.stopPropagation();
    if (isAddNew || isFieldReadOnly(headerKey)) return;
    
    setEditingCell(headerKey);
    
    // Initialize editValue based on field type
    const fieldType = getFieldType(header);
    if (fieldType === 'multi-select' && Array.isArray(rawValue)) {
      setEditValue(rawValue.join(', '));
    } else if (fieldType === 'date') {
      setEditValue(formatDateForInput(rawValue));
    } else {
      setEditValue(rawValue || '');
    }
    
    // Calculate dropdown position for multi-select fields
    if (fieldType === 'multi-select' || fieldType === 'dropdown' || fieldType === 'assignedTo') {
      setTimeout(() => {
        calculateDropdownPosition();
        setIsDropdownOpen(true);
      }, 10);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleEditSave();
    } else if (e.key === 'Escape') {
      handleEditCancel();
    }
  };

  // Render appropriate editor based on field type
  const renderCellEditor = (header) => {
    const fieldType = getFieldType(header);
    
    switch (fieldType) {
      case 'assignedTo':
        return (
          <div ref={dropdownRef} className={`${styles.dropdownContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
            <div
              className={`${styles.dropdownDisplay} ${styles.editInput} ${isDarkTheme ? styles.darkTheme : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!isDropdownOpen) {
                  calculateDropdownPosition();
                  setIsDropdownOpen(true);
                }
              }}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (!isDropdownOpen) {
                    calculateDropdownPosition();
                    setIsDropdownOpen(true);
                  }
                }
                handleKeyDown(e);
              }}
              autoFocus
            >
              {editValue ? (isBusinessUser 
                ? teamMembers?.find(tm => tm.uid === editValue)?.name && teamMembers?.find(tm => tm.uid === editValue)?.surname 
                  ? `${teamMembers.find(tm => tm.uid === editValue).name} ${teamMembers.find(tm => tm.uid === editValue).surname}`
                  : teamMembers?.find(tm => tm.uid === editValue)?.email || editValue
                : user?.name && user?.surname ? `${user.name} ${user.surname}` : user?.email || editValue
              ) : 'Unassigned'}
              <span className={styles.dropdownArrow}>▼</span>
            </div>
            {renderDropdownPortal(
              isDropdownOpen && (isBusinessUser ? teamMembers && teamMembers.length > 0 : user) && (
                <div className={styles.assignedToMenu}>
                  <div
                    className={`${styles.dropdownOption} ${editValue === '' ? styles.selected : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                    onClick={() => {
                      setEditValue('');
                    }}
                  >
                    Unassigned
                  </div>
                  {isBusinessUser
                    ? teamMembers?.map(tm => (
                        <div
                          key={tm.uid}
                          className={`${styles.dropdownOption} ${editValue === tm.uid ? styles.selected : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                          onClick={() => {
                            setEditValue(tm.uid);
                          }}
                        >
                          {tm.name && tm.surname ? `${tm.name} ${tm.surname}` : tm.email || tm.uid}
                        </div>
                      ))
                    : user && (
                        <div
                          key={user.uid}
                          className={`${styles.dropdownOption} ${editValue === user.uid ? styles.selected : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                          onClick={() => {
                            setEditValue(user.uid);
                          }}
                        >
                          {user.name && user.surname ? `${user.name} ${user.surname}` : user.email || user.uid}
                        </div>
                      )
                  }
                  <div className={styles.multiSelectButtons}>
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        handleEditSave();
                      }}
                      className={`${styles.multiSelectButton} ${styles.save} ${isDarkTheme ? styles.darkTheme : ''}`}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        handleEditCancel();
                      }}
                      className={`${styles.multiSelectButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        );
      
      case 'dropdown':
        return (
          <div ref={dropdownRef} className={`${styles.dropdownContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
            <div
              className={`${styles.dropdownDisplay} ${styles.editInput} ${isDarkTheme ? styles.darkTheme : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!isDropdownOpen) {
                  calculateDropdownPosition();
                  setIsDropdownOpen(true);
                }
              }}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (!isDropdownOpen) {
                    calculateDropdownPosition();
                    setIsDropdownOpen(true);
                  }
                }
                handleKeyDown(e);
              }}
              autoFocus
            >
              {editValue || `Select ${header.name}`}
              <span className={styles.dropdownArrow}>▼</span>
            </div>
            {renderDropdownPortal(
              isDropdownOpen && header.options && header.options.length > 0 && (
                <div className={styles.singleSelectMenu}>
                  <div
                    className={`${styles.dropdownOption} ${editValue === '' ? styles.selected : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                    onClick={() => {
                      setEditValue('');
                    }}
                  >
                    Select {header.name}
                  </div>
                  {header.options?.map((option) => (
                    <div
                      key={option}
                      className={`${styles.dropdownOption} ${editValue === option ? styles.selected : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                      onClick={() => {
                        setEditValue(option);
                      }}
                    >
                      {option}
                    </div>
                  ))}
                  <div className={styles.multiSelectButtons}>
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        handleEditSave();
                      }}
                      className={`${styles.multiSelectButton} ${styles.save} ${isDarkTheme ? styles.darkTheme : ''}`}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        handleEditCancel();
                      }}
                      className={`${styles.multiSelectButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        );
      
      case 'multi-select':
        return (
          <div ref={dropdownRef} className={`${styles.dropdownContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
            <div
              className={`${styles.dropdownDisplay} ${styles.editInput} ${isDarkTheme ? styles.darkTheme : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!isDropdownOpen) {
                  calculateDropdownPosition();
                  setIsDropdownOpen(true);
                }
              }}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (!isDropdownOpen) {
                    calculateDropdownPosition();
                    setIsDropdownOpen(true);
                  }
                }
                handleKeyDown(e);
              }}
              autoFocus
            >
              {Array.isArray(editValue) && editValue.length > 0 
                ? editValue.join(', ')
                : typeof editValue === 'string' && editValue 
                  ? editValue 
                  : `Select ${header.name}`
              }
              <span className={styles.dropdownArrow}>▼</span>
            </div>
            {renderDropdownPortal(
              isDropdownOpen && header.options && header.options.length > 0 && (
                <div className={styles.multiSelectMenu}>
                  {header.options.map((option) => {
                    const currentValues = Array.isArray(editValue) 
                      ? editValue 
                      : (typeof editValue === 'string' ? editValue.split(',').map(v => v.trim()).filter(v => v) : []);
                    const isSelected = currentValues.includes(option);
                    
                    return (
                      <label key={option} className={`${styles.multiSelectOption} ${isDarkTheme ? styles.darkTheme : ''}`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            let newValues = [...currentValues];
                            if (e.target.checked) {
                              if (!newValues.includes(option)) {
                                newValues.push(option);
                              }
                            } else {
                              newValues = newValues.filter(v => v !== option);
                            }
                            setEditValue(newValues);
                          }}
                          className={styles.multiSelectCheckbox}
                        />
                        <span>{option}</span>
                      </label>
                    );
                  })}
                  <div className={styles.multiSelectButtons}>
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        handleEditSave();
                      }}
                      className={`${styles.multiSelectButton} ${styles.save} ${isDarkTheme ? styles.darkTheme : ''}`}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        handleEditCancel();
                      }}
                      className={`${styles.multiSelectButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        );
      
      case 'date':
        // For date fields, use a date input
        return (
          <input
            ref={dropdownRef}
            type="date"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleEditSave}
            onKeyDown={handleKeyDown}
            className={`${styles.editInput} ${isDarkTheme ? styles.darkTheme : ''}`}
            autoFocus
          />
        );
      
      case 'number':
        return (
          <input
            ref={dropdownRef}
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleEditSave}
            onKeyDown={handleKeyDown}
            className={`${styles.editInput} ${isDarkTheme ? styles.darkTheme : ''}`}
            autoFocus
          />
        );
      
      default:
        return (
          <input
            ref={dropdownRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleEditSave}
            onKeyDown={handleKeyDown}
            className={`${styles.editInput} ${isDarkTheme ? styles.darkTheme : ''}`}
            autoFocus
          />
        );
    }
  };

  return (
    <div
      className={`${styles.bodyRow} ${isAddNew ? styles.addNewRow : ''} ${
        isSelected ? styles.selectedRow : ''
      } ${isDarkTheme ? styles.darkTheme : ''}`}
      onClick={handleClick}
    >
      {/* Only show select button for business user */}
      {!isAddNew && isSelectMode && isBusinessUser && (
        <div
          className={`${styles.bodyCell} ${styles.selectCell} ${styles.selectMode} ${
            isDarkTheme ? styles.darkTheme : ''
          }`}
          onClick={handleCellClick}
        >
          <div
            className={`${styles.selectIcon} ${isSelected ? styles.selected : ''} ${
              isDarkTheme ? styles.darkTheme : ''
            }`}
            onClick={handleSelectClick}
          >
            {isSelected ? <FaRegCheckCircle size={18} /> : <FaRegCircle size={18} />}
          </div>
        </div>
      )}
      {isAddNew ? (
        <>
          <div
            className={`${styles.bodyCell} ${styles.addCell} ${isDarkTheme ? styles.darkTheme : ''}`}
            onClick={handleCellClick}
          >
            {/* Only show select button for business user in add new row */}
            {isBusinessUser && (
              <button
                className={`${styles.selectButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                onClick={handleSelectClick}
              >
                Select
              </button>
            )}
          </div>
          <div
            className={`${styles.bodyCell} ${isDarkTheme ? styles.darkTheme : ''}`}
            onClick={handleCellClick}
          >
            + Add
          </div>
          {headers.slice(2).map((header, i) => (
            <div
              key={i}
              className={`${styles.bodyCell} ${isDarkTheme ? styles.darkTheme : ''}`}
              onClick={handleCellClick}
            ></div>
          ))}
        </>
      ) : (
        headers.map((header, i) => {
          const value = rowData[header.key];
          let displayValue;
          if (header.key === 'assignedTo' && typeof getTeamMemberName === 'function') {
            displayValue = getTeamMemberName(value);
          } else if (value && typeof value === 'object' && ('seconds' in value || 'toDate' in value)) {
            // Format any Firestore Timestamp or Timestamp-like object as dd/mm/yyyy
            displayValue = formatFirestoreTimestamp(value);
          } else if (header.type === 'multi-select' && Array.isArray(value)) {
            displayValue = value.join(', ');
          } else {
            displayValue = value !== undefined ? String(value) : '';
          }
          return (
            <div
              key={i}
              className={`${styles.bodyCell} ${isDarkTheme ? styles.darkTheme : ''} ${
                isFieldReadOnly(header.key) ? styles.readOnlyCell : ''
              }`}
              onClick={(e) => handleCellClick(e, header.key, displayValue, value, header)}
              onDoubleClick={(e) => handleCellDoubleClick(e, header.key, displayValue, value, header)}
              title={isFieldReadOnly(header.key) ? 'This field is read-only' : ''}
            >
              {editingCell === header.key ? (
                renderCellEditor(header)
              ) : (
                displayValue
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

RowComponent.propTypes = {
  rowData: PropTypes.shape({
    isAddNew: PropTypes.bool,
    docId: PropTypes.string,
  }).isRequired,
  headers: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      type: PropTypes.string,
      visible: PropTypes.bool,
      options: PropTypes.arrayOf(PropTypes.string),
    })
  ).isRequired,
  onClick: PropTypes.func,
  isSelected: PropTypes.bool,
  onAddRow: PropTypes.func,
  isSelectMode: PropTypes.bool,
  onSelect: PropTypes.func,
  getTeamMemberName: PropTypes.func,
  onInlineSave: PropTypes.func,
  teamMembers: PropTypes.arrayOf(
    PropTypes.shape({
      uid: PropTypes.string.isRequired,
      name: PropTypes.string,
      surname: PropTypes.string,
      email: PropTypes.string,
    })
  ),
};

RowComponent.defaultProps = {
  isSelected: false,
  isSelectMode: false,
};

export default RowComponent;