import React from 'react';
import { BrowserRouter as Router, Route, Link, Routes } from 'react-router-dom';
import FamilyTree from './components/FamilyTree';  // Correct import
import RelationPage from './components/RelationChecker'; // Correct import
import StatisticsDashboard from './components/StatisticsDashboard'; // Correct import
import SearchPage from './components/SearchPage'; // Correct import
import WeddingPage from './components/weddings';
import './styles.css';  // Import styles

const App = () => {
  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <h1>شجرة عائلة قصر أولاد بوبكر</h1>
      </header>

      {/* Router Setup */}
      <Router>
        <div className="main-container">
          {/* Sidebar Navigation */}
          <nav className="sidebar">
            <ul>
              <li><Link to="/">الرئيسية</Link></li>
              <li><Link to="/search">البحث</Link></li>
              <li><Link to="/statistics">إحصائيات</Link></li>
              <li><Link to="/relation-checker">ماهي العلاقة بينهما؟</Link></li>
              <li><Link to="/weddingsDates">تواريخ الأعراس</Link></li>
            </ul>
          </nav>

          {/* Content */}
          <div className="content">
            <Routes>
              {/* Updated Route Definitions */}
              <Route path="/" element={<FamilyTree />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/statistics" element={<StatisticsDashboard />} />
              <Route path="/relation-checker" element={<RelationPage />} />
              <Route path="/weddingsDates" element={<WeddingPage />} />

            </Routes>
          </div>
        </div>
      </Router>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-left">
            <p>&copy; 2025 قصر أولاد بوبكر - All Rights Reserved</p>
          </div>
          <div className="footer-right">
            <p>Contact Us: <a href="mailto:info@kasrouledboubaker.com">info@kasrouledboubaker.com</a></p>
            <p>Follow us on:</p>
            <div className="social-icons">
              <a href="https://www.facebook.com/infosKOB" target="_blank" rel="noopener noreferrer">Facebook</a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer">Twitter</a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer">Instagram</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
