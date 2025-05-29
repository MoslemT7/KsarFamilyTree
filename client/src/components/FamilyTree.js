import React, { useEffect, useState , useRef, use } from 'react';
import Tree from 'react-d3-tree';
import '../styles/FamilyTree.css';
import neo4j from 'neo4j-driver';
import * as utils from '../utils/utils';
import usePageTracking from '../utils/trackers';

const ROOT = 137;
const neo4jURI = process.env.REACT_APP_NEO4J_URI;
const neo4jUser = process.env.REACT_APP_NEO4J_USER; 
const neo4jPassword = process.env.REACT_APP_NEO4J_PASSWORD;
const driver = neo4j.driver(
  neo4jURI, 
  neo4j.auth.basic(neo4jUser, neo4jPassword)
);
let uniqueKeyCounter = 0;

const renderFamilyTree = (person, parentId = null, level = 0) => {
  const uniqueKey = `${person.name}-${person.lastName}-${parentId}-${level}-${uniqueKeyCounter++}`;

  return (
    <div key={uniqueKey}>
      <div>
        <strong>{person.name} {person.lastName}</strong>
      </div>
      {person.children && person.children.length > 0 && (
        <div>
          {person.children.map((child) => renderFamilyTree(child, person.id, level + 1))}
        </div>
      )}
    </div>
  );
};

const fetchFamilyTree = async (type) => {
  const session = driver.session();
  const queryParamsObject = {};
  try {
    const defaultQuery = `
      MATCH (root:Person)
      WHERE id(root) = $rootID
      CALL {
        WITH root
        MATCH (root)-[:FATHER_OF*]->(descendant)
        RETURN collect(DISTINCT descendant) AS allDescendants
      }
      WITH root, allDescendants
      UNWIND [root] + allDescendants AS person
      OPTIONAL MATCH (person)-[:FATHER_OF]->(child)
      WITH person, collect(child) AS children
      RETURN {
        id: id(person),
        name: person.name,
        lastName: person.lastName,
        gender: person.gender,
        children: [child IN children | {
          id: id(child),
          name: child.name,
          gender: child.gender,
          lastName: child.lastName
        }]
      } AS treeNode
    `;
    const queryWithMother = `
      MATCH (root:Person)
      WHERE id(root) = $rootID
      CALL {
        WITH root
        MATCH (root)-[:FATHER_OF*]->(descendant)
        RETURN collect(DISTINCT descendant) AS allDescendants
      }
      WITH root, allDescendants
      UNWIND [root] + allDescendants AS person
      OPTIONAL MATCH (person)-[:FATHER_OF|MOTHER_OF]->(child)
      WITH person, collect(child) AS children
      RETURN {
        id: id(person),
        name: person.name,
        lastName: person.lastName,
        children: [child IN children | {
          id: id(child),
          name: child.name,
          gender: child.gender,
          lastName: child.lastName
        }]
      } AS treeNode
    `;
    let query;
    let result = '';
    if (type){
      query = defaultQuery
      queryParamsObject.rootID =  ROOT;
      result = await session.run(query, queryParamsObject);
    }
    else{
      query = queryWithMother
      queryParamsObject.rootID =  ROOT;
      result = await session.run(query, queryParamsObject);
    }

    const familyTree = result.records.map(record => {
      const node = record.get('treeNode');
      return {
        id: Number(node.id),
        name: node.name,
        gender: node.gender,
        lastName: node.lastName,
        children: node.children.map(child => ({
          id: Number(child.id),
          name: child.name,
          gender: child.gender,
          lastName: child.lastName
        }))
      };
    });

    return familyTree; // Return the formatted tree data as JSON
  } catch (error) {
    console.error('Error fetching family tree:', error);
    return []; // Return an empty array in case of error
  } finally {
    session.close();
  }
};

const formatFamilyTreeData = (person) => {
  const children = person.children && person.children.length > 0
    ? person.children.map(formatFamilyTreeData) // Recursively format children
    : [];

  return {
    name: `${person.name} ${person.lastName}`,
    children: children // Include children for each person
  };
};

const getChildrenOfFather = (fatherId, allPeople) => {
  const father = allPeople.filter(father => father.id === fatherId)[0];  
  return father && father.children ? father.children : [];  
};

const buildTree = (person, allPeople) => {
  if (!person) return null;

  const children = getChildrenOfFather(person.id, allPeople)
    .map(child => buildTree(child, allPeople))
    .filter(Boolean); 

    
    return {
      id: person.id,
      name: utils.translateName(person.name),
      gender: person.gender,
      children: children.length > 0 ? children : undefined,
    };
};

const getGenderbyID = async (personID) => {
  const session = driver.session();
  try {
    // Fix the parameter name to match the query variable
    const result = await session.run(
      `MATCH (p:Person) WHERE id(p) = $personId 
      RETURN p.gender AS gender`,
      { personId: personID } // Ensure the key matches the query's parameter
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

const FamilyTree = ({ searchQuery }) => {
  const treeContainerRef = useRef(null);
  const [familyTree, setFamilyTree] = useState(null);
  const [husbandId, setHusbandId] = useState(null);
  const [wifeId, setWifeId] = useState(null);
  const [showTree, setShowTree] = useState(true);
  const [loading, setLoading] = useState(true);  
  const [translate, setTranslate] = useState({x : 0, y : 0});
  const nodePositions = useRef({});
  const [personID, setPersonID] = useState(null);
  const [focusAfterLoadId, setFocusAfterLoadId] = useState(null);
  
  usePageTracking();
  const goToPersonById = async (personId) => {
    const coords = nodePositions.current[personId];
    const container = treeContainerRef.current;

    if (!coords || !container) {
      console.warn("Person coordinates or container not found.");
      return;
    }

    const bounds = container.getBoundingClientRect();
    if (ROOT == personID){
        setTranslate({
        x: bounds.width / 2 - coords.x,
        y: bounds.height / 2 - coords.y,
      });
    }
    else{
      setTranslate({
        x: bounds.width / 2 - coords.x,
        y: bounds.height / 2 - coords.y,
      });
      
    }
  };
  const handleIDPersonSearch = async () => {
    const inputID = document.getElementById('personsearchName').value;
    const personID = parseInt(inputID, 10);
    setPersonID(personID);
    if (isNaN(personID)) {
      alert("❗ الرجاء إدخال رقم صحيح للشخص.");
      return;
    }
    if (!showTree){
      alert("الرجاء إظهار الشجرة أولا.");
      return;
    }
    goToPersonById(personID);
  };

  const handlePersonClick = async (person) => {
    const session = driver.session();

    try {
      const gender = await getGenderbyID(person.id);

      const query = `
        MATCH (p:Person)-[:MARRIED_TO]-(spouse:Person)
        WHERE id(p) = $id
        RETURN id(spouse) AS SpouseID
        LIMIT 1
      `;


      const result = await session.run(query, { id: person.id });

      if (result.records.length > 0) {
        const spouseId = result.records[0].get("SpouseID").toNumber();
        const coords = nodePositions.current[spouseId];
        const container = treeContainerRef.current;

        if (coords && container) {
          const bounds = container.getBoundingClientRect();
          setTranslate({
            x: bounds.width / 2 - coords.x,
            y: bounds.height / 2 - coords.y,
          });
        }

        if (gender === "Female") {
          setHusbandId(spouseId);
          setWifeId(null);
        } else {
          setWifeId(spouseId);
          setHusbandId(null);
        }
      } else {
        console.log("No spouse found for", person.name);
      }
    } catch (error) {
      console.error("Error fetching spouse:", error);
    } finally {
      await session.close();
    }
  };

  const handlePersonTreeDisplay = async () => {
    const inputID = document.getElementById('rootID').value;
    const ID = parseInt(inputID, 10);

    if (isNaN(ID)) {
      alert("❗ الرجاء إدخال رقم صحيح للشخص.");
      return;
    }
    loadFamilyTree(ID);
  };

  const handleRootTreeClick = async () => {
    await loadFamilyTree(ROOT, true); // assuming it’s async
    setFocusAfterLoadId(ROOT);
  };

  const handleRootWomenTreeClick = async () =>{
    loadFamilyTree(ROOT, false)
  };
  
  const loadFamilyTree = async (rootID, type) => {

    try {
      setLoading(true);
      const people = await fetchFamilyTree(type);
      console.log(people);
      if (Array.isArray(people) && people.length > 0) {
        const rootPerson = people.find((p) => p.id === rootID);
        const treeData = buildTree(rootPerson, people);
        console.log(treeData);
        setFamilyTree(treeData);
        setShowTree(true);
        
        setLoading(false);
      } else {
        console.warn("Empty or invalid people data");
      }
    } catch (error) {
      console.error("Error loading family tree:", error);
    } finally{
      setLoading(false);
    }
  };

  useEffect(() => {
    if (focusAfterLoadId && nodePositions.current[focusAfterLoadId]) {
      goToPersonById(focusAfterLoadId);
      setFocusAfterLoadId(null); // reset
    }
  }, [focusAfterLoadId, nodePositions.current]);

  return (
    <div className="treePage">
      <header>
        <h2>شجرة عائلة قصر أولاد بوبكر</h2>
        <div className="d">
          <p id="pd">
  في هذه الصفحة، يمكنك تصفح شجرة عائلة قصر أولاد بوبكر من الجد المؤسس بوبكر وصولًا إلى الجيل الحالي. 
  تهدف الصفحة إلى عرض العلاقات العائلية بشكل دقيق ومنظم، مما يتيح لك فهم تسلسل الأنساب، 
  وتاريخ تطور العرش، والتعرف على أفراد العائلة عبر الأجيال. 
  استكشف كيف ترابطت العائلات، وتعمّق في جذورك وهويتك العائلية.
</p>

        </div>
      </header>
      <div className="screen">
    {/* Left panel: inputs & controls */}
    <aside className="panel panel--controls">
      <div className="filterChoice">
        {/* Card R1 */}
        <div className="card" id="R1">
          <p className="info-text">
  يتيح زر <strong style={{ color: 'blue' }}>شجرة العائلة التقليدية</strong> تصفح الشجرة العائلية ابتداءً من الجدّ الأول وحتى الأجيال الحالية.
</p>

<p className="info-text">
  أما <strong style={{ color: '#b52155' }}>شجرة العائلة مع أبناء الأمهات</strong>، فتُظهر أيضًا أبناء الأمهات، مما يجعل الشجرة أكثر شمولًا، 
  <strong id="warning">لكن احذر من التكرارات وضخامة الشجرة!</strong>
</p>

          <div className="rootButton">
            <button id="men" onClick={handleRootTreeClick}>
              شجرة العائلة التقليدية
            </button>
            <button id="women" onClick={handleRootWomenTreeClick}>
              شجرة مع أبناء الأمهات
            </button>
          </div>
        </div>

        {/* Card R2 */}
        <div className="card" id="R2">
          <p className="info-text">
            للحصول على رقم الهوية، استخدم صفحة <a href="/search" target="_blank" style={{ color: '#007bff' }}>البحث</a>، ثم انسخ الرقم الظاهر فوق الاسم والصقه هنا.
          </p>
          <input id="rootID" type="number" placeholder="أدخل رقم الشخص" />
          <button className="btn-person" onClick={handlePersonTreeDisplay}>
            شجرة ابتداءً من شخص
          </button>
        </div>

        {/* Card R3 */}
        <div className="card" id="R3">
          <p className="info-text">
            للحصول على رقم الهوية، ابحث عن الشخص من <a href="/search">صفحة البحث</a>، ثم انسخ الرقم الظاهر فوق اسمه والصقه هنا.
          </p>

          <input id="personsearchName" type="text" placeholder="ابحث عن شخص" />
          <button className="btn-search" onClick={handleIDPersonSearch}>
            ابحث في الشجرة
          </button>
        </div>
      </div>
    </aside>

    {/* Right panel: tree & loading */}
    <main className="panel panel--tree">
      {loading && !showTree && (
        <div className="loading-indicator">
          <p>جارٍ تحميل الشجرة...</p>
          <div className="spinner" />
        </div>
      )}

      {showTree && familyTree && (
        <div id="treeWrapper" ref={treeContainerRef}>
          <Tree
            data={familyTree}
            orientation="vertical"
            pathFunc="step"
            translate={translate}
            nodeSize={{ x: 100, y: 100 }}
            separation={{ siblings: 1.5, nonSiblings: 1.5 }}
            renderCustomNodeElement={({ nodeDatum, hierarchyPointNode }) => {
              nodePositions.current[nodeDatum.id] = {
                x: hierarchyPointNode.x,
                y: hierarchyPointNode.y,
              };
              const fill = nodeDatum.id === husbandId
                ? '#66bb6a'
                : nodeDatum.id === wifeId
                  ? '#ff8a65'
                  : nodeDatum.id === personID
                    ? '#cf14d9'
                    : '#4fc3f7';
              return (
                <g
                  onClick={() => handlePersonClick(nodeDatum)}
                  style={{ cursor: 'pointer' }}
                >
                  <defs>
                    <linearGradient id={`grad-${nodeDatum.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6"/>
                      <stop offset="100%" stopColor={fill} stopOpacity="1"/>
                    </linearGradient>
                    <filter id={`shadow-${nodeDatum.id}`} x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="2" dy="4" stdDeviation="3" floodColor="#000" floodOpacity="0.3"/>
                    </filter>
                  </defs>

                  <rect
                    x="-60" y="-25"
                    width="120" height="50"
                    rx="10" ry="10"
                    fill={`url(#grad-${nodeDatum.id})`}
                    stroke="#333"
                    strokeWidth="0.8"
                    filter={`url(#shadow-${nodeDatum.id})`}
                  />

                  {(() => {
                    const words = nodeDatum.name.split(' ');
                    const gender = nodeDatum.gender;
                    const lines = [];
                    let current = '';
                    words.forEach(word => {
                      const test = current ? `${current} ${word}` : word;
                      if (test.length > 12) {
                        lines.push(current);
                        current = word;
                      } else {
                        current = test;
                      }
                    });
                    if (current) lines.push(current);

                    return lines.map((line, i) => (
                      <text
                        key={i}
                        x="0" y={ i * 18 - (lines.length - 1) * 9 }
                        textAnchor="middle"
                        dominantBaseline="middle"
                        style={{
                          fontSize: '24px',
                          fontFamily: 'Cairo, sans-serif',
                          fill: '#fff',
                          pointerEvents: 'none',
                        }}
                      >
                        {/* {gender === 'Female' ? line[0]: line} */}
                        {line}
                      </text>
                    ));
                  })()}
                </g>
              );
            }}
          />
        </div>
      )}

      <p id="rotateSuggestion">ننصحك بتدوير الهاتف</p>
    </main>
  </div>
    
      {loading && !showTree && !familyTree && (
        <div className="loading-indicator">
          <p>جار تحميل الشجرة...</p>
          <div className="spinner"></div>
        </div>
      )}
      

      <div className='footerTips'>
        <div className="card">
          <h4>لا تضيع الوقت في البحث المكرر</h4>
          <p>إذا كنت بحاجة إلى الرجوع لنفس الشخص في الشجرة، احفظ الرقم التسلسلي لاستخدامه مباشرة في المستقبل لتسريع البحث.</p>
        </div>
        
        <div className="card">
          <h4>التفاعل مع الأشجار</h4>
          <p>عندما يتم النقر على امرأة، سيتم عرض موقع زوجها على الشجرة، أما إذا تم النقر على الزوج، فسيتم عرض موقع زوجته على الشجرة. هذا يساعدك على استكشاف العلاقات بين الزوجين داخل شجرة العائلة بشكل أسرع وأكثر فعالية.</p>
        </div>
        
        
        <div className="card">
          <h4>كيفية البحث في الشجرة</h4>
          <p>لاستعراض شجرة العائلة من شخص معين، قم باستخدام الرقم التسلسلي للشخص في مربع البحث. ابحث عن الشخص عن طريق صحفة البحث عن الأشخاص، ثم قم بنسخ الرقم من قسم النتائج.</p>
        </div>
        
        
      </div>


    </div>
    
  );
};

export default FamilyTree;