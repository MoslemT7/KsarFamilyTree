import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './styles/CommingSoon.css';

const ComingSoonPhaseOne = () => {
  const navigate = useNavigate();
  const [clickCount, setClickCount] = useState(0);
  const [code, setCode] = useState('');
  const [showInput, setShowInput] = useState(false);

  const messages = [
    "...الأبواب تُفتح لمن ينتظر",
    "...الصمت يخفي شيئًا مدهشًا",
    "...الضوء يلوح من بعيد",
    "...هناك ما لم يُقل بعد",
    "...وكأن شيئاً عظيماً على وشك الحدوث",
    "...علامات تظهر في الأفق",
    "...الهدوء الذي يسبق العاصفة"
  ];

  const todayIndex = new Date().getDate() % messages.length;
  const dailyMessage = messages[todayIndex];

  const handleSecretAccess = () => {
    if (code === "06610326mos") {
      navigate("/06610326mos");
    } else {
      alert("رمز غير صحيح");
    }
  };

  const handleHiddenClick = () => {
    const newCount = clickCount + 1;
    console.log(newCount);
    if (newCount >= 10) {
      setShowInput(true);
    }
    setClickCount(newCount);
  };

  return (
    <div className="coming-soon-container">
      <div className="coming-soon-text wave">{dailyMessage}</div>
      <div className="coming-soon-orb"></div>

      {/* 🔲 Hidden click zone */}
      <div onClick={handleHiddenClick} style={{ width: "50%", height: "50px" }} />

      {/* 🔐 Secret input shows only after 10 clicks */}
      {showInput && (
        <div className="secret-access">
          <input
            type="password"
            placeholder="أدخل الرمز "
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button id="secretButton" onClick={handleSecretAccess}>دخول</button>
        </div>
      )}
    </div>
  );
};

export default ComingSoonPhaseOne;
