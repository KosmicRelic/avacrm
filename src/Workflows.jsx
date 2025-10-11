import { useContext } from 'react';
import { MainContext } from './Contexts/MainContext';
import styles from './Workflows.module.css';

const Workflows = () => {
  const { isDarkTheme } = useContext(MainContext);

  // Sample workflow data
  const workflows = [];

  const handleCreateWorkflow = (workflowType) => {
    console.log(`Creating workflow: ${workflowType}`);
    setShowWorkflowDropdown(false);
  };

  return (
    <div className={`${styles.workflowsContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
      <div className={`${styles.workflowTabs} ${styles.workflowTabsFullWidth} ${isDarkTheme ? styles.darkTheme : ''}`}>
        <div className={`${styles.workflowsSection} ${isDarkTheme ? styles.darkTheme : ''}`}>
          <div className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>
            <span>Available Workflows</span>
          </div>
          <div className={styles.workflowsGrid}>
            {workflows.map((workflow) => (
              <div key={workflow.id} className={styles.workflowContainer}>
                <button
                  className={`${styles.tabButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                  onClick={() => console.log(`Clicked ${workflow.name}`)}
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
      <div className={styles.selectWorkflowMessage + (isDarkTheme ? ' ' + styles.darkTheme : '')}>
        <div className={styles.selectWorkflowTitle}>Select a workflow</div>
        <div className={styles.selectWorkflowSubtitle}>Tap a workflow tab to get started</div>
      </div>
      <div className={styles.workflowActions}>
        <select
          className={`${styles.createWorkflowButton} ${isDarkTheme ? styles.darkTheme : ''}`}
          onChange={(e) => {
            if (e.target.value) {
              handleCreateWorkflow(e.target.value);
              e.target.value = ''; // Reset selection
            }
          }}
          defaultValue=""
        >
          <option value="" disabled>New Workflow</option>
          <option value="web-form-integration">Web Form Integration</option>
          <option value="email-automation">Email Automation</option>
          <option value="data-sync">Data Synchronization</option>
          <option value="notification-system">Notification System</option>
          <option value="task-automation">Task Automation</option>
        </select>
      </div>
    </div>
  );
};

export default Workflows;