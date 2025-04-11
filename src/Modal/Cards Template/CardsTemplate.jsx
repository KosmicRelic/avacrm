import { useState, useContext, useCallback, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import styles from "./CardsTemplate.module.css";
import { MainContext } from "../../Contexts/MainContext";
import { FaPlus, FaSearch } from "react-icons/fa";
import { IoIosCheckmark } from "react-icons/io";
import { BsDashCircle } from "react-icons/bs";

const CardsTemplate = ({ onSave }) => {
  const {
    headers,
    cardTemplates,
    setCardTemplates,
    isDarkTheme,
    registerModalSteps,
    goToStep,
    currentStep,
    tempData,
    setTempData,
    selectedTemplateIndex,
    setSelectedTemplateIndex,
    currentSectionIndex,
    setCurrentSectionIndex,
    editMode,
    setEditMode,
    setModalConfig,
  } = useContext(MainContext);

  const [draggedIndex, setDraggedIndex] = useState(null);
  const [draggedSectionIndex, setDraggedSectionIndex] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchTargetIndex, setTouchTargetIndex] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [prevStep, setPrevStep] = useState(null);
  const keyRefs = useRef(new Map());
  const hasInitialized = useRef(false);

  const availableHeaders = headers.map((h) => ({
    key: h.key,
    name: h.name,
    type: h.type,
  }));

  const handleSave = useCallback(() => {
    if (currentStep !== 1) return;
    const cleanedTempData = tempData
      .map((template) => {
        const { isEditing, originalName, deleteTemplate, ...rest } = template;
        return rest;
      })
      .filter((template) => !template.deleteTemplate);

    const existingNames = cardTemplates.map((t) => t.name.toLowerCase());
    const tempNames = cleanedTempData.map((t) => t.name.toLowerCase());
    const hasDuplicate = tempNames.some(
      (name, index) =>
        (existingNames.includes(name) &&
          !cardTemplates.some((t) => t.name.toLowerCase() === tempData[index]?.originalName?.toLowerCase())) ||
        tempNames.indexOf(name) !== index
    );

    if (hasDuplicate) {
      alert("Duplicate template names are not allowed (case-insensitive). Please use unique names.");
      return;
    }

    for (const template of cleanedTempData) {
      const sectionNames = template.sections.map((s) => s.name.toLowerCase());
      const hasDuplicateSections = sectionNames.some((name, idx) => sectionNames.indexOf(name) !== idx);
      if (hasDuplicateSections) {
        alert(`Duplicate section names found in template "${template.name}" (case-insensitive). Please use unique section names.`);
        return;
      }
    }

    setCardTemplates((prev) => {
      const updatedTemplates = [...prev];
      cleanedTempData.forEach((tempTemplate) => {
        const index = updatedTemplates.findIndex((t) => t.name === tempTemplate.originalName);
        if (index >= 0) {
          updatedTemplates[index] = { ...tempTemplate, keys: tempTemplate.sections.flatMap((s) => s.keys) };
        } else {
          updatedTemplates.push({ ...tempTemplate, keys: tempTemplate.sections.flatMap((s) => s.keys) });
        }
      });
      return updatedTemplates.filter((t) => !tempData.some((td) => td.deleteTemplate === t.name));
    });
    setTempData(cleanedTempData);
    onSave();
  }, [tempData, setCardTemplates, setTempData, onSave, currentStep, cardTemplates]);

  const handleCreateCard = useCallback(() => {
    if (selectedTemplateIndex === null || !tempData[selectedTemplateIndex].name.trim()) {
      alert("Please enter a non-empty template name before creating.");
      return;
    }

    const currentTemplate = tempData[selectedTemplateIndex];
    const { isEditing, originalName, deleteTemplate, ...rest } = currentTemplate;

    const existingNames = cardTemplates.map((t) => t.name.toLowerCase());
    if (existingNames.includes(rest.name.toLowerCase()) && rest.name !== originalName) {
      alert("A template with this name already exists (case-insensitive). Please use a unique name.");
      return;
    }

    setCardTemplates((prev) => {
      const updatedTemplates = [...prev];
      const index = updatedTemplates.findIndex((t) => t.name === originalName);
      if (index >= 0) {
        updatedTemplates[index] = { ...rest, keys: rest.sections.flatMap((s) => s.keys) };
      } else {
        updatedTemplates.push({ ...rest, keys: rest.sections.flatMap((s) => s.keys) });
      }
      return updatedTemplates;
    });

    setTempData((prev) => {
      const newTemp = [...prev];
      newTemp[selectedTemplateIndex] = { ...rest, isEditing: false, originalName: rest.name, deleteTemplate: null };
      return newTemp;
    });

    setPrevStep(currentStep);
    goToStep(2);
  }, [tempData, setTempData, selectedTemplateIndex, cardTemplates, setCardTemplates, goToStep, currentStep]);

  const toggleEditMode = useCallback(() => {
    setEditMode((prev) => !prev);
  }, [setEditMode]);

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;

      const steps = [
        {
          title: () => "Card Templates",
          rightButtons: () => [{ label: "Done", onClick: handleSave }],
        },
        {
          title: ({ tempData, selectedTemplateIndex }) =>
            selectedTemplateIndex !== null && tempData[selectedTemplateIndex]
              ? tempData[selectedTemplateIndex].name || "New Template"
              : "New Template",
          rightButtons: ({ editMode }) => [
            { label: editMode ? "Done" : "Edit", onClick: toggleEditMode },
          ],
        },
        {
          title: ({ tempData, selectedTemplateIndex, currentSectionIndex }) =>
            selectedTemplateIndex !== null &&
            currentSectionIndex !== null &&
            tempData[selectedTemplateIndex]?.sections[currentSectionIndex]
              ? tempData[selectedTemplateIndex].sections[currentSectionIndex].name || "Section"
              : "Section",
          rightButtons: () => [],
        },
      ];

      setTimeout(() => {
        registerModalSteps({ steps });
        setModalConfig({
          showTitle: true,
          showDoneButton: true,
          showBackButton: false,
          title: "Card Templates",
          backButtonTitle: "",
        });
        goToStep(1);

        if (!tempData.length) {
          setTempData(
            cardTemplates.map((t) => ({
              ...t,
              isEditing: false,
              originalName: t.name,
              deleteTemplate: null,
            }))
          );
        }
      }, 0);
    }
  }, [
    registerModalSteps,
    goToStep,
    handleSave,
    toggleEditMode,
    setModalConfig,
    tempData,
    setTempData,
    cardTemplates,
  ]);

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
      setTimeout(() => setDraggedIndex(index), 0); // Defer to avoid render conflicts
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
      setTempData((prev) => {
        if (!template) {
          const newTemp = [
            ...prev,
            {
              name: "",
              typeOfCards: "",
              sections: [],
              isEditing: true,
              originalName: null,
              deleteTemplate: null,
            },
          ];
          setSelectedTemplateIndex(newTemp.length - 1);
          setPrevStep(currentStep);
          goToStep(2);
          return newTemp;
        }
        const existingIndex = prev.findIndex((t) => t.originalName === template.name);
        if (existingIndex >= 0) {
          setSelectedTemplateIndex(existingIndex);
          setPrevStep(currentStep);
          goToStep(2);
          return prev;
        }
        const newTemp = [
          ...prev,
          {
            name: template.name || "",
            typeOfCards: template.typeOfCards || template.name || "",
            sections: Array.isArray(template.sections) ? [...template.sections] : [],
            isEditing: true,
            originalName: template.name || null,
            deleteTemplate: null,
          },
        ];
        setSelectedTemplateIndex(newTemp.length - 1);
        setPrevStep(currentStep);
        goToStep(2);
        return newTemp;
      });
    },
    [setTempData, setSelectedTemplateIndex, goToStep, currentStep]
  );

  const addSection = useCallback(() => {
    setTempData((prev) => {
      const newTemp = [...prev];
      const currentTemplate = { ...newTemp[selectedTemplateIndex] };
      const newSectionName = `Section ${currentTemplate.sections.length + 1}`;
      if (currentTemplate.sections.some((s) => s.name.toLowerCase() === newSectionName.toLowerCase())) {
        alert(`Section name "${newSectionName}" already exists (case-insensitive). Please use a unique name.`);
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
        if (currentTemplate.sections.some((s, i) => i !== index && s.name.toLowerCase() === newName.toLowerCase())) {
          alert(`Section name "${newName}" already exists in this template (case-insensitive). Please use a unique name.`);
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
      setPrevStep(currentStep);
      goToStep(3);
    },
    [setCurrentSectionIndex, goToStep, currentStep]
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
        const newTemp = [...prev];
        newTemp[selectedTemplateIndex] = { ...newTemp[selectedTemplateIndex], deleteTemplate: templateName };
        return newTemp;
      });
      handleSave();
      setPrevStep(currentStep);
      goToStep(1);
    }
  }, [selectedTemplateIndex, tempData, setTempData, handleSave, goToStep, currentStep]);

  const getAnimationClass = useCallback(
    (step) => {
      if (prevStep === null) return "";
      const isForward = step > prevStep;
      if (step === currentStep) {
        return isForward ? styles.slideInRight : styles.slideInLeft;
      }
      if (step === prevStep) {
        return isForward ? styles.slideOutLeft : styles.slideOutRight;
      }
      return "";
    },
    [currentStep, prevStep]
  );

  return (
    <div className={`${styles.templateWrapper} ${isDarkTheme ? styles.darkTheme : ""}`}>
      <div className={styles.viewContainer}>
        {[1, 2, 3].map((step) => (
          <div
            key={step}
            className={`${styles.view} ${isDarkTheme ? styles.darkTheme : ""} ${
              step === currentStep || step === prevStep ? getAnimationClass(step) : styles.hidden
            }`}
            style={{ display: step === currentStep || step === prevStep ? "block" : "none" }}
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
                  {cardTemplates.map((template) => (
                    <button
                      key={template.name}
                      className={`${styles.templateButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                      onClick={() => handleOpenEditor(template)}
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 2 && selectedTemplateIndex !== null && (
              <>
                <input
                  type="text"
                  value={tempData[selectedTemplateIndex].name}
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
                {tempData[selectedTemplateIndex].originalName === null && (
                  <button
                    className={`${styles.createButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                    onClick={handleCreateCard}
                  >
                    Create Card
                  </button>
                )}
                {tempData[selectedTemplateIndex].originalName !== null && (
                  <>
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
              </>
            )}

            {step === 3 && selectedTemplateIndex !== null && currentSectionIndex !== null && (
              <>
                <input
                  type="text"
                  value={tempData[selectedTemplateIndex].sections[currentSectionIndex].name}
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
  onSave: PropTypes.func.isRequired,
};

export default CardsTemplate;