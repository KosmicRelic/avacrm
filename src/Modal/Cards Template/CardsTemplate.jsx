import { useContext, useState, useCallback } from "react";
import PropTypes from "prop-types";
import styles from "./CardsTemplate.module.css";
import { MainContext } from "../../Contexts/MainContext";
import { FaPlus } from "react-icons/fa";
import { IoIosCheckmark } from "react-icons/io";

const CardsTemplate = ({ tempData, setTempData }) => {
  const { headers, cardTemplates, setCardTemplates, isDarkTheme } = useContext(MainContext);
  const [view, setView] = useState("list");
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateName, setTemplateName] = useState("");
  const [sections, setSections] = useState([{ name: "", keys: [] }]);

  const availableHeaders = headers.map((h) => ({
    key: h.key,
    name: h.name,
    type: h.type,
  }));

  const handleOpenEditor = useCallback((template = null) => {
    try {
      setSelectedTemplate(template);
      setTemplateName(template ? template.name : "");
      setSections(template ? convertKeysToSections(template.keys) : [{ name: "", keys: [] }]);
      setIsAnimating(true);
      setTimeout(() => {
        setView("editor");
        setIsAnimating(false);
      }, 300);
    } catch (error) {
      console.error("Error in handleOpenEditor:", error);
    }
  }, []);

  const handleCloseEditor = useCallback(() => {
    setIsAnimating(true);
    setTimeout(() => {
      setView("list");
      setSelectedTemplate(null);
      setTemplateName("");
      setSections([{ name: "", keys: [] }]);
      setIsAnimating(false);
    }, 300);
  }, []);

  const convertKeysToSections = (keys) => {
    const validKeys = (keys || []).filter((key) => availableHeaders.some((h) => h.key === key));
    return [{ name: "", keys: validKeys }];
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
          t.name === selectedTemplate.name ? { ...t, name: templateName, keys: allKeys } : t
        );
      }
      const existingNames = prev.map((t) => t.name);
      const uniqueName = existingNames.includes(templateName)
        ? `${templateName} (${Date.now()})`
        : templateName;
      return [...prev, { name: uniqueName, keys: allKeys }];
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
    setSections((prev) => {
      const newSections = [...prev];
      const section = { ...newSections[sectionIndex] };
      const isSelected = section.keys.includes(key);
      section.keys = isSelected
        ? section.keys.filter((k) => k !== key)
        : [...section.keys, key];
      newSections[sectionIndex] = section;
      return newSections;
    });
  }, []);

  const addSection = useCallback(() => {
    setSections((prev) => [...prev, { name: "", keys: [] }]);
  }, []);

  const updateSectionName = useCallback((index, newName) => {
    setSections((prev) =>
      prev.map((section, idx) => (idx === index ? { ...section, name: newName } : section))
    );
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
            {!selectedTemplate && (
              <h2 className={`${styles.modalTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>
                New Card Template
              </h2>
            )}
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
                    placeholder={`Section ${sectionIndex + 1}`}
                  />
                  <div className={styles.keyList}>
                    {section.keys.map((key, headerIndex) => {
                      const header = availableHeaders.find((h) => h.key === key) || {
                        key,
                        name: key,
                        type: "text",
                      };
                      return (
                        <div
                          key={`selected-${header.key}-${sectionIndex}-${headerIndex}`}
                          className={`${styles.keyItem} ${isDarkTheme ? styles.darkTheme : ""}`}
                        >
                          <div
                            className={styles.headerContent}
                            onClick={() => toggleKeySelection(sectionIndex, header.key)}
                          >
                            <span
                              className={`${styles.customCheckbox} ${
                                section.keys.includes(header.key) ? styles.checked : ""
                              } ${isDarkTheme ? styles.darkTheme : ""}`}
                            >
                              <IoIosCheckmark
                                style={{
                                  color: section.keys.includes(header.key)
                                    ? "#ffffff"
                                    : "transparent",
                                }}
                                size={18}
                              />
                            </span>
                            <span className={styles.headerName}>{header.name}</span>
                            <span className={styles.headerType}>({header.type})</span>
                          </div>
                          <span
                            className={`${styles.dragIcon} ${isDarkTheme ? styles.darkTheme : ""}`}
                          >
                            ☰
                          </span>
                        </div>
                      );
                    })}
                    {availableHeaders
                      .filter(
                        (header) => !sections.some((sec) => sec.keys.includes(header.key))
                      )
                      .map((header, headerIndex) => (
                        <div
                          key={`available-${header.key}-${sectionIndex}-${headerIndex}`}
                          className={`${styles.keyItem} ${isDarkTheme ? styles.darkTheme : ""}`}
                        >
                          <div
                            className={styles.headerContent}
                            onClick={() => toggleKeySelection(sectionIndex, header.key)}
                          >
                            <span
                              className={`${styles.customCheckbox} ${
                                section.keys.includes(header.key) ? styles.checked : ""
                              } ${isDarkTheme ? styles.darkTheme : ""}`}
                            >
                              <IoIosCheckmark
                                style={{
                                  color: section.keys.includes(header.key)
                                    ? "#ffffff"
                                    : "transparent",
                                }}
                                size={18}
                              />
                            </span>
                            <span className={styles.headerName}>{header.name}</span>
                            <span className={styles.headerType}>({header.type})</span>
                          </div>
                          <span
                            className={`${styles.dragIcon} ${isDarkTheme ? styles.darkTheme : ""}`}
                          >
                            ☰
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
              <button
                className={`${styles.addSectionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                onClick={addSection}
              >
                Add Section
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

CardsTemplate.propTypes = {
  tempData: PropTypes.object,
  setTempData: PropTypes.func,
};

export default CardsTemplate;