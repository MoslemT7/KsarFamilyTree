// WeddingDatesPage.jsx
import React, { useState } from 'react';
import '../styles/wedding.css';

const WeddingPage = () => {
  const [weddings, setWeddings] = useState([]);
  const [form, setForm] = useState({
    groomName: '',
    groomFather: '',
    groomGrandfather: '',
    groomFamily: '',
    brideFather: '',
    brideGrandfather: '',
    brideFamily: '',
    partyDate: '',
    dinnerDate: '',
    closingDate: '',
    place: ''
  });
  const [showList, setShowList] = useState(false);
  const [range, setRange] = useState({ start: '', end: '' });
  const [freeDays, setFreeDays] = useState([]);

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleAdd = e => {
    e.preventDefault();
    setWeddings(w => [...w, { ...form }]);
    setForm({
      groomName: '', groomFather: '', groomGrandfather: '', groomFamily: '',
      brideFather: '', brideGrandfather: '', brideFamily: '',
      partyDate: '', dinnerDate: '', closingDate: '', place: ''
    });
  };

  const handleCheck = e => {
    e.preventDefault();
    if (!range.start || !range.end) return;
    const sd = new Date(range.start), ed = new Date(range.end);
    const allDates = [];
    for (let d = new Date(sd); d <= ed; d.setDate(d.getDate()+1)) {
      allDates.push(d.toISOString().slice(0,10));
    }
    const occupied = new Set();
    weddings.forEach(w => {
      [w.partyDate, w.dinnerDate, w.closingDate].forEach(d => {
        if (d >= range.start && d <= range.end) occupied.add(d);
      });
    });
    const free = allDates.filter(d => !occupied.has(d));
    setFreeDays(free);
  };

  return (
    <div className="wd-container">
        
        <div className='description'>
          <h1>أعراسنا</h1>
          <p>هذه الصفحة مخصصة لتوثيق وعرض تواريخ الأعراس الخاصة بسكّان قصر أولاد بوبكر،
             حيث يمكن للمستخدمين إدخال معلومات تفصيلية حول كل عرس، مثل اسم العريس ونَسَبه،
             وأصول العروس، بالإضافة إلى تواريخ الحفلات المختلفة (سهرية النساء، العشاء، ,الجحفة).
              كما يمكن إضافة وصف اختياري لمكان إقامة العرس. بعد إدخال البيانات، يمكن استعراض قائمة الأعراس في شكل بطاقات مرتبة وأنيقة،
               كما توفر الصفحة أداة ذكية تتيح للمستخدم التحقق من الفترات الزمنية التي لا تحتوي على أي أعراس،
               مما يساعد في اختيار تواريخ مناسبة لتنظيم مناسبات مستقبلية دون تعارض.








</p>
        </div>
        {/* Full-Width Form */}
        <form className="wd-form" onSubmit={handleAdd}>
          <div className="fieldsets-row">
            <fieldset>
              <legend>بيانات العريس</legend>
              <input name="groomName" onChange={handleChange} value={form.groomName} placeholder="الاسم" required />
              <input name="groomFather" onChange={handleChange} value={form.groomFather} placeholder="اسم الأب" required />
              <input name="groomGrandfather" onChange={handleChange} value={form.groomGrandfather} placeholder="اسم الجد" required />
              <input name="groomFamily" onChange={handleChange} value={form.groomFamily} placeholder="اسم العائلة" required />
            </fieldset>

            <fieldset>
              <legend>بيانات العروس</legend>
              <input name="brideFather" onChange={handleChange} value={form.brideFather} placeholder="اسم الأب" required />
              <input name="brideGrandfather" onChange={handleChange} value={form.brideGrandfather} placeholder="اسم الجد" required />
              <input name="brideFamily" onChange={handleChange} value={form.brideFamily} placeholder="اسم العائلة" required />
            </fieldset>

            <fieldset>
              <legend>تواريخ الحفل</legend>
              <label>حفل النساء<input type="date" name="partyDate" onChange={handleChange} value={form.partyDate} required /></label>
              <label>العشاء<input type="date" name="dinnerDate" onChange={handleChange} value={form.dinnerDate} required /></label>
              <label>خروج الموتير (الكورتيج)<input type="date" name="closingDate" onChange={handleChange} value={form.closingDate} required /></label>
            </fieldset>
          </div>

          <textarea name="place" onChange={handleChange} value={form.place} placeholder="وصف المكان (اختياري)" />

          <div className="btn-group">
            <button type="submit" className="btn add">إضافة العرس</button>
            <button type="button" className="btn list" onClick={() => setShowList(s => !s)}>
              {showList ? 'إخفاء الكل' : 'عرض كل الأعراس'}
            </button>
          </div>
        </form>

        {/* Display Section */}
        <div className="wd-section">
          {showList && (
            <div className="wd-list">
              <h2>قائمة الأعراس</h2>
              <div className="wd-cards-grid">
                {weddings.map((w, i) => (
                  <div key={i} className="wd-card">
                    <h3>العرس #{i + 1}</h3>
                    <p><strong>العريس:</strong> {w.groomName} بن {w.groomFather} بن {w.groomGrandfather} ({w.groomFamily})</p>
                    <p><strong>العروس من:</strong> {w.brideFather} بن {w.brideGrandfather} ({w.brideFamily})</p>
                    <p><strong>سهرية النساء:</strong> {w.partyDate} | <strong>وليمة العشاء:</strong> {w.dinnerDate} | <strong>الجحفة:</strong> {w.closingDate}</p>
                    {w.place && <p className="place">🏛️ {w.place}</p>}
                  </div>
                ))}
              </div>
            </div>

          )}

          <form className="wd-check" onSubmit={handleCheck}>
            <h2>تحقق من الأيام الفارغة</h2>
            <label>من <input type="date" value={range.start} onChange={e => setRange(r => ({ ...r, start: e.target.value }))} required /></label>
            <label>إلى <input type="date" value={range.end} onChange={e => setRange(r => ({ ...r, end: e.target.value }))} required /></label>
            <button type="submit" className="btn check">تحقق</button>
          </form>

          {freeDays.length > 0 && (
            <div className="wd-free">
              <h3>عدد الأيام الفارغة: {freeDays.length}</h3>
              <ul>
                {freeDays.map(d => <li key={d}>{d}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>

  );
};

export default WeddingPage;
