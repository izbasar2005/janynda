import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import "./styles/design-system.css";
import "./styles.css";
import "./styles/responsive-ui.css";
import "./styles/landing-home.css";
import "./styles/landing-desktop.css";
import "./styles/doctors-cards.css";
import "./styles/groups-mobile.css";


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)