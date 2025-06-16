import React, { useEffect, useState , useRef, use } from 'react';
import Tree from 'react-d3-tree';
import * as d3 from 'd3';
import '../styles/FamilyTree.css';
import neo4j from 'neo4j-driver';
import * as utils from '../utils/utils';
import usePageTracking from '../utils/trackers';
import { FiMaximize, FiMinimize } from 'react-icons/fi';
import peopleWithNoChildren from '../data/peopleWithNoChildren.json';
const ROOT = 203;
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
      WITH person, collect(child) AS children
      RETURN {
        id: id(person),
        name: person.name,
        lastName: person.lastName,
        gender: person.gender,
        isAlive: person.isAlive,
        Nickname : person.Nickname,
        Notes: person.Notes,
        children: [child IN children | {
          id: id(child),
          name: child.name,
          lastName: child.lastName,
          gender: child.gender,
          isAlive: child.isAlive,
          Nickname : child.Nickname,
          Notes: child.Notes
        }]
      } AS treeNode
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
      WITH person, collect(child) AS children
      RETURN {
        id: id(person),
        name: person.name,
        lastName: person.lastName,
        gender: person.gender,
        isAlive: person.isAlive,
        Nickname : child.Nickname,
        Notes: child.Notes,
        children: [child IN children | {
          id: id(child),
          name: child.name,
          lastName: child.lastName,
          gender: child.gender,
          isAlive: child.isAlive,
          Nickname : child.Nickname,
          Notes: child.Notes
        }]
      } AS treeNode
    `;
    let query;
    let result = '';
    if (type){
      query = defaultQuery
      queryParamsObject.rootID =  rootID;
      result = await session.run(query, queryParamsObject);
    }
    else{
      query = queryWithMother
      queryParamsObject.rootID =  rootID;
      result = await session.run(query, queryParamsObject);
    }

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
        children: includeChildren
          ? node.children.map(child => ({
              id: Number(child.id),
              name: child.name,
              gender: child.gender,
              isAlive: child.isAlive,
              lastName: child.lastName,
              Nickname: child.Nickname,
              Notes: child.Notes
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

    WITH person, collect(child) AS rawChildren
    WITH person, [c IN rawChildren WHERE c IS NOT NULL] AS children

    RETURN {
      id: id(person),
      name: person.name,
      gender: person.gender,
      lastName: person.lastName,
      isAlive: person.isAlive,
      Nickname: person.Nickname,
      Notes: person.Notes,
      children: [child IN children | {
        id: id(child),
        name: child.name,
        gender: child.gender,
        isAlive: child.isAlive,
        lastName: child.lastName,
        Nickname: child.Nickname,
        Notes: child.Notes
      }]
    } AS treeNode
    ORDER BY person.name
    `;

    const result = await session.run(query, { rootID: Number(rootID) });

    const familyTree = result.records.map(record => {
      const node = record.get('treeNode');
      console.log(node.id, rootID);
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
        children: includeChildren
          ? node.children.map(child => ({
              id: Number(child.id),
              name: child.name,
              gender: child.gender,
              isAlive: child.isAlive,
              lastName: child.lastName,
              Nickname: child.Nickname,
              Notes: child.Notes
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
  if (!node) return 0;
  const children = node.children || [];
  return 1 + children.reduce((sum, child) => sum + countTreeNodes(child), 0);
};

const FamilyTree = () => {
  const treeContainerRef = useRef(null);
  const [familyTree, setFamilyTree] = useState(null);
  const [husbandId, setHusbandId] = useState(null);
  const [wifeId, setWifeId] = useState(null);
  const [showTree, setShowTree] = useState(true);
  const [loading, setLoading] = useState(false);  
  const [translate, setTranslate] = useState({x : 0, y : 0});
  const nodePositions = useRef({});
  const [personID, setPersonID] = useState(null);
  const [focusAfterLoadId, setFocusAfterLoadId] = useState(null);
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
  const [zoomLevel, setZoomLevel] = useState(0);
  const [filters, setFilters] = useState({
    gender: 'all',       // 'all', 'Male', 'Female'
    maxDepth: null,      // e.g. 3 limits tree to 3 generations
    showOnlyWithChildren: false,
    showOnlyAlive: false,
    customSearch: ''     // by name or last name
  });

  const PeopleWithNoChildren = [226,227, 812, 673, 674, 827, 837, 850, 712, 331, 160, 490, 517, 928, 328, 98];

  const handleSearch = async (type) => {
    let inputValue = '';
      setPersonDetails(null);
    if (type === 'Node') {
      console.log("Mode: Node");
      
      inputValue = document.getElementById("NodeTreeSearch").value;
    } else if (type === 'Tree') {
      console.log("Mode: Tree");
      inputValue = document.getElementById("TreeRoot").value;
    }

    inputValue = inputValue.trim();
    if (!inputValue) return;

    if (!isNaN(inputValue)) {
      const id = parseInt(inputValue, 10);
      setPersonID(id);
      type === 'Node' ? await goToPersonById() : await handlePersonTreeDisplay();
    } else {
      await searchPerson(inputValue);
    }
  };

  const searchPerson = async (searchText) => {
    const isArabic = (text) => /[\u0600-\u06FF]/.test(text);
    setLoading(true); // Ensure loading starts here

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

  } else {
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
      } else if (result.records.length === 1) {
        const record = result.records[0];
        const YoB = record.get('childYoB');
        const age = YoB ? new Date().getFullYear() - YoB : -1;

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

  function GenerationRuler({ maxGeneration, selectedGeneration, onGenerationClick }) {
    return (
      <div className='genBar'>
        {[...Array(maxGeneration)].map((_, i) => {
          const genNum = i;
          const isActive = genNum === selectedGeneration;
          return (
            <div
              key={genNum}
              className='genNum'
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isActive ? '#66bb6a' : 'transparent',
                color: isActive ? '#fff' : '#444',
                borderRadius: 4,
                margin: '2px 6px',
                cursor: 'pointer',
                transition: 'background-color 0.3s ease',
              }}
              onClick={() => onGenerationClick(genNum)}
              title={`الجيل رقم ${genNum}`}
            >
              الجيل {genNum}
            </div>
          );
        })}
      </div>
    );
  };

  const goToPersonById = async () => {
    const container = treeContainerRef.current;
    
    if (!showTree || !container) {
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
    console.log(bounds.width, bounds.height);
    setTranslate({x: 0, y : 0});
    zoomToLevel(1);
    setTranslate({
      x: bounds.width / 2 - coords.x - bounds.width*2.8,
      y: bounds.height / 2 - coords.y - bounds.height
    });
  };

  const handleSubtreeSelect = (rootID) => {
    console.log(rootID);
    const id = parseInt(rootID);
    loadFamilyTree(id, "branch", true);
  };

  const handleBranchSelect = (selectedID) => {
    const id = parseInt(selectedID);
    setSelectedBranch(selectedID);
    setSelectedSubtree('');
    if (!isNaN(id)) {
      loadFamilyTree(id, 'tree');
    }
  };
  
  const handlePersonClick = async (person) => {
    console.log(person);
    const session = driver.session();
    setWifeId(null);
    setHusbandId(null);
    try {
      const gender = person.gender;

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
      setPopupMode('info'); // Always show info panel
      setShowPopup(true);

    } catch (error) {
      console.error("Error fetching spouse:", error);
    } finally {
      await session.close();
    }
  };

  const handlePersonTreeDisplay = async (personID) => {
    const ID = parseInt(personID, 10);
    console.log("Displauying tree for :", ID);
    if (isNaN(ID)) {
      alert("❗ الرجاء إدخال رقم صحيح للشخص.");
      return;
    }
    loadFamilyTree(ID, 'fullLineage');
  };

  const handleRootTreeClick = async () => {
    await loadFamilyTree(ROOT, 'fullLineage', true);
    setFocusAfterLoadId(ROOT);
  };

  const zoomToLevel = (level) => {
    const svg = d3.select(treeContainerRef.current).select('svg');
    const g = svg.select('g');

    svg.transition()
      .duration(500)
      .call(
        d3.zoom().on("zoom", (event) => {
          g.attr("transform", event.transform);
        })
        .transform,
        d3.zoomIdentity.scale(level)
      );
  };

  const handleRootWomenTreeClick = async () =>{
    loadFamilyTree(ROOT, false)
  };

  const loadFamilyTree = async (rootID, mode, type = true) => {
    try {
      setLoading(true);

      let people = [];
      if (mode === 'fullLineage') {
        people = await fetchSpecifiedFamilyTree(rootID);
      } 
      else {
        console.log(rootID, type);
        people = await fetchFamilyTree(rootID, type);
        console.log(people);
      }
      
      if (!Array.isArray(people) || people.length === 0) {
        console.warn("Empty or invalid people data");
        return;
      }
      const childrenMap = buildChildrenMap(people);

      if (mode === 'fullLineage') {
        const rootCandidates = people.filter(p => !people.some(other => other.children.some(c => c.id === p.id)));
        const lineageRoot = rootCandidates.length ? rootCandidates[0] : people[0];
        const partialTree = buildPartialTree(lineageRoot, childrenMap, rootID, new Set());
        if (!partialTree) {
          console.warn(`Could not build partial tree for rootID ${rootID}`);
          return;
        }

        const filteredTree = applyFilters(partialTree);
        setFamilyTree(filteredTree);
        
        const nodeCount = countTreeNodes(partialTree);
        const maxDepth = getTreeDepth(partialTree);
        setTreeCount(nodeCount);
        setTreeDepth(maxDepth-1);
        setMaxGeneration(maxDepth-1);
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
        console.log(fullTree);
        setFamilyTree(fullTree);

        const nodeCount = countTreeNodes(fullTree);
        const maxDepth = getTreeDepth(fullTree);
        setTreeCount(nodeCount);
        setTreeDepth(maxDepth-1);
        setMaxGeneration(maxDepth-1);
      }
      
      setShowTree(true);

    } catch (error) {
      console.error("Error loading family tree:", error);
    } finally {
      setLoading(false);
      
    }
  };

  const applyFilters = (node, currentDepth = 1) => {
    if (!node) return null;

    if (filters.maxDepth && currentDepth > filters.maxDepth) return null;

    if (
      (filters.gender !== 'all' && node.gender !== filters.gender) ||
      (filters.showOnlyWithChildren && (!node.children || node.children.length === 0)) ||
      (filters.showOnlyAlive && node.isDeceased) ||
      (filters.customSearch && !node.name.includes(filters.customSearch))
    ) {
      return null;
    }

    const filteredChildren = node.children
      ?.map(child => applyFilters(child, currentDepth + 1))
      .filter(Boolean);

    return {
      ...node,
      children: filteredChildren
    };
  };

  const toggleFullscreen = () => {
    const elem = treeContainerRef.current;

    if (!document.fullscreenElement) {
      elem.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
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
    // Update treeDepth whenever maxDepth filter changes
    if (filters.maxDepth !== null) {
      setTreeDepth(filters.maxDepth);
    } else {
      setTreeDepth(0); // or any default value
    }
  }, [filters.maxDepth]);

  useEffect(() => {
    if (focusAfterLoadId && nodePositions.current[focusAfterLoadId]) {
      goToPersonById(focusAfterLoadId);
      setFocusAfterLoadId(null);
    }
  }, [focusAfterLoadId, nodePositions.current]);

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
      </header>
      <div className="screen">
    
    <aside className="panel panel--controls">
      <div className="filterChoice">
        <div className="card" id="R1">
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

          <hr style={{ margin: '5px 0' }} />

          <h4>تصفح أحد الفروع الرئيسية</h4>
          <p className="branch-selector-description">
            اختر أحد الفروع الرئيسية لعائلة بوبكر لعرض النسب الكامل الخاص به.
          </p>
          <div className="toggle-group">
            <label className="group-label">اختر نوع التصفح:</label>

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
                  onChange={(e) => setSelectedBranch(e.target.value)}
                >
                  <option value="">-- اختر فرعًا --</option>
                  <option value="202">فرع فرحات</option>
                  <option value="176">فرع إمحمّد</option>
                  <option value="224">فرع عمر</option>
                  <option value="223">فرع سالم</option>
                </select>

                {selectedBranch === '223' && (
                  <div className="subtreeSelect">
                    <p className="branch-selector-description">اختر فرعًا فرعيًا من فرع سالم:</p>
                    <select
                      className="branch-selector"
                      onChange={(e) => setSelectedSubtree(e.target.value)}
                      value={selectedSubtree}
                    >
                      <option value="-1">-- اختر فرعًا فرعيًا --</option>
                      <option value="390">فرع أولاد علي بن سالم</option>
                      <option value="391">فرع أولاد احمد بن سالم</option>
                      <option value="392">فرع أولاد بوبكر بن سالم</option>
                      <option value="389">فرع أولاد خليفة بن سالم</option>
                      <option value="393">فرع أولاد سالم بن سالم</option>
                    </select>
                  </div>
                )}

                {selectedBranch === '176' && (
                  <div className="subtreeSelect">
                    <p className="branch-selector-description">اختر فرعًا فرعيًا من فرع إمحمّد:</p>
                    <select
                      className="branch-selector"
                      onChange={(e) => setSelectedSubtree(e.target.value)}
                    >
                      <option value="">-- اختر فرعًا فرعيًا --</option>
                      <option value="175">فرع أولاد بوبكر بن إمحِمّدْ</option>
                      <option value="225">فرع أولاد بلقاسم بن إمحِمّدْ</option>
                      <option value="174">فرع أولاد ابراهيم بن إمحِمّدْ</option>
                    </select>
                  </div>
                )}

                {selectedBranch === '202' && (
                  <div className="subtreeSelect">
                    <p className="branch-selector-description">اختر فرعًا فرعيًا من فرع فرحات:</p>
                    <select
                      className="branch-selector"
                      onChange={(e) => setSelectedSubtree(e.target.value)}
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
                  onChange={(e) => setSelectedBranch(e.target.value)}
                >
                  <option value="">-- اختر عائلة --</option>
                  <option value="137">فرع التائب</option>
                  <option value="443">فرع اللقماني</option>
                  <option value="303">فرع مصدق (الجراويل)</option>
                  <option value="395">فرع الرحموني</option>
                  <option value="444">فرع السقراطي</option>
                </select>
          )}
          <button className="SubTreeButton" onClick={() => {
            handleBranchSelect(selectedSubtree || selectedBranch);
            setSelectedBranch('-1');
          }}
          
          >عرض الشجرة</button>
        </div>

        <div className="card" id="R2">
          <h3>عرض شجرة انطلاقًا من شخص معين</h3>

          <p className="info-text">
            اكتب اسم الشخص كاملاً أو جزئياً، أو أدخل الرقم التسلسلي (ID)، لعرض شجرته مع أجداده وذريته.
          </p>

          <input className="SearchInput" id="TreeRoot" type="text" placeholder="أَدخِل الرقم التسلسلي أو اسم الشخص"/>
          <button className="btn-person" onClick={() =>{
            setPersonDetails(null); 
            handleSearch('Tree'); setLookoutMode("Tree");
            
          }
          }>عرض الشجرة</button>

          
        </div>

        <div className="card" id="R3">
          <div className="search-section">
            <h3>البحث في الشجرة باستخدام رقم الهوية</h3>
            <p className="info-text">
              يمكنك إدخال الرقم التسلسلي (ID) أو الاسم هنا مباشرة للبحث في الشجرة. تأكد أولاً من وجود الشخص في الشجرة وعرضها قبل البحث. للحصول على الرقم التسلسلي، ابحث عن الشخص في <a href="/search">صفحة البحث</a>، ثم انسخ الرقم أعلى اسمه والصقه هنا.
            </p>
            <input className="SearchInput"id="NodeTreeSearch" type="text" placeholder="أَدخِل الرقم التسلسلي أو اسم الشخص" />
            <button
              className="btn-person"
              onClick={ async () => {
                await handleSearch('Node');
                setLookoutMode('Node');
              }}
            >
              ابحث في الشجرة
            </button>
            
          </div>
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
        
        <div id="treeWrapper" ref={treeContainerRef}>
          {showPopup && selectedPerson && (
            <div className="popup">
              <h4>الرقم التسلسلي: {selectedPerson.id} </h4>
              <h4>الاسم: {selectedPerson.name} {selectedPerson.Nickname ? '('+ selectedPerson.Nickname + ')' : ''}</h4>
              <h4>اللقب: {selectedPerson.lastName}</h4>
              <h4>{selectedPerson.Notes ? 'ملاحطات : '+ selectedPerson.Notes : ''}</h4>
              
              {spouseId && (
                <button
                  
                  onClick={() => {
                    const coords = nodePositions.current[spouseId];
                    const container = treeContainerRef.current;

                    if (coords && container) {
                      const bounds = container.getBoundingClientRect();
                      setTranslate({
                        x: bounds.width / 2 - coords.x,
                        y: bounds.height / 2 - coords.y,
                      });
                    }
                    if (selectedPerson.gender === 'Male') {
                      setWifeId(spouseId);
                      setHusbandId(null);
                    } else {
                      setHusbandId(spouseId);
                      setWifeId(null);
                    }

                    setShowPopup(false);
                  }}
                >
                  {selectedPerson.gender === 'Male' ? "اذهب إلى الزوجة" : "اذهب إلى الزوج"}
                </button>
              )}

              <button onClick={() => {
                setShowPopup(false);
                setPopupMode('info');
              }}>
                إغلاق
              </button>
            </div>
          )}
          <div className="treeHeader">
            <div className="infoStats">
              <p id="stats">مجموع الأشخاص في هذه الشجرة : {treeCount}</p>
              <p id="stats">عدد الأجيال في هذه الشجرة : {treeDepth}</p>
            </div>
            <button onClick={toggleFullscreen} aria-label="Toggle fullscreen" style={{ fontSize: '24px', cursor: 'pointer', background: 'none', border: 'none' }}>
              {isFullscreen ? (
                <>
                  <FiMinimize id="icon"/> <span>تصغير الشاشة</span>
                </>
              ) : (
                <>
                  <FiMaximize id="icon"/> <span>تكبير الشاشة</span>
                </>
              )}
            </button>
          </div>
      <div style={{ display: 'flex', gap: 20 }}>
          <GenerationRuler
            maxGeneration={maxGeneration}
            selectedGeneration={selectedGeneration}
            onGenerationClick={setSelectedGeneration}
          />
        <div style={{ flexGrow: 1 }}>
          <Tree
            className="tree"
            data={familyTree}
            highlightGeneration={selectedGeneration}
            orientation="vertical"
            pathFunc="step"
            zoomable={!showPopup}
            draggable={!showPopup}
            style={{ pointerEvents: showPopup ? 'none' : 'auto' }}
            translate={translate}
            nodeSize={{ x: 110, y: 150 }}
            collapsible={true}
            zoom={1}
            separation={{ siblings: 1.2, nonSiblings: 1.2 }}
            renderCustomNodeElement={({ nodeDatum, hierarchyPointNode }) => {
            nodePositions.current[nodeDatum.id] = {
              x: hierarchyPointNode.x,
              y: hierarchyPointNode.y,
            };

            const isSelectedGen = selectedGeneration === nodeDatum.generation;

            // Default colors for special IDs
            const specialColors = {
              [husbandId]: '#66bb6a',
              [wifeId]: '#ff8a65',
              [personID]: '#cf14d9',
            };

            let fill;

            if (isSelectedGen) {
              fill = '#fbc02d';
            } else if (specialColors[nodeDatum.id]) {
              fill = specialColors[nodeDatum.id];
            } else {
              fill = '#4fc3f7'; 
            }

              return (
                
                <g onClick={(event) => handlePersonClick(nodeDatum, event)} style={{ cursor: 'pointer' }}>
                <defs>
                <linearGradient id={`grad-${nodeDatum.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                  <stop 
                    offset="100%" 
                    stopColor={
                      specialColors[nodeDatum.id] 
                        ? specialColors[nodeDatum.id] 
                        : (nodeDatum.isAlive ? fill : '#000000')
                    } 
                    stopOpacity="1" 
                  />
                </linearGradient>


                <filter id={`soft-shadow-${nodeDatum.id}`} x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.2" />
                </filter>
              </defs>


        <rect
          x="-60" y="-30"
          width="120" height="60"
          rx="16" ry="14"
          fill={`url(#grad-${nodeDatum.id})`}
          stroke={nodeDatum.gender === 'Female' ? '#b52155' : '#1bbc7b'}
          strokeWidth="2"
          filter={`url(#soft-shadow-${nodeDatum.id})`}
        />

        {(() => {
          const words = nodeDatum.name.split(' ');
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

          const allLines = [...lines];

          if (peopleWithNoChildren.includes(nodeDatum.id)) {
            allLines.push('∅');
          }

          return allLines.map((line, i) => (
            <text
              key={i}
              x="0"
              y={i * 18 - (allLines.length - 1) * 9}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{
                fontSize: '20px',
                fontFamily: 'Cairo',
                fill: nodeDatum.isAlive ? '#0d1f2d' : '#ffffff',
                fontWeight: 600,
                pointerEvents: 'none',
                strokeWidth: nodeDatum.isAlive ? 1 : 0,
              }}
            >
              {line}
            </text>

          ));

        })()}
      </g>

              );
            }}
          />
        </div>
      </div>
          
        </div>
      ) : 
      <p style={{ textAlign: 'center', marginTop: '2rem', color: '#777' }}>
        لا توجد شجرة لعرضها حالياً
      </p>
      }

      <p id="rotateSuggestion">ننصحك بتدوير الهاتف</p>
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