import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FaUserCircle, FaMoon, FaSun } from 'react-icons/fa';
import Header from './components/Header';
import FamilyTree from './components/FamilyTree';
import RelationPage from './components/RelationChecker';
import StatisticsDashboard from './components/StatisticsDashboard';
import SearchPage from './components/SearchPage';
import MainPage from './components/mainPage';
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
  const toggleMenu = () => setMenuOpen(prev => !prev);
  const location = useLocation();
  
  const isWeddingsRoute = location.pathname === '/weddings';

  usePageTracking();

  return (
    <div className="app-container">
      <Header toggleMenu={toggleMenu} />

      <nav className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <ul>
          <li onClick={toggleMenu}><Link to="">الرئيسية</Link></li>
          <li onClick={toggleMenu}><Link to="familyTree">شجرة العائلة</Link></li>
          <li onClick={toggleMenu}><Link to="search">البحث</Link></li>
          <li onClick={toggleMenu}><Link to="statistics">إحصائيات</Link></li>
          <li onClick={toggleMenu}><Link to="relationChecker">ماهي العلاقة بينهما؟</Link></li>
          <li onClick={toggleMenu}>
            <Link to="weddings" onClick={() => sessionStorage.setItem('allowWedding', 'true')}>
              أعراسنا
            </Link>
          </li>
        </ul>
      </nav>

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
            <p> : الاصدار <h5>v0.8.0</h5></p>
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