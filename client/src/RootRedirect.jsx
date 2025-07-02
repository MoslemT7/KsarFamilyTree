// RootRedirect.jsx
import React, { useState, useEffect } from 'react';
import App from './App';
import ComingSoonOfficial from './ComingSoonPhaseOne';

const LAUNCH_DATE = new Date('2025-08-01T18:00:00');

const RootRedirect = () => {
  const [showApp, setShowApp] = useState(false);

  useEffect(() => {
    const checkTime = () => {
      const now = new Date();
      setShowApp(now >= LAUNCH_DATE);
    };

    checkTime(); // run once immediately
    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return showApp ? <App /> : <ComingSoonOfficial />;
};

export default RootRedirect;
