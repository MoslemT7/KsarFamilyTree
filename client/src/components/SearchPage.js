import React, { useState, useEffect } from 'react';
import neo4j from 'neo4j-driver';
import "./SearchPage.css"
const translations = require('./translation.json');
require('dotenv').config();

const driver = neo4j.driver(
  'neo4j+s://2cd0ce39.databases.neo4j.io',  // URI of the Neo4j server
  neo4j.auth.basic('neo4j', 'nW1azrzTK-lrTOO5G1uOkUVFwelcQlEmKPHggPUB7xQ'));

export const translateName = (fullName, language = true) => {
  const nameParts = fullName.split(' ');

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
  
  const getChildrenOfFather = async (fatherId) => {
    const session = driver.session();
    try {
      const result = await session.run(
        `
        MATCH (father:Person)
        WHERE id(father) = $fatherId
        OPTIONAL MATCH (father)-[:FATHER_OF]->(child:Person)
        RETURN father, collect(child) AS children
        `,
        { fatherId }
      );
  
      if (result.records.length > 0) {
        const record = result.records[0];
        const fatherNode = record.get('father');
        const childrenNodes = record.get('children');
  
        const father = {
          id: fatherNode.identity.toNumber(),
          ...fatherNode.properties,
        };
  
        const children = childrenNodes
          .filter(child => child) // filter out nulls if no children
          .map(child => ({
            id: child.identity.toNumber(),
            ...child.properties,
          }));
  
        return { father, children };
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error fetching father and children:', error);
      return null;
    } finally {
      await session.close();
    }
  };
  
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


    let cypherQuery = ``;

    const queryParamsObject = {};

    if (personName){
      console.log(`Searching for person: ${personName}`);
      
      if (fatherName) {
        console.log(`Searching for father: ${fatherName}`);
        
        if (grandfatherName) {
          console.log(`Searching for grandfather: ${grandfatherName}`);
          
          if (familyName) {
            console.log(`Searching for familyName: ${familyName}`);
            
            cypherQuery += `
              MATCH (grandfather:Person)-[:FATHER_OF]->(father:Person)-[:FATHER_OF]->(child:Person)
              WHERE child.name = $personName AND 
                    father.name = $fatherName AND 
                    grandfather.name = $grandfatherName AND 
                    child.lastName = $familyName
              RETURN child.name AS childName, father.name AS fatherName, grandfather.name AS grandfatherName, child.lastName AS familyName,  
              child.YoB AS childYoB, child.gender AS childGender, id(child) AS childID
            `;
            
            queryParamsObject.personName = personName;
            queryParamsObject.fatherName = fatherName;
            queryParamsObject.grandfatherName = grandfatherName;
            queryParamsObject.familyName = familyName;
            
          } 
          else {
            console.log("No familyName provided.");
            cypherQuery += `
              MATCH (grandfather:Person)-[:FATHER_OF]->(father:Person)-[:FATHER_OF]->(child:Person)
              WHERE child.name = $personName AND 
                    father.name = $fatherName AND 
                    grandfather.name = $grandfatherName
              RETURN child.name AS childName, father.name AS fatherName, grandfather.name AS grandfatherName, 
              child.YoB AS childYoB, child.gender AS childGender, id(child) AS childID`;
            
            queryParamsObject.personName = personName;
            queryParamsObject.fatherName = fatherName;
            queryParamsObject.grandfatherName = grandfatherName;
          }
          
        } else {
          console.log("No grandfatherName provided.");
          if (familyName){
            cypherQuery += `
            MATCH (father:Person)-[:FATHER_OF]->(child:Person)
            WHERE child.name = $personName AND 
                  father.name = $fatherName AND
                  child.lastName = $familyName
            OPTIONAL MATCH (grandfather:Person)-[:FATHER_OF]->(father)
            RETURN child.name AS childName, 
                  father.name AS fatherName,
                  grandfather.name as grandfatherName,
                  child.lastName AS familyName,
                  child.YoB AS childYoB, 
                  child.gender AS childGender, 
                  id(child) AS childID
            `;
            queryParamsObject.personName = personName;
            queryParamsObject.fatherName = fatherName;
            queryParamsObject.familyName = familyName;
          }
          else{
            cypherQuery += `
            MATCH (father:Person)-[:FATHER_OF]->(child:Person)
            WHERE child.name = $personName AND 
                  father.name = $fatherName AND
            RETURN child.name AS childName, father.name AS fatherName
            child.YoB AS childYoB, child.gender AS childGender, id(child) AS childID
            `;
            queryParamsObject.personName = personName;
            queryParamsObject.fatherName = fatherName;
          }
          }
      }
      else {
        if (familyName){
          cypherQuery += `
          MATCH (child:Person)
          WHERE child.name = $personName AND child.lastName = $familyName
          OPTIONAL MATCH (father:Person)-[:FATHER_OF]->(child)
          OPTIONAL MATCH (grandfather:Person)-[:FATHER_OF]->(father)
          RETURN 
            child.name AS childName, 
            father.name AS fatherName,
            grandfather.name AS grandfatherName,
            child.lastName AS familyName,
            child.YoB AS childYoB, 
            child.gender AS childGender, 
            id(child) AS childID
        `;
        queryParamsObject.personName = personName;
        queryParamsObject.familyName = familyName;
        }
        else{
          console.log("No fatherName provided.");
          cypherQuery += `
            MATCH (child:Person)
            WHERE child.name = $personName
            OPTIONAL MATCH (father:Person)-[:FATHER_OF]->(child)
            OPTIONAL MATCH (grandfather:Person)-[:FATHER_OF]->(father)
            RETURN child.name AS childName, 
                  child.YoB AS childYoB, 
                  child.gender AS childGender,
                  father.name AS fatherName, 
                  grandfather.name AS grandfatherName,
                   child.lastName AS familyName,
                  id(child) AS childID

          `;
          queryParamsObject.personName = personName;
        }
      }
    }
    
    console.log("Cypher Query:", cypherQuery);
    console.log("Query Parameters:", queryParamsObject);
  
    const session = driver.session();
    try {
      const result = await session.run(cypherQuery, queryParamsObject);
      if (result.records.length === 0) {
        setError('هذا الشخص ليس مسجل في الشجرة.');
        setPersonDetails(null);
        return;
      }
      else if (result.records.length === 1) {
        const record = result.records[0];
        
        const age = new Date().getFullYear() - record.get('childYoB');
        const childID = record.get("childID").toNumber();
        console.log(childID);
        const motherQuery = await session.run(`
          OPTIONAL MATCH (mother:Person)-[:MOTHER_OF]->(child:Person)
          WHERE id(child) = $childID
          OPTIONAL MATCH (motherFather)-[:FATHER_OF]->(mother:Person)
          OPTIONAL MATCH (motherGrandFather)-[:FATHER_OF]->(motherFather:Person)
          RETURN 
            mother.name AS motherName,
            motherFather.name AS motherFatherName,
            motherGrandFather.name AS motherGrandFatherName,
            mother.lastName AS motherFamilyName
        `, {childID});
        const motherResult = motherQuery.records[0];

        const childrenCountRecord = await session.run(`
          MATCH (p:Person)-[:FATHER_OF|MOTHER_OF]->(child:Person)
          WHERE id(p) = $childID
          RETURN count(child) AS childrenCount
        `, { childID });
    
        const isMarried = await session.run(`
          MATCH (m:Person)-[r:HUSBAND_OF]->(w:Person)
          WHERE id(m) = $childID
          RETURN count(r) > 0 AS isMarried
        `, { childID });
    
        const personDetails = {
          personID: childID,
          personName: record.get('childName') ?? "غير متوفر", // Default if missing
          fatherName: record.has('fatherName') ? record.get('fatherName') : "غير متوفر", // Check if fatherName exists
          grandfatherName: record.has('grandfatherName') ? record.get('grandfatherName') : "غير متوفر", // Check if grandfatherName exists
          familyName: record.has('familyName') ? record.get('familyName') : "غير متوفر", // Check if familyName exists
          gender: record.has('childGender') ? record.get('childGender') : "غير متوفر", // Check if childGender exists
          age,
          motherName: motherResult.has('motherName') ? motherResult.get('motherName') : "غير متوفر", // Check if motherName exists
          motherFatherName: motherResult.has('motherFatherName') ? motherResult.get('motherFatherName') : "غير متوفر", // Check if motherFatherName exists
          motherGrandFatherName: motherResult.has('motherGrandfatherName') ? motherResult.get('motherGrandfatherName') : "غير متوفر", // Check if motherGrandfatherName exists
          motherFamilyName: motherResult.has('motherFamilyName') ? motherResult.get('motherFamilyName') : "غير متوفر", // Check if motherFamilyName exists

          lifeStatus: record.has('lifeStatus') ? record.get('lifeStatus') : "غير متوفر", // Check if lifeStatus exists
          martialStatus: isMarried.records[0]?.get('isMarried') ?? "غير متوفر", // Safe access for marital status
          childrenCount: childrenCountRecord.records[0]?.get('childrenCount')?.toInt() ?? 0 // Default to 0 if missing
        };
    
        setPersonDetails(personDetails);
        setError('');
    
      } else if (result.records.length >= 2) {
        const multipleMatches = result.records.map(record => ({
          personName: record.get('childName'),
          fatherName: record.has('fatherName') ? record.get('fatherName') : "غير متوفر", // Check for fatherName
          grandfatherName: record.has('grandfatherName') ? record.get('grandfatherName') : "غير متوفر", // Check for grandfatherName
          familyName: record.has('familyName') ? record.get('familyName') : "غير متوفر", // Check for familyName
        }));
    
        setPersonDetails({ multipleMatches });
        setError('هناك العديد من الأشخاص يحملون نفس الاسم. الرجاء اختيار الشخص الصحيح.');
    
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
    <h3>
    {translateName(personDetails?.personName ?? "غير معروف")}
    {personDetails?.fatherName ? ` بن ${translateName(personDetails.fatherName)}` : ''}
    {personDetails?.grandfatherName ? ` بن ${translateName(personDetails.grandfatherName)}` : ''}
    {personDetails?.familyName ? ` ${translateName(personDetails.familyName)}` : ''}    
</h3>
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
          <td><p className='personDetails'>{translateName(personDetails?.personName ?? '') || 'غير متوفر'}</p></td>
          <td><p className='personDetails'>{translateName(personDetails?.fatherName ?? '') || 'غير متوفر'}</p></td>
          <td><p className='personDetails'>{translateName(personDetails?.grandfatherName ?? '') || 'غير متوفر'}</p></td>
          <td><p className='personDetails'>{translateName(personDetails?.familyName ?? '') || 'غير متوفر'}</p></td>
        </tr>
        <tr>
          <td><strong>الأم</strong></td>
          <td><p className='personDetails'>{translateName(personDetails?.motherName ?? '') || 'غير متوفر'}</p></td>
          <td><p className='personDetails'>{translateName(personDetails?.motherFatherName ?? '') || 'غير متوفر'}</p></td>
          <td><p className='personDetails'>{translateName(personDetails?.motherGrandFatherName ?? '') || 'غير متوفر'}</p></td>
          <td><p className='personDetails'>{translateName(personDetails?.motherFamilyName ?? '') || 'غير متوفر'}</p></td>
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
          <td>
            {personDetails.isMarried === 1
              ? (personDetails.gender === 'Male' ? 'متزوج' : 'متزوجة')
              : (personDetails.gender === 'Male' ? 'أعزب' : 'عزباء')}
          </td>
          <td>
          {personDetails.lifeStatus === true 
            ? (personDetails.gender === 'Male' ? 'حي' : 'حية') 
            : (personDetails.gender === 'Male' ? 'متوفى' : 'متوفية')}
        </td>
        <td>
        <button
          onClick={async (e) => {
            e.stopPropagation();
            const children = await getChildrenOfFather(personDetails.childID);
            console.log(children);
          }}
        >
          {personDetails.childrenCount === 0 || personDetails.childrenCount == null
            ? '0'
            : personDetails.childrenCount === 1
            ? 'طفل واحد'
            : personDetails.childrenCount === 2
            ? 'طفلان'
            : personDetails.childrenCount >= 3 && personDetails.childrenCount <= 10
            ? `${personDetails.childrenCount} أطفال`
            : `${personDetails.childrenCount} طفلا`
          }
        </button>
      </td>
        </tr>
      </tbody>
    </table>
    
  </div>
) : (
  <div className="no-results">
    <p>لا توجد نتائج للبحث.</p>
  </div>
)}
  <div>
    
  </div>
    </div>
  );
};

export default SearchPage;

