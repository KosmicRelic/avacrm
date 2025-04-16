// src/hooks/useLongPress.js
import { useEffect, useRef } from 'react';

const useLongPress = (callback, ms = 500) => {
  const timerRef = useRef(null);
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  const start = (event) => {
    event.preventDefault();
    timerRef.current = setTimeout(() => {
      savedCallback.current();
    }, ms);
  };

  const clear = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return {
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchStart: start,
    onTouchEnd: clear,
  };
};

export default useLongPress;