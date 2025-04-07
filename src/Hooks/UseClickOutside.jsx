import { useEffect } from "react";

const useClickOutside = (ref, isActive, onClose) => {
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Ensure ref.current exists before proceeding
      if (!ref.current) {
        console.warn("Ref is not set for active element");
        return;
      }
      
      // Close only if clicking outside the ref element
      if (isActive && !ref.current.contains(event.target)) {
        onClose();
      }
    };

    // Add listener only when active
    if (isActive) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    // Cleanup listener
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [ref, isActive, onClose]);
};

export default useClickOutside;