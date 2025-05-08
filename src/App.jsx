import React, { useState, useCallback, useMemo, useContext, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import Sheets from './Sheets/Sheets';
import AppHeader from './App Header/AppHeader';
import { MainContext } from './Contexts/MainContext';
import styles from './App.module.css';
import useModal from './Modal/Hooks/UseModal';
import useSheets from './Modal/Hooks/UseSheets';
import Modal from './Modal/Modal';
import ProfileModal from './Profile Modal/ProfileModal';
import Dashboard from './Dashboard/Dashboard';
import Metrics from './Metrics/Metrics';
import BusinessSignUp from './Account Componenets/SignUp/BusinessSignUp';
import TeamMemberSignUp from './Account Componenets/SignUp/TeamMemberSignUp.jsx';
import SignIn from './Account Componenets/SignIn/SignIn.jsx';
import Settings from './Settings/Settings';
import FolderOperations from './Modal/Folder Modal/FolderModal'; // Added import
import {
  handleModalSave,
  handleModalClose,
  renderModalContent,
  onEditSheet,
  onFilter,
  onManageMetrics,
  onOpenSheetsModal,
  onOpenTransportModal,
  onOpenCardsTemplateModal,
  onOpenSheetFolderModal,
  onOpenFolderOperationsModal,
  onOpenFolderModal,
} from './Utils/ModalUtils.jsx';

// Memoized ProtectedRoute to prevent unnecessary re-renders
const ProtectedRoute = React.memo(({ children }) => {
  const { user, userAuthChecked } = useContext(MainContext);
  const location = useLocation();

  if (!userAuthChecked) {
    return null; // Wait for auth check to complete
  }

  // Check if the path is for team member signup
  const isTeamMemberSignup = location.pathname.match(/^\/signup\/[^/]+\/teammember\/[^/]+$/);

  if (
    !user &&
    userAuthChecked &&
    !['/signup/business', '/signin'].includes(location.pathname) &&
    !isTeamMemberSignup
  ) {
    return <Navigate to="/signin" replace />;
  }

  return children;
});

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
};

function App() {
  const {
    sheets,
    setSheets,
    cards,
    setCards,
    cardTemplates,
    setCardTemplates,
    editMode,
    setEditMode,
    tempData,
    setTempData,
    selectedTemplateIndex,
    setSelectedTemplateIndex,
    currentSectionIndex,
    setCurrentSectionIndex,
    dashboards,
    setDashboards,
    metrics,
    setMetrics,
    isDarkTheme,
    user,
    userAuthChecked,
    businessId,
    bannerQueue,
    setBannerQueue,
    activeSheetName,
    setActiveSheetName,
    sheetCardsFetched,
    setSheetCardsFetched, // Added to reset cache
  } = useContext(MainContext);

  const navigate = useNavigate();
  const location = useLocation();
  const sheetModal = useModal();
  const filterModal = useModal();
  const sheetsModal = useModal();
  const transportModal = useModal();
  const cardsTemplateModal = useModal();
  const sheetFolderModal = useModal();
  const folderOperationsModal = useModal();
  const widgetSizeModal = useModal();
  const widgetViewModal = useModal();
  const widgetSetupModal = useModal();
  const metricsModal = useModal();
  const folderModal = useModal();
  const [isSheetModalEditMode, setIsSheetModalEditMode] = useState(false);
  const [activeOption, setActiveOption] = useState('dashboard');
  const [activeModal, setActiveModal] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [activeDashboardId, setActiveDashboardId] = useState(null);
  const [selectedMetricData, setSelectedMetricData] = useState(null);
  const [currentBanner, setCurrentBanner] = useState(null);
  const [isBannerExiting, setIsBannerExiting] = useState(false);

  useEffect(() => {
    if (dashboards && dashboards.length > 0 && !activeDashboardId) {
      setActiveDashboardId(dashboards[0].id);
    }
  }, [dashboards, activeDashboardId]);

  // Handle banner display and animation
  useEffect(() => {
    if (bannerQueue.length === 0 && !currentBanner) {
      return;
    }

    let timer;
    if (!currentBanner && bannerQueue.length > 0) {
      setCurrentBanner(bannerQueue[0]);
      setIsBannerExiting(false);
    } else if (currentBanner && !isBannerExiting) {
      timer = setTimeout(() => {
        setIsBannerExiting(true);
      }, 3000);
    } else if (isBannerExiting) {
      timer = setTimeout(() => {
        setBannerQueue((prev) => prev.slice(1));
        setCurrentBanner(null);
        setIsBannerExiting(false);
      }, 800);
    }

    return () => clearTimeout(timer);
  }, [bannerQueue, currentBanner, isBannerExiting, setBannerQueue]);

  const activeSheet = useMemo(
    () => sheets?.allSheets?.find((sheet) => sheet.sheetName === activeSheetName) || null,
    [sheets, activeSheetName]
  );

  const activeDashboard = useMemo(() => {
    if (!dashboards) return null;
    return dashboards.find((d) => d.id === activeDashboardId) || dashboards[0];
  }, [dashboards, activeDashboardId]);

  const { handleSheetChange, handleSaveSheet } = useSheets(sheets, setSheets, activeSheetName);

  const resolvedHeaders = useMemo(() => {
    if (!activeSheet) return [];
    return (activeSheet.headers || []).map((header) => ({
      key: header.key,
      name: header.name,
      type: header.type,
      options: header.options || [],
      visible: header.visible !== false,
      hidden: header.hidden || false,
    }));
  }, [activeSheet]);

  const resolvedRows = useMemo(() => {
    if (!activeSheet || !cards) return [];
    return activeSheet.rows?.map((rowId) => cards.find((card) => card.id === rowId) || {}) || [];
  }, [activeSheet, cards]);

  useEffect(() => {
    if (location.pathname === '/dashboard') {
      setActiveOption('dashboard');
    } else if (location.pathname === '/sheets') {
      setActiveOption('sheets');
    } else if (location.pathname === '/metrics') {
      setActiveOption('metrics');
    } else if (location.pathname === '/settings') {
      setActiveOption('settings');
    }
  }, [location.pathname, setActiveOption]);

  const handlePinToggle = useCallback(
    (headerKey) => {
      if (!sheets) return;
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
    [activeSheetName, setSheets, sheets]
  );

  const handleDeleteSheet = useCallback(
    (sheetName) => {
      if (!sheets) return;
      setSheets((prev) => {
        const updatedAllSheets = prev.allSheets.filter((sheet) => sheet.sheetName !== sheetName);
        const updatedStructure = prev.structure
          .map((item) => {
            if (item.sheetName === sheetName) {
              return null;
            }
            if (item.folderName) {
              const updatedSheets = item.sheets.filter((s) => s !== sheetName);
              return { ...item, sheets: updatedSheets };
            }
            return item;
          })
          .filter((item) => item !== null);

        let newActiveSheet = updatedAllSheets[0]?.sheetName;
        if (updatedStructure.length > 0) {
          const firstItem = updatedStructure[0];
          newActiveSheet = firstItem.sheetName || updatedStructure[0].sheets?.[0] || null;
        }

        return {
          ...prev,
          allSheets: updatedAllSheets.map((sheet, index) => ({
            ...sheet,
            isActive: index === 0 && !newActiveSheet ? true : sheet.sheetName === newActiveSheet,
          })),
          structure: updatedStructure,
        };
      });
      if (activeSheetName === sheetName) {
        setActiveSheetName(newActiveSheet || 'Leads');
        handleSheetChange(newActiveSheet || 'Leads');
      }
    },
    [setSheets, sheets, activeSheetName, setActiveSheetName, handleSheetChange]
  );

  const handleSheetSave = useCallback(
    (newSheetName, selectedHeaders) => {
      if (!sheets) return;
      setSheets((prevSheets) => {
        const newSheetId = `sheet_${Date.now()}`;
        const newSheet = {
          id: newSheetId,
          docId: newSheetId,
          sheetName: newSheetName,
          headers: selectedHeaders.map((key) => {
            const header =
              prevSheets.allSheets
                .flatMap((sheet) => sheet.headers)
                .find((h) => h.key === key) || { key, name: key, type: 'text' };
            return {
              key: header.key,
              name: header.name,
              type: header.type,
              options: header.options || [],
              visible: true,
              hidden: false,
            };
          }),
          pinnedHeaders: [],
          rows: [],
          filters: {},
          isActive: true,
        };
        return {
          allSheets: [
            ...prevSheets.allSheets.map((sheet) => ({
              ...sheet,
              isActive: false,
            })),
            newSheet,
          ],
          structure: [...prevSheets.structure, { sheetName: newSheetName }],
        };
      });
      setActiveSheetName(newSheetName);
      handleSheetChange(newSheetName);
    },
    [setSheets, handleSheetChange, sheets, setActiveSheetName]
  );

  const handleFolderSave = useCallback(
    (newFolderName, selectedSheets) => {
      if (!sheets) return;
      setSheets((prevSheets) => {
        const existingFolder = prevSheets.structure.find(
          (item) => item.folderName === newFolderName
        );
        if (existingFolder) {
          const existingSheets = existingFolder.sheets || [];
          const newSheets = selectedSheets.filter((sheet) => !existingSheets.includes(sheet));
          if (newSheets.length === 0) {
            return prevSheets;
          }
          return {
            ...prevSheets,
            structure: prevSheets.structure.map((item) =>
              item.folderName === newFolderName
                ? { ...item, sheets: [...existingSheets, ...newSheets] }
                : item
            ),
          };
        }
        return {
          ...prevSheets,
          structure: [
            ...prevSheets.structure,
            {
              folderName: newFolderName,
              sheets: selectedSheets,
            },
          ],
        };
      });
    },
    [setSheets, sheets]
  );

  const handleWidgetClick = useCallback(
    ({ type, widget, metric, initialStep }) => {
      if (!dashboards || !widget?.dashboardId) {
        console.warn('Widget missing dashboardId or dashboards not initialized:', widget);
        return;
      }
      if (type === 'widgetSetup') {
        const widgetId = widget.id || `widget-${Date.now()}`;
        setActiveModal({
          type: 'widgetSetup',
          data: {
            widget: { ...widget, id: widgetId },
            updatedWidget: {
              ...widget,
              id: widgetId,
              title: widget.title || '',
              metricId: widget.metricId || null,
              dashboardId: widget.dashboardId,
            },
            category: widget.title || null,
            metric: widget.metricId || null,
            dashboardId: widget.dashboardId || activeDashboard?.id,
            initialStep: initialStep || 1,
          },
        });
        widgetSetupModal.open();
      } else if (type === 'metric') {
        const categoryObj = metrics?.find((cat) => cat.metrics.some((m) => m.id === metric.id));
        if (!categoryObj) {
          console.warn('Category not found for metric:', metric);
          return;
        }
        setSelectedMetricData({
          category: categoryObj,
          metric: { ...metric },
        });
        setActiveOption('metrics');
        navigate('/metrics');
      }
    },
    [widgetSetupModal, activeDashboard, metrics, setActiveOption, setSelectedMetricData, navigate, dashboards]
  );

  const handleMetricDataChange = useCallback(
    (newMetricData) => {
      setSelectedMetricData(newMetricData);
    },
    [setSelectedMetricData]
  );

  const handleOpenProfileModal = useCallback(() => {
    setIsProfileModalOpen(true);
  }, []);

  const handleCloseProfileModal = useCallback(() => {
    setIsProfileModalOpen(false);
  }, []);

  const handleDashboardChange = useCallback(
    (dashboardId) => {
      setActiveDashboardId(dashboardId);
    },
    []
  );

  const handleOpenFolderModal = useCallback(
    (folderName, onSheetSelect) => {
      folderModal.open();
      setActiveModal({
        type: 'folderModal',
        data: {
          folderName,
          onSheetSelect: (sheetName) => {
            console.log('Selected sheet:', sheetName); // Debug log
            setActiveSheetName(sheetName);
            handleSheetChange(sheetName);
            // Reset cache to force card refetch
            setSheetCardsFetched((prev) => ({
              ...prev,
              [sheetName]: false,
            }));
            window.history.pushState({}, '', `/sheets/${encodeURIComponent(sheetName)}`);
            onSheetSelect?.(sheetName);
            folderModal.close();
          },
          tempData: {},
          handleClose: () => {
            folderModal.close();
            setActiveModal(null);
          },
        },
      });
    },
    [folderModal, setActiveSheetName, handleSheetChange, setSheetCardsFetched]
  );

  useEffect(() => {
    if (activeOption !== 'metrics') {
      setSelectedMetricData(null);
    }
  }, [activeOption]);

  const modalUtilsProps = {
    sheets,
    setSheets,
    cardTemplates,
    setCardTemplates,
    editMode,
    setEditMode,
    tempData,
    setTempData,
    selectedTemplateIndex,
    setSelectedTemplateIndex,
    currentSectionIndex,
    setCurrentSectionIndex,
    dashboards,
    setDashboards,
    metrics,
    setMetrics,
    activeSheetName,
    isSheetModalEditMode,
    setIsSheetModalEditMode,
    activeModal,
    setActiveModal,
    sheetModal,
    filterModal,
    sheetsModal,
    transportModal,
    cardsTemplateModal,
    sheetFolderModal,
    folderOperationsModal,
    widgetSizeModal,
    widgetViewModal,
    widgetSetupModal,
    metricsModal,
    folderModal, // Added to modalUtilsProps
    activeDashboard,
    activeSheet,
    resolvedHeaders,
    resolvedRows,
    handleSheetChange,
    handleSheetSave,
    handleFolderSave,
    handlePinToggle,
    handleDeleteSheet,
    businessId,
    cards,
    setCards,
  };

  const showHeader =
    !['/signin', '/signup/business'].includes(location.pathname) &&
    !location.pathname.startsWith('/signup/');

  return (
    <div className={`${styles.appContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
      {currentBanner && (
        <div
          className={`${styles.banner} ${
            currentBanner.type === 'success' ? styles.success : styles.error
          } ${isDarkTheme ? styles.darkTheme : ''} ${
            isBannerExiting ? styles.bannerExit : styles.bannerVisible
          }`}
        >
          {currentBanner.message}
        </div>
      )}
      {showHeader && (
        <ProtectedRoute>
          <AppHeader
            sheets={(sheets?.structure || []).map((item) => item.sheetName || item.folderName)}
            activeSheet={activeSheetName}
            onSheetChange={handleSheetChange}
            setIsProfileModalOpen={handleOpenProfileModal}
            activeOption={activeOption}
            setActiveOption={setActiveOption}
            onOpenFolderModal={(folderName) =>
              onOpenFolderOperationsModal({ folderName, ...modalUtilsProps })
            }
            onOpenMetricsModal={() => onManageMetrics(modalUtilsProps)}
          />
        </ProtectedRoute>
      )}
      <div className={styles.contentWrapper}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard
                  onWidgetClick={handleWidgetClick}
                  activeDashboardId={activeDashboardId}
                  onDashboardChange={handleDashboardChange}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sheets"
            element={
              <ProtectedRoute>
                <Sheets
                  headers={resolvedHeaders}
                  rows={resolvedRows}
                  sheets={sheets}
                  setSheets={setSheets}
                  activeSheetName={activeSheetName}
                  onSheetChange={handleSheetChange}
                  onEditSheet={() => onEditSheet(modalUtilsProps)}
                  onFilter={() => onFilter(modalUtilsProps)}
                  onRowClick={() => {}}
                  onCardSave={() => {}}
                  onCardDelete={() => {}}
                  onOpenSheetsModal={() => onOpenSheetsModal(modalUtilsProps)}
                  onOpenTransportModal={(action, selectedRowIds, onComplete) =>
                    onOpenTransportModal({ action, selectedRowIds, onComplete, ...modalUtilsProps })
                  }
                  onOpenSheetFolderModal={() => onOpenSheetFolderModal(modalUtilsProps)}
                  onOpenFolderModal={handleOpenFolderModal}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/metrics"
            element={
              <ProtectedRoute>
                <Metrics
                  selectedMetricData={selectedMetricData}
                  onEditMetrics={() => onManageMetrics(modalUtilsProps)}
                  onMetricDataChange={handleMetricDataChange}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup/business" element={<BusinessSignUp />} />
          <Route path="/signup/:businessName/teammember/:code" element={<TeamMemberSignUp />} />
        </Routes>
        {activeModal && (
          <Modal
            onClose={(options) =>
              handleModalClose({
                options,
                handleModalSave: (args) => handleModalSave({ ...args, ...modalUtilsProps }),
                ...modalUtilsProps,
              })
            }
            onSave={() =>
              handleModalSave({
                modalType: activeModal.type,
                data: activeModal.data,
                ...modalUtilsProps,
              })
            }
            modalType={activeModal.type}
            tempData={activeModal.data}
          >
            {renderModalContent(modalUtilsProps)}
          </Modal>
        )}
        {folderModal.isOpen && (
          <Modal
            onClose={(options) =>
              handleModalClose({
                options,
                handleModalSave: (args) => handleModalSave({ ...args, ...modalUtilsProps }),
                ...modalUtilsProps,
              })
            }
            onSave={() =>
              handleModalSave({
                modalType: 'folderModal',
                data: activeModal.data,
                ...modalUtilsProps,
              })
            }
            modalType="folderModal"
            tempData={activeModal.data}
          >
            <FolderOperations
              folderName={activeModal.data.folderName}
              onSheetSelect={activeModal.data.onSheetSelect}
              tempData={activeModal.data.tempData || {}}
              setTempData={(newData) =>
                setActiveModal((prev) =>
                  prev ? { ...prev, data: { ...prev.data, tempData: newData } } : prev
                )
              }
              handleClose={activeModal.data.handleClose}
            />
          </Modal>
        )}
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={handleCloseProfileModal}
          setActiveOption={setActiveOption}
          onOpenCardsTemplateModal={() => onOpenCardsTemplateModal(modalUtilsProps)}
          onOpenSheetsModal={() => onOpenSheetsModal(modalUtilsProps)}
          onOpenMetricsModal={() => onManageMetrics(modalUtilsProps)}
        />
      </div>
    </div>
  );
}

App.propTypes = {};

export default React.memo(App);