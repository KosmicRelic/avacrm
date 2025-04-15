import { useState, useContext, useCallback, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import styles from "./CardsTemplate.module.css";
import { MainContext } from "../../Contexts/MainContext";
import { ModalNavigatorContext } from "../../Contexts/ModalNavigator";
import { FaPlus, FaSearch, FaRegCircle, FaRegCheckCircle } from "react-icons/fa";
import { IoChevronForward } from "react-icons/io5";
import { BsDashCircle } from "react-icons/bs";

const CardsTemplate = ({ tempData, setTempData }) => {
  const { cardTemplates, headers, isDarkTheme } = useContext(MainContext);
  const { registerModalSteps, goToStep, currentStep, setModalConfig } = useContext(ModalNavigatorContext);

  const [currentCardTemplates, setCurrentCardTemplates] = useState(() =>
    (tempData.currentCardTemplates || cardTemplates).map((t) => ({ ...t, sections: t.sections.map((s) => ({ ...s })) }))
  );
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [draggedSectionIndex, setDraggedSectionIndex] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchTargetIndex, setTouchTargetIndex] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [newTemplateName, setNewTemplateName] = useState("");
  const keyRefs = useRef(new Map());
  const inputRefs = useRef(new Map());
  const hasInitialized = useRef(false);
  const prevCardTemplatesRef = useRef(currentCardTemplates);

  // Sync currentCardTemplates to tempData
  useEffect(() => {
    const templatesChanged = JSON.stringify(currentCardTemplates) !== JSON.stringify(prevCardTemplatesRef.current);
    if (templatesChanged) {
      setTempData({ currentCardTemplates });
      prevCardTemplatesRef.current = currentCardTemplates;
    }
  }, [currentCardTemplates, setTempData]);

  // Initialize modal steps
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      const steps = [
        {
          title: "Card Templates",
          rightButton: null,
        },
        {
          title: () =>
            selectedTemplateIndex !== null && currentCardTemplates[selectedTemplateIndex]
              ? currentCardTemplates[selectedTemplateIndex].name || "New Template"
              : "New Template",
          rightButton: null,
        },
        {
          title: () =>
            selectedTemplateIndex !== null &&
            currentSectionIndex !== null &&
            currentCardTemplates[selectedTemplateIndex]?.sections[currentSectionIndex]
              ? currentCardTemplates[selectedTemplateIndex].sections[currentSectionIndex].name || "Section"
              : "Section",
          rightButton: null,
        },
      ];

      registerModalSteps({ steps });
      setModalConfig({
        showTitle: true,
        showDoneButton: true,
        showBackButton: false,
        title: "Card Templates",
        rightButton: null,
        leftButton: null,
      });
    }
  }, [registerModalSteps, setModalConfig, selectedTemplateIndex, currentSectionIndex, currentCardTemplates]);

  // Update modal config based on step and state changes
  useEffect(() => {
    if (currentStep === 2) {
      setModalConfig((prev) => ({
        ...prev,
        title: currentCardTemplates[selectedTemplateIndex]?.name || "New Template",
        showDoneButton: false,
        showBackButton: !editMode,
        backButtonTitle: "Card Templates",
        leftButton: editMode
          ? {
              label: "Cancel",
              onClick: () => setEditMode(false),
              isActive: true,
              isRemove: false,
              color: "blue",
            }
          : null,
        rightButton: editMode
          ? {
              label: "Done",
              onClick: () => setEditMode(false),
              isActive: true,
              isRemove: false,
              color: "blue",
            }
          : {
              label: "Edit",
              onClick: () => setEditMode(true),
              isActive: true,
              isRemove: false,
              color: "blue",
            },
      }));
    } else if (currentStep === 1) {
      setModalConfig((prev) => ({
        ...prev,
        title: "Card Templates",
        showDoneButton: true,
        showBackButton: false,
        leftButton: null,
        rightButton: null,
      }));
    } else {
      setModalConfig((prev) => ({
        ...prev,
        title:
          currentStep === 3 && currentCardTemplates[selectedTemplateIndex]?.sections[currentSectionIndex]
            ? currentCardTemplates[selectedTemplateIndex].sections[currentSectionIndex].name || "Section"
            : prev.title,
        showDoneButton: false,
        showBackButton: true,
        leftButton: null,
        rightButton: null,
      }));
    }
  }, [currentStep, selectedTemplateIndex, currentSectionIndex, editMode, currentCardTemplates, setModalConfig, goToStep]);

  const handleDeleteSection = useCallback(
    (index) => {
      const sectionName = currentCardTemplates[selectedTemplateIndex].sections[index].name;
      if (window.confirm(`Are you sure you want to delete the section "${sectionName}"?`)) {
        setCurrentCardTemplates((prev) => {
          const newTemplates = [...prev];
          const currentTemplate = { ...newTemplates[selectedTemplateIndex] };
          currentTemplate.sections = currentTemplate.sections.filter((_, i) => i !== index);
          newTemplates[selectedTemplateIndex] = currentTemplate;
          return newTemplates;
        });
        goToStep(2);
      }
    },
    [selectedTemplateIndex, goToStep]
  );

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

      setCurrentCardTemplates((prev) => {
        const newTemplates = [...prev];
        const currentTemplate = { ...newTemplates[selectedTemplateIndex] };
        const newSections = [...currentTemplate.sections];
        const sectionKeys = [...newSections[sectionIndex].keys];
        const [draggedItem] = sectionKeys.splice(draggedIndex, 1);
        sectionKeys.splice(index, 0, draggedItem);
        newSections[sectionIndex] = { ...newSections[sectionIndex], keys: sectionKeys };
        currentTemplate.sections = newSections;
        newTemplates[selectedTemplateIndex] = currentTemplate;
        return newTemplates;
      });
      setTimeout(() => setDraggedIndex(index), 0);
    },
    [draggedIndex, draggedSectionIndex, selectedTemplateIndex]
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
        Math.min(touchTargetIndex + delta, currentCardTemplates[selectedTemplateIndex].sections[sectionIndex].keys.length - 1)
      );

      if (newIndex !== draggedIndex) {
        setCurrentCardTemplates((prev) => {
          const newTemplates = [...prev];
          const currentTemplate = { ...newTemplates[selectedTemplateIndex] };
          const newSections = [...currentTemplate.sections];
          const sectionKeys = [...newSections[sectionIndex].keys];
          const [draggedItem] = sectionKeys.splice(draggedIndex, 1);
          sectionKeys.splice(newIndex, 0, draggedItem);
          newSections[sectionIndex] = { ...newSections[sectionIndex], keys: sectionKeys };
          currentTemplate.sections = newSections;
          newTemplates[selectedTemplateIndex] = currentTemplate;
          return newTemplates;
        });
        setTimeout(() => setDraggedIndex(newIndex), 0);
      }
    },
    [draggedIndex, touchStartY, touchTargetIndex, selectedTemplateIndex, currentCardTemplates]
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
        const existingIndex = currentCardTemplates.findIndex((t) => t.name === template.name);
        if (existingIndex >= 0) {
          setSelectedTemplateIndex(existingIndex);
          setEditMode(false);
          goToStep(2);
          return;
        }
      }

      setSelectedTemplateIndex(currentCardTemplates.length);
      setNewTemplateName("");
      setEditMode(false);
      goToStep(2);
    },
    [currentCardTemplates, goToStep]
  );

  const confirmNewTemplate = useCallback(() => {
    if (!newTemplateName.trim()) {
      alert("Please enter a template name.");
      return;
    }
    if (currentCardTemplates.some((t) => t.name.toLowerCase() === newTemplateName.trim().toLowerCase())) {
      alert("A template with this name already exists. Please choose a unique name.");
      return;
    }

    const newTemplate = {
      name: newTemplateName.trim(),
      typeOfCards: newTemplateName.trim(),
      sections: [],
    };

    setCurrentCardTemplates((prev) => {
      const newTemplates = [...prev, newTemplate];
      setSelectedTemplateIndex(newTemplates.length - 1);
      setEditMode(false);
      return newTemplates;
    });
    goToStep(2);
  }, [newTemplateName, currentCardTemplates, goToStep]);

  const updateTemplateName = useCallback(
    (newName) => {
      setCurrentCardTemplates((prev) => {
        const newTemplates = [...prev];
        if (
          newName.trim() &&
          newTemplates.some((t, i) => i !== selectedTemplateIndex && t.name.toLowerCase() === newName.trim().toLowerCase())
        ) {
          alert("A template with this name already exists. Please choose a unique name.");
          return prev;
        }
        newTemplates[selectedTemplateIndex] = {
          ...newTemplates[selectedTemplateIndex],
          name: newName.trim(),
          typeOfCards: newName.trim(),
        };
        return newTemplates;
      });
    },
    [selectedTemplateIndex]
  );

  const addSection = useCallback(() => {
    setCurrentCardTemplates((prev) => {
      const newTemplates = [...prev];
      const currentTemplate = { ...newTemplates[selectedTemplateIndex] };
      const newSectionName = `Section ${currentTemplate.sections.length + 1}`;
      if (currentTemplate.sections.some((s) => s.name.toLowerCase() === newSectionName.toLowerCase())) {
        alert(`Section name "${newSectionName}" already exists. Please use a unique name.`);
        return prev;
      }
      currentTemplate.sections = [...currentTemplate.sections, { name: newSectionName, keys: [] }];
      newTemplates[selectedTemplateIndex] = currentTemplate;
      return newTemplates;
    });
  }, [selectedTemplateIndex]);

  const updateSectionName = useCallback(
    (index, newName) => {
      setCurrentCardTemplates((prev) => {
        const newTemplates = [...prev];
        const currentTemplate = { ...newTemplates[selectedTemplateIndex] };
        if (
          newName.trim() &&
          currentTemplate.sections.some(
            (s, i) => i !== index && s.name.toLowerCase() === newName.trim().toLowerCase()
          )
        ) {
          alert(`Section name "${newName}" already exists. Please use a unique name.`);
          return prev;
        }
        currentTemplate.sections[index].name = newName.trim();
        newTemplates[selectedTemplateIndex] = currentTemplate;
        return newTemplates;
      });
    },
    [selectedTemplateIndex]
  );

  const handleEditSection = useCallback(
    (index) => {
      setCurrentSectionIndex(index);
      goToStep(3);
    },
    [goToStep]
  );

  const toggleKeySelection = useCallback(
    (sectionIndex, key) => {
      setCurrentCardTemplates((prev) => {
        const newTemplates = [...prev];
        const currentTemplate = { ...newTemplates[selectedTemplateIndex] };
        const newSections = [...currentTemplate.sections];
        const section = { ...newSections[sectionIndex] };
        const isSelected = section.keys.includes(key);
        section.keys = isSelected ? section.keys.filter((k) => k !== key) : [...section.keys, key];
        newSections[sectionIndex] = section;
        currentTemplate.sections = newSections;
        newTemplates[selectedTemplateIndex] = currentTemplate;
        return newTemplates;
      });
    },
    [selectedTemplateIndex]
  );

  const handleDeleteKey = useCallback(
    (sectionIndex, key) => {
      if (window.confirm(`Are you sure you want to delete "${key}" from this section?`)) {
        setCurrentCardTemplates((prev) => {
          const newTemplates = [...prev];
          const currentTemplate = { ...newTemplates[selectedTemplateIndex] };
          const newSections = [...currentTemplate.sections];
          newSections[sectionIndex].keys = newSections[sectionIndex].keys.filter((k) => k !== key);
          currentTemplate.sections = newSections;
          newTemplates[selectedTemplateIndex] = currentTemplate;
          return newTemplates;
        });
      }
    },
    [selectedTemplateIndex]
  );

  const getUsedKeysInOtherSections = useCallback(() => {
    if (selectedTemplateIndex === null || currentSectionIndex === null) return [];
    const currentTemplate = currentCardTemplates[selectedTemplateIndex];
    return currentTemplate.sections
      .filter((_, i) => i !== currentSectionIndex)
      .flatMap((section) => section.keys);
  }, [currentCardTemplates, selectedTemplateIndex, currentSectionIndex]);

  const filteredHeaders = headers.filter((header) => {
    const usedKeysInOtherSections = getUsedKeysInOtherSections();
    return (
      !currentCardTemplates[selectedTemplateIndex]?.sections[currentSectionIndex]?.keys.includes(header.key) &&
      !usedKeysInOtherSections.includes(header.key) &&
      [header.name, header.type, header.key].some((field) =>
        field.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  });

  const handleDeleteTemplate = useCallback(() => {
    if (selectedTemplateIndex === null) return;
    const templateName = currentCardTemplates[selectedTemplateIndex].name;
    if (window.confirm(`Are you sure you want to delete the "${templateName}" template?`)) {
      setCurrentCardTemplates((prev) => {
        const newTemplates = prev.filter((_, i) => i !== selectedTemplateIndex);
        setSelectedTemplateIndex(null);
        setEditMode(false);
        goToStep(1);
        return newTemplates;
      });
    }
  }, [selectedTemplateIndex, currentCardTemplates, goToStep]);

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
                  {currentCardTemplates.map((template, index) => (
                    <button
                      key={index}
                      className={`${styles.templateButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                      onClick={() => handleOpenEditor(template)}
                    >
                      {template.name || "Unnamed Template"}
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 2 && selectedTemplateIndex !== null && (
              <>
                {currentCardTemplates[selectedTemplateIndex] ? (
                  <>
                    <input
                      type="text"
                      value={currentCardTemplates[selectedTemplateIndex].name || ""}
                      onChange={(e) => updateTemplateName(e.target.value)}
                      placeholder="Template Name"
                      className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ""}`}
                      disabled={!editMode}
                    />
                    <h3 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      Sections
                    </h3>
                    <div className={styles.templateList}>
                      {currentCardTemplates[selectedTemplateIndex].sections.map((section, index) => (
                        <div className={`${styles.sectionItem} ${isDarkTheme ? styles.darkTheme : ""}`} key={index}>
                          <button
                            className={`${styles.templateButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                            onClick={() => !editMode && handleEditSection(index)}
                            disabled={editMode}
                          >
                            <span className={styles.sectionContent}>
                              <span className={styles.sectionName}>{section.name}</span>
                            </span>
                            {!editMode && (
                              <span className={`${styles.chevronContainer} ${isDarkTheme ? styles.darkTheme : ""}`}>
                                <IoChevronForward className={`${styles.chevronIcon} ${isDarkTheme ? styles.darkTheme : ""}`} />
                              </span>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                    {!editMode && (
                      <button
                        className={`${styles.addSectionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                        onClick={addSection}
                      >
                        Add Section
                      </button>
                    )}
                    {editMode && (
                      <button
                        className={`${styles.deleteButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                        onClick={handleDeleteTemplate}
                      >
                        Delete Template
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      placeholder="Template Name"
                      className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ""}`}
                    />
                    <button
                      className={`${styles.confirmButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                      onClick={confirmNewTemplate}
                    >
                      Create Template
                    </button>
                  </>
                )}
              </>
            )}

            {step === 3 &&
              selectedTemplateIndex !== null &&
              currentSectionIndex !== null &&
              currentCardTemplates[selectedTemplateIndex]?.sections[currentSectionIndex] && (
              <>
                <input
                  type="text"
                  value={currentCardTemplates[selectedTemplateIndex].sections[currentSectionIndex].name || ""}
                  onChange={(e) => updateSectionName(currentSectionIndex, e.target.value)}
                  className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ""}`}
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
                  {currentCardTemplates[selectedTemplateIndex].sections[currentSectionIndex].keys.map((key, index) => {
                    const header = headers.find((h) => h.key === key) || {
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
                        onClick={() => !editMode && toggleKeySelection(currentSectionIndex, header.key)}
                      >
                        {editMode && (
                          <button
                            className={`${styles.removeButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteKey(currentSectionIndex, header.key);
                            }}
                          >
                            <BsDashCircle />
                          </button>
                        )}
                        <div className={styles.headerContent}>
                          <span className={`${styles.customCheckbox} ${isDarkTheme ? styles.darkTheme : ""}`}>
                            {currentCardTemplates[selectedTemplateIndex].sections[currentSectionIndex].keys.includes(header.key) ? (
                              <FaRegCheckCircle size={18} className={styles.checked} />
                            ) : (
                              <FaRegCircle size={18} />
                            )}
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
                    <div
                      key={index}
                      className={`${styles.keyItem} ${isDarkTheme ? styles.darkTheme : ""}`}
                      onClick={() => !editMode && toggleKeySelection(currentSectionIndex, header.key)}
                    >
                      <div className={styles.headerContent}>
                        <span className={`${styles.customCheckbox} ${isDarkTheme ? styles.darkTheme : ""}`}>
                          {currentCardTemplates[selectedTemplateIndex].sections[currentSectionIndex].keys.includes(header.key) ? (
                            <FaRegCheckCircle size={18} className={styles.checked} />
                          ) : (
                            <FaRegCircle size={18} />
                          )}
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
                <button
                  className={`${styles.deleteSectionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                  onClick={() => handleDeleteSection(currentSectionIndex)}
                >
                  Delete Section
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

CardsTemplate.propTypes = {
  tempData: PropTypes.shape({
    currentCardTemplates: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string,
        typeOfCards: PropTypes.string,
        sections: PropTypes.arrayOf(
          PropTypes.shape({
            name: PropTypes.string,
            keys: PropTypes.arrayOf(PropTypes.string),
          })
        ),
      })
    ),
  }).isRequired,
  setTempData: PropTypes.func.isRequired,
};

export default CardsTemplate;