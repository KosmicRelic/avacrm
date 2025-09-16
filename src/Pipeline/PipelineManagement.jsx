import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import styles from './PipelineManagement.module.css';
import { IoAdd, IoGitBranch, IoCreate, IoTrash, IoCheckmark, IoClose } from 'react-icons/io5';
import { updateCardTemplatesAndCardsFunction } from '../Firebase/Firebase Functions/User Functions/updateCardTemplatesAndCardsFunction';

const PipelineManagement = ({ 
  templateEntities, 
  setTemplateEntities, 
  isDarkTheme, 
  businessId 
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPipelineId, setEditingPipelineId] = useState(null);
  const [newPipelineName, setNewPipelineName] = useState("");
  const [sourceTemplate, setSourceTemplate] = useState("");
  const [targetTemplate, setTargetTemplate] = useState("");
  const [fieldMappings, setFieldMappings] = useState([]);
  const [selectedEntityId, setSelectedEntityId] = useState("");

  // Save changes to backend
  const saveEntitiesToBackend = useCallback(async (updatedEntities) => {
    if (!businessId) {
      console.error('No business ID provided');
      return false;
    }

    try {
      await updateCardTemplatesAndCardsFunction({
        businessId,
        entities: updatedEntities,
      });
      return true;
    } catch (error) {
      console.error('Failed to save entities to backend:', error);
      alert('Failed to save changes. Please try again.');
      return false;
    }
  }, [businessId]);

  // Get all templates across all entities for dropdown selection
  const getAllTemplates = useCallback(() => {
    const templates = [];
    templateEntities.forEach(entity => {
      if (entity.templates && Array.isArray(entity.templates)) {
        entity.templates.forEach(template => {
          templates.push({
            ...template,
            entityName: entity.name,
            entityId: entity.id
          });
        });
      }
    });
    return templates;
  }, [templateEntities]);

  const allTemplates = getAllTemplates();

  // Get all pipelines across all entities
  const getAllPipelines = useCallback(() => {
    const pipelines = [];
    templateEntities.forEach(entity => {
      if (entity.pipelines && Array.isArray(entity.pipelines)) {
        entity.pipelines.forEach(pipeline => {
          pipelines.push({
            ...pipeline,
            entityName: entity.name,
            entityId: entity.id
          });
        });
      }
    });
    return pipelines;
  }, [templateEntities]);

  const allPipelines = getAllPipelines();

  // Add field mapping
  const addFieldMapping = useCallback(() => {
    setFieldMappings(prev => [...prev, { source: "", target: "" }]);
  }, []);

  // Remove field mapping
  const removeFieldMapping = useCallback((index) => {
    setFieldMappings(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Update field mapping
  const updateFieldMapping = useCallback((index, field, value) => {
    setFieldMappings(prev => prev.map((mapping, i) => 
      i === index ? { ...mapping, [field]: value } : mapping
    ));
  }, []);

  // Get source template headers
  const getSourceTemplateHeaders = useCallback(() => {
    if (!sourceTemplate) return [];
    const template = allTemplates.find(t => t.typeOfCards === sourceTemplate);
    return template?.headers?.filter(h => h.key !== 'docId' && h.key !== 'typeOfCards') || [];
  }, [sourceTemplate, allTemplates]);

  // Get target template headers
  const getTargetTemplateHeaders = useCallback(() => {
    if (!targetTemplate) return [];
    const template = allTemplates.find(t => t.typeOfCards === targetTemplate);
    return template?.headers?.filter(h => h.key !== 'docId' && h.key !== 'typeOfCards') || [];
  }, [targetTemplate, allTemplates]);

  // Reset form
  const resetForm = useCallback(() => {
    setNewPipelineName("");
    setSourceTemplate("");
    setTargetTemplate("");
    setFieldMappings([]);
    setSelectedEntityId("");
    setShowCreateForm(false);
    setEditingPipelineId(null);
  }, []);

  // Handle create/edit pipeline
  const handleSavePipeline = useCallback(async () => {
    if (!newPipelineName.trim() || !sourceTemplate || !targetTemplate || !selectedEntityId) {
      alert("Please fill in all required fields (name, source template, target template, and entity).");
      return;
    }

    if (fieldMappings.length === 0) {
      alert("Please add at least one field mapping.");
      return;
    }

    const isValidMapping = fieldMappings.every(mapping => 
      mapping.source && mapping.target
    );

    if (!isValidMapping) {
      alert("Please complete all field mappings.");
      return;
    }

    const pipelineData = {
      id: editingPipelineId || `pipeline_${Date.now()}`,
      name: newPipelineName.trim(),
      sourceTemplate,
      targetTemplate,
      fieldMappings: fieldMappings.map(mapping => ({
        source: mapping.source,
        target: mapping.target
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updatedEntities = templateEntities.map(entity => {
      if (entity.id === selectedEntityId) {
        const pipelines = entity.pipelines || [];
        
        if (editingPipelineId) {
          // Edit existing pipeline
          const updatedPipelines = pipelines.map(p => 
            p.id === editingPipelineId ? pipelineData : p
          );
          return { ...entity, pipelines: updatedPipelines };
        } else {
          // Add new pipeline
          return { ...entity, pipelines: [...pipelines, pipelineData] };
        }
      }
      return entity;
    });

    // Save to backend
    const saveSuccess = await saveEntitiesToBackend(updatedEntities);
    
    if (saveSuccess) {
      setTemplateEntities(updatedEntities);
      resetForm();
      alert(editingPipelineId ? "Pipeline updated successfully!" : "Pipeline created successfully!");
    }
  }, [
    newPipelineName, 
    sourceTemplate, 
    targetTemplate, 
    selectedEntityId, 
    fieldMappings, 
    editingPipelineId, 
    templateEntities,
    saveEntitiesToBackend,
    setTemplateEntities, 
    resetForm
  ]);

  // Handle edit pipeline
  const handleEditPipeline = useCallback((pipeline) => {
    setEditingPipelineId(pipeline.id);
    setNewPipelineName(pipeline.name);
    setSourceTemplate(pipeline.sourceTemplate);
    setTargetTemplate(pipeline.targetTemplate);
    setFieldMappings(pipeline.fieldMappings || []);
    setSelectedEntityId(pipeline.entityId);
    setShowCreateForm(true);
  }, []);

  // Handle delete pipeline
  const handleDeletePipeline = useCallback(async (pipelineId, entityId, pipelineName) => {
    if (window.confirm(`Are you sure you want to delete the pipeline "${pipelineName}"? This action cannot be undone.`)) {
      const updatedEntities = templateEntities.map(entity => {
        if (entity.id === entityId) {
          const updatedPipelines = (entity.pipelines || []).filter(p => p.id !== pipelineId);
          return { ...entity, pipelines: updatedPipelines };
        }
        return entity;
      });

      // Save to backend
      const saveSuccess = await saveEntitiesToBackend(updatedEntities);
      
      if (saveSuccess) {
        setTemplateEntities(updatedEntities);
        alert("Pipeline deleted successfully!");
      }
    }
  }, [templateEntities, saveEntitiesToBackend, setTemplateEntities]);

  // Update field mappings when templates change
  useEffect(() => {
    if (sourceTemplate && targetTemplate) {
      const sourceHeaders = getSourceTemplateHeaders();
      const targetHeaders = getTargetTemplateHeaders();
      
      if (fieldMappings.length === 0 && sourceHeaders.length > 0 && targetHeaders.length > 0) {
        // Add one default mapping
        addFieldMapping();
      }
    }
  }, [sourceTemplate, targetTemplate, getSourceTemplateHeaders, getTargetTemplateHeaders, fieldMappings.length, addFieldMapping]);

  return (
    <div className={`${styles.pipelineManagement} ${isDarkTheme ? styles.darkTheme : ""}`}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <IoGitBranch className={styles.headerIcon} size={24} />
          <div>
            <h2 className={`${styles.title} ${isDarkTheme ? styles.darkTheme : ""}`}>Pipeline Management</h2>
            <p className={`${styles.subtitle} ${isDarkTheme ? styles.darkTheme : ""}`}>
              Create automated card conversion workflows between templates
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className={`${styles.createButton} ${isDarkTheme ? styles.darkTheme : ""}`}
        >
          <IoAdd size={20} />
          Create Pipeline
        </button>
      </div>

      {/* Pipeline List */}
      <div className={styles.pipelineList}>
        {allPipelines.length === 0 ? (
          <div className={`${styles.emptyState} ${isDarkTheme ? styles.darkTheme : ""}`}>
            <IoGitBranch size={48} className={styles.emptyIcon} />
            <h3 className={`${styles.emptyTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>No Pipelines Yet</h3>
            <p className={`${styles.emptyDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>
              Create your first pipeline to start automating card conversions between templates.
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className={`${styles.emptyButton} ${isDarkTheme ? styles.darkTheme : ""}`}
            >
              <IoAdd size={16} />
              Create Your First Pipeline
            </button>
          </div>
        ) : (
          <div className={styles.pipelineGrid}>
            {allPipelines.map((pipeline) => {
              const sourceTemplateObj = allTemplates.find(t => t.typeOfCards === pipeline.sourceTemplate);
              const targetTemplateObj = allTemplates.find(t => t.typeOfCards === pipeline.targetTemplate);
              
              return (
                <div key={pipeline.id} className={`${styles.pipelineCard} ${isDarkTheme ? styles.darkTheme : ""}`}>
                  <div className={styles.pipelineHeader}>
                    <h3 className={`${styles.pipelineName} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      {pipeline.name}
                    </h3>
                    <div className={styles.pipelineActions}>
                      <button
                        onClick={() => handleEditPipeline(pipeline)}
                        className={`${styles.actionButton} ${styles.editButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                        title="Edit Pipeline"
                      >
                        <IoCreate size={16} />
                      </button>
                      <button
                        onClick={() => handleDeletePipeline(pipeline.id, pipeline.entityId, pipeline.name)}
                        className={`${styles.actionButton} ${styles.deleteButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                        title="Delete Pipeline"
                      >
                        <IoTrash size={16} />
                      </button>
                    </div>
                  </div>
                  
                  <div className={styles.pipelineFlow}>
                    <div className={`${styles.templateBox} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      <span className={styles.templateName}>
                        {sourceTemplateObj?.name || pipeline.sourceTemplate}
                      </span>
                      <span className={styles.entityTag}>
                        {pipeline.entityName}
                      </span>
                    </div>
                    <div className={`${styles.flowArrow} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      →
                    </div>
                    <div className={`${styles.templateBox} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      <span className={styles.templateName}>
                        {targetTemplateObj?.name || pipeline.targetTemplate}
                      </span>
                      <span className={styles.entityTag}>
                        {targetTemplateObj?.entityName || 'Unknown'}
                      </span>
                    </div>
                  </div>

                  <div className={styles.mappingInfo}>
                    <span className={`${styles.mappingCount} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      {pipeline.fieldMappings?.length || 0} field mapping{(pipeline.fieldMappings?.length || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Form Modal */}
      {showCreateForm && (
        <div className={`${styles.modal} ${isDarkTheme ? styles.darkTheme : ""}`}>
          <div className={`${styles.modalContent} ${isDarkTheme ? styles.darkTheme : ""}`}>
            <div className={styles.modalHeader}>
              <h3 className={`${styles.modalTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>
                {editingPipelineId ? 'Edit Pipeline' : 'Create New Pipeline'}
              </h3>
              <button
                onClick={resetForm}
                className={`${styles.closeButton} ${isDarkTheme ? styles.darkTheme : ""}`}
              >
                <IoClose size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formGrid}>
                <div className={styles.inputGroup}>
                  <label className={`${styles.fieldLabel} ${isDarkTheme ? styles.darkTheme : ""}`}>
                    Pipeline Name *
                  </label>
                  <input
                    type="text"
                    value={newPipelineName}
                    onChange={(e) => setNewPipelineName(e.target.value)}
                    placeholder="e.g., Lead to Customer"
                    className={`${styles.inputField} ${isDarkTheme ? styles.darkTheme : ""}`}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label className={`${styles.fieldLabel} ${isDarkTheme ? styles.darkTheme : ""}`}>
                    Entity *
                  </label>
                  <select
                    value={selectedEntityId}
                    onChange={(e) => setSelectedEntityId(e.target.value)}
                    className={`${styles.selectField} ${isDarkTheme ? styles.darkTheme : ""}`}
                  >
                    <option value="">Select entity...</option>
                    {templateEntities.map((entity) => (
                      <option key={entity.id} value={entity.id}>
                        {entity.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.inputGroup}>
                  <label className={`${styles.fieldLabel} ${isDarkTheme ? styles.darkTheme : ""}`}>
                    Source Template *
                  </label>
                  <select
                    value={sourceTemplate}
                    onChange={(e) => setSourceTemplate(e.target.value)}
                    className={`${styles.selectField} ${isDarkTheme ? styles.darkTheme : ""}`}
                  >
                    <option value="">Select source template...</option>
                    {allTemplates.map((template) => (
                      <option key={template.docId} value={template.typeOfCards}>
                        {template.name} ({template.entityName})
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.inputGroup}>
                  <label className={`${styles.fieldLabel} ${isDarkTheme ? styles.darkTheme : ""}`}>
                    Target Template *
                  </label>
                  <select
                    value={targetTemplate}
                    onChange={(e) => setTargetTemplate(e.target.value)}
                    className={`${styles.selectField} ${isDarkTheme ? styles.darkTheme : ""}`}
                  >
                    <option value="">Select target template...</option>
                    {allTemplates
                      .filter(template => template.typeOfCards !== sourceTemplate)
                      .map((template) => (
                        <option key={template.docId} value={template.typeOfCards}>
                          {template.name} ({template.entityName})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {sourceTemplate && targetTemplate && (
                <div className={styles.fieldMappingsSection}>
                  <div className={styles.fieldMappingsHeader}>
                    <label className={`${styles.fieldLabel} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      Field Mappings *
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
                    {fieldMappings.map((mapping, index) => (
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
                  </div>
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                onClick={resetForm}
                className={`${styles.cancelButton} ${isDarkTheme ? styles.darkTheme : ""}`}
              >
                Cancel
              </button>
              <button
                onClick={handleSavePipeline}
                className={`${styles.saveButton} ${isDarkTheme ? styles.darkTheme : ""}`}
              >
                <IoCheckmark size={16} />
                {editingPipelineId ? 'Update Pipeline' : 'Create Pipeline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

PipelineManagement.propTypes = {
  templateEntities: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      templates: PropTypes.array,
      pipelines: PropTypes.array,
    })
  ).isRequired,
  setTemplateEntities: PropTypes.func.isRequired,
  isDarkTheme: PropTypes.bool,
  businessId: PropTypes.string,
};

export default PipelineManagement;