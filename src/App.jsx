import React, { useState, useCallback, useMemo, useContext, useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import PropTypes from 'prop-types';
import { IoCheckmarkCircle, IoCloseCircle } from 'react-icons/io5';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase.jsx';
import AppHeader from './App Header/AppHeader';
import { MainContext } from './Contexts/MainContext';
import styles from './App.module.css';
import useModal from './Modal/Hooks/UseModal';
import useSheets from './Modal/Hooks/UseSheets';

// Lazy load modal components
const Modal = lazy(() => import('./Modal/Modal'));
const ProfileModal = lazy(() => import('./Profile Modal/ProfileModal'));
import BusinessSignUp from './Account Componenets/SignUp/BusinessSignUp';
import TeamMemberSignUp from './Account Componenets/SignUp/TeamMemberSignUp.jsx';
import SignIn from './Account Componenets/SignIn/SignIn.jsx';
import {
  handleModalSave,
  handleModalClose,
  renderModalContent,
  onEditSheet,
  onFilter,
  onManageMetrics,
  onOpenSheetsModal,
  onOpenTransportModal,
  onOpenSheetFolderModal,
  onOpenFolderModal,
} from './Utils/ModalUtils.jsx';
import { deleteSheetFromFirestore } from './Utils/firestoreSheetUtils';
import ErrorBoundary from './Utils/ErrorBoundary';
import DebugPanel from './Utils/DebugPanel';

// Debug logging utility
const addDebugLog = (message) => {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = `[${timestamp}] ${message}`;
  if (window.debugLogs) {
    window.debugLogs.push(logEntry);
  }
  console.log(logEntry);
};

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

// Lazy load major components for code splitting
const Sheets = lazy(() => import('./Sheets/Sheets'));
const Dashboard = lazy(() => import('./Dashboard/Dashboard'));
const Workflows = lazy(() => import('./Workflows'));
const Metrics = lazy(() => import('./Metrics/Metrics'));
const Settings = lazy(() => import('./Settings/Settings'));
const Actions = lazy(() => import('./Actions/Actions'));

// Loading component for lazy-loaded routes
const LoadingSpinner = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '18px',
    color: '#666'
  }}>
    <div>Loading...</div>
  </div>
);

function hasDashboardAccess(user) {
  if (!user) return false;
  if (user.uid === user.businessId) return true;
  return user.permissions?.dashboard === 'editor' || user.permissions?.dashboard === 'viewer';
}

function App() {
  const {
    sheets,
    setSheets,
    records,
    setRecords,
    templateObjects,
    setTemplateObjects,
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
    sheetRecordsFetched: _sheetRecordsFetched,
    setSheetRecordsFetched,
    setRecordsCache,
  } = useContext(MainContext);

  const location = useLocation();
  const navigate = useNavigate();
  const _params = useParams();
  const sheetModal = useModal();
  const filterModal = useModal();
  const sheetsModal = useModal();
  const transportModal = useModal();
  const sheetFolderModal = useModal();
  const folderModal = useModal();
  const widgetSizeModal = useModal();
  const widgetViewModal = useModal();
  const widgetSetupModal = useModal();
  const metricsModal = useModal();
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

  // Only redirect if user tries to access /dashboard and does not have access
  useEffect(() => {
    if (!userAuthChecked || !user) return;
    if (location.pathname === '/dashboard' && !hasDashboardAccess(user)) {
      navigate('/sheets', { replace: true });
    }
  }, [user, userAuthChecked, location.pathname, navigate]);

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

  const { handleSheetChange, handleSaveSheet: _handleSaveSheet } = useSheets(sheets, setSheets, activeSheetName);

  const resolvedHeaders = useMemo(() => {
    if (!activeSheet) return [];
    return (activeSheet.headers || []).map((header) => ({
      ...header,
      type: header.type === 'picklist' ? 'dropdown' : header.type, // Convert legacy picklist to dropdown
      visible: header.visible !== false,
      hidden: header.hidden || false,
    }));
  }, [activeSheet]);

  const resolvedRows = useMemo(() => {
    if (!activeSheet || !records) return [];
    return activeSheet.rows?.map((rowId) => records.find((record) => record.id === rowId) || {}) || [];
  }, [activeSheet, records]);

  useEffect(() => {
    if (location.pathname === '/dashboard') {
      setActiveOption('dashboard');
    } else if (location.pathname === '/workflows') {
      setActiveOption('workflows');
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
    async (sheetName) => {
      if (!sheets) return;
      const sheetToDelete = sheets.allSheets.find((sheet) => sheet.sheetName === sheetName);
      if (!sheetToDelete) return;

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

        return {
          ...prev,
          allSheets: updatedAllSheets.map((sheet) => ({
            ...sheet,
            isActive: false, // No sheet is active after deletion
            isModified: sheet.sheetName === sheetName ? true : sheet.isModified,
            action: sheet.sheetName === sheetName ? 'remove' : sheet.action,
          })),
          structure: updatedStructure,
          deletedSheetId: sheetToDelete.docId, // Pass docId for team members update
        };
      });

      if (sheetToDelete.docId && businessId) {
        try {
          await deleteSheetFromFirestore(businessId, sheetToDelete.docId);
        } catch (e) {
          // Optionally show error to user
          console.error('Failed to delete sheet from Firestore:', e);
        }
      }

      if (activeSheetName === sheetName) {
        setActiveSheetName(null);
        handleSheetChange(null);
        // Update URL to /sheets
        if (window.location.pathname !== '/sheets') {
          window.history.replaceState({}, '', '/sheets');
        }
      }
    },
    [setSheets, sheets, activeSheetName, setActiveSheetName, handleSheetChange, businessId]
  );

  const handleRecordSave = useCallback(
    async (recordData) => {
      if (!businessId) {
        return;
      }

      if (!recordData.docId) {
        return;
      }

      try {
        // Determine the correct collection based on record type
        const collectionName = recordData.isObject ? 'objects' : 'records';
        const docPath = `businesses/${businessId}/${collectionName}/${recordData.docId}`;
        
        // Create a clean copy without system fields that might cause issues
        const { isModified, action, ...cleanRecordData } = recordData;
        
        await setDoc(doc(db, docPath), cleanRecordData);
      } catch (error) {
        console.error('Failed to save record to Firebase:', error);
      }
    },
    [businessId]
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
            setActiveSheetName(sheetName);
            handleSheetChange(sheetName);
            setSheetRecordsFetched((prev) => ({
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
    [folderModal, setActiveSheetName, handleSheetChange, setSheetRecordsFetched]
  );

  useEffect(() => {
    if (activeOption !== 'metrics') {
      setSelectedMetricData(null);
    }
  }, [activeOption]);

  const modalUtilsProps = {
    sheets,
    setSheets,
    templateObjects,
    setTemplateObjects,
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
    sheetFolderModal,
    widgetSizeModal,
    widgetViewModal,
    widgetSetupModal,
    metricsModal,
    folderModal,
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
    records,
    setRecords,
    clearFetchedSheets: (sheetId) => {
      if (sheetId) {
        // Clear cache for specific sheet
        setSheetRecordsFetched((prev) => {
          const newFetched = { ...prev };
          delete newFetched[sheetId];
          return newFetched;
        });
        setRecordsCache((prev) => {
          const newCache = { ...prev };
          delete newCache[sheetId];
          return newCache;
        });
      } else {
        // Clear all caches if no specific sheet ID
        setSheetRecordsFetched({});
        setRecordsCache({});
      }
    },
  };

  // Show header and main content immediately, even if data is not yet loaded
  // Sheets and AppHeader will receive empty arrays/objects at first, and update as data arrives
  const showHeader =
    !['/signin', '/signup/business'].includes(location.pathname) &&
    !location.pathname.startsWith('/signup/');

  return (
    <ErrorBoundary>
      <div className={`${styles.appContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
      {currentBanner && (
        <div
          className={`${styles.banner} ${
            currentBanner.type === 'success' ? styles.success : styles.error
          } ${isDarkTheme ? styles.darkTheme : ''} ${
            isBannerExiting ? styles.bannerExit : styles.bannerVisible
          }`}
        >
          {currentBanner.type === 'success' ? (
            <IoCheckmarkCircle size={18} />
          ) : (
            <IoCloseCircle size={18} />
          )}
          <span>{currentBanner.message}</span>
        </div>
      )}
      {showHeader && (
        <ProtectedRoute>
          <AppHeader
            sheets={(sheets?.structure || []).map((item) => item.sheetName || item.folderName) || []}
            activeSheet={activeSheetName}
            onSheetChange={handleSheetChange}
            setIsProfileModalOpen={handleOpenProfileModal}
            activeOption={activeOption}
            setActiveOption={setActiveOption}
            onOpenFolderModal={(folderName) =>
              onOpenFolderModal({ folderName, ...modalUtilsProps })
            }
            onOpenMetricsModal={() => onManageMetrics(modalUtilsProps)}
          />
        </ProtectedRoute>
      )}
      <div className={styles.contentWrapper}>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/" element={<Navigate to="/sheets" replace />} />
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
                    onRecordSave={handleRecordSave}
                    onRecordDelete={() => {}}
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
              path="/sheets/:sheetName"
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
                    onRecordSave={handleRecordSave}
                    onRecordDelete={() => {}}
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
              path="/sheets/:sheetName/:recordId"
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
                    onRecordSave={handleRecordSave}
                    onRecordDelete={() => {}}
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
              path="/workflows"
              element={
                <ProtectedRoute>
                  <Workflows />
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
              path="/actions"
              element={
                <ProtectedRoute>
                  <Actions />
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
        </Suspense>
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
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={handleCloseProfileModal}
          setActiveOption={setActiveOption}
          onOpenSheetsModal={() => onOpenSheetsModal(modalUtilsProps)}
          onOpenMetricsModal={() => onManageMetrics(modalUtilsProps)}
        />
        <DebugPanel />
      </div>
    </div>
    </ErrorBoundary>
  );
}

App.propTypes = {};

export default React.memo(App);