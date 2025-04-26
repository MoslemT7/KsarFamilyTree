import React, { useState, useEffect } from 'react';
import neo4j from 'neo4j-driver';
import "./SearchPage.css"
const translations = require('./translation.json');

const driver = neo4j.driver(
  'neo4j+s://2cd0ce39.databases.neo4j.io',  // URI of the Neo4j server
  neo4j.auth.basic('neo4j', 'nW1azrzTK-lrTOO5G1uOkUVFwelcQlEmKPHggPUB7xQ'));

  export const translateName = (name) => {
    return translations[name] || name;
  };
const reverseTranslation = Object.entries(translations).reduce((acc, [en, ar]) => {
    acc[ar] = en;
    return acc;
}, {});

const SearchPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [personDetails, setPersonDetails] = useState(null);
  const [error, setError] = useState('');
  const reverseTranslate = (name) => reverseTranslation[name] || name;
  
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const searchPerson = async (searchText) => {
    const tokens = searchText.trim().split(' ');
  
    // Assign tokens based on count
    let personName, fatherName, grandfatherName, familyName;
  
    if (tokens.length === 1) {
      personName = tokens[0];
    } else if (tokens.length === 2) {
      personName = tokens[0];
      familyName = tokens[1];
    } else if (tokens.length === 3) {
      personName = tokens[0];
      fatherName = tokens[1];
      familyName = tokens[2];
    } else if (tokens.length === 4) {
      personName = tokens[0];
      fatherName = tokens[1];
      grandfatherName = tokens[2];
      familyName = tokens[3];
    }
  
    // Reverse translate
    const translatedPersonName = personName ? reverseTranslate(personName) : null;
    const translatedFatherName = fatherName ? reverseTranslate(fatherName) : null;
    const translatedGrandfatherName = grandfatherName ? reverseTranslate(grandfatherName) : null;
    const translatedFamilyName = familyName ? reverseTranslate(familyName) : null;
  
    // Start Cypher query
    let cypherQuery = `
      MATCH (grandfather:Person)-[:FATHER_OF]->(father:Person)-[:FATHER_OF]->(child:Person)
      WHERE 1=1
    `;
  
    const queryParamsObject = {};
  
    if (translatedPersonName) {
      cypherQuery += ` AND child.name = $personName`;
      queryParamsObject.personName = translatedPersonName;
    }
  
    if (translatedFatherName) {
      cypherQuery += ` AND father.name = $fatherName`;
      queryParamsObject.fatherName = translatedFatherName;
    }
  
    if (translatedGrandfatherName) {
      cypherQuery += ` AND grandfather.name = $grandfatherName`;
      queryParamsObject.grandfatherName = translatedGrandfatherName;
    }
  
    if (translatedFamilyName) {
      cypherQuery += ` AND child.lastName = $familyName`;
      queryParamsObject.familyName = translatedFamilyName;
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
  
      if (result.records.length > 0) {
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
      } else {
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
  

  useEffect(() => {
    if (searchQuery.trim().length > 0) {
        console.log(searchQuery.trim());
      searchPerson(searchQuery.trim());
    } else {
      setPersonDetails(null);
      setError('');
    }
  }, [searchQuery]);

  return (
    <div className="search-page">
      <header className="search-header">
        <h1>ابحث عن شخص في شجرة العائلة</h1>
        <input
          type="text"
          className="search-bar"
          placeholder="ابحث عن اسم الشخص واسم العائلة أو الثلاثي..."
          value={searchQuery}
          onChange={handleSearchChange}
        />
      </header>

      {error && <div className="error-message">{error}</div>}

      {personDetails ? (
        <div className="person-details">
          <h2>تفاصيل الشخص :</h2>
          <h3>{translateName(personDetails.personName)} بن {translateName(personDetails.fatherName)} بن {translateName(personDetails.grandfatherName)} {translateName(personDetails.familyName)}</h3>
          <p><strong>الاسم:</strong> {translateName(personDetails.personName)}</p>
          <p><strong>اسم الأب:</strong> {translateName(personDetails.fatherName)}</p>
          <p><strong>اسم الجد:</strong> {translateName(personDetails.grandfatherName)}</p>
          <p><strong>اسم العائلة:</strong> {translateName(personDetails.familyName)}</p>
          <p><strong>الجنس:</strong> {personDetails.gender === 'Male' ? 'ذكر' : 'أنثى'}</p>
          <p><strong>العمر:</strong> {
          personDetails.age === 1 ? "سنة واحدة" :
          personDetails.age === 2 ? "سنتان" :
          personDetails.age >= 3 && personDetails.age <= 10 ? `${personDetails.age} سنوات` :
          `${personDetails.age} سنة`
        }</p>          
        <p><strong>الأم:</strong> {translateName(personDetails.motherName)}</p>
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
