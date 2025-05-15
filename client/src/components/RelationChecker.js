import React, { useEffect, useState } from 'react';
import Tree from 'react-d3-tree';
import '../styles/RelationChecker.css';
import * as utils from '../utils/utils';

const neo4jURI = process.env.REACT_APP_NEO4J_URI;
const neo4jUser = process.env.REACT_APP_NEO4J_USER;
const neo4jPassword = process.env.REACT_APP_NEO4J_PASSWORD;

const driver = require('neo4j-driver').driver(
    neo4jURI,
    require('neo4j-driver').auth.basic(neo4jUser, neo4jPassword)
);
const session = driver.session();

const RelationPage = () => {
  const [person1, setPerson1] = useState('');
  const [person2, setPerson2] = useState('');
  const [relationship, setRelationship] = useState('');
  const [duplicates, setDuplicates] = useState({ person1: [], person2: [] });
  const [error, setError] = useState(null);
  const [selectedPerson1, setSelectedPerson1] = useState('');
  const [selectedPerson2, setSelectedPerson2] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

  const fetchRelationship = async (e, customPerson1 = person1, customPerson2 = person2) => {
    if (e) e.preventDefault();

    console.log("🚀 fetchRelationship START");
    console.log("➡️ person1:", customPerson1);
    console.log("➡️ person2:", customPerson2);

    if (!customPerson1 || !customPerson2) {
      console.error("❌ One of the names is undefined or empty");
      setError(true);
      setRelationship({ relationshipDescription: 'أدخل اسمي الشخصين بشكل صحيح', relationshipScore: null });
      return;
    }

    setLoading(true);
    setError(false);
    setLoadingMessage("🔎 بداية البحث عن العلاقة...");

    try {
      const result = await getRelationship(customPerson1, customPerson2);

      console.log("✅ Result received:", result);

      if (result.error === 'non-unique-name') {
        setSelectedPerson1(null);
        setSelectedPerson2(null);
        setDuplicates(result.duplicates ?? { person1: [], person2: [] });
        setRelationship(result.message);
        return;
      }

      setDuplicates({ person1: [], person2: [] });
      setRelationship({
        relationshipDescription: result.relation,
        relationshipPerson1Details: result.person1 ?? null,
        relationshipPerson2Details: result.person2 ?? null,
        relationshipScore: result.score ?? null,
        relationshipLevels: result.levelsTuple ?? null,
        relationshipGenerationGap: result.generation ?? null,
        relationshipExplanationType: result.explanation?.type ?? null,
        relationshipExplanationDesc: result.explanation?.explanation ?? null,
        relationshipType: result.relationshipType ?? null,
        commonAncestor: result.ancestor ?? null,
        ancestorstreeData: result.treeData ?? null,
        person1ID: result.person1ID ?? null,
        person2ID: result.person2ID ?? null
      });
    } catch (error) {
      console.error('❌ Error fetching relationship:', error);
      setRelationship({ relationshipDescription: 'حدث خطأ أثناء البحث', relationshipScore: null });
      setError(true);
    } finally {
      console.log("🛑 fetchRelationship END");
      setLoading(false);
    }
  };
 
  const findRelationship = async (person1ID, person2ID, gender1, gender2, translatedName1, translatedName2, person1Matches, person2Matches) => {
    let relationshipType;
    let relation = '', score = 0;
    let explanation;
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
        explanation: "هؤلاء الشخصين مرتبطين من خلال أعمام أو أخوال الأب ، أو أجداد الأب و الأم."
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
    console.log(translatedName1, translatedName2);
    let marraigeRecord = await checkMarriage(person1ID, person2ID, gender1, gender2);
    if (marraigeRecord.areMarried === true){
      let relation = '';
      let score = 100;
      if (gender1 === 'Male'){
        relation = `${translatedName1} هو زوج ${translatedName2}`;
      }
      else{
        relation = `${translatedName1} هي زوجة ${translatedName2}`;
      }
      setLoading(false);
      console.log(relation);
      relationshipType = "Marriage";
      explanation = relationshipType[4];
      return {relation, score, relationshipType, explanation, person1: person1Matches[0], person2: person2Matches[0]}
    } 
    else {
      console.log("Checking relations");
      let relationRecord = await getAncestors(person1ID, person2ID);
      if (relationRecord === null){
        console.log("There's no common ancestor between these.");
        let relation = await getMarriageRelation(session, person1ID, person2ID, translatedName1, translatedName2, gender1, gender2);
        console.log(relation);
        if (relation){
          console.log("Relaition found.");
          relationshipType = "Marriage-related";
          explanation = relationshipType[3];
          return {relation, relationshipType, explanation, person1: person1Matches[0], person2: person2Matches[0]};
        }
        else {
          setError("لا يوجد اي قاسم مشترك أو علاقة مشتركة بين هاذين الشخصين.");
          setError(true);
          return 'لا توجد اي علاقة بين هاذين الشخصين';
        } 
      }
      else{
        const ancestorID = relationRecord.id;
        const ancestorName = relationRecord.name ? utils.translateName(relationRecord.name) : '';
        const ancestorLastName = relationRecord.lastName ? utils.translateFamilyName(relationRecord.lastName) : '';
        const ancestorFatherName = relationRecord.fatherName ? utils.translateName(relationRecord.fatherName) : '';
        const ancestorGrandFatherName = relationRecord.grandfatherName ? utils.translateName(relationRecord.grandfatherName) : '';
        const ancestorGender = relationRecord.gender;
        let levelFromP1, levelFromP2, pathFromAncestorToP1, pathFromAncestorToP2;
        let spouseOfAncestor = relationRecord.spouseOfAncestor;
        const ancestor = {ancestorID, 
                        ancestorName, ancestorFatherName, ancestorGrandFatherName, ancestorLastName, ancestorGender};
        console.log(ancestor);
        ({
          levelFromP1, 
          levelFromP2,
          spouseOfAncestor,
          pathFromAncestorToP1, 
          pathFromAncestorToP2 
        } = relationRecord);
        let pathToP1 = pathFromAncestorToP1;
        let pathToP2 = pathFromAncestorToP2;
        if ((spouseOfAncestor !== null) && (ancestorID !== person1ID) && (ancestorID !== person2ID)) {
            pathToP1[0] = {
                id: spouseOfAncestor.id,
                name: spouseOfAncestor.name,
                lastName: spouseOfAncestor.lastName,
                gender: spouseOfAncestor.gender
            };
            pathToP2[0] = {
                id: spouseOfAncestor.id,
                name: spouseOfAncestor.name,
                lastName: spouseOfAncestor.lastName,
                gender: spouseOfAncestor.gender
            };
        }
        
        const treeData = utils.mergePaths(pathToP1, pathToP2);
        console.log(pathFromAncestorToP1.reverse().map(a => a.name).join(" ben "));
        console.log(pathFromAncestorToP2.reverse().map(a => a.name).join(" ben "));
    
        var p1Level = levelFromP1;
        var p2Level = levelFromP2;
        const gender1 = pathToP1[0].gender;
        const gender2 = pathToP2[0].gender;
        
        console.log(`Level: (${p1Level}, ${p2Level})`);
        setLoadingMessage("جاري البحث عن العلاقة بين الشخصين");
        /// SIMPLE RELATIONSHIP
        if (p1Level === 0 && p2Level === 1) {
          if (gender1 === 'Male'){
            relation = `${translatedName1} هو والد ${translatedName2}`;
          }
          else{
            relation = `${translatedName1} هي والدة ${translatedName2}`;
          }
          score = 100;
          explanation = relationshipType[0];
        }
    
        else if (p1Level === 1 && p2Level === 0) {
          if (gender1 === 'Male'){
            relation = `${translatedName1} هو ابن ${translatedName2}`;
          }
          else{
            relation = `${translatedName1} هي إبنة ${translatedName2}`;
          }
          score = 100;
          explanation = relationshipExplanation[0];
        } 
        
        else if (p1Level === 2 && p2Level === 0) {
          if (gender1 === 'Male'){
            relation = `${translatedName1} هو حفيد ${translatedName2}`;
          }
          else{
            relation = `${translatedName1} هي حفيدة ${translatedName2}`;
          }
          score = 90;
          explanation = relationshipExplanation[0];
        }

        else if (p1Level === 0 && p2Level === 2) {
          if (gender1 === 'Male'){
            relation = `${translatedName1} هو جدّ ${translatedName2}`;
          }
          else{
            relation = `${translatedName1} هي جدّة ${translatedName2}`;
          }
          score = 90;
          explanation = relationshipExplanation[0];
        }
    
        else if (p1Level === 3 && p2Level === 0) {
          if (gender1 === 'Male'){
            relation = `${translatedName1} هو إبن حفيد ${translatedName2}`;
          }
          else{
            relation = `${translatedName1} هي إبنة حفيدة ${translatedName2}`;
          }
          score = 75;
          explanation = relationshipExplanation[1];
        }
    
        else if (p1Level === 0 && p2Level === 3) {
          if (gender1 === 'Male'){
            relation = `${translatedName1} و جد والد ${translatedName2}`;
          }
          else{
            relation = `${translatedName1} هي جدة والدة ${translatedName2}`;
          }
          score = 80;
          explanation = relationshipExplanation[0];
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
          score = 70;
          explanation = relationshipExplanation[2];
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
          score = 70;
          explanation = relationshipExplanation[2];
        }

        else if (p1Level === 4 && p2Level === 1) {
          const p1GreatAncestorGender = pathToP1[2].gender;
          const p1GreatGrandAncestorGender = pathToP1[3].gender;
          
          if (gender1 === 'Male'){
              if (p1GreatAncestorGender === 'Male') {
                if (p1GreatGrandAncestorGender === 'Male') {
                  relation = `${translatedName1} هو حفيد إبن أخ ${translatedName2}`;
                  score = 85;
                } else {
                  relation = `${translatedName1} هو حفيد إبن أخت ${translatedName2}`;
                  score = 80;
                }
              } 
              else {
                if (p1GreatGrandAncestorGender === 'Male') {
                  relation = `${translatedName1} هو حفيد إبنة أخ ${translatedName2}`;
                  score = 85;
                } else {
                  relation = `${translatedName1} هو حفيد إبنة أخت ${translatedName2}`;
                  score = 80;
                }
              }
          } 
          else {
            if (p1GreatAncestorGender === 'Male') {
                if (p1GreatGrandAncestorGender === 'Male') {
                  relation = `${translatedName1} هي حفيدة إبن أخ ${translatedName2}`;
                  score = 85;
                } else {
                  relation = `${translatedName1} هي حفيدة إبن أخت ${translatedName2}`;
                  score = 80;
                }
              } 
              else {
                if (p1GreatGrandAncestorGender === 'Male') {
                  relation = `${translatedName1} هي حفيدة إبنة أخ ${translatedName2}`;
                  score = 85;
                } else {
                  relation = `${translatedName1} هي حفيدة إبنة أخت ${translatedName2}`;
                  score = 80;
                }
              }
          }
          explanation = relationshipExplanation[2];
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
          explanation = relationshipExplanation[0];
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
          }
          else{
            if (p1AncestorGender === 'Male'){
              relation = `${translatedName1} هي ابنة أخ ${translatedName2}`;
            }
            else{
              relation = `${translatedName1} هي ابنة أخت ${translatedName2}`;
            }
            
          }
          score = 93;
          explanation = relationshipExplanation[1];
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
          explanation = relationshipExplanation[1];
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
          } 
          else{
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
          explanation = relationshipExplanation[2];
        }

        else if (p1Level === 1 && p2Level === 4) {
          const p2AncestorGender = pathToP2[1].gender;
          const p2GreatAncestorGender = pathToP2[2].gender;
          const p2GreatGrandAncestorGender = pathToP2[3].gender;
          
          if (gender1 === 'Male') {
            if (p2AncestorGender === 'Male') {
              if (p2GreatAncestorGender === 'Male') {
                if (p2GreatGrandAncestorGender === 'Male') {
                  relation = `${translatedName1} هو عم جد والد ${translatedName2}`;
                  score = 85;
                } else {
                  relation = `${translatedName1} هو عم جد والد ${translatedName2}`;
                  score = 80;
                }
              } else {
                relation = `${translatedName1} هو خال جد والد ${translatedName2}`;
                score = 75;
              }
            } else {
              if (p2GreatAncestorGender === 'Male') {
                relation = `${translatedName1} هو عم جد والدة ${translatedName2}`;
                score = 85;
              } else {
                relation = `${translatedName1} هو خال جد والدة ${translatedName2}`;
                score = 70;
              }
            }
          } else {
            if (p2AncestorGender === 'Male') {
              if (p2GreatAncestorGender === 'Male') {
                if (p2GreatGrandAncestorGender === 'Male') {
                  relation = `${translatedName1} هي عمة جد والد ${translatedName2}`;
                  score = 85;
                } else {
                  relation = `${translatedName1} هي عمة جد والد ${translatedName2}`;
                  score = 80;
                }
              } else {
                relation = `${translatedName1} هي خالة جد والد ${translatedName2}`;
                score = 75;
              }
            } else {
              if (p2GreatAncestorGender === 'Male') {
                relation = `${translatedName1} هي عمة جد والدة ${translatedName2}`;
                score = 85;
              } else {
                relation = `${translatedName1} هي خالة جد والدة ${translatedName2}`;
                score = 70;
              }
            }
          }
          explanation = relationshipExplanation[2];
        }
        
        else if (p1Level === 2 && p2Level === 4) {
          const p2AncestorGender = pathToP2[1].gender;
          const p2GreatAncestorGender = pathToP2[2].gender; 

          if (gender1 === 'Male') {
            if (p2AncestorGender === 'Male') {
              if (p2GreatAncestorGender === 'Male') {
                relation = `${translatedName1} هو جد الأول وجد جد ${translatedName2} إخوة`;
                score = 90;
              } else {
                relation = `${translatedName1} هو جد الأول وجدة جد ${translatedName2} إخوة`;
                score = 70;
              }
            } else {
              if (p2GreatAncestorGender === 'Male') {
                relation = `${translatedName1} هو جد الأول وجدة جد ${translatedName2} إخوة`;
                score = 70;
              } else {
                relation = `${translatedName1} هو جد الأول وجدة جد ${translatedName2} إخوة`;
                score = 70;
              }
            }
          } 
          else {
            if (p2AncestorGender === 'Male') {
              if (p2GreatAncestorGender === 'Male') {
                relation = `${translatedName1} هي جدة الأول وجد جد ${translatedName2} إخوة`;
                score = 70;
              } else {
                relation = `${translatedName1} هي جدة الأول وجدة جد ${translatedName2} إخوة`;
                score = 70;
              }
            } else {
              if (p2GreatAncestorGender === 'Male') {
                relation = `${translatedName1} هي جدة الأول وجدة جد ${translatedName2} إخوة`;
                score = 70;
              } else {
                relation = `${translatedName1} هي جدة الأول وجدة جد ${translatedName2} إخوة`;
                score = 70;
              }
            }
          }
          explanation = relationshipExplanation[2];
        }

        else if (p1Level === 3 && p2Level === 1){
          const p1GreatAncestorGender = pathToP1[2].gender;
          if (gender1 === 'Male'){
              if (p1GreatAncestorGender === 'Male'){
                relation = `${translatedName1} هو حفيد اخ ${translatedName2}`;
                score = 65;
              }
              else {
                relation = `${translatedName1} هو حفيد اخت ${translatedName2}`;
                score = 65;
              }
          } 
          else{
              if (p1GreatAncestorGender === 'Male'){
                relation = `${translatedName1} هي حفيدة اخ ${translatedName2}`;
                score = 65;
              }
              else {
                relation = `${translatedName1} هي حفيدة اخت ${translatedName2}`;
                score = 65;
              }
          }
          explanation = relationshipExplanation[2];
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
          explanation = relationshipExplanation[1];
        }
    
        else if (p1Level === 2 && p2Level === 3) {         
    
          const p1AncestorGender = pathToP1[1].gender;
          const p2AncestorGender = pathToP2[1].gender;

          if (gender1 === 'Male') { 
            if (p1AncestorGender === 'Male') {
              if (p2AncestorGender === 'Male') {
                relation = `${translatedName1} هو إبن عم والد ${translatedName2}`;
                score = 80;
              } 
              else { 
                relation = `${translatedName1} هو إبن خال والدة ${translatedName2}`;
                score = 78;
              }
            } 
            else {  // mother's side
              if (p2AncestorGender === 'Male') {  // mother's brother's son
                relation = `${translatedName1} هو إبن عم والد ${translatedName2}.`;
                score = 74;
              } 
              else {  // mother's brother's daughter
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
          explanation = relationshipExplanation[2];
        }
        
        else if (p1Level === 4 && p2Level === 2) {
          const p1GreatAncestorGender = pathToP1[3].gender;  // P1 Great Ancestor
          const p2AncestorGender = pathToP2[1].gender;  // P2 Ancestor
          if (p1GreatAncestorGender){
                if (p2AncestorGender === 'Male') {
                    if (p1GreatAncestorGender === 'Male') {
                        relation = `جد ${translatedName1} هو إبن عم ${translatedName2}`;
                        score = 65;
                    } else {
                        relation = `جد ${translatedName1} هو إبن عمّة ${translatedName2}`;
                        score = 65;
                    }
                } else {
                    if (p1GreatAncestorGender === 'Male') {
                        relation = `جد ${translatedName1} هو إبن خال ${translatedName2}`;
                        score = 65;
                    } else {
                        relation = `جد ${translatedName1} هو إبن خالة ${translatedName2}`;
                        score = 65;
                    }
                }
          } 
          else {
              if (p2AncestorGender === 'Male') {
                  if (p1GreatAncestorGender === 'Male') {
                      relation = `جدة ${translatedName1} هي إبنة عم ${translatedName2}`;
                      score = 65;
                  } else {
                      relation = `جدة ${translatedName1} هي إبنة عمّة ${translatedName2}`;
                      score = 65;
                  }
              } else {
                  if (p1GreatAncestorGender === 'Male') {
                      relation = `جدة ${translatedName1} هي إبنة خال ${translatedName2}`;
                      score = 65;
                  } else {
                      relation = `جدة ${translatedName1} هي إبنة خالة ${translatedName2}`;
                      score = 65;
                  }
              }
          }
          explanation = relationshipExplanation[2];
        }
        
        else if (p1Level === 3 && p2Level === 2) {          
          const p1AncestorGender = pathToP1[1].gender;
          const p2AncestorGender = pathToP2[1].gender;
          const p1GreatAncestorGender = pathToP1[2].gender;

          if (p1AncestorGender === 'Male') { 
            if (p2AncestorGender === 'Male') {
              if (p1GreatAncestorGender === 'Male'){
                relation = `والد ${translatedName1} هو إبن عم ${translatedName2}`;
              }
              else{
                relation = `والد ${translatedName1} هو إبن عمة ${translatedName2}`;
              }
            } else { 
              if (p1GreatAncestorGender === 'Male'){
                relation = `والد ${translatedName1} هو إبن خال ${translatedName2}`;
              }
              else{
                relation = `والد ${translatedName1} هو إبن خالة ${translatedName2}`;
              }
            }
          } 
          else {  // mother's side
            if (p2AncestorGender === 'Male') {  // mother's brother's son
              if (p1GreatAncestorGender === 'Male'){
                relation = `والدة ${translatedName1} هي إبنة عم ${translatedName2}`;
              }
              else{
                relation = `والدة ${translatedName1} هي إبنة عمة ${translatedName2}`;
              }
              
            } else {
              if (p1GreatAncestorGender === 'Male'){
                relation = `والدة ${translatedName1} هي إبنة خال ${translatedName2}`;
              }
              else{
                relation = `والدة ${translatedName1} هي إبنة خالة ${translatedName2}`;
              }
            }
          }
          score = 60;
          explanation = relationshipExplanation[2];
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
          explanation = relationshipExplanation[2];
        }

        else if (p1Level === 4 && p2Level === 3) {
          const p1AncestorGender = pathToP2[0].gender;  // First ancestor of p2
          const p2GreatAncestorGender = pathToP2[1].gender;  // Second ancestor of p2
          const p1GreatGreatAncestorGender = pathToP2[2].gender;  // Third ancestor of p2

          if (p1GreatGreatAncestorGender === 'Male') {
              // Case when p1 is male
              if (p1AncestorGender === 'Male') {
                  if (p2GreatAncestorGender === 'Male') {
                      relation = `جد اب ${translatedName1} و جد ${translatedName2} اخوة`;
                      score = 75;
                  } else {
                      relation = `جد اب ${translatedName1} و جدة ${translatedName2} اخوة`;
                      score = 75;
                  }
              } else {
                  if (p2GreatAncestorGender === 'Male') {
                      relation = `جد أم ${translatedName1} و جد ${translatedName2} اخوة`;
                      score = 75;
                  } else {
                      relation = `جد أم ${translatedName1} و جدة ${translatedName2} اخوة`;
                      score = 75;
                  }
              }
          } 
          else {
              // Case when p1 is female
              if (p1AncestorGender === 'Male') {
                  if (p2GreatAncestorGender === 'Male') {
                      relation = `جدة اب ${translatedName1} و جد ${translatedName2} اخوة`;
                      score = 85;
                  } else {
                      relation = `جدة اب ${translatedName1} و جدة ${translatedName2} اخوة`;
                      score = 80;
                  }
              } else {
                  if (p2GreatAncestorGender === 'Male') {
                      relation = `جدة أم ${translatedName1} و جد ${translatedName2} اخوة`;
                      score = 75;
                  } else {
                      relation = `جدة أم ${translatedName1} و جدة ${translatedName2} اخوة`;
                      score = 70;
                  }
              }
          }
        explanation = relationshipExplanation[2];
        }

        else if (p1Level === 3 && p2Level === 4) {
          const p2AncestorGender = pathToP2[0].gender;  // First ancestor of p2
          const p1GreatAncestorGender = pathToP2[1].gender;  // Second ancestor of p2
          const p2GreatGreatAncestorGender = pathToP2[2].gender;  // Third ancestor of p2

          if (p1GreatAncestorGender === 'Male') {
              // Case when p1 is male
              if (p2AncestorGender === 'Male') {
                  if (p2GreatGreatAncestorGender === 'Male') {
                      relation = `جد ${translatedName1} و جد أب ${translatedName2} اخوة`;
                      score = 85;
                  } else {
                      relation = `جد ${translatedName1} و جدة أب ${translatedName2} اخوة`;
                      score = 80;
                  }
              } else {
                  if (p2GreatGreatAncestorGender === 'Male') {
                      relation = `جد ${translatedName1} و جد أم ${translatedName2} اخوة`;
                      score = 75;
                  } else {
                      relation = `جد ${translatedName1} و جدة أم ${translatedName2} اخوة`;
                      score = 70;
                  }
              }
          } 
          else {
              // Case when p1 is female
              if (p2AncestorGender === 'Male') {
                  if (p2GreatGreatAncestorGender === 'Male') {
                      relation = `جدة ${translatedName1} و جد أب ${translatedName2} اخوة`;
                      score = 85;
                  } else {
                      relation = `جدة ${translatedName1} و جدة أب ${translatedName2} أخوات`;
                      score = 80;
                  }
              } else {
                  if (p2GreatGreatAncestorGender === 'Male') {
                      relation = `جدة ${translatedName1} و جد أم ${translatedName2} اخوة`;
                      score = 75;
                  } else {
                      relation = `جدة ${translatedName1} و جدة أم ${translatedName2} أخوات`;
                      score = 70;
                  }
              }
          }
          explanation = relationshipExplanation[2];
        }
        
        else if (p1Level === 4 && p2Level === 4) {
          const p1AncestorGender = pathToP2[1].gender;
          const p2AncestorGender = pathToP1[1].gender;
          const p1GreatGreatAncestorGender = pathToP1[3].gender;
          const p2GreatGreatAncestorGender = pathToP2[3].gender;

          if (p1GreatGreatAncestorGender === 'Male') {
            if (p1AncestorGender === 'Male') {
                if (p2AncestorGender === 'Male') {
                  if (p2GreatGreatAncestorGender === 'Male'){
                    relation = `جد أب ${translatedName1} و جد أب ${translatedName2} اخوة`;
                    score = 85;
                  } else {
                      relation = `جد أب ${translatedName1} و جدة أب ${translatedName2} اخوة`;
                      score = 80;
                  }
                } 
                else{
                  if (p2GreatGreatAncestorGender === 'Male'){
                    relation = `جد أم ${translatedName1} و جد أم ${translatedName2} اخوة`;
                    score = 85;
                  } else {
                      relation = `جد أم ${translatedName1} و جدة أم ${translatedName2} اخوة`;
                      score = 80;
                  }
                } 
            } 
            else {
              if (p2AncestorGender === 'Male') {
                if (p2GreatGreatAncestorGender === 'Male'){
                  relation = `جد أب ${translatedName1} و جد أب ${translatedName2} اخوة`;
                  score = 85;
                } else {
                    relation = `جد أب ${translatedName1} و جدة أب ${translatedName2} اخوة`;
                    score = 80;
                }
              } 
              else{
                if (p2GreatGreatAncestorGender === 'Male'){
                  relation = `جد أم ${translatedName1} و جد أم ${translatedName2} اخوة`;
                  score = 85;
                } 
                else {
                  relation = `جد أم ${translatedName1} و جدة أم ${translatedName2} اخوة`;
                  score = 80;
              }
            }
        }
    } 
    else {
        if (p1AncestorGender === 'Male') {
            if (p2AncestorGender === 'Male') {
              if (p2GreatGreatAncestorGender === 'Male'){
                relation = `جدة أب ${translatedName1} و جد أب ${translatedName2} اخوة`;
                score = 85;
              } else {
                  relation = `جدة أب ${translatedName1} و جدة أب ${translatedName2} اخوة`;
                  score = 80;
              }
            } else{
              if (p2GreatGreatAncestorGender === 'Male'){
                relation = `جدة أم ${translatedName1} و جد أم ${translatedName2} اخوة`;
                score = 85;
              } else {
                  relation = `جدة أم ${translatedName1} و جدة أم ${translatedName2} اخوة`;
                  score = 80;
              }
            } 
        } else {
            if (p2AncestorGender === 'Male') {
              if (p2GreatGreatAncestorGender === 'Male'){
                relation = `جدة أب ${translatedName1} و جد أب ${translatedName2} اخوة`;
                score = 85;
              } else {
                  relation = `جدة أب ${translatedName1} و جدة أب ${translatedName2} اخوة`;
                  score = 80;
              }
            } else{
              if (p2GreatGreatAncestorGender === 'Male'){
                relation = `جدة أم ${translatedName1} و جد أم ${translatedName2} اخوة`;
                score = 85;
              } else {
                  relation = `جدة أم ${translatedName1} و جدة أم ${translatedName2} اخوة`;
                  score = 80;
                }
              }
            }
          }
          explanation = relationshipExplanation[2];
        }
          
        else if (p1Level === 5 && p2Level === 4){
          const p1AncestorGender = pathToP1[1].gender;
          const p1thirdGreatAncestor = pathToP2[4].gender;
          const p1SecondGreatAncestorGender = pathToP1[3].gender;
          const p2SecondGreatAncestorGender = pathToP2[3].gender;
          const p2GreatAncestorGender = pathFromAncestorToP2[2].gender;
          if (p1AncestorGender === 'Male'){
            if (p1thirdGreatAncestor === 'Male' && p2SecondGreatAncestorGender === 'Male'){
              if (p2GreatAncestorGender == 'Male'){
                if (p1SecondGreatAncestorGender === 'Male'){
                  relation = `جد أب ${translatedName1} و جد ${translatedName2} أولاد عم`;
                }
                else{
                  relation = `جدة أب ${translatedName1} و جد ${translatedName2} أولاد عم`;
                }
              }
              else{
                if (p1SecondGreatAncestorGender === 'Male'){
                  relation = `جد أب ${translatedName1} و جدة ${translatedName2} أولاد عم`;
                }
                else{
                  relation = `جدة أب ${translatedName1} و جدة ${translatedName2} أولاد عم`;
                }
              }
            } 
            else{
              if (p1SecondGreatAncestorGender === 'Male'){
              relation = `جد أب ${translatedName1} و جد ${translatedName2} أولاد الخال/العم`;
              }
              else{
                relation = `جدة أب ${translatedName1} و جد ${translatedName2} أولاد الخالة/العمة`;
              }
            }
          }
          else{
            if (p1thirdGreatAncestor === 'Male' && p2SecondGreatAncestorGender === 'Male'){
              if (p1SecondGreatAncestorGender === 'Male'){
              relation = `جد أم ${translatedName1} و جد ${translatedName2} أولاد عم`;
              }
              else{
                relation = `جدة أم ${translatedName1} و جد ${translatedName2} أولاد عم`;
              }
            } 
            else{
              if (p1SecondGreatAncestorGender === 'Male'){
              relation = `جد أم ${translatedName1} و جد ${translatedName2} أولاد الخال/العم`;
              }
              else{
                relation = `جدة أم ${translatedName1} و جد ${translatedName2} أولاد الخالة/العمة`;
              }
            }
          }
          score = 80;
        }

        else if (p1Level === 6 && p1Level === 6){
          relation = 'هذان الشخصان يشتركان في الجد الخامس';
        }
        else {
          setLoading(false);
          console.log('No direct relation found.');
          relation = await getMarriageRelation(session, person1ID, person2ID, translatedName1, translatedName2, gender1, gender2);
          relationshipType = "Marriage-related";
          return {  relation, score, 
                    generation:Math.abs(p1Level-p2Level), 
                    levelsTuple: {levelFromP1, levelFromP2},
                    explanation,
                    ancestor,
                    relationshipType,
                    treeData,
                    person1ID,
                    person2ID,
                    person1: person1Matches[0], person2: person2Matches[0]};
        }
        if (relation != ''){
            setLoading(false);
            console.log(relation);
            relationshipType = "Blood";
            return {relation, score, 
                    generation:Math.abs(p1Level-p2Level), 
                    levelsTuple: {levelFromP1, levelFromP2},
                    explanation,
                    ancestor,
                    relationshipType,
                    treeData,
                    person1ID,
                    person2ID,
                    person1: person1Matches[0], person2: person2Matches[0]};
          }
      }
    }
  }

  const checkMarriage = async (person1ID, person2ID, gender1, gender2) => {
    if (gender1 === gender2) {return {areMarried : false}}
        setLoadingMessage("جاري البحث عن علاقة زواج");
        const result = await session.run(`
          MATCH (Husband:Person)-[:HUSBAND_OF]->(Wife:Person)
          MATCH (Wife)-[:WIFE_OF]->(Husband)
          WHERE (id(Wife) = $person1ID AND id(Husband) = $person2ID) 
            OR (id(Wife) = $person2ID AND id(Husband) = $person1ID)
          RETURN Husband AS P1, Wife AS P2
        `, { person1ID, person2ID });

        if (result.records.length === 0) {
          return { areMarried: false };
        }
        const record = result.records[0];
        const P1 = record.get("P1").properties;
        const P2 = record.get("P2").properties;
        return record.length === 0 ? {areMarried : false} : {areMarried : true, P1, P2};
  };

  const getMarriageRelation = async (session, person1ID, person2ID, translatedName1, translatedName2, gender1, gender2) => {

    const ownFamilyQuery = `
      MATCH (P:Person)
      WHERE id(P) = $personId

      // Person's Father and Mother
      OPTIONAL MATCH (Father:Person)-[:FATHER_OF]->(P)
      OPTIONAL MATCH (Mother:Person)-[:MOTHER_OF]->(P)

      // Person's Siblings
      OPTIONAL MATCH (Father)-[:FATHER_OF]->(Sibling:Person)
      WHERE Sibling <> P

      // Spouses of Siblings
      OPTIONAL MATCH (Sibling)-[:HUSBAND_OF|:WIFE_OF]->(SiblingSpouse:Person)

      // Person's Children
      OPTIONAL MATCH (P)-[:MOTHER_OF|:FATHER_OF]->(Child:Person)

      // Spouses of Children
      OPTIONAL MATCH (Child)-[:HUSBAND_OF|:WIFE_OF]->(ChildSpouse:Person)

      RETURN 
        id(Father) AS fatherId,
        id(Mother) AS motherId,
        collect(DISTINCT id(Sibling)) AS siblingIds,
        collect(DISTINCT id(SiblingSpouse)) AS siblingSpouseIds,
        collect(DISTINCT id(Child)) AS childIds,
        collect(DISTINCT id(ChildSpouse)) AS childSpouseIds
    `;

    const ownResult = await session.run(ownFamilyQuery, { personId: person1ID });
    const ownRecord = ownResult.records[0];

    const fatherId = ownRecord.get("fatherId")?.toNumber() ?? null;
    const motherId = ownRecord.get("motherId")?.toNumber() ?? null;
    const siblingIds = (ownRecord.get("siblingIds") ?? []).map(id => id.toNumber());
    const siblingSpouseIds = (ownRecord.get("siblingSpouseIds") ?? []).map(id => id.toNumber());
    const childIds = (ownRecord.get("childIds") ?? []).map(id => id.toNumber());
    const fchildrenSpouseIds = (ownRecord.get("childSpouseIds") ?? []).map(id => id.toNumber());

    console.log('👨‍👩‍👧 Own Family:');
    console.log('Father ID:', fatherId);
    console.log('Mother ID:', motherId);
    console.log('Sibling IDs:', siblingIds);
    console.log('Sibling Spouse IDs:', siblingSpouseIds);
    console.log('Childs IDs:', childIds);
    console.log('Children Spouse IDs:', fchildrenSpouseIds);

    // Step 2: Spouse's family
    const spouseFamilyQuery = `
      MATCH (P:Person)-[:HUSBAND_OF|:WIFE_OF]->(Spouse:Person)
      WHERE id(P) = $personId

      OPTIONAL MATCH (SFather:Person)-[:FATHER_OF]->(Spouse)
      OPTIONAL MATCH (SMother:Person)-[:MOTHER_OF]->(Spouse)
      OPTIONAL MATCH (SFather)-[:FATHER_OF]->(SSibling:Person)
      WHERE SSibling <> Spouse

      OPTIONAL MATCH (SSibling)-[:HUSBAND_OF|:WIFE_OF]->(SSiblingSpouse:Person)

      // Get children of the spouse
      OPTIONAL MATCH (Spouse)-[:MOTHER_OF|:FATHER_OF]->(Child:Person)
      OPTIONAL MATCH (Child)-[:HUSBAND_OF|:WIFE_OF]->(ChildSpouse:Person)

      RETURN 
        id(SFather) AS sFatherId,
        id(SMother) AS sMotherId,
        collect(DISTINCT id(SSibling)) AS sSiblingIds,
        collect(DISTINCT id(SSiblingSpouse)) AS sSiblingSpouseIds,
        collect(DISTINCT id(Child)) AS childIds,
        collect(DISTINCT id(ChildSpouse)) AS childSpouseIds
    `;

    const spouseResult = await session.run(spouseFamilyQuery, { personId: person1ID });
    const spouseRecord = spouseResult.records[0];

    const sFatherId = spouseRecord?.get("sFatherId")?.toNumber() ?? null;
    const sMotherId = spouseRecord?.get("sMotherId")?.toNumber() ?? null;
    const sSiblingIds = (spouseRecord?.get("sSiblingIds") ?? []).map(id => id.toNumber());
    const sSiblingSpouseIds = (spouseRecord?.get("sSiblingSpouseIds") ?? []).map(id => id.toNumber());
    const childrenSpouseIds = (spouseRecord?.get("childSpouseIds") ?? []).map(id => id.toNumber());

    console.log('🧑‍🤝‍🧑 Spouse Family:');
    console.log('Spouse Father ID:', sFatherId);
    console.log('Spouse Mother ID:', sMotherId);
    console.log('Spouse Sibling IDs:', sSiblingIds);
    console.log('Spouse Sibling Spouse IDs:', sSiblingSpouseIds);
    console.log('Children Spouse IDs:', childrenSpouseIds);

    // Step 3: Matching
    const match = (id) => {
      return id !== null && id === person2ID;
    };

    const isIn = (list) => {
      const result = list.some(id => id === person2ID);
      return result;
    };


    // Sibling check
    if (isIn(sSiblingIds)) {
      console.log('✅ Match: Sibling');
      if (gender1 === 'Male') {
        return `${translatedName1} هو زوج اخت ${translatedName2}`;
      } else {
        return `${translatedName1} هي زوجة اخ ${translatedName2}`;
      }
    }

    // Sibling Spouse check
    if (isIn(siblingSpouseIds)) {
      console.log('✅ Match: Spouse Siblings');
      // Male person with male sibling-in-law (spouse of the sibling)
      if (gender1 === 'Male') {
        if(gender2 === 'Male'){
          return `${translatedName1} هو اخ زوجة ${translatedName2}`;
        }
        else{
          return `${translatedName1} هو اخ زوج ${translatedName2}`;
        }
      } else {
        // Female person with female sibling-in-law (spouse of the sibling)
        if(gender2 === 'Male'){
        return `${translatedName1} هي اخت زوج ${translatedName2}`;
        }
        else{
          return `${translatedName1} هو اخ زوجة ${translatedName2}`;
        }
      }
    }

    // Children Spouses check
    if (isIn(fchildrenSpouseIds)) {
      console.log('✅ Match: Children Spouses');
      if (gender1 === 'Male') {
        return `${translatedName1} هو أب زوجة ${translatedName2}`;
      } else {
        return `${translatedName1} هي أم زوجة ${translatedName2}`;
      }
    }

    // Further check for Children Spouses (with childrenSpouseIds mapping and match)
    if (match(sFatherId) || match(sMotherId)) {
      console.log('✅ Match: Children Spouses (extended)');
      if (gender1 === 'Male') {
        console.log(`${translatedName1} هو زوج ابنة ${translatedName2}`);
        return `${translatedName1} هو زوج ابنة ${translatedName2}`;
      } else {
        console.log(`${translatedName1} هي زوجة ابن ${translatedName2} | ${translatedName1} هي كنة ${translatedName2}`);
        return `${translatedName1} هي زوجة ابن ${translatedName2} | ${translatedName1} هي كنة ${translatedName2}`;
      }
    }
    
    return "لا توجد علاقة واضحة";
  }

  const getAncestors = async (person1ID, person2ID) => {
        setLoadingMessage("جاري البحث عن الأجداد المشتركة");
        const result = await session.run(`
          MATCH path1 = (common:Person)-[:FATHER_OF|MOTHER_OF*0..12]->(p1:Person)
          WHERE id(p1) = $person1ID

          MATCH path2 = (common)-[:FATHER_OF|MOTHER_OF*0..12]->(p2:Person)
          WHERE id(p2) = $person2ID
            AND id(p1) <> id(p2)

          WITH common, path1, path2, length(path1) AS level1, length(path2) AS level2

          // Prioritize father ancestors by explicitly matching FATHER_OF first, then MOTHER_OF
          OPTIONAL MATCH (cGF:Person)-[:FATHER_OF]->(cF:Person)-[:FATHER_OF]->(common)

          // Check if the common ancestor is married and get the husband if married
          OPTIONAL MATCH (common)-[:WIFE_OF]->(husband:Person)

          // Include spouse information
          WITH common, cF, cGF, husband, path1, path2, level1, level2

          ORDER BY (level1 + level2) ASC
          LIMIT 1

          RETURN 
            // If common ancestor is female and married, return the husband's name
            common.name AS commonAncestorName,
            cF.name AS commonAncestorFatherName,
            cGF.name AS commonAncestorGrandFatherName,
            common.lastName AS commonAncestorLastName,
            id(common) AS commonAncestorID,

            common.gender AS commonAncestorGender,
            level1 AS generationsFromP1,
            level2 AS generationsFromP2,

            // Include spouse information if married
            CASE 
              WHEN husband IS NOT NULL THEN { id: id(husband), name: husband.name, lastName: husband.lastName, gender: husband.gender }
              ELSE null
            END AS spouseOfAncestor,

            [n IN nodes(path1) | { id: id(n), name: n.name, lastName: n.lastName, gender: n.gender }] AS pathToP1,
            [n IN nodes(path2) | { id: id(n), name: n.name, lastName: n.lastName, gender: n.gender }] AS pathToP2


        `, { person1ID, person2ID });

        const record = result.records[0];
        if (result.records.length === 0){
            return null;
        }
        return {
            id: record.get('commonAncestorID').toNumber(),
            name: record.get('commonAncestorName'),
            lastName: record.get('commonAncestorLastName'),
            fatherName: record.get('commonAncestorFatherName'),
            grandfatherName: record.get('commonAncestorGrandFatherName'),
            gender: record.get('commonAncestorGender'),
            spouseOfAncestor: record.get('spouseOfAncestor'),
            levelFromP1: record.get('generationsFromP1').toNumber(),
            levelFromP2: record.get('generationsFromP2').toNumber(),
            pathFromAncestorToP1: record.get('pathToP1'),
            pathFromAncestorToP2: record.get('pathToP2')
        };
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
                child.lastName AS familyName,
                child.gender AS gender,
                child.YoB AS YoB,
                child.YoD AS YoD
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
                    child.lastName AS familyName,
                    child.gender AS gender,
                    child.YoB AS YoB,
                    child.YoD AS YoD
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
              child.lastName AS familyName,
              child.gender AS gender,
              child.YoB AS YoB,
              child.YoD AS YoD
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
                    child.lastName AS familyName,
                    child.gender AS gender,
                    child.YoB AS YoB,
                    child.YoD AS YoD
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
            child.lastName AS familyName,
            child.gender AS gender,
            child.YoB AS YoB,
            child.YoD AS YoD
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
              child.lastName AS familyName,
              child.gender AS gender,
              child.YoB AS YoB,
              child.YoD AS YoD
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
        gender: record.get('gender'),
        name: record.get('childName'),
        father: record.get('fatherName') || "",
        grandfather: record.get('grandfatherName') || "",
        lastName: record.get('familyName') || "",
        YoB: record.get("YoB") || -1,
        YoD: record.get("YoD") || -1
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
    let gender1, gender2;
    const { personName: person1Name, fatherName: person1FatherName, grandfatherName: person1GrandfatherName, familyName: person1LastName } = utils.splitName(person1FullName);
    const { personName: person2Name, fatherName: person2FatherName, grandfatherName: person2GrandfatherName, familyName: person2LastName } = utils.splitName(person2FullName);
    let translatedPerson1Name = isArabic(person1Name) ? utils.translateName(person1Name, false) : person1Name;
    let translatedPerson1FatherName = isArabic(person1FatherName) ? utils.translateName(person1FatherName, false) : person1FatherName;
    let translatedPerson1GrandfatherName = isArabic(person1GrandfatherName) ? utils.translateName(person1GrandfatherName, false) : person1GrandfatherName;
    let translatedPerson1LastName = isArabic(person1LastName) ? utils.translateFamilyName(person1LastName, false) : person1LastName;
    console.log(translatedPerson1Name, translatedPerson1LastName);
    let translatedPerson2Name = isArabic(person2Name) ? utils.translateName(person2Name, false) : person2Name;
    let translatedPerson2FatherName = isArabic(person2FatherName) ? utils.translateName(person2FatherName, false) : person2FatherName;
    let translatedPerson2GrandfatherName = isArabic(person2GrandfatherName) ? utils.translateName(person2GrandfatherName, false) : person2GrandfatherName;
    let translatedPerson2LastName = isArabic(person2LastName) ? utils.translateFamilyName(person2LastName, false) : person2LastName;

    const errorContainer = document.getElementById('error-container');
    try {
      const person1Matches = await getPersonMatches(
        translatedPerson1Name,
        translatedPerson1FatherName,
        translatedPerson1GrandfatherName,
        translatedPerson1LastName
      );

      if (person1Matches.length === 0) {
        throw new Error(`لا يوجد أشخاص بإسم ${person1FullName} الرجاء التثبت في الإسم جيدا`);
      }
      if (person1Matches.length === 1) {
        setSelectedPerson1(person1Matches[0]);
      }
      const person2Matches = await getPersonMatches(
        translatedPerson2Name,
        translatedPerson2FatherName,
        translatedPerson2GrandfatherName,
        translatedPerson2LastName
      );

      if (person2Matches.length === 0) {
        throw new Error(`لا يوجد أشخاص بإسم ${person2FullName} الرجاء التثبت في الإسم جيدا`);
      }
      
      if (person2Matches.length === 1) {
        setSelectedPerson2(person2Matches[0]);
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
        gender1 = person1Matches[0].gender;
        gender2 = person2Matches[0].gender;
      }

      const translatedName1 = utils.translateName(person1Matches[0].name) + " " + 
                              utils.translateFamilyName(person1Matches[0].lastName);
      const translatedName2 = utils.translateName(person2Matches[0].name) + " " + 
                              utils.translateFamilyName(person2Matches[0].lastName);
      
      console.log(person1Matches[0], person2Matches[0]);
      
      return findRelationship(person1ID, person2ID, gender1, gender2, translatedName1, translatedName2, person1Matches, person2Matches);
    } 
    catch (error) {
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
    <main className="main-panel">
      <section className="relation-form-section">
        <h1 className="section-title">ماهي العلاقة بينهما؟</h1>
        <p id="DescriptionZone">
          يمكنك خلال هذه الأداء التعرف على العلاقة الي تربط أي شخصين في شجرة العائلة. كل ماعليك هو إدخال اسمَي الشخصين ،
          يمكنك كتابة الاسم ، على الشكل التالي (فلان بن فلان بن فلان الفلاني). يمكنك كتابة الاسم فقط أو الاسم واللقب معاً أيضا. 
          من الأفضل ان تدخل الاسم الكامل للشخص لكي تتعرف الأداء جيدًا على الشخص المقصود. في حالة وجود شخصين يحملان نفس الإسم، سوف تظهر
          قائمة يمكنك اختيار من خلالها الشخص المحدد. يمكنك عبر هذه الأداة معرفة مدى قرب العلاقة بين الشخصين ، نوعها وتفاصيل اخرى عنها ، كما يمكنك إلقاء نظرة على
          شجرة العائلة الي تربطمها بالجد المشترك بينهما. اكتشف قدرات هذه الأداة القوية الآن!
        </p>
        <form onSubmit={fetchRelationship} className="relation-form">
          <div className="input-group">
            <div className='inputSection'>
              <h2>الشخص الأول</h2>
              <input
              type="text"
              placeholder="الإسم الكامل الأول"
              value={person1}
              onChange={(e) => setPerson1(e.target.value)}
              className="inputNames"
              />
            </div>
            <div>
              <span className='relationEmoji'>🧬</span>
            </div>
            <div className='inputSection'>
              <h2>الشخص الثاني</h2>
              <input
                type="text"
                placeholder="الإسم الكامل الثاني"
                value={person2}
                onChange={(e) => setPerson2(e.target.value)}
                className="inputNames"
              />
            </div>
          </div>
          <div className='ButtonSection'>
            <button type="submit" className="button checkButton">تحقق من العلاقة</button>
            <button type="reset" className="button resetButton">إلغاء</button>
            <button
              type="button"
              className="button swapButton"
              onClick={() => {
                // Swap the values of person1 and person2
                setPerson1(person2);
                setPerson2(person1);
              }}
            >
              تبديل الأشخاص
            </button>
          </div>  
        </form>
        {(duplicates.person1.length > 0 || duplicates.person2.length > 0) && (
          <aside className="duplicates-panel">
            {duplicates.person1.length > 0 && !selectedPerson1 && (
              <section className="duplicates-group">
                <h3>🧠 أختر الشخص المقصود (الشخص الأول):</h3>
                <table className="person-info-table">
                  <thead>
                    <tr>
                      <th>الاسم</th>
                      <th>سنة الميلاد</th>
                      <th>سنة الوفاة</th>
                      <th>اختيار</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duplicates.person1.map((p, idx) => {
                      const fullName =
                        (p.name ? `${utils.translateName(p.name)} بن ` : '') +
                        (p.father ? `${utils.translateName(p.father)} بن ` : '') +
                        (p.grandfather ? `${utils.translateName(p.grandfather)} ` : '') +
                        (p.lastName ? `${utils.translateName(p.lastName)}` : '');
                        
                      return (
                        <tr key={`p1-${idx}`}>
                          <td>{fullName}</td>
                          <td>{p.YoB !== -1 ? p.YoB : ''}</td>
                          <td>{p.YoD !== -1 ? p.YoD : ''}</td>
                          <td>
                            <button
                              type="button"
                              className="duplicate-button"
                              onClick={() => {
                                setSelectedPerson1(fullName);
                              }}
                            >
                              اختيار
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>

            )}

            {duplicates.person2.length > 0 && !selectedPerson2 && (
              <section className="duplicates-group">
                <h3>🧠 أختر الشخص المقصود (الشخص الثاني):</h3>
                <table className="person-info-table">
                  <thead>
                    <tr>
                      <th>الاسم</th>
                      <th>سنة الميلاد</th>
                      <th>سنة الوفاة</th>
                      <th>اختيار</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duplicates.person2.map((p, idx) => {
                      const fullName =
                        (p.name ? `${utils.translateName(p.name)} بن ` : '') +
                        (p.father ? `${utils.translateName(p.father)} بن ` : '') +
                        (p.grandfather ? `${utils.translateName(p.grandfather)} ` : '') +
                        (p.lastName ? `${utils.translateName(p.lastName)}` : '');
                      
                      return (
                        <tr key={`p2-${idx}`}>
                          <td>{fullName}</td>
                          <td>{p.YoB !== -1 ? p.YoB : ''}</td>
                          <td>{p.YoD !== -1 ? p.YoD : ''}</td>
                          <td>
                            <button
                              type="button"
                              className="duplicate-button"
                              onClick={() => {
                                setSelectedPerson2(fullName);
                              }}
                            >
                              اختيار
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>




      )}


    </aside>
        )}
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
          <div className="foundPersons">
            <h2 id="resultTitle">الأشخاص الذين تم البحث عنهم:</h2>
            <div className="person-card">
              <h4>
                {utils.translateName(relationship.relationshipPerson1Details?.name ?? '')} 
                {relationship.relationshipPerson1Details?.father && ` بن ${utils.translateName(relationship.relationshipPerson1Details.father)}`} 
                {relationship.relationshipPerson1Details?.grandfather && ` بن ${utils.translateName(relationship.relationshipPerson1Details.grandfather)}`} 
                {relationship.relationshipPerson1Details?.lastName && ` ${utils.translateFamilyName(relationship.relationshipPerson1Details.lastName)}`}
              </h4>
            </div>
          <div className="person-card">
            <h4>
              {utils.translateName(relationship.relationshipPerson2Details?.name ?? '')} 
              {relationship.relationshipPerson2Details?.father && ` بن ${utils.translateName(relationship.relationshipPerson2Details.father)}`} 
              {relationship.relationshipPerson2Details?.grandfather && ` بن ${utils.translateName(relationship.relationshipPerson2Details.grandfather)}`} 
              {relationship.relationshipPerson2Details?.lastName && ` ${utils.translateFamilyName(relationship.relationshipPerson2Details.lastName)}`}
            </h4>
          </div>
        </div>

          <h2 id="resultTitle">نتيجة العلاقة</h2>
          <p className="relationText">{relationship.relationshipDescription}</p>
          <div className="result-details">
            <table className="result-table">
              <tbody>
                <tr>
                  <th>درجة العلاقة</th>
                  <td className="score-cell">
                    <div className="score-bar-wrapper">
                      <div className="score-bar-fill" style={{ width: `${relationship.relationshipScore ?? 0}%` }}></div>
                    </div>
                    <div className="score-meta">
                      <span className="score-value">{relationship.relationshipScore ?? 'N/A'}</span>
                      {relationship.relationshipScore !== null && relationship.relationshipScore !== undefined && (
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
                  <td className="relationship-tag">
                    <span className={`tag ${relationship.relationshipType}`}>
                      {relationship.relationshipType === "Blood" ? "دم" :
                      relationship.relationshipType === "Marriage-related" ? "زواج مرتبط" :
                      relationship.relationshipType === "Marriage" ? "زواج" :
                      relationship.relationshipType}
                    </span>
                  </td>

                </tr>
                <tr>
                  <th>تفسير إضافي</th>
                  <td className="relation-explanation">
                    <span className='relation-explanation-type'>
                      {relationship.relationshipExplanationType ?? 'نوع التفسير غير متاح'}
                    </span>: 
                    {relationship.relationshipExplanationDesc ?? "لا يوجد تفسير متاح."}
                  </td>

                </tr>
                <tr>
                  <th>عدد الأجيال بينهما حسب الجد المشترك</th>
                  <td className="generation-distance">
                    <div className="tooltip-container">
                      <span id="numGen">{relationship.relationshipGenerationGap ?? '-'}</span> أجيال
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
                    {relationship.commonAncestor?.ancestorName && `${relationship.commonAncestor?.ancestorName} بن `}
                    {relationship.commonAncestor?.ancestorFatherName && `${relationship.commonAncestor?.ancestorFatherName} بن `}
                    {relationship.commonAncestor?.ancestorGrandFatherName && `${relationship.commonAncestor?.ancestorGrandFatherName} `}
                    {relationship.commonAncestor?.ancestorLastName && `${relationship.commonAncestor?.ancestorLastName}`}
                  </td>
                </tr>
              </tbody>
            </table>
              <h2 id="resultTitle">شجرة العائلة الي تجمع الشخصين :</h2>

            <div className="tree-wrapper" style={{
              height: `${Math.max(
                ((Math.max(relationship.relationshipLevels?.levelFromP1 ?? 0, relationship.relationshipLevels?.levelFromP2 ?? 0)) + 1) * 100,
                100
              ) + 1}px`
            }}>

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
                    translate={{ x: 500, y: 30 }} 
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
                          {utils.translateName(nodeDatum.name)}
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
    <div className="tipsFooter">
      <h3>نصائح حول استخدام أداة معرفة العلاقة</h3>
      <ul>
        <li>اختر الأشخاص بدقة لضمان نتائج صحيحة.</li>
        <li>إذا كان أحد الطرفين متزوج، تأكد من اختيار الزوج أو الزوجة المناسبة.</li>
        <li>يمكنك استخدام زر "إلغاء" لإعادة التحديد بسهولة.</li>
        <li>يمكن لهذه الأداء التعرف على أكثر من 200 ممكنة بين الشخصين .</li>
      </ul>
    </div>

    </div>
  
  );
};

export default RelationPage;
