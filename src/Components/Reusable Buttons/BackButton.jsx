import styles from './BackButton.module.css';

// Custom centered chevron SVG component
const CenteredChevronLeft = ({ size = 16, color = 'currentColor' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'block' }}
  >
    <path
      d="M15 18L9 12L15 6"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BackButton = ({
  onClick,
  children,
  isDarkTheme = false,
  iconSize = 26, // Updated to match sheetActions icon size
  className = '',
  ariaLabel = 'Back',
  showText = true
}) => {
  return (
    <button
      className={`${styles.backButton} ${!showText ? styles.iconOnly : ''} ${isDarkTheme ? styles.darkTheme : ''} ${className}`}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <CenteredChevronLeft size={iconSize} />
      {showText && children}
    </button>
  );
};

export default BackButton;