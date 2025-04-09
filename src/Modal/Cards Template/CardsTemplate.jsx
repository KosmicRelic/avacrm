import { useContext, useState, useCallback, useRef, useEffect } from "react";
import styles from "./CardsTemplate.module.css";
import { MainContext } from "../../Contexts/MainContext";
import { FaPlus } from "react-icons/fa";

const CardsTemplate = () => {
  const { headers, cardTemplates, setCardTemplates, isDarkTheme } = useContext(MainContext);
  const [view, setView] = useState("list"); // "list" or "editor"
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateName, setTemplateName] = useState("");
  const [sections, setSections] = useState([{ name: "General", keys: [] }]); // Sections with names and keys
  const [draggedIndex, setDraggedIndex] = useState(null);
  const dragItemRef = useRef(null);

  const availableHeaders = headers.map((h) => ({
    key: Object.keys(h)[0],
    name: Object.values(h)[0],
    type: h.type,
  }));

  const handleOpenEditor = useCallback((template = null) => {
    setSelectedTemplate(template);
    setTemplateName(template ? template.name : "");
    setSections(template ? convertKeysToSections(template.keys) : [{ name: "General", keys: [] }]);
    setIsAnimating(true);
    setTimeout(() => {
      setView("editor");
      setIsAnimating(false);
    }, 300); // Match animation duration
  }, []);

  const handleCloseEditor = useCallback(() => {
    setIsAnimating(true);
    setTimeout(() => {
      setView("list");
      setSelectedTemplate(null);
      setTemplateName("");
      setSections([{ name: "General", keys: [] }]);
      setIsAnimating(false);
    }, 300); // Match animation duration
  }, []);

  const convertKeysToSections = (keys) => {
    return [{ name: "General", keys: keys || [] }];
  };

  const handleSaveTemplate = useCallback(() => {
    if (!templateName) {
      alert("Please provide a template name.");
      return;
    }
    const allKeys = sections.flatMap((section) => section.keys);
    if (allKeys.length === 0) {
      alert("Please select at least one header.");
      return;
    }

    setCardTemplates((prev) => {
      if (selectedTemplate) {
        return prev.map((t) =>
          t.name === selectedTemplate.name
            ? { ...t, name: templateName, keys: allKeys }
            : t
        );
      }
      return [...prev, { name: templateName, keys: allKeys }];
    });
    handleCloseEditor();
  }, [templateName, sections, selectedTemplate, setCardTemplates, handleCloseEditor]);

  const handleDeleteTemplate = useCallback(() => {
    if (!selectedTemplate) return;
    if (window.confirm(`Are you sure you want to delete the "${selectedTemplate.name}" template?`)) {
      setCardTemplates((prev) => prev.filter((t) => t.name !== selectedTemplate.name));
      handleCloseEditor();
    }
  }, [selectedTemplate, setCardTemplates, handleCloseEditor]);

  const toggleKeySelection = useCallback((sectionIndex, key) => {
    setSections((prev) =>
      prev.map((section, idx) =>
        idx === sectionIndex
          ? {
              ...section,
              keys: section.keys.includes(key)
                ? section.keys.filter((k) => k !== key)
                : [...section.keys, key],
            }
          : section
      )
    );
  }, []);

  const addSection = useCallback(() => {
    setSections((prev) => [...prev, { name: `Section ${prev.length + 1}`, keys: [] }]);
  }, []);

  const updateSectionName = useCallback((index, newName) => {
    setSections((prev) =>
      prev.map((section, idx) =>
        idx === index ? { ...section, name: newName.trim() || `Section ${idx + 1}` } : section
      )
    );
  }, []);

  const handleDragStart = useCallback((e, sectionIndex, headerIndex) => {
    setDraggedIndex({ sectionIndex, headerIndex });
    dragItemRef.current = e.target.closest(`.${styles.keyItem}`);
    dragItemRef.current.classList.add(styles.dragging);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e, sectionIndex, headerIndex) => {
    e.preventDefault();
    if (
      draggedIndex === null ||
      (draggedIndex.sectionIndex === sectionIndex && draggedIndex.headerIndex === headerIndex)
    )
      return;

    setSections((prev) => {
      const newSections = [...prev];
      const section = newSections[sectionIndex];
      const [draggedItem] = section.keys.splice(draggedIndex.headerIndex, 1);
      section.keys.splice(headerIndex, 0, draggedItem);
      setDraggedIndex({ sectionIndex, headerIndex });
      return newSections;
    });
  }, [draggedIndex]);

  const handleDragEnd = useCallback(() => {
    if (dragItemRef.current) {
      dragItemRef.current.classList.remove(styles.dragging);
    }
    setDraggedIndex(null);
  }, []);

  return (
    <div className={`${styles.templateWrapper} ${isDarkTheme ? styles.darkTheme : ""}`}>
      <div className={styles.viewContainer}>
        {view === "list" && (
          <div className={`${styles.view} ${isDarkTheme ? styles.darkTheme : ""}`}>
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
          </div>
        )}
        {view === "editor" && (
          <div
            className={`${styles.view} ${isDarkTheme ? styles.darkTheme : ""} ${
              isAnimating ? styles.slideOutRight : styles.slideInRight
            }`}
          >
            <h2 className={`${styles.modalTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>
              {selectedTemplate ? "Edit Card Template" : "New Card Template"}
            </h2>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template Name"
              className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ""}`}
            />
            <div className={styles.sections}>
              {sections.map((section, sectionIndex) => (
                <div key={sectionIndex} className={styles.section}>
                  <input
                    type="text"
                    value={section.name}
                    onChange={(e) => updateSectionName(sectionIndex, e.target.value)}
                    className={`${styles.sectionInput} ${isDarkTheme ? styles.darkTheme : ""}`}
                    placeholder="Section Name"
                  />
                  <div className={styles.keyList}>
                    {section.keys.map((key, headerIndex) => {
                      const header = availableHeaders.find((h) => h.key === key);
                      return (
                        <div
                          key={header.key}
                          className={`${styles.keyItem} ${isDarkTheme ? styles.darkTheme : ""} ${
                            draggedIndex?.sectionIndex === sectionIndex &&
                            draggedIndex?.headerIndex === headerIndex
                              ? styles.dragging
                              : ""
                          }`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, sectionIndex, headerIndex)}
                          onDragOver={(e) => handleDragOver(e, sectionIndex, headerIndex)}
                          onDragEnd={handleDragEnd}
                        >
                          <span className={styles.dragIcon}>☰</span>
                          <label className={styles.headerLabel}>
                            <input
                              type="checkbox"
                              checked={section.keys.includes(header.key)}
                              onChange={() => toggleKeySelection(sectionIndex, header.key)}
                            />
                            {header.name} ({header.type})
                          </label>
                        </div>
                      );
                    })}
                    {availableHeaders
                      .filter((header) => !section.keys.includes(header.key))
                      .map((header) => (
                        <div
                          key={header.key}
                          className={`${styles.keyItem} ${isDarkTheme ? styles.darkTheme : ""}`}
                        >
                          <span className={styles.dragIcon}>☰</span>
                          <label className={styles.headerLabel}>
                            <input
                              type="checkbox"
                              checked={section.keys.includes(header.key)}
                              onChange={() => toggleKeySelection(sectionIndex, header.key)}
                            />
                            {header.name} ({header.type})
                          </label>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
              <button
                className={`${styles.addSectionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                onClick={addSection}
              >
                + Add Section
              </button>
            </div>
            <div className={styles.modalButtons}>
              {selectedTemplate && (
                <button
                  className={`${styles.deleteButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                  onClick={handleDeleteTemplate}
                >
                  Delete
                </button>
              )}
              <button
                className={`${styles.cancelButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                onClick={handleCloseEditor}
              >
                Cancel
              </button>
              <button
                className={`${styles.saveButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                onClick={handleSaveTemplate}
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CardsTemplate;