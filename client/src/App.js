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
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const App = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleMenu = () => setMenuOpen(!menuOpen);
  useEffect(() => {
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
        <div className="header-left">
          <div className="logo"></div>
          <button className="menu-toggle" onClick={toggleMenu}>☰</button>
          <div className="title">
            <h1><a href='https://shorturl.at/Ktu6p'>موقع قصر أولاد بوبكر</a></h1>
          </div>
        </div>

        <nav className={`sidebar ${menuOpen ? 'open' : ''}`}>
          <ul>
            <li><Link to="/">الرئيسية</Link></li>
            <li><Link to="/familyTree">شجرة العائلة</Link></li>
            <li><Link to="/search">البحث</Link></li>
            <li><Link to="/statistics">إحصائيات</Link></li>
            <li><Link to="/relationChecker">ماهي العلاقة بينهما؟</Link></li>
            <li><Link to="/weddingsDates">أعراسنا</Link></li>
            <li id="contactUs"><a>إتصل بنا</a></li>
          </ul>
        </nav>
        <div>
          <label class="toggle-switch">
            <input type="checkbox" id="darkModeToggle" onClick={toggleDarkMode}></input>
            <span class="slider">🌙      ☀️</span>
          </label>
        </div>
      </header>

      <div className="main-container">
        
        <ToastContainer position="top-center" autoClose={2000} />

        <div className="content">
          <Routes>
            <Route path="/" element={<MainPage />} />
            <Route path="/familyTree" element={<FamilyTree />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/statistics" element={<StatisticsDashboard />} />
            <Route path="/relationChecker" element={<RelationPage />} />
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
              <li><a href="https://github.com/MoslemT7/KsarFamilyTree" target="_blank" rel="noopener noreferrer" title="Tech & Source code on GitHub">
              GitHub
              </a></li>
            </ul>
          </div>
          <div className="footer-column">
            <h4>تواصل معنا</h4>
            <ul>
              <li>📧 البريد الإلكتروني: contact@elkasr-family.tn</li>
              <li><a href="https://shorturl.at/Ktu6p">📍 قصر أولاد بوبكر، تطاوين، تونس</a></li>
              <li>📞 +216 98 695 061</li>
              <li>📞 +216 27 200 162</li>
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
