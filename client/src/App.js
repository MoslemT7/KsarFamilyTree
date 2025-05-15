import React from 'react';
import { BrowserRouter as Router, Route, Link, Routes } from 'react-router-dom';
import FamilyTree from './components/FamilyTree';  // Correct import
import RelationPage from './components/RelationChecker'; // Correct import
import StatisticsDashboard from './components/StatisticsDashboard'; // Correct import
import SearchPage from './components/SearchPage'; // Correct import
import WeddingPage from './components/weddings';
import CommingSoon from './index';
import MainPage from './components/mainPage';
import './styles/app.css';  // Import styles
import { useEffect, useState } from "react";

const App = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleMenu = () => setMenuOpen(!menuOpen);
  useEffect(() => {
    // Load theme from localStorage on mount
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "light") {
      document.body.classList.add("dark-mode");
    }
  }, []);

  const toggleDarkMode = () => {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    localStorage.setItem("theme", isDark ? "light" : "dark");
  };

  return (
    <div className="app-container">
      <Router>
      <header className="header">
        <div className="header-top">
          <button className="menu-toggle" onClick={toggleMenu}>☰</button>
          <div className="logo">
            {/* Optional: Insert <img src="/logo.png" alt="Logo" /> here */}
          </div>
          <div className="title">
            <h1>موقع قصر أولاد بوبكر</h1>
            <div>
              <h2>التاريخ | العلاقات | التقاليد</h2>
              <label class="toggle-switch">
                <input type="checkbox" id="darkModeToggle" onClick={toggleDarkMode}></input>
                <span class="slider"></span>
              </label>
            </div>
            
          </div>
        </div>

        <nav className={`sidebar ${menuOpen ? 'open' : ''}`}>
          <ul>
            <li><Link to="/main">الرئيسية</Link></li>
            <li><Link to="/familyTree">شجرة العائلة</Link></li>
            <li><Link to="/search">البحث</Link></li>
            <li><Link to="/statistics">إحصائيات</Link></li>
            <li><Link to="/relation-checker">ماهي العلاقة بينهما؟</Link></li>
            <li><Link to="/weddingsDates">أعراسنا</Link></li>
          </ul>
        </nav>
      </header>

      <div className="main-container">
        

        <div className="content">
          <Routes>
            <Route path="/main" element={<MainPage />} />
            <Route path="/familyTree" element={<FamilyTree />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/statistics" element={<StatisticsDashboard />} />
            <Route path="/relation-checker" element={<RelationPage />} />
            <Route path="/weddingsDates" element={<WeddingPage />} />
          </Routes>
        </div>
      </div>
      </Router>
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-column">
            <h4>عن الموقع</h4>
            <p>
              هذا الموقع يهدف إلى توثيق شجرة عرش قصر أولاد بوبكر، ويجمع بين التكنولوجيا والتراث، لتقديم تجربة تفاعلية فريدة لكل أفراد العائلة.
            </p>
          </div>
          <div className="footer-column">
            <h4>روابط مهمة</h4>
            <ul>
              <li><a href="/">الصفحة الرئيسية</a></li>
              <li><a href="/tree">شجرة العائلة</a></li>
              <li><a href="/search">البحث عن فرد</a></li>
              <li><a href="/weddings">أعراسنا</a></li>
            </ul>
          </div>
          <div className="footer-column">
            <h4>تواصل معنا</h4>
            <ul>
              <li>📧 البريد الإلكتروني: contact@elkasr-family.tn</li>
              <li>📍 قصر أولاد بوبكر، تطاوين، تونس</li>
              <li>📞 الهاتف: +216 99 999 999</li>
              <li><a href='https://www.facebook.com/infosKOB' id='fblink'>صفحة الفايسبوك</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2025 جميع الحقوق محفوظة - عرش قصر أولاد بوبكر</p>
        </div>
      </footer>

    </div>
  );
};

export default App;
