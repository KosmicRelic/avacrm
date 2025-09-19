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
    isDarkTheme, 
    businessId: businessIdContext,
    templateProfiles: contextTemplateProfiles,
    setTemplateProfiles: contextSetTemplateProfiles
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
  
  // Profile management state - use local state to prevent Firestore overwrites
  const [templateProfiles, setTemplateProfiles] = useState(() => {
    const profiles = contextTemplateProfiles || [];
    // Process profiles to ensure templates have proper structure
    return profiles.map(profile => ({
      ...profile,
      templates: (profile.templates || []).map((t) => {
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
    }));
  });
  const [selectedProfileIndex, setSelectedProfileIndex] = useState(null);
  const [newProfileName, setNewProfileName] = useState("");
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [editingProfileIndex, setEditingProfileIndex] = useState(null);
  const [editingProfileName, setEditingProfileName] = useState("");
  
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
    return templateProfiles.flatMap(profile => 
      (profile.templates || []).map(template => ({
        ...template,
        profileId: profile.id,
        profileName: profile.name
      }))
    );
  }, [templateProfiles]);
  
  const prevStepRef = useRef(currentStep);
  const lastTempDataRef = useRef({ deletedHeaderKeys, templateProfiles });
  const initialStateRef = useRef(null); // Track initial state to detect changes

  // Update tempData only when necessary (prevent infinite loop)
  useEffect(() => {
    if (
      !isEqual(lastTempDataRef.current.deletedHeaderKeys, deletedHeaderKeys) ||
      !isEqual(lastTempDataRef.current.templateProfiles, templateProfiles)
    ) {
      setTempData({ 
        deletedHeaderKeys, 
        templateProfiles,
        hasProfileChanges: hasChanges() // Pass the change detection result
      });
      lastTempDataRef.current = { deletedHeaderKeys, templateProfiles };
    }
     
  }, [deletedHeaderKeys, templateProfiles, setTempData]);

  // Initialize initial state and detect changes
  useEffect(() => {
    if (!initialStateRef.current) {
      // Store initial state when component mounts
      initialStateRef.current = {
        deletedHeaderKeys: [...deletedHeaderKeys],
        templateProfiles: JSON.parse(JSON.stringify(templateProfiles))
      };
    }
  }, [deletedHeaderKeys, templateProfiles]);

  // Function to detect if there are any changes from initial state
  const hasChanges = useCallback(() => {
    if (!initialStateRef.current) return false;
    
    return (
      !isEqual(initialStateRef.current.deletedHeaderKeys, deletedHeaderKeys) ||
      !isEqual(initialStateRef.current.templateProfiles, templateProfiles)
    );
  }, [deletedHeaderKeys, templateProfiles]);

  // Function to update tempData only if there are changes
  const updateTempDataIfChanged = useCallback(() => {
    if (hasChanges()) {
      setTempData({ deletedHeaderKeys, templateProfiles });
      lastTempDataRef.current = { deletedHeaderKeys, templateProfiles };
    }
  }, [deletedHeaderKeys, templateProfiles, hasChanges, setTempData]);

  // Sync local templateProfiles with context on initial load
  useEffect(() => {
    if (contextTemplateProfiles && contextTemplateProfiles.length > 0 && templateProfiles.length === 0) {
      setTemplateProfiles(contextTemplateProfiles);
    }
  }, [contextTemplateProfiles, templateProfiles.length, setTemplateProfiles]);

  // Initialize tempData with initial values including templateProfiles
  useEffect(() => {
    setTempData({ 
      deletedHeaderKeys, 
      templateProfiles,
      hasProfileChanges: hasChanges() // Include change detection
    });
    lastTempDataRef.current = { deletedHeaderKeys, templateProfiles };
    
    // Store initial state after first load
    if (!initialStateRef.current) {
      initialStateRef.current = {
        deletedHeaderKeys: [...deletedHeaderKeys],
        templateProfiles: JSON.parse(JSON.stringify(templateProfiles))
      };
    }
  }, []); // Only run once on mount

  const initialEditingNameRef = useRef(null);
  
  useEffect(() => {
    if (editingProfileIndex !== null) {
      // Store the initial name when editing starts
      if (initialEditingNameRef.current === null) {
        initialEditingNameRef.current = templateProfiles[editingProfileIndex]?.name || "";
      }
      
      // Check if the profile name in context has changed from the initial name
      // This indicates an external update (like successful save)
      const currentProfile = templateProfiles[editingProfileIndex];
      if (currentProfile && currentProfile.name !== initialEditingNameRef.current) {
        // Profile name was updated externally, reset editing state
        setEditingProfileIndex(null);
        setEditingProfileName("");
        initialEditingNameRef.current = null;
      }
    } else {
      // Reset the ref when not editing
      initialEditingNameRef.current = null;
    }
  }, [templateProfiles, editingProfileIndex]);

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
      setSelectedProfileIndex(null);
      goBack();
    } else {
      goBack();
    }
    setNavigationDirection("backward");
  }, [currentStep, goBack, editMode, resetHeaderForm]);

  const deleteHeader = useCallback(
    (index) => {
      if (selectedProfileIndex === null || selectedTemplateIndex === null) return;
      const profile = templateProfiles[selectedProfileIndex];
      const template = profile.templates[selectedTemplateIndex];
      const header = template.headers[index];
      if (header.key === "docId" || header.key === "linkId" || header.key === "typeOfCards" || header.key === "assignedTo") {
        alert("The 'ID', 'Link ID', 'Type of Cards' or 'Assigned To' field cannot be deleted.");
        return;
      }
      const headerName = header.name;
      if (window.confirm(`Are you sure you want to delete the field "${headerName}"?`)) {
        setDeletedHeaderKeys((prev) => [...new Set([...prev, header.key])]); // Avoid duplicates
        setTemplateProfiles((prev) => {
          const newProfiles = [...prev];
          const currentProfile = { ...newProfiles[selectedProfileIndex] };
          const currentTemplate = { ...currentProfile.templates[selectedTemplateIndex] };
          const deletedKey = currentTemplate.headers[index].key;
          currentTemplate.headers = currentTemplate.headers.filter((_, i) => i !== index);
          currentTemplate.sections = currentTemplate.sections.map((section) => ({
            ...section,
            keys: section.keys.filter((k) => k !== deletedKey),
          }));
          currentProfile.templates[selectedTemplateIndex] = {
            ...currentTemplate,
            isModified: true,
            action: currentTemplate.action || "update",
          };
          newProfiles[selectedProfileIndex] = currentProfile;
          return newProfiles;
        });
        setActiveHeaderIndex(null);
        setNavigationDirection("backward");
        goBack();
      }
    },
    [selectedProfileIndex, selectedTemplateIndex, templateProfiles, goBack]
  );

  const handleDeleteSection = useCallback(
    (index) => {
      if (selectedProfileIndex === null || selectedTemplateIndex === null) return;
      const profile = templateProfiles[selectedProfileIndex];
      const template = profile.templates[selectedTemplateIndex];
      const section = template.sections[index];
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
        setTemplateProfiles((prev) => {
          const newProfiles = [...prev];
          const currentProfile = { ...newProfiles[selectedProfileIndex] };
          const currentTemplate = { ...currentProfile.templates[selectedTemplateIndex] };
          const deletedSection = currentTemplate.sections[index];
          currentTemplate.sections = currentTemplate.sections.filter((_, i) => i !== index);
          currentTemplate.headers = currentTemplate.headers.map((h) =>
            h.section === deletedSection.name ? { ...h, section: "", isUsed: false } : h
          );
          currentProfile.templates[selectedTemplateIndex] = {
            ...currentTemplate,
            isModified: true,
            action: currentTemplate.action || "update",
          };
          newProfiles[selectedProfileIndex] = currentProfile;
          return newProfiles;
        });
        setNavigationDirection("backward");
        goBack();
      }
    },
    [selectedProfileIndex, selectedTemplateIndex, templateProfiles, goBack]
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
    if (selectedProfileIndex === null || selectedTemplateIndex === null) return;
    const profile = templateProfiles[selectedProfileIndex];
    const template = profile.templates[selectedTemplateIndex];
    const existingHeaders = template.headers;
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

    setTemplateProfiles((prev) => {
      const newProfiles = [...prev];
      const currentProfile = { ...newProfiles[selectedProfileIndex] };
      const currentTemplate = { ...currentProfile.templates[selectedTemplateIndex] };
      currentTemplate.headers = [...currentTemplate.headers, newHeader];
      currentTemplate.sections = currentTemplate.sections.map((section) => {
        if (section.name === newHeaderSection) {
          return { ...section, keys: [...section.keys, newHeader.key] };
        }
        return section;
      });
      currentProfile.templates[selectedTemplateIndex] = {
        ...currentTemplate,
        isModified: true,
        action: currentTemplate.action || "update",
      };
      newProfiles[selectedProfileIndex] = currentProfile;
      return newProfiles;
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
    selectedProfileIndex,
    selectedTemplateIndex,
    templateProfiles,
    validateHeader,
    resetHeaderForm,
    goBack,
  ]);

  // Update existing header
  const updateHeader = useCallback(
    (index) => {
      if (selectedProfileIndex === null || selectedTemplateIndex === null) return;
      const profile = templateProfiles[selectedProfileIndex];
      const template = profile.templates[selectedTemplateIndex];
      const existingHeaders = template.headers;
      if (!validateHeader(newHeaderName, existingHeaders, true, index)) return;
      if (!newHeaderSection) {
        alert("Please select a section for the field.");
        return;
      }

      const currentHeader = template.headers[index];
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

      setTemplateProfiles((prev) => {
        const newProfiles = [...prev];
        const currentProfile = { ...newProfiles[selectedProfileIndex] };
        const currentTemplate = { ...currentProfile.templates[selectedTemplateIndex] };
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

        currentProfile.templates[selectedTemplateIndex] = {
          ...currentTemplate,
          headers,
          sections,
          isModified: true,
          action: currentTemplate.action || "update",
        };
        newProfiles[selectedProfileIndex] = currentProfile;
        return newProfiles;
      });
      resetHeaderForm();
      setActiveHeaderIndex(null);
      setNavigationDirection("backward");
      goBack();
    },
    [newHeaderName, newHeaderType, newHeaderSection, newHeaderOptions, selectedProfileIndex, selectedTemplateIndex, templateProfiles, validateHeader, resetHeaderForm, goBack]
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
        { title: "Template Profiles", rightButton: null },
        { title: "Card Templates", rightButton: null },
        {
          title: () =>
            selectedProfileIndex !== null && selectedTemplateIndex !== null && templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex]
              ? templateProfiles[selectedProfileIndex].templates[selectedTemplateIndex].name || "New Template"
              : "New Template",
          rightButton: null,
        },
        {
          title: () =>
            selectedProfileIndex !== null && selectedTemplateIndex !== null &&
            currentSectionIndex !== null &&
            templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex]?.sections[currentSectionIndex]
              ? templateProfiles[selectedProfileIndex].templates[selectedTemplateIndex].sections[currentSectionIndex].name || "Section"
              : "Section",
          rightButton: null,
        },
        {
          title: () =>
            selectedProfileIndex !== null && selectedTemplateIndex !== null && activeHeaderIndex !== null && templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex]?.headers[activeHeaderIndex]
              ? templateProfiles[selectedProfileIndex].templates[selectedTemplateIndex].headers[activeHeaderIndex].name || "Edit Field"
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
  }, [registerModalSteps, setModalConfig, selectedProfileIndex, selectedTemplateIndex, currentSectionIndex, templateProfiles, saveHeader]);

  // Update modal config
  useEffect(() => {
    if (currentStep === 1) {
      setModalConfig({
        showTitle: true,
        showDoneButton: true,
        showBackButton: false,
        title: "Template Profiles",
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
        backButtonTitle: "Template Profiles",
        backButton: { label: "Template Profiles", onClick: handleBack },
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
        title: selectedProfileIndex !== null && selectedTemplateIndex !== null && templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex] ? templateProfiles[selectedProfileIndex].templates[selectedTemplateIndex].name || "New Template" : "New Template",
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
          : selectedProfileIndex !== null && selectedTemplateIndex !== null && templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex]
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
        backButtonTitle: templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex]?.name || "New Template",
        backButton: editMode ? null : { label: templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex]?.name || "New Template", onClick: handleBack },
        title: templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex]?.sections[currentSectionIndex]?.name || "Section",
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
        backButtonTitle: templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex]?.sections[currentSectionIndex]?.name || "Section",
        backButton: { label: templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex]?.sections[currentSectionIndex]?.name || "Section", onClick: handleBack },
        title: templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex]?.headers[activeHeaderIndex]?.name || "Edit Field",
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
        backButtonTitle: templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex]?.sections[currentSectionIndex]?.name || "Section",
        backButton: { label: templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex]?.sections[currentSectionIndex]?.name || "Section", onClick: handleBack },
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
  }, [currentStep, selectedTemplateIndex, currentSectionIndex, editMode, templateProfiles, setModalConfig, saveHeader, handleBack]);

  // Confirm new template
  const confirmNewTemplate = useCallback(() => {
    if (!newTemplateName.trim()) {
      alert("Please enter a template name.");
      return;
    }
    if (selectedProfileIndex === null) {
      alert("Please select a profile first.");
      return;
    }
    // Check for duplicate names across all templates
    const allTemplates = getAllTemplates();
    if (allTemplates.some((t) => t.name.toLowerCase() === newTemplateName.trim().toLowerCase())) {
      alert("A template with this name already exists. Please choose a unique name.");
      return;
    }

    const timestampId = `template_${Date.now()}`;
    const newTemplate = {
      docId: timestampId,
      name: newTemplateName.trim(),
      typeOfCards: newTemplateName.trim(),
      profileId: templateProfiles[selectedProfileIndex].id,
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

    setTemplateProfiles((prev) => {
      const newProfiles = [...prev];
      const currentProfile = { ...newProfiles[selectedProfileIndex] };
      currentProfile.templates = [...currentProfile.templates, newTemplate];
      newProfiles[selectedProfileIndex] = currentProfile;
      return newProfiles;
    });
    setSelectedTemplateIndex(templateProfiles[selectedProfileIndex].templates.length);
    setEditMode(false);

    setNavigationDirection("forward");
    goToStep(3);
  }, [newTemplateName, getAllTemplates, selectedProfileIndex, templateProfiles, goToStep]);

  // Add new section
  const addSection = useCallback(() => {
    if (selectedProfileIndex === null || selectedTemplateIndex === null) return;
    setTemplateProfiles((prev) => {
      const newProfiles = [...prev];
      const currentProfile = { ...newProfiles[selectedProfileIndex] };
      const currentTemplate = { ...currentProfile.templates[selectedTemplateIndex] };
      const newSectionName = `Section ${currentTemplate.sections.length + 1}`;
      if (currentTemplate.sections.some((s) => s.name.toLowerCase() === newSectionName.toLowerCase())) {
        alert(`Section name "${newSectionName}" already exists. Please use a unique name.`);
        return prev;
      }
      currentTemplate.sections = [...currentTemplate.sections, { name: newSectionName, keys: [] }];
      currentProfile.templates[selectedTemplateIndex] = {
        ...currentTemplate,
        isModified: true,
        action: currentTemplate.action || "update",
      };
      newProfiles[selectedProfileIndex] = currentProfile;
      return newProfiles;
    });
  }, [selectedProfileIndex, selectedTemplateIndex, templateProfiles]);
  
  // Update section name
  const updateSectionName = useCallback(
    (index, newName) => {
      if (selectedProfileIndex === null || selectedTemplateIndex === null) return;
      setTemplateProfiles((prev) => {
        const newProfiles = [...prev];
        const currentProfile = { ...newProfiles[selectedProfileIndex] };
        const currentTemplate = { ...currentProfile.templates[selectedTemplateIndex] };
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
        currentProfile.templates[selectedTemplateIndex] = {
          ...currentTemplate,
          isModified: true,
          action: currentTemplate.action || "update",
        };
        newProfiles[selectedProfileIndex] = currentProfile;
        return newProfiles;
      });
    },
    [selectedProfileIndex, selectedTemplateIndex, templateProfiles]
  );

  // Drag-and-drop handlers
  const handleDragStart = useCallback((e, sectionIndex, index) => {
    if (selectedProfileIndex === null || selectedTemplateIndex === null) return;
    const profile = templateProfiles[selectedProfileIndex];
    const template = profile.templates[selectedTemplateIndex];
    const key = template.sections[sectionIndex].keys[index];
    if (key === "docId" || key === "linkId" || key === "typeOfCards" || key === "assignedTo") {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    setDraggedSectionIndex(sectionIndex);
    e.dataTransfer.effectAllowed = "move";
    const element = keyRefs.current.get(`${sectionIndex}-${index}`);
    if (element) element.classList.add(styles.dragging);
  }, [selectedTemplateIndex, templateProfiles]);

  const handleTouchStart = useCallback((e, sectionIndex, index) => {
    if (selectedProfileIndex === null || selectedTemplateIndex === null) return;
    const profile = templateProfiles[selectedProfileIndex];
    const template = profile.templates[selectedTemplateIndex];
    const key = template.sections[sectionIndex].keys[index];
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
  }, [selectedProfileIndex, selectedTemplateIndex, templateProfiles, styles.dragIcon]);

  const handleDragOver = useCallback(
    (e, sectionIndex, index) => {
      e.preventDefault();
      if (draggedIndex === null || draggedSectionIndex !== sectionIndex || draggedIndex === index || selectedProfileIndex === null || selectedTemplateIndex === null) return;

      setTemplateProfiles((prev) => {
        const newProfiles = [...prev];
        const currentProfile = { ...newProfiles[selectedProfileIndex] };
        const currentTemplate = { ...currentProfile.templates[selectedTemplateIndex] };
        const newSections = [...currentTemplate.sections];
        const sectionKeys = [...newSections[sectionIndex].keys];
        const [draggedItem] = sectionKeys.splice(draggedIndex, 1);
        sectionKeys.splice(index, 0, draggedItem);
        newSections[sectionIndex] = { ...newSections[sectionIndex], keys: sectionKeys };
        currentTemplate.sections = newSections;
        currentProfile.templates[selectedTemplateIndex] = {
          ...currentTemplate,
          isModified: true,
          action: currentTemplate.action || "update",
        };
        newProfiles[selectedProfileIndex] = currentProfile;
        return newProfiles;
      });
      setTimeout(() => setDraggedIndex(index), 0);
    },
    [draggedIndex, draggedSectionIndex, selectedProfileIndex, selectedTemplateIndex, templateProfiles]
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
        Math.min(touchTargetIndex + delta, templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex]?.sections[sectionIndex]?.keys.length - 1 || 0)
      );

      if (newIndex !== draggedIndex) {
        setTemplateProfiles((prev) => {
          const newProfiles = [...prev];
          const currentProfile = { ...newProfiles[selectedProfileIndex] };
          const currentTemplate = { ...currentProfile.templates[selectedTemplateIndex] };
          const newSections = [...currentTemplate.sections];
          const sectionKeys = [...newSections[sectionIndex].keys];
          const [draggedItem] = sectionKeys.splice(draggedIndex, 1);
          sectionKeys.splice(newIndex, 0, draggedItem);
          newSections[sectionIndex] = { ...newSections[sectionIndex], keys: sectionKeys };
          currentTemplate.sections = newSections;
          currentProfile.templates[selectedTemplateIndex] = {
            ...currentTemplate,
            isModified: true,
            action: currentTemplate.action || "update",
          };
          newProfiles[selectedProfileIndex] = currentProfile;
          return newProfiles;
        });
        setTimeout(() => setDraggedIndex(newIndex), 0);
      }
    },
    [draggedIndex, touchStartY, touchTargetIndex, selectedProfileIndex, selectedTemplateIndex, templateProfiles]
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
    if (draggedSectionOrderIndex === null || draggedSectionOrderIndex === index || selectedProfileIndex === null || selectedTemplateIndex === null) return;
    setTemplateProfiles((prev) => {
      const newProfiles = [...prev];
      const currentProfile = { ...newProfiles[selectedProfileIndex] };
      const currentTemplate = { ...currentProfile.templates[selectedTemplateIndex] };
      const newSections = [...currentTemplate.sections];
      const [draggedSection] = newSections.splice(draggedSectionOrderIndex, 1);
      newSections.splice(index, 0, draggedSection);
      currentTemplate.sections = newSections;
      currentProfile.templates[selectedTemplateIndex] = {
        ...currentTemplate,
        isModified: true,
        action: currentTemplate.action || 'update',
      };
      newProfiles[selectedProfileIndex] = currentProfile;
      return newProfiles;
    });
    setDraggedSectionOrderIndex(index);
  }, [draggedSectionOrderIndex, selectedProfileIndex, selectedTemplateIndex, templateProfiles]);

  const handleSectionTouchMove = useCallback((e, index) => {
    if (draggedSectionOrderIndex === null || sectionTouchStartY === null || selectedProfileIndex === null || selectedTemplateIndex === null) return;
    e.preventDefault();
    const touchY = e.touches[0].clientY;
    const itemHeight = 44;
    const delta = Math.round((touchY - sectionTouchStartY) / itemHeight);
    const template = templateProfiles[selectedProfileIndex].templates[selectedTemplateIndex];
    const newIndex = Math.max(0, Math.min(sectionTouchTargetIndex + delta, template.sections.length - 1));
    if (newIndex !== draggedSectionOrderIndex) {
      setTemplateProfiles((prev) => {
        const newProfiles = [...prev];
        const currentProfile = { ...newProfiles[selectedProfileIndex] };
        const currentTemplate = { ...currentProfile.templates[selectedTemplateIndex] };
        const newSections = [...currentTemplate.sections];
        const [draggedSection] = newSections.splice(draggedSectionOrderIndex, 1);
        newSections.splice(newIndex, 0, draggedSection);
        currentTemplate.sections = newSections;
        currentProfile.templates[selectedTemplateIndex] = {
          ...currentTemplate,
          isModified: true,
          action: currentTemplate.action || 'update',
        };
        newProfiles[selectedProfileIndex] = currentProfile;
        return newProfiles;
      });
      setDraggedSectionOrderIndex(newIndex);
    }
  }, [draggedSectionOrderIndex, sectionTouchStartY, sectionTouchTargetIndex, selectedProfileIndex, selectedTemplateIndex, templateProfiles]);

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
      if (template && selectedProfileIndex !== null) {
        const profile = templateProfiles[selectedProfileIndex];
        const templateIndex = profile.templates.findIndex((t) => t.name === template.name);
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
    [selectedProfileIndex, templateProfiles, goToStep]
  );

  // Profile Management Functions
  const createNewProfile = useCallback(async () => {
    if (!newProfileName.trim()) {
      alert("Please enter a profile name.");
      return;
    }
    if (templateProfiles.some((profile) => profile.name.toLowerCase() === newProfileName.trim().toLowerCase())) {
      alert("A profile with this name already exists. Please choose a unique name.");
      return;
    }

    const newProfile = {
      id: uuidv4(),
      name: newProfileName.trim(),
      templates: [],
      pipelines: []
    };

    try {
      // Add profile to local state first
      const updatedProfiles = [...templateProfiles, newProfile];
      setTemplateProfiles(updatedProfiles);
      
      // Update tempData immediately
      setTempData({ 
        deletedHeaderKeys, 
        templateProfiles: updatedProfiles,
        hasProfileChanges: true // Mark that profiles have changed
      });
      
      setNewProfileName("");
      setShowProfileForm(false);
    } catch (error) {
      console.error('Error creating profile:', error);
      alert('Failed to create profile. Please try again.');
      
      // Restore previous state in case of error
      setTemplateProfiles(templateProfiles);
    }
  }, [newProfileName, templateProfiles, businessId, deletedHeaderKeys, setTempData]);

  const selectProfile = useCallback((profileIndex) => {
    setSelectedProfileIndex(profileIndex);
    setNavigationDirection("forward");
    goToStep(2);
  }, [goToStep]);

  const deleteProfile = useCallback(async (profileIndex) => {
    const profile = templateProfiles[profileIndex];
    
    // Check for templates in both local state and profile.templates (from backend)
    const localTemplates = getAllTemplates().filter(template => 
      template.profileId === profile.id && template.action !== "remove"
    );
    const profileTemplatesFromBackend = profile.templates || [];
    
    // Count total templates (local + backend, avoiding duplicates)
    const allTemplateIds = new Set([
      ...localTemplates.map(t => t.docId),
      ...profileTemplatesFromBackend.map(t => t.docId)
    ]);
    
    if (allTemplateIds.size > 0) {
      alert(`Cannot delete profile "${profile.name}" because it contains ${allTemplateIds.size} template(s). Please delete all templates first.`);
      return;
    }
    if (window.confirm(`Are you sure you want to delete the profile "${profile.name}"? This action cannot be undone.`)) {
      try {
        // Mark profile for deletion instead of removing it from array
        const updatedProfiles = templateProfiles.map((e, index) => 
          index === profileIndex 
            ? { ...e, isModified: true, action: "remove" }
            : e
        );
        setTemplateProfiles(updatedProfiles);
        
      setTempData({ 
        deletedHeaderKeys, 
        templateProfiles: updatedProfiles,
        hasProfileChanges: true // Mark that profiles have changed
      });
        
        // Reset selected profile if it was the deleted one
        if (selectedProfileIndex === profileIndex) {
          setSelectedProfileIndex(null);
        }
      } catch (error) {
        console.error('Error marking profile for deletion:', error);
        alert('Failed to mark profile for deletion. Please try again.');
        
        // Restore profile in case of error
        setTemplateProfiles(templateProfiles);
        setSelectedProfileIndex(selectedProfileIndex);
      }
    }
  }, [templateProfiles, selectedProfileIndex, businessId, setTemplateProfiles, deletedHeaderKeys, setTempData]);

  const updateProfileName = useCallback(async (profileIndex, newName) => {
    if (!newName.trim()) return;
    if (templateProfiles.some((profile, index) => index !== profileIndex && profile.name.toLowerCase() === newName.trim().toLowerCase())) {
      alert("A profile with this name already exists. Please choose a unique name.");
      return;
    }

    const previousName = templateProfiles[profileIndex].name;
    const profileId = templateProfiles[profileIndex].id;

    // Update local state only
    const updatedProfiles = templateProfiles.map((profile, index) => 
      index === profileIndex 
        ? { 
            ...profile, 
            name: newName.trim(), 
            isModified: true, 
            action: profile.action || "update",
            templates: (profile.templates || []).map(template => ({
              ...template,
              profileName: newName.trim()
            }))
          }
        : profile
    );
    
    setTemplateProfiles(updatedProfiles);
    
    // Update tempData immediately to reflect the name change
    setTempData({ 
      deletedHeaderKeys, 
      templateProfiles: updatedProfiles,
      hasProfileChanges: true // Explicitly mark that profiles have changed
    });
  }, [templateProfiles, deletedHeaderKeys, setTempData]);

  const startEditingProfile = useCallback((profileIndex) => {
    setEditingProfileIndex(profileIndex);
    setEditingProfileName(templateProfiles[profileIndex].name);
  }, [templateProfiles]);

  const cancelEditingProfile = useCallback(() => {
    setEditingProfileIndex(null);
    setEditingProfileName("");
  }, []);

  const saveProfileName = useCallback(async () => {
    if (editingProfileIndex !== null) {
      await updateProfileName(editingProfileIndex, editingProfileName);
      setEditingProfileIndex(null);
      setEditingProfileName("");
    }
  }, [editingProfileIndex, editingProfileName, updateProfileName]);

  const getProfileTemplates = useCallback((profileIndex) => {
    if (profileIndex === null || !templateProfiles[profileIndex]) return [];
    const profile = templateProfiles[profileIndex];
    return (profile.templates || []).filter(template => template.action !== "remove");
  }, [templateProfiles]);

  // Get pipelines for a specific profile
  const getProfilePipelines = useCallback((profileIndex) => {
    if (profileIndex === null || !templateProfiles[profileIndex]) return [];
    const profile = templateProfiles[profileIndex];
    return profile.pipelines || [];
  }, [templateProfiles]);

  // Add new pipeline to profile
  const addProfilePipeline = useCallback(async () => {
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
      const updatedProfiles = templateProfiles.map((profile, index) =>
        index === selectedProfileIndex
          ? { ...profile, pipelines: [...(profile.pipelines || []), newPipeline] }
          : profile
      );
      
      setTemplateProfiles(updatedProfiles);
      
      // Update tempData immediately
      setTempData({ 
        deletedHeaderKeys, 
        templateProfiles: updatedProfiles 
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
      setTemplateProfiles(templateProfiles);
    }
  }, [selectedProfileIndex, newPipelineName, pipelineSourceTemplate, pipelineTargetTemplate, pipelineFieldMappings, templateProfiles, businessId, deletedHeaderKeys, setTempData]);

  // Edit existing pipeline
  const editProfilePipeline = useCallback((pipelineIndex) => {
    const pipeline = getProfilePipelines(selectedProfileIndex)[pipelineIndex];
    if (!pipeline) return;

    setEditingPipelineIndex(pipelineIndex);
    setNewPipelineName(pipeline.name);
    setPipelineSourceTemplate(pipeline.sourceTemplateId);
    setPipelineTargetTemplate(pipeline.targetTemplateId);
    setPipelineFieldMappings(pipeline.fieldMappings || []);
    setShowPipelineForm(true);
  }, [selectedProfileIndex, getProfilePipelines]);

  // Update existing pipeline
  const updateProfilePipeline = useCallback(() => {
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

    setTemplateProfiles(prev => {
      const updated = prev.map((profile, index) =>
        index === selectedProfileIndex
          ? {
              ...profile,
              pipelines: profile.pipelines?.map((pipeline, pIndex) =>
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
          : profile
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
  }, [selectedProfileIndex, editingPipelineIndex, newPipelineName, pipelineSourceTemplate, pipelineTargetTemplate, pipelineFieldMappings]);

  // Delete pipeline
  const deleteProfilePipeline = useCallback((pipelineIndex) => {
    if (!confirm('Are you sure you want to delete this pipeline?')) return;

    setTemplateProfiles(prev =>
      prev.map((profile, index) =>
        index === selectedProfileIndex
          ? {
              ...profile,
              pipelines: profile.pipelines?.filter((_, pIndex) => pIndex !== pipelineIndex) || []
            }
          : profile
      )
    );
  }, [selectedProfileIndex]);

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
    if (!pipelineSourceTemplate || selectedProfileIndex === null) return [];
    const sourceTemplate = getProfileTemplates(selectedProfileIndex).find(t => t.docId === pipelineSourceTemplate);
    return sourceTemplate?.headers || [];
  }, [pipelineSourceTemplate, selectedProfileIndex, getProfileTemplates]);

  const getTargetTemplateHeaders = useCallback(() => {
    if (!pipelineTargetTemplate || selectedProfileIndex === null) return [];
    const targetTemplate = getProfileTemplates(selectedProfileIndex).find(t => t.docId === pipelineTargetTemplate);
    return targetTemplate?.headers || [];
  }, [pipelineTargetTemplate, selectedProfileIndex, getProfileTemplates]);

  // Auto-add initial field mapping when templates are selected
  useEffect(() => {
    if (pipelineSourceTemplate && pipelineTargetTemplate && pipelineFieldMappings.length === 0) {
      addFieldMapping();
    }
  }, [pipelineSourceTemplate, pipelineTargetTemplate, pipelineFieldMappings.length, addFieldMapping]);

  // Update template name
  const updateTemplateName = useCallback(
    (newName) => {
      if (selectedProfileIndex === null || selectedTemplateIndex === null) return;
      setTemplateProfiles((prev) => {
        const newProfiles = [...prev];
        const currentProfile = { ...newProfiles[selectedProfileIndex] };
        const currentTemplate = { ...currentProfile.templates[selectedTemplateIndex] };
        
        // Check for duplicate names across all templates
        const allTemplates = getAllTemplates();
        if (
          newName.trim() &&
          allTemplates.some((t) => t.name.toLowerCase() === newName.trim().toLowerCase() && t !== currentTemplate)
        ) {
          alert("A template with this name already exists. Please choose a unique name.");
          return prev;
        }
        
        currentTemplate.name = newName.trim();
        currentTemplate.typeOfCards = newName.trim();
        currentTemplate.isModified = true;
        currentTemplate.action = currentTemplate.action || "update";
        
        currentProfile.templates[selectedTemplateIndex] = currentTemplate;
        newProfiles[selectedProfileIndex] = currentProfile;
        return newProfiles;
      });
    },
    [selectedProfileIndex, selectedTemplateIndex, templateProfiles, getAllTemplates]
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
      if (selectedProfileIndex === null || selectedTemplateIndex === null || sectionIndex === null) return;
      if (key === "docId" || key === "linkId" || key === "typeOfCards" || key === "assignedTo") {
        alert("The 'ID', 'Link ID', 'Type of Cards' or 'Assigned To' field cannot be deselected from the section.");
        return;
      }
      setTemplateProfiles((prev) => {
        const newProfiles = [...prev];
        const currentProfile = { ...newProfiles[selectedProfileIndex] };
        const currentTemplate = { ...currentProfile.templates[selectedTemplateIndex], headers: [...currentProfile.templates[selectedTemplateIndex].headers] };
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
        currentProfile.templates[selectedTemplateIndex] = currentTemplate;
        newProfiles[selectedProfileIndex] = currentProfile;
        return newProfiles;
      });
    },
    [selectedProfileIndex, selectedTemplateIndex]
  );

  // Delete key from section
  const handleDeleteKey = useCallback(
    (sectionIndex, key) => {
      if (selectedProfileIndex === null || selectedTemplateIndex === null || sectionIndex === null) return;
      if (key === "docId" || key === "linkId" || key === "typeOfCards" || key === "assignedTo") {
        alert("The 'ID', 'Link ID', 'Type of Cards' or 'Assigned To' field cannot be removed from the section.");
        return;
      }
      if (window.confirm(`Are you sure you want to remove this field from the section?`)) {
        setTemplateProfiles((prev) => {
          const newProfiles = [...prev];
          const currentProfile = { ...newProfiles[selectedProfileIndex] };
          const currentTemplate = { ...currentProfile.templates[selectedTemplateIndex], headers: [...currentProfile.templates[selectedTemplateIndex].headers] };
          const newSections = [...currentTemplate.sections];
          newSections[sectionIndex].keys = newSections[sectionIndex].keys.filter((k) => k !== key);
          currentTemplate.sections = newSections;
          currentTemplate.headers = currentTemplate.headers.map((h) =>
            h.key === key ? { ...h, isUsed: false } : h
          );
          currentTemplate.isModified = true;
          currentTemplate.action = currentTemplate.action || "update";
          currentProfile.templates[selectedTemplateIndex] = currentTemplate;
          newProfiles[selectedProfileIndex] = currentProfile;
          return newProfiles;
        });
      }
    },
    [selectedProfileIndex, selectedTemplateIndex]
  );

  // Filter headers for search
  const filteredHeaders = useCallback(() => {
    if (selectedProfileIndex === null || selectedTemplateIndex === null || currentSectionIndex === null) return [];
    const profile = templateProfiles[selectedProfileIndex];
    const template = profile.templates[selectedTemplateIndex];

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
  }, [templateProfiles, selectedProfileIndex, selectedTemplateIndex, currentSectionIndex, searchQuery]);

  // Delete template
  const handleDeleteTemplate = useCallback(() => {
    if (selectedProfileIndex === null || selectedTemplateIndex === null) return;
    const profile = templateProfiles[selectedProfileIndex];
    const template = profile.templates[selectedTemplateIndex];
    const templateName = template.name;
    if (window.confirm(`Are you sure you want to delete the "${templateName}" template?`)) {
      setTemplateProfiles((prev) => {
        const newProfiles = [...prev];
        const currentProfile = { ...newProfiles[selectedProfileIndex] };
        currentProfile.templates = currentProfile.templates.map((template, i) =>
          i === selectedTemplateIndex
            ? { ...template, isModified: true, action: "remove" }
            : template
        );
        newProfiles[selectedProfileIndex] = currentProfile;
        return newProfiles;
      });
      setSelectedTemplateIndex(null);
      setEditMode(false);
      setNavigationDirection("backward");
      goToStep(2);
    }
  }, [selectedProfileIndex, selectedTemplateIndex, templateProfiles, goToStep]);

  // Edit header
  const handleEditHeader = useCallback(
    (index) => {
      if (selectedProfileIndex === null || selectedTemplateIndex === null) return;
      setActiveHeaderIndex(index);
      const profile = templateProfiles[selectedProfileIndex];
      const template = profile.templates[selectedTemplateIndex];
      const header = template.headers[index];
      setNewHeaderName(header.name);
      setNewHeaderType(header.type || "text");
      setNewHeaderSection(header.section || "");
      setNewHeaderOptions(header.options || []);
      setNavigationDirection("forward");
      goToStep(5);
    },
    [selectedProfileIndex, selectedTemplateIndex, templateProfiles, goToStep]
  );

  // Create new header
  const handleCreateHeader = useCallback(() => {
    if (selectedProfileIndex === null || selectedTemplateIndex === null || currentSectionIndex === null) return;
    setActiveHeaderIndex(-1);
    resetHeaderForm();
    const profile = templateProfiles[selectedProfileIndex];
    const template = profile.templates[selectedTemplateIndex];
    const currentSectionName = template.sections[currentSectionIndex].name;
    setNewHeaderSection(currentSectionName !== "Card Data" ? currentSectionName : "Primary Section");
    setNavigationDirection("forward");
    goToStep(6);
  }, [resetHeaderForm, goToStep, templateProfiles, selectedProfileIndex, selectedTemplateIndex, currentSectionIndex]);

  // Export cards for the current template
  const exportCards = useCallback(async () => {
    if (selectedProfileIndex === null || selectedTemplateIndex === null) {
      alert('No template selected.');
      return;
    }
    const profile = templateProfiles[selectedProfileIndex];
    const template = profile.templates[selectedTemplateIndex];
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
  }, [selectedProfileIndex, selectedTemplateIndex, templateProfiles, businessId]);






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
                  <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Create New Profile</h2>
                  <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Profiles help organize your card templates into logical groups.</p>
                  <div className={`${styles.configGrid} ${isDarkTheme ? styles.darkTheme : ""}`}>
                    <div
                      onClick={() => setShowProfileForm(true)}
                      className={`${styles.configCard} ${isDarkTheme ? styles.darkTheme : ""}`}
                      role="button"
                      aria-label="Add New Profile"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setShowProfileForm(true);
                        }
                      }}
                    >
                      <div className={`${styles.cardIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                        <FaPlus size={24} />
                      </div>
                      <div className={styles.cardContent}>
                        <h3 className={`${styles.cardTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>New Profile</h3>
                        <p className={`${styles.cardDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Create a new profile to group your templates</p>
                      </div>
                      <div className={`${styles.cardArrow} ${isDarkTheme ? styles.darkTheme : ""}`}>
                        <IoChevronForward size={16} />
                      </div>
                    </div>
                  </div>
                  
                  {showProfileForm && (
                    <div className={`${styles.formSection} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      <h3 className={`${styles.formTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Create New Profile</h3>
                      <input
                        type="text"
                        value={newProfileName}
                        onChange={(e) => setNewProfileName(e.target.value)}
                        placeholder="Profile Name"
                        className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ""}`}
                        autoFocus
                      />
                      <div className={styles.formActions}>
                        <button
                          onClick={() => {
                            setShowProfileForm(false);
                            setNewProfileName("");
                          }}
                          className={`${styles.secondaryButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={createNewProfile}
                          className={`${styles.primaryButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                          disabled={!newProfileName.trim()}
                        >
                          Create Profile
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                {templateProfiles.length > 0 && (
                  <div className={styles.section}>
                    <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Your Profiles</h2>
                    <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Select a profile to manage its templates.</p>
                    <div className={`${styles.configGrid} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      {templateProfiles
                        .map((profile, originalIndex) => ({ profile, originalIndex }))
                        .filter(({ profile }) => profile.action !== "remove")
                        .map(({ profile, originalIndex }) => (
                        <div
                          key={profile.id}
                          className={`${styles.configCard} ${isDarkTheme ? styles.darkTheme : ""}`}
                          role="button"
                          aria-label={`Open ${profile.name}`}
                          tabIndex={0}
                        >
                          <div className={`${styles.cardIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                            <FaLayerGroup size={24} />
                          </div>
                          <div 
                            className={styles.cardContent}
                            onClick={() => editingProfileIndex !== originalIndex && selectProfile(originalIndex)}
                            onKeyDown={(e) => {
                              if ((e.key === "Enter" || e.key === " ") && editingProfileIndex !== originalIndex) {
                                selectProfile(originalIndex);
                              }
                            }}
                          >
                            {editingProfileIndex === originalIndex ? (
                              <div className={styles.editingContent}>
                                <input
                                  type="text"
                                  value={editingProfileName}
                                  onChange={(e) => setEditingProfileName(e.target.value)}
                                  className={`${styles.profileNameInput} ${isDarkTheme ? styles.darkTheme : ""}`}
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => {
                                    e.stopPropagation();
                                    if (e.key === 'Enter') {
                                      saveProfileName();
                                    } else if (e.key === 'Escape') {
                                      cancelEditingProfile();
                                    }
                                  }}
                                  autoFocus
                                />
                                <div className={styles.editActions}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      saveProfileName();
                                    }}
                                    className={`${styles.saveButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                                    disabled={!editingProfileName.trim()}
                                  >
                                    <FaCheck size={12} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      cancelEditingProfile();
                                    }}
                                    className={`${styles.cancelButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                                  >
                                    <FaTimes size={12} />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <h3 className={`${styles.cardTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>{profile.name}</h3>
                                <p className={`${styles.cardDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>
                                  {getProfileTemplates(originalIndex).length} template{getProfileTemplates(originalIndex).length !== 1 ? 's' : ''}
                                </p>
                              </>
                            )}
                          </div>
                          {editingProfileIndex !== originalIndex && (
                            <>
                              <div className={`${styles.cardArrow} ${isDarkTheme ? styles.darkTheme : ""}`}>
                                <IoChevronForward size={16} />
                              </div>
                              <div className={styles.profileActions}>
                                <div 
                                  className={`${styles.editButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditingProfile(originalIndex);
                                  }}
                                >
                                  <FaEdit size={12} />
                                </div>
                                <div 
                                  className={`${styles.profileDeleteButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteProfile(originalIndex);
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
                {selectedProfileIndex !== null && templateProfiles[selectedProfileIndex] && templateProfiles[selectedProfileIndex].action !== "remove" ? (
                  <>
                    <div className={styles.section}>
                      <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Create New Template</h2>
                      <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Start building your card data structure in {templateProfiles[selectedProfileIndex].name}.</p>
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
                    
                    {getProfileTemplates(selectedProfileIndex).length > 0 && (
                      <div className={styles.section}>
                        <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Your Templates</h2>
                        <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Manage and edit your existing card templates in {templateProfiles[selectedProfileIndex].name}.</p>
                        <div className={`${styles.configGrid} ${isDarkTheme ? styles.darkTheme : ""}`}>
                          {getProfileTemplates(selectedProfileIndex).map((template, index) => (
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
                      <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Profile Pipelines</h2>
                      <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Create pipelines to automatically move cards between templates in {templateProfiles[selectedProfileIndex].name}.</p>
                      
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
                              {getProfileTemplates(selectedProfileIndex).map((template) => (
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
                              {getProfileTemplates(selectedProfileIndex).map((template) => (
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
                              onClick={editingPipelineIndex !== null ? updateProfilePipeline : addProfilePipeline}
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
                      {getProfilePipelines(selectedProfileIndex).length > 0 && (
                        <div className={styles.existingPipelines}>
                          <h3 className={`${styles.subsectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Existing Pipelines</h3>
                          <div className={`${styles.configGrid} ${isDarkTheme ? styles.darkTheme : ""}`}>
                            {getProfilePipelines(selectedProfileIndex).map((pipeline, index) => {
                              const sourceTemplate = getProfileTemplates(selectedProfileIndex).find(t => t.docId === pipeline.sourceTemplateId);
                              const targetTemplate = getProfileTemplates(selectedProfileIndex).find(t => t.docId === pipeline.targetTemplateId);
                              
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
                                      onClick={() => editProfilePipeline(index)}
                                      className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                                      aria-label="Edit pipeline"
                                    >
                                      <IoCreate size={16} />
                                    </button>
                                    <button
                                      onClick={() => deleteProfilePipeline(index)}
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
                    <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>No Profile Selected</h2>
                    <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Please select a profile first to manage templates.</p>
                  </div>
                )}
              </>
            )}

            {step === 3 && (
              <>
                {selectedTemplateIndex !== null && templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex] ? (
                  <>
                    <div className={styles.section}>
                      <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Template Details</h2>
                      <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Configure your template name and structure.</p>
                      <input
                        type="text"
                        value={templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex].name || ""}
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
                        {templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex].sections.map((section, index) => (
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
              templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex]?.sections[currentSectionIndex] && (
              <>
                <div className={styles.section}>
                  <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Section Configuration</h2>
                  <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>Customize the section name and manage its fields.</p>
                  <input
                    type="text"
                    value={templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex].sections[currentSectionIndex].name || ""}
                    onChange={(e) => updateSectionName(currentSectionIndex, e.target.value)}
                    className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ""}`}
                    placeholder="Section Name"
                    disabled={templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex].sections[currentSectionIndex].name === "Card Data" || !editMode}
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
                    {templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex].sections[currentSectionIndex].keys.map((key, index) => {
                      const header = templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex].headers.find((h) => h.key === key) || {
                        key,
                        name: key,
                        type: "text",
                      };
                      const headerIndex = templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex].headers.findIndex((h) => h.key === key);
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
                                  {templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex].sections[currentSectionIndex].keys.includes(
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
                      const headerIndex = templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex].headers.findIndex(
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
                                  {templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex].sections[currentSectionIndex].keys.includes(
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
                      disabled={templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex].sections[currentSectionIndex].name === "Card Data"}
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
              templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex]?.headers[activeHeaderIndex] && (
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
                      disabled={['docId', 'typeOfCards', 'typeOfProfile', 'assignedTo'].includes(templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex].headers[activeHeaderIndex].key)}
                      tabIndex={['docId', 'typeOfCards', 'typeOfProfile', 'assignedTo'].includes(templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex].headers[activeHeaderIndex].key) ? -1 : 0}
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
                          navigator.clipboard.writeText(templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex].headers[activeHeaderIndex].key);
                          setCopiedHeaderId(true);
                          setTimeout(() => setCopiedHeaderId(false), 1200);
                        }}
                        className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ""}`}
                        style={{ width: "100%", marginBottom: 12 }}
                      >
                        {copiedHeaderId ? "Copied!" : "Copy Header Key"}
                      </button>
                      {templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex].headers[activeHeaderIndex].key !== "docId" &&
                        templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex].headers[activeHeaderIndex].key !== "typeOfCards" &&
                        templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex].headers[activeHeaderIndex].key !== "assignedTo" && (
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
                      {templateProfiles[selectedProfileIndex]?.templates[selectedTemplateIndex].sections
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
    templateProfiles: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string,
        templates: PropTypes.arrayOf(
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
        pipelines: PropTypes.arrayOf(PropTypes.object),
        isModified: PropTypes.bool,
        action: PropTypes.oneOf(["add", "update", "remove", null]),
      })
    ),
    deletedHeaderKeys: PropTypes.arrayOf(PropTypes.string),
    hasProfileChanges: PropTypes.bool,
  }).isRequired,
  setTempData: PropTypes.func.isRequired,
  businessId: PropTypes.string,
};

export default CardsTemplate;

// Reminder: In exportCards and any other card export logic, ensure to use 'docId' instead of 'id' for the unique identifier.
// If you see any mapping like { id: doc.id, ...doc.data() }, change it to { docId: doc.id, ...doc.data() }