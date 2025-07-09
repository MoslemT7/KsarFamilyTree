import React, { useEffect, useState } from 'react';
import ComingSoonOfficial from './ComingSoonPhaseOne';
import App from './App';

const LAUNCH_DATE = new Date('2025-07-02T01:54:00');

const IntroOverlay = ({ onFinish }) => {
  return (
    <div className="intro-overlay">
      <div className="intro-content">
        <h1>👋 مرحبا بك في موقع عرش أولاد بوبكر</h1>
        <p>هذا الموقع يوثق تاريخ وأنساب العرش بشكل بصري وشيق.</p>

        <ul className="key-links">
          <li><a href="#statistics">📊 إحصائيات العرش</a></li>
          <li><a href="#search">🔍 البحث عن شخص</a></li>
          <li><a href="#tree">🌳 شجرة العائلة</a></li>
        </ul>

        <p>ندعوك لاستكشاف الموقع والمساهمة في تطويره 💡</p>
        <button onClick={onFinish}>الدخول إلى الموقع</button>
      </div>
    </div>
  );
};

const LaunchGate = () => {
  const [now, setNow] = useState(new Date());
  const [showIntro, setShowIntro] = useState(false);
  const [isLaunchReached, setIsLaunchReached] = useState(false);

  useEffect(() => {
    const checkTime = () => {
      const current = new Date();
      setNow(current);
      setIsLaunchReached(current >= LAUNCH_DATE);
    };

    checkTime(); // check on mount
    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isLaunchReached) {
      let hasSeenIntro = null;
      try {
        hasSeenIntro = localStorage.getItem('hasSeenIntro');
      } catch (e) {
        console.warn('localStorage access blocked:', e);
      }
      if (!hasSeenIntro) {
        setShowIntro(true);
      }
    }
  }, [isLaunchReached]);

  const finishIntro = () => {
    try {
      localStorage.setItem('hasSeenIntro', 'true');
    } catch (e) {
      console.warn('localStorage write blocked:', e);
    }
    setShowIntro(false);
  };


  // 💡 Render logic clearly separated
  if (!isLaunchReached) {
    return <ComingSoonOfficial />;
  }

  if (showIntro) {
    return <IntroOverlay onFinish={finishIntro} />;
  }

  return <App />;
};

export default LaunchGate;
