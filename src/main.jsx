import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import MainContextProvider from './Contexts/MainContext.jsx';
import ModalNavigatorProvider from './Contexts/ModalNavigator.jsx';
import { BrowserRouter as Router, Route, Routes, Link, useNavigate } from 'react-router-dom';
import './i18n';

createRoot(document.getElementById('root')).render(
  <Router>
  <MainContextProvider>
    <ModalNavigatorProvider>
      <App />
    </ModalNavigatorProvider>
  </MainContextProvider>
  </Router>
);