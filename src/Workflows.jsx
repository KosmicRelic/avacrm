import { useContext, useState, useEffect } from 'react';
import { MainContext } from './Contexts/MainContext';
import { collection, doc, setDoc, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import BackButton from './Components/Reusable Buttons/BackButton';
import styles from './Workflows.module.css';

const Workflows = () => {
  const { isDarkTheme, businessId, user } = useContext(MainContext);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [workflows, setWorkflows] = useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [showWorkflowEditor, setShowWorkflowEditor] = useState(false);

  // Set up real-time listener for workflows
  useEffect(() => {
    if (!businessId) return;

    const workflowsQuery = collection(db, 'businesses', businessId, 'workflows');

    const unsubscribe = onSnapshot(
      workflowsQuery,
      (snapshot) => {
        const workflowsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setWorkflows(workflowsData);
      },
      (error) => {
        console.error('Error listening to workflows:', error);
      }
    );

    return () => unsubscribe();
  }, [businessId, user?.uid]);

  // Hide app header when workflow editor is open (mobile)
  useEffect(() => {
    if (showWorkflowEditor) {
      document.body.classList.add('workflow-editor-open');
    } else {
      document.body.classList.remove('workflow-editor-open');
    }

    return () => {
      document.body.classList.remove('workflow-editor-open');
    };
  }, [showWorkflowEditor]);

  // Handle workflow selection
  const handleWorkflowClick = (workflow) => {
    setSelectedWorkflow(workflow);
    setShowWorkflowEditor(true);
  };

  // Handle back navigation
  const handleBackToWorkflows = () => {
    setShowWorkflowEditor(false);
    setSelectedWorkflow(null);
  };

  // Workflow Name Selection Modal Component
  const WorkflowNameModal = () => {
    const [workflowName, setWorkflowName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const handleCreate = async () => {
      if (workflowName.trim() && businessId && user && !isCreating) {
        setIsCreating(true);
        try {
          const workflowId = `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const workflowData = {
            name: workflowName.trim(),
            createdBy: user.uid,
            createdAt: Timestamp.now(),
            status: 'active',
            icon: '📝', // Default icon for workflow
          };

          await setDoc(doc(db, 'businesses', businessId, 'workflows', workflowId), workflowData);

          setShowWorkflowModal(false);
          setWorkflowName('');
          // The real-time listener will automatically update the workflows state
        } catch (error) {
          console.error('Error creating workflow:', error);
          // TODO: Show error message to user
        } finally {
          setIsCreating(false);
        }
      }
    };

    const handleClose = () => {
      setShowWorkflowModal(false);
      setWorkflowName('');
      setIsCreating(false);
    };

    // Handle escape key
    useEffect(() => {
      const handleEscape = (e) => {
        if (e.key === 'Escape' && showWorkflowModal) {
          handleClose();
        }
      };

      if (showWorkflowModal) {
        document.addEventListener('keydown', handleEscape);
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
      }

      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = 'auto';
      };
    }, [showWorkflowModal]);

    if (!showWorkflowModal) return null;

    return (
      <div
        className={`${styles.workflowModalOverlay} ${isDarkTheme ? styles.darkTheme : ''}`}
        onClick={handleClose}
      >
        <div
          className={`${styles.workflowModalContent} ${isDarkTheme ? styles.darkTheme : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.modalHeader}>
            <BackButton
              onClick={handleClose}
              isDarkTheme={isDarkTheme}
              showText={false}
              ariaLabel="Cancel"
              icon="x"
            />
            <h3 className={`${styles.modalTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>
              New Workflow
            </h3>
          </div>

          <div className={styles.modalBody}>
            <div className={styles.inputGroup}>
              <label className={`${styles.inputLabel} ${isDarkTheme ? styles.darkTheme : ''}`}>
                Workflow Name
              </label>
              <input
                type="text"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="e.g., Contact Form Leads"
                className={`${styles.workflowNameInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && workflowName.trim()) {
                    handleCreate();
                  }
                }}
              />
            </div>

            <div className={styles.modalActions}>
              <button
                onClick={handleCreate}
                disabled={!workflowName.trim() || isCreating}
                className={`${styles.createButton} ${isDarkTheme ? styles.darkTheme : ''}`}
              >
                {isCreating ? 'Creating...' : 'Create Workflow'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`${styles.workflowsContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
      {/* Back button when workflow is selected */}
      {selectedWorkflow && (
        <div className={styles.backButtonContainer}>
          <BackButton 
            onClick={handleBackToWorkflows} 
            isDarkTheme={isDarkTheme}
            ariaLabel="Back to Workflows"
          >
            <span>Workflows</span>
          </BackButton>
        </div>
      )}

      {/* Show workflow tabs only when no workflow is selected */}
      {!selectedWorkflow && (
        <div className={`${styles.workflowTabs} ${styles.workflowTabsFullWidth} ${isDarkTheme ? styles.darkTheme : ''}`}>
          <div className={`${styles.workflowsSection} ${isDarkTheme ? styles.darkTheme : ''}`}>
            <div className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>
              <span>Available Workflows</span>
            </div>
            <div className={styles.workflowsGrid}>
              {workflows.map((workflow) => (
                <div key={workflow.id} className={styles.workflowContainer}>
                  <button
                    className={`${styles.tabButton} ${selectedWorkflow?.id === workflow.id ? styles.activeTab : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                    onClick={() => handleWorkflowClick(workflow)}
                  >
                    <div className={styles.iconContainer}>
                      <span className={styles.workflowIcon}>{workflow.icon}</span>
                    </div>
                    <div className={styles.labelContainer}>
                      {workflow.name}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Show workflow editor when one is selected */}
      {showWorkflowEditor && selectedWorkflow && (
        <div className={`${styles.workflowEditor} ${isDarkTheme ? styles.darkTheme : ''}`}>
          <div className={styles.workflowEditorContent}>
            <h2>{selectedWorkflow.name}</h2>
            <p>Status: {selectedWorkflow.status}</p>
            {/* TODO: Add workflow configuration UI here */}
          </div>
        </div>
      )}

      {/* Show the select message and create button only when no workflow is selected */}
      {!selectedWorkflow && (
        <>
          <div className={styles.selectWorkflowMessage + (isDarkTheme ? ' ' + styles.darkTheme : '')}>
            <div className={styles.selectWorkflowTitle}>Select a workflow</div>
            <div className={styles.selectWorkflowSubtitle}>Tap a workflow tab to get started</div>
          </div>
          <div className={styles.workflowActions}>
            <button
              className={`${styles.createWorkflowButton} ${isDarkTheme ? styles.darkTheme : ''}`}
              onClick={() => setShowWorkflowModal(true)}
            >
              New Workflow
            </button>
          </div>
        </>
      )}

      <WorkflowNameModal />
    </div>
  );
};

export default Workflows;