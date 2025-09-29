import { createContext, useState, useCallback } from "react";
import PropTypes from "prop-types";

export const ModalNavigatorContext = createContext({
  modalConfig: {
    showTitle: false,
    showDoneButton: false,
    showBackButton: false,
    title: "",
    backButtonTitle: "",
    rightButton: null,
    leftButton: null,
  },
  setModalConfig: () => {},
  modalSteps: [],
  currentStep: 1,
  setCurrentStep: () => {},
  registerModalSteps: () => {},
  goToStep: () => {},
  goBack: () => {},
  modalType: null,
});

export const ModalNavigatorProvider = ({ children }) => {
  const [modalConfig, setModalConfig] = useState({
    showTitle: false,
    showDoneButton: false,
    showBackButton: false,
    title: "",
    backButtonTitle: "",
    rightButton: null,
    leftButton: null,
  });
  const [modalSteps, setModalSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [history, setHistory] = useState([1]); // Initialize history with step 1
  const [modalType, setModalType] = useState(null);

  const getStepTitle = useCallback(
    (stepIndex, args) => {
      const step = modalSteps[stepIndex];
      return typeof step?.title === "function" ? step.title(args) : step?.title || "";
    },
    [modalSteps]
  );

  const getStepButton = useCallback(
    (stepIndex) => {
      const step = modalSteps[stepIndex];
      return {
        rightButton: step?.rightButton || null,
        leftButton: step?.leftButton || null,
      };
    },
    [modalSteps]
  );

  const registerModalSteps = useCallback(
    (stepsConfig) => {
      setModalSteps(stepsConfig.steps);
      setModalType(stepsConfig.modalType || null);
      setCurrentStep(1);
      setHistory([1]); // Reset history when registering new steps
      const newConfig = {
        showTitle: true,
        showDoneButton: true,
        showBackButton: false,
        title: getStepTitle(0, stepsConfig.args || {}),
        backButtonTitle: "",
        rightButton: getStepButton(0).rightButton,
        leftButton: getStepButton(0).leftButton,
      };
      setModalConfig(newConfig);
    },
    [getStepTitle, getStepButton]
  );

  const goToStep = useCallback(
    (step, args = {}) => {
      if (step < 1 || step > modalSteps.length) return;

      const currentStepIndex = step - 1;
      const previousStepIndex = history.length > 1 ? history[history.length - 2] - 1 : 0;
      const newTitle = getStepTitle(currentStepIndex, args);
      const previousStepTitle =
        previousStepIndex >= 0 ? getStepTitle(previousStepIndex, args) : "";
      const buttons = getStepButton(currentStepIndex);

      const newConfig = {
        showTitle: true,
        showDoneButton: step === 1,
        showBackButton: history.length > 0, // Show back button if there's history
        title: newTitle,
        backButtonTitle: previousStepTitle,
        rightButton: buttons.rightButton,
        leftButton: buttons.leftButton,
      };

      setModalConfig(newConfig);
      setCurrentStep(step);
      setHistory((prev) => [...prev, step]); // Add new step to history
    },
    [modalSteps, getStepTitle, getStepButton, history]
  );

  const goBack = useCallback(
    (args = {}) => {
      if (history.length <= 1) return; // No previous step to go back to

      // Pop the current step and get the previous step
      const newHistory = [...history];
      newHistory.pop(); // Remove current step
      const previousStep = newHistory[newHistory.length - 1]; // Get previous step

      const currentStepIndex = previousStep - 1;
      const previousStepIndex = newHistory.length > 1 ? newHistory[newHistory.length - 2] - 1 : 0;
      const newTitle = getStepTitle(currentStepIndex, args);
      const previousStepTitle =
        previousStepIndex >= 0 ? getStepTitle(previousStepIndex, args) : "";
      const buttons = getStepButton(currentStepIndex);

      const newConfig = {
        showTitle: true,
        showDoneButton: previousStep === 1,
        showBackButton: newHistory.length > 1, // Show back button if there's still history
        title: newTitle,
        backButtonTitle: previousStepTitle,
        rightButton: buttons.rightButton,
        leftButton: buttons.leftButton,
      };

      setModalConfig(newConfig);
      setCurrentStep(previousStep);
      setHistory(newHistory); // Update history
    },
    [history, getStepTitle, getStepButton]
  );

  return (
    <ModalNavigatorContext.Provider
      value={{
        modalConfig,
        setModalConfig,
        modalSteps,
        currentStep,
        setCurrentStep,
        registerModalSteps,
        goToStep,
        goBack,
        modalType,
      }}
    >
      {children}
    </ModalNavigatorContext.Provider>
  );
};

ModalNavigatorProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ModalNavigatorProvider;