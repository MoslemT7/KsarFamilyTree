import React, { useState } from 'react';
import './RelationChecker.css';
const neo4j = require('neo4j-driver');
const translations = require('./translation.json');
require('dotenv').config();


const driver = neo4j.driver(
  'neo4j+s://2cd0ce39.databases.neo4j.io',
  neo4j.auth.basic('neo4j', 'nW1azrzTK-lrTOO5G1uOkUVFwelcQlEmKPHggPUB7xQ'));
const session = driver.session();


const getPersonMatches = async (name, fatherName = "", grandfatherName = "", lastName) => {
  let query = "";

  if (grandfatherName) {
    query = `
      MATCH (grandfather:Person {name: $grandfatherName})-[:FATHER_OF]->(father:Person {name: $fatherName})-[:FATHER_OF]->(p:Person {name: $name, lastName: $lastName})
      RETURN id(p) AS personID, p.name AS personName, p.lastName AS familyName, father.name AS fatherName, grandfather.name AS grandfatherName
    `;
  } 
  else if (fatherName) {
    query = `
      MATCH (father:Person {name: $fatherName})-[:FATHER_OF]->(p:Person {name: $name, lastName: $lastName})
      OPTIONAL MATCH (grandfather:Person)-[:FATHER_OF]->(father)
      RETURN id(p) AS personID, p.name AS personName, p.lastName AS familyName, father.name AS fatherName, grandfather.name AS grandfatherName
    `;
  } 
  else {
    query = `
      MATCH (p:Person {name: $name, lastName: $lastName})
      OPTIONAL MATCH (father:Person)-[:FATHER_OF]->(p)
      OPTIONAL MATCH (grandfather:Person)-[:FATHER_OF]->(father)
      RETURN id(p) AS personID, p.name AS personName, p.lastName AS familyName, father.name AS fatherName, grandfather.name AS grandfatherName
    `;
  }

  const params = { name, lastName, fatherName, grandfatherName };
  const result = await session.run(query, params);

  return result.records.map(record => ({
    id: record.get('personID').toNumber(),
    name: record.get('personName'),
    father: record.get('fatherName') || "Unknown",
    grandfather: record.get('grandfatherName') || "Unknown",
    lastName: record.get('familyName')
  }));
};


// Function that split english translated name that may contain ben to full name only parts.
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

const getRelationship = async (person1FullName, person2FullName) => {
  const isArabic = (text) => /[\u0600-\u06FF]/.test(text);
  // const isEnglish = (text) => /^[A-Za-z\s]+$/.test(text);
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
  const person1Matches = await getPersonMatches(person1Name, person1FatherName, person1GrandfatherName, person1LastName);
  const person2Matches = await getPersonMatches(person2Name, person2FatherName, person2GrandfatherName, person2LastName);

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

  const gender1 = await getGender(person1ID);
  const gender2 = await getGender(person2ID);
  try {

    // Function that return the ancestors of a given person starting with the person itself and going up to the root.
    const getAncestors = async (personID) => {
      const result = await session.run(`
        MATCH path = (ancestor:Person)-[:FATHER_OF|MOTHER_OF*]->(child:Person)
        WHERE id(child) = $personID
        WITH ancestor, id(ancestor) AS ID, length(path) AS level
        RETURN DISTINCT ID, ancestor.name AS name, ancestor.lastName AS lastName, level
        ORDER BY level ASC
      `, { personID });
    
      const personResult = await session.run(`
        MATCH (p:Person)
        WHERE id(p) = $personID
        RETURN id(p) AS ID, p.name AS name, p.lastName AS lastName
      `, { personID });
    
      const person = personResult.records[0];
    
      return [
        {
          id: person.get('ID').toNumber(),
          name: person.get('name'),
          lastName: person.get('lastName'),
          level: 0
        },
        ...result.records.map(record => ({
          id: record.get('ID').toNumber(),
          name: record.get('name'),
          lastName: record.get('lastName'),
          level: record.get('level').toNumber()
        }))
      ];
    };

    // Get the ancestors for both persons
    // const maxLevels = 4; 
    let person1Ancestors = await getAncestors(person1ID);
    let person2Ancestors = await getAncestors(person2ID);
    
    console.log(`Person 1 Ancestors: ${person1Ancestors.map(a => a.name).join(' ben ')}`);
    console.log(`Person 2 Ancestors: ${person2Ancestors.map(a => a.name).join(' ben ')}`);

    const person1AncestorsIds = person1Ancestors.map(a => a.id);
    const person2AncestorsIds = person2Ancestors.map(a => a.id);
    const translatedName1 = translateName(person1FullName);
    const translatedName2 = translateName(person2FullName);


    // Check for common ancestors between the two persons
    for (let i = 0; i < person1Ancestors.length; i++) {
      for (let j = 0; j < person2Ancestors.length; j++) {
        if (person1Ancestors[i].id === person2Ancestors[j].id) {
          var p1Level = person1Ancestors[i].level;
          var p2Level = person2Ancestors[j].level;
          
          console.log(`Level: (${p1Level}, ${p2Level})`);

          if (p1Level === 0 && p2Level === 1) {
            if (gender1 === 'Male'){
              console.log(`${translatedName1} هو والد ${translatedName2}`);
              return `${translatedName1} هو والد ${translatedName2}`;
            }
            else{
              console.log(`${translatedName1} هي والدة ${translatedName2}`);
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
              console.log(`${person1FullName} هو حفيد ${person2FullName}`);
              return `${translatedName1} هو حفيد ${translatedName2}`;
            }
            else{
              console.log(`${person1FullName} هي حفيدة ${person2FullName}.`);
              return `${translatedName1} هي حفيدة ${translatedName2}`;
            }
          }

          else if (p1Level === 0 && p2Level === 2) {
            if (gender1 === 'Male'){
              console.log(`${person1FullName} هو جدّ ${person2FullName}'.`);
              return `${translatedName1} هو جدّ ${translatedName2}`;
            }
            else{
              console.log(`${person1FullName} هي جدّة ${person2FullName}.`);
              return `${translatedName1} هي جدّة ${translatedName2}`;
            }
          }

          else if (p1Level === 3 && p2Level === 0) {
            if (gender1 === 'Male'){
              console.log(`${person1FullName} هو إبن حفيد ${person2FullName}.`);
              return `${translatedName1} هو إبن حفيد ${translatedName2}`;
            }
            else{
              console.log(`${person1FullName} هي إبنة حفيدة ${person2FullName}.`);
              return `${translatedName1} هي إبنة حفيدة ${translatedName2}`;
            }
          }

          else if (p1Level === 0 && p2Level === 3) {
            if (gender1 === 'Male'){
              console.log(`${person1FullName} هو جد والد ${person2FullName}`);
              return `${translatedName1} و جد والد ${translatedName2}`;
            }
            else{
              console.log(`${person1FullName}هي جدة والدة ${person2FullName}`);
              return `${translatedName1} هي جدة والدة ${translatedName2}`;
            }
          } 
          
          else if (p1Level === 1 && p2Level === 1) {
            if (gender1 === 'Male' && gender2 === 'Male'){
              console.log(`${person1FullName} و ${person2FullName} إخوة.`);
              return `${translatedName1} و ${translatedName2} إخوة`;
            }
            else if (gender1 === 'Female' && gender2 === 'Female'){
              console.log(`${person1FullName} و ${person2FullName} أخوات.`);
              return `${translatedName1} و ${translatedName2} أخوات`;
            }
            else{
              console.log(`${person1FullName} و ${person2FullName} إخوة.`);
              return `${translatedName1} و ${translatedName2} إخوة`;
            }
          } 
          
          else if (p1Level === 2 && p2Level === 1) {
            if (gender1 === 'Male'){
              console.log(`${translatedName1} هو ابن أخ ${translatedName2}`);
              return `${translatedName1} هو ابن أخ ${translatedName2}`;
            }
            else{
              console.log(`${person1FullName} هي إبنة أخ ${person2FullName}.`);
              return `${translatedName1} هي إبن أخ ${translatedName2}`;
            }
          } 
          
          else if (p1Level === 1 && p2Level === 2) {
            if (gender1 === 'Male'){
              console.log(`${person1FullName} هو عم ${person2FullName}.`);
              return `${translatedName1} هو عم ${translatedName2}'`;
            }
            else{
              console.log(`${person1FullName} هي عمّة ${person2FullName}.`);
              return `${translatedName1} هي عمّة ${translatedName2}`;
            }
          }

          else if (p1Level === 2 && p2Level === 2) {
            console.log(`${person1FullName} و ${person2FullName} أولاد العم.`);
          
            const p1AncestorFullName = getAncestorFullName(person1Ancestors, 1);
            const p1AncestorGender = await getGender(p1AncestorFullName);

            const p2AncestorFullName = getAncestorFullName(person2Ancestors, 1);
            const p2AncestorGender = await getGender(p2AncestorFullName);
            console.log(p1AncestorFullName);

            if (gender1 === 'Male') { 
              if (p1AncestorGender === 'Male') { 
                if (p2AncestorGender === 'Male'){  // ولد عمه
                  console.log(`${person1FullName} هو إبن عم ${person2FullName}.`);
                  return `${translatedName1} إبن عم ${translatedName2}`;
                }
                else{ // ولد عمته
                  console.log(`${person1FullName} هو إبن عمّة ${person2FullName}.`);
                  return `${translatedName1} هو إبن عمّة ${translatedName2}`;
                }
              } 
              else {  
                if (p2AncestorGender === 'Male'){  // ولد خاله
                  console.log(`${person1FullName} هو إبن خال ${person2FullName}.`);
                  return `${translatedName1} هو إبن خال ${translatedName2}'`;
                }
                else{ // ولد خالته
                  console.log(`${person1FullName} هو إبن خالة ${person2FullName}.`);
                  return `${translatedName1} هو إبن خالة ${translatedName2}`;
                }
              }
            }
            else {
              if (p1AncestorGender === 'Male') { 
                if (p2AncestorGender === 'Male'){  // بنت عمه
                  console.log(`${person1FullName} هي إبنة عمّ ${person2FullName}.`);
                  return `${translatedName1} هي إبنة عمّ ${translatedName2}`;
                }
                else{ // بنت عمته
                  console.log(`${person1FullName} هي إبنة عمّة ${person2FullName}.`);
                  return `${translatedName1} هي إبنة عمّة ${translatedName2}`;
                }
              } 
              else {  
                if (p2AncestorGender === 'Male'){  // بنت خاله
                  console.log(`${person1FullName} هي إبنة خال ${person2FullName}.`);
                  return `${translatedName1} هي إبنة خال ${translatedName2}`;
                }
                else{ // بنت خالته
                  console.log(`${person1FullName} هي إبنة خالة ${person2FullName}.`);
                  return `${translatedName1} هي إبنة خالة ${translatedName2}`;
                }
              }
            }
          }

          else if (p1Level === 2 && p2Level === 3) {          
            const p1AncestorFullName = getAncestorFullName(person1Ancestors, 1);
            const p1AncestorGender = await getGender(p1AncestorFullName);

            const p2AncestorFullName = getAncestorFullName(person2Ancestors, 1);
            const p2AncestorGender = await getGender(p2AncestorFullName);

            if (gender1 === 'Male') { 
              
              if (p1AncestorGender === 'Male') {  // father's side
                if (p2AncestorGender === 'Male') {  // father's brother's son
                  console.log(`${person1FullName} هو إبن عم والد ${person2FullName}.`);
                  return `${translatedName1} هو إبن عم والد ${translatedName2}`;
                } else { 
                  console.log(`${person1FullName} هو إبن عمة والد ${person2FullName}.`);
                  return `${translatedName1} هو إبن همة والد ${translatedName2}`;
                }
              } else {  // mother's side
                if (p2AncestorGender === 'Male') {  // mother's brother's son
                  console.log(`${person1FullName} هو إبن عم أم ${person2FullName}.`);
                  return `${translatedName1} هو إبن عم أم ${translatedName2}.`;
                } else {  // mother's brother's daughter
                  console.log(`${person1FullName} هو إبن عمّة أم ${person2FullName}.`);
                  return `${translatedName1} هو إبن عمّة أم ${translatedName2}`;
                }
              }
            } else {  // If person1 is female
            
              if (p1AncestorGender === 'Male') {  // father's side
                if (p2AncestorGender === 'Male') {  // father's brother's son
                  console.log(`${person1FullName} هي إبنة عم والد ${person2FullName}.`);
                  return `${translatedName1} هي إبنة عم والد ${translatedName2}`;
                } else {  // father's brother's daughter
                  console.log(`${person1FullName} هي إبنة عمة والد ${person2FullName}.`);
                  return `${translatedName1} هي إبنة عمة والد ${translatedName2}`;
                }
              } else {  // mother's side
                if (p2AncestorGender === 'Male') {  // mother's brother's son
                  console.log(`${person1FullName} هي إبنة عم والدة ${person2FullName}.`);
                  return `${translatedName1} هي إبنة عم والدة ${translatedName2}`;
                } else {  // mother's brother's daughter
                  console.log(`${person1FullName} هي إبنة عمة والدة ${person2FullName}.`);
                  return `${translatedName1} هي إبنة عمة والدة ${translatedName2}`;
                }
              }
            }
            
          }
          
          else if (p1Level === 3 && p2Level === 2) {          
            const p1AncestorFullName = getAncestorFullName(person1Ancestors, 1);
            const p1AncestorGender = await getGender(person1AncestorsIds[1]);

            const p2AncestorFullName = getAncestorFullName(person2Ancestors, 1);
            const p2AncestorGender = await getGender(person2AncestorsIds[1]);

            if (p1AncestorGender === 'Male') {  // father's side
              if (p2AncestorGender === 'Male') {  // father's brother's son
                console.log(`والد ${person1FullName} هو إبن عم ${person2FullName}`);
                return `والد ${translatedName1} هو إبن عم ${translatedName2}`;
              } else { 
                console.log(`والد ${person1FullName} هو إبن خال ${person2FullName}.`);
                return `والد ${translatedName1} هو إبن خال ${translatedName2}`;
              }
            } 
            else {  // mother's side
              if (p2AncestorGender === 'Male') {  // mother's brother's son
                console.log(`والدة ${person1FullName} هي إبنة عم ${person2FullName}.`);
                return `والدة ${translatedName1} هي إبنة عم ${translatedName2}`;
              } else {  // mother's brother's daughter
                console.log(`والدة ${person1FullName} هي إبنة خال ${person2FullName}.`);
                return `والدة ${translatedName1} هي إبنة خال  ${translatedName2}`;
              }
            }
            
            
          }
          else if (p1Level === 3 && p2Level === 3) {          
            
            const p1AncestorGender = await getGender(person1AncestorsIds[1]);

            const p1GreatAncestorGender = await getGender(person1AncestorsIds[2]);

            const p2AncestorGender = await getGender(person2AncestorsIds[1]);

            const p2GreatAncestorGender = await getGender(person2AncestorsIds[2]);
            // Ancestor changes paternal/maternal
            // Great Ancestor changes grandfather/grandmother
            if (p1AncestorGender === 'Male') { 
              if (p2AncestorGender === 'Male'){
                if (p1GreatAncestorGender === 'Male'){
                  if (p2GreatAncestorGender === 'Male'){
                    console.log(`جدّ ${person1FullName} من الأب و جد ${person2FullName} من الأب إخوة.`);
                    return `جدّ ${translatedName1} من الأب و جد ${translatedName2} من الأب إخوة.`;
                  }
                  else{
                    console.log(`${person1FullName}'s paternal grandfather and ${person2FullName}'s paternal grandmother are siblings.`);
                    return `جدّ ${translatedName1} من الأب و جدة ${translatedName2} من الأب إخوة.`;
                  }
                }
                else {
                  if (p2GreatAncestorGender === 'Male'){
                    console.log(`${person1FullName}'s paternal grandmother and ${person2FullName}'s paternal grandfather are siblings.`);
                    return `جدّة ${translatedName1} من الأب و جد ${translatedName2} من الأب إخوة.`;
                  }
                  else{
                    console.log(`${person1FullName}'s paternal grandmother and ${person2FullName}'s paternal grandmother are sisters.`);
                    return `جدّة ${translatedName1} من الأب و جدة ${translatedName2} من الأب إخوة.`;
                  }
                }
              }
              else {
                if (p1GreatAncestorGender === 'Male'){
                  if (p2GreatAncestorGender === 'Male'){
                    console.log(`${person1FullName}'s paternal grandfather and ${person2FullName}'s maternal grandfather are brothers.`);
                    return `جدّ ${translatedName1} من الأب و جد ${translatedName2} من الأم إخوة.`;
                  }
                  else{
                    console.log(`${person1FullName}'s paternal grandfather and ${person2FullName}'s maternal grandmother are siblings.`);
                    return `جدّ ${translatedName1} من الأب و جدة ${translatedName2} من الأم إخوة.`;
                  }
                }
                else {
                  if (p2GreatAncestorGender === 'Male'){
                    console.log(`${person1FullName}'s paternal grandmother and ${person2FullName}'s maternal grandfather are siblings.`);
                    return `جدّة ${translatedName1} من الأب و جد${translatedName2} من الأم إخوة.`;
                  }
                  else{
                    console.log(`${person1FullName}'s paternal grandmother and ${person2FullName}'s maternal grandmother are sisters.`);
                    return `جدّة ${translatedName1} من الأب و جدة ${translatedName2} من الأم إخوة.`;
                  }
                }
              }
            }
            else {
              if (p2AncestorGender === 'Male'){
                if (p1GreatAncestorGender === 'Male'){
                  if (p2GreatAncestorGender === 'Male'){
                    console.log(`${person1FullName}'s maternal grandfather and ${person2FullName}'s paternal grandfather are brothers.`);
                    return `جدّ ${translatedName1} من الأم و جد${translatedName2} من الأب إخوة.`;
                  }
                  else{
                    console.log(`${person1FullName}'s maternal grandfather and ${person2FullName}'s paternal grandmother are siblings.`);
                    return `جدّ ${translatedName1} من الأم و جدة ${translatedName2} من الأب إخوة.`;
                  }
                }
                else {
                  if (p2GreatAncestorGender === 'Male'){
                    console.log(`${person1FullName}'s maternal grandmother and ${person2FullName}'s paternal grandfather are siblings.`);
                    return `جدّة ${translatedName1} من الأم و جد ${translatedName2} من الأب إخوة.`;
                  }
                  else{
                    console.log(`${person1FullName}'s maternal grandmother and ${person2FullName}'s paternal grandmother are sisters.`);
                    return `جدّة ${translatedName1} من الأم و جدة ${translatedName2} من الأب أخوات.`;
                  }
                }
              }
              else {
                if (p1GreatAncestorGender === 'Male'){
                  if (p2GreatAncestorGender === 'Male'){
                    console.log(`${person1FullName}'s maternal grandfather and ${person2FullName}'s maternal grandfather are brothers.`);
                    return `جدّ ${translatedName1} من الأم و جد ${translatedName2} من الأم إخوة.`;
                  }
                  else{
                    console.log(`${person1FullName}'s maternal grandfather and ${person2FullName}'s maternal grandmother are siblings.`);
                    return `جدّ ${translatedName1} من الأم و جدة ${translatedName2} من الأم إخوة.`;
                  }
                }
                else {
                  if (p2GreatAncestorGender === 'Male'){
                    console.log(`${person1FullName}'s maternal grandmother and ${person2FullName}'s maternal grandfather are siblings.`);
                    return `جدّة ${translatedName1} من الأم و جدة ${translatedName2} من الأب إخوة.`;
                  }
                  else{
                    console.log(`${person1FullName}'s maternal grandmother and ${person2FullName}'s maternal grandmother are sisters.`);
                    return `جدّة ${translatedName1} من الأم و جدة ${translatedName2} من الأم إخوة.`;
                  }
                }
              }
            }
            
          }
        }
      }
    }
    console.log('No direct relation found.');
    return 'No direct relation found';
  } catch (error) {
    console.error('Error in relationship lookup:', error);
    return 'Error in relationship lookup';
  }
};

const getGender = async (personID) => {
  const session = driver.session(); // Open a session

  try {
    const result = await session.run(
      `MATCH (p:Person) 
      WHERE id(p) = $personID
      
      RETURN p.gender AS gender`,
      { personID }
    );
    
    if (result.records.length > 0) {
      const gender = result.records[0].get('gender');
      return gender; // Return the gender value
    } else {
      console.log(`No person found with the ID ${personID}`);
      return null; // Return null when no person is found
    }
  } catch (error) {
    console.error('Error retrieving gender:', error);
    return null; // Return null in case of an error
  } finally {
    await session.close(); // Always close the session after the query
  }
};

const getAncestorFullName = (personAncestors, level) => {
  // Check if the ancestor exists at the given level
  if (!personAncestors[level - 1] || !personAncestors[level - 1].properties) {
    return `Unknown (Level: ${level})`;
  }

  const ancestor = personAncestors[level - 1].properties;
  const name = ancestor.name || "Unknown"; // Default to "Unknown" if name is missing
  const lastName = ancestor.lastName || "Unknown"; // Default to "Unknown" if lastName is missing

  return `${name} ${lastName}`;
};

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

  const fetchRelationship = async (name1, name2) => {
    
    const relationshipResult = await getRelationship(name1, name2);
    console.log(relationshipResult);
    return relationshipResult;
  };

  const FetchRelationship = async (e) => {
    e.preventDefault();
  
    const result = await fetchRelationship(person1, person2);
  
    if (result.error === 'non-unique-name') {
      setDuplicates(result.duplicates);
      setRelationship(result.message); // optional message
    } else {
      setDuplicates({ person1: [], person2: [] }); // clear if no dups
      setRelationship(result);
    }
  };

  return (
    <div className="relation-page">
      {/* Left-side: Duplicates List */}
      {(duplicates.person1.length > 0 || duplicates.person2.length > 0) && (
        <div className="dups_list">
          {duplicates.person1.length > 0 && (
            <>
              <h3>: أكتب الاسم الكامل للشخص الصحيح </h3>
              <ul>
                {duplicates.person1.map((p, idx) => (
                  <li key={`p1-${idx}`}>
                    {`${translateName(p.name)} بن ${translateName(p.father)} بن ${translateName(p.grandfather)} ${translateName(p.lastName)}`}
                  </li>
                ))}
              </ul>
            </>
          )}
  
          {duplicates.person2.length > 0 && (
            <>
              <h3>اختر الشخص الصحيح "{person2}"</h3>
              <ul>
                {duplicates.person2.map((p, idx) => (
                  <li key={`p2-${idx}`}>
                    {`${translateName(p.name)} بن ${translateName(p.father)} بن ${translateName(p.grandfather)} ${translateName(p.lastName)}`}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
  
      {/* Right-side: Main content */}
      <div className="main-content">
        <h2>ماهي العلاقة بينهما؟</h2>
        <form onSubmit={FetchRelationship}>
          <input
            id="name1"
            type="text"
            placeholder="الإسم الكامل الأول"
            value={person1}
            onChange={(e) => setPerson1(e.target.value)}
          />
          <input
            id="name2"
            type="text"
            placeholder="الإسم الكامل الثاني"
            value={person2}
            onChange={(e) => setPerson2(e.target.value)}
          />
          <button type="submit">تحقق من العلاقة</button><br />
        </form>
  
        <p id="relationHolder">{relationship}</p>
      </div>
    </div>
  );
};

export default RelationPage;
