import React, { useEffect, useState } from 'react';
import Tree from 'react-d3-tree';
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
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

  const fetchRelationship = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    setLoadingMessage("بداية البحث عن العلاقة...");

    try {
      const result = await getRelationship(person1, person2);

      if (result.error === 'non-unique-name') {
        setDuplicates(result.duplicates);
        setRelationship(result.message);
      } else {
        setDuplicates({ person1: [], person2: [] });
        setRelationship({
          relationshipDescription: result.relation,
          relationshipScore: result.score,
          relationshipLevels: result.levelsTuple,
          relationshipGenerationGap: result.generation,
          relationshipExplanationType: result.explanation.type,
          relationshipExplanationDesc: result.explanation.explanation,
          commonAncestor: result.ancestor,
          ancestorstreeData: result.treeData,
          person1ID: result.person1ID,
          person2ID: result.person2ID
        });
      }
    } catch (error) {
      console.error('Error fetching relationship:', error);
      setRelationship({ relationshipDescription: 'An error occurred', relationshipScore: null });
      setError(true);
    } finally{
      setLoading(false);
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
    const { personName: person2Name, fatherName: person2FatherName, grandfatherName: person2GrandfatherName, familyName: person2LastName } = splitName(translatedName2);
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
      setLoadingMessage("جاري البحث عن الأشخاص");

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
        setLoadingMessage("جاري البحث عن الأجداد المشتركة");
        const result = await session.run(`
          MATCH path1 = (common:Person)-[:FATHER_OF|MOTHER_OF*0..4]->(p1:Person)
          WHERE id(p1) = $person1ID
      
          MATCH path2 = (common)-[:FATHER_OF|MOTHER_OF*0..4]->(p2:Person)
          WHERE id(p2) = $person2ID
            AND id(p1) <> id(p2)
      
          WITH common, path1, path2, length(path1) AS level1, length(path2) AS level2
          OPTIONAL MATCH (cGF:Person)-[:FATHER_OF]->(cF:Person)-[:FATHER_OF]->(common)

          ORDER BY (level1 + level2) ASC
          LIMIT 1
      
          RETURN 
            common.name AS commonAncestorName,
            cF.name AS commonAncestorFatherName,
            cGF.name AS commonAncestorGrandFatherName,
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
            fatherName: record.get('commonAncestorFatherName'),
            grandfatherName: record.get('commonAncestorGrandFatherName'),
            gender: record.get('commonAncestorGender'),
            levelFromP1: record.get('generationsFromP1').toNumber(),
            levelFromP2: record.get('generationsFromP2').toNumber(),
            pathFromAncestorToP1: record.get('pathToP1'),
            pathFromAncestorToP2: record.get('pathToP2')
        };
      };
      
      let relationRecord = await getAncestors(person1ID, person2ID);
      const ancestorID = relationRecord.id;
      const ancestorName = translateName(relationRecord.name);
      const ancestorLastName = translateName(relationRecord.lastName);
      const ancestorFatherName = translateName(relationRecord.fatherName);
      const ancestorGrandFatherName = translateName(relationRecord.grandfatherName);
      const ancestorGender = relationRecord.gender;
      let levelFromP1, levelFromP2, pathFromAncestorToP1, pathFromAncestorToP2;
      const ancestor = {ancestorID, 
                      ancestorName, ancestorFatherName, ancestorGrandFatherName, ancestorLastName, ancestorGender};

      ({
        levelFromP1, 
        levelFromP2, 
        pathFromAncestorToP1, 
        pathFromAncestorToP2 
      } = relationRecord);
      const pathToP1 = pathFromAncestorToP1;
      const pathToP2 = pathFromAncestorToP2;
      function buildTreePath(path) {
        return path.reduceRight((acc, person) => {
          return {
            id: (person.id).toNumber(),
            name: `${person.name} ${person.lastName}`,
            children: acc ? [acc] : []
          };
        }, null);
      }

      function mergePaths(pathToP1, pathToP2) {
        const ancestor = pathToP1[0]; // guaranteed same
        const branch1 = pathToP1.slice(1);
        const branch2 = pathToP2.slice(1);

        return {
          id: (ancestor.id).toNumber(),  // Include the ancestor's ID here
          name: `${ancestor.name} ${ancestor.lastName}`,
          children: [buildTreePath(branch1), buildTreePath(branch2)]
        };
      }
      const treeData = mergePaths(pathToP1, pathToP2);
      console.log(pathFromAncestorToP1.reverse().map(a => a.name).join(" ben "));
      console.log(pathFromAncestorToP2.reverse().map(a => a.name).join(" ben "));
  
      var p1Level = levelFromP1;
      var p2Level = levelFromP2;
      const translatedName1 = translateName(person1FullName);
      const translatedName2 = translateName(person2FullName);
  
      const gender1 = pathToP1[0].gender;
      const gender2 = pathToP2[0].gender;
      let relation = '', score = 0;
      let relationshipExplanation = [
        {
          type: "العائلة",
          explanation: "هؤلاء الشخصين مرتبطين من خلال العائلة ذو الدرجة الأولى."
        },
        {
          type: "العائلة المقربة",
          explanation: "هؤلاء الشخصين مرتبطين من خلال أعمام وأخوال مشتركين."
        },
        {
          type: "العائلة الموسعة",
          explanation: "هؤلاء الشخصين مرتبطين من خلال أعمام أو أخوال الأب وأحفادهم."
        },
        {
          type: "قرابة الزواج",
          explanation: "هذان الشخصان مرتبطان من خلال الزواج."
        },
        {
          type: "صهر / نسيب",
          explanation: "هذان الشخصان مرتبطان عبر الزواج وليس النسب الدموي."
        },
        {
          type: "لا توجد علاقة",
          explanation: "لم يتم العثور على أي صلة قرابة بين الشخصين في قاعدة البيانات."
        },
        {
          type: "نفس الشخص",
          explanation: "الاسمين يشيران إلى نفس الشخص."
        }
      ];
      
      console.log(`Level: (${p1Level}, ${p2Level})`);
      setLoadingMessage("جاري البحث عن العلاقة بين الشخصين");
      if (p1Level === 0 && p2Level === 1) {
        if (gender1 === 'Male'){
          relation = `${translatedName1} هو والد ${translatedName2}`;
        }
        else{
          relation = `${translatedName1} هي والدة ${translatedName2}`;
        }
        score = 100;
      }
  
      else if (p1Level === 1 && p2Level === 0) {
        if (gender1 === 'Male'){
          relation = `${translatedName1} هو ابن ${translatedName2}`;
        }
        else{
          relation = `${translatedName1} هي إبنة ${translatedName2}`;
        }
        score = 100;
      } 
  
      else if (p1Level === 2 && p2Level === 0) {
        if (gender1 === 'Male'){
          relation = `${translatedName1} هو حفيد ${translatedName2}`;
        }
        else{
          relation = `${translatedName1} هي حفيدة ${translatedName2}`;
        }
        score = 90;
      }

      else if (p1Level === 0 && p2Level === 2) {
        if (gender1 === 'Male'){
          relation = `${translatedName1} هو جدّ ${translatedName2}`;
        }
        else{
          relation = `${translatedName1} هي جدّة ${translatedName2}`;
        }
        score = 90;
      }
  
      else if (p1Level === 3 && p2Level === 0) {
        if (gender1 === 'Male'){
          relation = `${translatedName1} هو إبن حفيد ${translatedName2}`;
        }
        else{
          relation = `${translatedName1} هي إبنة حفيدة ${translatedName2}`;
        }
        score = 75;
      }
  
      else if (p1Level === 0 && p2Level === 3) {
        if (gender1 === 'Male'){
          relation = `${translatedName1} و جد والد ${translatedName2}`;
        }
        else{
          relation = `${translatedName1} هي جدة والدة ${translatedName2}`;
        }
        score = 80;
      } 
      
      else if (p1Level === 0 && p2Level === 4){ // ADD FROM MOTHER FROM FATHER GRANDFATHER 
        const p2GreatAncestorGender = pathToP1[2].gender;
        if (gender1 === 'Male'){
          if (p2GreatAncestorGender === 'Male'){
            relation = `${translatedName1} هو جد جد ${translatedName2}`;
          }
          else{
            relation = `${translatedName1} هو جد جدة ${translatedName2}`;
          }
        }
        else{
          if (p2GreatAncestorGender === 'Male'){
            relation = `${translatedName1} هي جدة جد ${translatedName2}`;
          }
          else{
            relation = `${translatedName1} هي جدة جدة ${translatedName2}`;
          }
        }
        score = 75;
      }

      else if (p1Level === 4 && p2Level === 0){ // ADD FROM MOTHER FROM FATHER GRANDFATHER 
        const p1GreatAncestorGender = pathToP1[2].gender;
        if (gender1 === 'Male'){
          if (p1GreatAncestorGender === 'Male'){
            relation = `${translatedName1} هو حفيد حفيد ${translatedName2}`;
          }
          else{
            relation = `${translatedName1} هو حفيد حفيدة ${translatedName2}`;
          }
        }
        else{
          if (p1GreatAncestorGender === 'Male'){
            relation = `${translatedName1} هي حفيدة حفيد ${translatedName2}`;
          }
          else{
            relation = `${translatedName1} هي حفيدة حفيد ${translatedName2}`;
          }
        }
        score = 75;
      }

      else if (p1Level === 1 && p2Level === 1) {
        if (gender1 === 'Male' && gender2 === 'Male'){
          relation = `${translatedName1} و ${translatedName2} إخوة`;
        }
        else if (gender1 === 'Female' && gender2 === 'Female'){
          relation = `${translatedName1} و ${translatedName2} أخوات`;
        }
        else{
          relation = `${translatedName1} و ${translatedName2} إخوة`;
        }
        score = 98;
      } 
      
      else if (p1Level === 2 && p2Level === 1) {
        const p1AncestorGender = pathToP1[1].gender;
        if (gender1 === 'Male'){
          if (p1AncestorGender === 'Male'){
            relation = `${translatedName1} هو ابن أخ ${translatedName2}`;
          }
          else{
            relation = `${translatedName1} هو ابن أخت ${translatedName2}`;
          }
          score = 93;
        }
        else{
          if (p1AncestorGender === 'Male'){
            relation = `${translatedName1} هي ابن أخ ${translatedName2}`;
          }
          else{
            relation = `${translatedName1} هي ابنة أخت ${translatedName2}`;
          }
          score = 93;
        }
      } 
      
      else if (p1Level === 1 && p2Level === 2) {
        const p2AncestorGender = pathToP2[1].gender;
        if (gender1 === 'Male'){
          if (p2AncestorGender === 'Male'){
            relation = `${translatedName1} هو عم ${translatedName2}`;
            score = 95;
          }
          else{
            relation = `${translatedName1} هو خال ${translatedName2}`;
            score = 94;
          }
        }
        else{
          if (p2AncestorGender === 'Male'){
            relation = `${translatedName1} هي عمة ${translatedName2}`;
            score = 95;
          }
          else{
            relation = `${translatedName1} هي خالة ${translatedName2}`;
            score = 94;
          }
        }
      }
      
      else if (p1Level === 1 && p2Level === 3){
        const p2AncestorGender = pathToP2[1].gender;
        const p2GreatAncestorGender = pathToP2[2].gender;
        if (gender1 === 'Male'){
          if (p2AncestorGender === 'Male'){
            if (p2GreatAncestorGender === 'Male'){
              relation = `${translatedName1} هو عم والد ${translatedName2}`;
              score = 80;
            }
            else {
              relation = `${translatedName1} هو خال والد ${translatedName2}`;
              score = 75;
            }
          }
          else{
            if (p2GreatAncestorGender === 'Male'){
              relation = `${translatedName1} هو عم والدة ${translatedName2}`;
              score = 80;
            }
            else {
              relation = `${translatedName1} هو خال والدة ${translatedName2}`;
              score = 70;
            }
          }
        } else{
          if (p2AncestorGender === 'Male'){
            if (p2GreatAncestorGender === 'Male'){
              relation = `${translatedName1} هي عمة والد ${translatedName2}`;
              score = 80;
            }
            else {
              relation = `${translatedName1} هي خالة والد ${translatedName2}`;
              score = 75
            }
          }
          else{
            if (p2GreatAncestorGender === 'Male'){
              relation = `${translatedName1} هي عمة والدة ${translatedName2}`;
              score = 80;
            }
            else {
              relation = `${translatedName1} هي خالة والدة ${translatedName2}`;
              score = 75;
            }
          }
        }
      }

      else if (p1Level === 3 && p2Level === 1){
        const p1GreatAncestorGender = pathToP1[2].gender;
        if (gender1 === 'Male'){
            if (p1GreatAncestorGender === 'Male'){
              relation = `${translatedName1} هو حفيد اخ ${translatedName2}`;
              score = 78;
            }
            else {
              relation = `${translatedName1} هو حفيد اخت ${translatedName2}`;
              score = 78;
            }
        } 
        else{
            if (p1GreatAncestorGender === 'Male'){
              relation = `${translatedName1} هي حفيدة اخ ${translatedName2}`;
              score = 78;
            }
            else {
              relation = `${translatedName1} هي حفيدة اخت ${translatedName2}`;
              score = 78;
            }
        }
      }

      else if (p1Level === 2 && p2Level === 2) {    
        const p1AncestorGender = pathToP1[1].gender;
        const p2AncestorGender = pathToP2[1].gender;
  
        if (gender1 === 'Male') { 
          if (p2AncestorGender === 'Male') { 
            if (p1AncestorGender === 'Male'){  // ولد عمه
              relation = `${translatedName1} إبن عم ${translatedName2}`;
              score = 90;
            }
            else{
              relation = `${translatedName1} هو إبن عمّة ${translatedName2}`;
              score = 89;

            }
          } 
          else {  
            if (p1AncestorGender === 'Male'){  // ولد خاله
              relation = `${translatedName1} هو إبن خال ${translatedName2}`;
              score = 88;
            }
            else{
              relation = `${translatedName1} هو إبن خالة ${translatedName2}`;
              score = 86;
            }
          }
        }
        else {
          if (p1AncestorGender === 'Male') { 
            if (p2AncestorGender === 'Male'){  // بنت عمه
              relation = `${translatedName1} هي إبنة عمّ ${translatedName2}`;
              score = 90;
            }
            else{
              relation = `${translatedName1} هي إبنة عمّة ${translatedName2}`;
              score = 89;
            }
          } 
          else {  
            if (p2AncestorGender === 'Male'){  // بنت خاله
              relation = `${translatedName1} هي إبنة خال ${translatedName2}`;
              score = 88;
            }
            else{
              relation = `${translatedName1} هي إبنة خالة ${translatedName2}`;
              score = 86;
            }
          }
        }
      }
  
      else if (p1Level === 2 && p2Level === 3) {         
  
        const p1AncestorGender = pathToP1[1].gender;
        const p2AncestorGender = pathToP2[1].gender;

        if (gender1 === 'Male') { 
          if (p1AncestorGender === 'Male') {
            if (p2AncestorGender === 'Male') {
              relation = `${translatedName1} هو إبن عم والد ${translatedName2}`;
              score = 80;
            } else { 
              relation = `${translatedName1} هو إبن عمة والد ${translatedName2}`;
              score = 78;
            }
          } else {  // mother's side
            if (p2AncestorGender === 'Male') {  // mother's brother's son
              relation = `${translatedName1} هو إبن عم والدة ${translatedName2}.`;
              score = 74;
            } else {  // mother's brother's daughter
              relation = `${translatedName1} هو إبن عمّة والدة ${translatedName2}`;
              score = 72;
            }
          }
        } 
        else {  // If person1 is female
          if (p1AncestorGender === 'Male') {  // father's side
            if (p2AncestorGender === 'Male') {  // father's brother's son
              relation = `${translatedName1} هي إبنة عم والد ${translatedName2}`;
              score = 80;
            } else {  // father's brother's daughter
              relation = `${translatedName1} هي إبنة عم والدة ${translatedName2}`;
              score = 78;
            }
          } else {  // mother's side
            if (p2AncestorGender === 'Male') {  // mother's brother's son
              relation = `${translatedName1} هي إبنة عم والدة ${translatedName2}`;
              score = 74;
            } else {  // mother's brother's daughter
              relation = `${translatedName1} هي إبنة عمة والدة ${translatedName2}`;
              score = 72;
            }
          }
        }
      }
      
      else if (p1Level === 3 && p2Level === 2) {          
        const p1AncestorGender = pathToP1[1].gender;
        const p2AncestorGender = pathToP2[1].gender;

        if (p1AncestorGender === 'Male') {  // father's side
          if (p2AncestorGender === 'Male') {  // father's brother's son
            relation = `والد ${translatedName1} هو إبن عم ${translatedName2}`;
            score = 80;
          } else { 
            relation = `والد ${translatedName1} هو إبن خال ${translatedName2}`;
            score = 75;
          }
        } 
        else {  // mother's side
          if (p2AncestorGender === 'Male') {  // mother's brother's son
            relation = `والدة ${translatedName1} هي إبنة عم ${translatedName2}`;
            score = 80;
          } else {  // mother's brother's daughter
            relation = `والدة ${translatedName1} هي إبنة خال  ${translatedName2}`;
            score = 75;
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
                relation = `جدّ ${translatedName1} من الأب و جد ${translatedName2} من الأب إخوة.`;
              }
              else{
                relation = `جدّ ${translatedName1} من الأب و جدة ${translatedName2} من الأب إخوة.`;
              }
            }
            else {
              if (p2GreatAncestorGender === 'Male'){
                relation = `جدّة ${translatedName1} من الأب و جد ${translatedName2} من الأب إخوة.`;
              }
              else{
                relation = `جدّة ${translatedName1} من الأب و جدة ${translatedName2} من الأب إخوة.`;
              }
            }
          }
          else {
            if (p1GreatAncestorGender === 'Male'){
              if (p2GreatAncestorGender === 'Male'){
                relation = `جدّ ${translatedName1} من الأب و جد ${translatedName2} من الأم إخوة.`;
              }
              else{
                relation = `جدّ ${translatedName1} من الأب و جدة ${translatedName2} من الأم إخوة.`;
              }
            }
            else {
              if (p2GreatAncestorGender === 'Male'){
                relation = `جدّة ${translatedName1} من الأب و جد${translatedName2} من الأم إخوة.`;
              }
              else{
                relation = `جدّة ${translatedName1} من الأب و جدة ${translatedName2} من الأم إخوة.`;
              }
            }
          }
        }
        else {
          if (p2AncestorGender === 'Male'){
            if (p1GreatAncestorGender === 'Male'){
              if (p2GreatAncestorGender === 'Male'){
                relation = `جدّ ${translatedName1} من الأم و جد${translatedName2} من الأب إخوة.`;
              }
              else{
                relation = `جدّ ${translatedName1} من الأم و جدة ${translatedName2} من الأب إخوة.`;
              }
            }
            else {
              if (p2GreatAncestorGender === 'Male'){
                relation = `جدّة ${translatedName1} من الأم و جد ${translatedName2} من الأب إخوة.`;
              }
              else{
                relation = `جدّة ${translatedName1} من الأم و جدة ${translatedName2} من الأب أخوات.`;
              }
            }
          }
          else {
            if (p1GreatAncestorGender === 'Male'){
              if (p2GreatAncestorGender === 'Male'){
                relation = `جدّ ${translatedName1} من الأم و جد ${translatedName2} من الأم إخوة.`;
              }
              else{
                relation = `جدّ ${translatedName1} من الأم و جدة ${translatedName2} من الأم إخوة.`;
              }
            }
            else {
              if (p2GreatAncestorGender === 'Male'){
                relation = `جدّة ${translatedName1} من الأم و جدة ${translatedName2} من الأب إخوة.`;
              }
              else{
                relation = `جدّة ${translatedName1} من الأم و جدة ${translatedName2} من الأم إخوة.`;
              }
            }
          }
        }
      }
      
      else {
        setLoading(false);
        console.log('No direct relation found.');
        errorContainer.innerText = 'لا يوجد قرابة مباشرة.';
        return '';
      }

      if (relation != ''){
        setLoading(false);
        return {relation, score, 
                generation:Math.abs(p1Level-p2Level), 
                levelsTuple: {levelFromP1, levelFromP2},
                explanation: relationshipExplanation[0],
                ancestor,
                treeData,
                person1ID,
                person2ID};
      }
      
    } catch (error) {
      console.error('Error in relationship lookup:', error);
    
      setError(`❌ خطأ: ${error.message || error}`);
    
      if (errorContainer) {
        errorContainer.innerText = `❌ خطأ: ${error.message || error}`;
      }
      setLoading(false);
      return '';
    }
  };

  return (
    <div className="relation-page">
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
    {/* Main Panel: Form + Result */}
    <main className="main-panel">
      <section className="relation-form-section">
        <h2 className="section-title">ماهي العلاقة بينهما؟</h2>
        <p id="DescriptionZone">
          الهدف من هذه الصفحة هو تحديد صلة القرابة بين شخصين بناءًا على اسمهم. كل ماعليك فعله
          هو ادخال الاسم للشخص الاول والثاني وثم النقر على "التحقق من العلاقة" ستظهر لك النتيجة في اسهل الصفحة
          والتي يتوضح لك نوع العلاقة ومدى قرابتها؟ في حال وجود اي تشابهات او تكرارات في الاسماء سيم توفير خيارات لتحديد الشخص الصحيح
        </p>
        <form onSubmit={fetchRelationship} className="relation-form">
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

      {error && <div className="error-message">{error}</div>} {/* Show the error message */}
      {loading && (
        <div className="loading-message">
          <div className="spinner"></div>
          <p>{loadingMessage}</p>
        </div>
      )}

      {!loading && relationship && !error  && (
        <section className="relationship-result">
          <h2 id="resultTitle">نتيجة العلاقة</h2>
          <p className="relationText">{relationship.relationshipDescription}</p>
          <div className="result-details">
            <table className="result-table">
              <tbody>
                <tr>
                  <th>درجة العلاقة</th>
                  <td className="score-cell">
                    <div className="score-bar-wrapper">
                      <div className="score-bar-fill" style={{ width: `${relationship.relationshipScore || 0}%` }}></div>
                    </div>
                    <div className="score-meta">
                      <span className="score-value">{relationship.relationshipScore}</span>
                      {relationship.relationshipScore !== null && (
                        <span className={
                          relationship.relationshipScore >= 80
                            ? "score-category high"
                            : relationship.relationshipScore >= 60
                            ? "score-category medium"
                            : "score-category low"
                        }>
                          {
                            relationship.relationshipScore >= 80
                              ? "قوية"
                              : relationship.relationshipScore >= 60
                              ? "متوسطة"
                              : "ضعيفة"
                          }
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
                <tr>
                  <th>نوع العلاقة</th>
                  <td className="relationship-tag"><span className="tag blood">دم</span></td>
                </tr>
                <tr>
                  <th>تفسير إضافي</th>
                  <td className="relation-explanation">
                    <span className='relation-explanation-type'>
                      {relationship.relationshipExplanationType}
                    </span> : 
                    {relationship.relationshipExplanationDesc || "لا يوجد تفسير متاح."}
                  </td>
                </tr>
                <tr>
                  <th>عدد الأجيال بينهما حسب الجد المشترك</th>
                  <td className="generation-distance">
                    <div className="tooltip-container">
                      <span id="numGen">{relationship.relationshipGenerationGap}</span> أجيال
                      <div className="custom-tooltip">
                        عدد الأجيال هو عدد الأشخاص الفاصلين في شجرة العائلة بين الشخصين.
                      </div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <th>
                    <div className="tooltip-container">
                      الجد المشترك
                      <span className="custom-tooltip">
                        عدد الأجيال هو عدد الأشخاص الفاصلين في شجرة العائلة بين الشخصين.
                      </span>
                    </div>
                  </th>
                  <td className="generation-distance">
                    {relationship.commonAncestor.ancestorName} بن {relationship.commonAncestor.ancestorFatherName} بن {relationship.commonAncestor.ancestorGrandFatherName} {relationship.commonAncestor.ancestorLastName}
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="tree-wrapper" style={{ height: `${((Math.max((relationship.relationshipLevels.levelFromP1),(relationship.relationshipLevels.levelFromP2)))+1)*100}px` }}>
                <div className='titleTree'>
                </div>
                {relationship.ancestorstreeData && (
                <div className="tree-container">
                  <Tree
                    data={relationship.ancestorstreeData}
                    orientation="vertical"
                    pathFunc="step"
                    nodeSize={{ x: 50, y: 90 }}
                    separation={{ siblings: 3, nonSiblings: 3 }}
                    translate={{ x: 325, y: 27 }} 
                    renderCustomNodeElement={({ nodeDatum }) => (
                     <g className="tree-node">
                        <title>{nodeDatum.id}</title>
                        <rect
                          className="tree-node-rect"
                          x="-50"
                          y="-20"
                          width="100"
                          
                          height="40"
                          style={{
                            fill: nodeDatum.id === relationship.person1ID || nodeDatum.id === relationship.person2ID
                              ? '#d3f9d8'  // Leaf node color (light green)
                              : nodeDatum.id === relationship.commonAncestor.ancestorID
                              ? '#ffe4b5'  // Ancestor node color (light yellow)
                              : '#ffffff', // Default color for other nodes
                            stroke: nodeDatum.id === relationship.person1ID || nodeDatum.id === relationship.person2ID
                              ? '#4caf50'  // Leaf node border (green)
                              : nodeDatum.id === relationship.commonAncestor.ancestorID
                              ? '#ffa500'  // Ancestor node border (orange)
                              : '#4a90e2', // Default border color
                            strokeWidth: '2.5px',
                            rx: '10',  // Rounded corners
                            ry: '10',  // Rounded corners
                          }}
                        />
                        <text
                          className="tree-node-text"
                          x="0"
                          y="5"
                          style={{
                            fontSize: '16px',
                            fontFamily: 'Cairo',
                            fill: nodeDatum.id === relationship.person1ID || nodeDatum.id === relationship.person2ID
                              ? '#388e3c'  // Leaf node text color (dark green)
                              : nodeDatum.id === relationship.commonAncestor.ancestorID
                              ? '#ff9800'  // Ancestor node text color (orange)
                              : '#333',    // Default text color (dark gray)
                            textAnchor: 'middle',
                            dominantBaseline: 'middle',
                            letterSpacing: '1px',
                            strokeWidth: '1px',
                            pointerEvents: 'none',
                          }}
                        >
                          {translateName(nodeDatum.name)}
                        </text>
                      </g>
                    )}
                  />
                </div>
              )}
               </div>
          </div>
        </section>
      )}
    </main>
  </div>
  
  );
};

export default RelationPage;
