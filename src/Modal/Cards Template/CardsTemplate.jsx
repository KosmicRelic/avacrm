// src/Modal/CardsTemplate/CardsTemplate.jsx
import { useState, useContext, useCallback, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import styles from "./CardsTemplate.module.css";
import { MainContext } from "../../Contexts/MainContext";
import { ModalNavigatorContext } from "../../Contexts/ModalNavigator";
import { FaPlus, FaSearch } from "react-icons/fa";
import { IoIosCheckmark } from "react-icons/io";
import { BsDashCircle } from "react-icons/bs";

const CardsTemplate = ({ onSave }) => {
  const {
    headers,
    cardTemplates,
    setCardTemplates,
    isDarkTheme,
    tempData,
    setTempData,
    selectedTemplateIndex,
    setSelectedTemplateIndex,
    currentSectionIndex,
    setCurrentSectionIndex,
    editMode,
    setEditMode,
  } = useContext(MainContext);

  const { registerModalSteps, goToStep, currentStep, modalConfig, setModalConfig } =
    useContext(ModalNavigatorContext);

  const [draggedIndex, setDraggedIndex] = useState(null);
  const [draggedSectionIndex, setDraggedSectionIndex] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchTargetIndex, setTouchTargetIndex] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const keyRefs = useRef(new Map());
  const hasInitialized = useRef(false);

  const availableHeaders = headers.map((h) => ({
    key: h.key,
    name: h.name,
    type: h.type,
  }));

  const toggleEditMode = useCallback(() => {
    setEditMode((prev) => !prev);
  }, [setEditMode]);

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;

      const steps = [
        {
          title: () => "Card Templates",
          rightButton: null,
        },
        {
          title: ({ tempData, selectedTemplateIndex }) =>
            selectedTemplateIndex !== null && tempData && tempData[selectedTemplateIndex]
              ? tempData[selectedTemplateIndex].name || "New Template"
              : "New Template",
          rightButton: { label: editMode ? "Done" : "Edit", onClick: toggleEditMode },
        },
        {
          title: ({ tempData, selectedTemplateIndex, currentSectionIndex }) =>
            selectedTemplateIndex !== null &&
            currentSectionIndex !== null &&
            tempData &&
            tempData[selectedTemplateIndex]?.sections[currentSectionIndex]
              ? tempData[selectedTemplateIndex].sections[currentSectionIndex].name || "Section"
              : "Section",
          rightButton: null,
        },
      ];

      registerModalSteps({
        steps,
        args: { tempData, selectedTemplateIndex, currentSectionIndex, editMode },
      });

      setModalConfig({
        showTitle: true,
        showDoneButton: true,
        showBackButton: false,
        title: "Card Templates",
        backButtonTitle: "",
        rightButton: null,
      });

      // Initialize tempData if invalid or empty
      if (!Array.isArray(tempData) || !tempData.length) {
        const initialData = Array.isArray(cardTemplates)
          ? cardTemplates.map((t) => ({
              ...t,
              sections: Array.isArray(t.sections)
                ? t.sections.map((s) => ({
                    ...s,
                    name: s.name || s.title || "Unnamed Section",
                    keys: Array.isArray(s.keys) ? s.keys : [],
                  }))
                : [],
              isEditing: false,
              originalName: t.name || "",
              deleteTemplate: null,
            }))
          : [];
        setTempData(initialData);
      }
    }
  }, [
    registerModalSteps,
    setModalConfig,
    tempData,
    setTempData,
    cardTemplates,
    selectedTemplateIndex,
    currentSectionIndex,
    editMode,
    toggleEditMode,
  ]);

  useEffect(() => {
    if (!Array.isArray(tempData) || selectedTemplateIndex === null) return;

    setModalConfig((prev) => ({
      ...prev,
      title:
        currentStep === 1
          ? "Card Templates"
          : currentStep === 2 && tempData[selectedTemplateIndex]
          ? tempData[selectedTemplateIndex].name || "New Template"
          : currentStep === 3 &&
            tempData[selectedTemplateIndex]?.sections[currentSectionIndex]
          ? tempData[selectedTemplateIndex].sections[currentSectionIndex].name || "Section"
          : prev.title,
      rightButton:
        currentStep === 2
          ? { label: editMode ? "Done" : "Edit", onClick: toggleEditMode }
          : null,
    }));
  }, [currentStep, selectedTemplateIndex, currentSectionIndex, tempData, editMode, setModalConfig, toggleEditMode]);

  const handleDragStart = useCallback((e, sectionIndex, index) => {
    setDraggedIndex(index);
    setDraggedSectionIndex(sectionIndex);
    e.dataTransfer.effectAllowed = "move";
    const element = keyRefs.current.get(`${sectionIndex}-${index}`);
    if (element) element.classList.add(styles.dragging);
  }, []);

  const handleTouchStart = useCallback((e, sectionIndex, index) => {
    if (e.target.classList.contains(styles.dragIcon)) {
      e.preventDefault();
      setDraggedIndex(index);
      setDraggedSectionIndex(sectionIndex);
      setTouchStartY(e.touches[0].clientY);
      setTouchTargetIndex(index);
      const element = keyRefs.current.get(`${sectionIndex}-${index}`);
      if (element) element.classList.add(styles.dragging);
    }
  }, []);

  const handleDragOver = useCallback(
    (e, sectionIndex, index) => {
      e.preventDefault();
      if (draggedIndex === null || draggedSectionIndex !== sectionIndex || draggedIndex === index) return;

      setTempData((prev) => {
        const newTemp = [...prev];
        const currentTemplate = { ...newTemp[selectedTemplateIndex] };
        const newSections = [...currentTemplate.sections];
        const sectionKeys = [...newSections[sectionIndex].keys];
        const [draggedItem] = sectionKeys.splice(draggedIndex, 1);
        sectionKeys.splice(index, 0, draggedItem);
        newSections[sectionIndex] = { ...newSections[sectionIndex], keys: sectionKeys };
        currentTemplate.sections = newSections;
        newTemp[selectedTemplateIndex] = currentTemplate;
        return newTemp;
      });
      setTimeout(() => setDraggedIndex(index), 0);
    },
    [draggedIndex, draggedSectionIndex, selectedTemplateIndex, setTempData]
  );

  const handleTouchMove = useCallback(
    (e, sectionIndex, index) => {
      if (draggedIndex === null || touchStartY === null || draggedSectionIndex !== sectionIndex) return;
      e.preventDefault();

      const touchY = e.touches[0].clientY;
      const itemHeight = 36;
      const delta = Math.round((touchY - touchStartY) / itemHeight);
      const newIndex = Math.max(
        0,
        Math.min(touchTargetIndex + delta, tempData[selectedTemplateIndex].sections[sectionIndex].keys.length - 1)
      );

      if (newIndex !== draggedIndex) {
        setTempData((prev) => {
          const newTemp = [...prev];
          const currentTemplate = { ...newTemp[selectedTemplateIndex] };
          const newSections = [...currentTemplate.sections];
          const sectionKeys = [...newSections[sectionIndex].keys];
          const [draggedItem] = sectionKeys.splice(draggedIndex, 1);
          sectionKeys.splice(newIndex, 0, draggedItem);
          newSections[sectionIndex] = { ...newSections[sectionIndex], keys: sectionKeys };
          currentTemplate.sections = newSections;
          newTemp[selectedTemplateIndex] = currentTemplate;
          return newTemp;
        });
        setTimeout(() => setDraggedIndex(newIndex), 0);
      }
    },
    [draggedIndex, touchStartY, touchTargetIndex, selectedTemplateIndex, tempData, setTempData]
  );

  const handleDragEnd = useCallback(() => {
    const element = keyRefs.current.get(`${draggedSectionIndex}-${draggedIndex}`);
    if (element) element.classList.remove(styles.dragging);
    setDraggedIndex(null);
    setDraggedSectionIndex(null);
  }, [draggedIndex, draggedSectionIndex]);

  const handleTouchEnd = useCallback(() => {
    const element = keyRefs.current.get(`${draggedSectionIndex}-${draggedIndex}`);
    if (element) element.classList.remove(styles.dragging);
    setDraggedIndex(null);
    setDraggedSectionIndex(null);
    setTouchStartY(null);
    setTouchTargetIndex(null);
  }, [draggedIndex, draggedSectionIndex]);

  useEffect(() => {
    const cleanupDrag = () => draggedIndex !== null && handleDragEnd();
    const cleanupTouch = () => draggedIndex !== null && handleTouchEnd();
    window.addEventListener("dragend", cleanupDrag);
    window.addEventListener("pointerup", cleanupDrag);
    window.addEventListener("touchend", cleanupTouch);
    return () => {
      window.removeEventListener("dragend", cleanupDrag);
      window.removeEventListener("pointerup", cleanupDrag);
      window.removeEventListener("touchend", cleanupTouch);
    };
  }, [handleDragEnd, handleTouchEnd]);

  const handleOpenEditor = useCallback(
    (template = null) => {
      if (template) {
        const existingIndex = tempData.findIndex((t) => t.name === template.name && t.originalName === template.originalName);
        if (existingIndex >= 0) {
          setSelectedTemplateIndex(existingIndex);
          setTimeout(() => {
            goToStep(2, { tempData, selectedTemplateIndex: existingIndex, editMode });
          }, 0);
          return;
        }
      }

      // Create new template
      const newTemplate = {
        name: "",
        typeOfCards: "",
        sections: [],
        isEditing: true,
        originalName: null,
        deleteTemplate: null,
      };

      setTempData((prev) => {
        const newTemp = [...prev, newTemplate];
        const newIndex = newTemp.length - 1;
        setSelectedTemplateIndex(newIndex);
        setTimeout(() => {
          goToStep(2, { tempData: newTemp, selectedTemplateIndex: newIndex, editMode });
        }, 0);
        return newTemp;
      });
    },
    [setTempData, setSelectedTemplateIndex, goToStep, tempData, editMode]
  );

  const addSection = useCallback(() => {
    setTempData((prev) => {
      const newTemp = [...prev];
      const currentTemplate = { ...newTemp[selectedTemplateIndex] };
      const newSectionName = `Section ${currentTemplate.sections.length + 1}`;
      if (
        currentTemplate.sections.some(
          (s) => s && s.name && s.name.toLowerCase() === newSectionName.toLowerCase()
        )
      ) {
        alert(`Section name "${newSectionName}" already exists. Please use a unique name.`);
        return prev;
      }
      currentTemplate.sections = [
        ...currentTemplate.sections,
        { name: newSectionName, keys: [] },
      ];
      newTemp[selectedTemplateIndex] = currentTemplate;
      return newTemp;
    });
  }, [selectedTemplateIndex, setTempData]);

  const updateSectionName = useCallback(
    (index, newName) => {
      setTempData((prev) => {
        const newTemp = [...prev];
        const currentTemplate = { ...newTemp[selectedTemplateIndex] };
        if (
          currentTemplate.sections.some(
            (s, i) => i !== index && s && s.name && s.name.toLowerCase() === newName.toLowerCase()
          )
        ) {
          alert(`Section name "${newName}" already exists. Please use a unique name.`);
          return prev;
        }
        newTemp[selectedTemplateIndex].sections[index].name = newName;
        return newTemp;
      });
    },
    [selectedTemplateIndex, setTempData]
  );

  const removeSection = useCallback(
    (index) => {
      const sectionName = tempData[selectedTemplateIndex].sections[index].name;
      if (window.confirm(`Are you sure you want to delete the "${sectionName}" section?`)) {
        setTempData((prev) => {
          const newTemp = [...prev];
          const currentTemplate = { ...newTemp[selectedTemplateIndex] };
          currentTemplate.sections = currentTemplate.sections.filter((_, i) => i !== index);
          newTemp[selectedTemplateIndex] = currentTemplate;
          return newTemp;
        });
      }
    },
    [selectedTemplateIndex, tempData, setTempData]
  );

  const handleEditSection = useCallback(
    (index) => {
      setCurrentSectionIndex(index);
      goToStep(3, { tempData, selectedTemplateIndex, currentSectionIndex: index, editMode });
    },
    [setCurrentSectionIndex, goToStep, tempData, selectedTemplateIndex, editMode]
  );

  const toggleKeySelection = useCallback(
    (sectionIndex, key) => {
      setTempData((prev) => {
        const newTemp = [...prev];
        const currentTemplate = { ...newTemp[selectedTemplateIndex] };
        const newSections = [...currentTemplate.sections];
        const section = { ...newSections[sectionIndex] };
        const isSelected = section.keys.includes(key);
        section.keys = isSelected ? section.keys.filter((k) => k !== key) : [...section.keys, key];
        newSections[sectionIndex] = section;
        currentTemplate.sections = newSections;
        newTemp[selectedTemplateIndex] = currentTemplate;
        return newTemp;
      });
    },
    [selectedTemplateIndex, setTempData]
  );

  const handleDeleteKey = useCallback(
    (sectionIndex, key) => {
      if (window.confirm(`Are you sure you want to delete "${key}" from this section?`)) {
        setTempData((prev) => {
          const newTemp = [...prev];
          const currentTemplate = { ...newTemp[selectedTemplateIndex] };
          const newSections = [...currentTemplate.sections];
          newSections[sectionIndex].keys = newSections[sectionIndex].keys.filter((k) => k !== key);
          currentTemplate.sections = newSections;
          newTemp[selectedTemplateIndex] = currentTemplate;
          return newTemp;
        });
      }
    },
    [selectedTemplateIndex, setTempData]
  );

  const getUsedKeysInOtherSections = useCallback(() => {
    if (selectedTemplateIndex === null || currentSectionIndex === null) return [];
    const currentTemplate = tempData[selectedTemplateIndex];
    return currentTemplate.sections
      .filter((_, i) => i !== currentSectionIndex)
      .flatMap((section) => section.keys);
  }, [tempData, selectedTemplateIndex, currentSectionIndex]);

  const filteredHeaders = availableHeaders.filter((header) => {
    const usedKeysInOtherSections = getUsedKeysInOtherSections();
    return (
      !tempData[selectedTemplateIndex]?.sections[currentSectionIndex]?.keys.includes(header.key) &&
      !usedKeysInOtherSections.includes(header.key) &&
      [header.name, header.type, header.key].some((field) =>
        field.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  });

  const handleDeleteTemplate = useCallback(() => {
    if (selectedTemplateIndex === null) return;
    const templateName = tempData[selectedTemplateIndex].originalName || tempData[selectedTemplateIndex].name;
    if (window.confirm(`Are you sure you want to delete the "${templateName}" template?`)) {
      setTempData((prev) => {
        const newTemp = prev.filter((_, i) => i !== selectedTemplateIndex);
        return newTemp;
      });
      setSelectedTemplateIndex(null);
      goToStep(1, { tempData, editMode });
    }
  }, [selectedTemplateIndex, tempData, setTempData, setSelectedTemplateIndex, goToStep, editMode]);

  useEffect(() => {
    return () => {
      if (currentStep === 1 && Array.isArray(tempData) && tempData !== cardTemplates) {
        setCardTemplates(tempData);
        if (onSave) onSave();
      }
    };
  }, [tempData, cardTemplates, setCardTemplates, onSave, currentStep]);

  return (
    <div className={`${styles.templateWrapper} ${isDarkTheme ? styles.darkTheme : ""}`}>
      <div className={styles.viewContainer}>
        {[1, 2, 3].map((step) => (
          <div
            key={step}
            className={`${styles.view} ${isDarkTheme ? styles.darkTheme : ""} ${
              step !== currentStep ? styles.hidden : ""
            }`}
            style={{
              display: step !== currentStep ? "none" : "block",
            }}
          >
            {step === 1 && (
              <>
                <button
                  className={`${styles.addButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                  onClick={() => handleOpenEditor()}
                >
                  <FaPlus /> Add New Card Template
                </button>
                <div className={styles.templateList}>
                  {Array.isArray(tempData) ? (
                    tempData.map((template, index) => (
                      <button
                        key={index}
                        className={`${styles.templateButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                        onClick={() => handleOpenEditor(template)}
                      >
                        {template.name || "Unnamed Template"}
                      </button>
                    ))
                  ) : (
                    <div>No templates available</div>
                  )}
                </div>
              </>
            )}

            {step === 2 && selectedTemplateIndex !== null && Array.isArray(tempData) && tempData[selectedTemplateIndex] && (
              <>
                <input
                  type="text"
                  value={tempData[selectedTemplateIndex].name || ""}
                  onChange={(e) => {
                    setTempData((prev) => {
                      const newTemp = [...prev];
                      newTemp[selectedTemplateIndex] = {
                        ...newTemp[selectedTemplateIndex],
                        name: e.target.value,
                        typeOfCards: e.target.value,
                      };
                      return newTemp;
                    });
                  }}
                  placeholder="Template Name"
                  className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ""}`}
                />
                <h3 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>
                  Sections
                </h3>
                <div className={styles.templateList}>
                  {tempData[selectedTemplateIndex].sections.map((section, index) => (
                    <div className={styles.sectionItem} key={index}>
                      {editMode && (
                        <button
                          className={`${styles.removeButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                          onClick={() => removeSection(index)}
                        >
                          <BsDashCircle />
                        </button>
                      )}
                      <button
                        className={`${styles.templateButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                        onClick={() => !editMode && handleEditSection(index)}
                      >
                        {section.name}
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  className={`${styles.addSectionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                  onClick={addSection}
                >
                  Add Section
                </button>
                {editMode && (
                  <button
                    className={`${styles.deleteButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                    onClick={handleDeleteTemplate}
                  >
                    Delete Template
                  </button>
                )}
              </>
            )}

            {step === 3 &&
              selectedTemplateIndex !== null &&
              currentSectionIndex !== null &&
              Array.isArray(tempData) &&
              tempData[selectedTemplateIndex]?.sections[currentSectionIndex] && (
              <>
                <input
                  type="text"
                  value={tempData[selectedTemplateIndex].sections[currentSectionIndex].name || ""}
                  onChange={(e) => updateSectionName(currentSectionIndex, e.target.value)}
                  className={`${styles.sectionInput} ${isDarkTheme ? styles.darkTheme : ""}`}
                  placeholder="Section Name"
                />
                <div className={styles.searchContainer}>
                  <FaSearch className={styles.searchIcon} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search headers by name, type, or key"
                    className={`${styles.searchInput} ${isDarkTheme ? styles.darkTheme : ""}`}
                  />
                </div>
                <div className={styles.section}>
                  {tempData[selectedTemplateIndex].sections[currentSectionIndex].keys.map((key, index) => {
                    const header = availableHeaders.find((h) => h.key === key) || {
                      key,
                      name: key,
                      type: "text",
                    };
                    return (
                      <div
                        ref={(el) => keyRefs.current.set(`${currentSectionIndex}-${index}`, el)}
                        key={index}
                        className={`${styles.keyItem} ${
                          draggedIndex === index && draggedSectionIndex === currentSectionIndex ? styles.dragging : ""
                        } ${isDarkTheme ? styles.darkTheme : ""}`}
                        draggable={!editMode}
                        onDragStart={(e) => !editMode && handleDragStart(e, currentSectionIndex, index)}
                        onDragOver={(e) => !editMode && handleDragOver(e, currentSectionIndex, index)}
                        onDragEnd={() => !editMode && handleDragEnd()}
                        onTouchStart={(e) => !editMode && handleTouchStart(e, currentSectionIndex, index)}
                        onTouchMove={(e) => !editMode && handleTouchMove(e, currentSectionIndex, index)}
                        onTouchEnd={() => !editMode && handleTouchEnd()}
                      >
                        {editMode && (
                          <button
                            className={`${styles.removeButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                            onClick={() => handleDeleteKey(currentSectionIndex, header.key)}
                          >
                            <BsDashCircle />
                          </button>
                        )}
                        <div
                          className={styles.headerContent}
                          onClick={() => !editMode && toggleKeySelection(currentSectionIndex, header.key)}
                        >
                          <span
                            className={`${styles.customCheckbox} ${
                              tempData[selectedTemplateIndex].sections[currentSectionIndex].keys.includes(header.key)
                                ? styles.checked
                                : ""
                            } ${isDarkTheme ? styles.darkTheme : ""}`}
                          >
                            <IoIosCheckmark
                              style={{
                                color: tempData[selectedTemplateIndex].sections[currentSectionIndex].keys.includes(header.key)
                                  ? "#ffffff"
                                  : "transparent",
                              }}
                              size={18}
                            />
                          </span>
                          <span className={styles.headerName}>{header.name}</span>
                          <span className={styles.headerType}>({header.type})</span>
                        </div>
                        {!editMode && (
                          <span className={`${styles.dragIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>☰</span>
                        )}
                      </div>
                    );
                  })}
                  {filteredHeaders.map((header, index) => (
                    <div key={index} className={`${styles.keyItem} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      <div
                        className={styles.headerContent}
                        onClick={() => !editMode && toggleKeySelection(currentSectionIndex, header.key)}
                      >
                        <span
                          className={`${styles.customCheckbox} ${
                            tempData[selectedTemplateIndex].sections[currentSectionIndex].keys.includes(header.key)
                              ? styles.checked
                              : ""
                          } ${isDarkTheme ? styles.darkTheme : ""}`}
                        >
                          <IoIosCheckmark
                            style={{
                              color: tempData[selectedTemplateIndex].sections[currentSectionIndex].keys.includes(header.key)
                                ? "#ffffff"
                                : "transparent",
                            }}
                            size={18}
                          />
                        </span>
                        <span className={styles.headerName}>{header.name}</span>
                        <span className={styles.headerType}>({header.type})</span>
                      </div>
                      {!editMode && (
                        <span className={`${styles.dragIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>☰</span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

CardsTemplate.propTypes = {
  onSave: PropTypes.func,
};

export default CardsTemplate;