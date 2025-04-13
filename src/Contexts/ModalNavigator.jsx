import { createContext, useState, useCallback } from "react";
import PropTypes from "prop-types";

export const ModalNavigatorContext = createContext();

export const ModalNavigatorProvider = ({ children }) => {
  const [modalConfig, setModalConfig] = useState({
    showTitle: false,
    showDoneButton: false,
    showBackButton: false,
    title: "",
    backButtonTitle: "",
    rightButtons: [],
  });
  const [modalSteps, setModalSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(1);

  const getStepTitle = useCallback(
    (stepIndex, args) => {
      const step = modalSteps[stepIndex];
      return typeof step?.title === "function" ? step.title(args) : step?.title || "";
    },
    [modalSteps]
  );

  const getStepButtons = useCallback(
    (stepIndex) => {
      const step = modalSteps[stepIndex];
      const buttons = Array.isArray(step?.rightButtons) ? step.rightButtons : [];
      console.log("Step buttons for index", stepIndex, ":", buttons);
      return buttons;
    },
    [modalSteps]
  );

  const registerModalSteps = useCallback(
    (stepsConfig) => {
      console.log("Registering modal steps:", stepsConfig);
      setModalSteps(stepsConfig.steps);
      setCurrentStep(1);
      const newConfig = {
        showTitle: true,
        showDoneButton: true,
        showBackButton: false,
        title: getStepTitle(0, stepsConfig.args || {}),
        backButtonTitle: "",
        rightButtons: getStepButtons(0),
      };
      setModalConfig(newConfig);
      console.log("Updated modalConfig:", newConfig);
    },
    [getStepTitle, getStepButtons]
  );

  const goToStep = useCallback(
    (step, args = {}) => {
      if (step < 1 || step > modalSteps.length) return;

      const currentStepIndex = step - 1;
      const previousStepIndex = step - 2;
      const newTitle = getStepTitle(currentStepIndex, args);
      const previousStepTitle =
        previousStepIndex >= 0 ? getStepTitle(previousStepIndex, args) : "";
      const rightButtons = getStepButtons(currentStepIndex);

      const newConfig = {
        showTitle: true,
        showDoneButton: step === 1,
        showBackButton: step > 1,
        title: newTitle,
        backButtonTitle: previousStepTitle,
        rightButtons,
      };
      setModalConfig(newConfig);
      setCurrentStep(step);
      console.log("Go to step", step, "with config:", newConfig);
    },
    [modalSteps, getStepTitle, getStepButtons]
  );

  const goBack = useCallback(
    (args = {}) => {
      if (currentStep <= 1) return;
      goToStep(currentStep - 1, args);
    },
    [currentStep, goToStep]
  );

  return (
    <ModalNavigatorContext.Provider
      value={{
        modalConfig,
        setModalConfig,
        modalSteps,
        currentStep,
        registerModalSteps,
        goToStep,
        goBack,
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