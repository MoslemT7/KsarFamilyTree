import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import FamilyTree from './components/FamilyTree';  // Adjust the path as needed
import RelationPage from './components/RelationChecker';  // Import your RelationPage
import StatisticsDashboard from './components/StatisticsDashboard'; // Adjust the path if needed
import SearchPage from './components/SearchPage'; // Adjust the path if needed

import './styles.css';  // Import your styles

const App = () => {
  const [searchQuery, setSearchQuery] = useState("");

  // Handle search input change
  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="header">
        <h1>شجرة عائلة قصر أولاد بوبكر</h1>
        <input
          type="text"
          className="search-bar"
          placeholder="ابحث عن شخص ..."
          value={searchQuery}
          onChange={handleSearchChange}
        />
      </header>

      {/* Main Content Layout */}
      <Router>
        <div className="main-container">
          {/* Sidebar */}
          <nav className="sidebar">
            <ul>
              <li><Link to="#home">الرئيسية</Link></li>
              <li><Link to="/SearchPage">البحث</Link></li>
              <li><Link to="#settings">الإعدادات</Link></li>
              <li><Link to="#settings">أفراح الجنوب</Link></li>
              <li><Link to="/StatisticsDashboard">إحصائيات</Link></li>
              {/* Use React Router Link for navigation */}
              <li><Link to="/relation-checker">ماهي العلاقة بينهما؟</Link></li>
            </ul>
          </nav>

          {/* Main Content for Routes */}
          <div className="content" name="maincontent">
            {/* Define Routes here */}
            <Routes>
              <Route path="/SearchPage" element={<SearchPage />} />
            </Routes>
            <Routes>
              <Route path="/" element={<FamilyTree searchQuery={searchQuery} />} />
              <Route path="/relation-checker" element={<RelationPage />} />
            </Routes>
            <Routes>
              <Route path="/StatisticsDashboard" element={<StatisticsDashboard />} />
              {/* other routes */}
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
