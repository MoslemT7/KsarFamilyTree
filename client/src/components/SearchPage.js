import React, {useRef,  useState, useEffect } from 'react';
import "../styles/SearchPage.css"
import PersonCINCard from './PersonCardCIN';
import * as utils from '../utils/utils';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import usePageTracking from '../utils/trackers';
import { IconButton, Tooltip } from "@chakra-ui/react";
import { MdContentCopy  } from "react-icons/md";
import peopleWithNoChildren from '../data/peopleWithNoChildren.json';

const neo4jURI = process.env.REACT_APP_NEO4J_URI;
const neo4jUser = process.env.REACT_APP_NEO4J_USER;
const neo4jPassword = process.env.REACT_APP_NEO4J_PASSWORD;

const driver = require('neo4j-driver').driver(
    neo4jURI,
    require('neo4j-driver').auth.basic(neo4jUser, neo4jPassword)
);

const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text)
    .then(() => {
      toast.success('📋 تم النسخ إلى الحافظة!');
    })
    .catch((err) => {
      toast.error('❌ فشل النسخ!');
      console.error('Copy failed:', err);
    });
};

const SearchPage = () => {
  const [treeVisible, setTreeVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [personDetails, setPersonDetails] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [viewMode, setViewMode] = useState('card');
  const [showFullName, setShowFullName] = useState(false);

  usePageTracking();
  
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handlePersonSelect = (selectedPerson) => {
    setPersonDetails({
      personID: selectedPerson.personID,
      personName: selectedPerson.personName,
      fatherName: selectedPerson.fatherName,
      grandfatherName: selectedPerson.grandfatherName,
      familyName: selectedPerson.familyName,
      gender: selectedPerson.gender,
      age: selectedPerson.age,
      YoB: selectedPerson.YoB,
      YoD: selectedPerson.YoD,
      motherName: selectedPerson.motherName,
      motherFatherName: selectedPerson.motherFatherName,
      motherGrandFatherName: selectedPerson.motherGrandFatherName,
      motherFamilyName: selectedPerson.motherFamilyName,
      lifeStatus: selectedPerson.lifeStatus,
      maritalStatus: selectedPerson.maritalStatus,
      childrenCount: selectedPerson.childrenCount,
      siblingsCount: selectedPerson.siblingsCount
    });
  };

  const handleSearchSubmit = async () => {
    setTreeVisible(false);
    if (!searchQuery.trim()) {
      setError('الرجاء إدخال نص للبحث.');
      setPersonDetails(null);
      return;
    }
    await searchPerson(searchQuery.trim());
  };

  const handleResetPerson = async () => {
    setSearchQuery('');
    setPersonDetails(null);
  };

  const searchPerson = async (searchText) => {
    let cypherQuery = ``;
    const queryParamsObject = {};

    if (!isNaN(searchText)){
      cypherQuery += `
        MATCH (grandfather:Person)-[:FATHER_OF]->(father:Person)-[:FATHER_OF]->(child:Person)
        WHERE id(child) = $personID

        OPTIONAL MATCH (mother:Person)-[:MOTHER_OF]->(child)
        OPTIONAL MATCH (motherFather:Person)-[:FATHER_OF]->(mother)
        OPTIONAL MATCH (motherGrandfather:Person)-[:FATHER_OF]->(motherFather)

        OPTIONAL MATCH (child)-[r:MARRIED_TO]-(spouse:Person)
        OPTIONAL MATCH (child)-[:FATHER_OF|MOTHER_OF]->(childOf:Person)
        OPTIONAL MATCH (father)-[:FATHER_OF]->(sibling:Person)
          WHERE sibling <> child

        OPTIONAL MATCH lineagePath = (child)<-[:FATHER_OF*]-(ancestor:Person)
        WITH *, 
            lineagePath
        ORDER BY length(lineagePath) DESC

        WITH *, 
            [n IN reverse(nodes(lineagePath)) | n.name] + child.name AS lineageNames

        RETURN 
        child.name AS childName, 
        child.YoB AS childYoB, 
        child.gender AS childGender,

        father.name AS fatherName, 
        grandfather.name AS grandfatherName,

        mother.name AS motherName,
        motherFather.name AS motherFatherName,
        motherGrandfather.name AS motherGrandfatherName,
        mother.lastName AS motherFamilyName,
        child.lastName AS familyName,
        id(child) AS childID,
        child.isAlive AS lifeStatus,
        child.YoD AS YoD, 
        child.WorkCountry AS Country,
        child.Branch AS Branch,
        child.Notes AS Notes,
        child.Nickname as Nickname,

        r.status AS maritalStatus,
        COUNT(DISTINCT childOf) AS childrenCount,
        COUNT(DISTINCT sibling) AS siblingsCount,
        lineageNames AS fullLineage`;
      
      queryParamsObject.personID = Number(searchText);
      const session = driver.session();
      setLoading(true);
      try {
        const result = await session.run(cypherQuery, queryParamsObject);
        setLoadingMessage("جاري البحث عن الشخص بـالرقم" + searchText);
        if (result.records.length === 0) {
          setLoading(false);
          setError('هذا الشخص ليس مسجل في الشجرة ، الرجاء التحقق من الإسم.');
          setPersonDetails(null);
          return;
        }
        else {
          setLoadingMessage("تم إيجاد الشخص ...");
          const record = result.records[0];
          let age;
          let YoB = record.get('childYoB');
          let YoD = record.get('YoD');
          if (YoB == null){
            age = -1;
          }
          else{
            age = new Date().getFullYear() - YoB;
          }
          const childID = record.get("childID").toNumber();
          setLoadingMessage("جاري التحقق من المعلومات ...");
          const personDetails = {
            personID: childID,
            personName: record.get('childName') ?? "غير متوفر",
            fatherName: record.has('fatherName') ? record.get('fatherName') : "غير متوفر",
            grandfatherName: record.has('grandfatherName') ? record.get('grandfatherName') : "غير متوفر", 
            familyName: record.has('familyName') ? record.get('familyName') : "غير متوفر",
            Branch: record.has('Branch') ? record.get('Branch') : "غير متوفر", 
            fullLineage: record.has('lineageNames') ? record.get('lineageNames') : "غير متوفر",
            gender: record.has('childGender') ? record.get('childGender') : "غير متوفر", 
            age, YoB, YoD,
            motherName: record.has('motherName') && record.get('motherName') !== null ? record.get('motherName') : null,
            motherFatherName: record.has('motherFatherName') && record.get('motherFatherName') !== null ? record.get('motherFatherName') : null,
            motherGrandFatherName: record.has('motherGrandfatherName') && record.get('motherGrandfatherName') !== null ? record.get('motherGrandfatherName') : null,
            motherFamilyName: record.has('motherFamilyName') && record.get('motherFamilyName') !== null ? record.get('motherFamilyName') :null,
            maritalStatus: record.has('maritalStatus') && record.get('maritalStatus') !== null ? record.get('maritalStatus') : null,
            Nickname: record.has('Nickname') && record.get('Nickname') !== null ? record.get('Nickname') :null,
            Notes: record.has('Notes') && record.get('Notes') !== null ? record.get('Notes') : null,

            lifeStatus: record.has('lifeStatus') ? record.get('lifeStatus') : "غير متوفر",
            
            childrenCount: record.has('childrenCount') && record.get('childrenCount') !== null
            ? record.get('childrenCount').toNumber()
            : 0,
            siblingsCount: record.has('siblingsCount') && record.get('siblingsCount') !== null
            ? record.get('siblingsCount').toNumber()
            : 0,
            country: record.get("Country")
          };
          console.log(personDetails);
          setPersonDetails(personDetails);
          setLoading(false);
          setError('');
        }
      }
      catch (err) {
        setLoading(false);
        console.error('Query Error:', err);
        setError('حدث خطأ أثناء البحث.');
        setPersonDetails(null);
      } 
      finally {
        setLoading(false);
        await session.close();
      }
    }
    else{
      const isArabic = (text) => /[\u0600-\u06FF]/.test(text);
      let translatedInputName = utils.translateName(searchText, false);
      const { personName: personName, fatherName: fatherName, grandfatherName: grandfatherName, familyName: familyName } = utils.splitName(translatedInputName);
      let translatedpersonName = isArabic(personName) ? utils.translateName(personName, false) : personName;
      let translatedfatherName = isArabic(fatherName) ? utils.translateName(fatherName, false) : fatherName;
      let translatedgrandfatherName = isArabic(grandfatherName) ? utils.translateName(grandfatherName, false) : grandfatherName;
      let translatedfamilyName = isArabic(familyName) ? utils.translateFamilyName(familyName, false) : familyName;
      console.log(translatedpersonName, translatedfatherName, translatedgrandfatherName, translatedfamilyName);
      setLoading(true);
      setLoadingMessage("جاري البحث عن الشخص ...");
      if (translatedpersonName){
        
        if (translatedfatherName) {
          
          if (translatedgrandfatherName) {
            
            if (translatedfamilyName) {
              
              cypherQuery += `
                MATCH (grandfather:Person)-[:FATHER_OF]->(father:Person)-[:FATHER_OF]->(child:Person)
                WHERE (child.name = $personName OR child.Nickname = $personName) AND 
                      (father.name = $fatherName OR father.Nickname = $fatherName) AND 
                      (grandfather.name = $grandfatherName OR grandfather.Nickname = $grandfatherName) AND 
                      child.lastName = $familyName
                WITH child, father, grandfather
                OPTIONAL MATCH (mother:Person)-[:MOTHER_OF]->(child)
                OPTIONAL MATCH (motherFather:Person)-[:FATHER_OF]->(mother)
                OPTIONAL MATCH (motherGrandfather:Person)-[:FATHER_OF]->(motherFather)

                OPTIONAL MATCH (child)-[r:MARRIED_TO]-(spouse:Person)
                OPTIONAL MATCH (child)-[:FATHER_OF|MOTHER_OF]->(childOf:Person)
                OPTIONAL MATCH (father)-[:FATHER_OF]->(sibling:Person)
                  WHERE sibling <> child

                OPTIONAL MATCH lineagePath = (child)<-[:FATHER_OF*]-(ancestor:Person)
                WITH child, father, grandfather, mother, motherFather, motherGrandfather, r,
              childOf, sibling, lineagePath

          WITH 
            child,
            father,
            grandfather,
            mother,
            motherFather,
            motherGrandfather,
            r,
            childOf,
            sibling,
            COLLECT(lineagePath) AS lineagePaths
          WITH child, father, grandfather, mother, motherFather, motherGrandfather, r, childOf, sibling,
              REDUCE(acc = null, path IN lineagePaths |
                CASE
                  WHEN acc IS NULL OR length(path) > length(acc) THEN path
                  ELSE acc
                END
              ) AS longestPath
          WITH 
            child,
            father,
            grandfather,
            mother,
            motherFather,
            motherGrandfather,
            r,
            childOf,
            sibling,
            [n IN nodes(longestPath) | n.name] + child.name AS lineageNames

          // Final aggregation grouped by child
          WITH 
            child,
            child.name AS childName, 
            child.YoB AS childYoB, 
            child.gender AS childGender,
            father.name AS fatherName, 
            grandfather.name AS grandfatherName,
            mother.name AS motherName,
            motherFather.name AS motherFatherName,
            motherGrandfather.name AS motherGrandfatherName,
            mother.lastName AS motherFamilyName,
            child.lastName AS familyName,
            id(child) AS childID,
            child.isAlive AS lifeStatus,
            child.YoD AS YoD, 
            child.WorkCountry AS Country,
            child.Branch AS Branch,
            child.Notes AS Notes,
            child.Nickname AS Nickname,
            r.status AS maritalStatus,
            lineageNames,
            COUNT(DISTINCT childOf) AS childrenCount,
            COUNT(DISTINCT sibling) AS siblingsCount

          RETURN 
            childName, 
            childYoB, 
            childGender,
            fatherName, 
            grandfatherName,
            motherName,
            motherFatherName,
            motherGrandfatherName,
            motherFamilyName,
            familyName,
            childID,
            lifeStatus,
            YoD,
            Country,
            Branch,
            Notes,
            Nickname,
            maritalStatus,
            childrenCount,
            siblingsCount,
            lineageNames
            ORDER BY childName
            `;
              
              queryParamsObject.personName = translatedpersonName;
              queryParamsObject.fatherName = translatedfatherName;
              queryParamsObject.grandfatherName = translatedgrandfatherName;
              queryParamsObject.familyName = translatedfamilyName;
              
            } 
            else {
              cypherQuery += `
                MATCH (grandfather:Person)-[:FATHER_OF]->(father:Person)-[:FATHER_OF]->(child:Person)
                WHERE (child.name = $personName OR child.Nickname = $personName) AND 
                      (father.name = $fatherName OR father.Nickname = $fatherName) AND 
                      grandfather.name = $grandfatherName
                OPTIONAL MATCH (motherGrandfather:Person)-[:FATHER_OF]->(motherFather:Person)-[:FATHER_OF]->(mother:Person)-[:MOTHER_OF]->(child)
                OPTIONAL MATCH (child)-[r:MARRIED_TO]-(spouse:Person)
                OPTIONAL MATCH (child)-[:FATHER_OF|MOTHER_OF]->(childOf:Person)
                OPTIONAL MATCH (father)-[:FATHER_OF]->(sibling:Person)
                  WHERE sibling <> child
                
                OPTIONAL MATCH lineagePath = (child)<-[:FATHER_OF*]-(ancestor:Person)
                WITH child, father, grandfather, mother, motherFather, motherGrandfather, r,
              childOf, sibling, lineagePath

          WITH 
            child,
            father,
            grandfather,
            mother,
            motherFather,
            motherGrandfather,
            r,
            childOf,
            sibling,
            COLLECT(lineagePath) AS lineagePaths
          WITH child, father, grandfather, mother, motherFather, motherGrandfather, r, childOf, sibling,
              REDUCE(acc = null, path IN lineagePaths |
                CASE
                  WHEN acc IS NULL OR length(path) > length(acc) THEN path
                  ELSE acc
                END
              ) AS longestPath
          WITH 
            child,
            father,
            grandfather,
            mother,
            motherFather,
            motherGrandfather,
            r,
            childOf,
            sibling,
            [n IN nodes(longestPath) | n.name] + child.name AS lineageNames

          // Final aggregation grouped by child
          WITH 
            child,
            child.name AS childName, 
            child.YoB AS childYoB, 
            child.gender AS childGender,
            father.name AS fatherName, 
            grandfather.name AS grandfatherName,
            mother.name AS motherName,
            motherFather.name AS motherFatherName,
            motherGrandfather.name AS motherGrandfatherName,
            mother.lastName AS motherFamilyName,
            child.lastName AS familyName,
            id(child) AS childID,
            child.isAlive AS lifeStatus,
            child.YoD AS YoD, 
            child.WorkCountry AS Country,
            child.Branch AS Branch,
            child.Notes AS Notes,
            child.Nickname AS Nickname,
            r.status AS maritalStatus,
            lineageNames,
            COUNT(DISTINCT childOf) AS childrenCount,
            COUNT(DISTINCT sibling) AS siblingsCount

          RETURN 
            childName, 
            childYoB, 
            childGender,
            fatherName, 
            grandfatherName,
            motherName,
            motherFatherName,
            motherGrandfatherName,
            motherFamilyName,
            familyName,
            childID,
            lifeStatus,
            YoD,
            Country,
            Branch,
            Notes,
            Nickname,
            maritalStatus,
            childrenCount,
            siblingsCount,
            lineageNames
          ORDER BY childName`;
              queryParamsObject.personName = translatedpersonName;
              queryParamsObject.fatherName = translatedfatherName;
              queryParamsObject.grandfatherName = translatedgrandfatherName;
            }
            
          } 
          else {
            if (translatedfamilyName){
              cypherQuery += `
              MATCH (father:Person)-[:FATHER_OF]->(child:Person)
              WHERE (child.name = $personName OR child.Nickname = $personName) AND 
                    (father.name = $fatherName OR father.Nickname = $fatherName) AND
                    child.lastName = $familyName
              OPTIONAL MATCH (grandfather:Person)-[:FATHER_OF]->(father)
              OPTIONAL MATCH (mother:Person)-[:MOTHER_OF]->(child)
              OPTIONAL MATCH (motherFather:Person)-[:FATHER_OF]->(mother)
              OPTIONAL MATCH (motherGrandfather:Person)-[:FATHER_OF]->(motherFather)

              OPTIONAL MATCH (child)-[r:MARRIED_TO]-(spouse:Person)
              OPTIONAL MATCH (child)-[:FATHER_OF|MOTHER_OF]->(childOf:Person)
              OPTIONAL MATCH (father)-[:FATHER_OF]->(sibling:Person)
                WHERE sibling <> child
              OPTIONAL MATCH lineagePath = (child)<-[:FATHER_OF*]-(ancestor:Person)
              WITH child, father, grandfather, mother, motherFather, motherGrandfather, r,
              childOf, sibling, lineagePath

          WITH 
            child,
            father,
            grandfather,
            mother,
            motherFather,
            motherGrandfather,
            r,
            childOf,
            sibling,
            COLLECT(lineagePath) AS lineagePaths
          WITH child, father, grandfather, mother, motherFather, motherGrandfather, r, childOf, sibling,
              REDUCE(acc = null, path IN lineagePaths |
                CASE
                  WHEN acc IS NULL OR length(path) > length(acc) THEN path
                  ELSE acc
                END
              ) AS longestPath
          WITH 
            child,
            father,
            grandfather,
            mother,
            motherFather,
            motherGrandfather,
            r,
            childOf,
            sibling,
            [n IN nodes(longestPath) | n.name] + child.name AS lineageNames

          // Final aggregation grouped by child
          WITH 
            child,
            child.name AS childName, 
            child.YoB AS childYoB, 
            child.gender AS childGender,
            father.name AS fatherName, 
            grandfather.name AS grandfatherName,
            mother.name AS motherName,
            motherFather.name AS motherFatherName,
            motherGrandfather.name AS motherGrandfatherName,
            mother.lastName AS motherFamilyName,
            child.lastName AS familyName,
            id(child) AS childID,
            child.isAlive AS lifeStatus,
            child.YoD AS YoD, 
            child.WorkCountry AS Country,
            child.Branch AS Branch,
            child.Notes AS Notes,
            child.Nickname AS Nickname,
            r.status AS maritalStatus,
            lineageNames,
            COUNT(DISTINCT childOf) AS childrenCount,
            COUNT(DISTINCT sibling) AS siblingsCount

          RETURN 
            childName, 
            childYoB, 
            childGender,
            fatherName, 
            grandfatherName,
            motherName,
            motherFatherName,
            motherGrandfatherName,
            motherFamilyName,
            familyName,
            childID,
            lifeStatus,
            YoD,
            Country,
            Branch,
            Notes,
            Nickname,
            maritalStatus,
            childrenCount,
            siblingsCount,
            lineageNames
          ORDER BY childName
              
              `;
              queryParamsObject.personName = translatedpersonName;
              queryParamsObject.fatherName = translatedfatherName;
              queryParamsObject.familyName = translatedfamilyName;
            }
            else{
              cypherQuery += `
              MATCH (father:Person)-[:FATHER_OF]->(child:Person)
              
              WHERE (child.name = $personName OR child.Nickname = $personName) AND 
                    (father.name = $fatherName OR father.Nickname = $fatherName)
              OPTIONAL MATCH (grandfather:Person)-[:FATHER_OF]->(father)
              OPTIONAL MATCH (mother:Person)-[:MOTHER_OF]->(child)
              OPTIONAL MATCH (motherFather:Person)-[:FATHER_OF]->(mother)
              OPTIONAL MATCH (motherGrandfather:Person)-[:FATHER_OF]->(motherFather)

              OPTIONAL MATCH (child)-[r:MARRIED_TO]-(spouse:Person)
              OPTIONAL MATCH (child)-[:FATHER_OF|MOTHER_OF]->(childOf:Person)
              OPTIONAL MATCH (father)-[:FATHER_OF]->(sibling:Person)
                WHERE sibling <> child

              OPTIONAL MATCH lineagePath = (child)<-[:FATHER_OF*]-(ancestor:Person)
              WITH child, father, grandfather, mother, motherFather, motherGrandfather, r,
              childOf, sibling, lineagePath

          WITH 
            child,
            father,
            grandfather,
            mother,
            motherFather,
            motherGrandfather,
            r,
            childOf,
            sibling,
            COLLECT(lineagePath) AS lineagePaths
          WITH child, father, grandfather, mother, motherFather, motherGrandfather, r, childOf, sibling,
              REDUCE(acc = null, path IN lineagePaths |
                CASE
                  WHEN acc IS NULL OR length(path) > length(acc) THEN path
                  ELSE acc
                END
              ) AS longestPath
          WITH 
            child,
            father,
            grandfather,
            mother,
            motherFather,
            motherGrandfather,
            r,
            childOf,
            sibling,
            [n IN nodes(longestPath) | n.name] + child.name AS lineageNames

          // Final aggregation grouped by child
          WITH 
            child,
            child.name AS childName, 
            child.YoB AS childYoB, 
            child.gender AS childGender,
            father.name AS fatherName, 
            grandfather.name AS grandfatherName,
            mother.name AS motherName,
            motherFather.name AS motherFatherName,
            motherGrandfather.name AS motherGrandfatherName,
            mother.lastName AS motherFamilyName,
            child.lastName AS familyName,
            id(child) AS childID,
            child.isAlive AS lifeStatus,
            child.YoD AS YoD, 
            child.WorkCountry AS Country,
            child.Branch AS Branch,
            child.Notes AS Notes,
            child.Nickname AS Nickname,
            r.status AS maritalStatus,
            lineageNames,
            COUNT(DISTINCT childOf) AS childrenCount,
            COUNT(DISTINCT sibling) AS siblingsCount

          RETURN 
            childName, 
            childYoB, 
            childGender,
            fatherName, 
            grandfatherName,
            motherName,
            motherFatherName,
            motherGrandfatherName,
            motherFamilyName,
            familyName,
            childID,
            lifeStatus,
            YoD,
            Country,
            Branch,
            Notes,
            Nickname,
            maritalStatus,
            childrenCount,
            siblingsCount,
            lineageNames
          ORDER BY childName
              `;
              queryParamsObject.personName = translatedpersonName;
              queryParamsObject.fatherName = translatedfatherName;
            }
          }
        }
      else {
        if (translatedfamilyName){
          cypherQuery += `
          MATCH (child:Person)
          WHERE (child.name = $personName OR child.Nickname = $personName) AND child.lastName = $familyName

          OPTIONAL MATCH (father:Person)-[:FATHER_OF]->(child)
          OPTIONAL MATCH (grandfather:Person)-[:FATHER_OF]->(father)
          OPTIONAL MATCH (mother:Person)-[:MOTHER_OF]->(child)
          OPTIONAL MATCH (motherFather:Person)-[:FATHER_OF]->(mother)
          OPTIONAL MATCH (motherGrandfather:Person)-[:FATHER_OF]->(motherFather)

          OPTIONAL MATCH (child)-[r:MARRIED_TO]-(spouse:Person)
          OPTIONAL MATCH (child)-[:FATHER_OF|MOTHER_OF]->(childOf:Person)
          OPTIONAL MATCH (father)-[:FATHER_OF]->(sibling:Person)
            WHERE sibling <> child

          // Lineage path collection
          OPTIONAL MATCH lineagePath = (child)<-[:FATHER_OF*]-(ancestor:Person)
          WITH child, father, grandfather, mother, motherFather, motherGrandfather, r,
              childOf, sibling, lineagePath

          WITH 
            child,
            father,
            grandfather,
            mother,
            motherFather,
            motherGrandfather,
            r,
            childOf,
            sibling,
            COLLECT(lineagePath) AS lineagePaths
          WITH child, father, grandfather, mother, motherFather, motherGrandfather, r, childOf, sibling,
              REDUCE(acc = null, path IN lineagePaths |
                CASE
                  WHEN acc IS NULL OR length(path) > length(acc) THEN path
                  ELSE acc
                END
              ) AS longestPath
          WITH 
            child,
            father,
            grandfather,
            mother,
            motherFather,
            motherGrandfather,
            r,
            childOf,
            sibling,
            [n IN nodes(longestPath) | n.name] + child.name AS lineageNames

          // Final aggregation grouped by child
          WITH 
            child,
            child.name AS childName, 
            child.YoB AS childYoB, 
            child.gender AS childGender,
            father.name AS fatherName, 
            grandfather.name AS grandfatherName,
            mother.name AS motherName,
            motherFather.name AS motherFatherName,
            motherGrandfather.name AS motherGrandfatherName,
            mother.lastName AS motherFamilyName,
            child.lastName AS familyName,
            id(child) AS childID,
            child.isAlive AS lifeStatus,
            child.YoD AS YoD, 
            child.WorkCountry AS Country,
            child.Branch AS Branch,
            child.Notes AS Notes,
            child.Nickname AS Nickname,
            r.status AS maritalStatus,
            lineageNames,
            COUNT(DISTINCT childOf) AS childrenCount,
            COUNT(DISTINCT sibling) AS siblingsCount

          RETURN 
            childName, 
            childYoB, 
            childGender,
            fatherName, 
            grandfatherName,
            motherName,
            motherFatherName,
            motherGrandfatherName,
            motherFamilyName,
            familyName,
            childID,
            lifeStatus,
            YoD,
            Country,
            Branch,
            Notes,
            Nickname,
            maritalStatus,
            childrenCount,
            siblingsCount,
            lineageNames
          ORDER BY childName

        `;
        queryParamsObject.personName = translatedpersonName;
        queryParamsObject.familyName = translatedfamilyName;
        }
        else{
          cypherQuery += `
            MATCH (child:Person)
            WHERE child.name = $personName OR child.Nickname = $personName

            OPTIONAL MATCH (father:Person)-[:FATHER_OF]->(child)
            OPTIONAL MATCH (grandfather:Person)-[:FATHER_OF]->(father)
            OPTIONAL MATCH (mother:Person)-[:MOTHER_OF]->(child)
            OPTIONAL MATCH (motherFather:Person)-[:FATHER_OF]->(mother)
            OPTIONAL MATCH (motherGrandfather:Person)-[:FATHER_OF]->(motherFather)

            OPTIONAL MATCH (child)-[r:MARRIED_TO]-(spouse:Person)
            OPTIONAL MATCH (child)-[:FATHER_OF|MOTHER_OF]->(childOf:Person)
            OPTIONAL MATCH (father)-[:FATHER_OF]->(sibling:Person)
              WHERE sibling <> child
            OPTIONAL MATCH lineagePath = (child)<-[:FATHER_OF*]-(ancestor:Person)
            WITH child, father, grandfather, mother, motherFather, motherGrandfather, r,
                childOf, sibling, lineagePath

            WITH 
              child,
              father,
              grandfather,
              mother,
              motherFather,
              motherGrandfather,
              r,
              childOf,
              sibling,
              COLLECT(lineagePath) AS lineagePaths
            WITH child, father, grandfather, mother, motherFather, motherGrandfather, r, childOf, sibling,
                REDUCE(acc = null, path IN lineagePaths |
                  CASE
                    WHEN acc IS NULL OR length(path) > length(acc) THEN path
                    ELSE acc
                  END
                ) AS longestPath
            WITH 
              child,
              father,
              grandfather,
              mother,
              motherFather,
              motherGrandfather,
              r,
              childOf,
              sibling,
              [n IN nodes(longestPath) | n.name] + child.name AS lineageNames

            // Final aggregation grouped by child
            WITH 
              child,
              child.name AS childName, 
              child.YoB AS childYoB, 
              child.gender AS childGender,
              father.name AS fatherName, 
              grandfather.name AS grandfatherName,
              mother.name AS motherName,
              motherFather.name AS motherFatherName,
              motherGrandfather.name AS motherGrandfatherName,
              mother.lastName AS motherFamilyName,
              child.lastName AS familyName,
              id(child) AS childID,
              child.isAlive AS lifeStatus,
              child.YoD AS YoD, 
              child.WorkCountry AS Country,
              child.Branch AS Branch,
              child.Notes AS Notes,
              child.Nickname AS Nickname,
              r.status AS maritalStatus,
              lineageNames,
              COUNT(DISTINCT childOf) AS childrenCount,
              COUNT(DISTINCT sibling) AS siblingsCount

            RETURN 
              childName, 
              childYoB, 
              childGender,
              fatherName, 
              grandfatherName,
              motherName,
              motherFatherName,
              motherGrandfatherName,
              motherFamilyName,
              familyName,
              childID,
              lifeStatus,
              YoD,
              Country,
              Branch,
              Notes,
              Nickname,
              maritalStatus,
              childrenCount,
              siblingsCount,
              lineageNames
            ORDER BY childName

            `;
          queryParamsObject.personName = translatedpersonName;
        }
      }
      }
      
      const session = driver.session();
      try {
        const result = await session.run(cypherQuery, queryParamsObject);
        if (result.records.length === 0) {
          setLoading(false);
          setError('هذا الشخص ليس مسجل في الشجرة ، الرجاء التحقق من الإسم.');
          setPersonDetails(null);
          return;
        }
        else if (result.records.length === 1) {
          setLoading(false);
          setLoadingMessage("تم إيجاد الشخص ...");
          const record = result.records[0];
          let YoB = record.get('childYoB');
          YoB = YoB !== null ? Number(YoB) : null;
          let YoD = record.get('YoD');
          YoD = YoD !== null ? Number(YoD) : null;
          let age = YoB == null ? -1 : new Date().getFullYear() - Number(YoB);
          const childID = record.get("childID").toNumber();
          setLoadingMessage("جاري التحقق من المعلومات ...");
          const personDetails = {
            personID: childID,
            personName: record.get('childName') ?? "غير متوفر",
            fatherName: record.has('fatherName') ? record.get('fatherName') : "غير متوفر",
            grandfatherName: record.has('grandfatherName') ? record.get('grandfatherName') : "غير متوفر", 
            familyName: record.has('familyName') ? record.get('familyName') : "غير متوفر",
            Branch: record.has('Branch') ? record.get('Branch') : "غير متوفر", 
            fullLineage: record.has('lineageNames') ? record.get('lineageNames') : "غير متوفر",
            gender: record.has('childGender') ? record.get('childGender') : "غير متوفر", 
            age,
            YoB,
            YoD,
            motherName: record.has('motherName') && record.get('motherName') !== null ? record.get('motherName') : null,
            motherFatherName: record.has('motherFatherName') && record.get('motherFatherName') !== null ? record.get('motherFatherName') : null,
            motherGrandFatherName: record.has('motherGrandfatherName') && record.get('motherGrandfatherName') !== null ? record.get('motherGrandfatherName') : null,
            motherFamilyName: record.has('motherFamilyName') && record.get('motherFamilyName') !== null ? record.get('motherFamilyName') :null,
            maritalStatus: record.has('maritalStatus') && record.get('maritalStatus') !== null ? record.get('maritalStatus') : null,
            Nickname: record.has('Nickname') && record.get('Nickname') !== null ? record.get('Nickname') :null,
            Notes: record.has('Notes') && record.get('Notes') !== null ? record.get('Notes') : null,
            lifeStatus: record.has('lifeStatus') ? record.get('lifeStatus') : "غير متوفر",
            
            childrenCount: record.has('childrenCount') && record.get('childrenCount') !== null
            ? record.get('childrenCount').toNumber()
            : 0,
            siblingsCount: record.has('siblingsCount') && record.get('siblingsCount') !== null
            ? record.get('siblingsCount').toNumber()
            : 0,
            country: record.get("Country")
          };
          console.log(personDetails);
          setPersonDetails(personDetails);
          setLoading(false);
          setError('');
        } 
        else if (result.records.length >= 2) {
          setLoadingMessage("تم العثور على أكثر من شخص ...");
          const multipleMatches = [];
          for (const record of result.records) {
            let YoB = record.get('childYoB');
            YoB = YoB !== null ? Number(YoB) : null;
            let YoD = record.get('YoD');
            YoD = YoD !== null ? Number(YoD) : null;
            let age = YoB == null ? -1 : new Date().getFullYear() - Number(YoB);
        
            const childID = record.get("childID").toNumber();
            const personDetails = {
              personID: childID,
              personName: record.get('childName') ?? "غير متوفر",
              fatherName: record.has('fatherName') ? record.get('fatherName') : "غير متوفر",
              grandfatherName: record.has('grandfatherName') ? record.get('grandfatherName') : "غير متوفر", 
              familyName: record.has('familyName') ? record.get('familyName') : "غير متوفر", 
              gender: record.has('childGender') ? record.get('childGender') : "غير متوفر",
              Branch: record.has('Branch') ? record.get('Branch') : "غير متوفر",
              fullLineage: record.has('lineageNames') ? record.get('lineageNames') : "غير متوفر",
              age, YoB, YoD,
              motherName: record.has('motherName') && record.get('motherName') !== null ? record.get('motherName') : null,
              motherFatherName: record.has('motherFatherName') && record.get('motherFatherName') !== null ? record.get('motherFatherName') : null,
              motherGrandFatherName: record.has('motherGrandfatherName') && record.get('motherGrandfatherName') !== null ? record.get('motherGrandfatherName') : null,
              motherFamilyName: record.has('motherFamilyName') && record.get('motherFamilyName') !== null ? record.get('motherFamilyName') :null,
              maritalStatus: record.has('maritalStatus') && record.get('maritalStatus') !== null ? record.get('maritalStatus') : null,
              Nickname: record.has('Nickname') && record.get('Nickname') !== null ? record.get('Nickname') :null,
              Notes: record.has('Notes') && record.get('Notes') !== null ? record.get('Notes') : null,
              lifeStatus: record.has('lifeStatus') ? record.get('lifeStatus') : "غير متوفر",
              
              childrenCount: record.has('childrenCount') && record.get('childrenCount') !== null
              ? record.get('childrenCount').toNumber()
              : 0,

              siblingsCount: record.has('siblingsCount') && record.get('siblingsCount') !== null
              ? record.get('siblingsCount').toNumber()
              : 0,

              country: record.get("Country")
            };
            console.log(multipleMatches);
            multipleMatches.push(personDetails);
          }
          
          setPersonDetails({ multipleMatches });
          setError('هناك العديد من الأشخاص يحملون نفس الاسم. الرجاء اختيار الشخص الصحيح.');
        }
      } 
      catch (err) {
        setLoading(false);
        console.error('Query Error:', err);
        setError('حدث خطأ أثناء البحث.');
        setPersonDetails(null);
      } 
      finally {
        setLoading(false);
        await session.close();
      }
    }
  };

  useEffect(() => {
      document.title = "إبحث عن شخص";
    }, []);
  return (
    <div className="search-page">
      <header className="search-header">
        <h1>إبحث عن الأفراد في الشجرة</h1>
        <p>
          في هذه المخصصة للبحث عن الأفراد، يمكنك الوصول بسهولة إلى معلومات دقيقة عن أي شخص داخل شجرة العائلة،
           وذلك عبر إدخال أي تركيبة من الأسماء — سواء الاسم الكامل، أو اسم الأب، أو حتى جزء من الاسم. بمجرد إدخال البيانات،
           إذا تم العثور على الشخص المطلوب، يتم عرض رقمه التسلسلي في الشجرة،
           إلى جانب اسمه الكامل، واسم والده، واسم والدته.
           كما يمكن للمستخدم الاطلاع على تفاصيل إضافية تشمل سنة الميلاد، وسنة الوفاة (إن وجدت)، وعمر الشخص، وعدد أبنائه، وعدد إخوته. هذه الصفحة تتيح تجربة بحث متقدمة ودقيقة تُمكّن كل فرد من التعرف بشكل أعمق على جذوره وروابطه العائلية.
          </p>

        <input
          type="text"
          className="search-bar"
          placeholder="ادخل الاسم الثلاثي أو الرقم التسلسلي..."
          value={searchQuery}
          onChange={handleSearchChange}
        />
        <div className='buttons'>
          <button className="search-button" onClick={handleSearchSubmit}>ابحث</button>
          <button className='reset-button' onClick={handleResetPerson}>إلغاء</button>
        </div>
      
      </header>

      {error && 
        <div className="error-message">
          {error}
        </div>
      }
      {loading && (
        <div className="loading-message">
          <div className="spinner"></div>
          <p>{loadingMessage}</p>
        </div>
      )}
      {personDetails && !personDetails.multipleMatches && (
        <div className="view-toggle-buttons">
          <button
            className={viewMode === 'card' ? 'active' : ''}
            onClick={() => setViewMode('card')}
          >
            عرض البطاقة
          </button>
          <button
            className={viewMode === 'table' ? 'active' : ''}
            onClick={() => setViewMode('table')}
          >
            عرض الجدول
          </button>
        </div>
      )}

      {personDetails && personDetails.multipleMatches ? (
        <div className="multiple-matches">
          <h2>تم العثور على {personDetails.multipleMatches.length} نتيجة</h2>
            <table className='duplicated-table'>
              <thead>
                <tr>
                  <th id="index">الرقم التسلسلي</th>
                  <th className='WS'>الإسم</th>
                  <th className='WS'>إسم الأب</th>
                  <th className='WS'>إسم الجدّ</th>
                  <th className='WS'>اللقب</th>
                  <th className='SS'>الاسم الثلاثي</th>
                  <th>العمر </th>
                  <th>سنة الوفاة </th>
                  <th>عدد الأطفال</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {personDetails.multipleMatches.map((person, index) => (
                  <tr key={index} >
                    <td id="index">{person.personID + 1}</td>
                    <td className='WS'>
                      {peopleWithNoChildren.includes(person.personID) 
                        ? utils.translateName(person.personName) + " ∅" 
                        : utils.translateName(person.personName)}
                    </td>                    
                    <td className='WS'>{person.fatherName ? ` ${utils.translateName(person.fatherName)}` : ''}</td>
                    <td className='WS'>{person.grandfatherName ? ` ${utils.translateName(person.grandfatherName)}` : ''}</td>
                    <td className='WS'>{person.familyName ? utils.translateFamilyName(person.familyName) : ''}</td>
                    <td className='SS'>{utils.translateName(person.personName)}
                    {person.fatherName && ` ${person.gender === 'Male' ? 'بن' : 'بنت'} ${utils.translateName(person.fatherName)}`}
                    {person.grandfatherName && ` بن ${utils.translateName(person.grandfatherName)}`}
                    {person.familyName && ` ${utils.translateFamilyName(person.familyName)}`}
                    </td>
                    <td>{person.age !== -1 ? person.age : " - "}</td>
                    <td>{person.lifeStatus === true ? '-' : person.YoD ? person.YoD : " غير متوفر "}</td>
                    <td>{person.childrenCount ? person.childrenCount : " - "}</td>
                    <td><button className='choiceButton' onClick={() => {
                      handlePersonSelect(person);
                      setError(false);
                      }}>إختيار</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
      ) : personDetails ? (
        <div className="person-card-container">
          {viewMode === 'card' ? (
            <PersonCINCard person={personDetails} />
          ) : (
            <div className="person-table-view">
              <table className="person-side-table">
                <tbody>
                <tr>
                  <th>الرقم التسلسلي</th>
                  <td>
                    <Tooltip label="نسخ الرقم" hasArrow>
                      <IconButton
                        icon={<MdContentCopy />}
                        aria-label="نسخ الرقم"
                        className="highlight-id"
                        onClick={() => copyToClipboard(personDetails.personID)}
                        size="sm"
                        colorScheme="teal"
                        variant="outline"
                      />
                    </Tooltip>
                    <span>{personDetails.personID}</span>
                  </td>
                </tr>
                  <tr>
                    <th>
                      الاسم الكامل
                    </th>
                    <td>
                      {showFullName ?
                      utils.formatFullName(personDetails.fullLineage, personDetails.gender, 0, 11) :
                      "-"
                      } {utils.translateFamilyName(personDetails.familyName)}
                    </td>
                  </tr>
                  <tr>
                    <th>إسم الأم الثلاثي</th>
                    <td>
                      {utils.translateName(personDetails?.motherName) || ''}
                      {personDetails?.motherFatherName
                        ? ` بنت ${utils.translateName(personDetails.motherFatherName)}`
                        : ''}
                      {personDetails?.motherGrandFatherName
                        ? ` بن ${utils.translateName(personDetails.motherGrandFatherName)}`
                        : ''}
                      {personDetails?.motherFamilyName 
                        ? ` ${utils.translateFamilyName(personDetails.motherFamilyName)}` 
                        : ''}
                    </td>
                  </tr>
                  <tr>
                    <th>الفرع</th>
                    <td>{personDetails.Branch}</td>
                  </tr>
                  <tr>
                    <th>سنة الولادة</th>
                    <td>{personDetails.age !== -1
                      ? `${new Date().getFullYear() - personDetails.age}`
                      : 'غير معروف'}
                    </td>
                  </tr>
                  <tr>
                    <th>العمر</th>
                    <td>
                      {personDetails?.lifeStatus === true && personDetails.age !== -1
                        ? personDetails.age
                        : '—'}
                    </td>
                  </tr>
                  <tr>
                    <th>سنة الوفاة</th>
                    <td>{personDetails?.YoD || '—'}</td>
                  </tr>
                  <tr>
                    <th>الجنس</th>
                    <td>{personDetails?.gender === 'Male' ? 'ذكر' : 'أنثى'}</td>
                  </tr>
                  <tr>
                  <th>الحالة الإجتماعية</th>
                  <td>
                    {personDetails?.lifeStatus === true
                      ? personDetails.maritalStatus === 'widowed'
                        ? personDetails.gender === 'Male'
                          ? 'أرمل'
                          : 'أرملة'
                        : personDetails.maritalStatus === 'married' || personDetails.maritalStatus === 'historical'
                        ? personDetails.gender === 'Male'
                          ? 'متزوج'
                          : 'متزوجة'
                        : personDetails.gender === 'Male'
                        ? 'عازب'
                        : 'عزباء'
                      : '—'}
                  </td>


                </tr>
                <tr>
                  <th>عدد الأبناء</th>
                  <td>
                    {personDetails?.childrenCount === 0
                      ? "لا أطفال"
                      : personDetails.childrenCount === 1
                      ? "طفل واحد (1)"
                      : personDetails.childrenCount === 2
                      ? "طفلان (2)"
                      : personDetails.childrenCount >= 3 && personDetails.childrenCount <= 10
                      ? `${personDetails.childrenCount} أطفال`
                      : `${personDetails.childrenCount} طفل`}
                  </td>

                </tr>
                <tr>
                  <th>عدد الإخوة</th>
                  <td>{personDetails?.siblingsCount === 0
                      ? "لا إخوة"
                      : personDetails.siblingsCount === 1
                      ? "أخ واحد (1)"
                      : personDetails.siblingsCount === 2
                      ? "أخوان (2)"
                      : personDetails.siblingsCount >= 3 && personDetails.siblingsCount <= 10
                      ? `${personDetails.siblingsCount} إخوة`
                      : `${personDetails.siblingsCount} أخـًا`}</td>
                </tr>
                <tr>
                  <th>بلاد السكنة أو العمل</th>
                  <td>
                    {personDetails?.lifeStatus === true
                      ? personDetails?.country !== null
                        ? utils.translateCountry(personDetails.country)
                        : 'تونس'
                      : '—'}
                  </td>

                </tr>
                <tr>
                  {personDetails.Notes}
                </tr>
                </tbody>
              </table>

            </div>
          )}
        </div>
      ) : (
        <div className="no-results"></div>
      )}
  <div>  
  </div>
      <div className='tipsFooter'>
        <p className="minor-tip">💡 يمكنك البحث باستخدام الاسم الكامل أو جزء منه فقط.</p>
        <p className="minor-tip">📛 تأكد من عدم وجود أخطاء إملائية في الأسماء المدخلة.</p>
        <p className="minor-tip">🔒 جميع المعلومات محفوظة ولا تُستخدم إلا لأغراض توثيق العائلة.</p>
        <p className="minor-tip">🔒 إذا أرّدت إخفاء بعض من معطياتك الشخصية ، عليك فقط التواصل معنا ، اننا نحترم خصوصيتك.</p>
        <p className="minor-tip">🤝 إذا لاحظت خطأ في المعلومات، ساعدنا بتحديثها عبر التواصل معنا.</p>
      </div>
    </div>
  );
};

export default SearchPage;

