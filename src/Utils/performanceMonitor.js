/**
 * Performance monitoring utilities
 * Helps track app performance and identify bottlenecks
 */

import React from 'react';

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.enabled = import.meta.env.DEV;
  }

  /**
   * Start timing a performance metric
   * @param {string} name - Name of the metric
   */
  startTiming(name) {
    if (!this.enabled) return;

    this.metrics.set(name, {
      startTime: performance.now(),
      startMemory: performance.memory ? performance.memory.usedJSHeapSize : 0
    });
  }

  /**
   * End timing a performance metric
   * @param {string} name - Name of the metric
   * @returns {Object} - Performance data
   */
  endTiming(name) {
    if (!this.enabled) return null;

    const startData = this.metrics.get(name);
    if (!startData) return null;

    const endTime = performance.now();
    const endMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;

    const result = {
      name,
      duration: endTime - startData.startTime,
      memoryDelta: endMemory - startData.startMemory,
      timestamp: Date.now()
    };

    this.metrics.delete(name);

    // Log slow operations
    if (result.duration > 100) {
      console.warn(`Slow operation detected: ${name} took ${result.duration.toFixed(2)}ms`);
    }

    return result;
  }

  /**
   * Measure React component render time
   * @param {string} componentName - Name of the component
   * @param {Function} callback - Function to measure
   */
  measureRender(componentName, callback) {
    if (!this.enabled) return callback();

    this.startTiming(`${componentName}-render`);
    const result = callback();
    this.endTiming(`${componentName}-render`);
    return result;
  }

  /**
   * Track bundle size changes
   */
  trackBundleSize() {
    if (!this.enabled) return;

    // This would be used with build tools to track bundle size changes
    if (window.performance && window.performance.getEntriesByType) {
      const resources = performance.getEntriesByType('resource');
      const jsResources = resources.filter(r => r.name.endsWith('.js'));

      console.log('Bundle analysis:', jsResources.map(r => ({
        name: r.name.split('/').pop(),
        size: r.transferSize,
        duration: r.duration
      })));
    }
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for performance monitoring
export const usePerformanceMonitor = () => {
  return {
    startTiming: (name) => performanceMonitor.startTiming(name),
    endTiming: (name) => performanceMonitor.endTiming(name),
    measureRender: (componentName, callback) => performanceMonitor.measureRender(componentName, callback)
  };
};

// Utility to measure expensive computations
export const measureComputation = (name, computation) => {
  performanceMonitor.startTiming(name);
  try {
    return computation();
  } finally {
    performanceMonitor.endTiming(name);
  }
};

// HOC for component performance monitoring
export const withPerformanceMonitoring = (ComponentName) => (_WrappedComponent) => {
  return React.memo((props) => {
    return performanceMonitor.measureRender(ComponentName, () => (
      <WrappedComponent {...props} />
    ));
  });
};