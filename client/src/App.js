import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import FamilyTree from './components/FamilyTree';
import RelationPage from './components/RelationChecker';
import StatisticsDashboard from './components/StatisticsDashboard';
import SearchPage from './components/SearchPage';
import MainPage from './components/mainPage';
import DataEntryForm from './components/DataEntry';
import usePageTracking from './utils/trackers';
import './styles/app.css';

const WeddingPage = () => {
  return (
    <iframe
      src="/weddings/wedding.html"
      style={{ width: '100%', height: '90vh', border: 'none' }}
      title="أعراسنا"
    />
  );
};

const App = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleMenu = () => setMenuOpen(open => !open);

  usePageTracking();

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      document.body.classList.add('dark-mode');
    }
  }, []);

  const toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
  };

  const location = useLocation();
  const isWeddingsRoute = location.pathname === '/weddings';

  return (
    <div className="app-container">
      <>
        <header className="header">
          <div className="header-top">
            <div className="logo-title">
              <div className="title">
                <h1>
                  <a href="https://shorturl.at/Ktu6p" target="_blank" rel="noopener noreferrer">
                    موقع قصر أولاد بوبكر
                  </a>
                </h1>
              </div>
              
            </div>
            <button
              className="menu-tog"
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Toggle menu"
            >☰</button>
          </div>
          <nav className={`sidebar ${menuOpen ? 'open' : ''}`}>
          <button className="close-btn" onClick={toggleMenu}>×</button>
          <ul>
            <li><Link to="">الرئيسية</Link></li>
            <li><Link to="familyTree">شجرة العائلة</Link></li>
            <li><Link to="search">البحث</Link></li>
            <li><Link to="statistics">إحصائيات</Link></li>
            <li><Link to="relationChecker">ماهي العلاقة بينهما؟</Link></li>
            <li>
              <Link to="weddings" onClick={() => sessionStorage.setItem('allowWedding','true')}>
                أعراسنا
              </Link>
            </li>
            <li><Link to="dataentry">Data</Link></li>
            <li id="contactUs"><Link to="/contact">إتصل بنا</Link></li>
          </ul>
        </nav>
        </header>        
      </>

      <div className="main-container">
        <ToastContainer position="top-center" autoClose={2000} />

        {isWeddingsRoute ? (
          <WeddingPage />
        ) : (
          <div className="content">
            <Routes>
              <Route path="" element={<MainPage />} />
              <Route path="familyTree" element={<FamilyTree />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="statistics" element={<StatisticsDashboard />} />
              <Route path="relationChecker" element={<RelationPage />} />
              <Route path="weddings" element={<WeddingPage />} />
              <Route path="dataentry" element={<DataEntryForm />} />
            </Routes>
          </div>
        )}
      </div>

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
              <li><Link to="">الصفحة الرئيسية</Link></li>
              <li><Link to="familyTree">شجرة العائلة</Link></li>
              <li><Link to="search">البحث عن فرد</Link></li>
              <li><Link to="weddings">أعراسنا</Link></li>
              <li>
                <a
                  href="https://github.com/MoslemT7/KsarFamilyTree"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </div>

          <div className="footer-column">
            <h4>تواصل معنا</h4>
            <ul>
              <li>📧 contact@ouledboubaker.tn</li>
              <li>
                <a href="https://shorturl.at/Ktu6p" target="_blank" rel="noopener noreferrer">
                  📍 قصر أولاد بوبكر، تطاوين، تونس
                </a>
              </li>
              <li>📞 +216 98 695 061</li>
              <li>📞 +216 27 200 162</li>
              <li>
                <a href="https://www.facebook.com/infosKOB" id="fblink" target="_blank" rel="noopener noreferrer">
                  صفحة الفايسبوك
                </a>
              </li>
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
