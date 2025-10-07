import React, { useState, useEffect } from 'react';

// Initialize debug logs array
if (typeof window !== 'undefined') {
  window.debugLogs = window.debugLogs || [];
}

// Export debug logging function
export const addDebugLog = (source, message, data = null) => {
  if (typeof window === 'undefined') return;
  
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const logEntry = data 
    ? `[${timestamp}] [${source}] ${message}: ${JSON.stringify(data, null, 2)}`
    : `[${timestamp}] [${source}] ${message}`;
  
  window.debugLogs = window.debugLogs || [];
  window.debugLogs.push(logEntry);
  
  // Keep only last 100 logs to prevent memory issues
  if (window.debugLogs.length > 100) {
    window.debugLogs = window.debugLogs.slice(-100);
  }
  
  // Also log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(logEntry);
  }
};

const DebugPanel = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    // Only show in development
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    // Update logs when window.debugLogs changes
    const updateLogs = () => {
      setLogs([...window.debugLogs]);
    };

    // Initial load
    updateLogs();

    // Poll for updates (since we can't use proxies easily)
    const interval = setInterval(updateLogs, 1000);

    return () => clearInterval(interval);
  }, []);

  // Don't render anything in production
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  const clearLogs = () => {
    window.debugLogs = [];
    setLogs([]);
  };

  const copyToClipboard = () => {
    const logText = logs.join('\n');
    navigator.clipboard.writeText(logText).then(() => {
      alert('Debug logs copied to clipboard!');
    });
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={toggleVisibility}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 10000,
          padding: '8px 12px',
          backgroundColor: '#007acc',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
        }}
      >
        {isVisible ? 'Hide' : 'Show'} Debug
      </button>

      {/* Debug Panel */}
      {isVisible && (
        <div
          style={{
            position: 'fixed',
            bottom: '60px',
            right: '20px',
            width: '400px',
            height: '300px',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            borderRadius: '8px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'monospace',
            fontSize: '12px',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid #444',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>Debug Logs ({logs.length})</span>
            <div>
              <button
                onClick={copyToClipboard}
                style={{
                  marginRight: '8px',
                  padding: '2px 6px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '10px',
                }}
              >
                Copy
              </button>
              <button
                onClick={clearLogs}
                style={{
                  padding: '2px 6px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '10px',
                }}
              >
                Clear
              </button>
            </div>
          </div>

          {/* Logs */}
          <div
            style={{
              flex: 1,
              padding: '8px',
              overflowY: 'auto',
              fontSize: '11px',
              lineHeight: '1.4',
            }}
          >
            {logs.length === 0 ? (
              <div style={{ color: '#888' }}>No debug logs yet...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} style={{ marginBottom: '2px' }}>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default DebugPanel;