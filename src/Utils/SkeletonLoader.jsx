import React from 'react';
import PropTypes from 'prop-types';
import styles from './SkeletonLoader.module.css';

const SkeletonLoader = ({ 
  type = 'record', 
  count = 5, 
  className = '' 
}) => {
  const renderSkeletonItem = (index) => {
    switch (type) {
      case 'record':
        return (
          <div key={index} className={`${styles.recordSkeleton} ${className}`}>
            <div className={styles.recordSkeletonCheckbox}></div>
            <div className={styles.recordSkeletonContent}>
              <div className={styles.recordSkeletonRow}>
                <div className={styles.recordSkeletonCell}></div>
                <div className={styles.recordSkeletonCell}></div>
                <div className={styles.recordSkeletonCell}></div>
                <div className={styles.recordSkeletonCell}></div>
              </div>
            </div>
          </div>
        );
      case 'card':
        return (
          <div key={index} className={`${styles.cardSkeleton} ${className}`}>
            <div className={styles.cardSkeletonHeader}></div>
            <div className={styles.cardSkeletonBody}>
              <div className={styles.cardSkeletonLine}></div>
              <div className={styles.cardSkeletonLine}></div>
              <div className={styles.cardSkeletonLine}></div>
            </div>
          </div>
        );
      case 'table':
        return (
          <div key={index} className={`${styles.tableSkeleton} ${className}`}>
            <div className={styles.tableSkeletonHeader}>
              <div className={styles.tableSkeletonCell}></div>
              <div className={styles.tableSkeletonCell}></div>
              <div className={styles.tableSkeletonCell}></div>
              <div className={styles.tableSkeletonCell}></div>
            </div>
            <div className={styles.tableSkeletonRow}>
              <div className={styles.tableSkeletonCell}></div>
              <div className={styles.tableSkeletonCell}></div>
              <div className={styles.tableSkeletonCell}></div>
              <div className={styles.tableSkeletonCell}></div>
            </div>
          </div>
        );
      default:
        return (
          <div key={index} className={`${styles.defaultSkeleton} ${className}`}>
            <div className={styles.defaultSkeletonLine}></div>
          </div>
        );
    }
  };

  return (
    <div className={styles.skeletonContainer}>
      {Array.from({ length: count }, (_, index) => renderSkeletonItem(index))}
    </div>
  );
};

SkeletonLoader.propTypes = {
  type: PropTypes.oneOf(['record', 'card', 'table', 'default']),
  count: PropTypes.number,
  className: PropTypes.string,
};

export default SkeletonLoader;