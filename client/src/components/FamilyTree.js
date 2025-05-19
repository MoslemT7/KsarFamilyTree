import React, { useEffect, useState , useRef, use } from 'react';
import Tree from 'react-d3-tree';
import '../styles/FamilyTree.css';
import neo4j from 'neo4j-driver';
import * as utils from '../utils/utils';
const ROOT = 15;
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
        children: [child IN children | {
          id: id(child),
          name: child.name,
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
        lastName: node.lastName,
        children: node.children.map(child => ({
          id: Number(child.id),
          name: child.name,
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
    await loadFamilyTree(85, true); // assuming it’s async
    setFocusAfterLoadId(85);
  };
  const handleRootWomenTreeClick = async () =>{
    loadFamilyTree(85, false)
  };
  
  const loadFamilyTree = async (rootID, type) => {

    try {
      setLoading(true);
      const people = await fetchFamilyTree(type);
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

  const getTreeSize = () => {
    const positions = Object.values(nodePositions.current);

    if (positions.length === 0) return { width: 0, height: 0 };

    const xValues = positions.map(p => p.x);
    const yValues = positions.map(p => p.y);

    const width = Math.max(...xValues) - Math.min(...xValues);
    const height = Math.max(...yValues) - Math.min(...yValues);

    return { width, height };
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
        <div className="description">
          <p>في هذه الصفحة، يمكنك تصفح شجرة عرش قصر أولاد بوبكر بشكل كامل ومفصل.
             تبدأ الشجرة من الجد الأول بوبكر، الذي يمثل الجذور الأساسية لهذا العرش العريق،
             مرورًا بالأجيال التي تلت ذلك حتى الوصول إلى الجيل الحالي.
             يمكنك استكشاف تاريخ العائلة عبر الأجيال المختلفة،
             والتعرف على الأفراد الذين شكلوا جزءًا من هذه الشجرة العائلية على مر العصور.
             هذه الصفحة تتيح لك رؤية العلاقات بين الأفراد وكيف تطورت العائلة على مر الزمن،
             مما يعزز فهمك للتاريخ العائلي والعلاقات الاجتماعية بين الأفراد في هذا العرش.</p>

        </div>
        {showTree && familyTree && (
        <div
          id="treeWrapper"
          ref={treeContainerRef}
          style={{
            width: "100%", // Ensure full width of the parent container
            height: "100vh", // Full height of the viewport
            overflow: 'auto', // Allow scrolling if the tree overflows
            padding: '20px', // Add some padding around the tree
            boxSizing: 'border-box', // Ensure padding is included in the size calculations
            position: 'relative', // Allow absolute positioning of title
            display: 'flex', // Allow flexbox for centering
            justifyContent: 'center', // Center the content horizontally
            alignItems: 'center', // Center the content vertically
          }}
          >
          <Tree
            data={familyTree}
            orientation="vertical"
            pathFunc="step"
            translate={translate}
            nodeSize={{ x: 100, y: 100 }}
            separation={{ siblings: 1.1, nonSiblings: 1.5 }}
            renderCustomNodeElement={({ nodeDatum, hierarchyPointNode }) => {
              const isSpouse = nodeDatum.id === husbandId || nodeDatum.id === wifeId;
              nodePositions.current[nodeDatum.id] = {
                x: hierarchyPointNode.x,
                y: hierarchyPointNode.y,
              };

              return (
                <g
                  onClick={() => handlePersonClick(nodeDatum)}
                  style={{ cursor: "pointer" }}
                >
                  <title>{nodeDatum.id}</title>
                  <rect
                    x="-50"
                    y="-20"
                    width="100"
                    height="40"
                    fill={
                      nodeDatum.id === husbandId
                        ? "#66bb6a" 
                        : nodeDatum.id === wifeId
                        ? "#ff8a65" 
                        : nodeDatum.id === personID 
                        ? "#cf14d9"
                        : "#4fc3f7"      
                    }                    
                    stroke="black"
                    strokeWidth="2"
                    rx="8"
                  />
                  <text
                    x="0"
                    y="5"
                    style={{
                      fontSize: "22px",
                      fontFamily: 'Cairo',
                      dominantBaseline: 'middle',
                      letterSpacing: '1px',
                      strokeWidth: '0px',
                      textAnchor: "middle",
                      fill: "white",
                    }}
                  >
                    {nodeDatum.name}
                  </text>
                </g>
              );
            }}
          />
        </div>
      )}
        <p id="rotateSuggestion">ننحصحك بتدوير الهاتف</p>
        <div className="filterChoice">
          <div className="card" id="R1">
              <p className="info-text">
                يتيح لك زر <strong style={{color: 'blue'}}>شجرة العائلة التقليدية</strong> تصفح شجرة عائلة كامل العرش بدءًا منذ الجد الأول
                حتى الوصول الي الأجيال الحالية. <br></br>
                أما زر <strong style={{color: '#b52155'}}>شجرة العائلة مع أبناء الأمهات</strong> فيتيح لك اضافة أبناء الأمهات الى الشجرة أيضا، ولكن إحذر ،
                <strong id="warning">سوف تبدو لك الشجرة كبيرة جدا لإحتوائها على العديد من الأشخاص المكررين</strong>
              </p>

              <div className="rootButton">
                <button type="button" id="men" onClick={handleRootTreeClick}>
                  شجرة العائلة التقليدية
                </button>
                <button type="button" id="women" onClick={handleRootWomenTreeClick}>
                  شجرة العائلة مع أبناء الأمهات
                </button>
              </div>
          </div>

          <div className="card" id="R2">
            <p className="info-text">
              للحصول على رقم الهوية (رقم التسلسل) للشخص، يجب عليك التوجه إلى صفحة البحث ثم البحث عن الشخص المطلوب.
              بعد إجراء البحث، سيظهر رقم التسلسل (رقم الهوية) مباشرةً فوق الاسم الكامل للشخص في قسم النتائج. يمكنك نسخ
              هذا الرقم ومن ثم لصقه هنا لرؤية شجرة العائلة بدءًا من ذلك الشخص.
            </p>
            <input id="rootID" type="number" placeholder="أدخل رقم الشخص" />
            <button className="btn-person" type="button" onClick={handlePersonTreeDisplay}>
              شجرة العائلة ابتداءا من شخص معين
            </button>
          </div>
          
          <div className="card" id="R3">
          <p className="info-text">هذه القسم يتيح لك رؤية مكان الشخص داخل شجرة العائلة.
             كل ما عليك فعله هو إدخال رقم هوية الشخص (رقم التسلسل) في الخانة المخصصة. للحصول على رقم الهوية،
              توجه إلى صفحة البحث وابحث عن الشخص المطلوب.
              بعد إجراء البحث،
              ستجد رقم التسلسل يظهر فوق اسم الشخص في نتائج البحث. قم بنسخ هذا الرقم وأدخله هنا لرؤية مكانه داخل الشجرة.</p>

            <input id="personsearchName" type="text" placeholder="ابحث عن شخص في الشجرة" />
            <button type='button' className='btn-search' onClick={handleIDPersonSearch}>إبحث عن شخص في شجرة العائلة</button>
          </div>
        </div>

      </header>
      {loading && !showTree && !familyTree && (
        <div className="loading-indicator">
          <p>جار تحميل الشجرة...</p>
          <div className="spinner"></div> {/* Loading spinner */}
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