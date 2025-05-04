import React from 'react';
import './wedding.css';

const WeddingPage = () => {
  return (
    <div className="wedding-dates-page">
      <h2>تواريخ الأعراس</h2>

      <div className="wedding-date-card">
        <div className="wedding-header">
          <div className="wedding-date">3 - 4 - 5 أوت 2025</div>
        </div>

        <div className="wedding-names">
          <p><strong>العريس:</strong> محمد بن سالم</p>
          <p><strong>العروس:</strong> فاطمة بنت علي</p>
        </div>

        <div className="wedding-notes">
          <div className="note-item">
            <h4>مكان الحفل</h4>
            <p>قاعة الحفلات - وسط المدينة</p>
          </div>

          <div className="note-item">
            <h4>سهرة النساء</h4>
            <p>4 أوت 2025</p>
          </div>

          <div className="note-item">
            <h4>عشاء العائلة</h4>
            <p>3 أوت 2025</p>
          </div>

          <div className="note-item">
            <h4>يوم الموكب</h4>
            <p>5 أوت 2025</p>
          </div>
        </div>
      </div>

      {/* يمكنك تكرار البطاقة الثانية هنا أيضًا */}
      <div className="wedding-date-card">
        <div className="wedding-header">
          <div className="wedding-date">3 - 4 - 5 أوت 2025</div>
        </div>

        <div className="wedding-names">
          <p><strong>العريس:</strong> محمد بن سالم</p>
          <p><strong>العروس:</strong> فاطمة بنت علي</p>
        </div>

        <div className="wedding-notes">
          <div className="note-item">
            <h4>مكان الحفل</h4>
            <p>قاعة الحفلات - وسط المدينة</p>
          </div>

          <div className="note-item">
            <h4>سهرة النساء</h4>
            <p>4 أوت 2025</p>
          </div>

          <div className="note-item">
            <h4>عشاء العائلة</h4>
            <p>3 أوت 2025</p>
          </div>

          <div className="note-item">
            <h4>يوم الموكب</h4>
            <p>5 أوت 2025</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeddingPage;
