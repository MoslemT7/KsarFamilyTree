import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './styles/ComingSoonOfficial.css';

const LAUNCH_DATE = new Date('2025-08-01T00:00:00'); // set your real launch

const ComingSoonOfficial = () => {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState({});
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [showInput, setShowInput] = useState(false);
  const [code, setCode] = useState('');

  // Countdown timer
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const diff = LAUNCH_DATE - now;
      if (diff <= 0) return setTimeLeft({ d: 0, h: 0, m: 0, s: 0 });
      const d = Math.floor(diff / (1000*60*60*24));
      const h = Math.floor((diff / (1000*60*60)) % 24);
      const m = Math.floor((diff / (1000*60)) % 60);
      const s = Math.floor((diff / 1000) % 60);
      setTimeLeft({ d, h, m, s });
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, []);

  const handleSubscribe = (e) => {
    e.preventDefault();
    // integrate your newsletter service here
    setSubscribed(true);
  };

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
        <h1>مشروع قرية أولاد بوبكر</h1>
      </header>

      <section className="official-main">
        <p className="official-subtitle">
          البيانات تُجمع وتحلل بحذر لصنع تجربة فريدة.
        </p>

        <div className="countdown">
          <div><span>{timeLeft.d}</span><small>أيام</small></div>
          <div><span>{timeLeft.h}</span><small>ساعات</small></div>
          <div><span>{timeLeft.m}</span><small>دقائق</small></div>
          <div><span>{timeLeft.s}</span><small>ثواني</small></div>
        </div>

        {!subscribed ? (
          <form className="newsletter-form" onSubmit={handleSubscribe}>
            <input
              type="email"
              id="email"
              placeholder="أدخل بريدك الالكتروني"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <button type="submit">اشترك</button>
          </form>
        ) : (
          <p className="thanks">شكراً لاشتراكك! سنبقيك على اطلاع.</p>
        )}
      </section>

      {/* Secret access */}
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
        <small>&copy; 2025 Ksar Ouled Boubaker. جميع الحقوق محفوظة.</small>
      </footer>
    </div>
  );
};

export default ComingSoonOfficial;
