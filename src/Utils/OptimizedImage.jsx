import { useState, useRef, useEffect } from 'react';

/**
 * Optimized Image component with lazy loading and error handling
 */
const OptimizedImage = ({
  src,
  alt,
  className,
  style,
  placeholder,
  onLoad,
  onError,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef(null);
  const observerRef = useRef(null);

  useEffect(() => {
    // Create intersection observer for lazy loading
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observerRef.current?.disconnect();
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before the image comes into view
        threshold: 0.1,
      }
    );

    if (imgRef.current) {
      observerRef.current.observe(imgRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  const defaultPlaceholder = (
    <div
      style={{
        backgroundColor: '#f0f0f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#999',
        fontSize: '14px',
        ...style,
      }}
      className={className}
    >
      📷
    </div>
  );

  return (
    <div ref={imgRef} style={{ position: 'relative', ...style }} className={className}>
      {!isInView && !isLoaded && (
        placeholder || defaultPlaceholder
      )}

      {isInView && (
        <>
          {!isLoaded && !hasError && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999',
                fontSize: '14px',
                zIndex: 1,
              }}
            >
              ⏳
            </div>
          )}

          <img
            src={src}
            alt={alt}
            onLoad={handleLoad}
            onError={handleError}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: isLoaded ? 1 : 0,
              transition: 'opacity 0.3s ease-in-out',
              ...style,
            }}
            {...props}
          />
        </>
      )}

      {hasError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999',
            fontSize: '14px',
            backgroundColor: '#f8f8f8',
            border: '1px solid #e0e0e0',
            ...style,
          }}
          className={className}
        >
          ❌ Failed to load image
        </div>
      )}
    </div>
  );
};

export default OptimizedImage;