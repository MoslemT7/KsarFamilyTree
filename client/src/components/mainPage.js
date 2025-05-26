import React from 'react';
import '../styles/mainPage.css';  // تأكد من استيراد ملف الـ CSS
import { useNavigate } from 'react-router-dom'; // Import the useNavigate hook
import usePageTracking from '../utils/trackers';

const MainPage = () => {
  const navigate = useNavigate(); // Initialize navigate function
  usePageTracking();
  const handleClick = () => {
    navigate('/weddingsDates'); // This will navigate to the WeddingPage
  };

  return (
    <div className="mainPage">
      <div className='welcome'>
        <div className="welcomeMessage">
          <h1>مرحباً بكم في موقع قصر أولاد بوبكر</h1>
          <p>.إكشتف التاريخ ، الأنساب ، العلاقات والمزيد عن عرش قصر أولاد بوبكر</p>
        </div>
        
      </div>
      <div className="description">
        <h2>لماذا اخترنا بناء هذا الموقع؟</h2>
        <p>
        تم إنشاء موقع <strong> قصر أولاد بوبكر </strong> 
        ليكون المرجع الرقمي الأول والأشمل لتاريخ وأنساب عرش  أولاد بوبكر.
         نسعى من خلال هذا المشروع إلى توثيق تفاصيل حياة كل فرد، ورسم
        العلاقات العائلية المتشابكة، وسرد القصص التاريخية المميزة التي شكلت هويتنا الجماعية. يتيح الموقع لجميع أبناء 
        القصر وزواره تصفح شجرة عائلية ضخمة بطريقة تفاعلية وسهلة الاستخدام، مما يضمن حفظ هذا الإرث الثقافي للأجيال القادمة.
         تكمن القيمة الحقيقية لهذا المشروع في تعزيز الهوية المشتركة وتمكين الأجيال الجديدة من التعرف على جذورها وأصولها،
         إضافة إلى تقوية أواصر القرابة والمحافظة على صلة الرحم بين العائلات المختلفة.
         وفيما يلي نستعرض أهم المميزات التي يقدمها الموقع للمستخدمين:
      </p>

        <div className="features-cards">
          <div className="feature-card">
            <span className="emoji">🌳</span>
            <p>عرض تفاعلي لشجرة العائلة منذ الجد الأول حتى الأجيال الحالية</p>
          </div>
          <div className="feature-card">
            <span className="emoji">🔍</span>
            <p>إمكانية البحث عن أي فرد ومعرفة تسلسله ومكانه في العائلة</p>
          </div>
          <div className="feature-card">
            <span className="emoji">💡</span>
            <p>تصميم بسيط وجذاب يسهل التصفح والفهم</p>
          </div>
          <div className="feature-card">
            <span className="emoji">📊</span>
            <p>إحصائيات وحقائق مذهلة حول العرش وتوزع الأفراد</p>
          </div>
        </div>
        <div className="wedding-feature-card">
          <div className="overlay">
            <span className="emoji"></span>
            <div className='weddingfeaturetext'>
              <p>
              لا مزيد من الطريقة التقليدية للإعلان عن حفلات الزواج! يمكنكم الآن بفضل أداء <strong>"أعراسنا"</strong> 
              معرفة تواريخ الأعراس القادمة وتفاصيلها بكل سهولة واحترافية.
              </p>
              <button type='button' className='discoverNow' onClick={handleClick}>إكتشف الآن</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainPage;
