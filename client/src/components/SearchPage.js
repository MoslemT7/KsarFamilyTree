import React, { useState, useEffect } from 'react';
import neo4j from 'neo4j-driver';
import "./SearchPage.css"
const translations = require('./translation.json');
require('dotenv').config(); // Load .env file

const driver = neo4j.driver(
  'neo4j+s://2cd0ce39.databases.neo4j.io',  // URI of the Neo4j server
  neo4j.auth.basic('neo4j', 'nW1azrzTK-lrTOO5G1uOkUVFwelcQlEmKPHggPUB7xQ'));

export const translateName = (fullName, language = true) => {
  const nameParts = fullName.split(' ');

  // Build reverse translation map if needed
  const reverseTranslations = Object.fromEntries(
    Object.entries(translations).map(([key, value]) => [value, key])
  );

  const dict = language ? translations : reverseTranslations;

  const translatedParts = nameParts.map(part => dict[part] || part);

  return translatedParts.join(' ');
};

function splitName(fullName) {
  const parts = fullName.replace(/ ben /gi, ' ').split(/\s+/);
  if (parts.length === 2) {
    return {
      personName: parts[0],
      fatherName: "",
      grandfatherName: "",
      familyName: parts[1]
    };
  } else if (parts.length === 3) {
    return {
      personName: parts[0],
      fatherName: parts[1],
      grandfatherName: "",
      familyName: parts[2]
    };
  } else if (parts.length === 4) {
    return {
      personName: parts[0],
      fatherName: parts[1],
      grandfatherName: parts[2],
      familyName: parts[3]
    };
  }
  // Default case if structure doesn't match
  return { personName: parts[0], fatherName: "", grandfatherName: "", familyName: parts[1] };
}



const SearchPage = () => {
  
  const [searchQuery, setSearchQuery] = useState('');
  const [personDetails, setPersonDetails] = useState(null);
  const [error, setError] = useState('');
  
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handlePersonSelect = (selectedPerson) => {
    // When the user selects a match, update the state to show detailed information about the selected person
    setPersonDetails({
      personName: selectedPerson.personName,
      fatherName: selectedPerson.fatherName,
      grandfatherName: selectedPerson.grandfatherName,
      familyName: selectedPerson.familyName,
      gender: selectedPerson.gender,
      age: selectedPerson.age,  // You can calculate the age in the same way as before
    });
  };

  const handleSearchSubmit = async () => {
    if (!searchQuery.trim()) {
      setError('الرجاء إدخال نص للبحث.');
      setPersonDetails(null);
      return;
    }
    await searchPerson(searchQuery.trim());
  };

  const searchPerson = async (searchText) => {
    let translatedInputName = translateName(searchText, false);
    console.log(translatedInputName);
    const { personName, fatherName, grandfatherName, familyName } = splitName(translatedInputName);


    let cypherQuery = `
      MATCH (grandfather:Person)-[:FATHER_OF]->(father:Person)-[:FATHER_OF]->(child:Person)
      WHERE 1=1
    `;

    const queryParamsObject = {};

    if (personName) {
      cypherQuery += ` AND child.name = $personName`;
      queryParamsObject.personName = personName;
    }

    if (fatherName) {
      cypherQuery += ` AND father.name = $fatherName`;
      queryParamsObject.fatherName = fatherName;
    }

    if (grandfatherName) {
      cypherQuery += ` AND grandfather.name = $grandfatherName`;
      queryParamsObject.grandfatherName = grandfatherName;
    }

    if (familyName) {
      cypherQuery += ` AND child.lastName = $familyName`;
      queryParamsObject.familyName = familyName;
    }

    cypherQuery += `
      RETURN 
        child.name AS childName, 
        father.name AS fatherName, 
        grandfather.name AS grandfatherName, 
        child.YoB AS childYoB, 
        child.gender AS childGender, 
        child.lastName AS familyName
    `;

    const session = driver.session();
    try {
      const result = await session.run(cypherQuery, queryParamsObject);

      if (result.records.length == 1) {
        const record = result.records[0];
        const age = new Date().getFullYear() - record.get('childYoB');

        setPersonDetails({
          personName: record.get('childName'),
          fatherName: record.get('fatherName'),
          grandfatherName: record.get('grandfatherName'),
          familyName: record.get('familyName'),
          gender: record.get('childGender'),
          age,
        });

        setError('');
      }
      else if (result.records.length >= 2) {
        // Prepare a list of matching persons to show
        const multipleMatches = result.records.map(record => ({
          personName: record.get('childName'),
          fatherName: record.get('fatherName'),
          grandfatherName: record.get('grandfatherName'),
          familyName: record.get('familyName'),
        }));
      
        setPersonDetails({ multipleMatches });
        setError('هناك العديد من الأشخاص يحملون نفس الاسم. الرجاء اختيار الشخص الصحيح.');
      }
      else {
        setPersonDetails(null);
        setError('لم يتم العثور على شخص مطابق.');
      }
    } catch (err) {
      console.error('Query Error:', err);
      setError('حدث خطأ أثناء البحث.');
      setPersonDetails(null);
    } finally {
      await session.close();
    }
  };

  return (
    <div className="search-page">
      <header className="search-header">
        <h1>ابحث عن شخص في شجرة العائلة</h1>
        <input
          type="text"
          className="search-bar"
          placeholder="ادخل الاسم الثلاثي أو الرباعي..."
          value={searchQuery}
          onChange={handleSearchChange}
        />
        <button className="search-button" onClick={handleSearchSubmit}>ابحث</button>
      </header>

      {error && <div className="error-message">{error}</div>}

      {personDetails && personDetails.multipleMatches ? (
  <div className="multiple-matches">
    <h2>نتائج متعددة:</h2>
    {personDetails.multipleMatches.map((person, index) => (
      <div 
        key={index} 
        className="match-item"
        onClick={() => handlePersonSelect(person)}
        style={{ cursor: 'pointer' }}
      >
        <p><p className='dupPersonName'>{index + 1}- {translateName(person.personName)} بن {translateName(person.fatherName)} بن {translateName(person.grandfatherName)} {translateName(person.familyName)}</p></p>
        <hr />
      </div>
    ))}
  </div>
) : personDetails ? (
  <div className="person-details">
    <h2>تفاصيل الشخص :</h2>
    <h3>{translateName(personDetails.personName)} بن {translateName(personDetails.fatherName)} بن {translateName(personDetails.grandfatherName)} {translateName(personDetails.familyName)}</h3>
    <table className="person-details-table">
      <thead>
        <tr>
          <th className='blankHeader'></th>
          <th>الإسم</th>
          <th>إسم الأب</th>
          <th>إسم الجّد</th>
          <th>إسم العائلة / اللقب</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>الشخص</strong></td>
          <td><p className='personDetails'>{translateName(personDetails.personName) || 'غير متوفر'}</p></td>
          <td><p className='personDetails'>{translateName(personDetails.fatherName) || 'غير متوفر'}</p></td>
          <td><p className='personDetails'>{translateName(personDetails.grandfatherName) || 'غير متوفر'}</p></td>
          <td><p className='personDetails'>{translateName(personDetails.familyName) || 'غير متوفر'}</p></td>
        </tr>
        <tr>
          <td><strong>الأم</strong></td>
          <td><p className='personDetails'>{translateName(personDetails.personName) || 'غير متوفر'}</p></td>
          <td><p className='personDetails'>{translateName(personDetails.personName) || 'غير متوفر'}</p></td>
          <td><p className='personDetails'>{translateName(personDetails.personName) || 'غير متوفر'}</p></td>
          <td><p className='personDetails'>{translateName(personDetails.personName) || 'غير متوفر'}</p></td>
        </tr>
      </tbody>
    </table>
    <table className="person-details2-table">
      <thead>
        <tr>
          <th>الجنس</th>
          <th>العمر</th>
          <th>الحالة المدنية</th>
          <th>حالة الحياة</th>
          <th>عدد الأطفال</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{personDetails.gender === 'Male' ? 'ذكر 👨'  : 'أنثى 👩'}</td>
          <td>
            {personDetails.age === 1
              ? 'سنة واحدة'
              : personDetails.age === 2
              ? 'سنتان'
              : personDetails.age >= 3 && personDetails.age <= 10
              ? `${personDetails.age} سنوات`
              : `${personDetails.age} سنة`}
          </td>
          <td>{personDetails.maritalStatus || 'غير متوفر'}</td>
          <td>{personDetails.lifeStatus === 'alive' ? 'حي' : 'متوفى'}</td>
          <td>{personDetails.childrenCount || 'غير متوفر'}</td>
        </tr>
      </tbody>
    </table>
    
  </div>
) : (
  <div className="no-results">
    <p>لا توجد نتائج للبحث.</p>
  </div>
)}

    </div>
  );
};

export default SearchPage;

