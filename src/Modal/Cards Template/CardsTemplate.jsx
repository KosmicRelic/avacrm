import { useState, useContext, useCallback, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import styles from "./CardsTemplate.module.css";
import { MainContext } from "../../Contexts/MainContext";
import { ModalNavigatorContext } from "../../Contexts/ModalNavigator";
import { FaPlus, FaSearch, FaRegCircle, FaRegCheckCircle, FaDownload, FaTrash, FaDatabase, FaLayerGroup, FaEdit, FaCheck, FaTimes } from "react-icons/fa";
import { IoChevronForward, IoAdd, IoGitBranch, IoCreate, IoTrash } from "react-icons/io5";
import { BsDashCircle } from "react-icons/bs";
import { MdDragIndicator } from "react-icons/md";

import { v4 as uuidv4 } from "uuid";
import isEqual from "lodash/isEqual"; // Import lodash for deep comparison
import { db } from '../../firebase';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, Timestamp } from 'firebase/firestore';
import { updateCardTemplatesAndCardsFunction } from '../../Firebase/Firebase Functions/User Functions/updateCardTemplatesAndCardsFunction';
import fetchUserData from '../../Firebase/Firebase Functions/User Functions/FetchUserData';

const CardsTemplate = ({ tempData, setTempData, businessId: businessIdProp }) => {
  const { 
    cardTemplates, 
    isDarkTheme, 
    businessId: businessIdContext,
    templateEntities: contextTemplateEntities,
    setTemplateEntities: contextSetTemplateEntities,
    setCardTemplates
  } = useContext(MainContext);
  const { registerModalSteps, goToStep, goBack, currentStep, setModalConfig } = useContext(ModalNavigatorContext);

  const businessId = businessIdProp || businessIdContext;

  const [currentCardTemplates, setCurrentCardTemplates] = useState(() =>
    (tempData.currentCardTemplates || cardTemplates || []).map((t) => {
      // Remove duplicate headers based on key
      const seenKeys = new Set();
      const uniqueHeaders = t.headers?.filter(header => {
        if (seenKeys.has(header.key)) {
          return false;
        }
        seenKeys.add(header.key);
        return true;
      }) || [];

      return {
        ...t,
        headers: uniqueHeaders.map((h) => ({
          ...h,
          isUsed: h.key === "docId" || h.key === "linkId" || h.key === "typeOfCards" || h.key === "assignedTo" ? true : h.isUsed ?? false,
        })),
        sections: t.sections.map((s) => ({
          ...s,
          keys: s.keys.includes("docId") || s.keys.includes("linkId") || s.keys.includes("typeOfCards") || s.keys.includes("assignedTo") ? s.keys : [...s.keys],
        })),
        isModified: t.isModified || false,
        action: t.action || null,
      };
    })
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
  
  // Entity management state - use local state to prevent Firestore overwrites
  const [templateEntities, setTemplateEntities] = useState(() => contextTemplateEntities || []);
  const [selectedEntityIndex, setSelectedEntityIndex] = useState(null);
  const [newEntityName, setNewEntityName] = useState("");
  const [showEntityForm, setShowEntityForm] = useState(false);
  const [editingEntityIndex, setEditingEntityIndex] = useState(null);
  const [editingEntityName, setEditingEntityName] = useState("");
  
  // Pipeline management state
  const [newPipelineName, setNewPipelineName] = useState("");
  const [pipelineSourceTemplate, setPipelineSourceTemplate] = useState("");
  const [pipelineTargetTemplate, setPipelineTargetTemplate] = useState("");
  const [pipelineFieldMappings, setPipelineFieldMappings] = useState([]);
  const [showPipelineForm, setShowPipelineForm] = useState(false);
  const [editingPipelineIndex, setEditingPipelineIndex] = useState(null);
  
  const keyRefs = useRef(new Map());
  const sectionRefs = useRef(new Map());
  const hasInitialized = useRef(false);
  const prevCardTemplatesRef = useRef(currentCardTemplates);
  const prevStepRef = useRef(currentStep);
  const lastTempDataRef = useRef({ currentCardTemplates, deletedHeaderKeys, templateEntities });
  const initialStateRef = useRef(null); // Track initial state to detect changes

  // Memoize currentCardTemplates to prevent unnecessary re-renders
  useEffect(() => {
    prevCardTemplatesRef.current = currentCardTemplates;
  }, [currentCardTemplates]);

  // Update tempData only when necessary (prevent infinite loop)
  useEffect(() => {
    if (
      !isEqual(lastTempDataRef.current.currentCardTemplates, currentCardTemplates) ||
      !isEqual(lastTempDataRef.current.deletedHeaderKeys, deletedHeaderKeys) ||
      !isEqual(lastTempDataRef.current.templateEntities, templateEntities)
    ) {
      setTempData({ 
        currentCardTemplates, 
        deletedHeaderKeys, 
        templateEntities,
        hasEntityChanges: hasChanges() // Pass the change detection result
      });
      lastTempDataRef.current = { currentCardTemplates, deletedHeaderKeys, templateEntities };
    }
     
  }, [currentCardTemplates, deletedHeaderKeys, templateEntities, setTempData]);

  // Initialize initial state and detect changes
  useEffect(() => {
    if (!initialStateRef.current) {
      // Store initial state when component mounts
      initialStateRef.current = {
        currentCardTemplates: JSON.parse(JSON.stringify(currentCardTemplates)),
        deletedHeaderKeys: [...deletedHeaderKeys],
        templateEntities: JSON.parse(JSON.stringify(templateEntities))
      };
    }
  }, [currentCardTemplates, deletedHeaderKeys, templateEntities]);

  // Function to detect if there are any changes from initial state
  const hasChanges = useCallback(() => {
    if (!initialStateRef.current) return false;
    
    return (
      !isEqual(initialStateRef.current.currentCardTemplates, currentCardTemplates) ||
      !isEqual(initialStateRef.current.deletedHeaderKeys, deletedHeaderKeys) ||
      !isEqual(initialStateRef.current.templateEntities, templateEntities)
    );
  }, [currentCardTemplates, deletedHeaderKeys, templateEntities]);

  // Function to update tempData only if there are changes
  const updateTempDataIfChanged = useCallback(() => {
    if (hasChanges()) {
      setTempData({ currentCardTemplates, deletedHeaderKeys, templateEntities });
      lastTempDataRef.current = { currentCardTemplates, deletedHeaderKeys, templateEntities };
    }
  }, [currentCardTemplates, deletedHeaderKeys, templateEntities, hasChanges, setTempData]);

  // Sync local templateEntities with context on initial load
  useEffect(() => {
    if (contextTemplateEntities && contextTemplateEntities.length > 0 && templateEntities.length === 0) {
      setTemplateEntities(contextTemplateEntities);
    }
  }, [contextTemplateEntities, templateEntities.length, setTemplateEntities]);

  // Initialize tempData with initial values including templateEntities
  useEffect(() => {
    setTempData({ 
      currentCardTemplates, 
      deletedHeaderKeys, 
      templateEntities,
      hasEntityChanges: hasChanges() // Include change detection
    });
    lastTempDataRef.current = { currentCardTemplates, deletedHeaderKeys, templateEntities };
    
    // Store initial state after first load
    if (!initialStateRef.current) {
      initialStateRef.current = {
        currentCardTemplates: JSON.parse(JSON.stringify(currentCardTemplates)),
        deletedHeaderKeys: [...deletedHeaderKeys],
        templateEntities: JSON.parse(JSON.stringify(templateEntities))
      };
    }
  }, []); // Only run once on mount

  // Merge templates from templateEntities into currentCardTemplates after entities are loaded
  useEffect(() => {
    if (templateEntities.length > 0) {
      // Extract all templates from entities and add to currentCardTemplates if not already present
      const allEntityTemplates = [];
      templateEntities.forEach(entity => {
        if (entity.templates && Array.isArray(entity.templates)) {
          entity.templates.forEach(template => {
            // Ensure template has entityId set to the entity it belongs to
            allEntityTemplates.push({
              ...template,
              entityId: entity.id
            });
          });
        }
      });
      
      if (allEntityTemplates.length > 0) {
        setCurrentCardTemplates(prev => {
          // Find templates that aren't already in currentCardTemplates
          const newTemplates = allEntityTemplates.filter(entityTemplate => {
            return !prev.some(existingTemplate => 
              existingTemplate.docId === entityTemplate.docId ||
              (existingTemplate.name === entityTemplate.name && existingTemplate.typeOfCards === entityTemplate.typeOfCards)
            );
          });
          
          return [...prev, ...newTemplates];
        });
      }
    }
  }, [templateEntities]); // Run when templateEntities changes

  // Reset editing state when templateEntities changes (e.g., after successful save)
  const initialEditingNameRef = useRef(null);
  
  useEffect(() => {
    if (editingEntityIndex !== null) {
      // Store the initial name when editing starts
      if (initialEditingNameRef.current === null) {
        initialEditingNameRef.current = templateEntities[editingEntityIndex]?.name || "";
      }
      
      // Check if the entity name in context has changed from the initial name
      // This indicates an external update (like successful save)
      const currentEntity = templateEntities[editingEntityIndex];
      if (currentEntity && currentEntity.name !== initialEditingNameRef.current) {
        // Entity name was updated externally, reset editing state
        setEditingEntityIndex(null);
        setEditingEntityName("");
        initialEditingNameRef.current = null;
      }
    } else {
      // Reset the ref when not editing
      initialEditingNameRef.current = null;
    }
  }, [templateEntities, editingEntityIndex]);

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
    if (currentStep === 6 || currentStep === 5) {
      setActiveHeaderIndex(null);
      resetHeaderForm();
      goBack();
    } else if (currentStep === 4) {
      setCurrentSectionIndex(null);
      setActiveHeaderIndex(null);
      goBack();
    } else if (currentStep === 3) {
      if (editMode) {
        setEditMode(false);
      } else {
        setSelectedTemplateIndex(null);
        goBack();
      }
    } else if (currentStep === 2) {
      setSelectedEntityIndex(null);
      goBack();
    } else {
      goBack();
    }
    setNavigationDirection("backward");
  }, [currentStep, goBack, editMode, resetHeaderForm]);

  const deleteHeader = useCallback(
    (index) => {
      if (selectedTemplateIndex === null) return;
      const header = currentCardTemplates[selectedTemplateIndex].headers[index];
      if (header.key === "docId" || header.key === "linkId" || header.key === "typeOfCards" || header.key === "assignedTo") {
        alert("The 'ID', 'Link ID', 'Type of Cards' or 'Assigned To' field cannot be deleted.");
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
      const sectionContainsProtectedKey = section.keys.some((key) => key === "docId" || key === "linkId" || key === "typeOfCards" || key === "assignedTo");
      if (sectionContainsProtectedKey) {
        alert("This section cannot be deleted because it contains the 'ID', 'Link ID', 'Type of Cards' or 'Assigned To' field.");
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
      alert("The 'Card Data' section is reserved for 'ID', 'Type of Cards', 'Type of Profile' and 'Assigned To' fields.");
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
        { title: "Template Entities", rightButton: null },
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
        title: "Template Entities",
        backButtonTitle: "",
        leftButton: null,
        rightButton: null,
      });
    } else if (currentStep === 2) {
      setModalConfig({
        showTitle: true,
        showDoneButton: true,
        showBackButton: true,
        title: "Card Templates",
        backButtonTitle: "Template Entities",
        backButton: { label: "Template Entities", onClick: handleBack },
        leftButton: null,
        rightButton: null,
      });
    } else if (currentStep === 3) {
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
    } else if (currentStep === 4) {
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
    } else if (currentStep === 5) {
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
    } else if (currentStep === 6) {
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
    if (selectedEntityIndex === null) {
      alert("Please select an entity first.");
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
      entityId: templateEntities[selectedEntityIndex].id,
      headers: [
        {
          key: "docId",
          name: "ID",
          type: "text",
          section: "Card Data",
          isUsed: true,
        },
        {
          key: "linkId",
          name: "Link ID",
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
          key: "typeOfProfile",
          name: "Type of Profile",
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
          keys: ["docId", "linkId", "typeOfCards", "typeOfProfile", "assignedTo"],
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
    goToStep(3);
  }, [newTemplateName, currentCardTemplates, goToStep, selectedEntityIndex, templateEntities]);

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
    if (key === "docId" || key === "linkId" || key === "typeOfCards" || key === "assignedTo") {
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
    if (key === "docId" || key === "linkId" || key === "typeOfCards" || key === "assignedTo") {
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
          goToStep(3);
          return;
        }
      }

      setSelectedTemplateIndex(null);
      setNewTemplateName("");
      setEditMode(false);
      setNavigationDirection("forward");
      goToStep(3);
    },
    [currentCardTemplates, goToStep]
  );

  // Entity Management Functions
  const createNewEntity = useCallback(async () => {
    if (!newEntityName.trim()) {
      alert("Please enter an entity name.");
      return;
    }
    if (templateEntities.some((entity) => entity.name.toLowerCase() === newEntityName.trim().toLowerCase())) {
      alert("An entity with this name already exists. Please choose a unique name.");
      return;
    }

    const newEntity = {
      id: uuidv4(),
      name: newEntityName.trim(),
      templates: [],
      pipelines: []
    };

    try {
      // Add entity to local state first
      const updatedEntities = [...templateEntities, newEntity];
      setTemplateEntities(updatedEntities);
      
      // Update tempData immediately
      setTempData({ 
        currentCardTemplates, 
        deletedHeaderKeys, 
        templateEntities: updatedEntities,
        hasEntityChanges: true // Mark that entities have changed
      });
      
      setNewEntityName("");
      setShowEntityForm(false);
    } catch (error) {
      console.error('Error creating entity:', error);
      alert('Failed to create entity. Please try again.');
      
      // Restore previous state in case of error
      setTemplateEntities(templateEntities);
    }
  }, [newEntityName, templateEntities, businessId, currentCardTemplates, deletedHeaderKeys, setTempData]);

  const selectEntity = useCallback((entityIndex) => {
    setSelectedEntityIndex(entityIndex);
    setNavigationDirection("forward");
    goToStep(2);
  }, [goToStep]);

  const deleteEntity = useCallback(async (entityIndex) => {
    const entity = templateEntities[entityIndex];
    
    // Check for templates in both local state and entity.templates (from backend)
    const localTemplates = currentCardTemplates.filter(template => 
      template.entityId === entity.id && template.action !== "remove"
    );
    const entityTemplatesFromBackend = entity.templates || [];
    
    // Count total templates (local + backend, avoiding duplicates)
    const allTemplateIds = new Set([
      ...localTemplates.map(t => t.docId),
      ...entityTemplatesFromBackend.map(t => t.docId)
    ]);
    
    if (allTemplateIds.size > 0) {
      alert(`Cannot delete entity "${entity.name}" because it contains ${allTemplateIds.size} template(s). Please delete all templates first.`);
      return;
    }
    if (window.confirm(`Are you sure you want to delete the entity "${entity.name}"? This action cannot be undone.`)) {
      try {
        // Mark entity for deletion instead of removing it from array
        const updatedEntities = templateEntities.map((e, index) => 
          index === entityIndex 
            ? { ...e, isModified: true, action: "remove" }
            : e
        );
        setTemplateEntities(updatedEntities);
        
        // Remove any templates belonging to this entity from currentCardTemplates
        const updatedCardTemplates = currentCardTemplates.filter(template => template.entityId !== entity.id);
        setCurrentCardTemplates(updatedCardTemplates);
        
        // Immediately update tempData to reflect the deletion
        setTempData({ 
          currentCardTemplates: updatedCardTemplates, 
          deletedHeaderKeys, 
          templateEntities: updatedEntities,
          hasEntityChanges: true // Mark that entities have changed
        });
        
        // Reset selected entity if it was the deleted one
        if (selectedEntityIndex === entityIndex) {
          setSelectedEntityIndex(null);
        }
      } catch (error) {
        console.error('Error marking entity for deletion:', error);
        alert('Failed to mark entity for deletion. Please try again.');
        
        // Restore entity in case of error
        setTemplateEntities(templateEntities);
        setSelectedEntityIndex(selectedEntityIndex);
      }
    }
  }, [templateEntities, selectedEntityIndex, currentCardTemplates, businessId, setCardTemplates, setTemplateEntities, deletedHeaderKeys, setTempData]);

  const updateEntityName = useCallback(async (entityIndex, newName) => {
    if (!newName.trim()) return;
    if (templateEntities.some((entity, index) => index !== entityIndex && entity.name.toLowerCase() === newName.trim().toLowerCase())) {
      alert("An entity with this name already exists. Please choose a unique name.");
      return;
    }

    const previousName = templateEntities[entityIndex].name;
    const entityId = templateEntities[entityIndex].id;

    // Update local state only
    const updatedEntities = templateEntities.map((entity, index) => 
      index === entityIndex 
        ? { ...entity, name: newName.trim(), isModified: true, action: entity.action || "update" }
        : entity
    );
    
    setTemplateEntities(updatedEntities);

    // Update entityName in all templates that belong to this entity
    const updatedCardTemplates = currentCardTemplates.map(template => 
      template.entityId === entityId 
        ? { ...template, entityName: newName.trim() }
        : template
    );
    
    setCurrentCardTemplates(updatedCardTemplates);
    
    // Update tempData immediately to reflect the name change
    setTempData({ 
      currentCardTemplates: updatedCardTemplates, 
      deletedHeaderKeys, 
      templateEntities: updatedEntities,
      hasEntityChanges: true // Explicitly mark that entities have changed
    });
  }, [templateEntities, currentCardTemplates, deletedHeaderKeys, setTempData]);

  const startEditingEntity = useCallback((entityIndex) => {
    setEditingEntityIndex(entityIndex);
    setEditingEntityName(templateEntities[entityIndex].name);
  }, [templateEntities]);

  const cancelEditingEntity = useCallback(() => {
    setEditingEntityIndex(null);
    setEditingEntityName("");
  }, []);

  const saveEntityName = useCallback(async () => {
    if (editingEntityIndex !== null) {
      await updateEntityName(editingEntityIndex, editingEntityName);
      setEditingEntityIndex(null);
      setEditingEntityName("");
    }
  }, [editingEntityIndex, editingEntityName, updateEntityName]);

  const getEntityTemplates = useCallback((entityIndex) => {
    if (entityIndex === null || !templateEntities[entityIndex]) return [];
    const entity = templateEntities[entityIndex];
    return currentCardTemplates.filter(template => 
      template.entityId === entity.id && template.action !== "remove"
    );
  }, [templateEntities, currentCardTemplates]);

  // Get pipelines for a specific entity
  const getEntityPipelines = useCallback((entityIndex) => {
    if (entityIndex === null || !templateEntities[entityIndex]) return [];
    const entity = templateEntities[entityIndex];
    return entity.pipelines || [];
  }, [templateEntities]);

  // Add new pipeline to entity
  const addEntityPipeline = useCallback(async () => {
    console.log('=== PIPELINE CREATION DEBUG ===');
    console.log('Pipeline name:', newPipelineName);
    console.log('Source template:', pipelineSourceTemplate);
    console.log('Target template:', pipelineTargetTemplate);
    console.log('Field mappings:', pipelineFieldMappings);
    console.log('Selected entity index:', selectedEntityIndex);
    console.log('Current templateEntities:', templateEntities);
    
    if (!newPipelineName.trim() || !pipelineSourceTemplate || !pipelineTargetTemplate) {
      console.log('Pipeline creation cancelled - missing required fields');
      alert('Please fill in all required fields for the pipeline.');
      return;
    }

    if (pipelineSourceTemplate === pipelineTargetTemplate) {
      console.log('Pipeline creation cancelled - same source and target');
      alert('Source and target templates must be different.');
      return;
    }

    if (pipelineFieldMappings.length === 0) {
      console.log('Pipeline creation cancelled - no field mappings');
      alert('Please add at least one field mapping.');
      return;
    }

    const isValidMapping = pipelineFieldMappings.every(mapping => 
      mapping.source && mapping.target
    );

    if (!isValidMapping) {
      console.log('Pipeline creation cancelled - invalid field mappings');
      alert('Please complete all field mappings.');
      return;
    }

    const newPipeline = {
      id: `pipeline_${Date.now()}`,
      name: newPipelineName.trim(),
      sourceTemplateId: pipelineSourceTemplate,
      targetTemplateId: pipelineTargetTemplate,
      fieldMappings: pipelineFieldMappings.length > 0 ? pipelineFieldMappings : [],
      createdAt: new Date().toISOString()
    };

    console.log('Creating new pipeline:', newPipeline);

    try {
      // Update local state first
      const updatedEntities = templateEntities.map((entity, index) =>
        index === selectedEntityIndex
          ? { ...entity, pipelines: [...(entity.pipelines || []), newPipeline] }
          : entity
      );
      
      setTemplateEntities(updatedEntities);
      console.log('Updated templateEntities with new pipeline:', updatedEntities[selectedEntityIndex]);
      
      // Update tempData immediately
      setTempData({ 
        currentCardTemplates, 
        deletedHeaderKeys, 
        templateEntities: updatedEntities 
      });
      
      console.log(`Pipeline "${newPipeline.name}" created successfully (will save to backend when modal is closed)`);

      // Reset form
      console.log('Resetting pipeline form...');
      setNewPipelineName("");
      setPipelineSourceTemplate("");
      setPipelineTargetTemplate("");
      setPipelineFieldMappings([]);
      setShowPipelineForm(false);
    } catch (error) {
      console.error('Error creating pipeline:', error);
      alert('Failed to create pipeline. Please try again.');
      
      // Restore previous state in case of error
      setTemplateEntities(templateEntities);
    }
    
    console.log('=== PIPELINE CREATION COMPLETED ===');
  }, [selectedEntityIndex, newPipelineName, pipelineSourceTemplate, pipelineTargetTemplate, pipelineFieldMappings, templateEntities, businessId, currentCardTemplates, deletedHeaderKeys, setTempData]);

  // Edit existing pipeline
  const editEntityPipeline = useCallback((pipelineIndex) => {
    const pipeline = getEntityPipelines(selectedEntityIndex)[pipelineIndex];
    if (!pipeline) return;

    setEditingPipelineIndex(pipelineIndex);
    setNewPipelineName(pipeline.name);
    setPipelineSourceTemplate(pipeline.sourceTemplateId);
    setPipelineTargetTemplate(pipeline.targetTemplateId);
    setPipelineFieldMappings(pipeline.fieldMappings || []);
    setShowPipelineForm(true);
  }, [selectedEntityIndex, getEntityPipelines]);

  // Update existing pipeline
  const updateEntityPipeline = useCallback(() => {
    if (editingPipelineIndex === null) return;
    
    if (!newPipelineName.trim() || !pipelineSourceTemplate || !pipelineTargetTemplate) {
      alert('Please fill in all required fields for the pipeline.');
      return;
    }

    if (pipelineSourceTemplate === pipelineTargetTemplate) {
      alert('Source and target templates must be different.');
      return;
    }

    if (pipelineFieldMappings.length === 0) {
      alert('Please add at least one field mapping.');
      return;
    }

    const isValidMapping = pipelineFieldMappings.every(mapping => 
      mapping.source && mapping.target
    );

    if (!isValidMapping) {
      alert('Please complete all field mappings.');
      return;
    }

    console.log('Updating existing pipeline at index:', editingPipelineIndex);

    setTemplateEntities(prev => {
      const updated = prev.map((entity, index) =>
        index === selectedEntityIndex
          ? {
              ...entity,
              pipelines: entity.pipelines?.map((pipeline, pIndex) =>
                pIndex === editingPipelineIndex
                  ? {
                      ...pipeline,
                      name: newPipelineName.trim(),
                      sourceTemplateId: pipelineSourceTemplate,
                      targetTemplateId: pipelineTargetTemplate,
                      fieldMappings: pipelineFieldMappings,
                      updatedAt: new Date().toISOString()
                    }
                  : pipeline
              ) || []
            }
          : entity
      );
      console.log('Updated templateEntities with modified pipeline:', updated[selectedEntityIndex]);
      return updated;
    });

    // Reset form
    setNewPipelineName("");
    setPipelineSourceTemplate("");
    setPipelineTargetTemplate("");
    setPipelineFieldMappings([]);
    setShowPipelineForm(false);
    setEditingPipelineIndex(null);
  }, [selectedEntityIndex, editingPipelineIndex, newPipelineName, pipelineSourceTemplate, pipelineTargetTemplate, pipelineFieldMappings]);

  // Delete pipeline
  const deleteEntityPipeline = useCallback((pipelineIndex) => {
    if (!confirm('Are you sure you want to delete this pipeline?')) return;

    setTemplateEntities(prev =>
      prev.map((entity, index) =>
        index === selectedEntityIndex
          ? {
              ...entity,
              pipelines: entity.pipelines?.filter((_, pIndex) => pIndex !== pipelineIndex) || []
            }
          : entity
      )
    );
  }, [selectedEntityIndex]);

  // Cancel pipeline form
  const cancelPipelineForm = useCallback(() => {
    setNewPipelineName("");
    setPipelineSourceTemplate("");
    setPipelineTargetTemplate("");
    setPipelineFieldMappings([]);
    setShowPipelineForm(false);
    setEditingPipelineIndex(null);
  }, []);

  // Field mapping functions for pipelines
  const addFieldMapping = useCallback(() => {
    setPipelineFieldMappings(prev => [...prev, { source: '', target: '' }]);
  }, []);

  const removeFieldMapping = useCallback((index) => {
    setPipelineFieldMappings(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateFieldMapping = useCallback((index, field, value) => {
    setPipelineFieldMappings(prev => 
      prev.map((mapping, i) => 
        i === index ? { ...mapping, [field]: value } : mapping
      )
    );
  }, []);

  const getSourceTemplateHeaders = useCallback(() => {
    if (!pipelineSourceTemplate || selectedEntityIndex === null) return [];
    const sourceTemplate = getEntityTemplates(selectedEntityIndex).find(t => t.docId === pipelineSourceTemplate);
    return sourceTemplate?.headers || [];
  }, [pipelineSourceTemplate, selectedEntityIndex, getEntityTemplates]);

  const getTargetTemplateHeaders = useCallback(() => {
    if (!pipelineTargetTemplate || selectedEntityIndex === null) return [];
    const targetTemplate = getEntityTemplates(selectedEntityIndex).find(t => t.docId === pipelineTargetTemplate);
    return targetTemplate?.headers || [];
  }, [pipelineTargetTemplate, selectedEntityIndex, getEntityTemplates]);

  // Auto-add initial field mapping when templates are selected
  useEffect(() => {
    if (pipelineSourceTemplate && pipelineTargetTemplate && pipelineFieldMappings.length === 0) {
      addFieldMapping();
    }
  }, [pipelineSourceTemplate, pipelineTargetTemplate, pipelineFieldMappings.length, addFieldMapping]);

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
      goToStep(4);
    },
    [goToStep]
  );

  // Toggle key selection
  const toggleKeySelection = useCallback(
    (sectionIndex, key) => {
      if (selectedTemplateIndex === null || sectionIndex === null) return;
      if (key === "docId" || key === "linkId" || key === "typeOfCards" || key === "assignedTo") {
        alert("The 'ID', 'Link ID', 'Type of Cards' or 'Assigned To' field cannot be deselected from the section.");
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
      if (key === "docId" || key === "linkId" || key === "typeOfCards" || key === "assignedTo") {
        alert("The 'ID', 'Link ID', 'Type of Cards' or 'Assigned To' field cannot be removed from the section.");
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

    const filtered = (
      currentCardTemplates[selectedTemplateIndex]?.headers?.filter(
        (header) =>
          !usedKeys.includes(header.key) &&
          [header.name, header.type, header.section].some((field) =>
            field?.toLowerCase().includes(searchQuery.toLowerCase())
          )
      ) || []
    );

    // Remove any potential duplicates based on key
    const seenKeys = new Set();
    return filtered.filter(header => {
      if (seenKeys.has(header.key)) {
        return false;
      }
      seenKeys.add(header.key);
      return true;
    });
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
        goToStep(2);
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
      goToStep(5);
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
    goToStep(6);
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
      const rawCards = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() })); // changed id to docId
      if (!rawCards.length) {
        alert('No cards found for this template.');
        return;
      }

      // Get headers from template
      const headers = template.headers.filter(h => h.isUsed);

      // Prepare CSV headers and data mapping
      const csvHeaders = [];
      const dataMapping = [];

      headers.forEach(header => {
        const { key, name, type } = header;
        if (type === 'date') {
          csvHeaders.push(name);
          dataMapping.push({ key, type, hasTime: false });
          // Check if any card has time in this date field
          const hasTime = rawCards.some(card => {
            const value = card[key];
            if (value && typeof value.toDate === 'function') {
              const date = value.toDate();
              return date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0;
            }
            return false;
          });
          if (hasTime) {
            csvHeaders.push(`${name} Time`);
            dataMapping[dataMapping.length - 1].hasTime = true;
          }
        } else {
          csvHeaders.push(name);
          dataMapping.push({ key, type });
        }
      });

      // Prepare CSV rows
      const csvRows = rawCards.map(card => {
        const row = [];
        dataMapping.forEach(({ key, type, hasTime }) => {
          let value = card[key];
          if (value === null || value === undefined) {
            row.push('');
            if (hasTime) row.push('');
            return;
          }

          if (type === 'date') {
            if (typeof value.toDate === 'function') {
              const date = value.toDate();
              // Use ISO date format for better spreadsheet compatibility
              const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
              row.push(dateStr);
              if (hasTime) {
                const timeStr = date.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false
                });
                row.push(timeStr);
              }
            } else if (value instanceof Date) {
              // Use ISO date format for better spreadsheet compatibility
              const dateStr = value.toISOString().split('T')[0]; // YYYY-MM-DD format
              row.push(dateStr);
              if (hasTime) {
                const timeStr = value.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false
                });
                row.push(timeStr);
              }
            } else {
              row.push(String(value));
              if (hasTime) row.push('');
            }
          } else if (type === 'currency') {
            if (typeof value === 'number') {
              row.push(value.toFixed(2));
            } else {
              row.push(String(value));
            }
          } else if (type === 'number') {
            if (typeof value === 'number') {
              row.push(value.toString());
            } else {
              row.push(String(value));
            }
          } else if (type === 'dropdown' || type === 'multi-select') {
            if (Array.isArray(value)) {
              row.push(value.join('; '));
            } else {
              row.push(String(value));
            }
          } else {
            // text or other
            row.push(String(value));
          }
        });
        return row;
      });

      // Create CSV content
      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => 
          row.map(cell => {
            // Only quote if necessary (contains comma, quote, or newline)
            if (cell.includes(',') || cell.includes('"') || cell.includes('\n') || cell.includes('\r')) {
              return `"${cell.replace(/"/g, '""')}"`;
            }
            return cell;
          }).join(',')
        )
      ].join('\r\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${typeOfCards}_cards_export.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export cards.');
    }
  }, [selectedTemplateIndex, currentCardTemplates, businessId]);






  return (
    <div className={`${styles.templateWrapper} ${isDarkTheme ? styles.darkTheme : ""}`}>
      <div className={styles.viewContainer}>
        {[1, 2, 3, 4, 5, 6, 7].map((step) => (
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
                  <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Create New Entity</h2>
                  <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Entities help organize your card templates into logical groups.</p>
                  <div className={`${styles.configGrid} ${isDarkTheme ? styles.darkTheme : ""}`}>
                    <div
                      onClick={() => setShowEntityForm(true)}
                      className={`${styles.configCard} ${isDarkTheme ? styles.darkTheme : ""}`}
                      role="button"
                      aria-label="Add New Entity"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setShowEntityForm(true);
                        }
                      }}
                    >
                      <div className={`${styles.cardIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                        <FaPlus size={24} />
                      </div>
                      <div className={styles.cardContent}>
                        <h3 className={`${styles.cardTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>New Entity</h3>
                        <p className={`${styles.cardDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Create a new entity to group your templates</p>
                      </div>
                      <div className={`${styles.cardArrow} ${isDarkTheme ? styles.darkTheme : ""}`}>
                        <IoChevronForward size={16} />
                      </div>
                    </div>
                  </div>
                  
                  {showEntityForm && (
                    <div className={`${styles.formSection} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      <h3 className={`${styles.formTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Create New Entity</h3>
                      <input
                        type="text"
                        value={newEntityName}
                        onChange={(e) => setNewEntityName(e.target.value)}
                        placeholder="Entity Name"
                        className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ""}`}
                        autoFocus
                      />
                      <div className={styles.formActions}>
                        <button
                          onClick={() => {
                            setShowEntityForm(false);
                            setNewEntityName("");
                          }}
                          className={`${styles.secondaryButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={createNewEntity}
                          className={`${styles.primaryButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                          disabled={!newEntityName.trim()}
                        >
                          Create Entity
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                {templateEntities.length > 0 && (
                  <div className={styles.section}>
                    <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Your Entities</h2>
                    <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Select an entity to manage its templates.</p>
                    <div className={`${styles.configGrid} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      {templateEntities
                        .map((entity, originalIndex) => ({ entity, originalIndex }))
                        .filter(({ entity }) => entity.action !== "remove")
                        .map(({ entity, originalIndex }) => (
                        <div
                          key={entity.id}
                          className={`${styles.configCard} ${isDarkTheme ? styles.darkTheme : ""}`}
                          role="button"
                          aria-label={`Open ${entity.name}`}
                          tabIndex={0}
                        >
                          <div className={`${styles.cardIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                            <FaLayerGroup size={24} />
                          </div>
                          <div 
                            className={styles.cardContent}
                            onClick={() => editingEntityIndex !== originalIndex && selectEntity(originalIndex)}
                            onKeyDown={(e) => {
                              if ((e.key === "Enter" || e.key === " ") && editingEntityIndex !== originalIndex) {
                                selectEntity(originalIndex);
                              }
                            }}
                          >
                            {editingEntityIndex === originalIndex ? (
                              <div className={styles.editingContent}>
                                <input
                                  type="text"
                                  value={editingEntityName}
                                  onChange={(e) => setEditingEntityName(e.target.value)}
                                  className={`${styles.entityNameInput} ${isDarkTheme ? styles.darkTheme : ""}`}
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => {
                                    e.stopPropagation();
                                    if (e.key === 'Enter') {
                                      saveEntityName();
                                    } else if (e.key === 'Escape') {
                                      cancelEditingEntity();
                                    }
                                  }}
                                  autoFocus
                                />
                                <div className={styles.editActions}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      saveEntityName();
                                    }}
                                    className={`${styles.saveButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                                    disabled={!editingEntityName.trim()}
                                  >
                                    <FaCheck size={12} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      cancelEditingEntity();
                                    }}
                                    className={`${styles.cancelButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                                  >
                                    <FaTimes size={12} />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <h3 className={`${styles.cardTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>{entity.name}</h3>
                                <p className={`${styles.cardDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>
                                  {getEntityTemplates(originalIndex).length} template{getEntityTemplates(originalIndex).length !== 1 ? 's' : ''}
                                </p>
                              </>
                            )}
                          </div>
                          {editingEntityIndex !== originalIndex && (
                            <>
                              <div className={`${styles.cardArrow} ${isDarkTheme ? styles.darkTheme : ""}`}>
                                <IoChevronForward size={16} />
                              </div>
                              <div className={styles.entityActions}>
                                <div 
                                  className={`${styles.editButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditingEntity(originalIndex);
                                  }}
                                >
                                  <FaEdit size={12} />
                                </div>
                                <div 
                                  className={`${styles.entityDeleteButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteEntity(originalIndex);
                                  }}
                                >
                                  <FaTrash size={12} />
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {step === 2 && (
              <>
                {selectedEntityIndex !== null && templateEntities[selectedEntityIndex] && templateEntities[selectedEntityIndex].action !== "remove" ? (
                  <>
                    <div className={styles.section}>
                      <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Create New Template</h2>
                      <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Start building your card data structure in {templateEntities[selectedEntityIndex].name}.</p>
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
                    
                    {getEntityTemplates(selectedEntityIndex).length > 0 && (
                      <div className={styles.section}>
                        <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Your Templates</h2>
                        <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Manage and edit your existing card templates in {templateEntities[selectedEntityIndex].name}.</p>
                        <div className={`${styles.configGrid} ${isDarkTheme ? styles.darkTheme : ""}`}>
                          {getEntityTemplates(selectedEntityIndex).map((template, index) => (
                            <div
                              key={template.name || `template-${index}`}
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
                    
                    {/* Pipelines Section */}
                    <div className={styles.section}>
                      <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Entity Pipelines</h2>
                      <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Create pipelines to automatically move cards between templates in {templateEntities[selectedEntityIndex].name}.</p>
                      
                      {/* Add Pipeline Button */}
                      <div className={`${styles.configGrid} ${isDarkTheme ? styles.darkTheme : ""}`}>
                        <div
                          onClick={() => setShowPipelineForm(true)}
                          className={`${styles.configCard} ${styles.createCard} ${isDarkTheme ? styles.darkTheme : ""}`}
                          role="button"
                          aria-label="Create new pipeline"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              setShowPipelineForm(true);
                            }
                          }}
                        >
                          <div className={`${styles.cardIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                            <IoAdd size={24} />
                          </div>
                          <div className={styles.cardContent}>
                            <h3 className={`${styles.cardTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Create Pipeline</h3>
                            <p className={`${styles.cardDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Set up automatic card movement between templates</p>
                          </div>
                          <div className={`${styles.cardArrow} ${isDarkTheme ? styles.darkTheme : ""}`}>
                            <IoChevronForward size={16} />
                          </div>
                        </div>
                      </div>
                      
                      {/* Pipeline Form */}
                      {showPipelineForm && (
                        <div className={`${styles.pipelineForm} ${isDarkTheme ? styles.darkTheme : ""}`}>
                          <h3 className={`${styles.formTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>
                            {editingPipelineIndex !== null ? 'Edit Pipeline' : 'Create New Pipeline'}
                          </h3>
                          
                          <div className={styles.inputGroup}>
                            <label className={`${styles.fieldLabel} ${isDarkTheme ? styles.darkTheme : ""}`}>Pipeline Name</label>
                            <input
                              type="text"
                              value={newPipelineName}
                              onChange={(e) => setNewPipelineName(e.target.value)}
                              placeholder="Enter pipeline name"
                              className={`${styles.inputField} ${isDarkTheme ? styles.darkTheme : ""}`}
                            />
                          </div>
                          
                          <div className={styles.inputGroup}>
                            <label className={`${styles.fieldLabel} ${isDarkTheme ? styles.darkTheme : ""}`}>Source Template</label>
                            <select
                              value={pipelineSourceTemplate}
                              onChange={(e) => setPipelineSourceTemplate(e.target.value)}
                              className={`${styles.selectField} ${isDarkTheme ? styles.darkTheme : ""}`}
                            >
                              <option value="">Select source template...</option>
                              {getEntityTemplates(selectedEntityIndex).map((template) => (
                                <option key={template.docId} value={template.docId}>
                                  {template.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          <div className={styles.inputGroup}>
                            <label className={`${styles.fieldLabel} ${isDarkTheme ? styles.darkTheme : ""}`}>Target Template</label>
                            <select
                              value={pipelineTargetTemplate}
                              onChange={(e) => setPipelineTargetTemplate(e.target.value)}
                              className={`${styles.selectField} ${isDarkTheme ? styles.darkTheme : ""}`}
                            >
                              <option value="">Select target template...</option>
                              {getEntityTemplates(selectedEntityIndex).map((template) => (
                                <option key={template.docId} value={template.docId}>
                                  {template.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          {/* Field Mappings Section */}
                          {pipelineSourceTemplate && pipelineTargetTemplate && (
                            <div className={styles.fieldMappingsSection}>
                              <div className={styles.fieldMappingsHeader}>
                                <label className={`${styles.fieldLabel} ${isDarkTheme ? styles.darkTheme : ""}`}>
                                  Field Mappings
                                </label>
                                <button
                                  type="button"
                                  onClick={addFieldMapping}
                                  className={`${styles.addMappingButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                                >
                                  <IoAdd size={16} />
                                  Add Mapping
                                </button>
                              </div>
                              
                              <div className={styles.fieldMappings}>
                                {pipelineFieldMappings.map((mapping, index) => (
                                  <div key={index} className={`${styles.mappingRow} ${isDarkTheme ? styles.darkTheme : ""}`}>
                                    <select
                                      value={mapping.source}
                                      onChange={(e) => updateFieldMapping(index, 'source', e.target.value)}
                                      className={`${styles.selectField} ${styles.mappingSelect} ${isDarkTheme ? styles.darkTheme : ""}`}
                                    >
                                      <option value="">Source field...</option>
                                      {getSourceTemplateHeaders().map((header) => (
                                        <option key={header.key} value={header.key}>
                                          {header.name}
                                        </option>
                                      ))}
                                    </select>
                                    
                                    <span className={`${styles.mappingArrow} ${isDarkTheme ? styles.darkTheme : ""}`}>
                                      →
                                    </span>
                                    
                                    <select
                                      value={mapping.target}
                                      onChange={(e) => updateFieldMapping(index, 'target', e.target.value)}
                                      className={`${styles.selectField} ${styles.mappingSelect} ${isDarkTheme ? styles.darkTheme : ""}`}
                                    >
                                      <option value="">Target field...</option>
                                      {getTargetTemplateHeaders().map((header) => (
                                        <option key={header.key} value={header.key}>
                                          {header.name}
                                        </option>
                                      ))}
                                    </select>
                                    
                                    <button
                                      type="button"
                                      onClick={() => removeFieldMapping(index)}
                                      className={`${styles.removeButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                                      title="Remove mapping"
                                    >
                                      <IoTrash size={14} />
                                    </button>
                                  </div>
                                ))}
                                
                                {pipelineFieldMappings.length === 0 && (
                                  <div className={`${styles.emptyMappings} ${isDarkTheme ? styles.darkTheme : ""}`}>
                                    <p>No field mappings yet. Add mappings to specify how data transfers between templates.</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          <div className={styles.formActions}>
                            <button
                              onClick={cancelPipelineForm}
                              className={`${styles.secondaryButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={editingPipelineIndex !== null ? updateEntityPipeline : addEntityPipeline}
                              className={`${styles.primaryButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                              disabled={
                                !newPipelineName.trim() || 
                                !pipelineSourceTemplate || 
                                !pipelineTargetTemplate ||
                                pipelineFieldMappings.length === 0 ||
                                !pipelineFieldMappings.every(mapping => mapping.source && mapping.target)
                              }
                            >
                              {editingPipelineIndex !== null ? 'Update Pipeline' : 'Create Pipeline'}
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {/* Existing Pipelines */}
                      {getEntityPipelines(selectedEntityIndex).length > 0 && (
                        <div className={styles.existingPipelines}>
                          <h3 className={`${styles.subsectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Existing Pipelines</h3>
                          <div className={`${styles.configGrid} ${isDarkTheme ? styles.darkTheme : ""}`}>
                            {getEntityPipelines(selectedEntityIndex).map((pipeline, index) => {
                              const sourceTemplate = getEntityTemplates(selectedEntityIndex).find(t => t.docId === pipeline.sourceTemplateId);
                              const targetTemplate = getEntityTemplates(selectedEntityIndex).find(t => t.docId === pipeline.targetTemplateId);
                              
                              return (
                                <div
                                  key={pipeline.id}
                                  className={`${styles.configCard} ${isDarkTheme ? styles.darkTheme : ""}`}
                                >
                                  <div className={`${styles.cardIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                                    <IoGitBranch size={24} />
                                  </div>
                                  <div className={styles.cardContent}>
                                    <h3 className={`${styles.cardTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>{pipeline.name}</h3>
                                    <p className={`${styles.cardDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>
                                      {sourceTemplate?.name || 'Unknown'} → {targetTemplate?.name || 'Unknown'}
                                    </p>
                                    <div className={`${styles.mappingInfo} ${isDarkTheme ? styles.darkTheme : ""}`}>
                                      <span className={`${styles.mappingCount} ${isDarkTheme ? styles.darkTheme : ""}`}>
                                        {pipeline.fieldMappings?.length || 0} field mapping{(pipeline.fieldMappings?.length || 0) !== 1 ? 's' : ''}
                                      </span>
                                    </div>
                                  </div>
                                  <div className={styles.cardActions}>
                                    <button
                                      onClick={() => editEntityPipeline(index)}
                                      className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                                      aria-label="Edit pipeline"
                                    >
                                      <IoCreate size={16} />
                                    </button>
                                    <button
                                      onClick={() => deleteEntityPipeline(index)}
                                      className={`${styles.actionButton} ${styles.dangerButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                                      aria-label="Delete pipeline"
                                    >
                                      <IoTrash size={16} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className={styles.section}>
                    <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>No Entity Selected</h2>
                    <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Please select an entity first to manage templates.</p>
                  </div>
                )}
              </>
            )}

            {step === 3 && (
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
                          ref={(el) => sectionRefs.current.set(section.name || `section-${index}`, el)}
                          key={section.name || `section-${index}`}
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

            {step === 4 &&
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
                          key={`${currentSectionIndex}-${index}`}
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

            {step === 5 &&
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
                    {/* Prevent focus/edit for id, typeOfCards, typeOfProfile and assignedTo */}
                    <input
                      type="text"
                      value={newHeaderName}
                      onChange={(e) => setNewHeaderName(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Field Name"
                      className={`${styles.inputField} ${isDarkTheme ? styles.darkTheme : ""}`}
                      disabled={['docId', 'typeOfCards', 'typeOfProfile', 'assignedTo'].includes(currentCardTemplates[selectedTemplateIndex].headers[activeHeaderIndex].key)}
                      tabIndex={['docId', 'typeOfCards', 'typeOfProfile', 'assignedTo'].includes(currentCardTemplates[selectedTemplateIndex].headers[activeHeaderIndex].key) ? -1 : 0}
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

            {step === 6 && selectedTemplateIndex !== null && (
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