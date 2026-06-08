import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import "./styles/design-system.css";
import "./styles.css";
import "./styles/responsive-ui.css";
import "./styles/landing-home.css";
import "./styles/landing-desktop.css";
import "./styles/landing-news-mobile.css";
import "./styles/landing-testimonials.css";
import "./styles/doctors-cards.css";
import "./styles/groups-responsive.css";
import "./styles/site-responsive.css";
import "./styles/admin-responsive.css";
import "./styles/news-responsive.css";
import "./styles/psych-responsive.css";
import "./styles/mobile-preview.css";
import "./styles/doctor-detail-mobile.css";
import "./styles/book-mobile.css";
import "./styles/profile-mobile.css";


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)