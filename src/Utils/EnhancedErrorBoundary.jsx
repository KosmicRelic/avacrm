import React from 'react';
import PropTypes from 'prop-types';

/**
 * Enhanced Error Boundary with retry functionality and better error reporting
 */
class EnhancedErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(_error) {
    // Generate unique error ID for tracking
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      hasError: true,
      errorId
    };
  }

  componentDidCatch(error, errorInfo) {
    // Enhanced error logging with more context
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      errorId: this.state.errorId
    };

    // Log to console in development
    if (import.meta.env.DEV) {
      console.group('🚨 Enhanced Error Boundary Caught Error');
      console.error('Error Details:', errorDetails);
      console.error('Error Object:', error);
      console.error('Error Info:', errorInfo);
      console.groupEnd();
    }

    // Store error details in state
    this.setState({
      error,
      errorInfo,
      ...errorDetails
    });

    // Could send to error reporting service here
    // Example: errorReportingService.captureException(error, { extra: errorDetails });
  }

  handleRetry = () => {
    const { retryCount } = this.state;
    const maxRetries = this.props.maxRetries || 3;

    if (retryCount < maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1
      }));
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0
    });
  };

  render() {
    if (this.state.hasError) {
      const { retryCount } = this.state;
      const maxRetries = this.props.maxRetries || 3;
      const canRetry = retryCount < maxRetries;

      return (
        <div style={{
          padding: '20px',
          margin: '20px',
          border: '1px solid #ff6b6b',
          borderRadius: '8px',
          backgroundColor: '#ffeaea',
          color: '#d63031',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '24px', marginRight: '12px' }}>⚠️</span>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
              Something went wrong
            </h3>
          </div>

          <p style={{ margin: '0 0 16px 0', lineHeight: '1.5' }}>
            The application encountered an unexpected error. This has been logged and we're working to fix it.
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {canRetry && (
              <button
                onClick={this.handleRetry}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#0984e3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Try Again ({maxRetries - retryCount} attempts left)
              </button>
            )}

            <button
              onClick={this.handleReset}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6c5ce7',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Reset Component
            </button>

            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 16px',
                backgroundColor: '#d63031',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Reload Page
            </button>
          </div>

          {import.meta.env.DEV && (
            <details style={{ marginTop: '20px' }}>
              <summary style={{
                cursor: 'pointer',
                fontWeight: '500',
                marginBottom: '8px'
              }}>
                🔧 Error Details (Development Only)
              </summary>
              <div style={{
                backgroundColor: '#f8f9fa',
                padding: '12px',
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: 'monospace',
                overflow: 'auto',
                maxHeight: '300px'
              }}>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Error ID:</strong> {this.state.errorId}
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Message:</strong> {this.state.error && this.state.error.toString()}
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Retry Count:</strong> {retryCount}/{maxRetries}
                </div>
                <div>
                  <strong>Component Stack:</strong>
                  <pre style={{
                    whiteSpace: 'pre-wrap',
                    margin: '8px 0 0 0',
                    fontSize: '11px'
                  }}>
                    {this.state.errorInfo && this.state.errorInfo.componentStack}
                  </pre>
                </div>
              </div>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

EnhancedErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  maxRetries: PropTypes.number
};

EnhancedErrorBoundary.defaultProps = {
  maxRetries: 3
};

export default EnhancedErrorBoundary;