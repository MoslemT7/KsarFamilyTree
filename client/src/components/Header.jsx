import React, { useState, useEffect } from 'react';
import { FaUserCircle, FaMoon, FaSun, FiMenu } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import { FiBell } from "react-icons/fi"; 
import logo from '../media/logo2.png';
import '../styles/Header.css';

const Header = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
  let savedTheme = null;
    try {
      savedTheme = localStorage.getItem('theme');
    } catch (e) {
      console.warn('localStorage access blocked:', e);
    }
    const isDark = savedTheme === 'light';
    document.body.classList.toggle('dark-mode', isDark);
    setDarkMode(isDark);
  }, []);

  const toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    try {
      localStorage.setItem('theme', isDark ? 'light' : 'dark');
    } catch (e) {
      console.warn('localStorage write blocked:', e);
    }
    setDarkMode(isDark);
  };


  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  return (
    <header className={`official-header ${menuOpen ? 'menu-open' : ''}`}>
      <div className="header-left">
        <img src={logo} alt="Logo" className="logo" />
        <h1>موقع قصر أولاد بوبكر</h1>
      </div>
      
      <div className="header-right">
        <button
          id="menu-tog"
          className="icon menu-toggle-button"
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          ☰
        </button>
        <button className="icon">
          <FiBell />
        </button>
        <button className="icon">
          <FaUserCircle title="Login" />
        </button>
        <button className="icon" onClick={toggleDarkMode}>
          {darkMode ? <FaSun /> : <FaMoon />}
        </button>
      </div>

      <nav className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <ul>
          <li onClick={toggleMenu}><Link to="">الرئيسية</Link></li>
          <li onClick={toggleMenu}><Link to="familyTree">شجرة العائلة</Link></li>
          <li onClick={toggleMenu}><Link to="relationChecker">ماهي العلاقة بينهما؟</Link></li>
          <li onClick={toggleMenu}><Link to="search">البحث</Link></li>
          <li onClick={toggleMenu}><Link to="statistics">إحصائيات</Link></li>
        </ul>
      </nav>
    </header>
  );
};

export default Header;
