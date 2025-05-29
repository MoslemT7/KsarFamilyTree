import React from 'react';
import '../styles/mainPage.css';  // تأكد من استيراد ملف الـ CSS
import { useNavigate } from 'react-router-dom'; // Import the useNavigate hook
import usePageTracking from '../utils/trackers';

const MainPage = () => {
  const navigate = useNavigate();
  usePageTracking();
  const handleWeddingClick = () => {
    navigate('weddings'); 
  };
  const handleRelationClick = () => {
    navigate('relationChecker');
  };

  return (
    <div className="mainPage">
      <div className="welcome">
        <div className="welcomeMessage">
          <h1>مرحباً بكم في موقع قصر أولاد بوبكر</h1>
          <p>اِكتشف التاريخ، الأنساب، العلاقات، القصص، والإحصائيات الخاصة بعرش أولاد بوبكر</p>
        </div>
      </div>

      <div className="description">
        <h2>📌 لماذا أنشأنا هذا الموقع؟</h2>
        <p>
          وُلد هذا المشروع من قلب <strong>الحنين إلى الجذور</strong> والرغبة في حماية الهوية. 
          تم تصميم موقع <strong>قصر أولاد بوبكر</strong> ليكون أرشيفاً رقمياً حديثاً يوثق الأنساب والعلاقات 
          العائلية لكل فرد في العرش، ويُخلّد القصص التي لا تُنسى عن الماضي.
        </p>
        <p>
          نحن نؤمن أن ربط الحاضر بالماضي هو أحد أهم أشكال الوعي الجمعي، وأن حفظ الإرث العائلي يعزز الشعور بالانتماء. 
          كما أن الموقع يتيح لزائريه الوصول بسهولة إلى شجرة نسب تفاعلية، إحصائيات حيّة، وأدوات ذكية لفهم 
          النسيج الاجتماعي والقرابة داخل مجتمعنا.
        </p>
        
        <h2>📌 ما الذي يميز موقع قصر أولاد بوبكر؟</h2>
        <div className="features-cards">
          <div className="feature-card">
            <span className="emoji">🌳</span>
      تم تصميم الموقع بأسلوب <strong>راقي وعصري</strong> ليحترم هويتنا البصرية ويُبرز جمال تراثنا العائلي،
      مع تجربة استخدام مريحة وسلسة لكل الأعمار.
          </div>
          <div className="feature-card">
            <span className="emoji">🔎</span>
              هذا الموقع هو <strong>الواجهة الرقمية الرسمية لبلدة قصر أولاد بوبكر</strong>، يمثل كل فرد وكل عائلة فيه،
                    ويجمعنا في مكان واحد يوثق تاريخنا وروابطنا.
          </div>
          <div className="feature-card">
            <span className="emoji">📈</span>
 في الخلفية، تعمل <strong>خوارزميات متقدمة</strong> لفهم الروابط العائلية بدقة، مما يسمح ببناء شجرة عائلة ضخمة
      ومترابطة، وعرض العلاقات بذكاء وسلاسة.          </div>
          <div className="feature-card">
            <span className="emoji">💬</span>
      يوفّر الموقع <strong>نظام بحث ذكي</strong> يمكنك من الوصول لأي شخص ومعرفة موقعه في الشجرة، أفراد عائلته،
      وتسلسله، بضغطة زر واحدة.
          </div>
        </div>

        <div className="wedding-feature-card">
          <div className="wedding-picture">

          </div>
          <div className="weddingfeaturetext">
              <p>
                انتهى زمن إعلانات الزواج التقليدية! عبر خدمة <strong>"أعراسنا"</strong>، يمكنكم معرفة 
                <strong> تواريخ الأعراس القادمة، أماكنها، العائلات المعنية، والمزيد </strong> من التفاصيل، بطريقة راقية.
              </p>
              <button type="button" className="discoverNow" onClick={handleWeddingClick}>
                إحجز الآن
              </button>
            </div>
        </div>
        <div className="wedding-feature-card">
          

          <div className="weddingfeaturetext">
            <p>
              ودّعوا الطرق التقليدية لمعرفة صلة القرابة! من خلال خدمة <strong>"معرّف القرابة"</strong>، يمكنكم اكتشاف  
              <strong> صلة القرابة بين أي شخصين في العرش، مع شرح تفصيلي لطبيعة العلاقة، والمfسار العائلي الذي يجمع بينهما</strong>، 
              بطريقة ذكية وراقية.
            </p>
            <button type="button" className="discoverNow" onClick={handleRelationClick}>
              إكتشف الآن
            </button>
          </div>
          <div className="wedding-picture">
            <img src="../media/pic1.jpg"/>
          </div>
        </div>

        <div className="cta-section">
          <div className="cta-content">
            <h2>ساهم معنا في بناء هذا التاريخ</h2>
            <p>
              هل تملك معلومات أو صور قديمة؟ أو ترغب في الإبلاغ عن خطأ في البيانات؟ <br />
              تواصل معنا وساهم في تحسين جودة المعلومات.
            </p>
            <button type="button" className="cta-button">أضف معلومة</button>
            <button type="button" className="cta-secondary-button">تواصل معنا</button>
          </div>
        </div>
      </div>
    </div>

  );
};

export default MainPage;
