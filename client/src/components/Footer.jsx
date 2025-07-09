import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../styles/Footer.css';

const Footer = () => {
  return (
   <footer className="footer">
    <div className="footer-container">
        <div className="footer-column">
        <h4>عن الموقع</h4>
        <p>
            هذا الموقع يهدف إلى توثيق شجرة عرش قصر أولاد بوبكر، ويجمع بين التكنولوجيا والتراث، لتقديم تجربة تفاعلية فريدة لكل أفراد العائلة.
        </p>
        <p> : الاصدار <span>v0.8.0</span></p>
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
  );
};

export default Footer;
