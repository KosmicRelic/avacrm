import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import MainContextProvider from './Contexts/MainContext.jsx'

createRoot(document.getElementById('root')).render(
  <MainContextProvider>
    <App />
  </MainContextProvider>,
)
