import { useEffect } from "react";

const useClickOutside = (ref, isActive, callback) => {
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Ignore clicks on the "Done" button or its container
      if (event.target.closest(".doneButton")) {
        return;
      }
      // Only proceed if the ref exists, the modal is active, and the click is outside
      if (ref.current && isActive && !ref.current.contains(event.target)) {
        callback();
      }
    };

    // Use "pointerdown" for broader compatibility (mouse, touch, etc.)
    document.addEventListener("pointerdown", handleClickOutside);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
    };
  }, [ref, isActive, callback]);
};

export default useClickOutside;