import React from 'react';
import '../styles/mainPage.css';  // تأكد من استيراد ملف الـ CSS
import WeddingPage from './weddings';
import { useNavigate } from 'react-router-dom'; // Import the useNavigate hook

const MainPage = () => {
  const navigate = useNavigate(); // Initialize navigate function

  const handleClick = () => {
    navigate('/weddingsDates'); // This will navigate to the WeddingPage
  };

  return (
    <div className="mainPage">
      <div className='welcome'>
        <div className="welcomeMessage">
          <h1>مرحباً بكم في موقع قصر أولاد بوبكر</h1>
          <p>اكتشف التاريخ، الأنساب، والمزيد عن العرش العريق.</p>
        </div>
        
      </div>
      <div className="description">
        <h2>لماذا اخترنا بناء هذا الموقع؟</h2>
        <p>
          تم إنشاء موقع <strong>قصر أولاد بوبكر</strong> 
          .ليكون المرجع الرقمي الأول لتاريخ وأنساب العرش، حيث نوثق كل فرد، وكل علاقة، وكل قصة ضمن شجرة عائلية ضخمة يمكن للجميع تصفحها.
          تكمن قيمة هذا الموقع في المحافظة على تاريخ العرش ، حيث يمكن للأجيال الجديدة التعرف على أنسابها وأجدادها ،
           ومن اجل المحافظة على صلة الرحم والعلاقات بين العائلات
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
          <div className="feature-card">
            <span className="emoji">🔗</span>
            <p>
              أداة تمكنك من التعرّف على العلاقة الي تربط بين اي شخصين في الشجرة ،
              سواءًا كانت قرابة عائلة أو علاقة زواج أو حتى علاقة نسب
            </p>
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
        <div className="cards-container">
          <div className="card" onClick={() => window.location.href = "https://www.facebook.com/profile.php?id=100036538128995"}
>
           <div className="card-background-school-bg" ></div>
            <div className="card-content">
              <h4>المدرسة</h4>
              <p>
                مدرسة قصر أولاد بوبكر تعد من المؤسسات التعليمية الرائدة في المنطقة، 
                حيث تقدم تعليماً متميزاً لأجيالنا القادمة.
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-background-mosque-bg"></div>
            <div className="card-content">
              <h4>المسجد</h4>
              <p>
                المسجد في قصر أولاد بوبكر يعتبر مركزًا روحيًا مهمًا حيث يجتمع الأهالي للصلاة والعبادات.
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-background-ksour-bg"></div>
            <div className="card-content">
              <h4>القصور</h4>
              <p>
                قصور قصر أولاد بوبكر تعكس تاريخاً غنياً وثقافة عريقة، وتعد من المعالم السياحية في المنطقة.
              </p>
            </div>
          </div>
        </div>

        <div className="cta-section">
          <div className="cta-content">
            <h2>إبدأ رحلتك معنا الآن</h2>
            <p>
              نحن في مرحلة جديدة من تطوير شجرة العائلة الرقمية. انضم إلينا للمساهمة في تحديثها باستمرار
              وكن جزءًا من بناء المستقبل للأجيال القادمة.
            </p>
          </div>
          <div className="cta-actions">
            <button className="cta-button">استكشف الآن</button>
            <button className="cta-secondary-button">اعرف المزيد</button>
          </div>
        </div>

      </div>

    </div>

  );
};

export default MainPage;
