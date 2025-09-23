import { useState, useContext, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import PropTypes from "prop-types";
import styles from "./DataModels.module.css";
import { MainContext } from "../../Contexts/MainContext";
import { FaPlus, FaSearch, FaRegCircle, FaRegCheckCircle, FaDownload, FaTrash, FaDatabase, FaLayerGroup, FaEdit, FaCheck, FaTimes, FaArrowLeft, FaSave, FaFileAlt } from "react-icons/fa";
import { IoChevronForward, IoAdd, IoGitBranch, IoCreate, IoTrash } from "react-icons/io5";
import { BsDashCircle } from "react-icons/bs";
import { MdDragIndicator } from "react-icons/md";

import { v4 as uuidv4 } from "uuid";
import isEqual from "lodash/isEqual";
import { db } from '../../firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { updateRecordTemplatesAndRecordsFunction } from '../../Firebase/Firebase Functions/User Functions/updateRecordTemplatesAndRecordsFunction';

const DataModels = forwardRef(({ onSave, onBack }, ref) => {
  return <DataModelsInner onSave={onSave} onBack={onBack} ref={ref} />;
});

const DataModelsInner = forwardRef(({ onSave, onBack }, ref) => {
  const {
    isDarkTheme,
    businessId,
    templateObjects: contextTemplateObjects,
    setTemplateObjects: contextSetTemplateObjects
  } = useContext(MainContext);

  // Navigation state - replace modal steps with local views
  const [currentView, setCurrentView] = useState('objects'); // 'objects', 'templates', 'template-detail', 'section-detail', 'field-edit', 'field-create'
  const [viewHistory, setViewHistory] = useState(['objects']); // Track navigation history

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

  // Template management state
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplateIndex, setEditingTemplateIndex] = useState(null);
  const [editingTemplateName, setEditingTemplateName] = useState("");

  // Pipeline management state
  const [newPipelineName, setNewPipelineName] = useState("");
  const [pipelineSourceTemplate, setPipelineSourceTemplate] = useState("");
  const [pipelineTargetTemplate, setPipelineTargetTemplate] = useState("");
  const [pipelineFieldMappings, setPipelineFieldMappings] = useState([]);
  const [showPipelineForm, setShowPipelineForm] = useState(false);
  const [editingPipelineIndex, setEditingPipelineIndex] = useState(null);

  // Section editing state
  const [editingSectionIndex, setEditingSectionIndex] = useState(null);
  const [editingSectionName, setEditingSectionName] = useState("");
  const [newSectionName, setNewSectionName] = useState("");
  const [showSectionForm, setShowSectionForm] = useState(false);

  // Field creation state
  const [showFieldForm, setShowFieldForm] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const keyRefs = useRef(new Map());
  const sectionRefs = useRef(new Map());

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

  const lastTempDataRef = useRef({ deletedHeaderKeys, templateObjects });
  const initialStateRef = useRef(null); // Track initial state to detect changes

  // Update context when local state changes
  useEffect(() => {
    if (
      !isEqual(lastTempDataRef.current.deletedHeaderKeys, deletedHeaderKeys) ||
      !isEqual(lastTempDataRef.current.templateObjects, templateObjects)
    ) {
      contextSetTemplateObjects(templateObjects);
      lastTempDataRef.current = { deletedHeaderKeys, templateObjects };
    }
  }, [deletedHeaderKeys, templateObjects, contextSetTemplateObjects]);

  // Initialize initial state and detect changes - NO DEPENDENCIES to avoid resetting
  useEffect(() => {
    if (!initialStateRef.current) {
      // Store initial state when component mounts
      initialStateRef.current = {
        deletedHeaderKeys: [...deletedHeaderKeys],
        templateObjects: JSON.parse(JSON.stringify(templateObjects))
      };
    }
  }, []); // No dependencies - only set initial state once on mount

  // Function to detect if there are any changes from initial state (excluding updatedAt)
  const hasChanges = useCallback(() => {
    if (!initialStateRef.current) return false;

    // Check deletedHeaderKeys
    if (!isEqual(initialStateRef.current.deletedHeaderKeys, deletedHeaderKeys)) {
      return true;
    }

    // Check templateObjects but exclude updatedAt fields
    const cleanInitialObjects = JSON.parse(JSON.stringify(initialStateRef.current.templateObjects)).map(obj => ({
      ...obj,
      updatedAt: undefined,
      templates: obj.templates?.map(template => ({
        ...template,
        updatedAt: undefined,
        headers: template.headers?.map(header => ({
          ...header,
          updatedAt: undefined
        }))
      }))
    }));

    const cleanCurrentObjects = JSON.parse(JSON.stringify(templateObjects)).map(obj => ({
      ...obj,
      updatedAt: undefined,
      templates: obj.templates?.map(template => ({
        ...template,
        updatedAt: undefined,
        headers: template.headers?.map(header => ({
          ...header,
          updatedAt: undefined
        }))
      }))
    }));

    return !isEqual(cleanInitialObjects, cleanCurrentObjects);
  }, [deletedHeaderKeys, templateObjects]);

  // Sync local templateObjects with context on initial load
  useEffect(() => {
    if (contextTemplateObjects && contextTemplateObjects.length > 0 && templateObjects.length === 0) {
      setTemplateObjects(contextTemplateObjects);
      
      // Update initial state when templateObjects are first loaded from context
      if (!initialStateRef.current) {
        initialStateRef.current = {
          deletedHeaderKeys: [...deletedHeaderKeys],
          templateObjects: JSON.parse(JSON.stringify(contextTemplateObjects))
        };
      }
    }
  }, [contextTemplateObjects, templateObjects.length, setTemplateObjects, deletedHeaderKeys]);

  // Track unsaved changes
  useEffect(() => {
    const changes = hasChanges();
    setHasUnsavedChanges(changes);
  }, [hasChanges]);

  // Navigation functions
  const navigateToView = useCallback((view, params = {}) => {
    setCurrentView(view);
    setViewHistory(prev => [...prev, view]);

    // Set relevant state based on view
    if (params.selectedObjectIndex !== undefined) setSelectedObjectIndex(params.selectedObjectIndex);
    if (params.selectedTemplateIndex !== undefined) setSelectedTemplateIndex(params.selectedTemplateIndex);
    if (params.currentSectionIndex !== undefined) setCurrentSectionIndex(params.currentSectionIndex);
    if (params.activeHeaderIndex !== undefined) setActiveHeaderIndex(params.activeHeaderIndex);
    if (params.editMode !== undefined) setEditMode(params.editMode);
  }, []);

  const selectObject = useCallback((objectIndex) => {
    navigateToView('templates', { selectedObjectIndex: objectIndex });
  }, [navigateToView]);

  const selectTemplate = useCallback((templateIndex) => {
    navigateToView('template-detail', { selectedTemplateIndex: templateIndex });
  }, [navigateToView]);

  const goBack = useCallback(() => {
    if (viewHistory.length > 1) {
      const newHistory = [...viewHistory];
      newHistory.pop();
      const previousView = newHistory[newHistory.length - 1];
      setViewHistory(newHistory);
      setCurrentView(previousView);

      // Reset state based on view
      if (previousView === 'objects') {
        setSelectedObjectIndex(null);
        setSelectedTemplateIndex(null);
        setCurrentSectionIndex(null);
        setActiveHeaderIndex(null);
        setEditMode(false);
      } else if (previousView === 'templates') {
        setSelectedTemplateIndex(null);
        setCurrentSectionIndex(null);
        setActiveHeaderIndex(null);
        setEditMode(false);
      } else if (previousView === 'template-detail') {
        setCurrentSectionIndex(null);
        setActiveHeaderIndex(null);
      } else if (previousView === 'section-detail') {
        setActiveHeaderIndex(null);
      }
    }
  }, [viewHistory]);

  // Breadcrumb navigation component
  const renderBreadcrumbs = () => {
    const breadcrumbs = [];

    // Always show Data Models as the root
    breadcrumbs.push({
      label: 'Data Models',
      type: '',
      level: 0,
      onClick: () => navigateToView('objects')
    });

    // Add category/object if we're in templates view or deeper
    if (currentView !== 'objects' && selectedObjectIndex !== null && templateObjects[selectedObjectIndex]) {
      breadcrumbs.push({
        label: templateObjects[selectedObjectIndex].name,
        type: 'Object',
        level: 1,
        onClick: () => navigateToView('templates', { selectedObjectIndex })
      });
    }

    // Add template if we're in template-detail view or deeper
    if ((currentView === 'template-detail' || currentView === 'section-detail' || currentView === 'field-edit' || currentView === 'field-create') &&
        selectedTemplateIndex !== null && templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex]) {
      breadcrumbs.push({
        label: templateObjects[selectedObjectIndex].templates[selectedTemplateIndex].name,
        type: 'Record',
        level: 2,
        onClick: () => navigateToView('template-detail', { selectedTemplateIndex, editMode: false })
      });
    }

    // Add section if we're in section-detail view or field views
    if ((currentView === 'section-detail' || currentView === 'field-edit' || currentView === 'field-create') &&
        currentSectionIndex !== null && templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex]?.sections[currentSectionIndex]) {
      breadcrumbs.push({
        label: templateObjects[selectedObjectIndex].templates[selectedTemplateIndex].sections[currentSectionIndex].name,
        type: 'Section',
        level: 3,
        onClick: () => navigateToView('section-detail', { currentSectionIndex })
      });
    }

    // Add field if we're in field-edit view
    if (currentView === 'field-edit' && activeHeaderIndex !== null &&
        templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex]?.headers[activeHeaderIndex]) {
      breadcrumbs.push({
        label: templateObjects[selectedObjectIndex].templates[selectedTemplateIndex].headers[activeHeaderIndex].name,
        type: 'Field',
        level: 4,
        onClick: () => navigateToView('field-edit', { activeHeaderIndex })
      });
    }

    if (breadcrumbs.length <= 1) return null; // Don't show breadcrumbs if we're only at the root level

    return (
      <div className={`${styles.breadcrumbs} ${isDarkTheme ? styles.darkTheme : ''}`}>
        {breadcrumbs.map((crumb, index) => (
          <div key={index} className={styles.breadcrumbItem}>
            {index > 0 && (
              <svg
                className={styles.breadcrumbChevron}
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4.5 9L7.5 6L4.5 3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            <button
              onClick={crumb.onClick}
              className={`${styles.breadcrumbButton} ${isDarkTheme ? styles.darkTheme : ''}`}
              disabled={index === breadcrumbs.length - 1} // Disable the current page
            >
              <div className={styles.breadcrumbLabel}>
                {crumb.label}
              </div>
              {crumb.type && (
                <div className={`${styles.breadcrumbType} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  {crumb.type}
                </div>
              )}
            </button>
          </div>
        ))}
      </div>
    );
  };

  // Save changes to backend using exact same pattern as RecordsTemplate/ModalUtils
  const saveChanges = useCallback(async () => {
    if (!businessId) {
      console.warn('Cannot update templates and records: businessId is missing');
      alert('Error: Business ID is missing. Please ensure your account is properly configured.');
      return false;
    }

    try {
      // Prepare objects with their templates - exact same pattern as ModalUtils
      const objectsWithTemplates = templateObjects.map(object => {
        // Use the templates from the object (they already reflect the user's changes)
        const objectTemplates = (object.templates || []).filter(template => 
          template.action !== "remove"
        ).map(template => {
          const { isModified, action, ...cleanTemplate } = template;
          return cleanTemplate;
        });
        
        // Include action and isModified flags so backend knows what to do
        return {
          id: object.id,
          name: object.name,
          templates: objectTemplates,
          pipelines: object.pipelines || [],
          action: object.action,
          isModified: object.isModified
        };
      });

      // Check if there are any actual changes - exact same logic as ModalUtils
      const hasObjectChanges = templateObjects.some(object => 
        object.isModified || object.action === 'add' || object.action === 'update' || object.action === 'remove'
      );
      
      const hasTemplateChanges = templateObjects.some(object =>
        object.templates?.some(template => 
          template.isModified || template.action === 'add' || template.action === 'remove'
        )
      );
      
      const hasActualChanges = hasTemplateChanges || hasObjectChanges || (deletedHeaderKeys?.length > 0);

      if (!hasActualChanges) {
        console.log('No changes detected, skipping save');
        return true;
      }

      // Use the same backend function as RecordsTemplate
      const result = await updateRecordTemplatesAndRecordsFunction({
        businessId,
        objects: objectsWithTemplates,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to update template objects');
      }

      // Update templateObjects in context to ensure immediate UI update
      // Filter out objects marked for deletion since they will be deleted from Firestore
      const objectsForContext = objectsWithTemplates.filter(object => object.action !== "remove");
      
      // Update context
      contextSetTemplateObjects(objectsForContext);

      // Update local state to match saved state 
      setTemplateObjects(objectsForContext);
      setDeletedHeaderKeys([]);

      // Reset initial state to current saved state
      initialStateRef.current = {
        deletedHeaderKeys: [],
        templateObjects: JSON.parse(JSON.stringify(objectsForContext))
      };

      console.log('Data models saved successfully to backend');

      if (onSave) {
        onSave();
      }

      return true;
    } catch (error) {
      console.error('Error saving data models:', error);
      alert('Failed to save data models. Please try again.');
      return false;
    }
  }, [businessId, templateObjects, deletedHeaderKeys, contextSetTemplateObjects, onSave]);

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
        setDeletedHeaderKeys((prev) => [...new Set([...prev, header.key])]);
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
        setDeletedHeaderKeys((prev) => [...new Set([...prev, ...section.keys])]);
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
    setShowFieldForm(false);
  }, [
    newHeaderName,
    newHeaderType,
    newHeaderSection,
    newHeaderOptions,
    selectedObjectIndex,
    selectedTemplateIndex,
    templateObjects,
    validateHeader,
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

      if (currentHeader.type !== newHeaderType) {
        alert("You cannot change the type of a field after it has been created.");
        return;
      }

      setTemplateObjects((prev) => {
        const newObjects = [...prev];
        const currentObject = { ...newObjects[selectedObjectIndex] };
        const currentTemplate = { ...currentObject.templates[selectedTemplateIndex] };
        const headers = [...currentTemplate.headers];
        const sections = currentTemplate.sections.map((s) => ({ ...s, keys: [...s.keys] }));
        headers[index] = {
          ...headers[index],
          name: newHeaderName.trim(),
          section: newHeaderSection,
          ...(newHeaderType === "dropdown" || newHeaderType === "multi-select" ? { options: [...newHeaderOptions] } : {}),
        };

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
      goBack();
    },
    [newHeaderName, newHeaderType, newHeaderSection, newHeaderOptions, selectedObjectIndex, selectedTemplateIndex, templateObjects, validateHeader, goBack]
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
      
      // Mark the object as modified since we're adding a template
      currentObject.isModified = true;
      currentObject.action = currentObject.action || "update";
      
      newObjects[selectedObjectIndex] = currentObject;
      return newObjects;
    });
    
    // Close the inline form and reset
    setShowTemplateForm(false);
    setNewTemplateName("");
  }, [newTemplateName, getAllTemplates, selectedObjectIndex, templateObjects]);

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

  // Section editing functions
  const startEditingSection = useCallback((sectionIndex) => {
    if (selectedObjectIndex === null || selectedTemplateIndex === null) return;
    const object = templateObjects[selectedObjectIndex];
    const template = object.templates[selectedTemplateIndex];
    const section = template.sections[sectionIndex];
    
    if (section.name === "Record Data") {
      alert("The 'Record Data' section cannot be renamed as it contains core system fields.");
      return;
    }
    
    setEditingSectionIndex(sectionIndex);
    setEditingSectionName(section.name);
  }, [selectedObjectIndex, selectedTemplateIndex, templateObjects]);

  const cancelEditingSection = useCallback(() => {
    setEditingSectionIndex(null);
    setEditingSectionName("");
  }, []);

  const saveEditingSection = useCallback(() => {
    if (editingSectionIndex !== null && editingSectionName.trim()) {
      updateSectionName(editingSectionIndex, editingSectionName.trim());
      setEditingSectionIndex(null);
      setEditingSectionName("");
    }
  }, [editingSectionIndex, editingSectionName, updateSectionName]);

  // Add new section with custom name
  const addSectionWithName = useCallback(() => {
    if (!newSectionName.trim()) {
      alert("Please enter a section name.");
      return;
    }
    
    if (selectedObjectIndex === null || selectedTemplateIndex === null) return;
    
    setTemplateObjects((prev) => {
      const newObjects = [...prev];
      const currentObject = { ...newObjects[selectedObjectIndex] };
      const currentTemplate = { ...currentObject.templates[selectedTemplateIndex] };
      
      if (currentTemplate.sections.some((s) => s.name.toLowerCase() === newSectionName.trim().toLowerCase())) {
        alert(`Section name "${newSectionName.trim()}" already exists. Please use a unique name.`);
        return prev;
      }
      
      currentTemplate.sections = [...currentTemplate.sections, { name: newSectionName.trim(), keys: [] }];
      currentObject.templates[selectedTemplateIndex] = {
        ...currentTemplate,
        isModified: true,
        action: currentTemplate.action || "update",
      };
      newObjects[selectedObjectIndex] = currentObject;
      return newObjects;
    });
    
    setNewSectionName("");
  }, [selectedObjectIndex, selectedTemplateIndex, templateObjects, newSectionName]);

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
    (e, sectionIndex, targetIndex) => {
      e.preventDefault();
      if (draggedIndex === null || draggedSectionIndex !== sectionIndex || draggedIndex === targetIndex || selectedObjectIndex === null || selectedTemplateIndex === null) return;

      setTemplateObjects((prev) => {
        const newObjects = [...prev];
        const currentObject = { ...newObjects[selectedObjectIndex] };
        const currentTemplate = { ...currentObject.templates[selectedTemplateIndex] };
        const newSections = [...currentTemplate.sections];
        const sectionKeys = [...newSections[sectionIndex].keys];
        const [draggedItem] = sectionKeys.splice(draggedIndex, 1);
        sectionKeys.splice(targetIndex, 0, draggedItem);
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
      setTimeout(() => setDraggedIndex(targetIndex), 0);
    },
    [draggedIndex, draggedSectionIndex, selectedObjectIndex, selectedTemplateIndex]
  );

  const handleTouchMove = useCallback(
    (e, sectionIndex) => {
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

  const handleSectionTouchMove = useCallback((e) => {
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
          navigateToView('template-detail', { selectedTemplateIndex: templateIndex, editMode: false });
          return;
        }
      }

      navigateToView('template-detail', { selectedTemplateIndex: null, editMode: false });
    },
    [selectedObjectIndex, templateObjects, navigateToView]
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
      pipelines: [],
      isModified: true,
      action: "add"
    };

    const updatedObjects = [...templateObjects, newObject];
    setTemplateObjects(updatedObjects);
    setNewObjectName("");
    setShowObjectForm(false);
  }, [newObjectName, templateObjects]);

  const deleteObject = useCallback(async (objectIndex) => {
    const object = templateObjects[objectIndex];

    const localTemplates = getAllTemplates().filter(template =>
      template.objectId === object.id && template.action !== "remove"
    );
    const objectTemplatesFromBackend = object.templates || [];

    const allTemplateIds = new Set([
      ...localTemplates.map(t => t.docId),
      ...objectTemplatesFromBackend.map(t => t.docId)
    ]);

    if (allTemplateIds.size > 0) {
      alert(`Cannot delete object "${object.name}" because it contains ${allTemplateIds.size} template(s). Please delete all templates first.`);
      return;
    }
    if (window.confirm(`Are you sure you want to delete the object "${object.name}"? This action cannot be undone.`)) {
      const updatedObjects = templateObjects.map((e, index) =>
        index === objectIndex
          ? { ...e, isModified: true, action: "remove" }
          : e
      );
      setTemplateObjects(updatedObjects);

      if (selectedObjectIndex === objectIndex) {
        setSelectedObjectIndex(null);
      }
    }
  }, [templateObjects, selectedObjectIndex, getAllTemplates]);

  const updateObjectName = useCallback(async (objectIndex, newName) => {
    if (!newName.trim()) return;
    if (templateObjects.some((object, index) => index !== objectIndex && object.name.toLowerCase() === newName.trim().toLowerCase())) {
      alert("A object with this name already exists. Please choose a unique name.");
      return;
    }

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
  }, [templateObjects]);

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

    const updatedObjects = templateObjects.map((object, index) =>
      index === selectedObjectIndex
        ? { ...object, pipelines: [...(object.pipelines || []), newPipeline] }
        : object
    );

    setTemplateObjects(updatedObjects);
    setNewPipelineName("");
    setPipelineSourceTemplate("");
    setPipelineTargetTemplate("");
    setPipelineFieldMappings([]);
    setShowPipelineForm(false);
  }, [selectedObjectIndex, newPipelineName, pipelineSourceTemplate, pipelineTargetTemplate, pipelineFieldMappings, templateObjects]);

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
      navigateToView('section-detail', { currentSectionIndex: index });
    },
    [navigateToView]
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
        
        // Mark the parent object as modified since we're removing a template
        currentObject.isModified = true;
        currentObject.action = currentObject.action || "update";
        
        newObjects[selectedObjectIndex] = currentObject;
        return newObjects;
      });
      goBack();
    }
  }, [selectedObjectIndex, selectedTemplateIndex, templateObjects, goBack]);

  // Edit header
  const handleEditHeader = useCallback(
    (index) => {
      const header = templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex]?.headers[index];
      if (header) {
        setNewHeaderName(header.name);
        setNewHeaderType(header.type);
        setNewHeaderSection(header.section);
        setNewHeaderOptions(header.options || []);
      }
      navigateToView('field-edit', { activeHeaderIndex: index });
    },
    [selectedObjectIndex, selectedTemplateIndex, templateObjects, navigateToView]
  );

  // Reset header form
  const resetHeaderForm = useCallback(() => {
    setNewHeaderName("");
    setNewHeaderType("text");
    setNewHeaderSection("");
    setNewHeaderOptions([]);
    setNewOption("");
    setDeletedHeaderKeys([]);
    setCopiedHeaderId(false);
  }, []);

  // Create new header
  const handleCreateHeader = useCallback(() => {
    if (selectedObjectIndex === null || selectedTemplateIndex === null || currentSectionIndex === null) return;
    resetHeaderForm();
    const object = templateObjects[selectedObjectIndex];
    const template = object.templates[selectedTemplateIndex];
    const currentSectionName = template.sections[currentSectionIndex].name;
    setNewHeaderSection(currentSectionName !== "Record Data" ? currentSectionName : "Primary Section");
    setShowFieldForm(true);
  }, [templateObjects, selectedObjectIndex, selectedTemplateIndex, currentSectionIndex]);

  // Export records for the current template
  const exportRecords = useCallback(async () => {
    if (selectedObjectIndex === null) {
      alert('No object selected.');
      return;
    }

    const object = templateObjects[selectedObjectIndex];
    const templates = object.templates || [];

    if (templates.length === 0) {
      alert('No templates found in this object.');
      return;
    }

    if (!businessId) {
      alert('Missing business ID.');
      return;
    }

    try {
      const recordsRef = collection(db, 'businesses', businessId, 'records');
      const objectName = object.name;

      // Get all records for this object
      const q = query(recordsRef, where('typeOfObject', '==', objectName));
      const snapshot = await getDocs(q);
      const rawRecords = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));

      if (!rawRecords.length) {
        alert('No records found for this object.');
        return;
      }

      // Create a comprehensive CSV with all fields from all templates
      const allHeaders = new Map();

      // Collect all unique headers from all templates
      templates.forEach(template => {
        template.headers?.forEach(header => {
          if (header.isUsed && !allHeaders.has(header.key)) {
            allHeaders.set(header.key, {
              key: header.key,
              name: header.name,
              type: header.type,
              template: template.name
            });
          }
        });
      });

      const headersArray = Array.from(allHeaders.values());

      const csvHeaders = [];
      const dataMapping = [];

      headersArray.forEach(header => {
        const { key, name, type } = header;
        if (type === 'date') {
          csvHeaders.push(name);
          dataMapping.push({ key, type, hasTime: false });
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
              const dateStr = date.toISOString().split('T')[0];
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
              const dateStr = value.toISOString().split('T')[0];
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
            row.push(String(value));
          }
        });
        return row;
      });

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row =>
          row.map(cell => {
            if (cell.includes(',') || cell.includes('"') || cell.includes('\n') || cell.includes('\r')) {
              return `"${cell.replace(/"/g, '""')}"`;
            }
            return cell;
          }).join(',')
        )
      ].join('\r\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${objectName}_all_records_export.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export records.');
    }
  }, [selectedObjectIndex, templateObjects, businessId]);

  // Render functions for different views
  const renderObjectsView = () => (
    <div className={`${styles.container} ${isDarkTheme ? styles.darkTheme : ""}`}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <button
            onClick={onBack}
            className={`${styles.backButton} ${styles.headerBackButton} ${isDarkTheme ? styles.darkTheme : ""}`}
            aria-label="Back to Settings"
          >
            <FaArrowLeft size={16} />
            <span>Back</span>
          </button>
          {hasChanges() && (
            <button
              onClick={saveChanges}
              className={`${styles.saveChangesButton} ${isDarkTheme ? styles.darkTheme : ""}`}
            >
              <FaSave size={14} />
              <span>Save Changes</span>
            </button>
          )}
        </div>
        <div className={styles.headerBreadcrumbs}>
          {renderBreadcrumbs()}
        </div>
        <div className={styles.headerMain}>
          <h1 className={`${styles.title} ${styles.headerTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Data Models</h1>
        </div>
        <div className={styles.headerContent}>
          <p className={`${styles.subtitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Manage your record templates and data structures</p>
        </div>
      </div>

      <div className={`${styles.section} ${styles.unifiedSection} ${isDarkTheme ? styles.darkTheme : ""}`}>
        <div className={`${styles.unifiedGrid} ${showObjectForm ? styles.expandedFormActive : ""} ${isDarkTheme ? styles.darkTheme : ""}`}>
          {/* New Category Card / Form */}
          {showObjectForm ? (
            <div className={`${styles.configRecord} ${styles.expandedCategoryForm} ${isDarkTheme ? styles.darkTheme : ""}`}>
              <div className={styles.expandedFormHeader}>
                <div className={`${styles.recordIcon} ${styles.newCategoryIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                  <FaPlus size={22} />
                </div>
                <div className={styles.expandedFormContent}>
                  <h3 className={`${styles.expandedFormTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Create New Category</h3>
                  <p className={`${styles.expandedFormSubtitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Add a new category to organize your templates</p>
                </div>
                <button
                  onClick={() => {
                    setShowObjectForm(false);
                    setNewObjectName("");
                  }}
                  className={`${styles.closeExpandedForm} ${isDarkTheme ? styles.darkTheme : ""}`}
                  aria-label="Cancel"
                >
                  <FaTimes size={16} />
                </button>
              </div>

              <div className={styles.expandedFormBody}>
                <div className={styles.inputGroup}>
                  <label className={`${styles.fieldLabel} ${isDarkTheme ? styles.darkTheme : ""}`}>Category Name</label>
                  <input
                    type="text"
                    value={newObjectName}
                    onChange={(e) => setNewObjectName(e.target.value)}
                    placeholder="Enter category name..."
                    className={`${styles.expandedInput} ${isDarkTheme ? styles.darkTheme : ""}`}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newObjectName.trim()) {
                        createNewObject();
                      } else if (e.key === 'Escape') {
                        setShowObjectForm(false);
                        setNewObjectName("");
                      }
                    }}
                  />
                </div>

                <div className={styles.expandedFormActions}>
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
                    <FaPlus size={14} />
                    <span>Create</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setShowObjectForm(true)}
              className={`${styles.configRecord} ${styles.newCategoryCard} ${isDarkTheme ? styles.darkTheme : ""}`}
              role="button"
              aria-label="Add New Category"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setShowObjectForm(true);
                }
              }}
            >
              <div className={`${styles.recordIcon} ${styles.newCategoryIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                <FaPlus size={22} />
              </div>
              <div className={styles.recordContent}>
                <h3 className={`${styles.recordTitle} ${styles.newCategoryTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>New Category</h3>
                <p className={`${styles.recordDescription} ${styles.newCategoryDesc} ${isDarkTheme ? styles.darkTheme : ""}`}>Create a new category</p>
              </div>
            </div>
          )}

          {/* Existing Categories */}
          {templateObjects
            .map((object, originalIndex) => ({ object, originalIndex }))
            .filter(({ object }) => object.action !== "remove")
            .map(({ object, originalIndex }) => (
            <div
              key={object.id}
              className={`${styles.configRecord} ${styles.categoryCard} ${isDarkTheme ? styles.darkTheme : ""}`}
              role="button"
              aria-label={`Open ${object.name}`}
              tabIndex={0}
            >
              <div className={`${styles.recordIcon} ${styles.categoryIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                <FaLayerGroup size={22} />
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
                    <h3 className={`${styles.recordTitle} ${styles.categoryTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>{object.name}</h3>
                    <p className={`${styles.recordDescription} ${styles.categoryDesc} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      {getObjectTemplates(originalIndex).length} template{getObjectTemplates(originalIndex).length !== 1 ? 's' : ''}
                    </p>
                  </>
                )}
              </div>
              {editingObjectIndex !== originalIndex && (
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
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTemplatesView = () => {
    if (selectedObjectIndex === null || !templateObjects[selectedObjectIndex] || templateObjects[selectedObjectIndex].action === "remove") {
      return (
        <div className={`${styles.container} ${isDarkTheme ? styles.darkTheme : ""}`}>
          <div className={styles.header}>
            <div className={styles.headerTop}>
              <button onClick={goBack} className={`${styles.backButton} ${styles.headerBackButton} ${isDarkTheme ? styles.darkTheme : ""}`}>
                <FaArrowLeft size={16} />
                Back to Objects
              </button>
            </div>
            <div className={styles.headerMain}>
              <h1 className={styles.title}>No Object Selected</h1>
              <p className={styles.subtitle}>Please select a object first to manage templates.</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`${styles.container} ${isDarkTheme ? styles.darkTheme : ""}`}>
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <button
              onClick={goBack}
              className={`${styles.backButton} ${styles.headerBackButton} ${isDarkTheme ? styles.darkTheme : ""}`}
              aria-label="Back to Objects"
            >
              <FaArrowLeft size={16} />
              <span>Back</span>
            </button>
            {hasChanges() && (
              <button
                onClick={saveChanges}
                className={`${styles.saveChangesButton} ${isDarkTheme ? styles.darkTheme : ""}`}
              >
                <FaSave size={14} />
                <span>Save Changes</span>
              </button>
            )}
          </div>
          <div className={styles.headerBreadcrumbs}>
            {renderBreadcrumbs()}
          </div>
          <div className={styles.headerMain}>
            <h1 className={`${styles.title} ${styles.headerTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>{templateObjects[selectedObjectIndex].name}</h1>
          </div>
          <div className={styles.headerContent}>
            <p className={`${styles.subtitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Manage record templates in this object</p>
          </div>
        </div>

        <div className={`${styles.section} ${styles.unifiedSection} ${isDarkTheme ? styles.darkTheme : ""}`}>
          <div className={`${styles.unifiedGrid} ${showTemplateForm ? styles.expandedFormActive : ""} ${isDarkTheme ? styles.darkTheme : ""}`}>
            {/* New Template Card / Form */}
            {showTemplateForm ? (
              <div className={`${styles.configRecord} ${styles.expandedCategoryForm} ${isDarkTheme ? styles.darkTheme : ""}`}>
                <div className={styles.expandedFormHeader}>
                  <div className={`${styles.recordIcon} ${styles.newCategoryIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                    <FaPlus size={22} />
                  </div>
                  <div className={styles.expandedFormContent}>
                    <h3 className={`${styles.expandedFormTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Create New Record Template</h3>
                    <p className={`${styles.expandedFormSubtitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Add a new template to organize your records</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowTemplateForm(false);
                      setNewTemplateName("");
                    }}
                    className={`${styles.closeExpandedForm} ${isDarkTheme ? styles.darkTheme : ""}`}
                    aria-label="Cancel"
                  >
                    <FaTimes size={16} />
                  </button>
                </div>

                <div className={styles.expandedFormBody}>
                  <div className={styles.inputGroup}>
                    <label className={`${styles.fieldLabel} ${isDarkTheme ? styles.darkTheme : ""}`}>Template Name</label>
                    <input
                      type="text"
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      placeholder="Enter template name..."
                      className={`${styles.expandedInput} ${isDarkTheme ? styles.darkTheme : ""}`}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newTemplateName.trim()) {
                          confirmNewTemplate();
                        } else if (e.key === 'Escape') {
                          setShowTemplateForm(false);
                          setNewTemplateName("");
                        }
                      }}
                    />
                  </div>

                  <div className={styles.expandedFormActions}>
                    <button
                      onClick={() => {
                        setShowTemplateForm(false);
                        setNewTemplateName("");
                      }}
                      className={`${styles.secondaryButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmNewTemplate}
                      className={`${styles.primaryButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                      disabled={!newTemplateName.trim()}
                    >
                      <FaPlus size={14} />
                      <span>Create</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setShowTemplateForm(true)}
                className={`${styles.configRecord} ${styles.newCategoryCard} ${isDarkTheme ? styles.darkTheme : ""}`}
                role="button"
                aria-label="Add New Record Template"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setShowTemplateForm(true);
                  }
                }}
              >
                <div className={`${styles.recordIcon} ${styles.newCategoryIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                  <FaPlus size={22} />
                </div>
                <div className={styles.recordContent}>
                  <h3 className={`${styles.recordTitle} ${styles.newCategoryTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>New Record Template</h3>
                  <p className={`${styles.recordDescription} ${styles.newCategoryDesc} ${isDarkTheme ? styles.darkTheme : ""}`}>Create a custom template for your records</p>
                </div>
              </div>
            )}

            {/* Existing Templates */}
            {getObjectTemplates(selectedObjectIndex).map((template, index) => (
              <div
                key={template.name || `template-${index}`}
                onClick={() => selectTemplate(index)}
                className={`${styles.configRecord} ${styles.categoryCard} ${isDarkTheme ? styles.darkTheme : ""}`}
                role="button"
                aria-label={`Edit ${template.name || "Unnamed Template"}`}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    selectTemplate(index);
                  }
                }}
              >
                <div className={`${styles.recordIcon} ${styles.categoryIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                  <FaFileAlt size={22} />
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

        {/* Pipelines Section */}
        <div className={`${styles.section} ${styles.unifiedSection} ${isDarkTheme ? styles.darkTheme : ""}`}>
          <div className={`${styles.unifiedGrid} ${showPipelineForm ? styles.expandedFormActive : ""} ${isDarkTheme ? styles.darkTheme : ""}`}>
            {/* Create Pipeline Card / Expanded Form */}
            {showPipelineForm ? (
              <div className={`${styles.configRecord} ${styles.expandedCategoryForm} ${isDarkTheme ? styles.darkTheme : ""}`}>
                <div className={styles.expandedFormHeader}>
                  <div className={`${styles.recordIcon} ${styles.newCategoryIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                    <IoGitBranch size={22} />
                  </div>
                  <div className={styles.expandedFormTitle}>
                    <h3 className={`${styles.expandedFormTitleText} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      {editingPipelineIndex !== null ? 'Edit Pipeline' : 'Create New Pipeline'}
                    </h3>
                    <p className={`${styles.expandedFormSubtitle} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      Set up automatic record movement between templates
                    </p>
                  </div>
                </div>

                <div className={styles.expandedFormBody}>
                  <div className={styles.inputGroup}>
                    <label className={`${styles.fieldLabel} ${isDarkTheme ? styles.darkTheme : ""}`}>Pipeline Name</label>
                    <input
                      type="text"
                      value={newPipelineName}
                      onChange={(e) => setNewPipelineName(e.target.value)}
                      placeholder="Enter pipeline name..."
                      className={`${styles.expandedInput} ${isDarkTheme ? styles.darkTheme : ""}`}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newPipelineName.trim()) {
                          editingPipelineIndex !== null ? updateObjectPipeline() : addObjectPipeline();
                        } else if (e.key === 'Escape') {
                          cancelPipelineForm();
                        }
                      }}
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label className={`${styles.fieldLabel} ${isDarkTheme ? styles.darkTheme : ""}`}>Source Template</label>
                    <select
                      value={pipelineSourceTemplate}
                      onChange={(e) => setPipelineSourceTemplate(e.target.value)}
                      className={`${styles.expandedSelect} ${isDarkTheme ? styles.darkTheme : ""}`}
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
                      className={`${styles.expandedSelect} ${isDarkTheme ? styles.darkTheme : ""}`}
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
                              className={`${styles.expandedSelect} ${styles.mappingSelect} ${isDarkTheme ? styles.darkTheme : ""}`}
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
                              className={`${styles.expandedSelect} ${styles.mappingSelect} ${isDarkTheme ? styles.darkTheme : ""}`}
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
                              className={`${styles.removeMappingButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                            >
                              <IoTrash size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className={styles.expandedFormActions}>
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
              </div>
            ) : (
              <div
                onClick={() => setShowPipelineForm(true)}
                className={`${styles.configRecord} ${styles.newCategoryCard} ${isDarkTheme ? styles.darkTheme : ""}`}
                role="button"
                aria-label="Create new pipeline"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setShowPipelineForm(true);
                  }
                }}
              >
                <div className={`${styles.recordIcon} ${styles.newCategoryIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                  <IoGitBranch size={22} />
                </div>
                <div className={styles.recordContent}>
                  <h3 className={`${styles.recordTitle} ${styles.newCategoryTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Create Pipeline</h3>
                  <p className={`${styles.recordDescription} ${styles.newCategoryDesc} ${isDarkTheme ? styles.darkTheme : ""}`}>Set up automatic record movement between templates</p>
                </div>
              </div>
            )}

            {/* Existing Pipelines */}
            {getObjectPipelines(selectedObjectIndex).map((pipeline, index) => {
              const sourceTemplate = getObjectTemplates(selectedObjectIndex).find(t => t.docId === pipeline.sourceTemplateId);
              const targetTemplate = getObjectTemplates(selectedObjectIndex).find(t => t.docId === pipeline.targetTemplateId);
              return (
                <div
                  key={pipeline.id}
                  onClick={() => editObjectPipeline(index)}
                  className={`${styles.configRecord} ${styles.categoryCard} ${isDarkTheme ? styles.darkTheme : ""}`}
                  role="button"
                  aria-label={`Edit ${pipeline.name}`}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      editObjectPipeline(index);
                    }
                  }}
                >
                  <div className={`${styles.recordIcon} ${styles.categoryIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                    <IoGitBranch size={22} />
                  </div>
                  <div className={styles.recordContent}>
                    <h3 className={`${styles.recordTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>{pipeline.name}</h3>
                    <p className={`${styles.recordDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      {sourceTemplate?.name || 'Unknown'} → {targetTemplate?.name || 'Unknown'}
                    </p>
                    <div className={`${styles.recordBadge} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      {pipeline.fieldMappings?.length || 0} mappings
                    </div>
                  </div>
                  <div className={`${styles.recordArrow} ${isDarkTheme ? styles.darkTheme : ""}`}>
                    <IoChevronForward size={16} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.section}>
          <button
            onClick={exportRecords}
            className={`${styles.exportRecordsButton} ${isDarkTheme ? styles.darkTheme : ""}`}
          >
            <FaDownload size={16} />
            <span>Export Records</span>
          </button>
        </div>

      </div>
    );
  };

  const renderTemplateDetailView = () => {
    if (selectedTemplateIndex === null || !templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex]) {
      return (
        <div className={`${styles.container} ${isDarkTheme ? styles.darkTheme : ""}`}>
          <div className={styles.header}>
            <button onClick={goBack} className={`${styles.backButton} ${isDarkTheme ? styles.darkTheme : ""}`}>
              <FaArrowLeft size={16} />
              Back
            </button>
            <h1 className={styles.title}>Create New Record Template</h1>
            <p className={styles.subtitle}>Start building your record template structure.</p>
          </div>
          <div className={styles.section}>
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
        </div>
      );
    }

    const template = templateObjects[selectedObjectIndex].templates[selectedTemplateIndex];

    return (
      <div className={`${styles.container} ${isDarkTheme ? styles.darkTheme : ""}`}>
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <div className={styles.headerTopLeft}>
              <button onClick={goBack} className={`${styles.backButton} ${styles.headerBackButton} ${isDarkTheme ? styles.darkTheme : ""}`}>
                <FaArrowLeft size={16} />
                <span>Back</span>
              </button>
              {hasChanges() && (
                <button
                  onClick={saveChanges}
                  className={`${styles.saveChangesButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                >
                  <FaSave size={14} />
                  <span>Save Changes</span>
                </button>
              )}
            </div>
            <div className={styles.headerTopRight}>
              {!editMode && (
                <button
                  onClick={() => setEditMode(true)}
                  className={`${styles.editTemplateButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                >
                  <FaEdit size={16} />
                  <span>Edit</span>
                </button>
              )}
              {editMode && (
                <button
                  onClick={() => setEditMode(false)}
                  className={`${styles.doneButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                >
                  Done Editing
                </button>
              )}
            </div>
          </div>
          <div className={styles.headerBreadcrumbs}>
            {renderBreadcrumbs()}
          </div>
          <div className={styles.headerMain}>
            {editMode ? (
              <input
                type="text"
                value={template.name || ""}
                onChange={(e) => updateTemplateName(e.target.value)}
                placeholder="Record Template Name"
                className={`${styles.editableTitle} ${isDarkTheme ? styles.darkTheme : ""}`}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setEditMode(false);
                  } else if (e.key === 'Escape') {
                    setEditMode(false);
                  }
                }}
              />
            ) : (
              <h1 className={`${styles.title} ${styles.headerTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>{template.name}</h1>
            )}
          </div>
          <div className={styles.headerContent}>
            <p className={`${styles.subtitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Configure your record template name and structure.</p>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}> Sections</h2>
          <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Sections organize your fields into logical groups within the template.</p>

          <div className={`${styles.unifiedGrid} ${showSectionForm ? styles.expandedFormActive : ""} ${isDarkTheme ? styles.darkTheme : ""}`}>
            {/* Create Section Card / Expanded Form */}
            {showSectionForm ? (
              <div className={`${styles.configRecord} ${styles.expandedCategoryForm} ${isDarkTheme ? styles.darkTheme : ""}`}>
                <div className={styles.expandedFormHeader}>
                  <div className={`${styles.recordIcon} ${styles.newCategoryIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                    <FaPlus size={22} />
                  </div>
                  <div className={styles.expandedFormTitle}>
                    <h3 className={`${styles.expandedFormTitleText} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      Create New Section
                    </h3>
                    <p className={`${styles.expandedFormSubtitle} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      Add a new section to organize your template fields
                    </p>
                  </div>
                </div>

                <div className={styles.expandedFormBody}>
                  <div className={styles.inputGroup}>
                    <label className={`${styles.fieldLabel} ${isDarkTheme ? styles.darkTheme : ""}`}>Section Name</label>
                    <input
                      type="text"
                      value={newSectionName}
                      onChange={(e) => setNewSectionName(e.target.value)}
                      placeholder="Enter section name..."
                      className={`${styles.expandedInput} ${isDarkTheme ? styles.darkTheme : ""}`}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newSectionName.trim()) {
                          addSectionWithName();
                        } else if (e.key === 'Escape') {
                          setShowSectionForm(false);
                          setNewSectionName("");
                        }
                      }}
                    />
                  </div>

                  <div className={styles.expandedFormActions}>
                    <button
                      onClick={() => {
                        setShowSectionForm(false);
                        setNewSectionName("");
                      }}
                      className={`${styles.secondaryButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addSectionWithName}
                      className={`${styles.primaryButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                      disabled={!newSectionName.trim()}
                    >
                      <FaPlus size={14} />
                      <span>Create Section</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setShowSectionForm(true)}
                className={`${styles.configRecord} ${styles.newCategoryCard} ${isDarkTheme ? styles.darkTheme : ""}`}
                role="button"
                aria-label="Create new section"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setShowSectionForm(true);
                  }
                }}
              >
                <div className={`${styles.recordIcon} ${styles.newCategoryIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                  <FaPlus size={22} />
                </div>
                <div className={styles.recordContent}>
                  <h3 className={`${styles.recordTitle} ${styles.newCategoryTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Create Section</h3>
                  <p className={`${styles.recordDescription} ${styles.newCategoryDesc} ${isDarkTheme ? styles.darkTheme : ""}`}>Add a new section to organize your fields</p>
                </div>
              </div>
            )}
            {template.sections.map((section, index) => (
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
                      {editMode && editingSectionIndex === index ? (
                        <div className={styles.editSectionForm}>
                          <input
                            type="text"
                            value={editingSectionName}
                            onChange={(e) => setEditingSectionName(e.target.value)}
                            className={`${styles.editInput} ${isDarkTheme ? styles.darkTheme : ""}`}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                saveEditingSection();
                              } else if (e.key === "Escape") {
                                cancelEditingSection();
                              }
                            }}
                            autoFocus
                          />
                          <div className={styles.editButtons}>
                            <button
                              onClick={saveEditingSection}
                              className={`${styles.saveEditButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                            >
                              <FaCheck size={12} />
                            </button>
                            <button
                              onClick={cancelEditingSection}
                              className={`${styles.cancelEditButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                            >
                              <FaTimes size={12} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <h3 className={`${styles.recordTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>{section.name}</h3>
                      )}
                    </div>
                    {!editMode && (
                      <div className={`${styles.recordArrow} ${isDarkTheme ? styles.darkTheme : ""}`}>
                        <IoChevronForward size={16} />
                      </div>
                    )}
                    {editMode && editingSectionIndex !== index && section.name !== "Record Data" && (
                      <div className={styles.sectionEditActions}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditingSection(index);
                          }}
                          className={`${styles.editSectionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                          title="Rename section"
                        >
                          <FaEdit size={12} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSection(index);
                          }}
                          className={`${styles.deleteSectionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                          title="Delete section"
                        >
                          <FaTrash size={12} />
                        </button>
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
      </div>
    );
  };

  const renderSectionDetailView = () => {
    if (selectedTemplateIndex === null || currentSectionIndex === null || !templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex]?.sections[currentSectionIndex]) {
      return null;
    }

    const template = templateObjects[selectedObjectIndex].templates[selectedTemplateIndex];
    const section = template.sections[currentSectionIndex];

    return (
      <div className={`${styles.container} ${isDarkTheme ? styles.darkTheme : ""}`}>
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <button onClick={goBack} className={`${styles.backButton} ${styles.headerBackButton} ${isDarkTheme ? styles.darkTheme : ""}`}>
              <FaArrowLeft size={16} />
              Back to Template
            </button>
            {hasChanges() && (
              <button
                onClick={saveChanges}
                className={`${styles.saveChangesButton} ${isDarkTheme ? styles.darkTheme : ""}`}
              >
                <FaSave size={14} />
                <span>Save Changes</span>
              </button>
            )}
          </div>
          <div className={styles.headerBreadcrumbs}>
            {renderBreadcrumbs()}
          </div>
          <div className={styles.headerContent}>
            <h1 className={styles.title}>{section.name}</h1>
            <p className={styles.subtitle}>Customize the section name and manage its fields.</p>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>⚙️ Section Configuration</h2>
          <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Customize the section name and manage its fields.</p>
          <input
            type="text"
            value={section.name || ""}
            onChange={(e) => updateSectionName(currentSectionIndex, e.target.value)}
            className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ""}`}
            placeholder="Section Name"
            disabled={section.name === "Record Data" || !editMode}
          />
        </div>



        <div className={styles.section}>
          <div className={`${styles.section} ${styles.unifiedSection} ${isDarkTheme ? styles.darkTheme : ""}`}>
            <h3 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>🏷️ Fields in Section</h3>
            <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>These fields are currently included in this section.</p>

            <div className={`${styles.unifiedGrid} ${showFieldForm ? styles.expandedFormActive : ""} ${isDarkTheme ? styles.darkTheme : ""}`}>
              {/* Create Field Card / Expanded Form */}
              {showFieldForm ? (
                <div className={`${styles.configRecord} ${styles.expandedCategoryForm} ${isDarkTheme ? styles.darkTheme : ""}`}>
                  <div className={styles.expandedFormHeader}>
                    <div className={`${styles.recordIcon} ${styles.newCategoryIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      <FaPlus size={22} />
                    </div>
                    <div className={styles.expandedFormTitle}>
                      <h3 className={`${styles.expandedFormTitleText} ${isDarkTheme ? styles.darkTheme : ""}`}>
                        Create New Field
                      </h3>
                      <p className={`${styles.expandedFormSubtitle} ${isDarkTheme ? styles.darkTheme : ""}`}>
                        Add a new field to organize your record data
                      </p>
                    </div>
                  </div>

                  <div className={styles.expandedFormBody}>
                    <div className={styles.inputGroup}>
                      <label className={`${styles.fieldLabel} ${isDarkTheme ? styles.darkTheme : ""}`}>Field Name</label>
                      <input
                        type="text"
                        value={newHeaderName}
                        onChange={(e) => setNewHeaderName(e.target.value)}
                        placeholder="Enter field name..."
                        className={`${styles.expandedInput} ${isDarkTheme ? styles.darkTheme : ""}`}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newHeaderName.trim()) {
                            saveHeader();
                          } else if (e.key === 'Escape') {
                            setShowFieldForm(false);
                            resetHeaderForm();
                          }
                        }}
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={`${styles.fieldLabel} ${isDarkTheme ? styles.darkTheme : ""}`}>Field Type</label>
                      <select
                        value={newHeaderType}
                        onChange={(e) => setNewHeaderType(e.target.value)}
                        className={`${styles.expandedSelect} ${isDarkTheme ? styles.darkTheme : ""}`}
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="currency">Currency</option>
                        <option value="dropdown">Dropdown</option>
                        <option value="multi-select">Multi-Select</option>
                      </select>
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={`${styles.fieldLabel} ${isDarkTheme ? styles.darkTheme : ""}`}>Section</label>
                      <select
                        value={newHeaderSection}
                        onChange={(e) => setNewHeaderSection(e.target.value)}
                        className={`${styles.expandedSelect} ${isDarkTheme ? styles.darkTheme : ""}`}
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
                    </div>

                    {(newHeaderType === "dropdown" || newHeaderType === "multi-select") && (
                      <div className={styles.optionsSection}>
                        <label className={`${styles.fieldLabel} ${isDarkTheme ? styles.darkTheme : ""}`}>Options</label>
                        <div className={styles.optionInputRow}>
                          <input
                            type="text"
                            value={newOption}
                            onChange={(e) => setNewOption(e.target.value)}
                            placeholder="Add option..."
                            className={`${styles.expandedInput} ${isDarkTheme ? styles.darkTheme : ""}`}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                addOption();
                              }
                            }}
                          />
                          <button
                            onClick={addOption}
                            className={`${styles.addOptionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                            disabled={!newOption.trim()}
                          >
                            <FaPlus size={14} />
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
                                <FaTimes size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className={styles.expandedFormActions}>
                      <button
                        onClick={() => {
                          setShowFieldForm(false);
                          resetHeaderForm();
                        }}
                        className={`${styles.secondaryButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveHeader}
                        className={`${styles.primaryButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                        disabled={!newHeaderName.trim() || !newHeaderSection.trim()}
                      >
                        <FaPlus size={14} />
                        <span>Create Field</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setShowFieldForm(true)}
                  className={`${styles.configRecord} ${styles.newCategoryCard} ${isDarkTheme ? styles.darkTheme : ""}`}
                  role="button"
                  aria-label="Create new field"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setShowFieldForm(true);
                    }
                  }}
                >
                  <div className={`${styles.recordIcon} ${styles.newCategoryIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                    <FaPlus size={22} />
                  </div>
                  <div className={styles.recordContent}>
                    <h3 className={`${styles.recordTitle} ${styles.newCategoryTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Create Field</h3>
                    <p className={`${styles.recordDescription} ${styles.newCategoryDesc} ${isDarkTheme ? styles.darkTheme : ""}`}>Add a new field to organize your data</p>
                  </div>
                </div>
              )}

              {/* Existing Fields */}
              {section.keys.map((key, index) => {
                const header = template.headers.find((h) => h.key === key) || {
                  key,
                  name: key,
                  type: "text",
                };
                const headerIndex = template.headers.findIndex((h) => h.key === key);
                const isProtected = header.key === "docId" || header.key === "typeOfRecord" || header.key === "typeOfObject" || header.key === "assignedTo";
                return (
                  <div
                    ref={(el) => keyRefs.current.set(`${currentSectionIndex}-${index}`, el)}
                    key={`${currentSectionIndex}-${index}`}
                    className={`${styles.configRecord} ${
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
                            {section.keys.includes(header.key) ? (
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
          </div>

          <div className={styles.section}>
            <h3 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>🔍 Available Fields</h3>
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
              const headerIndex = template.headers.findIndex((h) => h.key === header.key);
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
                          {section.keys.includes(header.key) ? (
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
              disabled={section.name === "Record Data"}
            >
              Delete Section
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderFieldEditView = () => {
    if (selectedTemplateIndex === null || activeHeaderIndex === null || !templateObjects[selectedObjectIndex]?.templates[selectedTemplateIndex]?.headers[activeHeaderIndex]) {
      return null;
    }

    const header = templateObjects[selectedObjectIndex].templates[selectedTemplateIndex].headers[activeHeaderIndex];

    return (
      <div className={`${styles.container} ${isDarkTheme ? styles.darkTheme : ""}`}>
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <button onClick={goBack} className={`${styles.backButton} ${styles.headerBackButton} ${isDarkTheme ? styles.darkTheme : ""}`}>
              <FaArrowLeft size={16} />
              Back to Section
            </button>
            {hasChanges() && (
              <button
                onClick={saveChanges}
                className={`${styles.saveChangesButton} ${isDarkTheme ? styles.darkTheme : ""}`}
              >
                <FaSave size={14} />
                <span>Save Changes</span>
              </button>
            )}
          </div>
          <div className={styles.headerBreadcrumbs}>
            {renderBreadcrumbs()}
          </div>
          <div className={styles.headerContent}>
            <h1 className={styles.title}>{header.name}</h1>
            <p className={styles.subtitle}>Customize the field properties and settings.</p>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>⚙️ Field Configuration</h2>
          <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Customize the field properties and settings.</p>
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
              disabled={['docId', 'typeOfRecord', 'typeOfObject', 'assignedTo'].includes(header.key)}
              tabIndex={['docId', 'typeOfRecord', 'typeOfObject', 'assignedTo'].includes(header.key) ? -1 : 0}
            />
            <div className={styles.fieldContainer}>
              <select
                value={newHeaderType}
                onChange={(e) => setNewHeaderType(e.target.value)}
                className={`${styles.selectField} ${isDarkTheme ? styles.darkTheme : ""}`}
                disabled={activeHeaderIndex !== -1 && activeHeaderIndex !== null}
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
                  navigator.clipboard.writeText(header.key);
                  setCopiedHeaderId(true);
                  setTimeout(() => setCopiedHeaderId(false), 1200);
                }}
                className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ""}`}
                style={{ width: "100%", marginBottom: 12 }}
              >
                {copiedHeaderId ? "Copied!" : "Copy Header Key"}
              </button>
              {header.key !== "docId" &&
                header.key !== "typeOfRecord" &&
                header.key !== "assignedTo" && (
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

            <div className={styles.inputGroup}>
              <label className={`${styles.fieldLabel} ${isDarkTheme ? styles.darkTheme : ""}`}>Field Mappings</label>
              <div className={styles.fieldMappings}>
                {pipelineFieldMappings.map((mapping, index) => (
                  <div key={index} className={styles.mappingRow}>
                    <select
                      value={mapping.source}
                      onChange={(e) => updateFieldMapping(index, 'source', e.target.value)}
                      className={`${styles.selectField} ${styles.mappingSelect} ${isDarkTheme ? styles.darkTheme : ""}`}
                    >
                      <option value="">Select source field...</option>
                      {getTemplateFields(pipelineSourceTemplate).map((field) => (
                        <option key={field.key} value={field.key}>
                          {field.name}
                        </option>
                      ))}
                    </select>
                    <span className={styles.mappingArrow}>→</span>
                    <select
                      value={mapping.target}
                      onChange={(e) => updateFieldMapping(index, 'target', e.target.value)}
                      className={`${styles.selectField} ${styles.mappingSelect} ${isDarkTheme ? styles.darkTheme : ""}`}
                    >
                      <option value="">Select target field...</option>
                      {getTemplateFields(pipelineTargetTemplate).map((field) => (
                        <option key={field.key} value={field.key}>
                          {field.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeFieldMapping(index)}
                      className={`${styles.removeMappingButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                      aria-label="Remove mapping"
                    >
                      <IoTrash size={14} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addFieldMapping}
                  className={`${styles.addMappingButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                >
                  <IoAdd size={14} />
                  Add Field Mapping
                </button>
              </div>
            </div>

            <div className={styles.formActions}>
              <button
                onClick={() => {
                  setShowPipelineForm(false);
                  resetPipelineForm();
                }}
                className={`${styles.secondaryButton} ${isDarkTheme ? styles.darkTheme : ""}`}
              >
                Cancel
              </button>
              <button
                onClick={editingPipelineIndex !== null ? updatePipeline : createPipeline}
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
                  <div key={index} className={`${styles.pipelineCard} ${isDarkTheme ? styles.darkTheme : ""}`}>
                    <div className={styles.pipelineHeader}>
                      <h4 className={`${styles.pipelineName} ${isDarkTheme ? styles.darkTheme : ""}`}>{pipeline.name}</h4>
                      <div className={styles.pipelineActions}>
                        <button
                          onClick={() => editPipeline(index)}
                          className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                          aria-label="Edit pipeline"
                        >
                          <FaEdit size={14} />
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
                    <div className={styles.pipelineFlow}>
                      <span className={`${styles.templateName} ${isDarkTheme ? styles.darkTheme : ""}`}>{sourceTemplate?.name || 'Unknown'}</span>
                      <span className={styles.flowArrow}>→</span>
                      <span className={`${styles.templateName} ${isDarkTheme ? styles.darkTheme : ""}`}>{targetTemplate?.name || 'Unknown'}</span>
                    </div>
                    <div className={`${styles.pipelineMappings} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      {pipeline.fieldMappings?.length || 0} field mappings
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFieldCreateView = () => {
    if (selectedTemplateIndex === null) {
      return null;
    }

    return (
      <div className={`${styles.container} ${isDarkTheme ? styles.darkTheme : ""}`}>
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <button onClick={goBack} className={`${styles.backButton} ${styles.headerBackButton} ${isDarkTheme ? styles.darkTheme : ""}`}>
              <FaArrowLeft size={16} />
              Back to Section
            </button>
            {hasChanges() && (
              <button
                onClick={saveChanges}
                className={`${styles.saveChangesButton} ${isDarkTheme ? styles.darkTheme : ""}`}
              >
                <FaSave size={14} />
                <span>Save Changes</span>
              </button>
            )}
          </div>
          <div className={styles.headerBreadcrumbs}>
            {renderBreadcrumbs()}
          </div>
          <div className={styles.headerContent}>
            <h1 className={styles.title}>Add New Field</h1>
            <p className={styles.subtitle}>Create a new field for your record template.</p>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>➕ Add New Field</h2>
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
          
          {/* Create button - matches RecordsTemplate style */}
          <div className={styles.formActions}>
            <button
              onClick={saveHeader}
              disabled={!newHeaderName.trim() || !newHeaderSection.trim()}
              className={`${styles.confirmButton} ${isDarkTheme ? styles.darkTheme : ""} ${(!newHeaderName.trim() || !newHeaderSection.trim()) ? styles.disabled : ''}`}
            >
              Create Field
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Expose save function to parent component
  useImperativeHandle(ref, () => ({
    saveDataModels: saveChanges
  }));

  // Main render
  return (
    <div className={`${styles.pageContainer} ${isDarkTheme ? styles.darkTheme : ""}`}>
      {currentView === 'objects' && renderObjectsView()}
      {currentView === 'templates' && renderTemplatesView()}
      {currentView === 'template-detail' && renderTemplateDetailView()}
      {currentView === 'section-detail' && renderSectionDetailView()}
      {currentView === 'field-edit' && renderFieldEditView()}
      {currentView === 'field-create' && renderFieldCreateView()}
    </div>
  );
});

DataModelsInner.propTypes = {
  onSave: PropTypes.func,
  onBack: PropTypes.func,
};

DataModels.propTypes = {
  onSave: PropTypes.func,
  onBack: PropTypes.func,
};

export default DataModels;