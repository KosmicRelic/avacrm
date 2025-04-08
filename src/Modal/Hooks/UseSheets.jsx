import { useCallback } from "react";

const useSheets = (sheets, setSheets, activeSheetName) => {
  const handleSheetChange = useCallback((sheetName) => {
    if (sheetName === "add-new-sheet") {
      return { isNewSheet: true };
    } else if (sheetName) {
      setSheets((prevSheets) => ({
        ...prevSheets,
        allSheets: prevSheets.allSheets.map((sheet) => ({
          ...sheet,
          isActive: sheet.sheetName === sheetName,
        })),
      }));
    }
  }, [setSheets]);

  const handleSheetUpdate = useCallback(
    (sheetNameOrObj, headerObjects, pinnedHeaders, shouldSave = false, isEditMode) => {
      const trimmedName = typeof sheetNameOrObj === "string" ? sheetNameOrObj : sheetNameOrObj.sheetName;
      const sheetStructure = sheets.structure || sheets;
      const existingSheetNames = Array.isArray(sheetStructure)
        ? sheetStructure.map((item) => item.sheetName || item.folderName)
        : [];
      const isDuplicate = isEditMode
        ? trimmedName !== activeSheetName && existingSheetNames.includes(trimmedName)
        : existingSheetNames.includes(trimmedName);

      if (shouldSave) {
        if (isDuplicate) {
          alert("A sheet or folder with this name already exists.");
          return;
        }
        if (!trimmedName) {
          alert("Please provide a sheet name.");
          return;
        }
        if (headerObjects.length === 0) {
          alert("Please select at least one header.");
          return;
        }
      }

      if (isDuplicate && !shouldSave) return;

      setSheets((prevSheets) => {
        if (isEditMode) {
          return {
            ...prevSheets,
            allSheets: prevSheets.allSheets.map((sheet) =>
              sheet.sheetName === activeSheetName
                ? { ...sheet, sheetName: trimmedName, headers: headerObjects, pinnedHeaders, isActive: true }
                : { ...sheet, isActive: false }
            ),
            structure: prevSheets.structure.map((item) =>
              item.sheetName === activeSheetName
                ? { sheetName: trimmedName }
                : item.folderName
                ? { ...item, sheets: item.sheets.map((s) => (s === activeSheetName ? trimmedName : s)) }
                : item
            ),
          };
        } else if (trimmedName) {
          return {
            ...prevSheets,
            allSheets: [
              ...prevSheets.allSheets.map((sheet) => ({ ...sheet, isActive: false })),
              { 
                sheetName: trimmedName, 
                headers: headerObjects.map((h, i) => ({ ...h, order: i, locked: h.locked || false })), 
                pinnedHeaders: pinnedHeaders || [], 
                rows: [], 
                isActive: true 
              },
            ],
            structure: [...prevSheets.structure, { sheetName: trimmedName }],
          };
        }
        return prevSheets;
      });
    },
    [sheets, setSheets, activeSheetName]
  );

  const handleSaveSheet = (sheetNameOrObj, headerObjects, pinnedHeaders, isEditMode) =>
    handleSheetUpdate(sheetNameOrObj, headerObjects, pinnedHeaders, true, isEditMode);

  return { handleSheetChange, handleSheetUpdate, handleSaveSheet };
};

export default useSheets;