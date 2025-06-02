import React, { useEffect, useState , useRef, use } from 'react';
import Tree from 'react-d3-tree';
import '../styles/FamilyTree.css';
import neo4j from 'neo4j-driver';
import * as utils from '../utils/utils';
import usePageTracking from '../utils/trackers';
import { FiMaximize, FiMinimize } from 'react-icons/fi';

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

const fetchFamilyTree = async (type) => {
  const session = driver.session();
  const queryParamsObject = {};
  try {
    const defaultQuery = `
      MATCH (root:Person)
      WHERE id(root) = $rootID
      CALL {
        WITH root
        MATCH (root)-[:FATHER_OF]->(descendant)
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
          familyName: child.lastName,
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
        children: [child IN children | {
          id: id(child),
          name: child.name,
          familyName: child.lastName,
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

const fetchSpecifiedFamilyTree = async (rootID) => {
  const session = driver.session();
  try {
    const query = `
    MATCH (start:Person) WHERE id(start) = $rootID

    // Collect ancestors: persons on path from root ancestor to start
    OPTIONAL MATCH pathUp = (ancestor:Person)-[:FATHER_OF]->(start)
    WITH collect(DISTINCT ancestor) AS ancestors, start

    // Collect descendants: persons on path down from start
    OPTIONAL MATCH pathDown = (start)-[:FATHER_OF*]->(descendant:Person)
    WITH ancestors, collect(DISTINCT descendant) AS descendants, start

    // Combine all relevant persons: ancestors + start + descendants
    WITH apoc.coll.toSet(ancestors + descendants + [start]) AS lineage

    UNWIND lineage AS person

    // Get children of each person only if they are in lineage (to avoid unrelated children)
    OPTIONAL MATCH (person)-[:FATHER_OF*]->(child:Person)
    WHERE child IN lineage

    WITH person, collect(child) AS rawChildren

    // Filter out null children explicitly
    WITH person, [c IN rawChildren WHERE c IS NOT NULL] AS children

    RETURN {
      id: id(person),
      name: person.name,
      gender: person.gender,
      lastName: person.lastName,
      children: [child IN children | {
        id: id(child),
        name: child.name,
        gender: child.gender,
        lastName: child.lastName
      }]
    } AS treeNode
    ORDER BY person.name


    `;

    const result = await session.run(query, { rootID: Number(rootID) });

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
      };
      return buildTreeSafe(childObj, childMap, seen, generation + 1);
    })
    .filter(Boolean);

  return {
    id: person.id,
    name: translatedName,
    lastName: translatedLastName,
    gender: person.gender,
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
      gender: person.gender,
      ...(childrenNodes.length > 0 ? { children: childrenNodes } : {})
    };
  }

  // Otherwise prune this node out (not on path)
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
  const [popupMode, setPopupMode] = useState('info'); // 'info' or 'spouse'
  const [showPopup, setShowPopup] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [selectedSubtree, setSelectedSubtree] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [maxGeneration, setMaxGeneration] = useState(0); // total generations available
  const [selectedGeneration, setSelectedGeneration] = useState(null);
  const [currentHintIndex, setCurrentHintIndex] = React.useState(0);
  const [personDetails, setPersonDetails] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedPersonID, setSearchedPersonID] = useState('');

  const handleSearchSubmit = async () => {
    setSearchedPersonID(null);
    setPersonDetails(null);
    if (!searchQuery.trim()) {
      setPersonDetails(null);
      return;
    }
    await searchPerson(searchQuery.trim());
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

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
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

  const [filters, setFilters] = useState({
    gender: 'all',       // 'all', 'Male', 'Female'
    maxDepth: null,      // e.g. 3 limits tree to 3 generations
    showOnlyWithChildren: false,
    showOnlyAlive: false,
    customSearch: ''     // by name or last name
  });
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
  }
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
  const handleSubtreeSelect = (value) => {
    loadFamilyTree(value); // or another specific function
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

  const handleRootWomenTreeClick = async () =>{
    loadFamilyTree(ROOT, false)
  };

  const loadFamilyTree = async (rootID, mode = 'branch', type = null) => {
    try {
      setLoading(true);

      let people = [];
      if (mode === 'fullLineage') {
        people = await fetchSpecifiedFamilyTree(rootID);
      } else {
        people = await fetchFamilyTree(type, true);
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
        // const filteredTree = applyFilters(fullTree);
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
        <div className="filter-header">
          <h3>مرشحات عرض شجرة العائلة</h3>
          <p>استخدم المرشحات أدناه لتضييق نطاق العرض وإظهار الأشخاص الذين تهمك تفاصيلهم فقط.</p>
        </div>
        <table className="filters-table-horizontal">
          <thead>
            <tr>
              <th>الجنس</th>
              <th>عدد الأجيال</th>
              <th>فقط من لديهم أبناء</th>
              <th>فقط الأحياء</th>
              <th>البحث بالاسم</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <select onChange={e => setFilters(f => ({ ...f, gender: e.target.value }))}>
                  <option value="all">الكل</option>
                  <option value="Male">الذكور فقط</option>
                  <option value="Female">الإناث فقط</option>
                </select>
              </td>
              <td>
                <input
                  type="number"
                  placeholder="عدد الأجيال"
                  value={filters.maxDepth || ''}
                  onChange={e => setFilters(f => ({ ...f, maxDepth: Number(e.target.value) || null }))}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  id="childrenFilter"
                  onChange={e => setFilters(f => ({ ...f, showOnlyWithChildren: e.target.checked }))}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  id="aliveFilter"
                  onChange={e => setFilters(f => ({ ...f, showOnlyAlive: e.target.checked }))}
                />
              </td>
              <td>
                <input
                  type="text"
                  placeholder="ابحث بالاسم"
                  onChange={e => setFilters(f => ({ ...f, customSearch: e.target.value }))}
                />
              </td>
            </tr>
          </tbody>
        </table>


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
          <div className="branchSelect">
            <p className="branch-selector-description">
              اختر أحد الفروع الرئيسية لعائلة بوبكر لعرض النسب الكامل الخاص به.
            </p>
            <select onChange={(e) => handleBranchSelect(e.target.value)} className="branch-selector">
              <option value="">-- اختر فرعًا --</option>
              <option value="202">فرع فرحات</option>
              <option value="176">فرع إمحمّد</option>
              <option value="XXX">فرع عمر</option>
              <option value="223">فرع سالم</option>
            </select>
          </div>

          {/* Only show sub-tree selector if "سالم" branch is selected */}
          {selectedBranch === '223' && (
            <div className="subtreeSelect">
              <p className="branch-selector-description">اختر فرعًا فرعيًا من فرع سالم:</p>
              <select
                onChange={(e) => {
                  setSelectedSubtree(e.target.value);
                  handleSubtreeSelect(e.target.value); // optional: load subtree
                }}
                className="branch-selector"
              >
                <option value="">-- اختر فرعًا فرعيًا --</option>
                <option value="390">فرع ضراري علي</option>
                <option value="391">فرع ضراري احمد</option>
                <option value="392">فرع ضراري بوبكر</option>
                <option value="389">فرع ضراري خليفة</option>
                <option value="393">فرع ضراري سالم</option>
              </select>
            </div>
          )}
          
        </div>

        {/* Card R2 */}
        <div className="card" id="R2">
          <p className="info-text">
            للحصول على رقم الهوية، استخدم صفحة <a href="/search" target="_blank" style={{ color: '#007bff' }}>البحث</a>، ثم انسخ الرقم الظاهر فوق الاسم والصقه هنا.
          </p>
          <input id="rootID" type="text" placeholder="أدخل رقم الشخص" onChange={handleSearchChange}/>
          <button className="btn-person" onClick={handleSearchSubmit}>
            شجرة ابتداءً من شخص
          </button>
          {personDetails ? (
            personDetails.multipleMatches && personDetails.multipleMatches.length > 1 ? (
              // Multiple matches modal
              <div className="modal-overlay">
                <div className="modal-content multiple-matches">
                  <h2>نتائج متعددة:</h2>
                  <table className="duplicated-table">
                    <thead>
                      <tr>
                        <th>الرقم التسلسلي</th>
                        <th>الإسم</th>
                        <th>إسم الأب</th>
                        <th>إسم الجدّ</th>
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
                                await handlePersonTreeDisplay(person.personID);
                                setPersonDetails(null);
                              }}
                            >
                              إختيار
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
              // Single unique match - show tree directly
              <>
                {handlePersonTreeDisplay(personDetails.personID)}
                {/* You may want to reset personDetails after displaying tree */}
                {setPersonDetails(null)}
              </>
            )
          ) : null}

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
      {loading && (
        <div className="loading-indicator">
          <p>جارٍ تحميل الشجرة...</p>
          <p style={{ marginTop: 10, fontStyle: 'italic', color: '#555' }}>
            {hints[currentHintIndex]}
          </p>
          <div className="spinner" style={{
          }} />
        </div>
      )}

      {!loading && !showTree && (
        <div style={{ textAlign: 'center', padding: 30 }}>
          <p>لا توجد بيانات شجرة لعرضها.</p>
        </div>
      )}
      
      {showTree && familyTree && !loading ? (
        
        <div id="treeWrapper" ref={treeContainerRef}>
          {showPopup && selectedPerson && (
            <div className="popup">
              <h4>الرقم التسلسلي: {selectedPerson.id}</h4>
              <h4>الاسم: {selectedPerson.name}</h4>
              <p>اللقب: {selectedPerson.lastName}</p>
              <p>ملاحظات: </p>

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
              <p>مجموع الأشخاص في هذه الشجرة : {treeCount}</p>
              <p>عدد الأجيال في هذه الشجرة : {treeDepth}</p>
            </div>
            <button onClick={toggleFullscreen} aria-label="Toggle fullscreen" style={{ fontSize: '24px', cursor: 'pointer', background: 'none', border: 'none' }}>
              {isFullscreen ? (
                <>
                  <FiMinimize /> <span>تصغير الشاشة</span>
                </>
              ) : (
                <>
                  <FiMaximize /> <span>تكبير الشاشة</span>
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
            highlightGeneration={selectedGeneration} // your Tree uses this prop to style nodes
            orientation="vertical"
            pathFunc="step"
            zoomable={!showPopup}
            draggable={!showPopup}
            style={{ pointerEvents: showPopup ? 'none' : 'auto' }}
            translate={translate}
            nodeSize={{ x: 110, y: 150 }}
            separation={{ siblings: 1.1, nonSiblings: 1 }}
            
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
              // Highlight nodes of the selected generation with a distinct color
              fill = '#fbc02d'; // e.g. yellow highlight for selected generation
            } else if (specialColors[nodeDatum.id]) {
              fill = specialColors[nodeDatum.id];
            } else {
              fill = '#4fc3f7'; // default normal node color
            }

              return (
                
                <g onClick={(event) => handlePersonClick(nodeDatum, event)} style={{ cursor: 'pointer' }}>
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
                    x="-50" y="-25"
                    width="100" height="50"
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