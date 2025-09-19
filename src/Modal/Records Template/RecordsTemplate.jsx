import { useState, useContext, useCallback, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import styles from "./RecordsTemplate.module.css";
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
import { updateRecordTemplatesAndRecordsFunction } from '../../Firebase/Firebase Functions/User Functions/updateRecordTemplatesAndRecordsFunction';
import fetchUserData from '../../Firebase/Firebase Functions/User Functions/FetchUserData';

const RecordsTemplate = ({ tempData, setTempData, businessId: businessIdProp }) => {
  const { 
    isDarkTheme, 
    businessId: businessIdContext,
    templateObjects: contextTemplateObjects,
    setTemplateObjects: contextSetTemplateObjects
  } = useContext(MainContext);
  const { registerModalSteps, goToStep, goBack, currentStep, setModalConfig } = useContext(ModalNavigatorContext);

  const businessId = businessIdProp || businessIdContext;

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
  
  // Object management state - use local state to prevent Firestore overwrites
  const [templateObjects, setTemplateObjects] = useState(() => {
    const objects = contextTemplateObjects || [];
    // Process objects to ensure templates have proper structure
    return objects.map(object => ({
      ...object,
      templates: (object.templates || []).map((t) => {
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
            isUsed: h.key === "docId" || h.key === "linkId" || h.key === "typeOfRecord" || h.key === "typeOfObject" || h.key === "assignedTo" ? true : h.isUsed ?? false,
          })),
          sections: t.sections.map((s) => ({
            ...s,
            keys: s.keys.includes("docId") || s.keys.includes("linkId") || s.keys.includes("typeOfRecord") || s.keys.includes("typeOfObject") || s.keys.includes("assignedTo") ? s.keys : [...s.keys],
          })),
          isModified: t.isModified || false,
          action: t.action || null,
        };
      })
    }));
  });
  const [selectedObjectIndex, setSelectedObjectIndex] = useState(null);
  const [newObjectName, setNewObjectName] = useState("");
  const [showObjectForm, setShowObjectForm] = useState(false);
  const [editingObjectIndex, setEditingObjectIndex] = useState(null);
  const [editingObjectName, setEditingObjectName] = useState("");
  
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
  
  // Helper function to get all templates flattened
  const getAllTemplates = useCallback(() => {
    return templateObjects.flatMap(object => 
      (object.templates || []).map(template => ({
        ...template,
        objectId: object.id,
        objectName: object.name
      }))
    );
  }, [templateObjects]);
  
  const prevStepRef = useRef(currentStep);
  const lastTempDataRef = useRef({ deletedHeaderKeys, templateObjects });
  const initialStateRef = useRef(null); // Track initial state to detect changes

  // Update tempData only when necessary (prevent infinite loop)
  useEffect(() => {
    if (
      !isEqual(lastTempDataRef.current.deletedHeaderKeys, deletedHeaderKeys) ||
      !isEqual(lastTempDataRef.current.templateObjects, templateObjects)
    ) {
      setTempData({ 
        deletedHeaderKeys, 
        templateObjects,
        hasObjectChanges: hasChanges() // Pass the change detection result
      });
      lastTempDataRef.current = { deletedHeaderKeys, templateObjects };
    }
     
  }, [deletedHeaderKeys, templateObjects, setTempData]);

  // Initialize initial state and detect changes
  useEffect(() => {
    if (!initialStateRef.current) {
      // Store initial state when component mounts
      initialStateRef.current = {
        deletedHeaderKeys: [...deletedHeaderKeys],
        templateObjects: JSON.parse(JSON.stringify(templateObjects))
      };
    }
  }, [deletedHeaderKeys, templateObjects]);

  // Function to detect if there are any changes from initial state
  const hasChanges = useCallback(() => {
    if (!initialStateRef.current) return false;
    
    return (
      !isEqual(initialStateRef.current.deletedHeaderKeys, deletedHeaderKeys) ||
      !isEqual(initialStateRef.current.templateObjects, templateObjects)
    );
  }, [deletedHeaderKeys, templateObjects]);

  // Function to update tempData only if there are changes
  const updateTempDataIfChanged = useCallback(() => {
    if (hasChanges()) {
      setTempData({ deletedHeaderKeys, templateObjects });
      lastTempDataRef.current = { deletedHeaderKeys, templateObjects };
    }
  }, [deletedHeaderKeys, templateObjects, hasChanges, setTempData]);

  // Sync local templateObjects with context on initial load
  useEffect(() => {
    if (contextTemplateObjects && contextTemplateObjects.length > 0 && templateObjects.length === 0) {
      setTemplateObjects(contextTemplateObjects);
    }
  }, [contextTemplateObjects, templateObjects.length, setTemplateObjects]);

  // Initialize tempData with initial values including templateObjects
  useEffect(() => {
    setTempData({ 
      deletedHeaderKeys, 
      templateObjects,
      hasObjectChanges: hasChanges() // Include change detection
    });
    lastTempDataRef.current = { deletedHeaderKeys, templateObjects };
    
    // Store initial state after first load
    if (!initialStateRef.current) {
      initialStateRef.current = {
        deletedHeaderKeys: [...deletedHeaderKeys],
        templateObjects: JSON.parse(JSON.stringify(templateObjects))
      };
    }
  }, []); // Only run once on mount

  const initialEditingNameRef = useRef(null);
  
  useEffect(() => {
    if (editingObjectIndex !== null) {
      // Store the initial name when editing starts
      if (initialEditingNameRef.current === null) {
        initialEditingNameRef.current = templateObjects[editingObjectIndex]?.name || "";
      }
      
      // Check if the object name in context has changed from the initial name
      // This indicates an external update (like successful save)
      const currentObject = templateObjects[editingObjectIndex];
      if (currentObject && currentObject.name !== initialEditingNameRef.current) {
        // Object name was updated externally, reset editing state
        setEditingObjectIndex(null);
        setEditingObjectName("");
        initialEditingNameRef.current = null;
      }
    } else {
      // Reset the ref when not editing
      initialEditingNameRef.current = null;
    }
  }, [templateObjects, editingObjectIndex]);

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
      setSelectedObjectIndex(null);
      goBack();
    } else {
      goBack();
    }
    setNavigationDirection("backward");
  }, [currentStep, goBack, editMode, resetHeaderForm]);

  const deleteHeader = useCallback(
    (index) => {
      if (selectedObjectIndex === null || selectedTemplateIndex === null) return;
      const object = templateObjects[selectedObjectIndex];
      const template = object.templates[selectedTemplateIndex];
      const header = template.headers[index];
      if (header.key === "docId" || header.key === "linkId" || header.key === "typeOfRecord" || header.key === "typeOfObject" || header.key === "assignedTo") {
        alert("The 'ID', 'Link ID', 'Type of Records', 'Type of Object' or 'Assigned To' field cannot be deleted.");
        return;
      }
      const headerName = header.name;
      if (window.confirm(`Are you sure you want to delete the field "${headerName}"?`)) {
        setDeletedHeaderKeys((prev) => [...new Set([...prev, header.key])]); // Avoid duplicates
        setTemplateObjects((prev) => {
          const newObjects = [...prev];
          const currentObject = { ...newObjects[selectedObjectIndex] };
          const currentTemplate = { ...currentObject.templates[selectedTemplateIndex] };
          const deletedKey = currentTemplate.headers[index].key;
          currentTemplate.headers = currentTemplate.headers.filter((_, i) => i !== index);
          currentTemplate.sections = currentTemplate.sections.map((section) => ({
            ...section,
            keys: section.keys.filter((k) => k !== deletedKey),
          }));
          currentObject.templates[selectedTemplateIndex] = {
            ...currentTemplate,
            isModified: true,
            action: currentTemplate.action || "update",
          };
          newObjects[selectedObjectIndex] = currentObject;
          return newObjects;
        });
        setActiveHeaderIndex(null);
        setNavigationDirection("backward");
        goBack();
      }
    },
    [selectedObjectIndex, selectedTemplateIndex, templateObjects, goBack]
  );

  const handleDeleteSection = useCallback(
    (index) => {
      if (selectedObjectIndex === null || selectedTemplateIndex === null) return;
      const object = templateObjects[selectedObjectIndex];
      const template = object.templates[selectedTemplateIndex];
      const section = template.sections[index];
      if (section.name === "Record Data") {
        alert("The 'Record Data' section cannot be deleted as it contains critical fields.");
        return;
      }
      const sectionContainsProtectedKey = section.keys.some((key) => key === "docId" || key === "linkId" || key === "typeOfRecord" || key === "typeOfObject" || key === "assignedTo");
      if (sectionContainsProtectedKey) {
        alert("This section cannot be deleted because it contains the 'ID', 'Link ID', 'Type of Records', 'Type of Object' or 'Assigned To' field.");
        return;
      }
      if (window.confirm(`Are you sure you want to delete the section "${section.name}"?`)) {
        setDeletedHeaderKeys((prev) => [...new Set([...prev, ...section.keys])]); // Avoid duplicates
        setTemplateObjects((prev) => {
          const newObjects = [...prev];
          const currentObject = { ...newObjects[selectedObjectIndex] };
          const currentTemplate = { ...currentObject.templates[selectedTemplateIndex] };
          const deletedSection = currentTemplate.sections[index];
          currentTemplate.sections = currentTemplate.sections.filter((_, i) => i !== index);
          currentTemplate.headers = currentTemplate.headers.map((h) =>
            h.section === deletedSection.name ? { ...h, section: "", isUsed: false } : h
          );
          currentObject.templates[selectedTemplateIndex] = {
            ...currentTemplate,
            isModified: true,
            action: currentTemplate.action || "update",
          };
          newObjects[selectedObjectIndex] = currentObject;
          return newObjects;
        });
        setNavigationDirection("backward");
        goBack();
      }
    },
    [selectedObjectIndex, selectedTemplateIndex, templateObjects, goBack]
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
    if (selectedObjectIndex === null || selectedTemplateIndex === null) return;
    const object = templateObjects[selectedObjectIndex];
    const template = object.templates[selectedTemplateIndex];
    const existingHeaders = template.headers;
    if (!validateHeader(newHeaderName, existingHeaders)) return;
    if (!newHeaderSection) {
      alert("Please select a section for the field.");
      return;
    }
    if (newHeaderSection === "Record Data") {
      alert("The 'Record Data' section is reserved for 'ID', 'Type of Records', 'Type of Object' and 'Assigned To' fields.");
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

    setTemplateObjects((prev) => {
      const newObjects = [...prev];
      const currentObject = { ...newObjects[selectedObjectIndex] };
      const currentTemplate = { ...currentObject.templates[selectedTemplateIndex] };
      currentTemplate.headers = [...currentTemplate.headers, newHeader];
      currentTemplate.sections = currentTemplate.sections.map((section) => {
        if (section.name === newHeaderSection) {
          return { ...section, keys: [...section.keys, newHeader.key] };
        }
        return section;
      });
      currentObject.templates[selectedTemplateIndex] = {
        ...currentTemplate,
        isModified: true,
        action: currentTemplate.action || "update",
      };
      newObjects[selectedObjectIndex] = currentObject;
      return newObjects;
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
    selectedObjectIndex,
    selectedTemplateIndex,
    templateObjects,
    validateHeader,
    resetHeaderForm,
    goBack,
  ]);

  // Update existing header
  const updateHeader = useCallback(
    (index) => {
      if (selectedObjectIndex === null || selectedTemplateIndex === null) return;
      const object = templateObjects[selectedObjectIndex];
      const template = object.templates[selectedTemplateIndex];
      const existingHeaders = template.headers;
      if (!validateHeader(newHeaderName, existingHeaders, true, index)) return;
      if (!newHeaderSection) {
        alert("Please select a section for the field.");
        return;
      }

      const currentHeader = template.headers[index];
      const isProtected = currentHeader.key === "docId" || currentHeader.key === "typeOfRecord" || currentHeader.key === "typeOfObject" || currentHeader.key === "assignedTo";

      if (isProtected && newHeaderSection !== "Record Data") {
        alert("The 'ID', 'Type of Records', 'Type of Object' and 'Assigned To' fields must remain in the 'Record Data' section.");
        return;
      }

      // Prevent changing type when editing an existing header
      if (currentHeader.type !== newHeaderType) {
        alert("You cannot change the type of a field after it has been created.");
        return;
      }

      setTemplateObjects((prev) => {
        const newObjects = [...prev];
        const currentObject = { ...newObjects[selectedObjectIndex] };
        const currentTemplate = { ...currentObject.templates[selectedTemplateIndex] };
        const headers = [...currentTemplate.headers];
        const sections = currentTemplate.sections.map((s) => ({ ...s, keys: [...s.keys] })); // Deep copy sections
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

        currentObject.templates[selectedTemplateIndex] = {
          ...currentTemplate,
          headers,
          sections,
          isModified: true,
          action: currentTemplate.action || "update",
        };
        newObjects[selectedObjectIndex] = currentObject;
        return newObjects;
      });
      resetHeaderForm();
      setActiveHeaderIndex(null);
      setNavigationDirection("backward");
      goBack();
    },
    [newHeaderName, newHeaderType, newHeaderSection, newHeaderOptions, selectedObjectIndex, selectedTemplateIndex, templateObjects, validateHeader, resetHeaderForm, goBack]
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
        { title: "Template Objects", rightButton: null },
        { title: "Record Templates", rightButton: null },
        {
          title: () =>
            selectedObjectIndex !== null && selectedTemplateIndex !== null && templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex]
              ? templateObjects[selectedObjectIndex].templates[selectedTemplateIndex].name || "New Record Template"
              : "New Record Template",
          rightButton: null,
        },
        {
          title: () =>
            selectedObjectIndex !== null && selectedTemplateIndex !== null &&
            currentSectionIndex !== null &&
            templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex]?.sections[currentSectionIndex]
              ? templateObjects[selectedObjectIndex].templates[selectedTemplateIndex].sections[currentSectionIndex].name || "Section"
              : "Section",
          rightButton: null,
        },
        {
          title: () =>
            selectedObjectIndex !== null && selectedTemplateIndex !== null && activeHeaderIndex !== null && templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex]?.headers[activeHeaderIndex]
              ? templateObjects[selectedObjectIndex].templates[selectedTemplateIndex].headers[activeHeaderIndex].name || "Edit Field"
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
        title: "Record Templates",
        rightButton: null,
        leftButton: null,
      });
    }
  }, [registerModalSteps, setModalConfig, selectedObjectIndex, selectedTemplateIndex, currentSectionIndex, templateObjects, saveHeader]);

  // Update modal config
  useEffect(() => {
    if (currentStep === 1) {
      setModalConfig({
        showTitle: true,
        showDoneButton: true,
        showBackButton: false,
        title: "Template Objects",
        backButtonTitle: "",
        leftButton: null,
        rightButton: null,
      });
    } else if (currentStep === 2) {
      setModalConfig({
        showTitle: true,
        showDoneButton: true,
        showBackButton: true,
        title: "Record Templates",
        backButtonTitle: "Template Objects",
        backButton: { label: "Template Objects", onClick: handleBack },
        leftButton: null,
        rightButton: null,
      });
    } else if (currentStep === 3) {
      setModalConfig({
        showTitle: true,
        showDoneButton: false,
        showBackButton: !editMode,
        backButtonTitle: "Record Templates",
        backButton: editMode ? null : { label: "Record Templates", onClick: handleBack },
        title: selectedObjectIndex !== null && selectedTemplateIndex !== null && templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex] ? templateObjects[selectedObjectIndex].templates[selectedTemplateIndex].name || "New Record Template" : "New Record Template",
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
          : selectedObjectIndex !== null && selectedTemplateIndex !== null && templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex]
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
        backButtonTitle: templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex]?.name || "New Record Template",
        backButton: editMode ? null : { label: templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex]?.name || "New Record Template", onClick: handleBack },
        title: templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex]?.sections[currentSectionIndex]?.name || "Section",
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
        backButtonTitle: templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex]?.sections[currentSectionIndex]?.name || "Section",
        backButton: { label: templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex]?.sections[currentSectionIndex]?.name || "Section", onClick: handleBack },
        title: templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex]?.headers[activeHeaderIndex]?.name || "Edit Field",
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
        backButtonTitle: templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex]?.sections[currentSectionIndex]?.name || "Section",
        backButton: { label: templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex]?.sections[currentSectionIndex]?.name || "Section", onClick: handleBack },
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
  }, [currentStep, selectedTemplateIndex, currentSectionIndex, editMode, templateObjects, setModalConfig, saveHeader, handleBack]);

  // Confirm new template
  const confirmNewTemplate = useCallback(() => {
    if (!newTemplateName.trim()) {
      alert("Please enter a record template name.");
      return;
    }
    if (selectedObjectIndex === null) {
      alert("Please select a object first.");
      return;
    }
    // Check for duplicate names across all templates
    const allTemplates = getAllTemplates();
    if (allTemplates.some((t) => t.name.toLowerCase() === newTemplateName.trim().toLowerCase())) {
      alert("A record template with this name already exists. Please choose a unique name.");
      return;
    }

    const timestampId = `template_${Date.now()}`;
    const newTemplate = {
      docId: timestampId,
      name: newTemplateName.trim(),
      typeOfRecord: newTemplateName.trim(),
      objectId: templateObjects[selectedObjectIndex].id,
      headers: [
        {
          key: "docId",
          name: "ID",
          type: "text",
          section: "Record Data",
          isUsed: true,
        },
        {
          key: "linkId",
          name: "Link ID",
          type: "text",
          section: "Record Data",
          isUsed: true,
        },
        {
          key: "typeOfRecord",
          name: "Type of Record",
          type: "text",
          section: "Record Data",
          isUsed: true,
        },
        {
          key: "typeOfObject",
          name: "Type of Object",
          type: "text",
          section: "Record Data",
          isUsed: true,
        },
        {
          key: "assignedTo",
          name: "Assigned To",
          type: "text",
          section: "Record Data",
          isUsed: true,
        },
      ],
      sections: [
        {
          name: "Primary Section",
          keys: [],
        },
        {
          name: "Record Data",
          keys: ["docId", "linkId", "typeOfRecord", "typeOfObject", "assignedTo"],
        },
      ],
      isModified: true,
      action: "add",
    };

    setTemplateObjects((prev) => {
      const newObjects = [...prev];
      const currentObject = { ...newObjects[selectedObjectIndex] };
      currentObject.templates = [...currentObject.templates, newTemplate];
      newObjects[selectedObjectIndex] = currentObject;
      return newObjects;
    });
    setSelectedTemplateIndex(templateObjects[selectedObjectIndex].templates.length);
    setEditMode(false);

    setNavigationDirection("forward");
    goToStep(3);
  }, [newTemplateName, getAllTemplates, selectedObjectIndex, templateObjects, goToStep]);

  // Add new section
  const addSection = useCallback(() => {
    if (selectedObjectIndex === null || selectedTemplateIndex === null) return;
    setTemplateObjects((prev) => {
      const newObjects = [...prev];
      const currentObject = { ...newObjects[selectedObjectIndex] };
      const currentTemplate = { ...currentObject.templates[selectedTemplateIndex] };
      const newSectionName = `Section ${currentTemplate.sections.length + 1}`;
      if (currentTemplate.sections.some((s) => s.name.toLowerCase() === newSectionName.toLowerCase())) {
        alert(`Section name "${newSectionName}" already exists. Please use a unique name.`);
        return prev;
      }
      currentTemplate.sections = [...currentTemplate.sections, { name: newSectionName, keys: [] }];
      currentObject.templates[selectedTemplateIndex] = {
        ...currentTemplate,
        isModified: true,
        action: currentTemplate.action || "update",
      };
      newObjects[selectedObjectIndex] = currentObject;
      return newObjects;
    });
  }, [selectedObjectIndex, selectedTemplateIndex, templateObjects]);
  
  // Update section name
  const updateSectionName = useCallback(
    (index, newName) => {
      if (selectedObjectIndex === null || selectedTemplateIndex === null) return;
      setTemplateObjects((prev) => {
        const newObjects = [...prev];
        const currentObject = { ...newObjects[selectedObjectIndex] };
        const currentTemplate = { ...currentObject.templates[selectedTemplateIndex] };
        const currentSection = currentTemplate.sections[index];
        
        if (currentSection.name === "Record Data") {
          alert("The 'Record Data' section cannot be renamed.");
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
        currentObject.templates[selectedTemplateIndex] = {
          ...currentTemplate,
          isModified: true,
          action: currentTemplate.action || "update",
        };
        newObjects[selectedObjectIndex] = currentObject;
        return newObjects;
      });
    },
    [selectedObjectIndex, selectedTemplateIndex, templateObjects]
  );

  // Drag-and-drop handlers
  const handleDragStart = useCallback((e, sectionIndex, index) => {
    if (selectedObjectIndex === null || selectedTemplateIndex === null) return;
    const object = templateObjects[selectedObjectIndex];
    const template = object.templates[selectedTemplateIndex];
    const key = template.sections[sectionIndex].keys[index];
    if (key === "docId" || key === "linkId" || key === "typeOfRecord" || key === "typeOfObject" || key === "assignedTo") {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    setDraggedSectionIndex(sectionIndex);
    e.dataTransfer.effectAllowed = "move";
    const element = keyRefs.current.get(`${sectionIndex}-${index}`);
    if (element) element.classList.add(styles.dragging);
  }, [selectedTemplateIndex, templateObjects]);

  const handleTouchStart = useCallback((e, sectionIndex, index) => {
    if (selectedObjectIndex === null || selectedTemplateIndex === null) return;
    const object = templateObjects[selectedObjectIndex];
    const template = object.templates[selectedTemplateIndex];
    const key = template.sections[sectionIndex].keys[index];
    if (key === "docId" || key === "linkId" || key === "typeOfRecord" || key === "typeOfObject" || key === "assignedTo") {
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
  }, [selectedObjectIndex, selectedTemplateIndex, templateObjects, styles.dragIcon]);

  const handleDragOver = useCallback(
    (e, sectionIndex, index) => {
      e.preventDefault();
      if (draggedIndex === null || draggedSectionIndex !== sectionIndex || draggedIndex === index || selectedObjectIndex === null || selectedTemplateIndex === null) return;

      setTemplateObjects((prev) => {
        const newObjects = [...prev];
        const currentObject = { ...newObjects[selectedObjectIndex] };
        const currentTemplate = { ...currentObject.templates[selectedTemplateIndex] };
        const newSections = [...currentTemplate.sections];
        const sectionKeys = [...newSections[sectionIndex].keys];
        const [draggedItem] = sectionKeys.splice(draggedIndex, 1);
        sectionKeys.splice(index, 0, draggedItem);
        newSections[sectionIndex] = { ...newSections[sectionIndex], keys: sectionKeys };
        currentTemplate.sections = newSections;
        currentObject.templates[selectedTemplateIndex] = {
          ...currentTemplate,
          isModified: true,
          action: currentTemplate.action || "update",
        };
        newObjects[selectedObjectIndex] = currentObject;
        return newObjects;
      });
      setTimeout(() => setDraggedIndex(index), 0);
    },
    [draggedIndex, draggedSectionIndex, selectedObjectIndex, selectedTemplateIndex, templateObjects]
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
        Math.min(touchTargetIndex + delta, templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex]?.sections[sectionIndex]?.keys.length - 1 || 0)
      );

      if (newIndex !== draggedIndex) {
        setTemplateObjects((prev) => {
          const newObjects = [...prev];
          const currentObject = { ...newObjects[selectedObjectIndex] };
          const currentTemplate = { ...currentObject.templates[selectedTemplateIndex] };
          const newSections = [...currentTemplate.sections];
          const sectionKeys = [...newSections[sectionIndex].keys];
          const [draggedItem] = sectionKeys.splice(draggedIndex, 1);
          sectionKeys.splice(newIndex, 0, draggedItem);
          newSections[sectionIndex] = { ...newSections[sectionIndex], keys: sectionKeys };
          currentTemplate.sections = newSections;
          currentObject.templates[selectedTemplateIndex] = {
            ...currentTemplate,
            isModified: true,
            action: currentTemplate.action || "update",
          };
          newObjects[selectedObjectIndex] = currentObject;
          return newObjects;
        });
        setTimeout(() => setDraggedIndex(newIndex), 0);
      }
    },
    [draggedIndex, touchStartY, touchTargetIndex, selectedObjectIndex, selectedTemplateIndex, templateObjects]
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
    if (draggedSectionOrderIndex === null || draggedSectionOrderIndex === index || selectedObjectIndex === null || selectedTemplateIndex === null) return;
    setTemplateObjects((prev) => {
      const newObjects = [...prev];
      const currentObject = { ...newObjects[selectedObjectIndex] };
      const currentTemplate = { ...currentObject.templates[selectedTemplateIndex] };
      const newSections = [...currentTemplate.sections];
      const [draggedSection] = newSections.splice(draggedSectionOrderIndex, 1);
      newSections.splice(index, 0, draggedSection);
      currentTemplate.sections = newSections;
      currentObject.templates[selectedTemplateIndex] = {
        ...currentTemplate,
        isModified: true,
        action: currentTemplate.action || 'update',
      };
      newObjects[selectedObjectIndex] = currentObject;
      return newObjects;
    });
    setDraggedSectionOrderIndex(index);
  }, [draggedSectionOrderIndex, selectedObjectIndex, selectedTemplateIndex, templateObjects]);

  const handleSectionTouchMove = useCallback((e, index) => {
    if (draggedSectionOrderIndex === null || sectionTouchStartY === null || selectedObjectIndex === null || selectedTemplateIndex === null) return;
    e.preventDefault();
    const touchY = e.touches[0].clientY;
    const itemHeight = 44;
    const delta = Math.round((touchY - sectionTouchStartY) / itemHeight);
    const template = templateObjects[selectedObjectIndex].templates[selectedTemplateIndex];
    const newIndex = Math.max(0, Math.min(sectionTouchTargetIndex + delta, template.sections.length - 1));
    if (newIndex !== draggedSectionOrderIndex) {
      setTemplateObjects((prev) => {
        const newObjects = [...prev];
        const currentObject = { ...newObjects[selectedObjectIndex] };
        const currentTemplate = { ...currentObject.templates[selectedTemplateIndex] };
        const newSections = [...currentTemplate.sections];
        const [draggedSection] = newSections.splice(draggedSectionOrderIndex, 1);
        newSections.splice(newIndex, 0, draggedSection);
        currentTemplate.sections = newSections;
        currentObject.templates[selectedTemplateIndex] = {
          ...currentTemplate,
          isModified: true,
          action: currentTemplate.action || 'update',
        };
        newObjects[selectedObjectIndex] = currentObject;
        return newObjects;
      });
      setDraggedSectionOrderIndex(newIndex);
    }
  }, [draggedSectionOrderIndex, sectionTouchStartY, sectionTouchTargetIndex, selectedObjectIndex, selectedTemplateIndex, templateObjects]);

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
      if (template && selectedObjectIndex !== null) {
        const object = templateObjects[selectedObjectIndex];
        const templateIndex = object.templates.findIndex((t) => t.name === template.name);
        if (templateIndex >= 0) {
          setSelectedTemplateIndex(templateIndex);
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
    [selectedObjectIndex, templateObjects, goToStep]
  );

  // Object Management Functions
  const createNewObject = useCallback(async () => {
    if (!newObjectName.trim()) {
      alert("Please enter a object name.");
      return;
    }
    if (templateObjects.some((object) => object.name.toLowerCase() === newObjectName.trim().toLowerCase())) {
      alert("A object with this name already exists. Please choose a unique name.");
      return;
    }

    const newObject = {
      id: uuidv4(),
      name: newObjectName.trim(),
      templates: [],
      pipelines: []
    };

    try {
      // Add object to local state first
      const updatedObjects = [...templateObjects, newObject];
      setTemplateObjects(updatedObjects);
      
      // Update tempData immediately
      setTempData({ 
        deletedHeaderKeys, 
        templateObjects: updatedObjects,
        hasObjectChanges: true // Mark that objects have changed
      });
      
      setNewObjectName("");
      setShowObjectForm(false);
    } catch (error) {
      console.error('Error creating object:', error);
      alert('Failed to create object. Please try again.');
      
      // Restore previous state in case of error
      setTemplateObjects(templateObjects);
    }
  }, [newObjectName, templateObjects, businessId, deletedHeaderKeys, setTempData]);

  const selectObject = useCallback((objectIndex) => {
    setSelectedObjectIndex(objectIndex);
    setNavigationDirection("forward");
    goToStep(2);
  }, [goToStep]);

  const deleteObject = useCallback(async (objectIndex) => {
    const object = templateObjects[objectIndex];
    
    // Check for templates in both local state and object.templates (from backend)
    const localTemplates = getAllTemplates().filter(template => 
      template.objectId === object.id && template.action !== "remove"
    );
    const objectTemplatesFromBackend = object.templates || [];
    
    // Count total templates (local + backend, avoiding duplicates)
    const allTemplateIds = new Set([
      ...localTemplates.map(t => t.docId),
      ...objectTemplatesFromBackend.map(t => t.docId)
    ]);
    
    if (allTemplateIds.size > 0) {
      alert(`Cannot delete object "${object.name}" because it contains ${allTemplateIds.size} template(s). Please delete all templates first.`);
      return;
    }
    if (window.confirm(`Are you sure you want to delete the object "${object.name}"? This action cannot be undone.`)) {
      try {
        // Mark object for deletion instead of removing it from array
        const updatedObjects = templateObjects.map((e, index) => 
          index === objectIndex 
            ? { ...e, isModified: true, action: "remove" }
            : e
        );
        setTemplateObjects(updatedObjects);
        
      setTempData({ 
        deletedHeaderKeys, 
        templateObjects: updatedObjects,
        hasObjectChanges: true // Mark that objects have changed
      });
        
        // Reset selected object if it was the deleted one
        if (selectedObjectIndex === objectIndex) {
          setSelectedObjectIndex(null);
        }
      } catch (error) {
        console.error('Error marking object for deletion:', error);
        alert('Failed to mark object for deletion. Please try again.');
        
        // Restore object in case of error
        setTemplateObjects(templateObjects);
        setSelectedObjectIndex(selectedObjectIndex);
      }
    }
  }, [templateObjects, selectedObjectIndex, businessId, setTemplateObjects, deletedHeaderKeys, setTempData]);

  const updateObjectName = useCallback(async (objectIndex, newName) => {
    if (!newName.trim()) return;
    if (templateObjects.some((object, index) => index !== objectIndex && object.name.toLowerCase() === newName.trim().toLowerCase())) {
      alert("A object with this name already exists. Please choose a unique name.");
      return;
    }

    const previousName = templateObjects[objectIndex].name;
    const objectId = templateObjects[objectIndex].id;

    // Update local state only
    const updatedObjects = templateObjects.map((object, index) => 
      index === objectIndex 
        ? { 
            ...object, 
            name: newName.trim(), 
            isModified: true, 
            action: object.action || "update",
            templates: (object.templates || []).map(template => ({
              ...template,
              objectName: newName.trim()
            }))
          }
        : object
    );
    
    setTemplateObjects(updatedObjects);
    
    // Update tempData immediately to reflect the name change
    setTempData({ 
      deletedHeaderKeys, 
      templateObjects: updatedObjects,
      hasObjectChanges: true // Explicitly mark that objects have changed
    });
  }, [templateObjects, deletedHeaderKeys, setTempData]);

  const startEditingObject = useCallback((objectIndex) => {
    setEditingObjectIndex(objectIndex);
    setEditingObjectName(templateObjects[objectIndex].name);
  }, [templateObjects]);

  const cancelEditingObject = useCallback(() => {
    setEditingObjectIndex(null);
    setEditingObjectName("");
  }, []);

  const saveObjectName = useCallback(async () => {
    if (editingObjectIndex !== null) {
      await updateObjectName(editingObjectIndex, editingObjectName);
      setEditingObjectIndex(null);
      setEditingObjectName("");
    }
  }, [editingObjectIndex, editingObjectName, updateObjectName]);

  const getObjectTemplates = useCallback((objectIndex) => {
    if (objectIndex === null || !templateObjects[objectIndex]) return [];
    const object = templateObjects[objectIndex];
    return (object.templates || []).filter(template => template.action !== "remove");
  }, [templateObjects]);

  // Get pipelines for a specific object
  const getObjectPipelines = useCallback((objectIndex) => {
    if (objectIndex === null || !templateObjects[objectIndex]) return [];
    const object = templateObjects[objectIndex];
    return object.pipelines || [];
  }, [templateObjects]);

  // Add new pipeline to object
  const addObjectPipeline = useCallback(async () => {
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

    const newPipeline = {
      id: `pipeline_${Date.now()}`,
      name: newPipelineName.trim(),
      sourceTemplateId: pipelineSourceTemplate,
      targetTemplateId: pipelineTargetTemplate,
      fieldMappings: pipelineFieldMappings.length > 0 ? pipelineFieldMappings : [],
      createdAt: new Date().toISOString()
    };

    try {
      // Update local state first
      const updatedObjects = templateObjects.map((object, index) =>
        index === selectedObjectIndex
          ? { ...object, pipelines: [...(object.pipelines || []), newPipeline] }
          : object
      );
      
      setTemplateObjects(updatedObjects);
      
      // Update tempData immediately
      setTempData({ 
        deletedHeaderKeys, 
        templateObjects: updatedObjects 
      });
      
      // Reset form
      setNewPipelineName("");
      setPipelineSourceTemplate("");
      setPipelineTargetTemplate("");
      setPipelineFieldMappings([]);
      setShowPipelineForm(false);
    } catch (error) {
      console.error('Error creating pipeline:', error);
      alert('Failed to create pipeline. Please try again.');
      
      // Restore previous state in case of error
      setTemplateObjects(templateObjects);
    }
  }, [selectedObjectIndex, newPipelineName, pipelineSourceTemplate, pipelineTargetTemplate, pipelineFieldMappings, templateObjects, businessId, deletedHeaderKeys, setTempData]);

  // Edit existing pipeline
  const editObjectPipeline = useCallback((pipelineIndex) => {
    const pipeline = getObjectPipelines(selectedObjectIndex)[pipelineIndex];
    if (!pipeline) return;

    setEditingPipelineIndex(pipelineIndex);
    setNewPipelineName(pipeline.name);
    setPipelineSourceTemplate(pipeline.sourceTemplateId);
    setPipelineTargetTemplate(pipeline.targetTemplateId);
    setPipelineFieldMappings(pipeline.fieldMappings || []);
    setShowPipelineForm(true);
  }, [selectedObjectIndex, getObjectPipelines]);

  // Update existing pipeline
  const updateObjectPipeline = useCallback(() => {
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

    setTemplateObjects(prev => {
      const updated = prev.map((object, index) =>
        index === selectedObjectIndex
          ? {
              ...object,
              pipelines: object.pipelines?.map((pipeline, pIndex) =>
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
          : object
      );
      return updated;
    });

    // Reset form
    setNewPipelineName("");
    setPipelineSourceTemplate("");
    setPipelineTargetTemplate("");
    setPipelineFieldMappings([]);
    setShowPipelineForm(false);
    setEditingPipelineIndex(null);
  }, [selectedObjectIndex, editingPipelineIndex, newPipelineName, pipelineSourceTemplate, pipelineTargetTemplate, pipelineFieldMappings]);

  // Delete pipeline
  const deleteObjectPipeline = useCallback((pipelineIndex) => {
    if (!confirm('Are you sure you want to delete this pipeline?')) return;

    setTemplateObjects(prev =>
      prev.map((object, index) =>
        index === selectedObjectIndex
          ? {
              ...object,
              pipelines: object.pipelines?.filter((_, pIndex) => pIndex !== pipelineIndex) || []
            }
          : object
      )
    );
  }, [selectedObjectIndex]);

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
    if (!pipelineSourceTemplate || selectedObjectIndex === null) return [];
    const sourceTemplate = getObjectTemplates(selectedObjectIndex).find(t => t.docId === pipelineSourceTemplate);
    return sourceTemplate?.headers || [];
  }, [pipelineSourceTemplate, selectedObjectIndex, getObjectTemplates]);

  const getTargetTemplateHeaders = useCallback(() => {
    if (!pipelineTargetTemplate || selectedObjectIndex === null) return [];
    const targetTemplate = getObjectTemplates(selectedObjectIndex).find(t => t.docId === pipelineTargetTemplate);
    return targetTemplate?.headers || [];
  }, [pipelineTargetTemplate, selectedObjectIndex, getObjectTemplates]);

  // Auto-add initial field mapping when templates are selected
  useEffect(() => {
    if (pipelineSourceTemplate && pipelineTargetTemplate && pipelineFieldMappings.length === 0) {
      addFieldMapping();
    }
  }, [pipelineSourceTemplate, pipelineTargetTemplate, pipelineFieldMappings.length, addFieldMapping]);

  // Update template name
  const updateTemplateName = useCallback(
    (newName) => {
      if (selectedObjectIndex === null || selectedTemplateIndex === null) return;
      setTemplateObjects((prev) => {
        const newObjects = [...prev];
        const currentObject = { ...newObjects[selectedObjectIndex] };
        const currentTemplate = { ...currentObject.templates[selectedTemplateIndex] };
        
        // Check for duplicate names across all templates
        const allTemplates = getAllTemplates();
        if (
          newName.trim() &&
          allTemplates.some((t) => t.name.toLowerCase() === newName.trim().toLowerCase() && t !== currentTemplate)
        ) {
          alert("A record template with this name already exists. Please choose a unique name.");
          return prev;
        }
        
        currentTemplate.name = newName.trim();
        currentTemplate.typeOfRecord = newName.trim();
        currentTemplate.isModified = true;
        currentTemplate.action = currentTemplate.action || "update";
        
        currentObject.templates[selectedTemplateIndex] = currentTemplate;
        newObjects[selectedObjectIndex] = currentObject;
        return newObjects;
      });
    },
    [selectedObjectIndex, selectedTemplateIndex, templateObjects, getAllTemplates]
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
      if (selectedObjectIndex === null || selectedTemplateIndex === null || sectionIndex === null) return;
      if (key === "docId" || key === "linkId" || key === "typeOfRecord" || key === "typeOfObject" || key === "assignedTo") {
        alert("The 'ID', 'Link ID', 'Type of Record', 'Type of Object' or 'Assigned To' field cannot be deselected from the section.");
        return;
      }
      setTemplateObjects((prev) => {
        const newObjects = [...prev];
        const currentObject = { ...newObjects[selectedObjectIndex] };
        const currentTemplate = { ...currentObject.templates[selectedTemplateIndex], headers: [...currentObject.templates[selectedTemplateIndex].headers] };
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
        currentTemplate.isModified = true;
        currentTemplate.action = currentTemplate.action || "update";
        currentObject.templates[selectedTemplateIndex] = currentTemplate;
        newObjects[selectedObjectIndex] = currentObject;
        return newObjects;
      });
    },
    [selectedObjectIndex, selectedTemplateIndex]
  );

  // Delete key from section
  const handleDeleteKey = useCallback(
    (sectionIndex, key) => {
      if (selectedObjectIndex === null || selectedTemplateIndex === null || sectionIndex === null) return;
      if (key === "docId" || key === "linkId" || key === "typeOfRecord" || key === "typeOfObject" || key === "assignedTo") {
        alert("The 'ID', 'Link ID', 'Type of Record', 'Type of Object' or 'Assigned To' field cannot be removed from the section.");
        return;
      }
      if (window.confirm(`Are you sure you want to remove this field from the section?`)) {
        setTemplateObjects((prev) => {
          const newObjects = [...prev];
          const currentObject = { ...newObjects[selectedObjectIndex] };
          const currentTemplate = { ...currentObject.templates[selectedTemplateIndex], headers: [...currentObject.templates[selectedTemplateIndex].headers] };
          const newSections = [...currentTemplate.sections];
          newSections[sectionIndex].keys = newSections[sectionIndex].keys.filter((k) => k !== key);
          currentTemplate.sections = newSections;
          currentTemplate.headers = currentTemplate.headers.map((h) =>
            h.key === key ? { ...h, isUsed: false } : h
          );
          currentTemplate.isModified = true;
          currentTemplate.action = currentTemplate.action || "update";
          currentObject.templates[selectedTemplateIndex] = currentTemplate;
          newObjects[selectedObjectIndex] = currentObject;
          return newObjects;
        });
      }
    },
    [selectedObjectIndex, selectedTemplateIndex]
  );

  // Filter headers for search
  const filteredHeaders = useCallback(() => {
    if (selectedObjectIndex === null || selectedTemplateIndex === null || currentSectionIndex === null) return [];
    const object = templateObjects[selectedObjectIndex];
    const template = object.templates[selectedTemplateIndex];

    const usedKeys = template.sections
      .flatMap((section) => section.keys) || [];

    const filtered = (
      template.headers?.filter(
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
  }, [templateObjects, selectedObjectIndex, selectedTemplateIndex, currentSectionIndex, searchQuery]);

  // Delete template
  const handleDeleteTemplate = useCallback(() => {
    if (selectedObjectIndex === null || selectedTemplateIndex === null) return;
    const object = templateObjects[selectedObjectIndex];
    const template = object.templates[selectedTemplateIndex];
    const templateName = template.name;
    if (window.confirm(`Are you sure you want to delete the "${templateName}" record template?`)) {
      setTemplateObjects((prev) => {
        const newObjects = [...prev];
        const currentObject = { ...newObjects[selectedObjectIndex] };
        currentObject.templates = currentObject.templates.map((template, i) =>
          i === selectedTemplateIndex
            ? { ...template, isModified: true, action: "remove" }
            : template
        );
        newObjects[selectedObjectIndex] = currentObject;
        return newObjects;
      });
      setSelectedTemplateIndex(null);
      setEditMode(false);
      setNavigationDirection("backward");
      goToStep(2);
    }
  }, [selectedObjectIndex, selectedTemplateIndex, templateObjects, goToStep]);

  // Edit header
  const handleEditHeader = useCallback(
    (index) => {
      if (selectedObjectIndex === null || selectedTemplateIndex === null) return;
      setActiveHeaderIndex(index);
      const object = templateObjects[selectedObjectIndex];
      const template = object.templates[selectedTemplateIndex];
      const header = template.headers[index];
      setNewHeaderName(header.name);
      setNewHeaderType(header.type || "text");
      setNewHeaderSection(header.section || "");
      setNewHeaderOptions(header.options || []);
      setNavigationDirection("forward");
      goToStep(5);
    },
    [selectedObjectIndex, selectedTemplateIndex, templateObjects, goToStep]
  );

  // Create new header
  const handleCreateHeader = useCallback(() => {
    if (selectedObjectIndex === null || selectedTemplateIndex === null || currentSectionIndex === null) return;
    setActiveHeaderIndex(-1);
    resetHeaderForm();
    const object = templateObjects[selectedObjectIndex];
    const template = object.templates[selectedTemplateIndex];
    const currentSectionName = template.sections[currentSectionIndex].name;
    setNewHeaderSection(currentSectionName !== "Record Data" ? currentSectionName : "Primary Section");
    setNavigationDirection("forward");
    goToStep(6);
  }, [resetHeaderForm, goToStep, templateObjects, selectedObjectIndex, selectedTemplateIndex, currentSectionIndex]);

  // Export records for the current template
  const exportRecords = useCallback(async () => {
    if (selectedObjectIndex === null || selectedTemplateIndex === null) {
      alert('No template selected.');
      return;
    }
    const object = templateObjects[selectedObjectIndex];
    const template = object.templates[selectedTemplateIndex];
    const typeOfRecord = template.name;
    if (!typeOfRecord || !businessId) {
      alert('Missing template name or business ID.');
      return;
    }
    try {
      const recordsRef = collection(db, 'businesses', businessId, 'records');
      const q = query(recordsRef, where('typeOfRecord', '==', typeOfRecord));
      const snapshot = await getDocs(q);
      const rawRecords = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() })); // changed id to docId
      if (!rawRecords.length) {
        alert('No records found for this template.');
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
          // Check if any record has time in this date field
          const hasTime = rawRecords.some(record => {
            const value = record[key];
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
      const csvRows = rawRecords.map(record => {
        const row = [];
        dataMapping.forEach(({ key, type, hasTime }) => {
          let value = record[key];
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
      link.download = `${typeOfRecord}_records_export.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export records.');
    }
  }, [selectedObjectIndex, selectedTemplateIndex, templateObjects, businessId]);






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
                  <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Create New Object</h2>
                  <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Objects help organize your record templates into logical groups.</p>
                  <div className={`${styles.configGrid} ${isDarkTheme ? styles.darkTheme : ""}`}>
                    <div
                      onClick={() => setShowObjectForm(true)}
                      className={`${styles.configRecord} ${isDarkTheme ? styles.darkTheme : ""}`}
                      role="button"
                      aria-label="Add New Object"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setShowObjectForm(true);
                        }
                      }}
                    >
                      <div className={`${styles.recordIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                        <FaPlus size={24} />
                      </div>
                      <div className={styles.recordContent}>
                        <h3 className={`${styles.recordTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>New Object</h3>
                        <p className={`${styles.recordDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Create a new object to group your record templates</p>
                      </div>
                      <div className={`${styles.recordArrow} ${isDarkTheme ? styles.darkTheme : ""}`}>
                        <IoChevronForward size={16} />
                      </div>
                    </div>
                  </div>
                  
                  {showObjectForm && (
                    <div className={`${styles.formSection} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      <h3 className={`${styles.formTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Create New Object</h3>
                      <input
                        type="text"
                        value={newObjectName}
                        onChange={(e) => setNewObjectName(e.target.value)}
                        placeholder="Object Name"
                        className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ""}`}
                        autoFocus
                      />
                      <div className={styles.formActions}>
                        <button
                          onClick={() => {
                            setShowObjectForm(false);
                            setNewObjectName("");
                          }}
                          className={`${styles.secondaryButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={createNewObject}
                          className={`${styles.primaryButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                          disabled={!newObjectName.trim()}
                        >
                          Create Object
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                {templateObjects.length > 0 && (
                  <div className={styles.section}>
                    <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Your Objects</h2>
                    <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Select a object to manage its templates.</p>
                    <div className={`${styles.configGrid} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      {templateObjects
                        .map((object, originalIndex) => ({ object, originalIndex }))
                        .filter(({ object }) => object.action !== "remove")
                        .map(({ object, originalIndex }) => (
                        <div
                          key={object.id}
                          className={`${styles.configRecord} ${isDarkTheme ? styles.darkTheme : ""}`}
                          role="button"
                          aria-label={`Open ${object.name}`}
                          tabIndex={0}
                        >
                          <div className={`${styles.recordIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                            <FaLayerGroup size={24} />
                          </div>
                          <div 
                            className={styles.recordContent}
                            onClick={() => editingObjectIndex !== originalIndex && selectObject(originalIndex)}
                            onKeyDown={(e) => {
                              if ((e.key === "Enter" || e.key === " ") && editingObjectIndex !== originalIndex) {
                                selectObject(originalIndex);
                              }
                            }}
                          >
                            {editingObjectIndex === originalIndex ? (
                              <div className={styles.editingContent}>
                                <input
                                  type="text"
                                  value={editingObjectName}
                                  onChange={(e) => setEditingObjectName(e.target.value)}
                                  className={`${styles.objectNameInput} ${isDarkTheme ? styles.darkTheme : ""}`}
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => {
                                    e.stopPropagation();
                                    if (e.key === 'Enter') {
                                      saveObjectName();
                                    } else if (e.key === 'Escape') {
                                      cancelEditingObject();
                                    }
                                  }}
                                  autoFocus
                                />
                                <div className={styles.editActions}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      saveObjectName();
                                    }}
                                    className={`${styles.saveButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                                    disabled={!editingObjectName.trim()}
                                  >
                                    <FaCheck size={12} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      cancelEditingObject();
                                    }}
                                    className={`${styles.cancelButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                                  >
                                    <FaTimes size={12} />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <h3 className={`${styles.recordTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>{object.name}</h3>
                                <p className={`${styles.recordDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>
                                  {getObjectTemplates(originalIndex).length} template{getObjectTemplates(originalIndex).length !== 1 ? 's' : ''}
                                </p>
                              </>
                            )}
                          </div>
                          {editingObjectIndex !== originalIndex && (
                            <>
                              <div className={`${styles.recordArrow} ${isDarkTheme ? styles.darkTheme : ""}`}>
                                <IoChevronForward size={16} />
                              </div>
                              <div className={styles.objectActions}>
                                <div 
                                  className={`${styles.editButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditingObject(originalIndex);
                                  }}
                                >
                                  <FaEdit size={12} />
                                </div>
                                <div 
                                  className={`${styles.objectDeleteButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteObject(originalIndex);
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
                {selectedObjectIndex !== null && templateObjects[selectedObjectIndex] && templateObjects[selectedObjectIndex].action !== "remove" ? (
                  <>
                    <div className={styles.section}>
                      <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Create New Record Template</h2>
                      <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Start building your record data structure in {templateObjects[selectedObjectIndex].name}.</p>
                      <div className={`${styles.configGrid} ${isDarkTheme ? styles.darkTheme : ""}`}>
                        <div
                          onClick={() => handleOpenEditor()}
                          className={`${styles.configRecord} ${isDarkTheme ? styles.darkTheme : ""}`}
                          role="button"
                          aria-label="Add New Record Template"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              handleOpenEditor();
                            }
                          }}
                        >
                          <div className={`${styles.recordIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                            <FaPlus size={24} />
                          </div>
                          <div className={styles.recordContent}>
                            <h3 className={`${styles.recordTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>New Record Template</h3>
                            <p className={`${styles.recordDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Create a custom template for your records</p>
                          </div>
                          <div className={`${styles.recordArrow} ${isDarkTheme ? styles.darkTheme : ""}`}>
                            <IoChevronForward size={16} />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {getObjectTemplates(selectedObjectIndex).length > 0 && (
                      <div className={styles.section}>
                        <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Your Record Templates</h2>
                        <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Manage and edit your existing record templates in {templateObjects[selectedObjectIndex].name}.</p>
                        <div className={`${styles.configGrid} ${isDarkTheme ? styles.darkTheme : ""}`}>
                          {getObjectTemplates(selectedObjectIndex).map((template, index) => (
                            <div
                              key={template.name || `template-${index}`}
                              onClick={() => handleOpenEditor(template)}
                              className={`${styles.configRecord} ${isDarkTheme ? styles.darkTheme : ""}`}
                              role="button"
                              aria-label={`Edit ${template.name || "Unnamed Template"}`}
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  handleOpenEditor(template);
                                }
                              }}
                            >
                              <div className={`${styles.recordIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                                <FaRegCircle size={24} />
                              </div>
                              <div className={styles.recordContent}>
                                <h3 className={`${styles.recordTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>{template.name || "Unnamed Template"}</h3>
                                <p className={`${styles.recordDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Configure sections and fields</p>
                                <div className={`${styles.recordBadge} ${isDarkTheme ? styles.darkTheme : ""}`}>
                                  {template.sections?.length || 0} sections
                                </div>
                              </div>
                              <div className={`${styles.recordArrow} ${isDarkTheme ? styles.darkTheme : ""}`}>
                                <IoChevronForward size={16} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Pipelines Section */}
                    <div className={styles.section}>
                      <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Object Pipelines</h2>
                      <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Create pipelines to automatically move records between templates in {templateObjects[selectedObjectIndex].name}.</p>
                      
                      {/* Add Pipeline Button */}
                      <div className={`${styles.configGrid} ${isDarkTheme ? styles.darkTheme : ""}`}>
                        <div
                          onClick={() => setShowPipelineForm(true)}
                          className={`${styles.configRecord} ${styles.createRecord} ${isDarkTheme ? styles.darkTheme : ""}`}
                          role="button"
                          aria-label="Create new pipeline"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              setShowPipelineForm(true);
                            }
                          }}
                        >
                          <div className={`${styles.recordIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                            <IoAdd size={24} />
                          </div>
                          <div className={styles.recordContent}>
                            <h3 className={`${styles.recordTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Create Pipeline</h3>
                            <p className={`${styles.recordDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Set up automatic record movement between templates</p>
                          </div>
                          <div className={`${styles.recordArrow} ${isDarkTheme ? styles.darkTheme : ""}`}>
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
                              {getObjectTemplates(selectedObjectIndex).map((template) => (
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
                              {getObjectTemplates(selectedObjectIndex).map((template) => (
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
                              onClick={editingPipelineIndex !== null ? updateObjectPipeline : addObjectPipeline}
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
                      {getObjectPipelines(selectedObjectIndex).length > 0 && (
                        <div className={styles.existingPipelines}>
                          <h3 className={`${styles.subsectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Existing Pipelines</h3>
                          <div className={`${styles.configGrid} ${isDarkTheme ? styles.darkTheme : ""}`}>
                            {getObjectPipelines(selectedObjectIndex).map((pipeline, index) => {
                              const sourceTemplate = getObjectTemplates(selectedObjectIndex).find(t => t.docId === pipeline.sourceTemplateId);
                              const targetTemplate = getObjectTemplates(selectedObjectIndex).find(t => t.docId === pipeline.targetTemplateId);
                              
                              return (
                                <div
                                  key={pipeline.id}
                                  className={`${styles.configRecord} ${isDarkTheme ? styles.darkTheme : ""}`}
                                >
                                  <div className={`${styles.recordIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                                    <IoGitBranch size={24} />
                                  </div>
                                  <div className={styles.recordContent}>
                                    <h3 className={`${styles.recordTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>{pipeline.name}</h3>
                                    <p className={`${styles.recordDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>
                                      {sourceTemplate?.name || 'Unknown'} → {targetTemplate?.name || 'Unknown'}
                                    </p>
                                    <div className={`${styles.mappingInfo} ${isDarkTheme ? styles.darkTheme : ""}`}>
                                      <span className={`${styles.mappingCount} ${isDarkTheme ? styles.darkTheme : ""}`}>
                                        {pipeline.fieldMappings?.length || 0} field mapping{(pipeline.fieldMappings?.length || 0) !== 1 ? 's' : ''}
                                      </span>
                                    </div>
                                  </div>
                                  <div className={styles.recordActions}>
                                    <button
                                      onClick={() => editObjectPipeline(index)}
                                      className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                                      aria-label="Edit pipeline"
                                    >
                                      <IoCreate size={16} />
                                    </button>
                                    <button
                                      onClick={() => deleteObjectPipeline(index)}
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
                    <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>No Object Selected</h2>
                    <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Please select a object first to manage templates.</p>
                  </div>
                )}
              </>
            )}

            {step === 3 && (
              <>
                {selectedTemplateIndex !== null && templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex] ? (
                  <>
                    <div className={styles.section}>
                      <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Template Details</h2>
                      <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Configure your record template name and structure.</p>
                      <input
                        type="text"
                        value={templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex].name || ""}
                        onChange={(e) => updateTemplateName(e.target.value)}
                        placeholder="Record Template Name"
                        className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ""}`}
                        disabled={!editMode}
                      />
                    </div>
                    {!editMode && (
                      <div className={styles.section}>
                        <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Actions</h2>
                        <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Manage your record template and data.</p>
                        <div className={`${styles.configGrid} ${isDarkTheme ? styles.darkTheme : ""}`}>
                          <div
                            onClick={addSection}
                            className={`${styles.configRecord} ${isDarkTheme ? styles.darkTheme : ""}`}
                            role="button"
                            aria-label="Add New Section"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                addSection();
                              }
                            }}
                          >
                            <div className={`${styles.recordIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                              <FaPlus size={24} />
                            </div>
                            <div className={styles.recordContent}>
                              <h3 className={`${styles.recordTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Add Section</h3>
                              <p className={`${styles.recordDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Create a new section for your record template</p>
                            </div>
                            <div className={`${styles.recordArrow} ${isDarkTheme ? styles.darkTheme : ""}`}>
                              <IoChevronForward size={16} />
                            </div>
                          </div>
                          <div
                            onClick={exportRecords}
                            className={`${styles.configRecord} ${isDarkTheme ? styles.darkTheme : ""}`}
                            role="button"
                            aria-label="Export Records"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                exportRecords();
                              }
                            }}
                          >
                            <div className={`${styles.recordIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                              <FaDownload size={24} />
                            </div>
                            <div className={styles.recordContent}>
                              <h3 className={`${styles.recordTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Export Records</h3>
                              <p className={`${styles.recordDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Download your record data as CSV</p>
                            </div>
                            <div className={`${styles.recordArrow} ${isDarkTheme ? styles.darkTheme : ""}`}>
                              <IoChevronForward size={16} />
                            </div>
                          </div>

                        </div>
                      </div>
                    )}
                    <div className={styles.section}>
                      <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Sections</h2>
                      <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Organize your record data into logical sections.</p>
                      <div className={`${styles.sectionsGrid} ${isDarkTheme ? styles.darkTheme : ""}`}>
                        {templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex].sections.map((section, index) => (
                        <div
                          ref={(el) => sectionRefs.current.set(section.name || `section-${index}`, el)}
                          key={section.name || `section-${index}`}
                          className={`${styles.configRecord} ${
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
                          <div className={`${styles.recordIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                            {section.name === "Record Data" ? (
                              <FaDatabase size={24} />
                            ) : (
                              <FaLayerGroup size={24} />
                            )}
                          </div>
                          <div className={styles.recordContent}>
                            <div className={styles.headerRow}>
                              <div className={styles.headerMain}>
                                <h3 className={`${styles.recordTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>{section.name}</h3>
                              </div>
                              {!editMode && (
                                <div className={`${styles.recordArrow} ${isDarkTheme ? styles.darkTheme : ""}`}>
                                  <IoChevronForward size={16} />
                                </div>
                              )}
                            </div>
                            <p className={`${styles.recordDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>
                              {section.name === "Record Data" ? "Core system fields" : "Custom section"} • {section.keys?.length || 0} fields
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
                      <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Create New Record Template</h2>
                      <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Start building your record template structure.</p>
                      <input
                        type="text"
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        placeholder="Record Template Name"
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
              templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex]?.sections[currentSectionIndex] && (
              <>
                <div className={styles.section}>
                  <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Section Configuration</h2>
                  <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Customize the section name and manage its fields.</p>
                  <input
                    type="text"
                    value={templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex].sections[currentSectionIndex].name || ""}
                    onChange={(e) => updateSectionName(currentSectionIndex, e.target.value)}
                    className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ""}`}
                    placeholder="Section Name"
                    disabled={templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex].sections[currentSectionIndex].name === "Record Data" || !editMode}
                  />
                </div>
                {!editMode && (
                  <div className={styles.section}>
                    <h3 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Actions</h3>
                    <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Manage fields in this section.</p>
                    <div className={`${styles.configGrid} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      <div
                        onClick={() => handleCreateHeader()}
                        className={`${styles.configRecord} ${isDarkTheme ? styles.darkTheme : ""}`}
                        role="button"
                        aria-label="Add New Field"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            handleCreateHeader();
                          }
                        }}
                      >
                        <div className={`${styles.recordIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                          <FaPlus size={24} />
                        </div>
                        <div className={styles.recordContent}>
                          <h3 className={`${styles.recordTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Add Field</h3>
                          <p className={`${styles.recordDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Create a new field for this section</p>
                        </div>
                        <div className={`${styles.recordArrow} ${isDarkTheme ? styles.darkTheme : ""}`}>
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
                    {templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex].sections[currentSectionIndex].keys.map((key, index) => {
                      const header = templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex].headers.find((h) => h.key === key) || {
                        key,
                        name: key,
                        type: "text",
                      };
                      const headerIndex = templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex].headers.findIndex((h) => h.key === key);
                      const isProtected = header.key === "docId" || header.key === "typeOfRecord" || header.key === "typeOfObject" || header.key === "assignedTo";
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
                                  {templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex].sections[currentSectionIndex].keys.includes(
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
                                <div className={`${styles.recordArrow} ${isDarkTheme ? styles.darkTheme : ""}`}>
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
                      const headerIndex = templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex].headers.findIndex(
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
                                  {templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex].sections[currentSectionIndex].keys.includes(
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
                                <div className={`${styles.recordArrow} ${isDarkTheme ? styles.darkTheme : ""}`}>
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
                      disabled={templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex].sections[currentSectionIndex].name === "Record Data"}
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
              templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex]?.headers[activeHeaderIndex] && (
              <>
                <div className={styles.section}>
                  <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Field Configuration</h2>
                  <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Customize the field properties and settings.</p>
                  <div
                    className={`${styles.editActions} ${isDarkTheme ? styles.darkTheme : ""}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Prevent focus/edit for id, typeOfRecord, typeOfObject and assignedTo */}
                    <input
                      type="text"
                      value={newHeaderName}
                      onChange={(e) => setNewHeaderName(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Field Name"
                      className={`${styles.inputField} ${isDarkTheme ? styles.darkTheme : ""}`}
                      disabled={['docId', 'typeOfRecord', 'typeOfObject', 'assignedTo'].includes(templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex].headers[activeHeaderIndex].key)}
                      tabIndex={['docId', 'typeOfRecord', 'typeOfObject', 'assignedTo'].includes(templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex].headers[activeHeaderIndex].key) ? -1 : 0}
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
                          navigator.clipboard.writeText(templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex].headers[activeHeaderIndex].key);
                          setCopiedHeaderId(true);
                          setTimeout(() => setCopiedHeaderId(false), 1200);
                        }}
                        className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ""}`}
                        style={{ width: "100%", marginBottom: 12 }}
                      >
                        {copiedHeaderId ? "Copied!" : "Copy Header Key"}
                      </button>
                      {templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex].headers[activeHeaderIndex].key !== "docId" &&
                        templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex].headers[activeHeaderIndex].key !== "typeOfRecord" &&
                        templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex].headers[activeHeaderIndex].key !== "assignedTo" && (
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
                  <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Create a new field for your record template.</p>
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
                      {templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex].sections
                        .filter((section) => section.name !== "Record Data")
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

RecordsTemplate.propTypes = {
  tempData: PropTypes.shape({
    templateObjects: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string,
        templates: PropTypes.arrayOf(
          PropTypes.shape({
            name: PropTypes.string,
            typeOfRecord: PropTypes.string,
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
        pipelines: PropTypes.arrayOf(PropTypes.object),
        isModified: PropTypes.bool,
        action: PropTypes.oneOf(["add", "update", "remove", null]),
      })
    ),
    deletedHeaderKeys: PropTypes.arrayOf(PropTypes.string),
    hasObjectChanges: PropTypes.bool,
  }).isRequired,
  setTempData: PropTypes.func.isRequired,
  businessId: PropTypes.string,
};

export default RecordsTemplate;

// Reminder: In exportRecords and any other record export logic, ensure to use 'docId' instead of 'id' for the unique identifier.
// If you see any mapping like { id: doc.id, ...doc.data() }, change it to { docId: doc.id, ...doc.data() }