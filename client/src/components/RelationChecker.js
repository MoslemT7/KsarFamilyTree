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

  const handleReset = async () => {
    setPerson1('');
    setPerson2('');
    setSelectedPerson1('');
    setSelectedPerson2('');
    setLoading(false);
    setError(false);
    setRelationship('');
    
  };

  const fetchRelationship = async (e, person1ID = null, person2ID = null) => {
    person1ID = person1ID ?? selectedPerson1?.id ?? null;
    person2ID = person2ID ?? selectedPerson2?.id ?? null;
  
    console.log("ID 1: ", person1ID, "ID 2: ", person2ID);
    if (e) e.preventDefault();
    const errorContainer = document.getElementById('error-container');
    setLoading(true);
    setError(false);
    setLoadingMessage("🔎 بداية البحث عن العلاقة...");

    try {
      let result;

      if (!person1ID || !person2ID) {
        const { personName: person1Name, fatherName: person1FatherName, grandfatherName: person1GrandfatherName, familyName: person1LastName } =
          utils.splitName(person1);
        const { personName: person2Name, fatherName: person2FatherName, grandfatherName: person2GrandfatherName, familyName: person2LastName } =
          utils.splitName(person2);
        
        const translatedperson1FullName = await getFullTranslatedName(person1Name, person1FatherName, person1GrandfatherName, person1LastName);
        const translatedPerson1Name = translatedperson1FullName.translatedPersonName;
        const translatedPerson1FatherName = translatedperson1FullName.translatedPersonFatherName;
        const translatedPerson1GrandfatherName = translatedperson1FullName.translatedPersonGrandfatherName;
        const translatedPerson1LastName = translatedperson1FullName.translatedPersonLastName;

        const translatedperson2FullName = await getFullTranslatedName(person2Name, person2FatherName, person2GrandfatherName, person2LastName);
        const translatedPerson2Name = translatedperson2FullName.translatedPersonName;
        const translatedPerson2FatherName = translatedperson2FullName.translatedPersonFatherName;
        const translatedPerson2GrandfatherName = translatedperson2FullName.translatedPersonGrandfatherName;
        const translatedPerson2LastName = translatedperson2FullName.translatedPersonLastName;

        const person1Matches = await getPersonMatches(
          translatedPerson1Name,
          translatedPerson1FatherName,
          translatedPerson1GrandfatherName,
          translatedPerson1LastName
        );
        

        if (person1Matches.length === 0)
          throw new Error(`لا يوجد أشخاص بإسم ${person1} الرجاء التثبت في الإسم جيدا`);

        if (person1Matches.length === 1)
          setSelectedPerson1(person1Matches[0]);

        const person2Matches = await getPersonMatches(
          translatedPerson2Name,
          translatedPerson2FatherName,
          translatedPerson2GrandfatherName,
          translatedPerson2LastName
        );

        if (person2Matches.length === 0)
          throw new Error(`لا يوجد أشخاص بإسم ${person2} الرجاء التثبت في الإسم جيدا`);

        if (person2Matches.length === 1)
          setSelectedPerson2(person2Matches[0]);

        setLoadingMessage("جاري البحث عن الأشخاص");
        console.log("P1 matches : ", person1Matches);
        console.log("P2 matches : ", person2Matches);

        // 🔴 Handle duplicates
        if (person1Matches.length > 1 || person2Matches.length > 1) {
          result = {
            error: 'non-unique-name',
            message: 'تم العثور على عدة أشخاص بنفس الاسم. الرجاء اختيار الصحيح.',
            duplicates: {
              person1: person1Matches.length > 1 ? person1Matches : [],
              person2: person2Matches.length > 1 ? person2Matches : []
            },
            selected: {
              person1: person1Matches.length === 1 ? person1Matches[0] : null,
              person2: person2Matches.length === 1 ? person2Matches[0] : null
            }
          };
        } else {
          // ✅ Unique matches — proceed with relationship
          person1ID = person1Matches[0].id;
          person2ID = person2Matches[0].id;
          const gender1 = person1Matches[0].gender;
          const gender2 = person2Matches[0].gender;

          const translatedName1 = utils.translateName(person1Matches[0].name) + " " + utils.translateFamilyName(person1Matches[0].lastName);
          const translatedName2 = utils.translateName(person2Matches[0].name) + " " + utils.translateFamilyName(person2Matches[0].lastName);

          result = await findRelationship(
            person1ID,
            person2ID,
            gender1,
            gender2,
            translatedName1,
            translatedName2,
            person1Matches,
            person2Matches
          );
        }
      } else {
        // If IDs were passed directly
        if (!selectedPerson1 || !selectedPerson2) {
          throw new Error("يجب تحديد الشخصين قبل المتابعة.");
        }
        console.log(selectedPerson1, selectedPerson2);
        const gender1 = selectedPerson1.gender;
        const gender2 = selectedPerson2.gender;

        const translatedName1 = utils.translateName(selectedPerson1.name) + " " + utils.translateFamilyName(selectedPerson1.lastName);
        const translatedName2 = utils.translateName(selectedPerson2.name) + " " + utils.translateFamilyName(selectedPerson2.lastName);

        // Wrap in arrays to simulate the matches list (since they're selected)
        result = await findRelationship(
          selectedPerson1.id,
          selectedPerson2.id,
          gender1,
          gender2,
          translatedName1,
          translatedName2,
          [selectedPerson1],
          [selectedPerson2]
        );
      }

      // 🔴 Handle duplicate names
      if (result.error === 'non-unique-name') {
        setDuplicates(result.duplicates ?? { person1: [], person2: [] });
        setSelectedPerson1(result.selected?.person1 ?? null);
        setSelectedPerson2(result.selected?.person2 ?? null);
        setRelationship(result.message);
        setLoading(false);
        return;
      }

      // ✅ Valid result — display relationship
      console.log("✅ Result received:", result);
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
        person2ID: result.person2ID ?? null,
        gender1: result.gender1,
        gender2: result.gender2,
        ancestorGender: result.ancestorGender
      });

    } catch (error) {
      console.error('❌ Error fetching relationship:', error);
      setRelationship({ relationshipDescription: 'حدث خطأ أثناء البحث', relationshipScore: null });
      setError(true);
      if (errorContainer) {
        errorContainer.innerText = `❌ خطأ: ${error.message || error}`;
      }
    } finally {
      setLoading(false);
      console.log("🛑 fetchRelationship END");
    }
  };


  const findRelationship = async (person1ID, person2ID, gender1, gender2, translatedName1, translatedName2, person1Matches, person2Matches) => {
    let relationshipType;
    let relation = '', score = -1;
    let explanation;
    let relationshipExplanation = [
      {
        type: "العائلة",
        explanation: "هؤلاء الشخصين مرتبطين من خلال العائلة ذو الدرجة الأولى."
      },
      {
        type: "عائلة الأب المقربة",
        explanation: "هؤلاء الشخصين مرتبطين من خلال جد مشترك من طرف الأب."
      },
      {
        type: "عائلة الأم المقربة",
        explanation: "هؤلاء الشخصين مرتبطين من خلال جد مشترك من طرف الأم."
      },
      {
        type: "عائلة الأب الموسعة",
        explanation: "هؤلاء الشخصين مرتبطين من خلال أعمام أو أخوال أحد آبائما."
      },
      {
        type: "عائلة الأم الموسعة",
        explanation: "هؤلاء الشخصين مرتبطين من خلال أعمام أو أخوال أحد أمهاتهما."
      },
      {
        type: "قرابة زواج",
        explanation: "هذان الشخصان مرتبطان من خلال الزواج."
      },
      {
        type: "صهر / نسيب",
        explanation: "هذان الشخصان مرتبطان عبر نسب الزواج ، سواءا عبر عائلة الزوج أو الزوجة أو عبر أزواج الإخوة ، ."
      },
      {
        type: "لا توجد علاقة",
        explanation: "تعود أصل هذه العلاقة الى جد مشترك بعيد."
      },
    ];

    let marraigeRecord = await checkMarriage(person1ID, person2ID, gender1, gender2);
    if (marraigeRecord.areMarried === true){
      let score = 100;
      if (gender1 === 'Male'){
        relation = `${translatedName1} هو زوج ${translatedName2}`;
      }
      else{
        relation = `${translatedName1} هي زوجة ${translatedName2}`;
      }
      setLoading(false);
      relationshipType = "Marriage";
      explanation = relationshipType[3];
      return {relation, score, relationshipType, explanation, person1: person1Matches[0], person2: person2Matches[0]}
    } 
    else {
      console.log("Checking relations");
      let relationRecord = await getAncestors(person1ID, person2ID);
      if (relationRecord === null){
        let relation = await getMarriageRelation(session, person1ID, person2ID, translatedName1, translatedName2, gender1, gender2);
        if (relation){
          relationshipType = "Marriage-related";
          explanation = relationshipExplanation[6];
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
        const ancestorFatherName = relationRecord.fatherName ? utils.translateName(relationRecord.fatherName) : '';
        const ancestorGrandFatherName = relationRecord.grandfatherName ? utils.translateName(relationRecord.grandfatherName) : '';
        const ancestorLastName = relationRecord.lastName ? utils.translateFamilyName(relationRecord.lastName) : '';
        const ancestorGender = relationRecord.gender;
        let levelFromP1, levelFromP2, pathFromAncestorToP1, pathFromAncestorToP2;
        let spouseOfAncestor = relationRecord.spouseOfAncestor;
        
        ({
          levelFromP1, 
          levelFromP2,
          spouseOfAncestor,
          pathFromAncestorToP1, 
          pathFromAncestorToP2 
        } = relationRecord);
        let pathToP1 = pathFromAncestorToP1;
        let pathToP2 = pathFromAncestorToP2;
        let ancestor;

        if ((spouseOfAncestor !== null) && (ancestorID !== person1ID) && (ancestorID !== person2ID) && (spouseOfAncestor.gender === 'Male')) {
            pathToP1[0] = {
              id: (spouseOfAncestor.id).toNumber(),
              name: spouseOfAncestor.name,
              father: spouseOfAncestor.father,
              grandfather: spouseOfAncestor.grandfather,
              lastName: spouseOfAncestor.lastName,
              gender: spouseOfAncestor.gender
            };
            pathToP2[0] = {
              id: (spouseOfAncestor.id).toNumber(),
              name: spouseOfAncestor.name,
              father: spouseOfAncestor.father,
              grandfather: spouseOfAncestor.grandfather,
              lastName: spouseOfAncestor.lastName,
              gender: spouseOfAncestor.gender
            };
            ancestor = {ancestorID: (spouseOfAncestor.id).toNumber(), 
                        ancestorName: spouseOfAncestor.name, 
                        ancestorFatherName: spouseOfAncestor.father,
                        ancestorGrandFatherName: spouseOfAncestor.grandfather,
                        ancestorLastName: spouseOfAncestor.lastName,
                        ancestorGender: spouseOfAncestor.gender};
        }
        else{
          ancestor = {ancestorID, ancestorName, ancestorFatherName, ancestorGrandFatherName, ancestorLastName, ancestorGender};
        }
        
        const treeData = utils.mergePaths(pathToP1, pathToP2);
        console.log(pathFromAncestorToP1.reverse().map(a => a.name).join(" ben "));
        console.log(pathFromAncestorToP2.reverse().map(a => a.name).join(" ben "));
        
        var p1Level = levelFromP1;
        var p2Level = levelFromP2;
        const gender1 = pathToP1[0].gender;
        const gender2 = pathToP2[0].gender;
        
        console.log(`Level: (${p1Level}, ${p2Level})`);
        setLoadingMessage("... جاري البحث عن العلاقة بين الشخصين");
        if (p1Level === 0 && p2Level === 1) {
          if (gender1 === 'Male'){
            relation = `${translatedName1} هو والد ${translatedName2}`;
          }
          else{
            relation = `${translatedName1} هي والدة ${translatedName2}`;
          }
          score = 100;
          explanation = relationshipExplanation[0];
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
          explanation = relationshipExplanation[1];
        } 
        
        else if (p1Level === 0 && p2Level === 4) { 
          const p2GreatAncestorGender = pathToP1[2].gender;
          const p2AncestorGender = pathToP1[1].gender;
          if (gender1 === 'Male'){
            if (p2GreatAncestorGender === 'Male'){
              if (p2AncestorGender === 'Male'){
                relation = `${translatedName1} هو جد جد ${translatedName2} من الأب`;
              }
              else{
                relation = `${translatedName1} هو جد جد ${translatedName2} من الأم`;
              }
            }
            else{
              if (p2AncestorGender === 'Male'){
                relation = `${translatedName1} هو جدة جد ${translatedName2} من الأب`;
              }
              else{
                relation = `${translatedName1} هو جدة جد ${translatedName2} من الأم`;
              }
            }
              
          }
          else{
            if (p2AncestorGender === 'Male'){
              if (p2GreatAncestorGender === 'Male'){
                relation = `${translatedName1} هي جد جدة ${translatedName2} من الأب`;
              }
              else{
                relation = `${translatedName1} هي جد جدة ${translatedName2} من الأم`;
              }
            }
            else{
              if (p2GreatAncestorGender === 'Male'){
                relation = `${translatedName1} هي جدة جدة ${translatedName2} من الأب`;
              }
              else{
                relation = `${translatedName1} هي جدة جدة ${translatedName2} من الأم`;
              }
            }
          }
          score = 70;
          explanation = relationshipExplanation[1];
        }

        else if (p1Level === 4 && p2Level === 0) {
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
          score = 65;
          explanation = relationshipExplanation[1];
        }

        else if (p1Level === 4 && p2Level === 1) {
          const p1GreatAncestorGender = pathToP1[2].gender;
          const p1GreatGrandAncestorGender = pathToP1[3].gender;
          
          if (gender1 === 'Male'){
              if (p1GreatAncestorGender === 'Male') {
                if (p1GreatGrandAncestorGender === 'Male') {
                  relation = `${translatedName1} هو حفيد إبن أخ ${translatedName2}`;
                  score = 80;
                } else {
                  relation = `${translatedName1} هو حفيد إبن أخت ${translatedName2}`;
                  score = 78;
                }
              } 
              else {
                if (p1GreatGrandAncestorGender === 'Male') {
                  relation = `${translatedName1} هو حفيد إبنة أخ ${translatedName2}`;
                  score = 80;
                } else {
                  relation = `${translatedName1} هو حفيد إبنة أخت ${translatedName2}`;
                  score = 78;
                }
              }
          } 
          else {
            if (p1GreatAncestorGender === 'Male') {
                if (p1GreatGrandAncestorGender === 'Male') {
                  relation = `${translatedName1} هي حفيدة إبن أخ ${translatedName2}`;
                  score = 80;
                } else {
                  relation = `${translatedName1} هي حفيدة إبن أخت ${translatedName2}`;
                  score = 78;
                }
              } 
              else {
                if (p1GreatGrandAncestorGender === 'Male') {
                  relation = `${translatedName1} هي حفيدة إبنة أخ ${translatedName2}`;
                  score = 80;
                } else {
                  relation = `${translatedName1} هي حفيدة إبنة أخت ${translatedName2}`;
                  score = 78;
                }
              }
          }
          explanation = relationshipExplanation[4];
        }

        else if (p1Level === 1 && p2Level === 1) {
          if (gender1 === 'Female' && gender2 === 'Female'){
            relation = `${translatedName1} و ${translatedName2} أخوات`;
          }
          else {
            relation = `${translatedName1} و ${translatedName2} إخوة`;
          }
          score = 99;
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
            explanation = relationshipExplanation[1];
          }
          else{
            if (p2AncestorGender === 'Male'){
              relation = `${translatedName1} هي عمة ${translatedName2}`;
              score = 94;
            }
            else{
              relation = `${translatedName1} هي خالة ${translatedName2}`;
              score = 93;
            }
            explanation = relationshipExplanation[2];
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
            else {
              if (p2GreatAncestorGender === 'Male'){
                relation = `${translatedName1} هو عم والدة ${translatedName2}`;
                score = 75;
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
                score = 75;
              }
            }
            else{
              if (p2GreatAncestorGender === 'Male'){
                relation = `${translatedName1} هي عمة والدة ${translatedName2}`;
                score = 75;
              }
              else {
                relation = `${translatedName1} هي خالة والدة ${translatedName2}`;
                score = 70;
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
                } 
                else {
                  relation = `${translatedName1} هو عم جدة والد ${translatedName2}`;
                  score = 80;
                }
              } 
              else {
                if (p2GreatGrandAncestorGender === 'Male') {
                  relation = `${translatedName1} هو خال جد والد ${translatedName2}`;
                  score = 85;
                } 
                else {
                  relation = `${translatedName1} هو خال جدة والد ${translatedName2}`;
                  score = 80;
                }
              }
            } 
            else {
              if (p2GreatAncestorGender === 'Male') {
                if (p2GreatGrandAncestorGender === 'Male') {
                  relation = `${translatedName1} هو عم جد والدة ${translatedName2}`;
                  score = 85;
                } 
                else {
                  relation = `${translatedName1} هو عم جدة والدة ${translatedName2}`;
                  score = 80;
                }
              } 
              else {
                if (p2GreatGrandAncestorGender === 'Male') {
                  relation = `${translatedName1} هو خال جد والدة ${translatedName2}`;
                  score = 85;
                } 
                else {
                  relation = `${translatedName1} هو خال جدة والدة ${translatedName2}`;
                  score = 80;
                }
              }
            }
          } 
          else {
            if (p2AncestorGender === 'Male') {
              if (p2GreatAncestorGender === 'Male') {
                if (p2GreatGrandAncestorGender === 'Male') {
                  relation = `${translatedName1} هي عمة جد والد ${translatedName2}`;
                  score = 85;
                } 
                else {
                  relation = `${translatedName1} هي عمة جدة والد ${translatedName2}`;
                  score = 80;
                }
              } 
              else {
                if (p2GreatGrandAncestorGender === 'Male') {
                  relation = `${translatedName1} هي خالة جد والد ${translatedName2}`;
                  score = 85;
                } 
                else {
                  relation = `${translatedName1} هي خالة جدة والد ${translatedName2}`;
                  score = 80;
                }
              }
            } 
            else {
              if (p2GreatAncestorGender === 'Male') {
                if (p2GreatGrandAncestorGender === 'Male') {
                  relation = `${translatedName1} هي عمة جد والدة ${translatedName2}`;
                  score = 85;
                } 
                else {
                  relation = `${translatedName1} هي عمة جدة والدة ${translatedName2}`;
                  score = 80;
                }
              } 
              else {
                if (p2GreatGrandAncestorGender === 'Male') {
                  relation = `${translatedName1} هي خالة جد والدة ${translatedName2}`;
                  score = 85;
                } 
                else {
                  relation = `${translatedName1} هي خالة جدة والدة ${translatedName2}`;
                  score = 80;
                }
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
                score = 75;
              } else {
                relation = `${translatedName1} هو جد الأول وجدة جد ${translatedName2} إخوة`;
                score = 65;
              }
              explanation = relationshipExplanation[3];
            } 
            else {
              if (p2GreatAncestorGender === 'Male') {
                relation = `${translatedName1} هو جد الأول وجدة جد ${translatedName2} إخوة`;
                score = 75;
              } else {
                relation = `${translatedName1} هو جد الأول وجدة جد ${translatedName2} إخوة`;
                score = 65;
              }
              explanation = relationshipExplanation[4];
            }

          } 
          else {
            if (p2AncestorGender === 'Male') {
              if (p2GreatAncestorGender === 'Male') {
                relation = `${translatedName1} هي جدة الأول وجد جد ${translatedName2} إخوة`;
                score = 65;
              } else {
                relation = `${translatedName1} هي جدة الأول وجدة جد ${translatedName2} إخوة`;
                score = 60;
              }
              explanation = relationshipExplanation[3];
            } else {
              if (p2GreatAncestorGender === 'Male') {
                relation = `${translatedName1} هي جدة الأول وجدة جد ${translatedName2} إخوة`;
                score = 65;
              } else {
                relation = `${translatedName1} هي جدة الأول وجدة جد ${translatedName2} إخوة`;
                score = 60;
              }
              explanation = relationshipExplanation[4];
            }
          }
          
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
          explanation = relationshipExplanation[3];
        }

        else if (p1Level === 2 && p2Level === 2) {    
          const p1AncestorGender = pathToP1[1].gender;
          const p2AncestorGender = pathToP2[1].gender;
          
          if (gender1 === 'Male') { 
            if (p2AncestorGender === 'Male') { 
              if (p1AncestorGender === 'Male'){
                relation = `${translatedName1} إبن عم ${translatedName2}`;
                score = 90;
              }
              else{
                relation = `${translatedName1} إبن عمّة ${translatedName2}`;
                score = 89;
              }
              explanation = relationshipExplanation[1];
            } 
            else {  
              if (p1AncestorGender === 'Male'){
                relation = `${translatedName1} هو إبن خال ${translatedName2}`;
                score = 88;
              }
              else{
                relation = `${translatedName1} هو إبن خالة ${translatedName2}`;
                score = 87;
              }
              explanation = relationshipExplanation[2];
            }
          }
          else {
            if (p1AncestorGender === 'Male') { 
              if (p2AncestorGender === 'Male'){
                relation = `${translatedName1} هي إبنة عمّ ${translatedName2}`;
                score = 90;
              }
              else{
                relation = `${translatedName1} هي إبنة خال ${translatedName2}`;
                score = 89;
              }
              explanation = relationshipExplanation[1];
            } 
            else {  
              if (p2AncestorGender === 'Male'){  // بنت خاله
                relation = `${translatedName1} هي إبنة عمة ${translatedName2}`;
                score = 88;
              }
              else{
                relation = `${translatedName1} هي إبنة خالة ${translatedName2}`;
                score = 87;
              }
              explanation = relationshipExplanation[2];
            }
            
          }
          
        }
    
        else if (p1Level === 2 && p2Level === 3) {         
          const p1AncestorGender = pathToP1[1].gender;
          const p2AncestorGender = pathToP2[1].gender;
          const p2GreatAncestorGender = pathToP1[2].gender;

          if (gender1 === 'Male') { 
            if (p1AncestorGender === 'Male') {
              if (p2AncestorGender === 'Male') {
                if (p2GreatAncestorGender === 'Male'){
                  relation = `${translatedName1} هو إبن عم والد ${translatedName2}`;
                  score = 80;
                } 
                else { 
                  relation = `${translatedName1} هو إبن خال والد ${translatedName2}`;
                  score = 78;
                }
                explanation = relationshipExplanation[3];
              }
              else{
                if (p2GreatAncestorGender === 'Male'){
                  relation = `${translatedName1} هو إبن عم والدة ${translatedName2}`;
                  score = 80;
                } 
                else { 
                  relation = `${translatedName1} هو إبن خال والدة ${translatedName2}`;
                  score = 78;
                }
                explanation = relationshipExplanation[4];
              }
            }
            else {
              if (p2AncestorGender === 'Male') {
                if (p2GreatAncestorGender === 'Male'){
                  relation = `${translatedName1} هو إبن عمة والد ${translatedName2}`;
                  score = 80;
                } 
                else { 
                  relation = `${translatedName1} هو إبن خالة والد ${translatedName2}`;
                  score = 78;
                }
                explanation = relationshipExplanation[3];
              }
              else{
                if (p2GreatAncestorGender === 'Male'){
                  relation = `${translatedName1} هو إبن عمة والدة ${translatedName2}`;
                  score = 80;
                } 
                else { 
                  relation = `${translatedName1} هو إبن خالة والدة ${translatedName2}`;
                  score = 78;
                }
                explanation = relationshipExplanation[4];
              }
            }
          } 
          else {
            if (p1AncestorGender === 'Male') {
              if (p2AncestorGender === 'Male') {
                if (p2GreatAncestorGender === 'Male'){
                  relation = `${translatedName1} هي إبنة عم والد ${translatedName2}`;
                  score = 80;
                  explanation = relationshipExplanation[3];
                } 
                else { 
                  relation = `${translatedName1} هي إبنة خال والد ${translatedName2}`;
                  score = 78;
                  explanation = relationshipExplanation[3];
                }
              }
              else{
                if (p2GreatAncestorGender === 'Male'){
                  relation = `${translatedName1} هي إبنة عم والدة ${translatedName2}`;
                  score = 80;
                  explanation = relationshipExplanation[4];
                } 
                else { 
                  relation = `${translatedName1} هي إبنة خال والدة ${translatedName2}`;
                  score = 78;
                  explanation = relationshipExplanation[4];
                }
              }
            }
            else {
              if (p2AncestorGender === 'Male') {
                if (p2GreatAncestorGender === 'Male'){
                  relation = `${translatedName1} هي إبنة عمة والد ${translatedName2}`;
                  score = 80;
                  explanation = relationshipExplanation[3];
                } 
                else { 
                  relation = `${translatedName1} هي إبنة خالة والد ${translatedName2}`;
                  score = 78;
                  explanation = relationshipExplanation[3];
                }
              }
              else{
                if (p2GreatAncestorGender === 'Male'){
                  relation = `${translatedName1} هي إبنة عمة والدة ${translatedName2}`;
                  score = 80;
                  explanation = relationshipExplanation[4];
                } 
                else { 
                  relation = `${translatedName1} هي إبنة خالة والدة ${translatedName2}`;
                  score = 78;
                  explanation = relationshipExplanation[4];
                }
              }
            }
          }
          
        }
        
        else if (p1Level === 4 && p2Level === 2) {
          const p1GreatAncestorGender = pathToP1[3].gender;
          const p2AncestorGender = pathToP2[1].gender;
          if (p1GreatAncestorGender){
            if (p2AncestorGender === 'Male') {
              if (p1GreatAncestorGender === 'Male') {
                  relation = `جد ${translatedName1} هو إبن عم ${translatedName2}`;
                  score = 65;
              } 
              else {
                  relation = `جد ${translatedName1} هو إبن عمّة ${translatedName2}`;
                  score = 65;
              }
              explanation = relationshipExplanation[3];
            } 
            else {
              if (p1GreatAncestorGender === 'Male') {
                  relation = `جد ${translatedName1} هو إبن خال ${translatedName2}`;
                  score = 65;
              } else {
                  relation = `جد ${translatedName1} هو إبن خالة ${translatedName2}`;
                  score = 65;
              }
            }
            explanation = relationshipExplanation[4];
          } 
          else {
            if (p2AncestorGender === 'Male') {
              if (p1GreatAncestorGender === 'Male') {
                  relation = `جدة ${translatedName1} هي إبنة عم ${translatedName2}`;
                  score = 65;
              } 
              else {
                  relation = `جدة ${translatedName1} هي إبنة عمّة ${translatedName2}`;
                  score = 65;
              }
              explanation = relationshipExplanation[3];
            } 
            else {
              if (p1GreatAncestorGender === 'Male') {
                  relation = `جدة ${translatedName1} هي إبنة خال ${translatedName2}`;
                  score = 65;
              }
              else {
                  relation = `جدة ${translatedName1} هي إبنة خالة ${translatedName2}`;
                  score = 65;
              }
              explanation = relationshipExplanation[4];
            }
          }
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
              score = 80;
              explanation = relationshipExplanation[3];
            } else { 
              if (p1GreatAncestorGender === 'Male'){
                relation = `والد ${translatedName1} هو إبن خال ${translatedName2}`;
              }
              else{
                relation = `والد ${translatedName1} هو إبن خالة ${translatedName2}`;
              }
              score = 75;
              explanation = relationshipExplanation[4];
            }
          } 
          else {
            if (p2AncestorGender === 'Male') {
              if (p1GreatAncestorGender === 'Male'){
                relation = `والدة ${translatedName1} هي إبنة عم ${translatedName2}`;
              }
              else{
                relation = `والدة ${translatedName1} هي إبنة عمة ${translatedName2}`;
              }
              explanation = relationshipExplanation[3];
              score = 80;
            } 
            else {
              if (p1GreatAncestorGender === 'Male'){
                relation = `والدة ${translatedName1} هي إبنة خال ${translatedName2}`;
              }
              else{
                relation = `والدة ${translatedName1} هي إبنة خالة ${translatedName2}`;
              }
              explanation = relationshipExplanation[4];
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
              explanation = relationshipExplanation[4];
              score = 75;
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
                  relation = `جدّة ${translatedName1} من الأب و جد ${translatedName2} من الأم إخوة.`;
                }
                else{
                  relation = `جدّة ${translatedName1} من الأب و جدة ${translatedName2} من الأم إخوة.`;
                }
              }
              explanation = relationshipExplanation[4];
              score = 75;
            }
          }
          else {
            if (p2AncestorGender === 'Male'){
              if (p1GreatAncestorGender === 'Male'){
                if (p2GreatAncestorGender === 'Male'){
                  relation = `جدّ ${translatedName1} من الأم و جد ${translatedName2} من الأب إخوة.`;
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
              explanation = relationshipExplanation[3];
              score = 70;
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
              explanation = relationshipExplanation[4];
              score = 65;
            }
          }
          
        }

        else if (p1Level === 4 && p2Level === 3) {
          const p1AncestorGender = pathToP2[0].gender;
          const p2GreatAncestorGender = pathToP2[1].gender;
          const p1GreatGreatAncestorGender = pathToP2[2].gender;

          if (p1GreatGreatAncestorGender === 'Male') {
            if (p1AncestorGender === 'Male') {
              if (p2GreatAncestorGender === 'Male') {
                  relation = `جد اب ${translatedName1} و جد ${translatedName2} اخوة`;
              } 
              else {
                  relation = `جد اب ${translatedName1} و جدة ${translatedName2} اخوة`;
                  
              }
              score = 70;
              explanation = relationshipExplanation[3];
            } 
            else {
              if (p2GreatAncestorGender === 'Male') {
                  relation = `جد أم ${translatedName1} و جد ${translatedName2} اخوة`;
              } 
              else {
                  relation = `جد أم ${translatedName1} و جدة ${translatedName2} اخوة`;
                  
              }
              score = 65;
              explanation = relationshipExplanation[3];
            }
          } 
          else {
            if (p1AncestorGender === 'Male') {
              if (p2GreatAncestorGender === 'Male') {
                relation = `جدة اب ${translatedName1} و جد ${translatedName2} اخوة`;
              } 
              else {
                relation = `جدة اب ${translatedName1} و جدة ${translatedName2} اخوة`;
              }
              score = 65;
              explanation = relationshipExplanation[3];
            } else {
              if (p2GreatAncestorGender === 'Male') {
                relation = `جدة أم ${translatedName1} و جد ${translatedName2} اخوة`;
              } 
              else {
                relation = `جدة أم ${translatedName1} و جدة ${translatedName2} اخوة`;
              }
              score = 60;
              explanation = relationshipExplanation[4];
            }
          }
        }

        else if (p1Level === 3 && p2Level === 4) {
          const p2AncestorGender = pathToP2[0].gender;
          const p1GreatAncestorGender = pathToP2[1].gender;
          const p2GreatGreatAncestorGender = pathToP2[2].gender;

          if (p1GreatAncestorGender === 'Male') {
            if (p2AncestorGender === 'Male') {
              if (p2GreatGreatAncestorGender === 'Male') {
                relation = `جد ${translatedName1} و جد أب ${translatedName2} اخوة`;
              } 
              else {
                relation = `جد ${translatedName1} و جدة أب ${translatedName2} اخوة`;
              }
              score = 65;
              explanation = relationshipExplanation[3];
            } 
            else {
              if (p2GreatGreatAncestorGender === 'Male') {
                  relation = `جد ${translatedName1} و جد أم ${translatedName2} اخوة`;
              } 
              else {
                  relation = `جد ${translatedName1} و جدة أم ${translatedName2} اخوة`;
              }
              score = 60;
              explanation = relationshipExplanation[4];
            }
          } 
          else {
            if (p2AncestorGender === 'Male') {
              if (p2GreatGreatAncestorGender === 'Male') {
                  relation = `جدة ${translatedName1} و جد أب ${translatedName2} اخوة`;
                  score = 85;
              } 
              else {
                  relation = `جدة ${translatedName1} و جدة أب ${translatedName2} أخوات`;
                  score = 80;
              }
              score = 65;
              explanation = relationshipExplanation[3];
            } 
            else {
              if (p2GreatGreatAncestorGender === 'Male') {
                  relation = `جدة ${translatedName1} و جد أم ${translatedName2} اخوة`;
                  score = 75;
              } else {
                  relation = `جدة ${translatedName1} و جدة أم ${translatedName2} أخوات`;
                  score = 70;
              }
              score = 60;
              explanation = relationshipExplanation[4];
            }
          }
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
                } 
                else {
                  relation = `جد أب ${translatedName1} و جدة أب ${translatedName2} اخوة`;
                }
                score = 65;
                explanation = relationshipExplanation[3];
              } 
              else{
                if (p2GreatGreatAncestorGender === 'Male'){
                  relation = `جد أم ${translatedName1} و جد أم ${translatedName2} اخوة`;
                } 
                else {
                  relation = `جد أم ${translatedName1} و جدة أم ${translatedName2} اخوة`;
                }
                score = 60;
                explanation = relationshipExplanation[4];
              } 
            }
            else {
              if (p2AncestorGender === 'Male') {
                if (p2GreatGreatAncestorGender === 'Male'){
                  relation = `جد أب ${translatedName1} و جد أب ${translatedName2} اخوة`;
                } 
                else {
                  relation = `جد أب ${translatedName1} و جدة أب ${translatedName2} اخوة`;
                }
                score = 65;
                explanation = relationshipExplanation[3];
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
            score = 60;
            explanation = relationshipExplanation[4];
            }
          }
          else {
            if (p1AncestorGender === 'Male') {
              if (p2AncestorGender === 'Male') {
                if (p2GreatGreatAncestorGender === 'Male'){
                  relation = `جدة أب ${translatedName1} و جد أب ${translatedName2} اخوة`;
                } 
                else {
                  relation = `جدة أب ${translatedName1} و جدة أب ${translatedName2} اخوة`;
                }
                score = 60
                explanation = relationshipExplanation[3];
              } 
              else{
                if (p2GreatGreatAncestorGender === 'Male'){
                  relation = `جدة أم ${translatedName1} و جد أم ${translatedName2} اخوة`;
                } 
                else {
                  relation = `جدة أم ${translatedName1} و جدة أم ${translatedName2} اخوة`;
                }
                score = 65;
                explanation = relationshipExplanation[4];
              } 
            } 
            else {
              if (p2AncestorGender === 'Male') {
                if (p2GreatGreatAncestorGender === 'Male'){
                  relation = `جدة أب ${translatedName1} و جد أب ${translatedName2} اخوة`;
                } 
                else {
                  relation = `جدة أب ${translatedName1} و جدة أب ${translatedName2} اخوة`;
                }
                score = 60;
                explanation = relationshipExplanation[3];
              } 
              else{
                if (p2GreatGreatAncestorGender === 'Male'){
                  relation = `جدة أم ${translatedName1} و جد أم ${translatedName2} اخوة`;
                } 
                else{
                  relation = `جدة أم ${translatedName1} و جدة أم ${translatedName2} اخوة`;
                }
                score = 55;
                explanation = relationshipExplanation[4];
              }
            }
          }
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
                score = 55;
                explanation = relationshipExplanation[3];
              }
              else {
                if (p1SecondGreatAncestorGender === 'Male'){
                  relation = `جد أب ${translatedName1} و جدة ${translatedName2} أولاد عم`;
                }
                else{
                  relation = `جدة أب ${translatedName1} و جدة ${translatedName2} أولاد عم`;
                }
                score = 55;
                explanation = relationshipExplanation[3];
              }
            } 
            else{
              if (p1SecondGreatAncestorGender === 'Male'){
                relation = `جد أب ${translatedName1} و جد ${translatedName2} أولاد الخال/العم`;
              }
              else{
                relation = `جدة أب ${translatedName1} و جد ${translatedName2} أولاد الخالة/العمة`;
              }
              score = 55;
              explanation = relationshipExplanation[3];
            }
          }
          else {
            if (p1thirdGreatAncestor === 'Male' && p2SecondGreatAncestorGender === 'Male'){
              if (p1SecondGreatAncestorGender === 'Male'){
                relation = `جد أم ${translatedName1} و جد ${translatedName2} أولاد عم`;
              }
              else{
                relation = `جدة أم ${translatedName1} و جد ${translatedName2} أولاد عم`;
              }
              score = 55;
              explanation = relationshipExplanation[4];
            } 
            else{
              if (p1SecondGreatAncestorGender === 'Male'){
              relation = `جد أم ${translatedName1} و جد ${translatedName2} أولاد الخال/العم`;
              }
              else{
                relation = `جدة أم ${translatedName1} و جد ${translatedName2} أولاد الخالة/العمة`;
              }
              score = 50;
              explanation = relationshipExplanation[4];
            }
          }
        }

        else if (p1Level === p2Level){
          switch (p1Level){
            case 5: relation = 'هذان الشخصان يشتركان في الجد الثالث'; break;
            case 6: relation = 'هذان الشخصان يشتركان في الجد الرابع'; break;
            case 7: relation = 'هذان الشخصان يشتركان في الجد الخامس'; break;
            case 8: relation = 'هذان الشخصان يشتركان في الجد السادس'; break;
            case 9: relation = 'هذان الشخصان يشتركان في الجد السابع'; break;
            default: relation = 'هذان الشخصان يشتركان في جد بعيد.';
          }
          
        }

        else {
          setLoading(false);
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
            relationshipType = "Blood";
            const ancestorGender = ancestor.ancestorGender;
            ancestor.ancestorGender = ancestorGender;
            return {relation, score, 
                    generation:Math.abs(p1Level-p2Level), 
                    levelsTuple: {levelFromP1, levelFromP2},
                    explanation,
                    ancestor,
                    relationshipType,
                    treeData,
                    person1ID,
                    person2ID,
                    person1: person1Matches[0], 
                    person2: person2Matches[0],
                  };
        }
      }
    }
  };

  const checkMarriage = async (person1ID, person2ID, gender1, gender2) => {
    if (gender1 === gender2) {return {areMarried : false}}
        setLoadingMessage("جاري البحث عن علاقة زواج");
        const result = await session.run(`
        MATCH (p1:Person)-[r:MARRIED_TO]-(p2:Person)
        WHERE (id(p1) = $person1ID AND id(p2) = $person2ID)
           OR (id(p1) = $person2ID AND id(p2) = $person1ID)
        RETURN p1 AS P1, p2 AS P2
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

      OPTIONAL MATCH (Father:Person)-[:FATHER_OF]->(P)
      WHERE Father.gender = 'Male'

      OPTIONAL MATCH (Mother:Person)-[:MOTHER_OF]->(P)
      WHERE Mother.gender = 'Female'

      OPTIONAL MATCH (Father)-[:FATHER_OF|MOTHER_OF]->(Sibling:Person)
      WHERE Sibling <> P

      OPTIONAL MATCH (Mother)-[:FATHER_OF|MOTHER_OF]->(Sibling2:Person)
      WHERE Sibling2 <> P

      WITH P, Father, Mother, collect(DISTINCT Sibling) + collect(DISTINCT Sibling2) AS AllSiblings

      OPTIONAL MATCH (sibling:Person)-[:MARRIED_TO]-(SiblingSpouse:Person)
      WHERE sibling IN AllSiblings

      OPTIONAL MATCH (P)-[:FATHER_OF|MOTHER_OF]->(Child:Person)
      OPTIONAL MATCH (Child)-[:MARRIED_TO]-(ChildSpouse:Person)

      RETURN 
        id(Father) AS fatherId,
        id(Mother) AS motherId,
        [s IN AllSiblings | id(s)] AS siblingIds,
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

    const spouseFamilyQuery = `
      MATCH (P:Person)-[:MARRIED_TO]-(Spouse:Person)
      WHERE id(P) = $personId

      OPTIONAL MATCH (SFather:Person)-[:FATHER_OF|MOTHER_OF]->(Spouse)
      WHERE SFather.gender = 'Male'

      OPTIONAL MATCH (SMother:Person)-[:FATHER_OF|MOTHER_OF]->(Spouse)
      WHERE SMother.gender = 'Female'

      OPTIONAL MATCH (SFather)-[:FATHER_OF|MOTHER_OF]->(SSibling1:Person)
      WHERE SSibling1 <> Spouse

      OPTIONAL MATCH (SMother)-[:FATHER_OF|MOTHER_OF]->(SSibling2:Person)
      WHERE SSibling2 <> Spouse

      WITH P, Spouse, SFather, SMother, collect(DISTINCT SSibling1) + collect(DISTINCT SSibling2) AS sSiblings

      OPTIONAL MATCH (sibling:Person)-[:MARRIED_TO]-(SSiblingSpouse:Person)
      WHERE sibling IN sSiblings

      OPTIONAL MATCH (Spouse)-[:FATHER_OF|MOTHER_OF]->(Child:Person)
      OPTIONAL MATCH (Child)-[:MARRIED_TO]-(ChildSpouse:Person)

      RETURN 
        id(SFather) AS sFatherId,
        id(SMother) AS sMotherId,
        [s IN sSiblings | id(s)] AS sSiblingIds,
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

    const match = (id) => {
      return id !== null && id === person2ID;
    };

    const isIn = (list) => {
      const result = list.some(id => id === person2ID);
      return result;
    };

    if (isIn(sSiblingIds)) {
      if (gender1 === 'Male') {
        return `${translatedName1} هو زوج اخت ${translatedName2}`;
      } else {
        return `${translatedName1} هي زوجة اخ ${translatedName2}`;
      }
    }
    if (isIn(siblingSpouseIds)) {
      if (gender1 === 'Male') {
        if(gender2 === 'Male'){
          return `${translatedName1} هو اخ زوجة ${translatedName2}`;
        }
        else{
          return `${translatedName1} هو اخ زوج ${translatedName2}`;
        }
      } 
      else {
        if(gender2 === 'Male'){
          return `${translatedName1} هي اخت زوجة ${translatedName2}`;
        }
        else{
          return `${translatedName1} هي اخت زوج ${translatedName2}`;
        }
      }
    }
    if (isIn(fchildrenSpouseIds)) {
      if (gender1 === 'Male') {
        return `${translatedName1} هو أب زوجة ${translatedName2}`;
      } 
      else {
        return `${translatedName1} هي أم زوجة ${translatedName2}`;
      }
    }
    if (match(sFatherId) || match(sMotherId)) {
      if (gender1 === 'Male') {
        console.log(`${translatedName1} هو زوج ابنة ${translatedName2}`);
        return `${translatedName1} هو زوج ابنة ${translatedName2}`;
      } 
      else {
        console.log(`${translatedName1} هي زوجة ابن ${translatedName2} | ${translatedName1} هي كنة ${translatedName2}`);
        return `${translatedName1} هي زوجة ابن ${translatedName2} | ${translatedName1} هي كنة ${translatedName2}`;
      }
    }
    return "لا توجد علاقة واضحة";
  };

  const getAncestors = async (person1ID, person2ID) => {
    setLoadingMessage("جاري البحث عن الأجداد المشتركة");
    const result = await session.run(`
      MATCH path1 = (common:Person)-[:FATHER_OF|MOTHER_OF*0..11]->(p1:Person)
      WHERE id(p1) = $person1ID

      MATCH path2 = (common)-[:FATHER_OF|MOTHER_OF*0..11]->(p2:Person)
      WHERE id(p2) = $person2ID AND id(p1) <> id(p2)

      WITH common, path1, path2, length(path1) AS level1, length(path2) AS level2

      OPTIONAL MATCH (cGF:Person)-[:FATHER_OF]->(cF:Person)-[:FATHER_OF]->(common)
      OPTIONAL MATCH (common)-[:MARRIED_TO]-(spouse:Person)<-[:FATHER_OF]-(sF:Person)<-[:FATHER_OF]-(sGF:Person)

      WITH common, cF, cGF, spouse, path1, path2, level1, level2,  sF, sGF
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

        CASE 
          WHEN spouse IS NOT NULL THEN { 
            id: id(spouse), 
            name: spouse.name,
            father: sF.name,
            grandfather: sGF.name,
            lastName: spouse.lastName, 
            gender: spouse.gender 
          }
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

  const getFullTranslatedName = async(personName, personFatherName, personGrandfatherName, personLastName) => {
    const isArabic = (text) => /[\u0600-\u06FF]/.test(text);
    let translatedPersonName = isArabic(personName) ? utils.translateName(personName, false) : personName;
    let translatedPersonFatherName = isArabic(personFatherName) ? utils.translateName(personFatherName, false) : personFatherName;
    let translatedPersonGrandfatherName = isArabic(personGrandfatherName) ? utils.translateName(personGrandfatherName, false) : personGrandfatherName;
    let translatedPersonLastName = isArabic(personLastName) ? utils.translateFamilyName(personLastName, false) : personLastName;
    return {translatedPersonName, translatedPersonFatherName, translatedPersonGrandfatherName, translatedPersonLastName}
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
              onChange={(e) =>{
                setSelectedPerson1(e.target.value); 
                setPerson1(e.target.value)}
              }
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
                onChange={(e) =>{
                  setSelectedPerson2(e.target.value); 
                  setPerson2(e.target.value)}
                }
                className="inputNames"
              />
            </div>
          </div>
          <div className='ButtonSection'>
            <button type="submit" className="button checkButton">تحقق من العلاقة</button>
            <button type="reset" className="button resetButton" onClick={handleReset}>إلغاء</button>
            <button
              type="button"
              className="button swapButton"
              onClick={() => {
                setPerson1(person2);
                setPerson2(person1);
                setSelectedPerson1(selectedPerson2);
                setSelectedPerson2(selectedPerson1);
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
                      <th className='IDC'>الرقم التسلسلي</th>
                      <th>الاسم</th>
                      <th>سنة الميلاد</th>
                      <th>سنة الوفاة</th>
                      <th>اختيار</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duplicates.person1.map((p, idx) => {
                      const fullName =
                        (utils.translateName(p.name)) +
                      (p.father
                        ? (p.gender === 'Female'
                            ? ` بنت ${utils.translateName(p.father)} `
                            : ` بن ${utils.translateName(p.father)} `)
                        : '') +
                      (p.grandfather ? ` بن ${utils.translateName(p.grandfather)} ` : '') +
                      (p.lastName ? `${utils.translateFamilyName(p.lastName)}` : '');
                      return (
                        <tr key={`p1-${idx}`}>
                          <td className='IDC'>{p.id}</td>
                          <td>{fullName}</td>
                          <td>{p.YoB !== -1 ? p.YoB : ''}</td>
                          <td>{p.YoD !== -1 ? p.YoD : ''}</td>
                          <td>
                            <button
                              type="button"
                              className="duplicate-button"
                              onClick={(e) => {
                                setSelectedPerson1(p);
                                setPerson1(fullName);
                                if (selectedPerson2) {
                                  fetchRelationship(e, p.id, selectedPerson2.id);
                                }
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
                      <th className='IDC'>الرقم التسلسلي</th>
                      <th>الاسم</th>
                      <th>سنة الميلاد</th>
                      <th>سنة الوفاة</th>
                      <th>اختيار</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duplicates.person2.map((p, idx) => {
                    const fullName =
                      (utils.translateName(p.name)) +
                      (p.father
                        ? (p.gender === 'Female'
                            ? ` بنت ${utils.translateName(p.father)} `
                            : ` بن ${utils.translateName(p.father)} `)
                        : '') +
                      (p.grandfather ? ` بن ${utils.translateName(p.grandfather)} ` : '') +
                      (p.lastName ? ` ${utils.translateFamilyName(p.lastName)}` : '');

                      return (
                        <tr key={`p2-${idx}`}>
                          <td className='IDC'>{p.id}</td>
                          <td>{fullName}</td>
                          <td>{p.YoB !== -1 ? p.YoB : ''}</td>
                          <td>{p.YoD !== -1 ? p.YoD : ''}</td>
                          <td>
                            <button
                              type="button"
                              className="duplicate-button"
                              onClick={(e) => {
                                setSelectedPerson2(p);
                                setPerson2(fullName);
                                if (selectedPerson1) {
                                  fetchRelationship(e, selectedPerson1.id, p.id);
                                }
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

      {error && <div className="error-message">
        {error}
        </div>}
        {selectedPerson1 && selectedPerson2  && error && (
          <div id="confirm"><p>الرجاء تأكيد الاختيار عبر الضغط على زر التحقق من العلاقة.</p></div>
        )}
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
                {relationship.relationshipPerson1Details?.father &&
                (relationship.relationshipPerson1Details.gender === 'Male'
                  ? ` بن ${utils.translateName(relationship.relationshipPerson1Details.father)}`
                  : ` بنت ${utils.translateName(relationship.relationshipPerson1Details.father)}`)}
                   {relationship.relationshipPerson1Details?.grandfather && ` بن ${utils.translateName(relationship.relationshipPerson1Details.grandfather)}`} 
                {relationship.relationshipPerson1Details?.lastName && ` ${utils.translateFamilyName(relationship.relationshipPerson1Details.lastName)}`}
              </h4>
            </div>
          <div className="person-card">
            <h4>
              {utils.translateName(relationship.relationshipPerson2Details?.name ?? '')} 
                {relationship.relationshipPerson2Details?.father &&
                (relationship.relationshipPerson2Details.gender === 'Male'
                  ? ` بن ${utils.translateName(relationship.relationshipPerson2Details.father)}`
                  : ` بنت ${utils.translateName(relationship.relationshipPerson2Details.father)}`)}              {relationship.relationshipPerson2Details?.grandfather && ` بن ${utils.translateName(relationship.relationshipPerson2Details.grandfather)}`} 
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
                      relationship.relationshipType === "Marriage-related" ? "علاقة نسب" :
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
                    {' '} {relationship.relationshipExplanationDesc ?? "لا يوجد تفسير متاح."}
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
                    {relationship.commonAncestor && (
                      <>
                        {relationship.commonAncestor?.ancestorName &&
                          utils.translateName(relationship.commonAncestor.ancestorName)}{' '}
                        
                        {relationship.commonAncestor?.ancestorFatherName && (
                          relationship.commonAncestor.ancestorGender === 'Male'
                            ? `بن ${utils.translateName(relationship.commonAncestor.ancestorFatherName)} `
                            : `بنت ${utils.translateName(relationship.commonAncestor.ancestorFatherName)} `
                        )}

                        {relationship.commonAncestor?.ancestorGrandFatherName && (
                          `بن ${utils.translateName(relationship.commonAncestor.ancestorGrandFatherName)} `
                        )}

                        {relationship.commonAncestor?.ancestorLastName &&
                          utils.translateFamilyName(relationship.commonAncestor.ancestorLastName)}
                      </>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
                {relationship.ancestorstreeData && (
                  <>
                  <h2 id="resultTitle">شجرة العائلة الي تجمع الشخصين :</h2>
                  <div className="tree-wrapper" style={{
              height: `${Math.max(
                ((Math.max(relationship.relationshipLevels?.levelFromP1 ?? 0, relationship.relationshipLevels?.levelFromP2 ?? 0)) + 1) * 100,
                100
              ) + 1}px`
            }}>
                  <>
                  
                  
                  <div className="tree-container">
                  <Tree
                    data={relationship.ancestorstreeData}
                    orientation="vertical"
                    pathFunc="step"
                    nodeSize={{ x: 60, y: 90 }} 
                    separation={{ siblings: 3, nonSiblings: 3 }}
                    translate={{ x: 500, y: 30 }} 
                    renderCustomNodeElement={({ nodeDatum }) => (
                    <g className="tree-node">
                        <title>{nodeDatum.id}</title>
                        <rect
                          className="tree-node-rect"
                          x="-50"
                          y="-20"
                          width="125"
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
                          x="12.5"
                          y="5"
                          style={{
                            fontSize: '16px',
                            fontFamily: 'Cairo',
                            fill: nodeDatum.id === relationship.person1ID || nodeDatum.id === relationship.person2ID
                              ? '#388e3c'
                              : nodeDatum.id === relationship.commonAncestor.ancestorID
                              ? '#ff9800'
                              : '#333',
                            textAnchor: 'middle',
                            dominantBaseline: 'middle',
                            letterSpacing: '1px',
                            strokeWidth: '1px',
                            pointerEvents: 'none',
                          }}
                        >
                          {utils.translateNodeName(nodeDatum.name)}
                        </text>
                      </g>
                    )}
                  />
                </div>
                  </>
                </div>
                </>
              )}
              
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
