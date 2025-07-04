import React, { useState, useEffect } from 'react';
import { FaUserCircle, FaMoon, FaSun } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import { FiBell } from "react-icons/fi"; // Feather
import '../styles/Header.css';
import logo from '../media/logo2.png'

const Header = ({ toggleMenu }) => {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme === 'light';
    document.body.classList.toggle('dark-mode', isDark);
    setDarkMode(isDark);
  }, []);

  const toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
    setDarkMode(isDark);
  };

  return (
    <header className="official-header">
      <div className="header-left">
        <img src={logo} alt="Logo" style={{ width: '20%', height: '95%', marginRight: '8px' }} />
        <h1>موقع قصر أولاد بوبكر</h1>
      </div>
      
      <div className="header-right">
        <button id="menu-tog" className="icon" onClick={toggleMenu} aria-label="Toggle menu">
          ☰
        </button>
        <button className='icon'>
          <FiBell></FiBell>
        </button>
        <button className="icon">
          <FaUserCircle  title="Login" />
        </button>
        
        <button className="icon" onClick={toggleDarkMode}>
          {darkMode ? <FaSun /> : <FaMoon />}
        </button>
      
        <Link to="/contact">
          <button className="contact-button">إتصل بنا</button>
        </Link>
      </div>
    </header>
  );
};

export default Header;
