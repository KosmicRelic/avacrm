import { useState, useCallback } from "react";

const useDragAndDrop = (items, setItems) => {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchTargetIndex, setTouchTargetIndex] = useState(null);

  const handleDragStart = useCallback((e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.target.classList.add("dragging");
  }, []);

  const handleTouchStart = useCallback((e, index) => {
    e.preventDefault();
    setDraggedIndex(index);
    setTouchStartY(e.touches[0].clientY);
    setTouchTargetIndex(index);
    e.target.classList.add("dragging");
  }, []);

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    setItems((prev) => {
      const newItems = [...prev];
      const [draggedItem] = newItems.splice(draggedIndex, 1);
      newItems.splice(index, 0, draggedItem);
      setDraggedIndex(index);
      return newItems;
    });
  }, [draggedIndex, setItems]);

  const handleTouchMove = useCallback((e, index) => {
    e.preventDefault();
    if (draggedIndex === null || touchStartY === null) return;

    const touchY = e.touches[0].clientY;
    const itemHeight = 48; // Adjust based on your CSS
    const delta = Math.round((touchY - touchStartY) / itemHeight);

    const newIndex = Math.max(0, Math.min(touchTargetIndex + delta, items.length - 1));
    if (newIndex !== draggedIndex) {
      setItems((prev) => {
        const newItems = [...prev];
        const [draggedItem] = newItems.splice(draggedIndex, 1);
        newItems.splice(newIndex, 0, draggedItem);
        setDraggedIndex(newIndex);
        return newItems;
      });
    }
  }, [draggedIndex, touchStartY, touchTargetIndex, items.length, setItems]);

  const handleDragEnd = useCallback((e) => {
    e.target.classList.remove("dragging");
    setDraggedIndex(null);
  }, []);

  const handleTouchEnd = useCallback((e) => {
    e.preventDefault();
    const target = e.target.closest(".draggable-item");
    if (target) target.classList.remove("dragging");
    setDraggedIndex(null);
    setTouchStartY(null);
    setTouchTargetIndex(null);
  }, []);

  return {
    draggedIndex,
    handleDragStart,
    handleTouchStart,
    handleDragOver,
    handleTouchMove,
    handleDragEnd,
    handleTouchEnd,
  };
};

export default useDragAndDrop;