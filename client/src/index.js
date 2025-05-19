import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/CommingSoon.css';

const ComingSoonPhaseOne = () => {
  return (
    
    <div className="coming-soon-container">
      <div className="coming-soon-text wave"> ...شيءٌ كبير قادم </div>
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
