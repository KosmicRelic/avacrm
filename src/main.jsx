import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import MainContextProvider from './Contexts/MainContext.jsx';
import ModalNavigatorProvider from './Contexts/ModalNavigator.jsx';
import { BrowserRouter as Router } from 'react-router-dom';
import './i18n';

// Register service worker for offline functionality
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[Service Worker] Registered successfully:', registration.scope);
      })
      .catch((error) => {
        console.log('[Service Worker] Registration failed:', error);
      });
  });
}

createRoot(document.getElementById('root')).render(
  <Router>
  <MainContextProvider>
    <ModalNavigatorProvider>
      <App />
    </ModalNavigatorProvider>
  </MainContextProvider>
  </Router>
);