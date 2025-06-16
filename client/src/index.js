import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import ComingSoonOfficial from './ComingSoonPhaseOne';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ComingSoonOfficial />} />
        <Route path="/06610326mos/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
