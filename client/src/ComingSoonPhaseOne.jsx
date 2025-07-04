import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './styles/ComingSoonOfficial.css';

const LAUNCH_DATE = new Date('2025-08-01T18:00:00');

const ComingSoonOfficial = () => {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState({});
  const [clickCount, setClickCount] = useState(0);
  const [showInput, setShowInput] = useState(false);
  const [code, setCode] = useState('');
  const [teaser, setTeaser] = useState('');

  const teasers = [
    "من هو قريبك الذي لا تعرفه؟",
    "كل فرع كل عائلة، كل فرد... موثّق",
    "شجرة واحدة... تجمعنا كلنا",
    "مفاجئات تنتظرك... من أعماق التاريخ",
    "رحلة في الماضي تبدأ قريبًا"
  ];

  // Countdown logic
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const diff = LAUNCH_DATE - now;
      if (diff <= 0) return setTimeLeft({ d: 0, h: 0, m: 0, s: 0 });
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / (1000 * 60)) % 60);
      const s = Math.floor((diff / 1000) % 60);
      setTimeLeft({ d, h, m, s });
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // Teaser rotator
  useEffect(() => {
    const showRandomTeaser = () => {
      const index = Math.floor(Math.random() * teasers.length);
      setTeaser(teasers[index]);
    };
    showRandomTeaser();
    const teaserInterval = setInterval(showRandomTeaser, 5000);
    return () => clearInterval(teaserInterval);
  }, []);

  const handleHiddenClick = () => {
    const newCount = clickCount + 1;
    if (newCount >= 10) setShowInput(true);
    setClickCount(newCount);
  };

  const handleSecretAccess = () => {
    if (code === '06610326mos') navigate('/06610326mos');
    else alert('رمز غير صحيح');
  };

  return (
    <div className="official-container" onClick={handleHiddenClick}>
      <header className="official-header">
        <h1>مشروع عرش قصر أولاد بوبكر</h1>
      </header>

      <section className="official-main">
        <p className="official-subtitle">البيانات تُجمع وتحلل بحذر لصنع تجربة فريدة.</p>
        <p>استعدوا لاكتشاف أضخم مشروع يوثق أصول عرشنا وعائلاتنا من الجذور حتى الفروع.</p>
        
        <div className="teaser-line">
          <em>{teaser}</em>
        </div>
        <h2>الاطلاق في 01 أوت 2025 ، 18:00</h2>
        <h2>الوقت المتبقي حتى إطلاق الموقع:</h2>
        <div className="countdown">
          <div><span>{timeLeft.d}</span><small>{timeLeft.d > 11 ? "يوما": "ايام"}</small></div>
          <div><span>{timeLeft.h}</span><small>{timeLeft.h > 11 ? "ساعة": "ساعات"}</small></div>
          <div><span>{timeLeft.m}</span><small>{timeLeft.d > 11 ? "دقيقة": "دقائق"}</small></div>
          <div><span>{timeLeft.s}</span><small>
            {timeLeft.s === 2
              ? "ثانيتان"
              : timeLeft.s > 2 && timeLeft.s <= 10
              ? "ثواني"
              : timeLeft.s === 1
              ? "ثانية"
              : "ثانية"}
          </small></div>
        </div>

        <div className="contribute-box">
          <p>هل لديك صور، وثائق أو تريد المساهمة في جمع البيانات؟ تواصل معنا عبر:</p>

          <div className="contact-options">
            <a
              href="https://www.facebook.com/MoslemT7/"
              target="_blank"
              rel="noopener noreferrer"
              className="contribute-button"
            >
              تواصل عبر فيسبوك
            </a>

            <a
              href="https://www.facebook.com/infosKOB"
              target="_blank"
              rel="noopener noreferrer"
              className="contribute-button"
            >
              صفحة قصر أولاد بوبكر
            </a>

            <a href="tel:+21627200162" className="contribute-button">
              اتصل بنا مباشرة
            </a>

            <a href="mailto:contact@ouledboubaker.tn" className="contribute-button">
              أرسل لنا بريداً إلكترونياً
            </a>
          </div>
        </div>

      </section>

      {showInput && (
        <div className="secret-access">
          <input
            type="password"
            placeholder="أدخل الرمز السري"
            value={code}
            onChange={e => setCode(e.target.value)}
          />
          <button onClick={handleSecretAccess}>دخول</button>
        </div>
      )}

      <footer className="official-footer">
        <p>© 2025 جميع الحقوق محفوظة - عرش قصر أولاد بوبكر</p>
      </footer>
    </div>
  );
};

export default ComingSoonOfficial;
