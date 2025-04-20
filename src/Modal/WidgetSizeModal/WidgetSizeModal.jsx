// src/Modal/WidgetSizeModal/WidgetSizeModal.js
import React, { useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useSwipeable } from 'react-swipeable';
import styles from './WidgetSizeModal.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { ModalNavigatorContext } from '../../Contexts/ModalNavigator';
import { FaCircle } from 'react-icons/fa';

const WidgetSizeModal = ({ handleClose, onSelectSize }) => {
  const { isDarkTheme } = useContext(MainContext);
  const { registerModalSteps, setModalConfig } = useContext(ModalNavigatorContext);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const steps = [{
      title: 'Select Widget Size',
      rightButton: null,
    }];

    setModalConfig({
      showTitle: true,
      showDoneButton: true,
      showBackButton: false,
      title: 'Select Widget Size',
      backButtonTitle: '',
      rightButton: null,
    });

    registerModalSteps({ steps });
  }, []);

  const widgetSizes = [
    { size: 'verySmall', label: 'Very Small (2x1)', score: 10, aspectWidth: 2, aspectHeight: 1, width: 184, height: 92 },
    { size: 'small', label: 'Small (1x1)', score: 20, aspectWidth: 1, aspectHeight: 1, width: 184, height: 184 },
    { size: 'medium', label: 'Medium (2x1)', score: 40, aspectWidth: 2, aspectHeight: 1, width: 260, height: 130 },
    { size: 'large', label: 'Large (1x1)', score: 80, aspectWidth: 1, aspectHeight: 1, width: 368, height: 368 },
  ];

  const handleSizeSelect = (size) => {
    onSelectSize(size);
    handleClose();
  };

  const handleSwipe = (direction) => {
    if (direction === 'Left' && currentSlide < widgetSizes.length - 1) {
      setCurrentSlide((prev) => prev + 1);
    } else if (direction === 'Right' && currentSlide > 0) {
      setCurrentSlide((prev) => prev - 1);
    }
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => handleSwipe('Left'),
    onSwipedRight: () => handleSwipe('Right'),
    trackMouse: true,
    delta: 30,
    preventDefaultTouchmoveEvent: true,
  });

  const goToSlide = (index) => {
    if (index >= 0 && index < widgetSizes.length) {
      setCurrentSlide(index);
    }
  };

  return (
    <div className={`${styles.widgetSizeModal} ${isDarkTheme ? styles.darkTheme : ''}`}>
      <div className={styles.carouselContainer} {...swipeHandlers}>
        <div
          className={styles.carouselTrack}
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {widgetSizes.map(({ size, label, aspectWidth, aspectHeight, width, height }) => (
            <div key={size} className={styles.carouselSlide}>
              <div className={styles.slideContent}>
                <div
                  className={`${styles.widgetShape} ${isDarkTheme ? styles.darkTheme : ''}`}
                  style={{
                    width: `${width}px`,
                    height: `${height}px`,
                    maxWidth: '368px', // Respect modal padding
                    aspectRatio: `${aspectWidth} / ${aspectHeight}`, // Ensure correct ratio
                  }}
                  onClick={() => handleSizeSelect(size)}
                  aria-label={`Select ${label} widget`}
                />
                <button
                  className={`${styles.selectButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                  onClick={() => handleSizeSelect(size)}
                >
                  {label}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.pagination}>
        {widgetSizes.map((_, index) => (
          <FaCircle
            key={index}
            className={`${styles.paginationDot} ${
              index === currentSlide ? styles.active : ''
            } ${isDarkTheme ? styles.darkTheme : ''}`}
            onClick={() => goToSlide(index)}
          />
        ))}
      </div>
    </div>
  );
};

WidgetSizeModal.propTypes = {
  handleClose: PropTypes.func.isRequired,
  onSelectSize: PropTypes.func.isRequired,
};

export default WidgetSizeModal;