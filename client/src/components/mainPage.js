import React from 'react';
import '../styles/mainPage.css';  // تأكد من استيراد ملف الـ CSS
import { useNavigate } from 'react-router-dom'; // Import the useNavigate hook
import usePageTracking from '../utils/trackers';
import { Box, Flex, Image, Text, Button, Stack, AspectRatio } from "@chakra-ui/react";
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
        <h3>من الماضي تنبع الفكرة</h3>
        <p>
          وُلد هذا المشروع من قلب الحنين إلى الجذور، ومن رغبة صادقة في صون الهوية العائلية لمجتمعنا. كانت قصص الأجداد تتردد في المجالس، وتحيا في الذاكرة، ولكنها مهددة بالنسيان مع مرور الزمن. من هنا جاءت الفكرة: تحويل تلك الذكريات والأنساب إلى أرشيف رقمي حيّ، محفوظ للأجيال القادمة.
          موقع قصر أولاد بوبكر هو خطوة نحو توثيق شامل لعائلاتنا، لتكون لكل فرد بصمته وامتداده مرئياً، ومفتوحاً لكل من يسعى للمعرفة والانتماء.
        </p>
        <h3>نحفظ الإرث، ونربط الأجيال</h3>
        <p>
          نحن نؤمن أن ربط الحاضر بالماضي ليس ترفاً، بل ضرورة لتعزيز الوعي الجمعي والروابط المجتمعية. حفظ الإرث العائلي هو وسيلة لترسيخ الانتماء، وتعميق الفهم بين أفراد العائلة الواحدة والعرش الكبير.
          لهذا تم بناء هذا الموقع ليكون أكثر من مجرد شجرة أنساب؛ إنه مساحة تفاعلية ذكية تتيح لكل زائر استكشاف النسب، فهم العلاقات، تصفح الإحصائيات الحيّة، واستيعاب النسيج الاجتماعي لقرية أولاد بوبكر بأسلوب بصري حديث وأدوات مخصصة تسهّل التنقل والاكتشاف.
        </p>
      </div>
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
      
        <div className="wedding-feature-card" >
          <div className="wedding-picture" id="one">
          </div>
          <div className="weddingfeaturetext">
            <p>
              انتهى زمن إعلانات الزواج التقليدية! عبر خدمة <strong>"أعراسنا"</strong>، يمكنكم معرفة{" "}
              <strong>تواريخ الأعراس القادمة، أماكنها، العائلات المعنية، والمزيد</strong> من التفاصيل، بطريقة راقية.
            </p>
            <button type="button" className="discoverNow" onClick={handleWeddingClick}>
              إحجز الآن
            </button>
          </div>
        </div>

      <div className="wedding-feature-card" id="two">
        <div className="wedding-picture" id="twoP">
        </div>
        <div className="weddingfeaturetext">
          <p>
            لا مزيد الطرق القديمة لمعرفة صلات القرابة وتعقيداتها! عبر خدمة <strong>“معرّف القرابة”</strong>، 
            يمكنكم اكتشاف <strong>العلاقة الحقيقية بين أي شخصين في العرش، مع شرح مفصل لطبيعة هذه العلاقة، والمسار العائلي الذي يربطهما</strong>، 
            وذلك بطريقة ذكية، مبسطة، وراقية تضفي وضوحًا وسهولة على عملية البحث.
          </p>

          <button type="button" className="discoverNow" onClick={handleRelationClick}>
            إكتشف الآن
          </button>
        </div>
      </div>
      <div className="stats-section">
        <h2></h2>
        <div className="cardsDiv">
        <div className="card">
          <h4>1000+ شخص</h4>
          <p>تم تسجيل بيانات أكثر من 1000 شخص في هذا المشروع</p>
        </div>
        <div className="card">
          <h4>70+ عائلة</h4>
          <p>تنتمي هذه الشخصيات إلى عشرات العائلات المترابطة</p>
        </div>
        <div className="card">
          <h4>10 أجيال</h4>
          <p>نغوص في أعماق التاريخ لربط أربعة أجيال أو أكثر</p>
        </div>
        <div className="card">
          <h4>إحصائيات حيّة</h4>
          <p>عدادات تُحدّث تلقائيًا مع كل إضافة أو تعديل جديد</p>
        </div>
      </div>
      
      </div>
      <div className="cta-section">
        <div className="cta-content">
          <h2>كن جزءاً من هذا الإرث العائلي</h2>
          <p>
            نُرحّب بكل من يحمل معلومة، صورة قديمة، أو حتى تصحيحاً بسيطاً—كل إضافة تُحدث فرقاً.
            شاركنا في توثيق الحكاية الكاملة لعائلات قصر أولاد بوبكر، وساهم في بناء مرجع أصيل للأجيال القادمة.
          </p>
          <div className="cta-buttons">
            <button type="button" className="cta-button">📤 أضف معلومة أو صورة</button>
            <button type="button" className="cta-secondary-button">📩 تواصل مع الفريق</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainPage;
