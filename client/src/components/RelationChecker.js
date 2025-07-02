import React, { useEffect, useState, useRef } from 'react';
import Tree from 'react-d3-tree';
import '../styles/RelationChecker.css';
import * as utils from '../utils/utils';
import usePageTracking from '../utils/trackers';

const neo4jURI = process.env.REACT_APP_NEO4J_URI;
const neo4jUser = process.env.REACT_APP_NEO4J_USER;
const neo4jPassword = process.env.REACT_APP_NEO4J_PASSWORD;

const driver = require('neo4j-driver').driver(
    neo4jURI,
    require('neo4j-driver').auth.basic(neo4jUser, neo4jPassword)
);
const session = driver.session();

function formatPerson(person) {
  if (!person) return '';
  const name = utils.translateName(person.name ?? '');
  const fatherPart =
    person.father &&
    (person.gender === 'Male'
      ? ` بن ${utils.translateName(person.father)}`
      : ` بنت ${utils.translateName(person.father)}`);
  const grandfatherPart =
    person.grandfather ? ` بن ${utils.translateName(person.grandfather)}` : '';
  const lastNamePart = person.lastName
    ? ` ${utils.translateFamilyName(person.lastName)}`
    : '';
  return `${name}${fatherPart || ''}${grandfatherPart}${lastNamePart}`;
};

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
  const [focusAfterLoadId, setFocusAfterLoadId] = useState(null);
  const treeContainerRef = useRef(null);
  const [lookoutMode, setLookoutMode] = useState('Blood');
  const [inLawsRelation, setInLawsRelation] = useState(null);
  const [history, setHistory] = useState([]);
  const [config, setConfig] = useState({
    translate: { x: 0, y: 0 },
    nodeSize: { x: 0, y: 0 },
    separation: { siblings: 0, nonSiblings: 0 },
    fontSize : 0,
  });
  

  usePageTracking();
  useEffect(() => {
      document.title = "ماهي العلاقة بينهما ؟";
    }, []);
  useEffect(() => {
      if (!relationship) return;

      const newEntry = {
        person1: formatPerson(relationship.relationshipPerson1Details),
        person2: formatPerson(relationship.relationshipPerson2Details),
        relation: relationship.relationshipDescription,
      };

      setHistory(prev => [...prev, newEntry]);
    }, [relationship]);

  function RelationHistory({ relationship }) {
    return (
      <div className="History">
        <h2>تاريخ العلاقات</h2>
        <table>
          <thead>
            <tr id="heading">
              <th className="personZone">الشخص الأول</th>
              <th className="personZone">الشخص الثاني</th>
              <th className="relationZone">العلاقة</th>
            </tr>
          </thead>
          <tbody>
            {history.map((item, index) => (
              <tr key={index}>
                <td className="personZone">{item.person1}</td>
                <td className="personZone">{item.person2}</td>
                <td className="relationZone">{item.relation}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" onClick={() => {setHistory([])}} className="clearButton">مسح التاريخ</button>
      </div>
    );
  };

  const handleReset = async () => {
    setPerson1('');
    setPerson2('');
    setSelectedPerson1('');
    setSelectedPerson2('');
    setLoading(false);
    setError(false);
    setRelationship('');
    setFocusAfterLoadId(-1);
    setDuplicates({ person1: [], person2: [] });
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
    setRelationship(null);
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
            person2Matches,
            lookoutMode
          );
        }
      } 
      else {
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
          [selectedPerson2],
          lookoutMode
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
        gender1: result.person1.gender,
        gender2: result.person2.gender,
        ancestorGender: result.ancestorGender
      });
      
      if (result.ancestor){
        setFocusAfterLoadId(result.ancestor.ancestorID);
      }
      
    } catch (error) {
      console.error('❌ Error fetching relationship:', error);
      setRelationship({ relationshipDescription: 'حدث خطأ أثناء البحث', relationshipScore: null });
      setError(true);
      if (errorContainer) {
        errorContainer.innerText = `❌ خطأ: ${error.message || error}`;
      }
    } finally {
      setLoading(false);
      console.log(relationship);
      console.log("🛑 fetchRelationship END");
    }
  };

  const findRelationship = async (person1ID, person2ID, gender1, gender2, translatedName1, translatedName2, person1Matches, person2Matches, lookoutMode) => {
    
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
    if (lookoutMode === 'Blood'){
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
        let relationRecord = await getAncestors(person1ID, person2ID);
        console.log(relationRecord);     
          const ancestorID = relationRecord.id;
          const ancestorName = relationRecord.name ? utils.translateName(relationRecord.name) : '';
          const ancestorFatherName = relationRecord.fatherName ? utils.translateName(relationRecord.fatherName) : '';
          const ancestorGrandFatherName = relationRecord.grandfatherName ? utils.translateName(relationRecord.grandfatherName) : '';
          const ancestorLastName = relationRecord.lastName ? utils.translateFamilyName(relationRecord.lastName) : '';
          const ancestorGender = relationRecord.gender;
          let levelFromP1, levelFromP2, pathFromAncestorToP1, pathFromAncestorToP2;
          let spouseOfAncestor = relationRecord.spouseOfAncestor;
          let f1 = relationRecord.f1;
          let f2 = relationRecord.f2;
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

          if ((spouseOfAncestor !== null) && (ancestorID !== person1ID) && (ancestorID !== person2ID) && (spouseOfAncestor.gender === 'Male') && (f1 == f2)) {
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
            let pronoun = gender1 === 'Male' ? 'هو والد' : "هي والدة";
            relation = `${translatedName1} ${pronoun} ${translatedName2}`;
            score = 100;
            explanation = relationshipExplanation[0];
          }
          else if (p1Level === 0 && p2Level === 2) {
            const p2AncestorGender = pathToP2[1].gender;
            let side = p2AncestorGender === 'Male' ? "من الأب" : "من الأم";
            let pronoun = gender2 === 'Male' ? "جد" : "جدة";

            relation = `${translatedName1} ${pronoun} ${translatedName2} ${side}`;
            score = 90;
            explanation = relationshipExplanation[0];
          }
          else if (p1Level === 0 && p2Level === 3) {
            const p2AncestorGender = pathToP2[1].gender;    
            const p2GreatAncestorGender = pathToP2[2].gender;         
            let P2prefix1 = gender2 === 'Male' ? "أب" : "أم";
            let P2prefix2 = p2GreatAncestorGender === 'Male' ? "جد" : "جدة";
            let P2prefix3 = p2AncestorGender === 'Male' ? "من الأب" : "من الأم";
            

            relation = ` ${translatedName1} ${P2prefix1} ${P2prefix2} ${translatedName2} ${P2prefix3}`;
            score = 90;
            explanation = relationshipExplanation[1];
          }
          else if (p1Level === 0 && p2Level === 4) { 
            const p2AncestorGender = pathToP2[1].gender;    
            const p2GreatAncestorGender = pathToP2[2].gender;         
            let P2prefix1 = gender2 === 'Male' ? "حفيد" : "حفيدة";
            let P2prefix2 = p2GreatAncestorGender === 'Male' ? "من الإبن" : "من الإبنة";
            let P2prefix3 = p2AncestorGender === 'Male' ? "جد" : "جدة";
            let P2prefix4 = p2AncestorGender === 'Male' ? "من الأب" : "من الأم";
            let pronoun = gender2 === 'Male' ? "هو" : "هي"

            relation = `${P2prefix1} ${translatedName1} ${P2prefix2} ${pronoun} ${P2prefix3} ${translatedName2} ${P2prefix4} `;
            score = 70;
            explanation = relationshipExplanation[1];
          }

          else if (p1Level === 1 && p2Level === 0) {
            let prefix1 = gender1 === 'Male' ? "هو إبن" : "هي إبنة";
            relation = `${translatedName1} ${prefix1} ${translatedName2}`;
            score = 100;
            explanation = relationshipExplanation[0];
          } 
          else if (p1Level === 1 && p2Level === 1) {
            let r1 = (gender1 === 'Female' && gender2 === 'Female') ? "أخوات" : "إخوة";
            relation = `${translatedName1} و ${translatedName2} ${r1}`;
            score = 99;
            explanation = relationshipExplanation[0];
          }
          else if (p1Level === 1 && p2Level === 2) {
            const p2AncestorGender = pathToP2[1].gender;
            let relationPrefix;

            if (p2AncestorGender === 'Male') {
              relationPrefix = gender1 === 'Female' ? 'عمة' : 'عم';
            } else {
              relationPrefix = gender1 === 'Female' ? 'خالة' : 'خال';
            }

            relation = `${translatedName1} ${relationPrefix} ${translatedName2}`;
            score = (relationPrefix === 'عم' || relationPrefix === 'عمة') ? 95 : 94;
            explanation = relationshipExplanation[1];
          }
          else if (p1Level === 1 && p2Level === 3) {
            const p2AncestorGender = pathToP2[1].gender;
            const p2GreatAncestorGender = pathToP2[2].gender;

            let relationPrefix;
            let score;

            if (p2AncestorGender === 'Male') {
              if (p2GreatAncestorGender === 'Male') {
                relationPrefix = gender1 === 'Female' ? 'عمة والد' : 'عم والد';
                score = 80;
              } else {
                relationPrefix = gender1 === 'Female' ? 'خالة والد' : 'خال والد';
                score = 75;
              }
            } else {
              if (p2GreatAncestorGender === 'Male') {
                relationPrefix = gender1 === 'Female' ? 'عمة والدة' : 'عم والدة';
                score = 75;
              } else {
                relationPrefix = gender1 === 'Female' ? 'خالة والدة' : 'خال والدة';
                score = 70;
              }
            }

            relation = `${translatedName1} ${relationPrefix} ${translatedName2}`;
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
          else if (p1Level === 1 && p2Level === 5) {
            const p2GreatAncestorGender = pathToP2[2].gender;
            const p2AncestorGender = pathToP2[1].gender;
            const p2thirdGreatAncestor = pathToP2[4].gender;

            let P2prefix1 = p2thirdGreatAncestor === 'Male' ? "جد" : "جدة";
            let P2prefix2 = p2GreatAncestorGender === 'Male' ? "جد" : "جدة";
            let P2prefix3 = p2AncestorGender === 'Male' ? "من الأب" : "من الأم";

            let siblingsWord = (p2thirdGreatAncestor === 'Female' && gender1 === 'Female') ? "أخوات" : "إخوة";
            score = 45;
            relation = `${translatedName1} و ${P2prefix1} ${P2prefix2} ${translatedName2} ${P2prefix3} ${siblingsWord}`;
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
          else if (p1Level === 2 && p2Level === 1) {
            const p1AncestorGender = pathToP1[1].gender;
            let relationPrefix;

            if (p1AncestorGender === 'Male') {
              relationPrefix = 'ابن أخ';
            } else {
              relationPrefix = 'ابن أخت';
            }

            if (gender1 === 'Female') {
              relationPrefix = relationPrefix.replace('ابن', 'ابنة');
            }

            relation = `${translatedName1} ${relationPrefix} ${translatedName2}`;
            score = 93;
            explanation = relationshipExplanation[1];
          }
          else if (p1Level === 2 && p2Level === 2) {    
            const p1AncestorGender = pathToP1[1].gender;
            const p2AncestorGender = pathToP2[1].gender;
            let relationPrefix;

            if (gender1 === 'Male') {
              if (p2AncestorGender === 'Male') {
                relationPrefix = p1AncestorGender === 'Male' ? 'إبن عم' : 'إبن عمّة';
                score = p1AncestorGender === 'Male' ? 90 : 89;
                explanation = relationshipExplanation[1];
              } else {
                relationPrefix = p1AncestorGender === 'Male' ? 'إبن خال' : 'إبن خالة';
                score = p1AncestorGender === 'Male' ? 88 : 87;
                explanation = relationshipExplanation[2];
              }
            } else {
              if (p1AncestorGender === 'Male') {
                relationPrefix = p2AncestorGender === 'Male' ? 'إبنة عمّ' : 'إبنة خال';
                score = p2AncestorGender === 'Male' ? 90 : 89;
                explanation = relationshipExplanation[1];
              } else {
                relationPrefix = p2AncestorGender === 'Male' ? 'إبنة عمة' : 'إبنة خالة';
                score = p2AncestorGender === 'Male' ? 88 : 87;
                explanation = relationshipExplanation[2];
              }
            }

            relation = `${translatedName1} ${relationPrefix} ${translatedName2}`;
          }
          else if (p1Level === 2 && p2Level === 3) {         
            const p1AncestorGender = pathToP1[1].gender;
            const p2AncestorGender = pathToP2[1].gender;
            const p2GreatAncestorGender = pathToP2[2].gender;

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
          else if (p1Level === 2 && p2Level === 4) {
            const p2AncestorGender = pathToP2[1].gender;
            const p2GreatAncestorGender = pathToP2[2].gender; 

            if (gender1 === 'Male') {
              if (p2AncestorGender === 'Male') {
                if (p2GreatAncestorGender === 'Male') {
                  relation = `جد ${translatedName1 } وجد جد  ${translatedName2} إخوة`;
                  score = 75;
                } else {
                  relation = `جد ${translatedName1} هو وجدة جد ${translatedName2} إخوة`;
                  score = 65;
                }
                explanation = relationshipExplanation[3];
              } 
              else {
                if (p2GreatAncestorGender === 'Male') {
                  relation = `جد ${translatedName1} هو  وجدة جد ${translatedName2} إخوة`;
                  score = 75;
                } else {
                  relation = `جد ${translatedName1} هو  وجدة جد ${translatedName2} إخوة`;
                  score = 65;
                }
                explanation = relationshipExplanation[4];
              }

            } 
            else {
              if (p2AncestorGender === 'Male') {
                if (p2GreatAncestorGender === 'Male') {
                  relation = `جدة ${translatedName1} هي وجد جد ${translatedName2} إخوة`;
                  score = 65;
                } else {
                  relation = `جدة ${translatedName1} هي وجدة جد ${translatedName2} إخوة`;
                  score = 60;
                }
                explanation = relationshipExplanation[3];
              } else {
                if (p2GreatAncestorGender === 'Male') {
                  relation = `جدة ${translatedName1} هي وجدة جد ${translatedName2} إخوة`;
                  score = 65;
                } else {
                  relation = `جدة ${translatedName1} هي وجدة جد ${translatedName2} إخوة`;
                  score = 60;
                }
                explanation = relationshipExplanation[4];
              }
            }
            
          }
          else if (p1Level === 2 && p2Level === 5) {
            const p2GreatAncestorGender = pathToP2[2].gender;
            const p2AncestorGender = pathToP2[1].gender;
            const p2thirdGreatAncestor = pathToP2[4].gender;

            const p1AncestorGender = pathToP1[1].gender;
            const p1GreatAncestorGender = pathToP1[2].gender;

            let P2prefix1 = p2thirdGreatAncestor === 'Male' ? "جد" : "جدة";
            let P2prefix2 = p2GreatAncestorGender === 'Male' ? "جد" : "جدة";
            let P2prefix3 = p2AncestorGender === 'Male' ? "من الأب" : "من الأم";

            let P1prefix1 = p1GreatAncestorGender === 'Male' ? "أب" : "أم";

            let siblingsWord = (p2thirdGreatAncestor === 'Female' && p1GreatAncestorGender === 'Female') ? "أخوات" : "إخوة";
            score = 45;
            relation = `${P1prefix1} ${translatedName1} و ${P2prefix1} ${P2prefix2} ${translatedName2} ${P2prefix3} ${siblingsWord}`;
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
          else if (p1Level === 3 && p2Level === 5) {
            const p2GreatAncestorGender = pathToP2[2].gender;
            const p2AncestorGender = pathToP2[1].gender;
            const p2thirdGreatAncestor = pathToP2[4].gender;

            const p1AncestorGender = pathToP1[1].gender;
            const p1GreatAncestorGender = pathToP1[2].gender;

            let P2prefix1 = p2thirdGreatAncestor === 'Male' ? "جد" : "جدة";
            let P2prefix2 = p2GreatAncestorGender === 'Male' ? "جد" : "جدة";
            let P2prefix3 = p2AncestorGender === 'Male' ? "من الأب" : "من الأم";

            let P1prefix1 = p1GreatAncestorGender === 'Male' ? "جد" : "جدة";
            let P1prefix2 = p1AncestorGender === 'Male' ? "من الأب" : "من الأم";

            let siblingsWord = (p2thirdGreatAncestor === 'Female' && p1GreatAncestorGender === 'Female') ? "أخوات" : "إخوة";
            score = 45;
            relation = `${P1prefix1} ${translatedName1} ${P1prefix2} و ${P2prefix1} ${P2prefix2} ${translatedName2} ${P2prefix3} ${siblingsWord}`;
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
          else if (p1Level === 4 && p2Level === 5) {
            const p2GreatAncestorGender = pathToP2[2].gender;
            const p2AncestorGender = pathToP2[1].gender;
            const p2ThirdGreatAncestor = pathToP2[4].gender;

            const p1AncestorGender = pathToP1[1].gender;
            const p1GreatAncestorGender = pathToP1[2].gender;
            const p1SecondGreatAncestor = pathToP1[3].gender;

            let P2prefix1 = p2ThirdGreatAncestor === 'Male' ? "جد" : "جدة";
            let P2prefix2 = p2GreatAncestorGender === 'Male' ? "جد" : "جدة";
            let P2prefix3 = p2AncestorGender === 'Male' ? "من الأب" : "من الأم";

            let P1prefix1 = p1SecondGreatAncestor === 'Male' ? "أب" : "أم";
            let P1prefix2 = p1GreatAncestorGender === 'Male' ? "جد" : "جدة";
            let P1prefix3 = p1AncestorGender === 'Male' ? "من الأب" : "من الأم";

            let siblingsWord = (p2ThirdGreatAncestor === 'Female' && p1GreatAncestorGender === 'Female') ? "أخوات" : "إخوة";

            score = 45;
            relation = `${P1prefix1} ${P1prefix2} ${translatedName1} ${P1prefix3} و ${P2prefix1} ${P2prefix2} ${translatedName2} ${P2prefix3} ${siblingsWord}`;
          }

          else if (p1Level === 5 && p2Level === 1){
            const p1GreatAncestorGender = pathToP1[2].gender;
            const p1AncestorGender = pathToP1[1].gender;
            const p1thirdGreatAncestor = pathToP1[4].gender;

            const p2AncestorGender = pathToP2[1].gender;
            const p2GreatAncestorGender = pathToP2[2].gender;
            let P1prefix1 = p1thirdGreatAncestor === 'Male' ? "جد" : "جدة"
            let P1prefix2 = p1GreatAncestorGender === 'Male' ? "جد" : "جدة";
            let P1prefix3 = p1AncestorGender === 'Male' ? "من الأب" : "من الأم";

            let siblingsWord = (p1thirdGreatAncestor === 'Female' && p2GreatAncestorGender === 'Female') ? "أخوات" : "إخوة" 
            score = 45;
            relation = `${P1prefix1} ${P1prefix2} ${translatedName1} ${P1prefix3} و ${translatedName2} ${siblingsWord} `
          }
          else if (p1Level === 5 && p2Level === 2) {
            const p1GreatAncestorGender = pathToP1[2].gender;
            const p1AncestorGender = pathToP1[1].gender;
            const p1thirdGreatAncestor = pathToP1[4].gender;

            const p2AncestorGender = pathToP2[1].gender;
            const p2GreatAncestorGender = pathToP2[2].gender;
            let P1prefix1 = p1thirdGreatAncestor === 'Male' ? "جد" : "جدة"
            let P1prefix2 = p1GreatAncestorGender === 'Male' ? "جد" : "جدة";
            let P1prefix3 = p1AncestorGender === 'Male' ? "من الأب" : "من الأم";

            let P2prefix1 = p2GreatAncestorGender === 'Male' ? "أب" : "أم";
            let siblingsWord = (p1thirdGreatAncestor === 'Female' && p2GreatAncestorGender === 'Female') ? "أخوات" : "إخوة" 
            score = 45;
            relation = `${P1prefix1} ${P1prefix2} ${translatedName1} ${P1prefix3} و ${P2prefix1} ${translatedName2} ${siblingsWord} `
          }
          else if (p1Level === 5 && p2Level === 3) {
            const p1GreatAncestorGender = pathToP1[2].gender;
            const p1AncestorGender = pathToP1[1].gender;
            const p1thirdGreatAncestor = pathToP1[4].gender;

            const p2AncestorGender = pathToP2[1].gender;
            const p2GreatAncestorGender = pathToP2[2].gender;
            let P1prefix1 = p1thirdGreatAncestor === 'Male' ? "جد" : "جدة"
            let P1prefix2 = p1GreatAncestorGender === 'Male' ? "جد" : "جدة";
            let P1prefix3 = p1AncestorGender === 'Male' ? "من الأب" : "من الأم";

            let P2prefix1 = p2GreatAncestorGender === 'Male' ? "جد" : "جدة";
            let P2prefix2 = p2AncestorGender === 'Male' ? "من الأب" : "من الأم";
            let siblingsWord = (p1thirdGreatAncestor === 'Female' && p2GreatAncestorGender === 'Female') ? "أخوات" : "إخوة" 
            score = 45;
            relation = `${P1prefix1} ${P1prefix2} ${translatedName1} ${P1prefix3} و ${P2prefix1} ${translatedName2} ${P2prefix2} ${siblingsWord} `

          }
          else if (p1Level === 5 && p2Level === 4){
            const p1GreatAncestorGender = pathToP1[2].gender;
            const p1AncestorGender = pathToP1[1].gender;
            const p1thirdGreatAncestor = pathToP1[4].gender;

            const p2AncestorGender = pathToP2[1].gender;
            const p2GreatAncestorGender = pathToP2[2].gender;
            const p2secondGreatAncestor = pathToP2[3].gender;

            let P1prefix1 = p1thirdGreatAncestor === 'Male' ? "جد" : "جدة"
            let P1prefix2 = p1GreatAncestorGender === 'Male' ? "جد" : "جدة";
            let P1prefix3 = p1AncestorGender === 'Male' ? "من الأب" : "من الأم";

            let P2prefix1 = p2secondGreatAncestor === 'Male' ? "أب" : "أم";
            let P2prefix2 = p2GreatAncestorGender === 'Male' ? "جد" : "جدة";
            let P2prefix3 = p2AncestorGender === 'Male' ? "من الأب" : "من الأم";

            let siblingsWord = (p1thirdGreatAncestor === 'Female' && p2GreatAncestorGender === 'Female') ? "أخوات" : "إخوة" 
            score = 45;
            relation = `${P1prefix1} ${P1prefix2} ${translatedName1} ${P1prefix3} و ${P2prefix1} ${P2prefix2} ${translatedName2}  ${P2prefix3} ${siblingsWord} `
          }
          else if (p1Level === 5 && p2Level === 5){
            const p1AncestorGender = pathToP1[1].gender;
            const p1GreatAncestorGender = pathToP1[2].gender;

            const p1thirdGreatAncestor = pathToP1[4].gender;

            const p2AncestorGender = pathToP2[1].gender;
            const p2GreatAncestorGender = pathToP2[2].gender;
            const p2thirdGreatAncestor = pathToP2[4].gender;

            let P1prefix1 = p1thirdGreatAncestor === 'Male' ? "جد" : "جدة"
            let P1prefix2 = p1GreatAncestorGender === 'Male' ? "جد" : "جدة";
            let P1prefix3 = p1AncestorGender === 'Male' ? "من الأب" : "من الأم";

            let P2prefix1 = p2thirdGreatAncestor === 'Male' ? "جد" : "جدة";
            let P2prefix2 = p2GreatAncestorGender === 'Male' ? "جد" : "جدة";
            let P2prefix3 = p2AncestorGender === 'Male' ? "من الأب" : "من الأم";

            let siblingsWord = (p1thirdGreatAncestor === 'Female' && p2GreatAncestorGender === 'Female') ? "أخوات" : "إخوة" 
            score = 45;
            relation = `${P1prefix1} ${P1prefix2} ${translatedName1} ${P1prefix3} و ${P2prefix1} ${P2prefix2} ${translatedName2}  ${P2prefix3} ${siblingsWord} `
          }
          
          else if (p1Level === p2Level){
            switch (p1Level){
              case 5: relation = 'هذان الشخصان يشتركان في الجد الرابع'; break;
              case 6: relation = 'هذان الشخصان يشتركان في الجد الخامس'; break;
              case 7: relation = 'هذان الشخصان يشتركان في الجد السادس'; break;
              case 8: relation = 'هذان الشخصان يشتركان في الجد السابع'; break;
              case 9: relation = 'هذان الشخصان يشتركان في الجد الثامن'; break;
              case 10: relation = 'هذان الشخصان يشتركان في الجد التاسع'; break;
              case 11: relation = 'هذان الشخصان يشتركان في الجد العاشر'; break;
              default: relation = 'هذان الشخصان يشتركان في جد بعيد.';
            }
          }

          else{
            relation = "لا توجد علاقة واضحة.";
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
    else if (lookoutMode === "In-Law"){
      setLoading(true);
      setLoadingMessage("جاري البحث عن علاقة نسب");
      relation = await getMarriageRelation(session, person1ID, person2ID, translatedName1, translatedName2, gender1, gender2);
      if (relation){
        setLoading(false);
        setLoadingMessage("🔎بداية البحث عن علاقة النسب ...");
        relationshipType = "Marriage-related";
        explanation = relationshipExplanation[6];
        setInLawsRelation({relation, relationshipType, explanation, 
          person1:  relationship.relationshipPerson1Details, person2:  relationship.relationshipPerson2Details});
      }
      else {
        setError("لا يوجد اي قاسم مشترك أو علاقة مشتركة بين هاذين الشخصين.");
        setError(true);
        setInLawsRelation({relation: "لا توجد علاقة نسب بين هاذين الشخصين", relationshipType, explanation, person1: person1Matches[0], person2: person2Matches[0]});
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
    setInLawsRelation(null);
    console.log(gender1, gender2);
    const ownFamilyQuery = `
      MATCH (P:Person)
      WHERE id(P) = $personId

      OPTIONAL MATCH (Father:Person)-[:FATHER_OF]->(P)
      OPTIONAL MATCH (Mother:Person)-[:MOTHER_OF]->(P)

      OPTIONAL MATCH (Father)-[:FATHER_OF|MOTHER_OF]->(Sibling1:Person)
      WHERE Sibling1 <> P
      OPTIONAL MATCH (Mother)-[:FATHER_OF|MOTHER_OF]->(Sibling2:Person)
      WHERE Sibling2 <> P

      WITH P, Father, Mother, collect(DISTINCT Sibling1) + collect(DISTINCT Sibling2) AS AllSiblings

      OPTIONAL MATCH (sibling:Person)-[:MARRIED_TO]-(SiblingSpouse:Person)
      WHERE sibling IN AllSiblings

      OPTIONAL MATCH (P)-[:FATHER_OF|:MOTHER_OF]->(Child:Person)
      OPTIONAL MATCH (Child)-[:MARRIED_TO]-(ChildSpouse:Person)

      RETURN 
        id(Father) AS fatherId,
        id(Mother) AS motherId,
        [s IN AllSiblings | id(s)] AS siblingIds,
        collect(DISTINCT id(SiblingSpouse)) AS siblingSpouseIds,
        collect(DISTINCT id(Child)) AS childIds,
        collect(DISTINCT id(ChildSpouse)) AS childSpouseIds
    `;
    let relation = '';
    const ownResult = await session.run(ownFamilyQuery, { personId: person2ID });
    const ownRecord = ownResult.records[0];

    const fatherId = ownRecord?.get("fatherId")?.toNumber() ?? null;
    const motherId = ownRecord?.get("motherId")?.toNumber() ?? null;
    const siblingIds = (ownRecord?.get("siblingIds") ?? []).map(id => id.toNumber());
    const siblingSpouseIds = (ownRecord?.get("siblingSpouseIds") ?? []).map(id => id.toNumber());
    const childIds = (ownRecord?.get("childIds") ?? []).map(id => id.toNumber());
    const fchildrenSpouseIds = (ownRecord?.get("childSpouseIds") ?? []).map(id => id.toNumber());

    console.log("🧬 Own Family Data:", {
      fatherId,
      motherId,
      siblingIds,
      siblingSpouseIds,
      childIds,
      fchildrenSpouseIds,
    });

    const spouseFamilyQuery = `
      MATCH (P:Person)-[:MARRIED_TO]-(Spouse:Person)
      WHERE id(P) = $personId

      OPTIONAL MATCH (SFather:Person)-[:FATHER_OF]->(Spouse)
      OPTIONAL MATCH (SMother:Person)-[:MOTHER_OF]->(Spouse)

      OPTIONAL MATCH (SFather)-[:FATHER_OF|MOTHER_OF]->(SSibling1:Person)
      WHERE SSibling1 <> Spouse

      OPTIONAL MATCH (SMother)-[:FATHER_OF|MOTHER_OF]->(SSibling2:Person)
      WHERE SSibling2 <> Spouse

      WITH P, Spouse, SFather, SMother, collect(DISTINCT SSibling1) + collect(DISTINCT SSibling2) AS sSiblings

      OPTIONAL MATCH (sibling:Person)-[:MARRIED_TO]-(SSiblingSpouse:Person)
      WHERE sibling IN sSiblings

      OPTIONAL MATCH (Spouse)-[:FATHER_OF|MOTHER_OF]->(Child:Person)

      RETURN 
        id(SFather) AS sFatherId,
        id(SMother) AS sMotherId,
        [s IN sSiblings | id(s)] AS sSiblingIds,
        collect(DISTINCT {id: id(SSiblingSpouse), gender: SSiblingSpouse.gender}) AS sSiblingSpouseInfo,
        collect(DISTINCT id(Child)) AS sChildIds
    `;

    const spouseResult = await session.run(spouseFamilyQuery, { personId: person2ID });
    const spouseRecord = spouseResult.records[0];

    const sFatherId = spouseRecord?.get("sFatherId")?.toNumber() ?? null;
    const sMotherId = spouseRecord?.get("sMotherId")?.toNumber() ?? null;
    const sSiblingIds = (spouseRecord?.get("sSiblingIds") ?? []).map(id => id.toNumber());
    // const sSiblingSpouseData = (spouseRecord?.get("sSiblingSpouseInfo") ?? []).map(
    //   obj => ({
    //     id: obj.id.toNumber(),
    //     gender: obj.gender
    //   })
    // );
    const sChildIds = (spouseRecord?.get("sChildIds") ?? []).map(id => id.toNumber());

    console.log("🧬 Spouse Family Data:", {
      sFatherId,
      sMotherId,
      sSiblingIds,
    });

    function getGenderIfAvailable(id, array) {
      if (!Array.isArray(array)) return null;

      const match = array.find(item => {
        if (typeof item === 'object' && item !== null && 'id' in item) {
          return item.id === id;
        }
        return item === id;
      });

      if (typeof match === 'object' && match !== null && 'gender' in match) {
        return match.gender ?? null;
      }

      return match ? true : null;
    };

    let siblingGender, spouseGender;
    if (getGenderIfAvailable(person1ID, sSiblingIds)){
      siblingGender = gender1 === 'Male' ? 'هو أخ' : 'هي أخت';
      spouseGender = gender2 === 'Male' ? 'زوجة' : 'زوج';
      relation = `${translatedName1} ${siblingGender} ${spouseGender} ${translatedName2}`;
    }
    else if (person1ID === sFatherId){
      relation = `${translatedName1} هو أب زوج ${translatedName2}`;
    }
    else if (person1ID === sMotherId){
      relation = `${translatedName1} هي أم زوج ${translatedName2}`;
    }

    if (getGenderIfAvailable(person1ID, siblingSpouseIds)){
      spouseGender = gender1 === 'Male' ? "زوج أخت" : "زوجة أخ"
      relation = `${translatedName1} ${spouseGender} ${translatedName2}`;
    }
    return relation;
  };

  const getAncestors = async (person1ID, person2ID) => {
    setLoadingMessage("جاري البحث عن الأجداد المشتركة");
    const result = await session.run(`
     // Define input person IDs
WITH $person1ID AS p1ID, $person2ID AS p2ID

// Step 1: Match all common ancestors between p1 and p2
MATCH path1 = (common:Person)-[:FATHER_OF|MOTHER_OF*0..11]->(p1:Person)
  WHERE id(p1) = p1ID

MATCH path2 = (common:Person)-[:FATHER_OF|MOTHER_OF*0..11]->(p2:Person)
  WHERE id(p2) = p2ID AND id(p1) <> id(p2)

// Step 2: compute depths and node lists
WITH 
  common, 
  path1, 
  path2, 
  length(path1) AS level1, 
  length(path2) AS level2,
  nodes(path1) AS nodes1,
  nodes(path2) AS nodes2

// Step 3: find the penultimate nodes in each path
WITH 
  common, path1, path2, level1, level2,
  nodes1, nodes2,
  nodes1[1] AS penult1,
  nodes2[1] AS penult2

// Step 4: pull in father‑of‑penultimate for each
OPTIONAL MATCH (father1:Person)-[:FATHER_OF]->(penult1)
OPTIONAL MATCH (father2:Person)-[:FATHER_OF]->(penult2)

// Step 5: pull in common‑ancestor’s spouse lineage
OPTIONAL MATCH 
  (common)-[:MARRIED_TO]-(spouse:Person)
    <-[:FATHER_OF]-(sF:Person)
    <-[:FATHER_OF]-(sGF:Person)

// Step 6: pull in common‑ancestor’s own father & grandfather
OPTIONAL MATCH (pa:Person)-[:FATHER_OF]->(common)
OPTIONAL MATCH (gpa:Person)-[:FATHER_OF]->(pa)

// Step 7: order & limit
WITH 
  common, father1, father2, spouse, sF, sGF, pa, gpa,
  path1, path2, level1, level2
ORDER BY (level1 + level2) ASC
LIMIT 1

// Step 8: return everything
RETURN 
  // Common ancestor
  common.name                             AS commonAncestorName,
  common.lastName                         AS commonAncestorLastName,
  id(common)                              AS commonAncestorID,
  common.gender                           AS commonAncestorGender,

  // Ancestor’s lineage
  pa.name                                 AS commonAncestorFatherName,
  gpa.name                                AS commonAncestorGrandFatherName,

  // Lineage of the node just below common (penultimate)
  id(father1)                             AS fatherOfPath1NodeBeforeAncestorID,
  id(father2)                             AS fatherOfPath2NodeBeforeAncestorID,

  // Generational distances
  level1                                  AS generationsFromP1,
  level2                                  AS generationsFromP2,

  // Spouse of ancestor (if any)
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
  END                                     AS spouseOfAncestor,

  // Full paths
  [n IN nodes(path1) | { id: id(n), name: n.name, lastName: n.lastName, gender: n.gender }] AS pathToP1,
  [n IN nodes(path2) | { id: id(n), name: n.name, lastName: n.lastName, gender: n.gender }] AS pathToP2;



    `, { person1ID, person2ID });

    const record = result.records[0];
    if (result.records.length === 0){
      return null;
    }
    console.log(record);
    return {
      id: record.get('commonAncestorID').toNumber(),
      name: record.get('commonAncestorName'),
      lastName: record.get('commonAncestorLastName'),
      fatherName: record.get('commonAncestorFatherName'),
      grandfatherName: record.get('commonAncestorGrandFatherName'),
      gender: record.get('commonAncestorGender'),
      f1 : record.get('fatherOfPath1NodeBeforeAncestorID')?.toNumber() ?? -1,
      f2 : record.get('fatherOfPath2NodeBeforeAncestorID')?.toNumber() ?? -1,
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

  useEffect(() => {
  const updateConfig = () => {
    const screenWidth = window.innerWidth;
    const containerWidth = treeContainerRef.current?.offsetWidth || screenWidth;

    let nodeSize = { x: 40, y: 90 };
    let separation = { siblings: 2, nonSiblings: 2 };
    let yTranslate = 40;
    let fontSize = 12;

    if (screenWidth < 400) {
      nodeSize = { x: 50, y: 90 };
      separation = { siblings: 3, nonSiblings: 3 };
      fontSize = 14;
    } else if (screenWidth < 500) {
      nodeSize = { x: 55, y: 100 };
      separation = { siblings: 3, nonSiblings: 3 };
      fontSize = 18;
    } else if (screenWidth < 768) {
      nodeSize = { x: 60, y: 110 };
      separation = { siblings: 2.5, nonSiblings: 2.5 };
      fontSize = 18;
    } else if (screenWidth < 1024) {
      nodeSize = { x: 65, y: 115 };
      separation = { siblings: 2.5, nonSiblings: 2.5 };
      fontSize = 18;
    } else if (screenWidth < 1440) {
      nodeSize = { x: 70, y: 120 };
      separation = { siblings: 3, nonSiblings: 3 };
      fontSize = 20;
    } else {
      nodeSize = { x: 80, y: 130 };
      separation = { siblings: 3, nonSiblings: 3 };
      fontSize = 22;
    }

    const translateX = screenWidth > 1024 ? containerWidth / 2 - 20 : containerWidth / 2 - 20;

    setConfig({
      translate: { x: translateX, y: yTranslate },
      nodeSize,
      separation,
      fontSize,
    });
  };

  updateConfig();
  window.addEventListener('resize', updateConfig);
  return () => window.removeEventListener('resize', updateConfig);
}, []);


  return (
  <div className="relation-page">
  
    <main className="main-panel">
      <section className="relation-form-section">
        <h1 className="section-title">ماهي العلاقة بينهما؟</h1>
        <p id="DescriptionZone">
          من خلال هذه الأداة، يمكنك معرفة العلاقة العائلية الأقرب التي تربط بين أي شخصين ضمن العرش.  
          كل ما عليك فعله هو إدخال اسمي الشخصين في الخانتين المخصصتين.  
          يمكنك كتابة الأسماء بأي شكل متاح لك، سواء كان الاسم كاملاً (مثال: فلان بن فلان الفلاني)، أو مجرد الاسم الأول أو الأخير.  
          النظام سيقوم بمحاولة مطابقة الأسماء والبحث في شجرة العائلة لإيجاد الرابط الأسرع بينهما.  
          تأكد من اختيار الأشخاص الصحيحين من الاقتراحات التي ستظهر، ثم اضغط على زر "تحقق من العلاقة" لمشاهدة النتيجة.
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
            <button type="submit" className="button checkButton" onClick={() => {
              setLookoutMode('Blood');
            }}>تحقق من العلاقة</button>
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

      {error && 
        <div className="error-message">
          <p>{error}</p>
        </div>
      }
      {selectedPerson1 && selectedPerson2  && error && (
        <div id="confirm">
          <p>الرجاء تأكيد الاختيار عبر الضغط على زر التحقق من العلاقة.</p>
        </div>
      )}
      {loading && lookoutMode === 'Blood' && (
        <div className="loading-message">
          <div className="spinner"></div>
          <p>{loadingMessage}</p>
        </div>
      )}
      {!loading && relationship && !error  && 
      (Array.isArray(duplicates.person1) && duplicates.person1.length === 0) &&
      (Array.isArray(duplicates.person2) && duplicates.person2.length === 0) &&  (
        
        <section className="relationship-result">
          <div className="foundPersons">
            <h2 id="resultTitle" className="resultsTitles">الأشخاص الذين تم البحث عنهم:</h2>
            <div className='personsCards'>
              <div className="person-card">
                <h4>{relationship.person1ID} - {formatPerson(relationship.relationshipPerson1Details)}</h4>
              </div>
              <div className="person-card">
                <h4>{relationship.person2ID} - {formatPerson(relationship.relationshipPerson2Details)}</h4>
              </div>
            </div>
          </div>
          <h2 id="resultTitle" className="resultsTitles">نتيجة العلاقة</h2>
          <p className="relationText">{relationship.relationshipDescription}</p>
          <div className="result-details">
          {relationship.ancestorstreeData && (
              <>
              <h2 id="resultTitle" className="resultsTitles">شجرة العائلة التي تجمع الشخصين :</h2>
              <div className="tree-wrapper" style={{
                height: `${Math.max(
                  ((Math.max(relationship.relationshipLevels?.levelFromP1 ?? 0, relationship.relationshipLevels?.levelFromP2 ?? 0)) + 1) * 100,
                  100
                ) + 50}px`
              }}>
              <>
              
              <div className="tree-container">
              <Tree
                data={relationship.ancestorstreeData}
                orientation="vertical"
                ref={treeContainerRef}
                pathFunc="diagonal"
                translate={config.translate}
                nodeSize={config.nodeSize}
                separation={config.separation}
                zoomable={false}
                draggable={false}  
                renderCustomNodeElement={({ nodeDatum }) => (
                <g className="tree-node">
                    <title>{nodeDatum.id}</title>
                    <rect
                      className="tree-node-rect"
                      x="-60"
                      y="-20"
                      width="120"
                      height="40"
                      style={{
                        fill: nodeDatum.id === relationship.person1ID || nodeDatum.id === relationship.person2ID
                          ? '#d3f9d8'
                          : nodeDatum.id === relationship.commonAncestor.ancestorID
                          ? '#ffe4b5' 
                          : '#ffffff',
                        stroke: nodeDatum.id === relationship.person1ID || nodeDatum.id === relationship.person2ID
                          ? '#4caf50' 
                          : nodeDatum.id === relationship.commonAncestor.ancestorID
                          ? '#ffa500'
                          : '#4a90e2',
                        strokeWidth: '2.5px',
                        rx: '10',
                        ry: '10',
                      }}
                    />
                    <text
                      className="tree-node-text"
                      x="0"
                      y="0"
                      style={{
                        fontSize: config.fontSize + 'px',
                        fontFamily: 'Cairo',
                        fill: nodeDatum.id === relationship.person1ID || nodeDatum.id === relationship.person2ID
                          ? '#388e3c'
                          : nodeDatum.id === relationship.commonAncestor.ancestorID
                          ? '#ff9800'
                          : '#333',
                        textAnchor: 'middle',
                        dominantBaseline: 'middle',
                        fontWeight: 800,
                        letterSpacing: '1.5px',
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
                  <td className="common-ancestor">
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
            <div className="optionalRelationCheck">
              
              <p>هل تريد معرفة علاقة النسب بين الشخصين ؟</p> 
              <button id="InLawButton" onClick={async () => {
              setLookoutMode('In-Law');
              
              const result = await findRelationship(
              relationship.person1ID,
              relationship.person2ID,
              relationship.gender1,
              relationship.gender2,
              relationship.relationshipPerson1Details?.translatedName ?? "",
              relationship.relationshipPerson2Details?.translatedName ?? "",
              relationship.relationshipPerson1Details?.matches ?? [],
              relationship.relationshipPerson2Details?.matches ?? [],
              'In-Law'
            );
              
              }}>إضغط هنا</button>
            </div>
            {lookoutMode === "In-Law" && (
              <p className="relationText">
                    {formatPerson(inLawsRelation.person1)}{" "}<br></br>
                    {inLawsRelation.relation}{" "}<br></br>
                    {formatPerson(inLawsRelation.person2)}
              </p>
            )}
            {loading && lookoutMode === "In-Law" (
              <div className="loading-message">
                <div className="spinner"></div>
                <p>{loadingMessage}</p>
              </div>
            )}
            
              
          </div>
        </section>
      )}
    </main>
    <div className="side"> 
          <RelationHistory></RelationHistory>
    </div>
    
    </div>
  
  );
};

export default RelationPage;
