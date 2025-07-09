import {useState } from 'react';
import '../styles/PersonCINCard.css';
import logo from '../media/logo1.png'; // replace with your logo
import portrait from '../media/portrait.png';
import * as utils from '../utils/utils';

const PersonCINCard = ({ person }) => {
  const [flipped, setFlipped] = useState(false);
  const handleClick = () => {
    setFlipped(f => !f);
  };
  
  return (
    <div
      className={`cin-card${flipped ? ' flipped' : ''}`}
      onClick={handleClick}
      role="button"
      aria-pressed={flipped}
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setFlipped(f => !f);
        }
      }}
    >
      <div className="cin-inner">
        {/* Front Side */}
        <div className="cin-front">
          <div className="cin-header">
            <img src={logo} alt="Project Logo" className="cin-logo" />
            <h2 className="cin-title">بطاقة تعريف عائلية</h2>
            <div className="cin-badge">🇹🇳</div>
          </div>

          <div className="cin-number">
            رقم الهوية: {person.personID}
          </div>

          <div className="cin-info">
            <div className="cin-names">
              <p>
                <strong>الفرع </strong>
                <span>{person.Branch}</span>
                </p>
              <p>
                <strong>اللقب</strong>{' '}
                <span id="familyName">
                  {utils.translateFamilyName(person.familyName)}
                </span>
              </p>
              <p>
                <strong>الإسم</strong>{' '}
                {utils.translateName(person.personName)}
                {person.Nickname ? " (" +  utils.translateName(person.Nickname) + ")": ""}
              </p>
              <p>
                {utils.formatFullName(person.fullLineage, person.gender, 1, 5)}
              </p>
              <p>
                <strong>
                  {person.age === -1
                    ? 'سنة الولادة'
                    : person.lifeStatus === false
                    ? 'سنة الولادة والوفاة'
                    : 'سنة الولادة (العمر)'}
                </strong>{' '}
                {person.age === -1 ? (
                  'غير معروف'
                ) : person.lifeStatus === false ? (
                  `${new Date().getFullYear() - person.age} - ${person.YoD ?? 'تاريخ غير معروف'}`
                ) : (
                  `${new Date().getFullYear() - person.age} (${
                    person.age === 1
                      ? 'سنة واحدة'
                      : person.age === 2
                      ? 'سنتان'
                      : person.age >= 3 && person.age <= 10
                      ? `${person.age} سنوات`
                      : `${person.age} سنة`
                  })`
                )}
              </p>


              <p>
                <strong>مكان السكن  </strong>
                قصر أولاد بوبكر
              </p>
            </div>

            <div className="cin-photo">
              <img src={portrait} alt="Portrait" />
            </div>
          </div>
        </div>

        <div className="cin-back">
          <div className="cin-info-back">
            <p>
              <strong>إسم ولقب الأم:</strong>{' '}
              {person.motherName || person.motherFamilyName
              ? `${utils.translateName(person.motherName || '')} ${utils.translateFamilyName(person.motherFamilyName || '')}`.trim()
              : 'غير معروف'}
            </p>
            
              {!person.lifeStatus && (
                <p>
                <strong>الحالة:</strong>{' '}
                <>
                  <label>متوفى</label>
                  <br />
                  <strong>سنة الوفاة:</strong>{' '}
                  {person.YoD || 'غير معروف'}
                </>
                </p>
              )}
            
            <p>
              <strong>عدد الأطفال: </strong>
              {person.childrenCount === 0
                ? 'لا يوجد'
                : person.childrenCount === 1
                ? 'طفل واحد'
                : person.childrenCount === 2
                ? 'طفلان'
                : person.childrenCount >= 3 && person.childrenCount <= 10
                ? `${person.childrenCount} أطفال`
                : `${person.childrenCount} طفلًا`
                }
            </p>

            <p>
              <strong>عدد الإخوة: </strong>
              {person?.childrenCount === 0
                      ? "لا إخوة"
                      : person.siblingsCount === 1
                      ? "أخ واحد (1)"
                      : person.siblingsCount === 2
                      ? "أخوان (2)"
                      : person.siblingsCount >= 3 && person.siblingsCount <= 10
                      ? `${person.siblingsCount} إخوة`
                      : `${person.siblingsCount} أخـًا`
              }
            </p>
            {person?.lifeStatus === true && (
            <p>
              <strong>الحالة الإجتماعـية :</strong>{' '}
              {person.maritalStatus === 'married' || person.maritalStatus === 'historical'
                ? person.gender === 'Male'
                  ? 'متزوج'
                  : 'متزوجة'
                : person.maritalStatus === 'widowed'
                ? person.gender === 'Male'
                  ? 'أرمل'
                  : 'أرملة'
                : person.gender === 'Male'
                ? 'عازب'
                : 'عزباء'}
            </p>
          )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonCINCard;
