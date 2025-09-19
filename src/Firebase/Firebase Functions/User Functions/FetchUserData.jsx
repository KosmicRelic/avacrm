import { collection, doc, getDocs, getDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../../firebase';

// Module-level cache to track fetched sheets and current businessId
const fetchedSheets = new Map(); // Maps sheetId to Map of typeOfRecords to { filters }
let currentBusinessId = null;

// Helper: Derive structure from sheets
const deriveStructureFromSheets = (sheets) => sheets.map((sheet) => ({ sheetName: sheet.sheetName }));

const fetchUserData = async ({
  businessId,
  route,
  setSheets,
  setRecords,
  setTemplateProfiles,
  setMetrics,
  setDashboards,
  setActions,
  activeSheetName,
  updateSheets = false,
}) => {
  // Helper to fetch collection data with error handling
  const fetchCollection = async (path, setState, defaultValue, errorMessage) => {
    try {
      const snapshot = await getDocs(path);
      const data = snapshot.docs.map((doc) => ({
        docId: doc.id,
        ...doc.data(),
      }));
      setState(data);
    } catch (error) {
      console.error(errorMessage, {
        code: error.code,
        message: error.message,
        businessId,
        path: path.path,
        userId: auth.currentUser?.uid || 'unknown',
        timestamp: new Date().toISOString(),
      });
      setState(defaultValue);
    }
  };

  // Check if user is a team member
  const isTeamMember = async () => {
    const user = auth.currentUser;
    if (!user || user.uid === businessId) return false; // Business owner
    const teamMemberDoc = await getDoc(doc(db, 'businesses', businessId, 'teamMembers', user.uid));
    return teamMemberDoc.exists();
  };

  // Fetch allowedSheetIds for team members
  const getAllowedSheetIds = async () => {
    const user = auth.currentUser;
    if (!user || user.uid === businessId) return null; // Business owner
    const teamMemberDoc = await getDoc(doc(db, 'businesses', businessId, 'teamMembers', user.uid));
    if (teamMemberDoc.exists()) {
      const data = teamMemberDoc.data();
      return data.allowedSheetIds || data.permissions?.sheets?.allowedSheetIds || [];
    }
    return [];
  };

  // Reset cache only if businessId changes
  if (businessId !== currentBusinessId && fetchedSheets.size > 0) {
    fetchedSheets.clear();
    currentBusinessId = businessId;
  }

  // Fetch data based on the route
  if (route && route.startsWith('/sheets/')) {
    // Extract sheetName from route and decode dashes to spaces
    const sheetNameFromUrl = decodeURIComponent(route.replace('/sheets/', '')).replace(/-/g, ' ');
    // Fetch all sheets, then filter for the one matching sheetNameFromUrl
    let allSheets = [];
    let structureData = [];
    try {
      const sheetsSnapshot = await getDocs(collection(db, 'businesses', businessId, 'sheets'));
      allSheets = sheetsSnapshot.docs.map((doc) => ({ docId: doc.id, ...doc.data() }));
      const matchingSheet = allSheets.find(sheet => sheet.sheetName === sheetNameFromUrl);
      // Always set the full structure and all sheets, not just the single sheet
      structureData = deriveStructureFromSheets(allSheets);
      setSheets && setSheets({ allSheets, structure: structureData });
      if (matchingSheet) {
        const recordsSnapshot = await getDocs(collection(db, 'businesses', businessId, 'sheets', matchingSheet.docId, 'records'));
        const records = recordsSnapshot.docs.map((doc) => ({ docId: doc.id, ...doc.data() }));
        setRecords && setRecords(records);
        // Optionally fetch templates, metrics, etc. as needed
      } else {
        setRecords && setRecords([]);
        console.warn('[FetchUserData.jsx] No matching sheet found for:', sheetNameFromUrl);
      }
    } catch (error) {
      console.error('[FetchUserData.jsx] Error fetching sheet/records for:', sheetNameFromUrl, error);
      setSheets && setSheets({ allSheets: [], structure: [] });
      setRecords && setRecords([]);
    }
    return;
  }
  if (route === '/sheets') {
    let allSheets = [];
    let structureData = [];
    let allowedSheetIds = null;
    if (updateSheets) {
      try {
        const isBusinessUser = auth.currentUser?.uid === businessId;
        allowedSheetIds = await getAllowedSheetIds();
        const unsubscribeFunctions = [];

        if (!isBusinessUser) {
          // For team members, set up real-time listeners for their allowed sheets
          if (allowedSheetIds && allowedSheetIds.length > 0) {
            let currentTeamMemberSheets = [];
            let currentAllowedSheetIds = allowedSheetIds;
            
            // First, set up a listener for the team member's permissions document
            // This ensures they get updates when their permissions change
            const teamMemberPermissionsUnsubscribe = onSnapshot(
              doc(db, 'businesses', businessId, 'teamMembers', auth.currentUser.uid),
              (teamMemberDoc) => {
                if (teamMemberDoc.exists()) {
                  const newAllowedSheetIds = teamMemberDoc.data().permissions?.sheets?.allowedSheetIds || [];
                  // If permissions changed, we need to refetch sheets
                  if (JSON.stringify(newAllowedSheetIds) !== JSON.stringify(currentAllowedSheetIds)) {
                    currentAllowedSheetIds = newAllowedSheetIds;
                    // The sheets listener will automatically update with the new permissions
                  }
                } else {
                  // Team member document was deleted - clear all sheets
                  setSheets && setSheets({ allSheets: [], structure: [] });
                }
              },
              (error) => {
                console.error('Error in team member permissions listener:', error);
              }
            );
            
            // Set up real-time listener for sheets collection (filtered to allowed sheets)
            const sheetsUnsubscribe = onSnapshot(
              collection(db, 'businesses', businessId, 'sheets'),
              (sheetsSnapshot) => {
                // Filter to only allowed sheets for this team member
                currentTeamMemberSheets = sheetsSnapshot.docs
                  .filter(doc => currentAllowedSheetIds.includes(doc.id))
                  .map(doc => ({
                    docId: doc.id,
                    ...doc.data(),
                  }));

                const structureData = deriveStructureFromSheets(currentTeamMemberSheets);
                
                // Update sheets in state
                setSheets && setSheets({
                  allSheets: currentTeamMemberSheets,
                  structure: structureData
                });
              },
              (error) => {
                console.error('Error in team member sheets real-time listener:', error);
                setSheets && setSheets({ allSheets: [], structure: [] });
              }
            );

            // Also listen to structure changes (team members should see folder organization)
            const structureUnsubscribe = onSnapshot(
              doc(db, 'businesses', businessId, 'sheetsStructure', 'structure'),
              (structureDoc) => {
                let newStructureData = [];
                if (structureDoc.exists()) {
                  const structure = structureDoc.data().structure;
                  // Filter structure to only include allowed sheets
                  newStructureData = Array.isArray(structure) && structure.length > 0
                    ? structure.filter(item => {
                        if (item.sheetName) {
                          // Single sheet - check if allowed
                          const sheet = currentTeamMemberSheets.find(s => s.sheetName === item.sheetName);
                          return !!sheet;
                        } else if (item.folderName && item.sheets) {
                          // Folder - filter to only allowed sheets
                          const allowedSheetsInFolder = item.sheets.filter(sheetName => 
                            currentTeamMemberSheets.some(s => s.sheetName === sheetName)
                          );
                          return allowedSheetsInFolder.length > 0 ? 
                            { ...item, sheets: allowedSheetsInFolder } : null;
                        }
                        return false;
                      }).filter(Boolean)
                    : deriveStructureFromSheets(currentTeamMemberSheets);
                } else {
                  newStructureData = deriveStructureFromSheets(currentTeamMemberSheets);
                }

                // Update structure in state
                setSheets && setSheets((prevSheets) => ({
                  ...prevSheets,
                  structure: newStructureData,
                }));
              },
              (error) => {
                console.error('Error in team member structure real-time listener:', error);
              }
            );

            unsubscribeFunctions.push(teamMemberPermissionsUnsubscribe, sheetsUnsubscribe, structureUnsubscribe);
          } else {
            setSheets && setSheets({ allSheets: [], structure: [] });
          }
        } else {
          // For business users, set up real-time listeners
          let currentAllSheets = [];
          
          // Real-time listener for sheets collection
          const sheetsUnsubscribe = onSnapshot(
            collection(db, 'businesses', businessId, 'sheets'),
            (sheetsSnapshot) => {
              currentAllSheets = sheetsSnapshot.docs.map((doc) => ({
                docId: doc.id,
                ...doc.data(),
              }));

              // Update sheets in state
              setSheets && setSheets((prevSheets) => ({
                ...prevSheets,
                allSheets: currentAllSheets,
              }));
            },
            (error) => {
              console.error('Error in sheets real-time listener:', error);
              setSheets && setSheets({ allSheets: [], structure: [] });
            }
          );

          // Real-time listener for sheets structure document
          const structureUnsubscribe = onSnapshot(
            doc(db, 'businesses', businessId, 'sheetsStructure', 'structure'),
            (structureDoc) => {
              let newStructureData = [];
              if (structureDoc.exists()) {
                const structure = structureDoc.data().structure;
                newStructureData = Array.isArray(structure) && structure.length > 0
                  ? structure
                  : deriveStructureFromSheets(currentAllSheets);
              } else {
                newStructureData = deriveStructureFromSheets(currentAllSheets);
              }

              // Update structure in state
              setSheets && setSheets((prevSheets) => ({
                ...prevSheets,
                structure: newStructureData,
              }));
            },
            (error) => {
              console.error('Error in structure real-time listener:', error);
            }
          );

          unsubscribeFunctions.push(sheetsUnsubscribe, structureUnsubscribe);
        }
        // PHASE 2: Defer templateProfiles, metrics, dashboards fetch to background
        setTimeout(() => {
          // Set up real-time listener for template profiles (new structure)
          const templateProfilesUnsubscribe = onSnapshot(
            collection(db, 'businesses', businessId, 'templateProfiles'),
            (templateProfilesSnapshot) => {
              // Store original profiles for pipeline access
              if (setTemplateProfiles) {
                const profiles = templateProfilesSnapshot.docs.map((doc) => ({
                  id: doc.id,
                  ...doc.data(),
                }));
                setTemplateProfiles(profiles);
              }
            },
            (error) => {
              console.error('Error in template profiles real-time listener:', error);
            }
          );
          
          // Store the unsubscribe function
          unsubscribeFunctions.push(templateProfilesUnsubscribe);
          
          // Set up real-time listener for metrics
          const metricsUnsubscribe = onSnapshot(
            collection(db, 'businesses', businessId, 'metrics'),
            (metricsSnapshot) => {
              setMetrics && setMetrics(
                metricsSnapshot.docs.map((doc) => ({
                  docId: doc.id,
                  ...doc.data(),
                }))
              );
            },
            (error) => {
              console.error('Error in metrics real-time listener:', error);
            }
          );
          
          // Set up real-time listener for dashboards
          const dashboardsUnsubscribe = onSnapshot(
            collection(db, 'businesses', businessId, 'dashboards'),
            (dashboardsSnapshot) => {
              setDashboards && setDashboards(
                dashboardsSnapshot.docs.map((doc) => ({
                  docId: doc.id,
                  ...doc.data(),
                }))
              );
            },
            (error) => {
              console.error('Error in dashboards real-time listener:', error);
            }
          );
          
          // Store the unsubscribe functions
          unsubscribeFunctions.push(metricsUnsubscribe, dashboardsUnsubscribe);
        }, 0);

        // Return combined unsubscribe function for sheet structure listeners
        return () => {
          unsubscribeFunctions.forEach(unsub => {
            if (typeof unsub === 'function') {
              unsub();
            }
          });
        };
      } catch (error) {
        console.error('Error fetching sheets:', {
          code: error.code,
          message: error.message,
          businessId,
          path: `businesses/${businessId}/sheets`,
          userId: auth.currentUser?.uid || 'unknown',
          timestamp: new Date().toISOString(),
        });
        setSheets && setSheets({ allSheets: [], structure: [] });
        setRecords && setRecords([]);
        
        // Return combined unsubscribe function for any listeners that were set up
        return () => {
          unsubscribeFunctions.forEach(unsub => {
            if (typeof unsub === 'function') {
              unsub();
            }
          });
        };
      }
    } else {
      try {
        // Only fetch sheets for active sheet
        const sheetsSnapshot = await getDocs(collection(db, 'businesses', businessId, 'sheets'));
        allSheets = sheetsSnapshot.docs.map((doc) => ({
          docId: doc.id,
          ...doc.data(),
        }));
      } catch (error) {
        console.error('Error fetching sheets for active sheet:', {
          code: error.code,
          message: error.message,
          businessId,
          path: `businesses/${businessId}/sheets`,
          userId: auth.currentUser?.uid || 'unknown',
          timestamp: new Date().toISOString(),
        });
        setRecords && setRecords([]);
        return () => {}; // For React Suspense compatibility
      }
    }

    // Determine which sheet to use
    let sheetNameToUse = activeSheetName;
    // Always normalize the sheet name to avoid recordId issues
    sheetNameToUse = normalizeSheetName(sheetNameToUse);

    if (!sheetNameToUse && updateSheets) {
      const structure = structureData || [];
      if (structure.length > 0) {
        if (structure[0].sheetName) {
          sheetNameToUse = structure[0].sheetName;
        } else if (structure[0].folderName && structure[0].sheets?.length > 0) {
          sheetNameToUse = structure[0].sheets[0];
        }
      }
    }
    if (!sheetNameToUse) {
      const leadsSheet = allSheets.find((s) => s.sheetName === 'Leads');
      sheetNameToUse = leadsSheet ? 'Leads' : allSheets[0]?.sheetName;
    }

    const activeSheet = allSheets.find((s) => s.sheetName === sheetNameToUse);
    if (!activeSheet) {
      setRecords && setRecords([]);
      return () => {}; // For React Suspense compatibility
    }

    const sheetId = activeSheet.docId;
    const typeOfRecordsToDisplay = activeSheet.typeOfRecordsToDisplay || [];
    const recordTypeFilters = activeSheet.recordTypeFilters || {};

    // Initialize cache for this sheetId if not present
    if (!fetchedSheets.has(sheetId)) {
      fetchedSheets.set(sheetId, new Map());
    }

    // Fetch records based on typeOfRecordsToDisplay and recordTypeFilters with real-time updates
    try {
      if (!Array.isArray(typeOfRecordsToDisplay) || typeOfRecordsToDisplay.length === 0) {
        setRecords && setRecords([]);
        return () => {}; // Return empty unsubscribe function
      }

      const unsubscribeFunctions = [];
      const recordsByType = new Map(); // Store records by type locally

      for (const type of typeOfRecordsToDisplay) {
        // Invalidate cache if recordTypeFilters have changed
        const cachedFilters = fetchedSheets.get(sheetId)?.get(type)?.filters;
        const currentFilters = recordTypeFilters[type] || {};
        if (cachedFilters && JSON.stringify(cachedFilters) !== JSON.stringify(currentFilters)) {
          fetchedSheets.get(sheetId).delete(type);
        }

        // Check if this record type has already been fetched for this sheet
        if (fetchedSheets.get(sheetId).has(type)) {
          continue;
        }
        fetchedSheets.get(sheetId).set(type, { filters: currentFilters });

        let recordQuery = query(
          collection(db, 'businesses', businessId, 'records'),
          where('typeOfRecords', '==', type)
        );

        // Apply recordTypeFilters for this record type
        const filters = recordTypeFilters[type] || {};
        const clientSideFilters = [];

        // Remove all orderBy logic: only apply .where() for range/value filters
        Object.entries(filters).forEach(([field, filter]) => {
          if (field === 'userFilter') return; // Skip userFilter as it's handled above
          if (filter.start || filter.end) {
            // Range filter
            if (filter.start) {
              recordQuery = query(recordQuery, where(field, '>=', filter.start));
            }
            if (filter.end) {
              recordQuery = query(recordQuery, where(field, '<=', filter.end));
            }
          } else if (filter.value && filter.order) {
            // Single value filter
            const operatorMap = {
              equals: '==',
              greater: '>',
              less: '<',
              greaterOrEqual: '>=',
              lessOrEqual: '<=',
              on: '==',
              before: '<',
              after: '>',
            };
            const operator = operatorMap[filter.order] || '==';
            recordQuery = query(recordQuery, where(field, operator, filter.value));
          } else if (filter.values && filter.values.length > 0) {
            // Dropdown (array contains) filter
            recordQuery = query(recordQuery, where(field, 'in', filter.values));
          } else if (filter.condition && filter.value) {
            // Text filter
            if (filter.condition === 'equals') {
              recordQuery = query(recordQuery, where(field, '==', filter.value));
            } else {
              // Non-equals text filters (contains, startsWith, endsWith) are handled client-side
              clientSideFilters.push({ field, filter });
            }
          }
        });

        // Set up real-time listener with BATCHED updates for massive scale
        let updateBatch = [];
        let batchTimeout = null;
        
        const unsubscribe = onSnapshot(recordQuery, (snapshot) => {
          // Collect all changes in a batch instead of processing immediately
          snapshot.docChanges().forEach((change) => {
            updateBatch.push({ change, type, clientSideFilters });
          });

          // Debounce updates to handle rapid changes efficiently
          clearTimeout(batchTimeout);
          batchTimeout = setTimeout(() => {
            if (updateBatch.length === 0) return;

            // Process entire batch at once (much more efficient)
            let hasAnyChanges = false;

            updateBatch.forEach(({ change, type: batchType, clientSideFilters: filters }) => {
              let recordData = {
                docId: change.doc.id,
                ...change.doc.data(),
              };

              // Apply client-side filtering
              let passesFilter = true;
              if (filters.length > 0) {
                passesFilter = filters.every(({ field, filter }) => {
                  const recordValue = String(recordData[field] || '').toLowerCase();
                  const filterValue = filter.value?.toLowerCase() || '';
                  switch (filter.condition) {
                    case 'contains': return recordValue.includes(filterValue);
                    case 'startsWith': return recordValue.startsWith(filterValue);
                    case 'endsWith': return recordValue.endsWith(filterValue);
                    default: return true;
                  }
                });
              }

              // Get current records for this type (use array for O(1) operations)
              let currentRecords = recordsByType.get(batchType) || [];

              if (change.type === 'added' && passesFilter) {
                // Direct push instead of spread (much faster)
                currentRecords.push(recordData);
                hasAnyChanges = true;
              } else if (change.type === 'modified') {
                // Find and update in place (O(n) but unavoidable)
                const index = currentRecords.findIndex(record => record.docId === recordData.docId);
                if (passesFilter) {
                  if (index >= 0) {
                    currentRecords[index] = recordData; // In-place update
                  } else {
                    currentRecords.push(recordData); // Add if not found
                  }
                  hasAnyChanges = true;
                } else if (index >= 0) {
                  currentRecords.splice(index, 1); // Remove if doesn't pass filter
                  hasAnyChanges = true;
                }
              } else if (change.type === 'removed') {
                const index = currentRecords.findIndex(record => record.docId === recordData.docId);
                if (index >= 0) {
                  currentRecords.splice(index, 1);
                  hasAnyChanges = true;
                }
              }

              recordsByType.set(batchType, currentRecords);
            });

            // Single state update for entire batch (MASSIVE performance gain)
            if (hasAnyChanges && setRecords) {
              const allRealTimeRecords = [];
              for (const recordType of typeOfRecordsToDisplay) {
                const recordsForType = recordsByType.get(recordType) || [];
                allRealTimeRecords.push(...recordsForType);
              }
              
              setRecords(allRealTimeRecords);
            }

            // Clear batch for next round
            updateBatch = [];
          }, 16); // 60fps batching - smooth but not overwhelming
        });

        unsubscribeFunctions.push(unsubscribe);
      }

      // Return combined unsubscribe function
      return () => {
        unsubscribeFunctions.forEach(unsub => unsub());
        // Clean up the temporary real-time records storage
        if (window.realTimeRecords) {
          for (const type of typeOfRecordsToDisplay) {
            window.realTimeRecords.delete(type);
          }
        }
      };
    } catch (error) {
      console.error('Error fetching records:', {
        code: error.code,
        message: error.message,
        businessId,
        sheetId,
        sheetName: sheetNameToUse,
        typeOfRecordsToDisplay,
        recordTypeFilters,
        userId: auth.currentUser?.uid || 'unknown',
        timestamp: new Date().toISOString(),
      });
      setRecords && setRecords([]);
      return () => {}; // Return empty unsubscribe function
    }
  } else if (route === '/dashboard' || route === '/metrics') {
    // Parallelize dashboard and metrics fetches
    await Promise.all([
      fetchCollection(
        collection(db, 'businesses', businessId, 'dashboards'),
        setDashboards,
        [],
        'Error fetching dashboards:'
      ),
      fetchCollection(
        collection(db, 'businesses', businessId, 'metrics'),
        setMetrics,
        [],
        'Error fetching metrics:'
      ),
    ]);
  } else if (route === '/actions') {
    // Fetch actions collection
    await fetchCollection(
      collection(db, 'businesses', businessId, 'actions'),
      setActions,
      [],
      'Error fetching actions:'
    );
  }

  return () => {}; // For React Suspense compatibility
};

// Utility to normalize sheet names (replace dashes with spaces, ignore recordId if present)
const normalizeSheetName = (name) => {
  if (!name) return name;
  return name.split('/')[0].replace(/-/g, ' ');
};

export const resetFetchedSheetIds = () => {
  fetchedSheets.clear();
  currentBusinessId = null;
};

export default fetchUserData;