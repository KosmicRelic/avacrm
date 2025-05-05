import { useState, useContext, useCallback, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import styles from "./CardsTemplate.module.css";
import { MainContext } from "../../Contexts/MainContext";
import { ModalNavigatorContext } from "../../Contexts/ModalNavigator";
import { FaPlus, FaSearch, FaRegCircle, FaRegCheckCircle, FaInfoCircle } from "react-icons/fa";
import { IoChevronForward } from "react-icons/io5";
import { BsDashCircle } from "react-icons/bs";
import { v4 as uuidv4 } from "uuid";

const CardsTemplate = ({ tempData, setTempData, businessId: businessIdProp }) => {
  const { cardTemplates, isDarkTheme, businessId: businessIdContext } = useContext(MainContext);
  const { registerModalSteps, goToStep, goBack, currentStep, setModalConfig } = useContext(ModalNavigatorContext);

  // Use the prop if provided, otherwise fallback to context
  const businessId = businessIdProp || businessIdContext;

  const [currentCardTemplates, setCurrentCardTemplates] = useState(() =>
    (tempData.currentCardTemplates || cardTemplates).map((t) => {
      const headers = t.headers.map((h) => ({
        ...h,
        isUsed: h.key === "id" || h.key === "typeOfCards" ? true : h.isUsed ?? false,
      }));
      const sections = t.sections.map((s) => ({
        ...s,
        keys: s.keys.includes("id") || s.keys.includes("typeOfCards") ? s.keys : [...s.keys],
      }));
      return {
        ...t,
        headers: headers || [],
        sections,
        isModified: t.isModified || false, // Preserve existing isModified if present
        action: t.action || null, // Preserve existing action if present
      };
    })
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
  const [activeHeaderIndex, setActiveHeaderIndex] = useState(null);
  const [newHeaderName, setNewHeaderName] = useState("");
  const [newHeaderType, setNewHeaderType] = useState("text");
  const [newHeaderSection, setNewHeaderSection] = useState("");
  const [newHeaderOptions, setNewHeaderOptions] = useState([]);
  const [newOption, setNewOption] = useState("");
  const [navigationDirection, setNavigationDirection] = useState(null);
  const keyRefs = useRef(new Map());
  const hasInitialized = useRef(false);
  const prevCardTemplatesRef = useRef(currentCardTemplates);
  const prevStepRef = useRef(currentStep);

  // Reset header form
  const resetHeaderForm = useCallback(() => {
    setNewHeaderName("");
    setNewHeaderType("text");
    setNewHeaderSection("");
    setNewHeaderOptions([]);
    setNewOption("");
  }, []);

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (currentStep === 5 || currentStep === 4) {
      setActiveHeaderIndex(null);
      resetHeaderForm();
      goBack();
    } else if (currentStep === 3) {
      setCurrentSectionIndex(null);
      setActiveHeaderIndex(null);
      goBack();
    } else if (currentStep === 2) {
      if (editMode) {
        setEditMode(false);
      } else {
        setSelectedTemplateIndex(null);
        goBack();
      }
    } else {
      goBack();
    }
    setNavigationDirection("backward");
  }, [currentStep, goBack, editMode, resetHeaderForm]);

  // Sync currentCardTemplates to tempData
  useEffect(() => {
    const templatesChanged = JSON.stringify(currentCardTemplates) !== JSON.stringify(prevCardTemplatesRef.current);
    if (templatesChanged) {
      setTempData({ currentCardTemplates });
      prevCardTemplatesRef.current = currentCardTemplates;
    }
  }, [currentCardTemplates, setTempData]);

  // Validate header name
  const validateHeader = useCallback(
    (name, existingHeaders, isUpdate = false, index = null) => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        alert("Field name must be non-empty.");
        return false;
      }
      const nameConflict = existingHeaders.some(
        (h, i) => h.name.toLowerCase() === trimmedName.toLowerCase() && (!isUpdate || i !== index)
      );
      if (nameConflict) {
        alert(`A field with the name "${trimmedName}" already exists.`);
        return false;
      }
      return true;
    },
    []
  );

  // Add new header
  const addHeader = useCallback(() => {
    if (selectedTemplateIndex === null) return;
    const existingHeaders = currentCardTemplates[selectedTemplateIndex].headers;
    if (!validateHeader(newHeaderName, existingHeaders)) return;
    if (!newHeaderSection) {
      alert("Please select a section for the field.");
      return;
    }
    if (newHeaderSection === "Card Data") {
      alert("The 'Card Data' section is reserved for 'ID' and 'Type of Cards' fields.");
      return;
    }

    const newHeader = {
      key: uuidv4(),
      name: newHeaderName.trim(),
      type: newHeaderType,
      section: newHeaderSection,
      isUsed: true,
      ...(newHeaderType === "dropdown" && { options: [...newHeaderOptions] }),
    };

    setCurrentCardTemplates((prev) => {
      const newTemplates = [...prev];
      const currentTemplate = { ...newTemplates[selectedTemplateIndex] };
      currentTemplate.headers = [...currentTemplate.headers, newHeader];
      currentTemplate.sections = currentTemplate.sections.map((section) => {
        if (section.name === newHeaderSection) {
          return { ...section, keys: [...section.keys, newHeader.key] };
        }
        return section;
      });
      newTemplates[selectedTemplateIndex] = {
        ...currentTemplate,
        isModified: true,
        action: currentTemplate.action || "update",
      };
      return newTemplates;
    });
    resetHeaderForm();
    setActiveHeaderIndex(null);
    setNavigationDirection("backward");
    goBack();
  }, [
    newHeaderName,
    newHeaderType,
    newHeaderSection,
    newHeaderOptions,
    selectedTemplateIndex,
    validateHeader,
    resetHeaderForm,
    goBack,
  ]);

  // Update existing header
  const updateHeader = useCallback(
    (index) => {
      if (selectedTemplateIndex === null) return;
      const existingHeaders = currentCardTemplates[selectedTemplateIndex].headers;
      if (!validateHeader(newHeaderName, existingHeaders, true, index)) return;
      if (!newHeaderSection) {
        alert("Please select a section for the field.");
        return;
      }

      const currentHeader = currentCardTemplates[selectedTemplateIndex].headers[index];
      const isProtected = currentHeader.key === "id" || currentHeader.key === "typeOfCards";

      if (isProtected && newHeaderSection !== "Card Data") {
        alert("The 'ID' and 'Type of Cards' fields must remain in the 'Card Data' section.");
        return;
      }

      setCurrentCardTemplates((prev) => {
        const newTemplates = [...prev];
        const currentTemplate = { ...newTemplates[selectedTemplateIndex] };
        const existingHeader = currentTemplate.headers[index];
        const oldSection = existingHeader.section;

        currentTemplate.headers[index] = {
          ...existingHeader,
          name: newHeaderName.trim(),
          type: newHeaderType,
          section: newHeaderSection,
          isUsed: isProtected ? true : true,
          ...(newHeaderType === "dropdown" ? { options: [...newHeaderOptions] } : { options: undefined }),
        };

        if (oldSection !== newHeaderSection) {
          currentTemplate.sections = currentTemplate.sections.map((section) => {
            if (section.name === oldSection) {
              return { ...section, keys: section.keys.filter((k) => k !== existingHeader.key) };
            }
            if (section.name === newHeaderSection) {
              return { ...section, keys: [...section.keys, existingHeader.key] };
            }
            return section;
          });
        }

        newTemplates[selectedTemplateIndex] = {
          ...currentTemplate,
          isModified: true,
          action: currentTemplate.action || "update",
        };
        return newTemplates;
      });
      resetHeaderForm();
      setActiveHeaderIndex(null);
      setNavigationDirection("backward");
      goBack();
    },
    [newHeaderName, newHeaderType, newHeaderSection, newHeaderOptions, selectedTemplateIndex, validateHeader, resetHeaderForm, goBack]
  );

  // Delete header
  const deleteHeader = useCallback(
    (index) => {
      if (selectedTemplateIndex === null) return;
      const header = currentCardTemplates[selectedTemplateIndex].headers[index];
      if (header.key === "id" || header.key === "typeOfCards") {
        alert("The 'ID' or 'Type of Cards' field cannot be deleted.");
        return;
      }
      const headerName = header.name;
      if (window.confirm(`Are you sure you want to delete the field "${headerName}"?`)) {
        setCurrentCardTemplates((prev) => {
          const newTemplates = [...prev];
          const currentTemplate = { ...newTemplates[selectedTemplateIndex] };
          const deletedKey = currentTemplate.headers[index].key;
          currentTemplate.headers = currentTemplate.headers.filter((_, i) => i !== index);
          currentTemplate.sections = currentTemplate.sections.map((section) => ({
            ...section,
            keys: section.keys.filter((k) => k !== deletedKey),
          }));
          newTemplates[selectedTemplateIndex] = {
            ...currentTemplate,
            isModified: true,
            action: currentTemplate.action || "update",
          };
          return newTemplates;
        });
        setActiveHeaderIndex(null);
        setNavigationDirection("backward");
        goBack();
      }
    },
    [selectedTemplateIndex, goBack]
  );

  // Save header (add or update)
  const saveHeader = useCallback(() => {
    if (activeHeaderIndex === -1) {
      addHeader();
    } else if (activeHeaderIndex !== null) {
      updateHeader(activeHeaderIndex);
    }
  }, [activeHeaderIndex, addHeader, updateHeader]);

  // Add dropdown option
  const addOption = useCallback(() => {
    if (newOption.trim() && !newHeaderOptions.includes(newOption.trim())) {
      setNewHeaderOptions((prev) => [...prev, newOption.trim()]);
      setNewOption("");
    }
  }, [newOption, newHeaderOptions]);

  // Remove dropdown option
  const removeOption = useCallback((option) => {
    setNewHeaderOptions((prev) => prev.filter((opt) => opt !== option));
  }, []);

  // Handle key press for saving header or adding option
  const handleKeyPress = useCallback(
    (e) => {
      if (e.key === "Enter") {
        if (newHeaderType === "dropdown" && e.target.value === newOption) {
          addOption();
        } else {
          saveHeader();
        }
      }
    },
    [saveHeader, newHeaderType, newOption, addOption]
  );

  // Initialize modal steps
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      const steps = [
        { title: "Card Templates", rightButton: null },
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
        {
          title: () =>
            activeHeaderIndex !== null && currentCardTemplates[selectedTemplateIndex]?.headers[activeHeaderIndex]
              ? currentCardTemplates[selectedTemplateIndex].headers[activeHeaderIndex].name || "Edit Field"
              : "Edit Field",
          rightButton: {
            label: "Save",
            onClick: saveHeader,
            isActive: true,
            isRemove: false,
          },
        },
        {
          title: "Create New Field",
          rightButton: {
            label: "Save",
            onClick: saveHeader,
            isActive: true,
            isRemove: false,
          },
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
  }, [registerModalSteps, setModalConfig, selectedTemplateIndex, currentSectionIndex, currentCardTemplates, saveHeader]);

  // Update modal config
  useEffect(() => {
    if (currentStep === 1) {
      setModalConfig({
        showTitle: true,
        showDoneButton: true,
        showBackButton: false,
        title: "Card Templates",
        backButtonTitle: "",
        leftButton: null,
        rightButton: null,
      });
    } else if (currentStep === 2) {
      setModalConfig({
        showTitle: true,
        showDoneButton: false,
        showBackButton: !editMode,
        backButtonTitle: "Card Templates",
        backButton: editMode ? null : { label: "Card Templates", onClick: handleBack },
        title: selectedTemplateIndex !== null && currentCardTemplates[selectedTemplateIndex] ? currentCardTemplates[selectedTemplateIndex].name || "New Template" : "New Template",
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
          : selectedTemplateIndex !== null && currentCardTemplates[selectedTemplateIndex]
          ? {
              label: "Edit",
              onClick: () => setEditMode(true),
              isActive: true,
              isRemove: false,
              color: "blue",
            }
          : null,
      });
    } else if (currentStep === 3) {
      setModalConfig({
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        backButtonTitle: currentCardTemplates[selectedTemplateIndex]?.name || "New Template",
        backButton: { label: currentCardTemplates[selectedTemplateIndex]?.name || "New Template", onClick: handleBack },
        title: currentCardTemplates[selectedTemplateIndex]?.sections[currentSectionIndex]?.name || "Section",
        leftButton: null,
        rightButton: {
          label: "Add Field",
          onClick: () => handleCreateHeader(),
          isActive: true,
          isRemove: false,
          color: "blue",
        },
      });
    } else if (currentStep === 4) {
      setModalConfig({
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        backButtonTitle: currentCardTemplates[selectedTemplateIndex]?.sections[currentSectionIndex]?.name || "Section",
        backButton: { label: currentCardTemplates[selectedTemplateIndex]?.sections[currentSectionIndex]?.name || "Section", onClick: handleBack },
        title: currentCardTemplates[selectedTemplateIndex]?.headers[activeHeaderIndex]?.name || "Edit Field",
        leftButton: null,
        rightButton: {
          label: "Save",
          onClick: saveHeader,
          isActive: true,
          isRemove: false,
        },
      });
    } else if (currentStep === 5) {
      setModalConfig({
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        backButtonTitle: currentCardTemplates[selectedTemplateIndex]?.sections[currentSectionIndex]?.name || "Section",
        backButton: { label: currentCardTemplates[selectedTemplateIndex]?.sections[currentSectionIndex]?.name || "Section", onClick: handleBack },
        title: "Create New Field",
        leftButton: null,
        rightButton: {
          label: "Save",
          onClick: saveHeader,
          isActive: true,
          isRemove: false,
        },
      });
    }

    if (prevStepRef.current !== currentStep) {
      setNavigationDirection(currentStep > prevStepRef.current ? "forward" : "backward");
      prevStepRef.current = currentStep;
    }
  }, [currentStep, selectedTemplateIndex, currentSectionIndex, editMode, currentCardTemplates, setModalConfig, saveHeader, handleBack]);

  // Confirm new template
  const confirmNewTemplate = useCallback(() => {
    if (!newTemplateName.trim()) {
      alert("Please enter a template name.");
      return;
    }
    if (currentCardTemplates.some((t) => t.name.toLowerCase() === newTemplateName.trim().toLowerCase())) {
      alert("A template with this name already exists. Please choose a unique name.");
      return;
    }

    const timestampId = `template_${Date.now()}`;
    const newTemplate = {
      docId: timestampId,
      id: timestampId,
      name: newTemplateName.trim(),
      typeOfCards: newTemplateName.trim(),
      headers: [
        {
          key: "id",
          name: "ID",
          type: "text",
          section: "Card Data",
          isUsed: true,
        },
        {
          key: "typeOfCards",
          name: "Type of Cards",
          type: "text",
          section: "Card Data",
          isUsed: true,
        },
      ],
      sections: [
        {
          name: "Primary Section",
          keys: [],
        },
        {
          name: "Card Data",
          keys: ["id", "typeOfCards"],
        },
      ],
      isModified: true,
      action: "add",
    };

    setCurrentCardTemplates((prev) => {
      const newTemplates = [...prev, newTemplate];
      setSelectedTemplateIndex(newTemplates.length - 1);
      setEditMode(false);
      return newTemplates;
    });
    setNavigationDirection("forward");
    goToStep(2);
  }, [newTemplateName, currentCardTemplates, goToStep]);

  // Add new section
  const addSection = useCallback(() => {
    if (selectedTemplateIndex === null) return;
    setCurrentCardTemplates((prev) => {
      const newTemplates = [...prev];
      const currentTemplate = { ...newTemplates[selectedTemplateIndex] };
      const newSectionName = `Section ${currentTemplate.sections.length + 1}`;
      if (currentTemplate.sections.some((s) => s.name.toLowerCase() === newSectionName.toLowerCase())) {
        alert(`Section name "${newSectionName}" already exists. Please use a unique name.`);
        return prev;
      }
      currentTemplate.sections = [...currentTemplate.sections, { name: newSectionName, keys: [] }];
      newTemplates[selectedTemplateIndex] = {
        ...currentTemplate,
        isModified: true,
        action: currentTemplate.action || "update",
      };
      return newTemplates;
    });
  }, [selectedTemplateIndex]);

  // Update section name
  const updateSectionName = useCallback(
    (index, newName) => {
      if (selectedTemplateIndex === null) return;
      setCurrentCardTemplates((prev) => {
        const newTemplates = [...prev];
        const currentTemplate = { ...newTemplates[selectedTemplateIndex] };
        const currentSection = currentTemplate.sections[index];
        
        if (currentSection.name === "Card Data") {
          alert("The 'Card Data' section cannot be renamed.");
          return prev;
        }

        if (
          newName.trim() &&
          currentTemplate.sections.some(
            (s, i) => i !== index && s.name.toLowerCase() === newName.trim().toLowerCase()
          )
        ) {
          alert(`Section name "${newName}" already exists. Please use a unique name.`);
          return prev;
        }
        const oldName = currentTemplate.sections[index].name;
        currentTemplate.sections[index].name = newName.trim();
        currentTemplate.headers = currentTemplate.headers.map((h) =>
          h.section === oldName ? { ...h, section: newName.trim() } : h
        );
        newTemplates[selectedTemplateIndex] = {
          ...currentTemplate,
          isModified: true,
          action: currentTemplate.action || "update",
        };
        return newTemplates;
      });
    },
    [selectedTemplateIndex]
  );

  // Delete section
  const handleDeleteSection = useCallback(
    (index) => {
      if (selectedTemplateIndex === null) return;
      const section = currentCardTemplates[selectedTemplateIndex].sections[index];
      
      if (section.name === "Card Data") {
        alert("The 'Card Data' section cannot be deleted as it contains critical fields.");
        return;
      }

      const sectionContainsProtectedKey = section.keys.some((key) => key === "id" || key === "typeOfCards");
      if (sectionContainsProtectedKey) {
        alert("This section cannot be deleted because it contains the 'ID' or 'Type of Cards' field.");
        return;
      }
      if (window.confirm(`Are you sure you want to delete the section "${section.name}"?`)) {
        setCurrentCardTemplates((prev) => {
          const newTemplates = [...prev];
          const currentTemplate = { ...newTemplates[selectedTemplateIndex] };
          const deletedSection = currentTemplate.sections[index];
          currentTemplate.sections = currentTemplate.sections.filter((_, i) => i !== index);
          currentTemplate.headers = currentTemplate.headers.map((h) =>
            h.section === deletedSection.name ? { ...h, section: "", isUsed: false } : h
          );
          newTemplates[selectedTemplateIndex] = {
            ...currentTemplate,
            isModified: true,
            action: currentTemplate.action || "update",
          };
          return newTemplates;
        });
        setNavigationDirection("backward");
        goBack();
      }
    },
    [selectedTemplateIndex, goBack]
  );

  // Drag-and-drop handlers
  const handleDragStart = useCallback((e, sectionIndex, index) => {
    const key = currentCardTemplates[selectedTemplateIndex].sections[sectionIndex].keys[index];
    if (key === "id" || key === "typeOfCards") {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    setDraggedSectionIndex(sectionIndex);
    e.dataTransfer.effectAllowed = "move";
    const element = keyRefs.current.get(`${sectionIndex}-${index}`);
    if (element) element.classList.add(styles.dragging);
  }, [selectedTemplateIndex, currentCardTemplates]);

  const handleTouchStart = useCallback((e, sectionIndex, index) => {
    const key = currentCardTemplates[selectedTemplateIndex].sections[sectionIndex].keys[index];
    if (key === "id" || key === "typeOfCards") {
      e.preventDefault();
      return;
    }
    if (e.target.classList.contains(styles.dragIcon)) {
      e.preventDefault();
      setDraggedIndex(index);
      setDraggedSectionIndex(sectionIndex);
      setTouchStartY(e.touches[0].clientY);
      setTouchTargetIndex(index);
      const element = keyRefs.current.get(`${sectionIndex}-${index}`);
      if (element) element.classList.add(styles.dragging);
    }
  }, [selectedTemplateIndex, currentCardTemplates]);

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
        newTemplates[selectedTemplateIndex] = {
          ...currentTemplate,
          isModified: true,
          action: currentTemplate.action || "update",
        };
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
          newTemplates[selectedTemplateIndex] = {
            ...currentTemplate,
            isModified: true,
            action: currentTemplate.action || "update",
          };
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

  // Open template editor
  const handleOpenEditor = useCallback(
    (template = null) => {
      if (template) {
        const existingIndex = currentCardTemplates.findIndex((t) => t.name === template.name);
        if (existingIndex >= 0) {
          setSelectedTemplateIndex(existingIndex);
          setEditMode(false);
          setNavigationDirection("forward");
          goToStep(2);
          return;
        }
      }

      setSelectedTemplateIndex(null);
      setNewTemplateName("");
      setEditMode(false);
      setNavigationDirection("forward");
      goToStep(2);
    },
    [currentCardTemplates, goToStep]
  );

  // Update template name
  const updateTemplateName = useCallback(
    (newName) => {
      if (selectedTemplateIndex === null) return;
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
          isModified: true,
          action: newTemplates[selectedTemplateIndex].action || "update",
        };
        return newTemplates;
      });
    },
    [selectedTemplateIndex]
  );

  // Edit section
  const handleEditSection = useCallback(
    (index) => {
      setCurrentSectionIndex(index);
      setNavigationDirection("forward");
      goToStep(3);
    },
    [goToStep]
  );

  // Toggle key selection
  const toggleKeySelection = useCallback(
    (sectionIndex, key) => {
      if (selectedTemplateIndex === null || sectionIndex === null) return;
      if (key === "id" || key === "typeOfCards") {
        alert("The 'ID' or 'Type of Cards' field cannot be deselected from the section.");
        return;
      }
      setCurrentCardTemplates((prev) => {
        const newTemplates = [...prev];
        const currentTemplate = { ...newTemplates[selectedTemplateIndex], headers: [...newTemplates[selectedTemplateIndex].headers] };
        const newSections = [...currentTemplate.sections];
        const section = { ...newSections[sectionIndex], keys: [...newSections[sectionIndex].keys] };
        const isSelected = section.keys.includes(key);
        if (isSelected) {
          section.keys = section.keys.filter((k) => k !== key);
        } else {
          section.keys.push(key);
        }
        newSections[sectionIndex] = section;
        currentTemplate.sections = newSections;
        currentTemplate.headers = currentTemplate.headers.map((h) =>
          h.key === key ? { ...h, isUsed: !isSelected } : h
        );
        newTemplates[selectedTemplateIndex] = {
          ...currentTemplate,
          isModified: true,
          action: currentTemplate.action || "update",
        };
        return newTemplates;
      });
    },
    [selectedTemplateIndex]
  );

  // Delete key from section
  const handleDeleteKey = useCallback(
    (sectionIndex, key) => {
      if (selectedTemplateIndex === null || sectionIndex === null) return;
      if (key === "id" || key === "typeOfCards") {
        alert("The 'ID' or 'Type of Cards' field cannot be removed from the section.");
        return;
      }
      if (window.confirm(`Are you sure you want to remove this field from the section?`)) {
        setCurrentCardTemplates((prev) => {
          const newTemplates = [...prev];
          const currentTemplate = { ...newTemplates[selectedTemplateIndex], headers: [...newTemplates[selectedTemplateIndex].headers] };
          const newSections = [...currentTemplate.sections];
          newSections[sectionIndex].keys = newSections[sectionIndex].keys.filter((k) => k !== key);
          currentTemplate.sections = newSections;
          currentTemplate.headers = currentTemplate.headers.map((h) =>
            h.key === key ? { ...h, isUsed: false } : h
          );
          newTemplates[selectedTemplateIndex] = {
            ...currentTemplate,
            isModified: true,
            action: currentTemplate.action || "update",
          };
          return newTemplates;
        });
      }
    },
    [selectedTemplateIndex]
  );

  // Filter headers for search
  const filteredHeaders = useCallback(() => {
    if (selectedTemplateIndex === null || currentSectionIndex === null) return [];

    const usedKeys = currentCardTemplates[selectedTemplateIndex]?.sections
      .flatMap((section) => section.keys) || [];

    return (
      currentCardTemplates[selectedTemplateIndex]?.headers?.filter(
        (header) =>
          !usedKeys.includes(header.key) &&
          [header.name, header.type, header.section].some((field) =>
            field?.toLowerCase().includes(searchQuery.toLowerCase())
          )
      ) || []
    );
  }, [currentCardTemplates, selectedTemplateIndex, currentSectionIndex, searchQuery]);

  // Delete template
  const handleDeleteTemplate = useCallback(() => {
    if (selectedTemplateIndex === null) return;
    const templateName = currentCardTemplates[selectedTemplateIndex].name;
    if (window.confirm(`Are you sure you want to delete the "${templateName}" template?`)) {
      setCurrentCardTemplates((prev) => {
        const newTemplates = prev.map((template, i) =>
          i === selectedTemplateIndex
            ? { ...template, isModified: true, action: "remove" }
            : template
        );
        setSelectedTemplateIndex(null);
        setEditMode(false);
        setNavigationDirection("backward");
        goToStep(1);
        return newTemplates;
      });
    }
  }, [selectedTemplateIndex, currentCardTemplates, goToStep]);

  // Edit header
  const handleEditHeader = useCallback(
    (index) => {
      if (selectedTemplateIndex === null) return;
      setActiveHeaderIndex(index);
      const header = currentCardTemplates[selectedTemplateIndex].headers[index];
      setNewHeaderName(header.name);
      setNewHeaderType(header.type || "text");
      setNewHeaderSection(header.section || "");
      setNewHeaderOptions(header.options || []);
      setNavigationDirection("forward");
      goToStep(4);
    },
    [selectedTemplateIndex, currentCardTemplates, goToStep]
  );

  // Create new header
  const handleCreateHeader = useCallback(() => {
    setActiveHeaderIndex(-1);
    resetHeaderForm();
    const currentSectionName = currentCardTemplates[selectedTemplateIndex].sections[currentSectionIndex].name;
    setNewHeaderSection(currentSectionName !== "Card Data" ? currentSectionName : "Primary Section");
    setNavigationDirection("forward");
    goToStep(5);
  }, [resetHeaderForm, goToStep, currentCardTemplates, selectedTemplateIndex, currentSectionIndex]);

  return (
    <div className={`${styles.templateWrapper} ${isDarkTheme ? styles.darkTheme : ""}`}>
      <div className={styles.viewContainer}>
        {[1, 2, 3, 4, 5].map((step) => (
          <div
            key={step}
            className={`${styles.view} ${isDarkTheme ? styles.darkTheme : ""} ${
              step !== currentStep ? styles.hidden : ""
            } ${
              step === currentStep && navigationDirection === "forward" ? styles.animateForward : ""
            } ${
              step === currentStep && navigationDirection === "backward" ? styles.animateBackward : ""
            }`}
            style={{ display: step !== currentStep ? "none" : "block" }}
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
                  {currentCardTemplates
                    .filter((template) => template.action !== "remove")
                    .map((template, index) => (
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

            {step === 2 && (
              <>
                {selectedTemplateIndex !== null && currentCardTemplates[selectedTemplateIndex] ? (
                  <>
                    <input
                      type="text"
                      value={currentCardTemplates[selectedTemplateIndex].name || ""}
                      onChange={(e) => updateTemplateName(e.target.value)}
                      placeholder="Template Name"
                      className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ""}`}
                      disabled={!editMode}
                    />
                    <h3 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Sections</h3>
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
                                <IoChevronForward
                                  className={`${styles.chevronIcon} ${isDarkTheme ? styles.darkTheme : ""}`}
                                />
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
                  disabled={currentCardTemplates[selectedTemplateIndex].sections[currentSectionIndex].name === "Card Data"}
                />
                <div className={styles.searchContainer}>
                  <FaSearch className={styles.searchIcon} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search fields by name, type, or section"
                    className={`${styles.searchInput} ${isDarkTheme ? styles.darkTheme : ""}`}
                  />
                </div>
                <div className={styles.section}>
                  {currentCardTemplates[selectedTemplateIndex].sections[currentSectionIndex].keys.map((key, index) => {
                    const header = currentCardTemplates[selectedTemplateIndex].headers.find((h) => h.key === key) || {
                      key,
                      name: key,
                      type: "text",
                    };
                    const headerIndex = currentCardTemplates[selectedTemplateIndex].headers.findIndex((h) => h.key === key);
                    return (
                      <div
                        ref={(el) => keyRefs.current.set(`${currentSectionIndex}-${index}`, el)}
                        key={index}
                        className={`${styles.keyItem} ${
                          draggedIndex === index && draggedSectionIndex === currentSectionIndex ? styles.dragging : ""
                        } ${isDarkTheme ? styles.darkTheme : ""}`}
                        draggable={!(key === "id" || key === "typeOfCards")}
                        onDragStart={(e) => !editMode && handleDragStart(e, currentSectionIndex, index)}
                        onDragOver={(e) => !editMode && handleDragOver(e, currentSectionIndex, index)}
                        onDragEnd={() => !editMode && handleDragEnd()}
                        onTouchStart={(e) => !editMode && handleTouchStart(e, currentSectionIndex, index)}
                        onTouchMove={(e) => !editMode && handleTouchMove(e, currentSectionIndex, index)}
                        onTouchEnd={() => !editMode && handleTouchEnd()}
                        onClick={() => !editMode && toggleKeySelection(currentSectionIndex, header.key)}
                      >
                        {editMode && header.key !== "id" && header.key !== "typeOfCards" && (
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
                            {currentCardTemplates[selectedTemplateIndex].sections[currentSectionIndex].keys.includes(
                              header.key
                            ) ? (
                              <FaRegCheckCircle size={18} className={styles.checked} />
                            ) : (
                              <FaRegCircle size={18} />
                            )}
                          </span>
                          <span className={styles.headerName}>{header.name}</span>
                          <span className={styles.headerType}>({header.type})</span>
                          {header.section && <span className={styles.headerSection}>- {header.section}</span>}
                        </div>
                        {!editMode && (
                          <div className={styles.headerActions}>
                            <button
                              className={`${styles.infoButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                headerIndex !== -1 && handleEditHeader(headerIndex);
                              }}
                            >
                              <FaInfoCircle />
                            </button>
                            <span className={`${styles.dragIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                              {header.key === "id" || header.key === "typeOfCards" ? "" : "☰"}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filteredHeaders().map((header) => {
                    const headerIndex = currentCardTemplates[selectedTemplateIndex].headers.findIndex(
                      (h) => h.key === header.key
                    );
                    return (
                      <div
                        key={header.key}
                        className={`${styles.keyItem} ${isDarkTheme ? styles.darkTheme : ""}`}
                        onClick={() => !editMode && toggleKeySelection(currentSectionIndex, header.key)}
                      >
                        <div className={styles.headerContent}>
                          <span className={`${styles.customCheckbox} ${isDarkTheme ? styles.darkTheme : ""}`}>
                            {currentCardTemplates[selectedTemplateIndex].sections[currentSectionIndex].keys.includes(
                              header.key
                            ) ? (
                              <FaRegCheckCircle size={18} className={styles.checked} />
                            ) : (
                              <FaRegCircle size={18} />
                            )}
                          </span>
                          <span className={styles.headerName}>{header.name}</span>
                          <span className={styles.headerType}>({header.type})</span>
                          {header.section && <span className={styles.headerSection}>- {header.section}</span>}
                        </div>
                        {!editMode && (
                          <div className={styles.headerActions}>
                            <button
                              className={`${styles.infoButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                headerIndex !== -1 && handleEditHeader(headerIndex);
                              }}
                            >
                              <FaInfoCircle />
                            </button>
                            <span className={`${styles.dragIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>☰</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button
                  className={`${styles.deleteSectionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                  onClick={() => handleDeleteSection(currentSectionIndex)}
                  disabled={currentCardTemplates[selectedTemplateIndex].sections[currentSectionIndex].name === "Card Data"}
                >
                  Delete Section
                </button>
              </>
            )}

            {step === 4 &&
              selectedTemplateIndex !== null &&
              activeHeaderIndex !== null &&
              currentCardTemplates[selectedTemplateIndex]?.headers[activeHeaderIndex] && (
              <div
                className={`${styles.editActions} ${isDarkTheme ? styles.darkTheme : ""}`}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  value={newHeaderName}
                  onChange={(e) => setNewHeaderName(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Field Name"
                  className={`${styles.inputField} ${isDarkTheme ? styles.darkTheme : ""}`}
                />
                <select
                  value={newHeaderType}
                  onChange={(e) => setNewHeaderType(e.target.value)}
                  className={`${styles.selectField} ${isDarkTheme ? styles.darkTheme : ""}`}
                  disabled
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="currency">Currency</option>
                  <option value="dropdown">Pop-up Menu</option>
                </select>
                {currentCardTemplates[selectedTemplateIndex].headers[activeHeaderIndex].key === "id" ||
                currentCardTemplates[selectedTemplateIndex].headers[activeHeaderIndex].key === "typeOfCards" ? (
                  <select
                    value={newHeaderSection}
                    onChange={(e) => setNewHeaderSection(e.target.value)}
                    className={`${styles.selectField} ${isDarkTheme ? styles.darkTheme : ""}`}
                    disabled
                  >
                    <option value="Card Data">Card Data</option>
                  </select>
                ) : (
                  <select
                    value={newHeaderSection}
                    onChange={(e) => setNewHeaderSection(e.target.value)}
                    className={`${styles.selectField} ${isDarkTheme ? styles.darkTheme : ""}`}
                  >
                    <option value="">Select Section</option>
                    {currentCardTemplates[selectedTemplateIndex].sections
                      .filter((section) => section.name !== "Card Data")
                      .map((section, index) => (
                        <option key={index} value={section.name}>
                          {section.name}
                        </option>
                      ))}
                  </select>
                )}
                {newHeaderType === "dropdown" && (
                  <div className={styles.optionsSection}>
                    <div className={styles.optionInputRow}>
                      <input
                        type="text"
                        value={newOption}
                        onChange={(e) => setNewOption(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && addOption()}
                        placeholder="Add item"
                        className={`${styles.inputField} ${isDarkTheme ? styles.darkTheme : ""}`}
                      />
                      <button
                        onClick={addOption}
                        className={`${styles.addOptionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                      >
                        +
                      </button>
                    </div>
                    <div className={styles.optionsList}>
                      {newHeaderOptions.map((option) => (
                        <div key={option} className={`${styles.optionItem} ${isDarkTheme ? styles.darkTheme : ""}`}>
                          <span>{option}</span>
                          <button
                            onClick={() => removeOption(option)}
                            className={`${styles.removeOptionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className={styles.editActionsButtons}>
                  {currentCardTemplates[selectedTemplateIndex].headers[activeHeaderIndex].key !== "id" &&
                    currentCardTemplates[selectedTemplateIndex].headers[activeHeaderIndex].key !== "typeOfCards" && (
                      <button
                        onClick={() => deleteHeader(activeHeaderIndex)}
                        className={`${styles.deleteButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                      >
                        Remove
                      </button>
                    )}
                </div>
              </div>
            )}

            {step === 5 && selectedTemplateIndex !== null && (
              <div
                className={`${styles.editActions} ${isDarkTheme ? styles.darkTheme : ""}`}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  value={newHeaderName}
                  onChange={(e) => setNewHeaderName(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Field Name"
                  className={`${styles.inputField} ${isDarkTheme ? styles.darkTheme : ""}`}
                />
                <select
                  value={newHeaderType}
                  onChange={(e) => setNewHeaderType(e.target.value)}
                  className={`${styles.selectField} ${isDarkTheme ? styles.darkTheme : ""}`}
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="currency">Currency</option>
                  <option value="dropdown">Pop-up Menu</option>
                </select>
                <select
                  value={newHeaderSection}
                  onChange={(e) => setNewHeaderSection(e.target.value)}
                  className={`${styles.selectField} ${isDarkTheme ? styles.darkTheme : ""}`}
                >
                  <option value="">Select Section</option>
                  {currentCardTemplates[selectedTemplateIndex].sections
                    .filter((section) => section.name !== "Card Data")
                    .map((section, index) => (
                      <option key={index} value={section.name}>
                        {section.name}
                      </option>
                    ))}
                </select>
                {newHeaderType === "dropdown" && (
                  <div className={styles.optionsSection}>
                    <div className={styles.optionInputRow}>
                      <input
                        type="text"
                        value={newOption}
                        onChange={(e) => setNewOption(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && addOption()}
                        placeholder="Add item"
                        className={`${styles.inputField} ${isDarkTheme ? styles.darkTheme : ""}`}
                      />
                      <button
                        onClick={addOption}
                        className={`${styles.addOptionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                      >
                        +
                      </button>
                    </div>
                    <div className={styles.optionsList}>
                      {newHeaderOptions.map((option) => (
                        <div key={option} className={`${styles.optionItem} ${isDarkTheme ? styles.darkTheme : ""}`}>
                          <span>{option}</span>
                          <button
                            onClick={() => removeOption(option)}
                            className={`${styles.removeOptionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
        headers: PropTypes.arrayOf(
          PropTypes.shape({
            key: PropTypes.string,
            name: PropTypes.string,
            type: PropTypes.string,
            section: PropTypes.string,
            isUsed: PropTypes.bool,
            options: PropTypes.arrayOf(PropTypes.string),
          })
        ),
        sections: PropTypes.arrayOf(
          PropTypes.shape({
            name: PropTypes.string,
            keys: PropTypes.arrayOf(PropTypes.string),
          })  
        ),
        isModified: PropTypes.bool,
        action: PropTypes.oneOf(["add", "update", "remove", null]),
      })
    ),
  }).isRequired,
  setTempData: PropTypes.func.isRequired,
  businessId: PropTypes.string, // <-- add this line
};

export default CardsTemplate;