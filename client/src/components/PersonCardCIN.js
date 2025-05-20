import React, { useState } from 'react';
import '../styles/PersonCINCard.css';
import logo from '../media/logo.png'; // replace with your logo
import barcode from '../media/barcode.jpg'; // placeholder barcode
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
                <strong>اللقب</strong>{' '}
                <span id="familyName">
                  {utils.translateFamilyName(person.familyName)}
                </span>
              </p>
              <p>
                <strong>الإسم</strong>{' '}
                {utils.translateName(person.personName)}
              </p>
              <p>
                {person.fatherName
                  ? (person.gender === 'Male' ? ' بن ': ' بنت ') + utils.translateName(person.fatherName)
                  : ''}
                {person.grandfatherName
                  ? ' بن ' + utils.translateName(person.grandfatherName)
                  : ''}
              </p>
              <p>
                <strong>سنة الولادة  </strong>{' '}
                {person.age
                  ? `${new Date().getFullYear() - person.age} (${
                      person.age === 1
                        ? 'سنة واحدة'
                        : person.age === 2
                        ? 'سنتان'
                        : person.age >= 3 && person.age <= 10
                        ? `${person.age} سنوات`
                        : person.age > 10
                        ? `${person.age} سنة`
                        : 'غير معروف'
                    })`
                  : ''}
              </p>
              <p>
                <strong>مكانها  </strong>
                قصر أولاد بوبكر
              </p>
            </div>

            <div className="cin-photo">
              <img src={portrait} alt="Portrait" />
            </div>
          </div>
        </div>

        {/* Back Side */}
        <div className="cin-back">
          <div className="cin-info-back">
            <p>
              <strong>إسم ولقب الأم:</strong>{' '}
              {person.motherName || person.motherFamilyName
              ? `${utils.translateName(person.motherName || '')} ${utils.translateFamilyName(person.motherFamilyName || '')}`.trim()
              : 'غير معروف'}
            </p>
            <p>
              <strong>الحالة:</strong>{' '}
              {person.lifeStatus === true ? (
                  'على قيد الحياة'
              ) : (
                <>
                  'متوفى'
                  <br />
                  <strong>تاريخ الوفاة:</strong>{' '}
                  {person.deathYear || 'غير معروف'}
                </>
              )}
            </p>
            <p>
              <strong>عدد الأطفال: </strong>
              {person.childrenCount}
            </p>
            <p>
              <strong>عدد الإخوة: </strong>
              {person?.childrenCount === 0
                      ? "لا إخوة"
                      : person.childrenCount === 1
                      ? "أخ واحد (1)"
                      : person.childrenCount === 2
                      ? "أخوان (2)"
                      : person.childrenCount >= 3 && person.childrenCount <= 10
                      ? `${person.childrenCount} إخوة`
                      : `${person.childrenCount} أخـًا`
              }
            </p>
            <p>
              <strong>الحالة الإجتماعـية :</strong>{' '}
               {person?.maritalStatus === true
                      ? (person.gender === 'Male' ? 'متزوج' : 'متزوجة')
                      : (person.gender === 'Male' ? 'عازب' : 'عزباء')
                }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonCINCard;
