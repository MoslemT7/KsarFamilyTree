import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import ComingSoonPhaseOne from './ComingSoonPhaseOne';
import './styles/CommingSoon.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ComingSoonPhaseOne />} />
        <Route path="/06610326mos/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
