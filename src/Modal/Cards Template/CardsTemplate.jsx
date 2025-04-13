import { useState, useContext, useCallback, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import styles from "./CardsTemplate.module.css";
import { MainContext } from "../../Contexts/MainContext";
import { ModalNavigatorContext } from "../../Contexts/ModalNavigator";
import { FaPlus, FaSearch } from "react-icons/fa";
import { IoIosCheckmark } from "react-icons/io";
import { BsDashCircle } from "react-icons/bs";

const CardsTemplate = ({ onSave }) => {
  const { headers, cardTemplates, setCardTemplates, isDarkTheme } = useContext(MainContext);
  const { registerModalSteps, goToStep, currentStep, modalConfig, setModalConfig } =
    useContext(ModalNavigatorContext);

  const [localTemplates, setLocalTemplates] = useState([]);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(null);
  const [editMode, setEditMode] = useState(false);
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

  // Initialize localTemplates from cardTemplates
  useEffect(() => {
    setLocalTemplates(
      cardTemplates.map((t) => ({
        ...t,
        sections: t.sections.map((s) => ({
          ...s,
          name: s.name || "Unnamed Section",
          keys: Array.isArray(s.keys) ? s.keys : [],
        })),
      }))
    );
  }, [cardTemplates]);

  // Initialize modal steps
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      const steps = [
        {
          title: "Card Templates",
          rightButton: { label: "Done", onClick: handleSave },
        },
        {
          title: () =>
            selectedTemplateIndex !== null && localTemplates[selectedTemplateIndex]
              ? localTemplates[selectedTemplateIndex].name || "New Template"
              : "New Template",
          rightButton: { label: editMode ? "Done" : "Edit", onClick: toggleEditMode },
        },
        {
          title: () =>
            selectedTemplateIndex !== null &&
            currentSectionIndex !== null &&
            localTemplates[selectedTemplateIndex]?.sections[currentSectionIndex]
              ? localTemplates[selectedTemplateIndex].sections[currentSectionIndex].name || "Section"
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
        backButtonTitle: "",
        rightButton: { label: "Done", onClick: handleSave },
      });
    }
  }, [registerModalSteps, setModalConfig, selectedTemplateIndex, currentSectionIndex, editMode, localTemplates]);

  // Update modal config based on step
  useEffect(() => {
    setModalConfig((prev) => ({
      ...prev,
      title:
        currentStep === 1
          ? "Card Templates"
          : currentStep === 2 && localTemplates[selectedTemplateIndex]
          ? localTemplates[selectedTemplateIndex].name || "New Template"
          : currentStep === 3 && localTemplates[selectedTemplateIndex]?.sections[currentSectionIndex]
          ? localTemplates[selectedTemplateIndex].sections[currentSectionIndex].name || "Section"
          : prev.title,
      rightButton:
        currentStep === 1
          ? { label: "Done", onClick: handleSave }
          : currentStep === 2
          ? { label: editMode ? "Done" : "Edit", onClick: toggleEditMode }
          : null,
      showDoneButton: currentStep === 1,
      showBackButton: currentStep > 1,
    }));
  }, [currentStep, selectedTemplateIndex, currentSectionIndex, editMode, localTemplates, setModalConfig]);

  const toggleEditMode = useCallback(() => {
    setEditMode((prev) => !prev);
  }, []);

  const handleSave = useCallback(() => {
    setCardTemplates(localTemplates);
    if (onSave) onSave(localTemplates);
  }, [localTemplates, setCardTemplates, onSave]);

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

      setLocalTemplates((prev) => {
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
        Math.min(touchTargetIndex + delta, localTemplates[selectedTemplateIndex].sections[sectionIndex].keys.length - 1)
      );

      if (newIndex !== draggedIndex) {
        setLocalTemplates((prev) => {
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
    [draggedIndex, touchStartY, touchTargetIndex, selectedTemplateIndex, localTemplates]
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
        const existingIndex = localTemplates.findIndex((t) => t.name === template.name);
        if (existingIndex >= 0) {
          setSelectedTemplateIndex(existingIndex);
          goToStep(2);
          return;
        }
      }

      const newTemplate = {
        name: "",
        typeOfCards: "",
        sections: [],
      };

      setLocalTemplates((prev) => {
        const newTemplates = [...prev, newTemplate];
        const newIndex = newTemplates.length - 1;
        setSelectedTemplateIndex(newIndex);
        goToStep(2);
        return newTemplates;
      });
    },
    [localTemplates, goToStep]
  );

  const addSection = useCallback(() => {
    setLocalTemplates((prev) => {
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
      setLocalTemplates((prev) => {
        const newTemplates = [...prev];
        const currentTemplate = { ...newTemplates[selectedTemplateIndex] };
        if (
          currentTemplate.sections.some(
            (s, i) => i !== index && s.name.toLowerCase() === newName.toLowerCase()
          )
        ) {
          alert(`Section name "${newName}" already exists. Please use a unique name.`);
          return prev;
        }
        currentTemplate.sections[index].name = newName;
        newTemplates[selectedTemplateIndex] = currentTemplate;
        return newTemplates;
      });
    },
    [selectedTemplateIndex]
  );

  const removeSection = useCallback(
    (index) => {
      const sectionName = localTemplates[selectedTemplateIndex].sections[index].name;
      if (window.confirm(`Are you sure you want to delete the "${sectionName}" section?`)) {
        setLocalTemplates((prev) => {
          const newTemplates = [...prev];
          const currentTemplate = { ...newTemplates[selectedTemplateIndex] };
          currentTemplate.sections = currentTemplate.sections.filter((_, i) => i !== index);
          newTemplates[selectedTemplateIndex] = currentTemplate;
          return newTemplates;
        });
      }
    },
    [selectedTemplateIndex, localTemplates]
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
      setLocalTemplates((prev) => {
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
        setLocalTemplates((prev) => {
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
    const currentTemplate = localTemplates[selectedTemplateIndex];
    return currentTemplate.sections
      .filter((_, i) => i !== currentSectionIndex)
      .flatMap((section) => section.keys);
  }, [localTemplates, selectedTemplateIndex, currentSectionIndex]);

  const filteredHeaders = availableHeaders.filter((header) => {
    const usedKeysInOtherSections = getUsedKeysInOtherSections();
    return (
      !localTemplates[selectedTemplateIndex]?.sections[currentSectionIndex]?.keys.includes(header.key) &&
      !usedKeysInOtherSections.includes(header.key) &&
      [header.name, header.type, header.key].some((field) =>
        field.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  });

  const handleDeleteTemplate = useCallback(() => {
    if (selectedTemplateIndex === null) return;
    const templateName = localTemplates[selectedTemplateIndex].name;
    if (window.confirm(`Are you sure you want to delete the "${templateName}" template?`)) {
      setLocalTemplates((prev) => {
        const newTemplates = prev.filter((_, i) => i !== selectedTemplateIndex);
        setSelectedTemplateIndex(null);
        goToStep(1);
        return newTemplates;
      });
    }
  }, [selectedTemplateIndex, localTemplates, goToStep]);

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
                  {localTemplates.map((template, index) => (
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

            {step === 2 && selectedTemplateIndex !== null && localTemplates[selectedTemplateIndex] && (
              <>
                <input
                  type="text"
                  value={localTemplates[selectedTemplateIndex].name || ""}
                  onChange={(e) => {
                    setLocalTemplates((prev) => {
                      const newTemplates = [...prev];
                      newTemplates[selectedTemplateIndex] = {
                        ...newTemplates[selectedTemplateIndex],
                        name: e.target.value,
                        typeOfCards: e.target.value,
                      };
                      return newTemplates;
                    });
                  }}
                  placeholder="Template Name"
                  className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ""}`}
                />
                <h3 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>
                  Sections
                </h3>
                <div className={styles.templateList}>
                  {localTemplates[selectedTemplateIndex].sections.map((section, index) => (
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
              localTemplates[selectedTemplateIndex]?.sections[currentSectionIndex] && (
              <>
                <input
                  type="text"
                  value={localTemplates[selectedTemplateIndex].sections[currentSectionIndex].name || ""}
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
                  {localTemplates[selectedTemplateIndex].sections[currentSectionIndex].keys.map((key, index) => {
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
                              localTemplates[selectedTemplateIndex].sections[currentSectionIndex].keys.includes(header.key)
                                ? styles.checked
                                : ""
                            } ${isDarkTheme ? styles.darkTheme : ""}`}
                          >
                            <IoIosCheckmark
                              style={{
                                color: localTemplates[selectedTemplateIndex].sections[currentSectionIndex].keys.includes(header.key)
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
                            localTemplates[selectedTemplateIndex].sections[currentSectionIndex].keys.includes(header.key)
                              ? styles.checked
                              : ""
                          } ${isDarkTheme ? styles.darkTheme : ""}`}
                        >
                          <IoIosCheckmark
                            style={{
                              color: localTemplates[selectedTemplateIndex].sections[currentSectionIndex].keys.includes(header.key)
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