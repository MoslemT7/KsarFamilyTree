import React, { useEffect, useState , useRef, use } from 'react';
import '../styles/FamilyTree.css';
import neo4j from 'neo4j-driver';
import * as utils from '../utils/utils';
import usePageTracking from '../utils/trackers';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import FamilyTreeComponent from './FamilyTreeComponent';

const ROOT = 203;
const neo4jURI = process.env.REACT_APP_NEO4J_URI;
const neo4jUser = process.env.REACT_APP_NEO4J_USER; 
const neo4jPassword = process.env.REACT_APP_NEO4J_PASSWORD;
const driver = neo4j.driver(
  neo4jURI, 
  neo4j.auth.basic(neo4jUser, neo4jPassword)
);
let uniqueKeyCounter = 0;

const hints = [
    // Tree-related
    "هل تعلم؟ يمكنك تكبير الشجرة لرؤية المزيد من أفراد العائلة!",
    "نصيحة: اضغط على أي شخص لرؤية تفاصيله الدقيقة.",
    "تلميح: استخدم شريط الأجيال للتنقل بين الأجيال المختلفة بسهولة.",
    "معلومة: يمكنك سحب الشجرة وتحريكها بحرية لاستكشاف أجزائها.",

    // Other pages
    "هل تعلم؟ صفحة البحث عن العلاقات تساعدك في معرفة الروابط بين أفراد العائلة.",
    "نصيحة: استخدم عداد السكان لمعرفة عدد أفراد قبيلتك في الوقت الحقيقي.",
    "تلميح: صفحة الإحصائيات تعرض لك معلومات مفصلة عن أجيال وأفراد العائلة.",
    "معلومة: يمكنك إضافة ملاحظات خاصة لكل فرد في صفحة التفاصيل لزيادة الفهم.",
];

const translateNodeRecursive = (node) => {
  // Translate names on current node
  const translatedNode = {
    ...node,
    name: utils.translateName(node.name),
    lastName: utils.translateFamilyName(node.lastName),
  };

  // Recursively translate children if any
  if (translatedNode.children && translatedNode.children.length > 0) {
    translatedNode.children = translatedNode.children.map(translateNodeRecursive);
  }

  return translatedNode;
};

const buildSmallFamilyTree = (record) => {
  const fatherNode = record.get("father");
  const fatherChildrenRaw = record.get("fatherChildren") || [];
  const personChildrenRaw = record.get("personChildren") || [];
  const personId = record.get("personId")?.toNumber();

  if (!fatherNode || !fatherNode.properties) {
    console.warn("No father found in the record.");
    return null;
  }

  const father = {
    ...fatherNode.properties,
    id: fatherNode.identity?.toNumber?.() ?? fatherNode.properties.id,
  };

  const formattedPersonChildren = personChildrenRaw.map((child) => ({
    ...child.properties,
    id: child.identity?.toNumber?.() ?? child.properties.id,
    children: [],
  }));

  const formattedFatherChildren = fatherChildrenRaw.map((childNode) => {
    const child = childNode.properties;
    const id = childNode.identity?.toNumber?.() ?? child.id;

    const node = {
      ...child,
      id,
      children: [],
    };

    if (id === personId) {
      node.children = formattedPersonChildren;
    }

    return node;
  });

  const rawTree = {
    ...father,
    children: formattedFatherChildren,
  };

  // Translate entire tree recursively before returning
  return translateNodeRecursive(rawTree);
};


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

const fetchFamilyTree = async (rootID, type) => {
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
      WHERE child IS NOT NULL
      
      OPTIONAL MATCH (mother)-[:MOTHER_OF]->(person)
      
      WITH person, mother, collect(DISTINCT child) AS children
      
      RETURN {
        id: id(person),
        name: person.name,
        lastName: person.lastName,
        gender: person.gender,
        isAlive: person.isAlive,
        Nickname: person.Nickname,
        Notes: person.Notes,
        motherId: CASE WHEN mother IS NULL THEN NULL ELSE id(mother) END,
        children: [child IN children | {
          id: id(child),
          name: child.name,
          lastName: child.lastName,
          gender: child.gender,
          isAlive: child.isAlive,
          Nickname: child.Nickname,
          Notes: child.Notes,
          motherId: head([ (child)<-[:MOTHER_OF]-(m:Person) | id(m) ])  // get mother's ID for each child
        }]
      } AS treeNode
      ORDER BY person.name
    `;

    const queryWithMother = `
      MATCH (root:Person)
      WHERE id(root) = $rootID
      CALL {
        WITH root
        MATCH (root)-[:FATHER_OF|MOTHER_OF*]->(descendant)
        RETURN collect(DISTINCT descendant) AS allDescendants
      }
      WITH root, allDescendants
      UNWIND [root] + allDescendants AS person

      OPTIONAL MATCH (person)-[:FATHER_OF|MOTHER_OF]->(child)
      WHERE child IS NOT NULL

      WITH person, collect(DISTINCT child) AS children

      RETURN {
        id: id(person),
        name: person.name,
        lastName: person.lastName,
        gender: person.gender,
        isAlive: person.isAlive,
        Nickname: person.Nickname,
        Notes: person.Notes,
        children: [child IN children | {
          id: id(child),
          name: child.name,
          lastName: child.lastName,
          gender: child.gender,
          isAlive: child.isAlive,
          Nickname: child.Nickname,
          Notes: child.Notes,
          motherId: head([ (child)<-[:MOTHER_OF]-(m:Person) | id(m) ])  // get mother's ID for each child
        }]
      } AS treeNode
      ORDER BY person.name
    `;

    let query;
    if (type) {
      query = defaultQuery;
    } else {
      query = queryWithMother;
    }

    queryParamsObject.rootID = Number(rootID);
    const result = await session.run(query, queryParamsObject);

    const familyTree = result.records.map(record => {
      const node = record.get('treeNode');
      const includeChildren =
        Number(node.id) === 719 ? Number(rootID) !== 395 : true;

      return {
        id: Number(node.id),
        name: node.name,
        gender: node.gender,
        lastName: node.lastName,
        isAlive: node.isAlive,
        Nickname: node.Nickname,
        Notes: node.Notes,
        motherId: Number(node.motherId) || null,
        children: includeChildren
          ? node.children.map(child => ({
              id: Number(child.id),
              name: child.name,
              gender: child.gender,
              isAlive: child.isAlive,
              lastName: child.lastName,
              Nickname: child.Nickname,
              Notes: child.Notes,
              motherId: Number(child.motherId) || null,
            }))
          : [] // return no children if condition fails
      };
    });

    return familyTree;
  } catch (error) {
    console.error('Error fetching family tree:', error);
    return [];
  } finally {
    session.close();
  }
};


const fetchSpecifiedFamilyTree = async (rootID) => {
  const session = driver.session();
  try {
    const query = `
    MATCH (start:Person) WHERE id(start) = $rootID
    OPTIONAL MATCH pathUp = (ancestor:Person)-[:FATHER_OF*]->(start)
    WITH collect(DISTINCT ancestor) AS ancestors, start

    OPTIONAL MATCH pathDown = (start)-[:FATHER_OF*]->(descendant:Person)
    WITH ancestors, collect(DISTINCT descendant) AS descendants, start

    WITH apoc.coll.toSet(ancestors + descendants + [start]) AS lineage

    UNWIND lineage AS person

    OPTIONAL MATCH (person)-[:FATHER_OF*]->(child:Person)
    WHERE child IN lineage

    OPTIONAL MATCH (person)<-[:MOTHER_OF]-(mother:Person)

    WITH person, collect(child) AS rawChildren, mother
    WITH person, [c IN rawChildren WHERE c IS NOT NULL] AS children, mother

    RETURN {
      id: id(person),
      name: person.name,
      gender: person.gender,
      lastName: person.lastName,
      isAlive: person.isAlive,
      Nickname: person.Nickname,
      Notes: person.Notes,
      motherId: CASE WHEN mother IS NULL THEN NULL ELSE id(mother) END,
      children: [child IN children | {
        id: id(child),
        name: child.name,
        gender: child.gender,
        isAlive: child.isAlive,
        lastName: child.lastName,
        Nickname: child.Nickname,
        Notes: child.Notes,
        motherId: head([ (child)<-[:MOTHER_OF]-(m:Person) | id(m) ]) // fetch mother's ID for each child
      }]
    } AS treeNode
    ORDER BY person.name
    `;

    const result = await session.run(query, { rootID: Number(rootID) });

    const familyTree = result.records.map(record => {
      const node = record.get('treeNode');
      const includeChildren =
        Number(node.id) === 719 ? Number(rootID) !== 395 : true;

      return {
        id: Number(node.id),
        name: node.name,
        gender: node.gender,
        lastName: node.lastName,
        isAlive: node.isAlive,
        Nickname: node.Nickname,
        Notes: node.Notes,
        motherId: node.motherId,
        children: includeChildren
          ? node.children.map(child => ({
              id: Number(child.id),
              name: child.name,
              gender: child.gender,
              isAlive: child.isAlive,
              lastName: child.lastName,
              Nickname: child.Nickname,
              Notes: child.Notes,
              motherId: child.motherId || null
            }))
          : [] // return no children if condition fails
      };
    });

    return familyTree;
  } catch (error) {
    console.error('Error fetching full family tree:', error);
    return [];
  } finally {
    session.close();
  }
};


const buildTreeSafe = (person, childMap, seen = new Set(), generation = 0) => {
  if (!person || seen.has(person.id)) {
    return null;
  }
  seen.add(person.id);
  
  const translatedName = utils.translateName(person.name);
  const translatedLastName = utils.translateFamilyName(person.lastName);
  const rawChildren = (childMap[person.id] || []).filter(child => child !== null);

  const childrenNodes = rawChildren
    .map(child => {
      const childObj = {
        id: child.id,
        name: child.name,
        lastName: child.lastName,
        gender: child.gender,
        isAlive: child.isAlive,
        Nickname: child.Nickname,
        Notes : child.Notes,
        MotherID: child.MotherID
      };
      return buildTreeSafe(childObj, childMap, seen, generation + 1);
    })
    .filter(Boolean);

  return {
    id: person.id,
    name: translatedName,
    lastName: translatedLastName,
    gender: person.gender,
    isAlive: person.isAlive,
    Nickname: person.Nickname,
    Notes : person.Notes,
    MotherID: person.MotherID,
    generation,
    ...(childrenNodes.length > 0 ? { children: childrenNodes } : {})
  };
};

const buildChildrenMap = (allPeople) => {
  const childMap = Object.create(null);
  allPeople.forEach(person => {
    childMap[ person.id ] = person.children || [];
  });
  return childMap;
};

const buildPartialTree = (person, childMap, targetID, seen = new Set()) => {
  if (!person || seen.has(person.id)) {
    return null;
  }
  seen.add(person.id);

  const translatedName = utils.translateName(person.name);
  const translatedLastName = utils.translateFamilyName(person.lastName);
  const rawChildren = childMap[person.id] || [];

  const childrenNodes = rawChildren
    .map(child => {
      if (person.id === targetID) {
        return buildTreeSafe(child, childMap, seen);  
      }

      const subtree = buildPartialTree(child, childMap, targetID, seen);
      return subtree;
    })
    .filter(Boolean);

  if (person.id === targetID || childrenNodes.length > 0) {
    return {
      id: person.id,
      name: translatedName,
      lastName: translatedLastName,
      isAlive: person.isAlive,
      gender: person.gender,
      Nickname: person.Nickname,
      Notes : person.Notes,
      MotherID: person.MotherID,
      ...(childrenNodes.length > 0 ? { children: childrenNodes } : {})
    };
  }
  return null;
};

const getTreeDepth = (node) => {
  if (!node || !node.children || node.children.length === 0) return 1;
  return 1 + Math.max(...node.children.map(getTreeDepth));
};

const countTreeNodes = (node) => {
  if (!node) return { totalCount: 0, aliveCount: 0 };

  const children = node.children || [];

  const childCounts = children.map(countTreeNodes);
  const totalCount = 1 + childCounts.reduce((sum, c) => sum + c.totalCount, 0);
  const aliveCount = (node.isAlive ? 1 : 0) + childCounts.reduce((sum, c) => sum + c.aliveCount, 0);

  return { totalCount, aliveCount };
};

const FamilyTree = () => {
  const treeContainerRef = useRef(null);
  const nodePositions = useRef({});
  const smalltreeContainerRef = useRef(null);
  const [familyTree, setFamilyTree] = useState(null);
  const [husbandId, setHusbandId] = useState(null);
  const [wifeId, setWifeId] = useState(null);
  const [showTree, setShowTree] = useState(true);
  const [loading, setLoading] = useState(false);  
  const [translate, setTranslate] = useState({x : 0, y : 0});
  const [personID, setPersonID] = useState(null);
  const [treeCount, setTreeCount] = useState(0);
  const [treeDepth, setTreeDepth] = useState(0);
  const [spouseId, setSpouseId] = useState(null);
  const [popupMode, setPopupMode] = useState('info');
  const [showPopup, setShowPopup] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [selectedSubtree, setSelectedSubtree] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [maxGeneration, setMaxGeneration] = useState(0);
  const [selectedGeneration, setSelectedGeneration] = useState(null);
  const [currentHintIndex, setCurrentHintIndex] = React.useState(0);
  const [personDetails, setPersonDetails] = useState(null);
  const [lookoutMode, setLookoutMode] = useState("");
  const [branchingMode, setBranchingMode] = useState("Branch");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [treeMode, setTreeMode] = useState("lazy");
  const [title, setTitle] = useState("شجرة عائلة: ");
  const [showSpouse, setShowSpouse] = useState(false);
  const [smallFamilyTree, setSmallFamilyTree] = useState(null);

  const handleSearch = async (type) => {
    let inputValue = '';
      setPersonDetails(null);
    if (type === 'Node') {
      console.log("Mode: Node");
      
      inputValue = document.getElementById("NodeTreeSearch").value;
    } 
    else if (type === 'Tree') {
      console.log("Mode: Tree");
      inputValue = document.getElementById("TreeRoot").value;
    }

    inputValue = inputValue.trim();
    if (!inputValue) return;

    if (!isNaN(inputValue)) {
      const id = parseInt(inputValue, 10);
      setPersonID(id);
      type === 'Node' ? await goToPersonById() : await handlePersonTreeDisplay();
    } 
    else {
      await searchPerson(inputValue);
    }
  };

  const searchPerson = async (searchText) => {
    const isArabic = (text) => /[\u0600-\u06FF]/.test(text);
    setLoading(true);

    let translatedInputName = utils.translateName(searchText, false);
    const {
      personName,
      fatherName,
      grandfatherName,
      familyName,
    } = utils.splitName(translatedInputName);

    if (!personName) {
      setPersonDetails(null);
      setLoading(false);
      return;
    }

    const translatedpersonName = isArabic(personName) ? utils.translateName(personName, false) : personName;
    const translatedfatherName = isArabic(fatherName) ? utils.translateName(fatherName, false) : fatherName;
    const translatedgrandfatherName = isArabic(grandfatherName) ? utils.translateName(grandfatherName, false) : grandfatherName;
    const translatedfamilyName = isArabic(familyName) ? utils.translateFamilyName(familyName, false) : familyName;

    let cypherQuery = ``;
    const queryParamsObject = { personName: translatedpersonName };

    if (translatedfatherName) {
      queryParamsObject.fatherName = translatedfatherName;

      if (translatedgrandfatherName) {
        queryParamsObject.grandfatherName = translatedgrandfatherName;

        if (translatedfamilyName) {
          queryParamsObject.familyName = translatedfamilyName;
          cypherQuery = `
            MATCH (grandfather:Person)-[:FATHER_OF]->(father:Person)-[:FATHER_OF]->(child:Person)
            WHERE child.name = $personName AND father.name = $fatherName AND grandfather.name = $grandfatherName AND child.lastName = $familyName
            WITH DISTINCT child, father, grandfather
            RETURN 
              id(child) AS childID,
              child.name AS childName, 
              child.YoB AS childYoB, 
              child.gender AS childGender,
              father.name AS fatherName, 
              grandfather.name AS grandfatherName,
              child.lastName AS familyName
          `;
        } else {
          cypherQuery = `
            MATCH (grandfather:Person)-[:FATHER_OF]->(father:Person)-[:FATHER_OF]->(child:Person)
            WHERE child.name = $personName AND father.name = $fatherName AND grandfather.name = $grandfatherName
            WITH DISTINCT child, father, grandfather
            RETURN 
              id(child) AS childID,
              child.name AS childName, 
              child.YoB AS childYoB, 
              child.gender AS childGender,
              father.name AS fatherName, 
              grandfather.name AS grandfatherName,
              child.lastName AS familyName
          `;
        }

      } else {
        if (translatedfamilyName) {
          queryParamsObject.familyName = translatedfamilyName;
          cypherQuery = `
            MATCH (father:Person)-[:FATHER_OF]->(child:Person)
            WHERE child.name = $personName AND father.name = $fatherName AND child.lastName = $familyName
            OPTIONAL MATCH (grandfather:Person)-[:FATHER_OF]->(father)
            WITH DISTINCT child, father, grandfather
            RETURN 
              id(child) AS childID,
              child.name AS childName, 
              child.YoB AS childYoB, 
              child.gender AS childGender,
              father.name AS fatherName, 
              grandfather.name AS grandfatherName,
              child.lastName AS familyName
          `;
        } else {
          cypherQuery = `
            MATCH (father:Person)-[:FATHER_OF]->(child:Person)
            WHERE child.name = $personName AND father.name = $fatherName
            OPTIONAL MATCH (grandfather:Person)-[:FATHER_OF]->(father)
            WITH DISTINCT child, father, grandfather
            RETURN 
              id(child) AS childID,
              child.name AS childName, 
              child.YoB AS childYoB, 
              child.gender AS childGender,
              father.name AS fatherName, 
              grandfather.name AS grandfatherName,
              child.lastName AS familyName
          `;
        }
      }

    } 
    else {
      if (translatedfamilyName) {
        queryParamsObject.familyName = translatedfamilyName;
        cypherQuery = `
          MATCH (child:Person)
          WHERE child.name = $personName AND child.lastName = $familyName
          OPTIONAL MATCH (father:Person)-[:FATHER_OF]->(child)
          OPTIONAL MATCH (grandfather:Person)-[:FATHER_OF]->(father)
          WITH DISTINCT child, father, grandfather
          RETURN 
            id(child) AS childID,
            child.name AS childName, 
            child.YoB AS childYoB, 
            child.gender AS childGender,
            father.name AS fatherName, 
            grandfather.name AS grandfatherName,
            child.lastName AS familyName
        `;
      } else {
        cypherQuery = `
          MATCH (child:Person)
          WHERE child.name = $personName
          OPTIONAL MATCH (father:Person)-[:FATHER_OF]->(child)
          OPTIONAL MATCH (grandfather:Person)-[:FATHER_OF]->(father)
          WITH DISTINCT child, father, grandfather
          RETURN 
            id(child) AS childID,
            child.name AS childName, 
            child.YoB AS childYoB, 
            child.gender AS childGender,
            father.name AS fatherName, 
            grandfather.name AS grandfatherName,
            child.lastName AS familyName
        `;
      }
    }

    const session = driver.session();
    try {
      const result = await session.run(cypherQuery, queryParamsObject);
      
      if (result.records.length === 0) {
        setPersonDetails(null);
      } 
      else if (result.records.length === 1) {
        const record = result.records[0];
        const YoB = record.get('childYoB');
        console.log(record);
        const personDetails = {
          personID: record.get('childID')?.toNumber() ?? null,
          personName: record.has('childName') ? record.get('childName') : "غير متوفر",
          fatherName: record.has('fatherName') ? record.get('fatherName') : "غير متوفر",
          grandfatherName: record.has('grandfatherName') ? record.get('grandfatherName') : "غير متوفر",
          familyName: record.has('familyName') ? record.get('familyName') : "غير متوفر",
          gender: record.has('childGender') ? record.get('childGender') : "غير متوفر",
          YoB: record.has('childYoB') ? record.get('childYoB') : null,
          age: record.has('childYoB') && record.get('childYoB')
            ? new Date().getFullYear() - record.get('childYoB')
            : -1,
        };

        setPersonID(personDetails.personID);
        setPersonDetails(personDetails);
      } 
      else {
        const multipleMatches = result.records.map((record) => {
          const YoB = record.get('childYoB');
          const age = YoB ? new Date().getFullYear() - YoB : -1;

          return {
            personID: record.get('childID')?.toNumber() ?? null,
            personName: record.has('childName') ? record.get('childName') : "غير متوفر",
            fatherName: record.has('fatherName') ? record.get('fatherName') : "غير متوفر",
            grandfatherName: record.has('grandfatherName') ? record.get('grandfatherName') : "غير متوفر",
            familyName: record.has('familyName') ? record.get('familyName') : "غير متوفر",
            gender: record.has('childGender') ? record.get('childGender') : "غير متوفر",
            YoB: record.has('childYoB') ? record.get('childYoB') : null,
            age: record.has('childYoB') && record.get('childYoB')
              ? new Date().getFullYear() - record.get('childYoB')
              : -1,
          };
        });

        setPersonDetails({ multipleMatches });
      }
    } catch (err) {
      console.error('Query Error:', err);
      setPersonDetails(null);
    } finally {
      await session.close();
      setLoading(false);
    }
  }; 
  const spouseFamilyTree = async (rootID) => {
  const session = driver.session();

  try {
    const query = `
      MATCH (p:Person)
      WHERE id(p) = $rootID

      OPTIONAL MATCH (father:Person)-[:FATHER_OF]->(p)
      OPTIONAL MATCH (father)-[:FATHER_OF]->(sibling:Person)
      OPTIONAL MATCH (p)-[:FATHER_OF|MOTHER_OF]->(child:Person)

      RETURN father, collect(DISTINCT sibling) AS fatherChildren, collect(DISTINCT child) AS personChildren, id(p) AS personId
    `;

    const result = await session.run(query, { rootID });

    if (result.records.length === 0) {
      console.warn("No data returned from spouseFamilyTree query.");
      return null;
    }
    else {
      console.log("Spouse found");
    }
    console.log(result.records[0]);
    const tree = buildSmallFamilyTree(result.records[0]);
    setSmallFamilyTree(tree);

  } catch (error) {
    console.error('❌ Error fetching spouse family tree:', error);
    return null;
  } finally {
    await session.close();
  }
};
  useEffect(() => {
    if (!loading) return;

    const interval = setInterval(() => {
      setCurrentHintIndex((prev) => {
        let next;
        do {
          next = Math.floor(Math.random() * hints.length);
        } while (next === prev); 
        return next;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [loading]);

  usePageTracking();
  
  const goToPersonById = async () => {
    const container = treeContainerRef.current;

    if ((!showTree || !container)) {
      alert("الرجاء اظهار الشجرة أولا.");
      return;
    }

    const coords = nodePositions.current[personID];
    if (!coords) {
      console.warn(`Person with ID ${personID} not found.`);
      alert(`عذراً، لم يتم العثور على الشخص برقم ${personID} في الشجرة.`);
      setPersonDetails(null);
      return;
    }
    const bounds = container.getBoundingClientRect();
    setZoomLevel(0.8);
    setTimeout(() => {
      setTranslate({
        x: bounds.width / 2 - coords.x,
        y: bounds.height / 3 - coords.y,
      });
    }, 100);
  };

  useEffect(() => {
    if (!personID || !showTree || !treeContainerRef.current) return;

    const container = (showSpouse) ? smalltreeContainerRef.current : treeContainerRef.current;
    const coords = nodePositions.current[personID];

    if (!coords) {
      console.warn(`Person with ID ${personID} not found.`);
      alert(`عذراً، لم يتم العثور على الشخص برقم ${personID} في الشجرة.`);
      setPersonDetails(null);
      return;
    }

    const bounds = container.getBoundingClientRect();

    setZoomLevel(1);

    setTimeout(() => {
      setTranslate({
        x: bounds.width / 2 - coords.x,
        y: bounds.height / 3 - coords.y,
      });
    }, 100);
  }, [personID]);

  const handleBranchSelect = async (personID) => {
    const id = parseInt(personID);
    setSelectedBranch(personID);
    setSelectedSubtree('');
    if (!isNaN(id)) {
      await loadFamilyTree(id, 'tree', treeMode === 'lazy');
      setPersonID(personID);
    }
  };
  
  const handlePersonClickPopup = async (person) => {
    const session = driver.session();
    setWifeId(null);
    setHusbandId(null);
    try {
      const query = `
        MATCH (p:Person)-[:MARRIED_TO]-(spouse:Person)
        WHERE id(p) = $id
        RETURN id(spouse) AS SpouseID
        LIMIT 1
      `;

      const result = await session.run(query, { id: person.id });
      
      if (result.records.length > 0) {
        const spouseId = result.records[0].get("SpouseID").toNumber();

        setSpouseId(spouseId);
      } else {
        setSpouseId(null);
      }

      setSelectedPerson(person);
      setPopupMode('info');
      setShowPopup(true);

    } catch (error) {
      console.error("Error fetching spouse:", error);
    } finally {
      await session.close();
    }
  };

  const handlePersonClick = (nodeDatum) => {
    console.log(nodeDatum);
    
    if (treeMode === "lazy") {
      if (!Array.isArray(nodeDatum._realChildren) || nodeDatum._realChildren.length === 0) {
        toast.warn('هذا الشخص لا يملك أبناء.');
      };
      const updateLazyTree = (node) => {
        if (node.id === nodeDatum.id) {
          const expanded = !node._lazyLoaded;
          setTreeCount(treeCount + node._realChildren.length);
          return {
            ...node,
            children: expanded ? node._realChildren : [],
            _lazyLoaded: expanded,
          };
        } else if (node.children) {
          return {
            ...node,
            children: node.children.map(updateLazyTree),
          };
        } else {
          
          return node;
        }
      };

      const updatedTree = updateLazyTree(familyTree);
      setFamilyTree(updatedTree); // triggers re-render
    } else {
      handlePersonClickPopup(nodeDatum);
    }
  };

  const handlePersonTreeDisplay = async () => {
    const ID = parseInt(personID, 10);
    console.log("Displaying tree for :", ID);
    setPersonDetails(null);
    await loadFamilyTree(ID, 'fullLineage', treeMode === 'lazy');
    goToPersonById(personID);
  };

  const handleRootTreeClick = async () => {
    await loadFamilyTree(ROOT, 'fullLineage', treeMode === 'lazy', true);
    goToPersonById(ROOT);
  };

  useEffect(() => {
    console.log(familyTree);
  }, [familyTree])

  const handleRootWomenTreeClick = async () =>{
    await loadFamilyTree(ROOT, false, treeMode === 'lazy')
  };

  useEffect(() => {
    const treeCount = countTreeNodes(familyTree);
    const maxDepth = getTreeDepth(familyTree);
    setTreeCount(treeCount);
    setTreeDepth(maxDepth);
    setMaxGeneration(maxDepth);
  }, [familyTree]);

  const loadFamilyTree = async (rootID, mode, isLazy = false, type = true) => {
    try {
      setLoading(true);

      let people = [];

      if (mode === 'fullLineage') {
        people = await fetchSpecifiedFamilyTree(rootID);
      } else {
        people = await fetchFamilyTree(rootID, type);
      }

      if (!Array.isArray(people) || people.length === 0) {
        console.warn("Empty or invalid people data");
        return;
      }

      const childrenMap = buildChildrenMap(people);
      function buildLazyNode(node, childrenMap) {
        const realChildren = childrenMap[node.id] || [];

        return {
          ...node,
          name: utils.translateName(node.name),
          lastName: utils.translateFamilyName(node.lastName),
          children: [],  
          _realChildren: realChildren.map(child => buildLazyNode(child, childrenMap)),
          _lazyLoaded: false,
        };
      };
      // ✅ 2. LAZY OPTION HANDLING
      if (isLazy) {
        const rootPerson = people.find(p => p.id === rootID);
        if (!rootPerson) {
          console.warn(`Root ID ${rootID} not found in fetched people.`);
          return;
        }

        const rootLazyNode = buildLazyNode(rootPerson, childrenMap);
        setFamilyTree(rootLazyNode);
        setShowTree(true);
        return;
      }


      // ✅ 3. NORMAL (FULL LOAD) HANDLING
      if (mode === 'fullLineage') {
        const rootCandidates = people.filter(p => !people.some(other => other.children.some(c => c.id === p.id)));
        const lineageRoot = rootCandidates.length ? rootCandidates[0] : people[0];
        const partialTree = buildPartialTree(lineageRoot, childrenMap, rootID, new Set());

        if (!partialTree) {
          console.warn(`Could not build partial tree for rootID ${rootID}`);
          return;
        }

        setFamilyTree(partialTree);
        const treeStats = countTreeNodes(partialTree);
        const maxDepth = getTreeDepth(partialTree);
        setTreeCount(treeStats);
        setTreeDepth(maxDepth);
        setMaxGeneration(maxDepth);
      } else {
        const rootPersonFlat = people.find(p => p.id === rootID);
        if (!rootPersonFlat) {
          console.warn(`Root ID ${rootID} not found in fetched people.`);
          return;
        }

        const rootWrapped = {
          id: rootPersonFlat.id,
          name: rootPersonFlat.name,
          lastName: rootPersonFlat.lastName,
          gender: rootPersonFlat.gender,
        };

        const fullTree = buildTreeSafe(rootWrapped, childrenMap, new Set());
        setFamilyTree(fullTree);
        const treeCount = countTreeNodes(fullTree);
        const maxDepth = getTreeDepth(fullTree);
        setTreeCount(treeCount);
        setTreeDepth(maxDepth);
        setMaxGeneration(maxDepth);
      }

      setShowTree(true);
    } catch (error) {
      console.error("Error loading family tree:", error);
    } finally {
      setLoading(false);
    }
  };

  let holdTimer = null;

  const startHoldTimer = (person) => {
    holdTimer = setTimeout(() => {
      handlePersonClickPopup(person); // your popup info function
    }, 500); // 500ms hold = long press
  };

  const cancelHoldTimer = () => {
    clearTimeout(holdTimer);
  };

  const handleSetTreeMode = () =>{
    const mode = document.getElementById("mode").value;
    console.log(mode);
    setTreeMode(mode);
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    document.title = "شجرة عرش قصر أولاد بوبكر";
  }, []);


  useEffect(() => {
    if (personDetails && personDetails.personID) {
      goToPersonById(personDetails.personID);
      setPersonDetails(null);
    }
  }, [personDetails]);

  return (
    <div className="treePage">
      <header>
        <h1 id="title">شجرة عائلة قصر أولاد بوبكر</h1>
        <div className="d">
          <p id="paragraph">
            في هذه الصفحة، يمكنك تصفح شجرة عائلة قصر أولاد بوبكر من الجد المؤسس بوبكر وصولًا إلى الجيل الحالي. 
            تهدف الصفحة إلى عرض العلاقات العائلية بشكل دقيق ومنظم، مما يتيح لك فهم تسلسل الأنساب، 
            وتاريخ تطور العرش، والتعرف على أفراد العائلة عبر الأجيال. 
            استكشف كيف ترابطت العائلات، وتعمّق في جذورك وهويتك العائلية.
          </p>
        </div>
        <div className='treefetchtype'>
          <select id="mode" onChange={handleSetTreeMode}>
            
            <option value="lazy">تحميل الشجرة عند النقر على الشخص</option>
            <option value="full">تحميل الشجرة كاملة</option>

          </select>
        </div>
      </header>
      <div className="screen">
    
    <aside className="panel panel--controls">
      
      <div className="filterChoice">
        
        <div className="card">
          <h3>تصفح الشجرة العائلية الكبرى</h3>

          <p className="info-text">
            يمكنك تصفح الشجرة العائلية الكاملة ابتداءً من الجدّ الأعلى وصولاً إلى الأجيال الحديثة. يتوفّر نمطان للعرض:
          </p>

          <p className="info-text">
              <strong style={{ color: 'blue' }}>شجرة العائلة التقليدية:</strong> تظهر الأنساب ابتداءً من الجدّ الأول دون احتساب أبناء الأمهات.
          </p>

          <p className="info-text">
            <strong style={{ color: '#b52155' }}>شجرة العائلة مع أبناء الأمهات:</strong> تُظهر أيضًا أبناء الأمهات، لجعل الشجرة أكثر شمولًا
            <strong id="warning"> — ولكن قد تحتوي على تكرارات وتكون ضخمة!</strong>
          </p>
              
          <div className="rootButton">
            <button id="men" onClick={handleRootTreeClick}>شجرة العائلة التقليدية</button>
            <button id="women" onClick={handleRootWomenTreeClick}>شجرة مع أبناء الأمهات</button>
          </div>

        </div>
        <div className="card">
          <h3>تصفح أحد الفروع الرئيسية</h3>
          <p className="info-text">
            اختر أحد الفروع الرئيسية لعائلة بوبكر لعرض النسب الكامل الخاص به.
          </p>
          <div className="toggle-group">
            <div className="toggle-options">
              <input
                type="radio"
                id="browse-family"
                name="type"
                onClick={() => setBranchingMode("Family")}
              />
              <label htmlFor="browse-family">تصفح حسب اللقب (العائلة)</label>

              <input
                type="radio"
                id="browse-branch"
                name="type"
                onClick={() => setBranchingMode("Branch")}
              />
              <label htmlFor="browse-branch">تصفح حسب الفرع</label>
            </div>
          </div>

          {branchingMode === "Branch" && (
              <>
                <select
                  className="branch-selector"
                  value={selectedBranch}
                  onChange={(e) => {
                    setSelectedBranch(e.target.value);
                    switch (e.target.value){ 
                      case "203": setTitle(title + "بوبكر"); break
                      case "202": setTitle(title + "فرحات"); break
                      case "176": setTitle(title + "إمحمّد"); break
                      case "224": setTitle(title + "فرحات"); break
                      case "223": setTitle(title + "سالم"); break
                    }
                  }}
                > 
                  <option value="">-- اختر فرعًا --</option>
                  <option value="203">الجد الأول بوبكر</option>
                  <option value="202">فرع فرحات</option>
                  <option value="176">فرع إمحمّد</option>
                  <option value="224">فرع عمر</option>
                  <option value="223">فرع سالم</option>
                </select>

                {selectedBranch === '223' && (
                  <div className="subtreeSelect">
                    <p className="branch-selector-description">اختر فرعًا من فرع سالم:</p>
                    <select
                      className="branch-selector"
                      onChange={(e) =>{ 
                        setSelectedSubtree(e.target.value);
                        switch (e.target.value){
                          case "390": setTitle("شجرة فرع علي بن سالم"); break
                          case "391": setTitle("شجرة فرع احمد بن سالم"); break
                          case "392": setTitle("شجرة فرع بوبكر بن سالم"); break
                          case "389": setTitle("شجرة فرع خليفة بن سالم"); break
                          case "393": setTitle("شجرة فرع سالم بن سالم (عبد الله بن سالم)"); break
                        } 
                      }}
                      value={selectedSubtree}
                    >
                      <option value="-1">-- اختر فرعًا فرعيًا --</option>
                      <option value="390">فرع أولاد علي بن سالم</option>
                      <option value="391">فرع أولاد احمد بن سالم</option>
                      <option value="392">فرع أولاد بوبكر بن سالم</option>
                      <option value="389">فرع أولاد خليفة بن سالم</option>
                      <option value="393">فرع اولاد سالم بن سالم (عبد الله بن سالم)</option>
                    </select>
                  </div>
                )}

                {selectedBranch === '176' && (
                  <div className="subtreeSelect">
                    <p className="branch-selector-description">اختر فرعًا فرعيًا من فرع إمحمّد:</p>
                    <select
                      className="branch-selector"
                      onChange={(e) =>{ 
                        setSelectedSubtree(e.target.value);
                        switch (e.target.value){
                          case "175": setTitle("شجرة فرع بوبكر بن إمحِمّدْ"); break
                          case "353": setTitle("شجرة فرع حسن بن إمحِمّدْ"); break
                          case "174": setTitle("شجرة فرع ابراهيم بن إمحِمّدْ"); break
                        }
                      }}
                    >
                      <option value="">-- اختر فرعًا فرعيًا --</option>
                      <option value="175">فرع أولاد بوبكر بن إمحِمّدْ</option>
                      <option value="353">فرع أولاد حسن بن إمحِمّدْ</option>
                      <option value="174">فرع أولاد ابراهيم بن إمحِمّدْ</option>
                    </select>
                  </div>
                )}

                {selectedBranch === '202' && (
                  <div className="subtreeSelect">
                    <p className="branch-selector-description">اختر فرعًا فرعيًا من فرع فرحات:</p>
                    <select
                      className="branch-selector"
                      onChange={(e) =>{ 
                        setSelectedSubtree(e.target.value);
                        switch (e.target.value){
                          case "316": setTitle("شجرة فرع منصور بن فرحات"); break
                          case "373": setTitle("شجرة فرع مبارك بن فرحات"); break
                          case "201": setTitle("شجرة فرع إمحِمّدْ بن فرحات"); break
                        }
                      }}
                    >
                      <option value="">-- اختر فرعًا فرعيًا --</option>
                      <option value="316">فرع أولاد منصور بن فرحات</option>
                      <option value="373">فرع أولاد مبارك بن فرحات</option>
                      <option value="201">فرع أولاد إمحِمّدْ بن فرحات</option>
                    </select>
                  </div>
                )}

              </>
            )}
          {branchingMode === "Family" && (
            <select
                  className="branch-selector"
                  value={selectedBranch}
                  onChange={(e) => {
                    setSelectedBranch(e.target.value);
                    switch (e.target.value){
                      case "137": setTitle("شجرة عائلةالتائب "); break;
                      case "443": setTitle("شجرة عائلة اللقماني"); break;
                      case "303": setTitle("شجرة عائلة مصدق"); break;
                      case "395": setTitle("شجرة عائلة الرحموني"); break;
                      case "444": setTitle("شجرة عائلة السقراطي"); break;
                      case "397": setTitle("شجرة عائلة الأمجد"); break;
                    }
                  
                  }}
                >
                  <option value="">-- اختر عائلة --</option>
                  <option value="137">فرع التائب</option>
                  <option value="443">فرع اللقماني</option>
                  <option value="303">فرع مصدق (الجراويل)</option>
                  <option value="395">فرع الرحموني</option>
                  <option value="444">فرع السقراطي</option>
                  <option value="204">فرع الفرجاني</option>
                  <option value="469">فرع المحسني</option>
                  <option value="491">فرع السالمي</option>
                  <option value="860">فرع الفرابي</option>
                  <option value="397">فرع الأمجد</option>
                  <option value="384">فرع الشاكري</option>
                  <option value="821">فرع الشامخي</option>
                  <option value="521">فرع الجامعي</option>
                  <option value="847">فرع العزابي</option>
                </select>
          )}
          
          <button className='searchButton' onClick={() => {
            handleBranchSelect(selectedSubtree || selectedBranch);
            setSelectedBranch('-1');
          }}
          
          >عرض الشجرة</button>
        </div>

        <div className="card">
          <h3>عرض شجرة انطلاقًا من شخص معين</h3>

          <p className="info-text">
            اكتب اسم الشخص كاملاً أو جزئياً، أو أدخل الرقم التسلسلي (ID)، لعرض شجرته مع أجداده وذريته.
          </p>
          <label>عرض أبناء الأمهات</label>
          <input type="checkbox"></input>
          <input className="SearchInput" id="TreeRoot" type="text" placeholder="أَدخِل الرقم التسلسلي أو اسم الشخص"/>
          <button className='searchButton' onClick={async () =>{
            setPersonDetails(null); 
            await handleSearch('Tree'); 
            setLookoutMode("Tree");
          }
          }>عرض الشجرة</button>

          
        </div>

        <div className="card">
            <h3>البحث في الشجرة باستخدام رقم الهوية</h3>
            <p className="info-text">
              يمكنك إدخال الرقم التسلسلي (ID) أو الاسم هنا مباشرة للبحث في الشجرة. تأكد أولاً من وجود الشخص في الشجرة وعرضها قبل البحث. للحصول على الرقم التسلسلي، ابحث عن الشخص في <a href="/search">صفحة البحث</a>، ثم انسخ الرقم أعلى اسمه والصقه هنا.
            </p>
            <input className="SearchInput" id="NodeTreeSearch" type="text" placeholder="أَدخِل الرقم التسلسلي أو اسم الشخص" />
            <button
             className='searchButton'
              onClick={ async () => {
                await handleSearch('Node');
                setLookoutMode('Node');
              }}
            >
              ابحث في الشجرة
            </button>
            
        </div>
      </div>
    </aside>
    {(personDetails && lookoutMode === "Tree") ? (
      personDetails.multipleMatches && personDetails.multipleMatches.length > 1 ? (
        <div className="modal-overlay">
          <div className="modal-content multiple-matches">
            <h2>🔍 تم العثور على أكثر من شخص:</h2>
            <table className="duplicated-table">
              <thead>
                <tr>
                  <th>الرقم التسلسلي</th>
                  <th>الاسم</th>
                  <th>اسم الأب</th>
                  <th>اسم الجدّ</th>
                  <th>اللقب</th>
                  <th>العمر</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {personDetails.multipleMatches.map((person, index) => (
                  <tr key={index}>
                    <td>{person.personID}</td>
                    <td>{utils.translateName(person.personName)}</td>
                    <td>{person.fatherName ? utils.translateName(person.fatherName) : ''}</td>
                    <td>{person.grandfatherName ? utils.translateName(person.grandfatherName) : ''}</td>
                    <td>{person.familyName ? utils.translateFamilyName(person.familyName) : ''}</td>
                    <td>{person.age !== -1 ? person.age : ' - '}</td>
                    <td>
                      <button
                        className="choiceButton"
                        onClick={async () => {
                          handlePersonTreeDisplay(person.personID);
                          setPersonDetails(null);
                        }}
                      >
                        اختيار
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => setPersonDetails(null)}>إغلاق</button>
          </div>
        </div>
      ) : (
        <>
          {handlePersonTreeDisplay(personDetails.personID)}
          {setPersonDetails(null)}
        </>
      )
    ) : null}
    {(personDetails && lookoutMode === 'Node') ? (
              personDetails.multipleMatches && personDetails.multipleMatches.length > 1 ? (
                <div className="modal-overlay">
                  <div className="modal-content multiple-matches">
                    <h2>🔍 تم العثور على أكثر من شخص:</h2>
                    <table className="duplicated-table">
                      <thead>
                        <tr>
                          <th>الرقم التسلسلي</th>
                          <th>الاسم</th>
                          <th>اسم الأب</th>
                          <th>اسم الجدّ</th>
                          <th>اللقب</th>
                          <th>العمر</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {personDetails.multipleMatches.map((person, index) => (
                          <tr key={index}>
                            <td>{person.personID}</td>
                            <td>{utils.translateName(person.personName)}</td>
                            <td>{person.fatherName ? utils.translateName(person.fatherName) : ''}</td>
                            <td>{person.grandfatherName ? utils.translateName(person.grandfatherName) : ''}</td>
                            <td>{person.familyName ? utils.translateFamilyName(person.familyName) : ''}</td>
                            <td>{person.age !== -1 ? person.age : ' - '}</td>
                            <td>
                              <button
                                className="choiceButton"
                                onClick={async () => {
                                  setPersonDetails(null);
                                  setPersonID(person.personID);
                                  await goToPersonById(person.personID);
                                }}
                              >
                                اختيار
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button onClick={() => setPersonDetails(null)}>إغلاق</button>
                  </div>
                </div>
              ) : (
                <>
                </>
              )
    ) : null}        
    <main className="panel panel--tree">
      {loading && (
        <div className="loading-indicator">
          <p>جارٍ تحميل الشجرة...</p>
          <p style={{ marginTop: 10, fontStyle: 'italic', color: '#555', fontSize: 14 }}>
            {hints[currentHintIndex]}
          </p>
          <div className="spinner" style={{
          }} />
        </div>
      )}

      {!loading && !showTree && (
        <div style={{ textAlign: 'center', padding: 30, alignItems: 'center' }}>
          <p>لا توجد بيانات شجرة لعرضها.</p>
        </div>
      )}
      
      {showTree && familyTree && !loading ? (
        
         <FamilyTreeComponent
          familyTree={familyTree}
          smallFamilyTree={smallFamilyTree}
          translate={{ x: 400, y: 200 }}  // example
          zoomLevel={zoomLevel}
          selectedGeneration={selectedGeneration}
          treeCount={treeCount}
          treeDepth={treeDepth}
          maxGeneration={maxGeneration}
          title={title}
          showPopup={showPopup}
          selectedPerson={selectedPerson}
          showSpouse={showSpouse}
          spouseId={spouseId}
          personID={personID}
          setShowPopup={setShowPopup}
          setShowSpouse={setShowSpouse}
          setSpouseId={setSpouseId}
          goToPersonById={goToPersonById}
          handlePersonClick={handlePersonClick}
          handlePersonClickPopup={handlePersonClickPopup}
          startHoldTimer={startHoldTimer}
          cancelHoldTimer={cancelHoldTimer}
          nodePositions={nodePositions}
          treeContainerRef={treeContainerRef}
          smalltreeContainerRef={smalltreeContainerRef}
          isFullscreen={isFullscreen}
          husbandId={husbandId}
          wifeId={wifeId}
          peopleWithNoChildren={[]} // your array here
          spouseFamilyTree={spouseFamilyTree}
          setSelectedGeneration={setSelectedGeneration}
        />
      ) : 
      <p style={{ textAlign: 'center', marginTop: '2rem', color: '#777' }}>
        لا توجد شجرة لعرضها حالياً
      </p>
      }
    </main>
    </div>
    
    {loading && !showTree && !familyTree && (
      <div className="loading-indicator">
        <p>جار تحميل الشجرة...</p>
        <div className="spinner"></div>
      </div>
    )}
  </div>  
  );
};

export default FamilyTree;