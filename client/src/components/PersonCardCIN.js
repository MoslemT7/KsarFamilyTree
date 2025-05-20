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
                  ? ' بن ' + utils.translateName(person.fatherName)
                  : ''}
                {person.grandfatherName
                  ? ' بن ' + utils.translateName(person.grandfatherName)
                  : ''}
              </p>
              <p>
                <strong>سنة الميلاد:</strong>{' '}
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
              {utils.translateName(person.motherName) || 'غير معروف'}{' '}
              {utils.translateFamilyName(person.motherFamilyName) ||
                'غير معروف'}
            </p>
            <p>
              <strong>الحالة:</strong>{' '}
              {person.lifeStatus === true ? (
                'حـي'
              ) : (
                <>
                  متوفـى
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
              {/* insert siblingsCount if you have it */}
            </p>
            <p>
              <strong>الحالة الإجتماعـية :</strong>{' '}
              {person.lifeStatus === true
                ? person.maritalStatus === true
                  ? 'متزوج'
                  : 'أعزب'
                : ' - '}
            </p>
          </div>
          <img
            src={barcode}
            alt="Barcode"
            className="cin-barcode"
          />
        </div>
      </div>
    </div>
  );
};

export default PersonCINCard;
