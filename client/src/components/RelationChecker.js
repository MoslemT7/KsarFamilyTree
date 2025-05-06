import React, { useEffect, useState } from 'react';
import './RelationChecker.css';
const translations = require('./translation.json');
require('dotenv').config();

const neo4jURI = process.env.REACT_APP_NEO4J_URI;
const neo4jUser = process.env.REACT_APP_NEO4J_USER;
const neo4jPassword = process.env.REACT_APP_NEO4J_PASSWORD;

const driver = require('neo4j-driver').driver(
    neo4jURI,
    require('neo4j-driver').auth.basic(neo4jUser, neo4jPassword)
);
const session = driver.session();

function countBenAndBent(str) {
  const matches = str.match(/\b(ben|bent)\b/gi);
  return matches ? matches.length : 0;
}

// Function that split english translated name that may contain ben to full name only parts.
function splitName(fullName) {
  const parts = fullName.replace(/\s+(ben|bent)\s+/gi, ' ').trim().split(/\s+/);
  const bentCount = countBenAndBent(fullName);
  if (parts.length === 2) {
    if (bentCount === 0){
      return {
        personName: parts[0],
        fatherName: "",
        grandfatherName: "",
        familyName: parts[1]
      };
    }
    else if (bentCount === 1){
      return {
        personName: parts[0],
        fatherName: parts[1],
        grandfatherName: "",
        familyName: ""
      };
    }
    
  } 
  else if (parts.length === 3) {
    if (bentCount === 1){
      return {
        personName: parts[0],
        fatherName: parts[1],
        grandfatherName: "",
        familyName: parts[2]
      };
    }
    else if (bentCount === 2){
      return {
        personName: parts[0],
        fatherName: parts[1],
        grandfatherName: parts[2],
        familyName: ""
      };
    }
    
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

const RelationPage = () => {
  const [person1, setPerson1] = useState('');
  const [person2, setPerson2] = useState('');
  const [relationship, setRelationship] = useState('');
  const [duplicates, setDuplicates] = useState({ person1: [], person2: [] });
  const [error, setError] = useState(null);
  const [ancestorName, setAncestorName] = useState('');
  const [ancestorLastName, setAncestorLastName] = useState('');

  const FetchRelationship = async (e) => {
    e.preventDefault();
  
    const result = await getRelationship(person1, person2);
  
    if (result.error === 'non-unique-name') {
      setDuplicates(result.duplicates);
      setRelationship(result.message); // optional message
    } else {
      setDuplicates({ person1: [], person2: [] });
      setRelationship(result);
    }
  };
  const getPersonMatches = async (personName, fatherName = "", grandfatherName = "", familyName) => {

    let cypherQuery = ``;
    const queryParamsObject = {};
  
    if (personName){
      if (fatherName) {
        if (grandfatherName) {
          if (familyName) {
            cypherQuery += `
              MATCH (grandfather:Person)-[:FATHER_OF]->(father:Person)-[:FATHER_OF]->(child:Person)
              WHERE child.name = $personName AND 
                    father.name = $fatherName AND 
                    grandfather.name = $grandfatherName AND 
                    child.lastName = $familyName
              RETURN 
                id(child) AS childID,
                child.name AS childName, 
                father.name AS fatherName, 
                grandfather.name AS grandfatherName, 
                child.lastName AS familyName  
            `;
            queryParamsObject.personName = personName;
            queryParamsObject.fatherName = fatherName;
            queryParamsObject.grandfatherName = grandfatherName;
            queryParamsObject.familyName = familyName;
          } 
          else {
            cypherQuery += `
              MATCH (grandfather:Person)-[:FATHER_OF]->(father:Person)-[:FATHER_OF]->(child:Person)
              WHERE child.name = $personName AND 
                    father.name = $fatherName AND 
                    grandfather.name = $grandfatherName
              RETURN 
                    id(child) AS childID, 
                    child.name AS childName, 
                    father.name AS fatherName, 
                    grandfather.name AS grandfatherName,
                    child.lastName AS familyName       
              `;
            
            queryParamsObject.personName = personName;
            queryParamsObject.fatherName = fatherName;
            queryParamsObject.grandfatherName = grandfatherName;
          }
          
        } else {
          if (familyName){
            cypherQuery += `
            MATCH (father:Person)-[:FATHER_OF]->(child:Person)
            WHERE child.name = $personName AND 
                  father.name = $fatherName AND
                  child.lastName = $familyName
            OPTIONAL MATCH (grandfather:Person)-[:FATHER_OF]->(father)
            RETURN  
              id(child) AS childID,
              child.name AS childName, 
              father.name AS fatherName,
              grandfather.name AS grandfatherName,
              child.lastName AS familyName
            `;
            queryParamsObject.personName = personName;
            queryParamsObject.fatherName = fatherName;
            queryParamsObject.familyName = familyName;
          }
          else{
            cypherQuery += `
            MATCH (father:Person)-[:FATHER_OF]->(child:Person)
            
            WHERE child.name = $personName AND 
                  father.name = $fatherName
            OPTIONAL MATCH (grandfather:Person)-[:FATHER_OF]->(father)
            RETURN  id(child) AS childID, 
                    child.name AS childName, 
                    father.name AS fatherName, 
                    grandfather.name AS grandfatherName,
                    child.lastName AS familyName
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
            id(child) AS childID,
            child.name AS childName, 
            father.name AS fatherName,
            grandfather.name AS grandfatherName,
            child.lastName AS familyName
        `;
        queryParamsObject.personName = personName;
        queryParamsObject.familyName = familyName;
        }
        else{
          cypherQuery += `
            MATCH (child:Person)
            WHERE child.name = $personName
            OPTIONAL MATCH (father:Person)-[:FATHER_OF]->(child)
            OPTIONAL MATCH (grandfather:Person)-[:FATHER_OF]->(father)
            RETURN
              id(child) AS childID,
              child.name AS childName, 
              father.name AS fatherName, 
              grandfather.name AS grandfatherName,
              child.lastName AS familyName
          `;
          queryParamsObject.personName = personName;
        }
      }
    }

    const session = driver.session();
    try {
      const result = await session.run(cypherQuery, queryParamsObject);
  
      return result.records.map(record => ({
        id: record.get('childID').toNumber(),
        name: record.get('childName'),
        father: record.get('fatherName') || "",
        grandfather: record.get('grandfatherName') || "",
        lastName: record.get('familyName')
      }));
    } 
    catch (Error) {
      console.error('Query Error:', Error);
      setError('حدث خطأ أثناء البحث.');
    } 
    finally {
      await session.close();
    }
  };
  const getRelationship = async (person1FullName, person2FullName) => {
    const isArabic = (text) => /[\u0600-\u06FF]/.test(text);
    let translatedName1, translatedName2;
  
    if (isArabic(person1FullName)){
      translatedName1 = translateName(person1FullName, false);
    }
    else{
      translatedName1 = person1FullName;
    }
    if (isArabic(person2FullName)){
      translatedName2 = translateName(person2FullName, false);
    }
    else{
      translatedName2 = person2FullName;
    }
    
    const { personName: person1Name, fatherName: person1FatherName, grandfatherName: person1GrandfatherName, familyName: person1LastName } = splitName(translatedName1);
    console.log(person1Name,person1FatherName,person1GrandfatherName,person1LastName);
    const { personName: person2Name, fatherName: person2FatherName, grandfatherName: person2GrandfatherName, familyName: person2LastName } = splitName(translatedName2);
    console.log(person1Name, person1FatherName, person1GrandfatherName, person1LastName);
    const errorContainer = document.getElementById('error-container');
    try {
      const person1Matches = await getPersonMatches(person1Name, person1FatherName, person1GrandfatherName, person1LastName);
      if (person1Matches.length === 0) {
        throw new Error(`لا يوجد أشخاص بإسم ${person1FullName} الرجاء التثبت في الإسم جيدا`);
      }
      const person2Matches = await getPersonMatches(person2Name, person2FatherName, person2GrandfatherName, person2LastName);
      if (person2Matches.length === 0) {
        throw new Error(`لا يوجد أشخاص بإسم ${person2FullName} الرجاء التثبت في الإسم جيدا`);
      }
  
      console.log("P1 matches : ", person1Matches);
      console.log("P2 matches : ", person2Matches);
  
      let person1ID, person2ID;
      if (person1Matches.length > 1 || person2Matches.length > 1) {
        return {
          error: 'non-unique-name',
          message: 'تم العثور على عدة أشخاص بنفس الاسم. الرجاء اختيار الصحيح.',
          duplicates: {
            person1: person1Matches.length > 1 ? person1Matches : [],
            person2: person2Matches.length > 1 ? person2Matches : []
          }
        };
      }
      else{
        person1ID = person1Matches[0].id;
        person2ID = person2Matches[0].id;
      }
      // Function that return the ancestors of a given person starting with the person itself and going up to the root.
      const getAncestors = async (person1ID, person2ID) => {
        const result = await session.run(`
          MATCH path1 = (common:Person)-[:FATHER_OF|MOTHER_OF*0..4]->(p1:Person)
          WHERE id(p1) = $person1ID
      
          MATCH path2 = (common)-[:FATHER_OF|MOTHER_OF*0..4]->(p2:Person)
          WHERE id(p2) = $person2ID
            AND id(p1) <> id(p2)
      
          WITH common, path1, path2, length(path1) AS level1, length(path2) AS level2
          ORDER BY (level1 + level2) ASC
          LIMIT 1
      
          RETURN 
            common.name AS commonAncestorName,
            common.lastName AS commonAncestorLastName,
            id(common) AS commonAncestorID,
            common.gender AS commonAncestorGender,
            level1 AS generationsFromP1,
            level2 AS generationsFromP2,
            [n IN nodes(path1) | { id: id(n), name: n.name, lastName: n.lastName, gender: n.gender }] AS pathToP1,
            [n IN nodes(path2) | { id: id(n), name: n.name, lastName: n.lastName, gender: n.gender }] AS pathToP2
        `, { person1ID, person2ID });

        const record = result.records[0];
      
        return {
            id: record.get('commonAncestorID').toNumber(),
            name: record.get('commonAncestorName'),
            lastName: record.get('commonAncestorLastName'),
            gender: record.get('commonAncestorGender'),
            levelFromP1: record.get('generationsFromP1').toNumber(),
            levelFromP2: record.get('generationsFromP2').toNumber(),
            pathFromAncestorToP1: record.get('pathToP1'),
            pathFromAncestorToP2: record.get('pathToP2')
        };
      };
      
      let relationRecord = await getAncestors(person1ID, person2ID);
      let ancestorID, ancestorName, ancestorLastName, ancestorGender;
      let levelFromP1, levelFromP2, pathFromAncestorToP1, pathFromAncestorToP2;

      ({ 
        ancestorID, 
        ancestorName, 
        ancestorLastName, 
        ancestorGender, 
        levelFromP1, 
        levelFromP2, 
        pathFromAncestorToP1, 
        pathFromAncestorToP2 
      } = relationRecord);

      const pathToP1 = pathFromAncestorToP1;
      const pathToP2 = pathFromAncestorToP2;
  
      console.log(pathFromAncestorToP1.reverse().map(a => a.name).join(" ben "));
      console.log(pathFromAncestorToP2.reverse().map(a => a.name).join(" ben "));
  
      var p1Level = levelFromP1;
      var p2Level = levelFromP2;
            
      const translatedName1 = translateName(person1FullName);
      const translatedName2 = translateName(person2FullName);
  
      const gender1 = pathToP1[0].gender;
      const gender2 = pathToP2[0].gender;
  
      console.log(`Level: (${p1Level}, ${p2Level})`);
  
      if (p1Level === 0 && p2Level === 1) {
        if (gender1 === 'Male'){
          return `${translatedName1} هو والد ${translatedName2}`;
        }
        else{
          return `${translatedName1} هي والدة ${translatedName2}`;
        }
      }
  
      else if (p1Level === 1 && p2Level === 0) {
        if (gender1 === 'Male'){
          console.log(`${translatedName1} هو ابن ${translatedName2}`);
          return `${translatedName1} هو ابن ${translatedName2}`;
        }
        else{
          console.log(`${translatedName1} هي إبنة ${person2FullName}`);
          return `${translatedName1} هي إبنة ${translatedName2}`;
        }
      } 
  
      else if (p1Level === 2 && p2Level === 0) {
        if (gender1 === 'Male'){
          return `${translatedName1} هو حفيد ${translatedName2}`;
        }
        else{
          return `${translatedName1} هي حفيدة ${translatedName2}`;
        }
      }
  
      else if (p1Level === 0 && p2Level === 2) {
        if (gender1 === 'Male'){
          return `${translatedName1} هو جدّ ${translatedName2}`;
        }
        else{
          return `${translatedName1} هي جدّة ${translatedName2}`;
        }
      }
  
      else if (p1Level === 3 && p2Level === 0) {
        if (gender1 === 'Male'){
          return `${translatedName1} هو إبن حفيد ${translatedName2}`;
        }
        else{
          return `${translatedName1} هي إبنة حفيدة ${translatedName2}`;
        }
      }
  
      else if (p1Level === 0 && p2Level === 3) {
        if (gender1 === 'Male'){
          return `${translatedName1} و جد والد ${translatedName2}`;
        }
        else{
          return `${translatedName1} هي جدة والدة ${translatedName2}`;
        }
      } 
      
      else if (p1Level === 1 && p2Level === 1) {
        if (gender1 === 'Male' && gender2 === 'Male'){
          return `${translatedName1} و ${translatedName2} إخوة`;
        }
        else if (gender1 === 'Female' && gender2 === 'Female'){
          return `${translatedName1} و ${translatedName2} أخوات`;
        }
        else{
          return `${translatedName1} و ${translatedName2} إخوة`;
        }
      } 
      
      else if (p1Level === 2 && p2Level === 1) {
        if (gender1 === 'Male'){
          return `${translatedName1} هو ابن أخ ${translatedName2}`;
        }
        else{
          return `${translatedName1} هي إبن أخ ${translatedName2}`;
        }
      } 
      
      else if (p1Level === 1 && p2Level === 2) {
        if (gender1 === 'Male'){
          return `${translatedName1} هو عم ${translatedName2}'`;
        }
        else{
          return `${translatedName1} هي عمّة ${translatedName2}`;
        }
      }
  
      else if (p1Level === 2 && p2Level === 2) {
        console.log(`${translatedName1} و ${translatedName2} أولاد العم.`);
    
        const p1AncestorGender = pathToP1[1].gender;
        const p2AncestorGender = pathToP2[1].gender;
  
        if (gender1 === 'Male') { 
          if (p2AncestorGender === 'Male') { 
            if (p1AncestorGender === 'Male'){  // ولد عمه
              return `${translatedName1} إبن عم ${translatedName2}`;
            }
            else{ // ولد عمته
              return `${translatedName1} هو إبن عمّة ${translatedName2}`;
            }
          } 
          else {  
            if (p1AncestorGender === 'Male'){  // ولد خاله
              return `${translatedName1} هو إبن خال ${translatedName2}`;
            }
            else{ // ولد خالته
              return `${translatedName1} هو إبن خالة ${translatedName2}`;
            }
          }
        }
        else {
          if (p1AncestorGender === 'Male') { 
            if (p2AncestorGender === 'Male'){  // بنت عمه
              return `${translatedName1} هي إبنة عمّ ${translatedName2}`;
            }
            else{ // بنت عمته
              return `${translatedName1} هي إبنة عمّة ${translatedName2}`;
            }
          } 
          else {  
            if (p2AncestorGender === 'Male'){  // بنت خاله
              return `${translatedName1} هي إبنة خال ${translatedName2}`;
            }
            else{ // بنت خالته
              return `${translatedName1} هي إبنة خالة ${translatedName2}`;
            }
          }
        }
      }
  
      else if (p1Level === 2 && p2Level === 3) {         
  
        const p1AncestorGender = pathToP1[1].gender;
        const p2AncestorGender = pathToP2[1].gender;
        console.log(p1AncestorGender, p2AncestorGender);
        if (gender1 === 'Male') { 
          if (p1AncestorGender === 'Male') {  // father's side
            if (p2AncestorGender === 'Male') {  // father's brother's son
              return `${translatedName1} هو إبن عم والد ${translatedName2}`;
            } else { 
              return `${translatedName1} هو إبن عم والدة ${translatedName2}`;
            }
          } else {  // mother's side
            if (p2AncestorGender === 'Male') {  // mother's brother's son
              return `${translatedName1} هو إبن عمة والدة ${translatedName2}.`;
            } else {  // mother's brother's daughter
              return `${translatedName1} هو إبن عمّة والدة ${translatedName2}`;
            }
          }
        } 
        else {  // If person1 is female
          if (p1AncestorGender === 'Male') {  // father's side
            if (p2AncestorGender === 'Male') {  // father's brother's son
              return `${translatedName1} هي إبنة عم والد ${translatedName2}`;
            } else {  // father's brother's daughter
              return `${translatedName1} هي إبنة عم والدة ${translatedName2}`;
            }
          } else {  // mother's side
            if (p2AncestorGender === 'Male') {  // mother's brother's son
              return `${translatedName1} هي إبنة عمة والد ${translatedName2}`;
            } else {  // mother's brother's daughter
              return `${translatedName1} هي إبنة عمة والدة ${translatedName2}`;
            }
          }
        }
      }
      
      else if (p1Level === 3 && p2Level === 2) {          
        const p1AncestorGender = pathToP1[1].gender;
        const p2AncestorGender = pathToP2[1].gender;
        console.log(p1AncestorGender, p2AncestorGender);
        if (p1AncestorGender === 'Male') {  // father's side
          if (p2AncestorGender === 'Male') {  // father's brother's son
            return `والد ${translatedName1} هو إبن عم ${translatedName2}`;
          } else { 
            return `والد ${translatedName1} هو إبن خال ${translatedName2}`;
          }
        } 
        else {  // mother's side
          if (p2AncestorGender === 'Male') {  // mother's brother's son
            return `والدة ${translatedName1} هي إبنة عم ${translatedName2}`;
          } else {  // mother's brother's daughter
            return `والدة ${translatedName1} هي إبنة خال  ${translatedName2}`;
          }
        }
      }
      else if (p1Level === 3 && p2Level === 3) {          
        
        const p1AncestorGender = pathToP1[1].gender;
        const p2AncestorGender = pathToP2[1].gender;
        const p1GreatAncestorGender = pathToP1[2].gender;
        const p2GreatAncestorGender = pathToP2[2].gender;

        if (p1AncestorGender === 'Male') { 
          if (p2AncestorGender === 'Male'){
            if (p1GreatAncestorGender === 'Male'){
              if (p2GreatAncestorGender === 'Male'){
                return `جدّ ${translatedName1} من الأب و جد ${translatedName2} من الأب إخوة.`;
              }
              else{
                return `جدّ ${translatedName1} من الأب و جدة ${translatedName2} من الأب إخوة.`;
              }
            }
            else {
              if (p2GreatAncestorGender === 'Male'){
                return `جدّة ${translatedName1} من الأب و جد ${translatedName2} من الأب إخوة.`;
              }
              else{
                return `جدّة ${translatedName1} من الأب و جدة ${translatedName2} من الأب إخوة.`;
              }
            }
          }
          else {
            if (p1GreatAncestorGender === 'Male'){
              if (p2GreatAncestorGender === 'Male'){
                return `جدّ ${translatedName1} من الأب و جد ${translatedName2} من الأم إخوة.`;
              }
              else{
                return `جدّ ${translatedName1} من الأب و جدة ${translatedName2} من الأم إخوة.`;
              }
            }
            else {
              if (p2GreatAncestorGender === 'Male'){
                return `جدّة ${translatedName1} من الأب و جد${translatedName2} من الأم إخوة.`;
              }
              else{
                return `جدّة ${translatedName1} من الأب و جدة ${translatedName2} من الأم إخوة.`;
              }
            }
          }
        }
        else {
          if (p2AncestorGender === 'Male'){
            if (p1GreatAncestorGender === 'Male'){
              if (p2GreatAncestorGender === 'Male'){
                return `جدّ ${translatedName1} من الأم و جد${translatedName2} من الأب إخوة.`;
              }
              else{
                return `جدّ ${translatedName1} من الأم و جدة ${translatedName2} من الأب إخوة.`;
              }
            }
            else {
              if (p2GreatAncestorGender === 'Male'){
                return `جدّة ${translatedName1} من الأم و جد ${translatedName2} من الأب إخوة.`;
              }
              else{
                return `جدّة ${translatedName1} من الأم و جدة ${translatedName2} من الأب أخوات.`;
              }
            }
          }
          else {
            if (p1GreatAncestorGender === 'Male'){
              if (p2GreatAncestorGender === 'Male'){
                return `جدّ ${translatedName1} من الأم و جد ${translatedName2} من الأم إخوة.`;
              }
              else{
                return `جدّ ${translatedName1} من الأم و جدة ${translatedName2} من الأم إخوة.`;
              }
            }
            else {
              if (p2GreatAncestorGender === 'Male'){
                return `جدّة ${translatedName1} من الأم و جدة ${translatedName2} من الأب إخوة.`;
              }
              else{
                return `جدّة ${translatedName1} من الأم و جدة ${translatedName2} من الأم إخوة.`;
              }
            }
          }
        }
      }
  
      console.log('No direct relation found.');
      errorContainer.innerText = 'لا يوجد قرابة مباشرة.';
      return '';
    } catch (error) {
      console.error('Error in relationship lookup:', error);
    
      // Correctly use 'error' here instead of 'err'
      setError(`❌ خطأ: ${error.message || error}`);
    
      // Show the error message in the error container
      if (errorContainer) {
        errorContainer.innerText = `❌ خطأ: ${error.message || error}`;
      }
      return '';
    }
  };
  const { ancName, ancLastName } = {ancestorName, ancestorLastName};

  return (
    <div className="relation-page">
    {/* Left Panel: Duplicate Suggestions */}
    {(duplicates.person1.length > 0 || duplicates.person2.length > 0) && (
      <aside className="duplicates-panel">
        {duplicates.person1.length > 0 && (
          <section className="duplicates-group">
            <h3>أكتب الاسم الكامل للشخص الصحيح:</h3>
            <ul>
              {duplicates.person1.map((p, idx) => (
                <li key={`p1-${idx}`}>
                  {`${translateName(p.name)} بن ${translateName(p.father)} بن ${translateName(p.grandfather)} ${translateName(p.lastName)}`}
                </li>
              ))}
            </ul>
          </section>
        )}
  
        {duplicates.person2.length > 0 && (
          <section className="duplicates-group">
            <h3>اختر الشخص الصحيح "{person2}"</h3>
            <ul>
              {duplicates.person2.map((p, idx) => (
                <li key={`p2-${idx}`}>
                  {`${translateName(p.name)} بن ${translateName(p.father)} بن ${translateName(p.grandfather)} ${translateName(p.lastName)}`}
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    )}
    { /* Panel for signaling errors  */}
    
    {/* Main Panel: Form + Result */}
    <main className="main-panel">
      <section className="relation-form-section">
        <h2 className="section-title">ماهي العلاقة بينهما؟</h2>
        <p id="DescriptionZone">
          الهدف من هذه الصفحة هو تحديد صلة القرابة بين شخصين بناءًا على اسمهم. كل ماعليك فعله
          هو ادخال الاسم للشخص الاول والثاني وثم النقر على "التحقق من العلاقة" ستظهر لك النتيجة في اسهل الصفحة
          والتي يتوضح لك نوع العلاقة ومدى قرابتها؟ في حال وجود اي تشابهات او تكرارات في الاسماء سيم توفير خيارات لتحديد الشخص الصحيح
        </p>
        <form onSubmit={FetchRelationship} className="relation-form">
          <div className="input-group">
            <input
              type="text"
              placeholder="الإسم الكامل الأول"
              value={person1}
              onChange={(e) => setPerson1(e.target.value)}
              className="inputNames"
            />
          </div>
          <div className="input-group">
            <input
              type="text"
              placeholder="الإسم الكامل الثاني"
              value={person2}
              onChange={(e) => setPerson2(e.target.value)}
              className="inputNames"
            />
          </div>
          <div className='ButtonSection'>
            <button type="submit" className="checkButton">تحقق من العلاقة</button>
            <button type="reset" className='resetButton'>إلغاء</button>
          </div>
          
        </form>
      </section>

  
      {/* Result */}
      {error && <div className="error-message">{error}</div>} {/* Show the error message */}

      {relationship && !error  && (
        <section className="relationship-result">
          <h2 id="resultTitle">نتيجة العلاقة</h2>
          <p className="relationText">{relationship}</p>
  
          <div class="result-details">
            <table class="result-table">
              <tbody>
                <tr>
                  <th>درجة العلاقة</th>
                  <td class="score-cell">
                    <div class="score-bar-wrapper">
                      <div class="score-bar-fill" style={{width: '80%'}}></div>
                    </div>
                    <div class="score-meta">
                      <span class="score-value">80%</span>
                      <span class="score-category high">قوية</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <th>نوع العلاقة</th>
                  <td class="relationship-tag"><span class="tag blood">دم</span></td>
                </tr>
                <tr>
                  <th>تفسير إضافي</th>
                  <td class="relation-explanation">
                    هؤلاء الشخصين مرتبطين عن طريق الأبناء والأجداد.
                  </td>
                </tr>
                <tr>
                  <th>عدد الأجيال بينهما</th>
                  <td class="generation-distance"><span id="numGen">5</span> أجيال</td>
                </tr>
              </tbody>
            </table>
            
          </div>


        </section>
      )}
    </main>
  </div>
  
  );
};

export default RelationPage;
