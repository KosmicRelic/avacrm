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
      const sheetName = typeof sheetNameOrObj === "string" ? sheetNameOrObj : sheetNameOrObj.sheetName;
      const sheetStructure = sheets.structure || sheets;
      const existingSheetNames = Array.isArray(sheetStructure)
        ? sheetStructure.map((item) => item.sheetName || item.folderName)
        : [];

      if (shouldSave) {
        // Validate sheet name
        if (!sheetName || !sheetName.trim()) {
          alert("Sheet name cannot be empty.");
          return;
        }

        // Check for duplicates (case-insensitive)
        const isDuplicate = isEditMode
          ? existingSheetNames.some(
              (name) => name.toLowerCase() === sheetName.toLowerCase() && name !== activeSheetName
            )
          : existingSheetNames.some((name) => name.toLowerCase() === sheetName.toLowerCase());

        if (isDuplicate) {
          alert("A sheet or folder with this name already exists (case-insensitive).");
          return;
        }

        if (headerObjects.length === 0) {
          alert("Please select at least one header.");
          return;
        }
      }

      setSheets((prevSheets) => {
        if (isEditMode) {
          return {
            ...prevSheets,
            allSheets: prevSheets.allSheets.map((sheet) =>
              sheet.sheetName === activeSheetName
                ? { ...sheet, sheetName, headers: headerObjects, pinnedHeaders, isActive: true }
                : { ...sheet, isActive: false }
            ),
            structure: prevSheets.structure.map((item) =>
              item.sheetName === activeSheetName
                ? { sheetName }
                : item.folderName
                ? { ...item, sheets: item.sheets.map((s) => (s === activeSheetName ? sheetName : s)) }
                : item
            ),
          };
        } else if (sheetName) {
          return {
            ...prevSheets,
            allSheets: [
              ...prevSheets.allSheets.map((sheet) => ({ ...sheet, isActive: false })),
              {
                sheetName,
                headers: headerObjects.map((h, i) => ({ ...h, order: i, locked: h.locked || false })),
                pinnedHeaders: pinnedHeaders || [],
                rows: [],
                isActive: true,
              },
            ],
            structure: [...prevSheets.structure, { sheetName }],
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