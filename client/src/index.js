import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/CommingSoon.css';


const weeklyCodes = [
  { code: 'Xfnp Qhyfq Obhonxre', hint: 'ROT13', key: 'Ksar Ouled Boubaker' }, // Week 1
  { code: 'Rmzsv Gsv Uilnvmg Blf', hint: 'Atbash Cipher', key: 'Family Tree' }, // Week 2
  { code: '.... .- .--. .--. -.-- / .-. --- --- - ...', hint: 'Morse Code', key: 'Relationship finder' }, // Week 3
  { code: 'Qml zmbgs blf gsv yv', hint: 'Atbash', key: 'Biggest database' }, // Week 4
  { code: 'V2VsZGRpbmdzIFRvb2xz', hint: 'Base64', key: 'Weddings tools' }, // Week 5
  { code: 'U2VhcmNoIHRoZSBsaW5rcw==', hint: 'Base64', key: 'Search tool' }, // Week 6
  { code: 'MjAyNS0wNS0xOSBEZWNyeXB0aW9uIFN0YXJ0cw==', hint: 'Base64', key: 'Project Launch Date' }, // Week 7
  { code: 'Gur synt vf va gur znva cntr', hint: 'ROT13', key: 'Main Page Hint' }, // Week 8
];

const getCurrentWeekNumber = () => {
  const currentDate = new Date();
  const firstDayOfYear = new Date(currentDate.getFullYear(), 0, 1);
  const pastDays = Math.floor((currentDate - firstDayOfYear) / 86400000);
  return Math.ceil((pastDays + firstDayOfYear.getDay() + 1) / 7);
};

const ComingSoonPhaseOne = () => {
  const currentWeek = getCurrentWeekNumber() % weeklyCodes.length;
  const { code, hint } = weeklyCodes[currentWeek];

  return (
    <div className="coming-soon-container">
      <div className="coming-soon-text wave">...شيءٌ كبير قادم</div>
      <div className="secret-code-section">
        <p className="secret-code">{code}</p>
      </div>
      <div className="coming-soon-orb"></div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


export default ComingSoonPhaseOne;
