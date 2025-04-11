import { createContext, useState, useCallback, useMemo, useEffect, useContext } from "react";
import PropTypes from "prop-types";
import Sheets from "./Sheets/Sheets";
import AppHeader from "./App Header/AppHeader";
import FilterModal from "./Modal/FilterModal/FilterModal";
import HeadersModal from "./Modal/HeadersModal/HeaderModal";
import { MainContext } from "./Contexts/MainContext";
import styles from "./App.module.css";
import SheetModal from "./Modal/SheetModal/SheetModal";
import useModal from "./Modal/Hooks/UseModal";
import useSheets from "./Modal/Hooks/UseSheets";
import Modal from "./Modal/Modal";
import SheetsModal from "./Modal/Sheets Modal/SheetsModal";
import ProfileModal from "./Profile Modal/ProfileModal";
import CardsTransportationModal from "./Modal/Cards Transportaion Modal/CardsTransportaionModal";
import CardsTemplate from "./Modal/Cards Template/CardsTemplate";

function App() {
 const {
 sheets,
 setSheets,
 cards,
 setCards,
 headers,
 setHeaders,
 setModalConfig,
 cardTemplates,
 setCardTemplates,
 currentStep,
 editMode,
 setEditMode,
 registerModalSteps,
 goToStep,
 } = useContext(MainContext);

 const sheetModal = useModal();
 const filterModal = useModal();
 const headersModal = useModal();
 const sheetsModal = useModal();
 const transportModal = useModal();
 const cardsTemplateModal = useModal();
 const [isSheetModalEditMode, setIsSheetModalEditMode] = useState(false);
 const [filters, setFilters] = useState({});
 const [activeOption, setActiveOption] = useState("sheets");
 const [activeModal, setActiveModal] = useState(null);
 const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

 const activeSheet = useMemo(() => sheets.allSheets.find((sheet) => sheet.isActive) || null, [sheets]);
 const activeSheetName = activeSheet?.sheetName;
 const { handleSheetChange, handleSaveSheet } = useSheets(sheets, setSheets, activeSheetName);

 const resolvedHeaders = useMemo(() => {
 return activeSheet?.headers.map((sheetHeader) => {
 const header = headers.find((h) => h.key === sheetHeader.key);
 return header
 ? { key: sheetHeader.key, name: header.name, type: header.type, visible: sheetHeader.visible, hidden: sheetHeader.hidden }
 : { key: sheetHeader.key, name: sheetHeader.key, type: "text", visible: sheetHeader.visible, hidden: sheetHeader.hidden };
 }) || [];
 }, [activeSheet, headers]);

 const resolvedRows = useMemo(() => {
 return activeSheet?.rows.map((rowId) => cards.find((card) => card.id === rowId) || {}) || [];
 }, [activeSheet, cards]);

 const resetModalState = useCallback(() => {
 registerModalSteps({ steps: [] });
 setModalConfig({
 showTitle: false,
 showDoneButton: false,
 showBackButton: false,
 title: "",
 backButtonTitle: "",
 });
 goToStep(1);
 }, [registerModalSteps, setModalConfig, goToStep]);

 const handlePinToggle = useCallback(
 (headerKey) => {
 setSheets((prevSheets) => ({
 ...prevSheets,
 allSheets: prevSheets.allSheets.map((sheet) =>
 sheet.sheetName === activeSheetName
 ? {
 ...sheet,
 pinnedHeaders: sheet.pinnedHeaders.includes(headerKey)
 ? sheet.pinnedHeaders.filter((h) => h !== headerKey)
 : [...sheet.pinnedHeaders, headerKey],
 }
 : sheet
 ),
 }));
 },
 [activeSheetName, setSheets]
 );

 const handleCardSave = useCallback(
 (updatedRow) => {
 setCards((prevCards) => {
 const existingCard = prevCards.find((card) => card.id === updatedRow.id);
 if (existingCard) {
 return prevCards.map((card) => (card.id === updatedRow.id ? { ...card, ...updatedRow } : card));
 }
 return [...prevCards, updatedRow];
 });
 setSheets((prevSheets) => ({
 ...prevSheets,
 allSheets: prevSheets.allSheets.map((sheet) =>
 sheet.sheetName === activeSheetName
 ? {
 ...sheet,
 rows: sheet.rows.includes(updatedRow.id) ? sheet.rows : [...sheet.rows, updatedRow.id],
 }
 : sheet
 ),
 }));
 },
 [activeSheetName, setCards, setSheets]
 );

 const handleDelete = useCallback(
 (rowData) => {
 setCards((prevCards) => prevCards.filter((card) => card.id !== rowData.id));
 setSheets((prevSheets) => ({
 ...prevSheets,
 allSheets: prevSheets.allSheets.map((sheet) =>
 sheet.sheetName === activeSheetName
 ? { ...sheet, rows: sheet.rows.filter((id) => id !== rowData.id) }
 : sheet
 ),
 }));
 },
 [activeSheetName, setCards, setSheets]
 );

 const handleSaveOrder = useCallback(
 (newOrder) => {
 setSheets((prev) => ({
 ...prev,
 structure: newOrder,
 }));
 },
 [setSheets]
 );

 const onEditSheet = useCallback(() => {
 resetModalState();
 setIsSheetModalEditMode(true);
 setActiveModal({ type: "sheet", data: { isEditMode: true } });
 sheetModal.open();
 }, [sheetModal, resetModalState]);

 const onFilter = useCallback(() => {
 resetModalState();
 setActiveModal({ type: "filter" });
 filterModal.open();
 }, [filterModal, resetModalState]);

 const onManageHeaders = useCallback(() => {
 resetModalState();
 setActiveModal({ type: "headers" });
 headersModal.open();
 }, [headersModal, resetModalState]);

 const onOpenSheetsModal = useCallback(() => {
 resetModalState();
 setActiveModal({ type: "sheets" });
 sheetsModal.open();
 }, [sheetsModal, resetModalState]);

 const onOpenTransportModal = useCallback(
 (action, selectedRowIds, onComplete) => {
 resetModalState();
 setActiveModal({ type: "transport", data: { action, selectedRowIds, onComplete } });
 transportModal.open();
 },
 [transportModal, resetModalState]
 );

 const onOpenCardsTemplateModal = useCallback(() => {
  resetModalState();
  setActiveModal({ type: "cardsTemplate" });
  cardsTemplateModal.open();
}, [cardsTemplateModal, resetModalState]);

 const handleModalClose = useCallback(() => {
 if (currentStep !== 1) {
 return; // Prevent closing if not on step 1
 }
 setActiveModal(null);
 resetModalState();
 setEditMode(false);
 sheetModal.close();
 filterModal.close();
 headersModal.close();
 sheetsModal.close();
 transportModal.close();
 cardsTemplateModal.close();
 }, [
 currentStep,
 sheetModal,
 filterModal,
 headersModal,
 sheetsModal,
 transportModal,
 cardsTemplateModal,
 setModalConfig,
 setEditMode,
 resetModalState,
 ]);

 const handleOpenProfileModal = useCallback(() => {
 setIsProfileModalOpen(true);
 }, []);

 const handleCloseProfileModal = useCallback(() => {
 setIsProfileModalOpen(false);
 }, []);

 const renderModalContent = () => {
 if (!activeModal) return null;

 switch (activeModal.type) {
 case "sheet":
 return (
 <SheetModal
 isEditMode={isSheetModalEditMode}
 tempData={{
 sheetName: isSheetModalEditMode ? activeSheetName : "",
 currentHeaders: resolvedHeaders,
 rows: activeSheet?.rows || [],
 }}
 setTempData={(newData) => {
 if (isSheetModalEditMode) {
 setSheets((prev) => ({
 ...prev,
 allSheets: prev.allSheets.map((sheet) =>
 sheet.sheetName === activeSheetName ? { ...sheet, ...newData } : sheet
 ),
 }));
 } else {
 handleSaveSheet(newData.sheetName, newData.currentHeaders);
 }
 }}
 sheets={sheets}
 onPinToggle={handlePinToggle}
 />
 );
 case "filter":
 return (
 <FilterModal
 headers={resolvedHeaders}
 rows={resolvedRows}
 onApply={setFilters}
 filters={filters}
 tempData={{ filterValues: filters }}
 setTempData={(newData) => setFilters(newData.filterValues)}
 />
 );
 case "headers":
 return (
 <HeadersModal
 tempData={{ currentHeaders: headers }}
 setTempData={(newData) => setHeaders(newData.currentHeaders)}
 />
 );
 case "sheets":
 return (
 <SheetsModal
 sheets={sheets}
 onSaveOrder={handleSaveOrder}
 tempData={{ newOrder: sheets.structure }}
 setTempData={(newData) => handleSaveOrder(newData.newOrder)}
 />
 );
 case "transport":
 return (
 <CardsTransportationModal
 tempData={activeModal.data}
 setTempData={(data) => setActiveModal({ ...activeModal, data })}
 onSave={handleModalClose}
 />
 );
 case "cardsTemplate":
  return (
    <CardsTemplate
      onSave={handleModalClose}
    />
  );
 default:
 return null;
 }
 };

 return (
 <div className={styles.appContainer}>
 <AppHeader
 sheets={sheets.structure.map((item) => item.sheetName || item.folderName)}
 activeSheet={activeSheetName}
 onSheetChange={handleSheetChange}
 setIsProfileModalOpen={handleOpenProfileModal}
 activeOption={activeOption}
 setActiveOption={setActiveOption}
 />
 <div className={styles.contentWrapper}>
 {activeOption === "sheets" && activeSheetName && (
 <Sheets
 headers={resolvedHeaders}
 rows={resolvedRows}
 filters={filters}
 sheets={sheets}
 setSheets={setSheets}
 activeSheetName={activeSheetName}
 onSheetChange={handleSheetChange}
 onEditSheet={onEditSheet}
 onFilter={onFilter}
 onRowClick={() => {}}
 onCardSave={handleCardSave}
 onCardDelete={handleDelete}
 onOpenSheetsModal={onOpenSheetsModal}
 onOpenTransportModal={onOpenTransportModal}
 />
 )}
 {activeModal && (
 <Modal
 onClose={handleModalClose}
 onSave={
 activeModal.type === "filter"
 ? setFilters
 : activeModal.type === "sheets"
 ? handleSaveOrder
 : activeModal.type === "sheet" || activeModal.type === "cardsTemplate"
 ? handleModalClose
 : () => {}
 }
 initialData={
 activeModal.type === "sheet"
 ? {
 sheetName: isSheetModalEditMode ? activeSheetName : "",
 currentHeaders: resolvedHeaders,
 rows: activeSheet?.rows || [],
 }
 : activeModal.type === "filter"
 ? { filterValues: filters }
 : activeModal.type === "headers"
 ? { currentHeaders: headers }
 : activeModal.type === "sheets"
 ? { newOrder: sheets.structure }
 : activeModal.type === "transport"
 ? activeModal.data
 : activeModal.type === "cardsTemplate"
 ? cardTemplates
 : {}
 }
 modalType={activeModal.type}
 rightButton={
 activeModal.type === "cardsTemplate" && currentStep === 2
 ? {
 label: editMode ? "Done" : "Edit",
 onClick: () => setEditMode(!editMode),
 }
 : null
 }
 >
 {renderModalContent()}
 </Modal>
 )}
 <ProfileModal
 isOpen={isProfileModalOpen}
 onClose={handleCloseProfileModal}
 onOpenHeadersModal={onManageHeaders}
 setActiveOption={setActiveOption}
 onOpenCardsTemplateModal={onOpenCardsTemplateModal}
 />
 </div>
 </div>
 );
}

App.propTypes = {};

export default App;