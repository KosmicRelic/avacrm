import { useState, useContext, useCallback, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import styles from "./CardsTemplate.module.css";
import { MainContext } from "../../Contexts/MainContext";
import { ModalNavigatorContext } from "../../Contexts/ModalNavigator";
import { FaPlus, FaSearch, FaRegCircle, FaRegCheckCircle, FaDownload, FaTrash, FaDatabase, FaLayerGroup } from "react-icons/fa";
import { IoChevronForward } from "react-icons/io5";
import { BsDashCircle } from "react-icons/bs";
import { MdDragIndicator } from "react-icons/md";
import { v4 as uuidv4 } from "uuid";
import isEqual from "lodash/isEqual"; // Import lodash for deep comparison
import { db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { exportArrayToCsv } from '../../Utils/exportArrayToCsv';

const CardsTemplate = ({ tempData, setTempData, businessId: businessIdProp }) => {
  const { cardTemplates, isDarkTheme, businessId: businessIdContext } = useContext(MainContext);
  const { registerModalSteps, goToStep, goBack, currentStep, setModalConfig } = useContext(ModalNavigatorContext);

  const businessId = businessIdProp || businessIdContext;

  const [currentCardTemplates, setCurrentCardTemplates] = useState(() =>
    (tempData.currentCardTemplates || cardTemplates || []).map((t) => ({
      ...t,
      headers: t.headers.map((h) => ({
        ...h,
        isUsed: h.key === "docId" || h.key === "typeOfCards" || h.key === "assignedTo" ? true : h.isUsed ?? false,
      })),
      sections: t.sections.map((s) => ({
        ...s,
        keys: s.keys.includes("docId") || s.keys.includes("typeOfCards") || s.keys.includes("assignedTo") ? s.keys : [...s.keys],
      })),
      isModified: t.isModified || false,
      action: t.action || null,
    }))
  );
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [draggedSectionIndex, setDraggedSectionIndex] = useState(null);
  const [draggedSectionOrderIndex, setDraggedSectionOrderIndex] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchTargetIndex, setTouchTargetIndex] = useState(null);
  const [sectionTouchStartY, setSectionTouchStartY] = useState(null);
  const [sectionTouchTargetIndex, setSectionTouchTargetIndex] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [newTemplateName, setNewTemplateName] = useState("");
  const [activeHeaderIndex, setActiveHeaderIndex] = useState(null);
  const [newHeaderName, setNewHeaderName] = useState("");
  const [newHeaderType, setNewHeaderType] = useState("text");
  const [newHeaderSection, setNewHeaderSection] = useState("");
  const [newHeaderOptions, setNewHeaderOptions] = useState([]);
  const [newOption, setNewOption] = useState("");
  const [navigationDirection, setNavigationDirection] = useState(null);
  const [deletedHeaderKeys, setDeletedHeaderKeys] = useState([]);
  const [copiedHeaderId, setCopiedHeaderId] = useState(false);
  const keyRefs = useRef(new Map());
  const sectionRefs = useRef(new Map());
  const hasInitialized = useRef(false);
  const prevCardTemplatesRef = useRef(currentCardTemplates);
  const prevStepRef = useRef(currentStep);
  const lastTempDataRef = useRef({ currentCardTemplates, deletedHeaderKeys });

  // Memoize currentCardTemplates to prevent unnecessary re-renders
  useEffect(() => {
    prevCardTemplatesRef.current = currentCardTemplates;
  }, [currentCardTemplates]);

  // Update tempData only when necessary (prevent infinite loop)
  useEffect(() => {
    if (
      !isEqual(lastTempDataRef.current.currentCardTemplates, currentCardTemplates) ||
      !isEqual(lastTempDataRef.current.deletedHeaderKeys, deletedHeaderKeys)
    ) {
      setTempData({ currentCardTemplates, deletedHeaderKeys });
      lastTempDataRef.current = { currentCardTemplates, deletedHeaderKeys };
    }
     
  }, [currentCardTemplates, deletedHeaderKeys, setTempData]);

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

  const deleteHeader = useCallback(
    (index) => {
      if (selectedTemplateIndex === null) return;
      const header = currentCardTemplates[selectedTemplateIndex].headers[index];
      if (header.key === "docId" || header.key === "typeOfCards" || header.key === "assignedTo") {
        alert("The 'ID', 'Type of Cards' or 'Assigned To' field cannot be deleted.");
        return;
      }
      const headerName = header.name;
      if (window.confirm(`Are you sure you want to delete the field "${headerName}"?`)) {
        setDeletedHeaderKeys((prev) => [...new Set([...prev, header.key])]); // Avoid duplicates
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
    [selectedTemplateIndex, goBack, currentCardTemplates]
  );

  const handleDeleteSection = useCallback(
    (index) => {
      if (selectedTemplateIndex === null) return;
      const section = currentCardTemplates[selectedTemplateIndex].sections[index];
      if (section.name === "Card Data") {
        alert("The 'Card Data' section cannot be deleted as it contains critical fields.");
        return;
      }
      const sectionContainsProtectedKey = section.keys.some((key) => key === "docId" || key === "typeOfCards" || key === "assignedTo");
      if (sectionContainsProtectedKey) {
        alert("This section cannot be deleted because it contains the 'ID', 'Type of Cards' or 'Assigned To' field.");
        return;
      }
      if (window.confirm(`Are you sure you want to delete the section "${section.name}"?`)) {
        setDeletedHeaderKeys((prev) => [...new Set([...prev, ...section.keys])]); // Avoid duplicates
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
    [selectedTemplateIndex, goBack, currentCardTemplates]
  );

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
      alert("The 'Card Data' section is reserved for 'ID', 'Type of Cards' and 'Assigned To' fields.");
      return;
    }

    const newHeader = {
      key: uuidv4(),
      name: newHeaderName.trim(),
      type: newHeaderType,
      section: newHeaderSection,
      isUsed: true,
      ...(newHeaderType === "dropdown" || newHeaderType === "multi-select" ? { options: [...newHeaderOptions] } : {}),
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
      const isProtected = currentHeader.key === "docId" || currentHeader.key === "typeOfCards" || currentHeader.key === "assignedTo";

      if (isProtected && newHeaderSection !== "Card Data") {
        alert("The 'ID', 'Type of Cards' and 'Assigned To' fields must remain in the 'Card Data' section.");
        return;
      }

      // Prevent changing type when editing an existing header
      if (currentHeader.type !== newHeaderType) {
        alert("You cannot change the type of a field after it has been created.");
        return;
      }

      setCurrentCardTemplates((prev) => {
        const newTemplates = [...prev];
        const template = { ...newTemplates[selectedTemplateIndex] };
        const headers = [...template.headers];
        const sections = template.sections.map((s) => ({ ...s, keys: [...s.keys] })); // Deep copy sections
        headers[index] = {
          ...headers[index],
          name: newHeaderName.trim(),
          // type: newHeaderType, // Do not update type on edit
          section: newHeaderSection,
          ...(newHeaderType === "dropdown" || newHeaderType === "multi-select" ? { options: [...newHeaderOptions] } : {}),
        };

        // Update sections' keys if section changed
        if (currentHeader.section !== newHeaderSection) {
          sections.forEach((section) => {
            if (section.name === currentHeader.section) {
              section.keys = section.keys.filter((key) => key !== currentHeader.key);
            }
            if (section.name === newHeaderSection) {
              if (!section.keys.includes(currentHeader.key)) {
                section.keys = [...section.keys, currentHeader.key];
              }
            }
          });
        }

        newTemplates[selectedTemplateIndex] = {
          ...template,
          headers,
          sections,
          isModified: true,
          action: template.action || "update",
        };
        return newTemplates;
      });
      resetHeaderForm();
      setActiveHeaderIndex(null);
      setNavigationDirection("backward");
      goBack();
    },
    [newHeaderName, newHeaderType, newHeaderSection, newHeaderOptions, selectedTemplateIndex, validateHeader, resetHeaderForm, goBack, currentCardTemplates]
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
        showBackButton: !editMode,
        backButtonTitle: currentCardTemplates[selectedTemplateIndex]?.name || "New Template",
        backButton: editMode ? null : { label: currentCardTemplates[selectedTemplateIndex]?.name || "New Template", onClick: handleBack },
        title: currentCardTemplates[selectedTemplateIndex]?.sections[currentSectionIndex]?.name || "Section",
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
      name: newTemplateName.trim(),
      typeOfCards: newTemplateName.trim(),
      headers: [
        {
          key: "docId",
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
        {
          key: "assignedTo",
          name: "Assigned To",
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
          keys: ["docId", "typeOfCards", "assignedTo"],
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
  }, [selectedTemplateIndex, currentCardTemplates]);
  
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
    [selectedTemplateIndex, currentCardTemplates]
  );

  // Drag-and-drop handlers
  const handleDragStart = useCallback((e, sectionIndex, index) => {
    const key = currentCardTemplates[selectedTemplateIndex].sections[sectionIndex].keys[index];
    if (key === "docId" || key === "typeOfCards" || key === "assignedTo") {
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
    if (key === "docId" || key === "typeOfCards" || key === "assignedTo") {
      e.preventDefault();
      return;
    }
    // Check if touch is on drag icon or its parent
    const isDragIcon = e.target.classList.contains(styles.dragIcon) ||
                      e.target.parentElement?.classList.contains(styles.dragIcon) ||
                      e.target.closest(`.${styles.dragIcon}`);
    if (isDragIcon) {
      e.preventDefault();
      setDraggedIndex(index);
      setDraggedSectionIndex(sectionIndex);
      setTouchStartY(e.touches[0].clientY);
      setTouchTargetIndex(index);
      const element = keyRefs.current.get(`${sectionIndex}-${index}`);
      if (element) element.classList.add(styles.dragging);
    }
  }, [selectedTemplateIndex, currentCardTemplates, styles.dragIcon]);

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
    [draggedIndex, draggedSectionIndex, selectedTemplateIndex, currentCardTemplates]
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

  // Section drag handlers
  const handleSectionDragStart = useCallback((e, index) => {
    setDraggedSectionOrderIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    const element = sectionRefs.current.get(index);
    if (element) element.classList.add(styles.dragging);
  }, [styles.dragging]);

  const handleSectionTouchStart = useCallback((e, index) => {
    // Check if touch is on drag icon or its parent
    const isDragIcon = e.target.classList.contains(styles.dragIcon) ||
                      e.target.parentElement?.classList.contains(styles.dragIcon) ||
                      e.target.closest(`.${styles.dragIcon}`);
    if (isDragIcon) {
      e.preventDefault();
      setDraggedSectionOrderIndex(index);
      setSectionTouchStartY(e.touches[0].clientY);
      setSectionTouchTargetIndex(index);
      const element = sectionRefs.current.get(index);
      if (element) element.classList.add(styles.dragging);
    }
  }, [styles.dragIcon]);

  const handleSectionDragOver = useCallback((e, index) => {
    e.preventDefault();
    if (draggedSectionOrderIndex === null || draggedSectionOrderIndex === index) return;
    setCurrentCardTemplates((prev) => {
      const newTemplates = [...prev];
      const currentTemplate = { ...newTemplates[selectedTemplateIndex] };
      const newSections = [...currentTemplate.sections];
      const [draggedSection] = newSections.splice(draggedSectionOrderIndex, 1);
      newSections.splice(index, 0, draggedSection);
      currentTemplate.sections = newSections;
      newTemplates[selectedTemplateIndex] = {
        ...currentTemplate,
        isModified: true,
        action: currentTemplate.action || 'update',
      };
      setDraggedSectionOrderIndex(index);
      return newTemplates;
    });
  }, [draggedSectionOrderIndex, selectedTemplateIndex]);

  const handleSectionTouchMove = useCallback((e, index) => {
    if (draggedSectionOrderIndex === null || sectionTouchStartY === null) return;
    e.preventDefault();
    const touchY = e.touches[0].clientY;
    const itemHeight = 44;
    const delta = Math.round((touchY - sectionTouchStartY) / itemHeight);
    const newIndex = Math.max(0, Math.min(sectionTouchTargetIndex + delta, currentCardTemplates[selectedTemplateIndex].sections.length - 1));
    if (newIndex !== draggedSectionOrderIndex) {
      setCurrentCardTemplates((prev) => {
        const newTemplates = [...prev];
        const currentTemplate = { ...newTemplates[selectedTemplateIndex] };
        const newSections = [...currentTemplate.sections];
        const [draggedSection] = newSections.splice(draggedSectionOrderIndex, 1);
        newSections.splice(newIndex, 0, draggedSection);
        currentTemplate.sections = newSections;
        newTemplates[selectedTemplateIndex] = {
          ...currentTemplate,
          isModified: true,
          action: currentTemplate.action || 'update',
        };
        setDraggedSectionOrderIndex(newIndex);
        return newTemplates;
      });
    }
  }, [draggedSectionOrderIndex, sectionTouchStartY, sectionTouchTargetIndex, selectedTemplateIndex, currentCardTemplates]);

  const handleSectionDragEnd = useCallback(() => {
    const element = sectionRefs.current.get(draggedSectionOrderIndex);
    if (element) element.classList.remove(styles.dragging);
    setDraggedSectionOrderIndex(null);
  }, [draggedSectionOrderIndex, styles.dragging]);

  const handleSectionTouchEnd = useCallback(() => {
    const element = sectionRefs.current.get(draggedSectionOrderIndex);
    if (element) element.classList.remove(styles.dragging);
    setDraggedSectionOrderIndex(null);
    setSectionTouchStartY(null);
    setSectionTouchTargetIndex(null);
  }, [draggedSectionOrderIndex, styles.dragging]);

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
      if (key === "docId" || key === "typeOfCards" || key === "assignedTo") {
        alert("The 'ID', 'Type of Cards' or 'Assigned To' field cannot be deselected from the section.");
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
      if (key === "docId" || key === "typeOfCards" || key === "assignedTo") {
        alert("The 'ID', 'Type of Cards' or 'Assigned To' field cannot be removed from the section.");
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

  // Export cards for the current template
  const exportCards = useCallback(async () => {
    if (selectedTemplateIndex === null) {
      alert('No template selected.');
      return;
    }
    const template = currentCardTemplates[selectedTemplateIndex];
    const typeOfCards = template.name;
    if (!typeOfCards || !businessId) {
      alert('Missing template name or business ID.');
      return;
    }
    try {
      const cardsRef = collection(db, 'businesses', businessId, 'cards');
      const q = query(cardsRef, where('typeOfCards', '==', typeOfCards));
      const snapshot = await getDocs(q);
      const cards = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() })); // changed id to docId
      if (!cards.length) {
        alert('No cards found for this template.');
        return;
      }
      exportArrayToCsv(`${typeOfCards}_cards_export.csv`, cards);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export cards.');
    }
  }, [selectedTemplateIndex, currentCardTemplates, businessId]);

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
                <div className={styles.section}>
                  <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Create New Template</h2>
                  <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Start building your card data structure.</p>
                  <div className={`${styles.configGrid} ${isDarkTheme ? styles.darkTheme : ""}`}>
                    <div
                      onClick={() => handleOpenEditor()}
                      className={`${styles.configCard} ${isDarkTheme ? styles.darkTheme : ""}`}
                      role="button"
                      aria-label="Add New Card Template"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          handleOpenEditor();
                        }
                      }}
                    >
                      <div className={`${styles.cardIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                        <FaPlus size={24} />
                      </div>
                      <div className={styles.cardContent}>
                        <h3 className={`${styles.cardTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>New Template</h3>
                        <p className={`${styles.cardDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Create a custom template for your cards</p>
                      </div>
                      <div className={`${styles.cardArrow} ${isDarkTheme ? styles.darkTheme : ""}`}>
                        <IoChevronForward size={16} />
                      </div>
                    </div>
                  </div>
                </div>
                {currentCardTemplates.filter((template) => template.action !== "remove").length > 0 && (
                  <div className={styles.section}>
                    <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Your Templates</h2>
                    <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Manage and edit your existing card templates.</p>
                    <div className={`${styles.configGrid} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      {currentCardTemplates
                        .filter((template) => template.action !== "remove")
                        .map((template, index) => (
                          <div
                            key={index}
                            onClick={() => handleOpenEditor(template)}
                            className={`${styles.configCard} ${isDarkTheme ? styles.darkTheme : ""}`}
                            role="button"
                            aria-label={`Edit ${template.name || "Unnamed Template"}`}
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                handleOpenEditor(template);
                              }
                            }}
                          >
                            <div className={`${styles.cardIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                              <FaRegCircle size={24} />
                            </div>
                            <div className={styles.cardContent}>
                              <h3 className={`${styles.cardTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>{template.name || "Unnamed Template"}</h3>
                              <p className={`${styles.cardDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Configure sections and fields</p>
                              <div className={`${styles.cardBadge} ${isDarkTheme ? styles.darkTheme : ""}`}>
                                {template.sections?.length || 0} sections
                              </div>
                            </div>
                            <div className={`${styles.cardArrow} ${isDarkTheme ? styles.darkTheme : ""}`}>
                              <IoChevronForward size={16} />
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {step === 2 && (
              <>
                {selectedTemplateIndex !== null && currentCardTemplates[selectedTemplateIndex] ? (
                  <>
                    <div className={styles.section}>
                      <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Template Details</h2>
                      <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Configure your template name and structure.</p>
                      <input
                        type="text"
                        value={currentCardTemplates[selectedTemplateIndex].name || ""}
                        onChange={(e) => updateTemplateName(e.target.value)}
                        placeholder="Template Name"
                        className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ""}`}
                        disabled={!editMode}
                      />
                    </div>
                    {!editMode && (
                      <div className={styles.section}>
                        <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Actions</h2>
                        <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Manage your template and data.</p>
                        <div className={`${styles.configGrid} ${isDarkTheme ? styles.darkTheme : ""}`}>
                          <div
                            onClick={addSection}
                            className={`${styles.configCard} ${isDarkTheme ? styles.darkTheme : ""}`}
                            role="button"
                            aria-label="Add New Section"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                addSection();
                              }
                            }}
                          >
                            <div className={`${styles.cardIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                              <FaPlus size={24} />
                            </div>
                            <div className={styles.cardContent}>
                              <h3 className={`${styles.cardTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Add Section</h3>
                              <p className={`${styles.cardDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Create a new section for your template</p>
                            </div>
                            <div className={`${styles.cardArrow} ${isDarkTheme ? styles.darkTheme : ""}`}>
                              <IoChevronForward size={16} />
                            </div>
                          </div>
                          <div
                            onClick={exportCards}
                            className={`${styles.configCard} ${isDarkTheme ? styles.darkTheme : ""}`}
                            role="button"
                            aria-label="Export Cards"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                exportCards();
                              }
                            }}
                          >
                            <div className={`${styles.cardIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                              <FaDownload size={24} />
                            </div>
                            <div className={styles.cardContent}>
                              <h3 className={`${styles.cardTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Export Cards</h3>
                              <p className={`${styles.cardDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Download your card data as CSV</p>
                            </div>
                            <div className={`${styles.cardArrow} ${isDarkTheme ? styles.darkTheme : ""}`}>
                              <IoChevronForward size={16} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className={styles.section}>
                      <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Sections</h2>
                      <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Organize your card data into logical sections.</p>
                      <div className={`${styles.sectionsGrid} ${isDarkTheme ? styles.darkTheme : ""}`}>
                        {currentCardTemplates[selectedTemplateIndex].sections.map((section, index) => (
                        <div
                          ref={(el) => sectionRefs.current.set(index, el)}
                          key={index}
                          className={`${styles.configCard} ${
                            draggedSectionOrderIndex === index ? styles.dragging : ""
                          } ${isDarkTheme ? styles.darkTheme : ""}`}
                          draggable={editMode}
                          onDragStart={editMode ? (e) => handleSectionDragStart(e, index) : undefined}
                          onDragOver={editMode ? (e) => handleSectionDragOver(e, index) : undefined}
                          onDragEnd={editMode ? handleSectionDragEnd : undefined}
                          onTouchStart={editMode ? (e) => handleSectionTouchStart(e, index) : undefined}
                          onTouchMove={editMode ? (e) => handleSectionTouchMove(e, index) : undefined}
                          onTouchEnd={editMode ? handleSectionTouchEnd : undefined}
                          onClick={() => !editMode && handleEditSection(index)}
                          role="button"
                          aria-label={`Edit ${section.name} section`}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if ((e.key === "Enter" || e.key === " ") && !editMode) {
                              handleEditSection(index);
                            }
                          }}
                        >
                          <div className={`${styles.cardIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                            {section.name === "Card Data" ? (
                              <FaDatabase size={24} />
                            ) : (
                              <FaLayerGroup size={24} />
                            )}
                          </div>
                          <div className={styles.cardContent}>
                            <div className={styles.headerRow}>
                              <div className={styles.headerMain}>
                                <h3 className={`${styles.cardTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>{section.name}</h3>
                              </div>
                              {!editMode && (
                                <div className={`${styles.cardArrow} ${isDarkTheme ? styles.darkTheme : ""}`}>
                                  <IoChevronForward size={16} />
                                </div>
                              )}
                            </div>
                            <p className={`${styles.cardDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>
                              {section.name === "Card Data" ? "Core system fields" : "Custom section"} • {section.keys?.length || 0} fields
                            </p>
                          </div>
                          {editMode && (
                            <div className={styles.sectionActions}>
                              <span className={`${styles.dragIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                                <MdDragIndicator size={16} />
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                      </div>
                    </div>
                    {editMode && (
                      <div className={styles.section}>
                        <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Danger Zone</h2>
                        <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Permanently delete this template and all its data.</p>
                        <button
                          onClick={handleDeleteTemplate}
                          className={`${styles.deleteSectionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                          aria-label="Delete Template"
                        >
                          Delete Template
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className={styles.section}>
                      <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Create New Template</h2>
                      <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Start building your card template structure.</p>
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
                    </div>
                  </>
                )}
              </>
            )}

            {step === 3 &&
              selectedTemplateIndex !== null &&
              currentSectionIndex !== null &&
              currentCardTemplates[selectedTemplateIndex]?.sections[currentSectionIndex] && (
              <>
                <div className={styles.section}>
                  <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Section Configuration</h2>
                  <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Customize the section name and manage its fields.</p>
                  <input
                    type="text"
                    value={currentCardTemplates[selectedTemplateIndex].sections[currentSectionIndex].name || ""}
                    onChange={(e) => updateSectionName(currentSectionIndex, e.target.value)}
                    className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ""}`}
                    placeholder="Section Name"
                    disabled={currentCardTemplates[selectedTemplateIndex].sections[currentSectionIndex].name === "Card Data" || !editMode}
                  />
                </div>
                {!editMode && (
                  <div className={styles.section}>
                    <h3 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Actions</h3>
                    <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Manage fields in this section.</p>
                    <div className={`${styles.configGrid} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      <div
                        onClick={() => handleCreateHeader()}
                        className={`${styles.configCard} ${isDarkTheme ? styles.darkTheme : ""}`}
                        role="button"
                        aria-label="Add New Field"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            handleCreateHeader();
                          }
                        }}
                      >
                        <div className={`${styles.cardIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                          <FaPlus size={24} />
                        </div>
                        <div className={styles.cardContent}>
                          <h3 className={`${styles.cardTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Add Field</h3>
                          <p className={`${styles.cardDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Create a new field for this section</p>
                        </div>
                        <div className={`${styles.cardArrow} ${isDarkTheme ? styles.darkTheme : ""}`}>
                          <IoChevronForward size={16} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div className={styles.section}>
                  <div className={styles.section}>
                    <h3 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Fields in Section</h3>
                    <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>These fields are currently included in this section.</p>
                    {currentCardTemplates[selectedTemplateIndex].sections[currentSectionIndex].keys.map((key, index) => {
                      const header = currentCardTemplates[selectedTemplateIndex].headers.find((h) => h.key === key) || {
                        key,
                        name: key,
                        type: "text",
                      };
                      const headerIndex = currentCardTemplates[selectedTemplateIndex].headers.findIndex((h) => h.key === key);
                      const isProtected = header.key === "docId" || header.key === "typeOfCards" || header.key === "assignedTo";
                      return (
                        <div
                          ref={(el) => keyRefs.current.set(`${currentSectionIndex}-${index}`, el)}
                          key={index}
                          className={`${styles.keyItem} ${
                            draggedIndex === index && draggedSectionIndex === currentSectionIndex ? styles.dragging : ""
                          } ${isDarkTheme ? styles.darkTheme : ""}`}
                          draggable={editMode && !isProtected}
                          onDragStart={(e) => editMode && handleDragStart(e, currentSectionIndex, index)}
                          onDragOver={(e) => editMode && handleDragOver(e, currentSectionIndex, index)}
                          onDragEnd={() => editMode && handleDragEnd()}
                          onTouchStart={(e) => editMode && handleTouchStart(e, currentSectionIndex, index)}
                          onTouchMove={(e) => editMode && handleTouchMove(e, currentSectionIndex, index)}
                          onTouchEnd={() => editMode && handleTouchEnd()}
                          onClick={(e) => {
                            const isCheckboxClick = e.target.closest(`.${styles.customCheckbox}`);
                            if (isCheckboxClick) {
                              !editMode && toggleKeySelection(currentSectionIndex, header.key);
                            } else if (headerIndex !== -1) {
                              handleEditHeader(headerIndex);
                            }
                          }}
                        >
                          <div className={styles.headerContent}>
                            <div className={styles.headerRow}>
                              <div className={styles.headerMain}>
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
                              </div>
                              {editMode ? (
                                <div className={styles.headerActions}>
                                  <span className={`${styles.dragIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                                    {isProtected ? "" : <MdDragIndicator size={16} />}
                                  </span>
                                </div>
                              ) : (
                                <div className={`${styles.cardArrow} ${isDarkTheme ? styles.darkTheme : ""}`}>
                                  <IoChevronForward size={16} />
                                </div>
                              )}
                            </div>
                            <div className={styles.headerMeta}>
                              <span className={styles.headerType}>{header.type}</span>
                              {header.section && <span className={styles.headerSection}>{header.section}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className={styles.section}>
                    <h3 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Available Fields</h3>
                    <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Search and select additional fields to add to this section.</p>
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
                    {filteredHeaders().map((header) => {
                      const headerIndex = currentCardTemplates[selectedTemplateIndex].headers.findIndex(
                        (h) => h.key === header.key
                      );
                      return (
                        <div
                          key={header.key}
                          className={`${styles.keyItem} ${isDarkTheme ? styles.darkTheme : ""}`}
                          onClick={(e) => {
                            const isCheckboxClick = e.target.closest(`.${styles.customCheckbox}`);
                            if (isCheckboxClick) {
                              toggleKeySelection(currentSectionIndex, header.key);
                            } else if (headerIndex !== -1) {
                              handleEditHeader(headerIndex);
                            }
                          }}
                        >
                          <div className={styles.headerContent}>
                            <div className={styles.headerRow}>
                              <div className={styles.headerMain}>
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
                              </div>
                              {!editMode && (
                                <div className={`${styles.cardArrow} ${isDarkTheme ? styles.darkTheme : ""}`}>
                                  <IoChevronForward size={16} />
                                </div>
                              )}
                            </div>
                            <div className={styles.headerMeta}>
                              <span className={styles.headerType}>{header.type}</span>
                              {header.section && <span className={styles.headerSection}>{header.section}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {editMode && (
                    <button
                      className={`${styles.deleteSectionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                      onClick={() => handleDeleteSection(currentSectionIndex)}
                      disabled={currentCardTemplates[selectedTemplateIndex].sections[currentSectionIndex].name === "Card Data"}
                    >
                      Delete Section
                    </button>
                  )}
                </div>
              </>
            )}

            {step === 4 &&
              selectedTemplateIndex !== null &&
              activeHeaderIndex !== null &&
              currentCardTemplates[selectedTemplateIndex]?.headers[activeHeaderIndex] && (
              <>
                <div className={styles.section}>
                  <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Field Configuration</h2>
                  <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Customize the field properties and settings.</p>
                  <div
                    className={`${styles.editActions} ${isDarkTheme ? styles.darkTheme : ""}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Prevent focus/edit for id, typeOfCards and assignedTo */}
                    <input
                      type="text"
                      value={newHeaderName}
                      onChange={(e) => setNewHeaderName(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Field Name"
                      className={`${styles.inputField} ${isDarkTheme ? styles.darkTheme : ""}`}
                      disabled={['docId', 'typeOfCards', 'assignedTo'].includes(currentCardTemplates[selectedTemplateIndex].headers[activeHeaderIndex].key)}
                      tabIndex={['docId', 'typeOfCards', 'assignedTo'].includes(currentCardTemplates[selectedTemplateIndex].headers[activeHeaderIndex].key) ? -1 : 0}
                    />
                    <div className={styles.fieldContainer}>
                      <select
                        value={newHeaderType}
                        onChange={(e) => setNewHeaderType(e.target.value)}
                        className={`${styles.selectField} ${isDarkTheme ? styles.darkTheme : ""}`}
                        disabled={activeHeaderIndex !== -1 && activeHeaderIndex !== null} // Disable type select if editing an existing header
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="currency">Currency</option>
                        <option value="dropdown">Dropdown</option>
                        <option value="multi-select">Multi-Select</option>
                      </select>
                      {activeHeaderIndex !== -1 && activeHeaderIndex !== null && (
                        <div className={`${styles.lockedIndicator} ${isDarkTheme ? styles.darkTheme : ""}`}>
                          <span className={styles.lockIcon}>🔒</span>
                          <span className={styles.lockText}>Field type cannot be changed after creation</span>
                        </div>
                      )}
                    </div>
                    {/* Show options for dropdown and multi-select */}
                    {(newHeaderType === "dropdown" || newHeaderType === "multi-select") && (
                      <div className={`${styles.optionsSection} ${isDarkTheme ? styles.darkTheme : ""}`}>
                        <div className={`${styles.optionInputRow} ${isDarkTheme ? styles.darkTheme : ""}`}>
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
                        <div className={`${styles.optionsList} ${isDarkTheme ? styles.darkTheme : ""}`}>
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
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(currentCardTemplates[selectedTemplateIndex].headers[activeHeaderIndex].key);
                          setCopiedHeaderId(true);
                          setTimeout(() => setCopiedHeaderId(false), 1200);
                        }}
                        className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ""}`}
                        style={{ width: "100%", marginBottom: 12 }}
                      >
                        {copiedHeaderId ? "Copied!" : "Copy Header Key"}
                      </button>
                      {currentCardTemplates[selectedTemplateIndex].headers[activeHeaderIndex].key !== "docId" &&
                        currentCardTemplates[selectedTemplateIndex].headers[activeHeaderIndex].key !== "typeOfCards" &&
                        currentCardTemplates[selectedTemplateIndex].headers[activeHeaderIndex].key !== "assignedTo" && (
                          <button
                            onClick={() => deleteHeader(activeHeaderIndex)}
                            className={`${styles.deleteButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                            style={{ width: "100%" }}
                          >
                            Remove
                          </button>
                        )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {step === 5 && selectedTemplateIndex !== null && (
              <>
                <div className={styles.section}>
                  <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Add New Field</h2>
                  <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Create a new field for your card template.</p>
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
                      <option value="dropdown">Dropdown</option>
                      <option value="multi-select">Multi-Select</option>
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
                    {(newHeaderType === "dropdown" || newHeaderType === "multi-select") && (
                      <div className={`${styles.optionsSection} ${isDarkTheme ? styles.darkTheme : ""}`}>
                        <div className={`${styles.optionInputRow} ${isDarkTheme ? styles.darkTheme : ""}`}>
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
                        <div className={`${styles.optionsList} ${isDarkTheme ? styles.darkTheme : ""}`}>
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
  businessId: PropTypes.string,
};

export default CardsTemplate;

// Reminder: In exportCards and any other card export logic, ensure to use 'docId' instead of 'id' for the unique identifier.
// If you see any mapping like { id: doc.id, ...doc.data() }, change it to { docId: doc.id, ...doc.data() }