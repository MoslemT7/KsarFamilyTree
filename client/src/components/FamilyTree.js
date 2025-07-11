import { useEffect, useState , useRef, use, lazy } from 'react';
import FamilyTreeComponent from './FamilyTreeComponent';
import usePageTracking from '../utils/trackers';
import neo4j from 'neo4j-driver';
import * as utils from '../utils/utils';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/FamilyTree.css';
import "../styles/ZoomBar.css";
import { FiX } from 'react-icons/fi';

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
  const translatedNode = {
    ...node,
    name: utils.translateName(node.name),
    lastName: utils.translateFamilyName(node.lastName),
  };

  if (translatedNode.children && translatedNode.children.length > 0) {
    translatedNode.children = translatedNode.children.map(translateNodeRecursive);
  }

  return translatedNode;
};

function buildLazyNode(node, childrenMap) {
    const realChildren = childrenMap[node.id] || [];

    return {
      ...node,
      name: utils.translateName(node.name),
      lastName: utils.translateFamilyName(node.lastName),
      children: [],  
      _realChildren: realChildren.map(child => ({ ...buildLazyNode(child, childrenMap) })),
      _lazyLoaded: false,
    };
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
        motherId: child.motherId,
        spouseId: child.spouseId
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
    motherId: person.motherId,
    spouseId: person.spouseId,
    generation,
    ...(childrenNodes.length > 0 ? { children: childrenNodes } : {})
  };
};

const buildChildrenMap = (allPeople) => {
  const peopleById = new Map(allPeople.map(p => [p.id, p]));

  const childMap = Object.create(null);

  allPeople.forEach(person => {
    if (Array.isArray(person.children)) {
      childMap[person.id] = person.children
        .map(childRef => peopleById.get(childRef.id))
        .filter(originalChild => originalChild != null)
        .map(orig => ({
          id: orig.id,
          name: orig.name,
          lastName: orig.lastName,
          gender: orig.gender,
          isAlive: orig.isAlive,
          Nickname: orig.Nickname,
          Notes: orig.Notes,
          motherId: typeof orig.motherId === 'number' ? orig.motherId : -1,
          spouseId: Array.isArray(orig.spouseId)
            ? [...orig.spouseId]              // clone the real array
            : (orig.spouseId == null || orig.spouseId === -1)
              ? []                            // normalize null/-1 → empty
              : [orig.spouseId]               // single ID → array
        }))
        .sort((a, b) => a.gender === "Male" ? -1 : 1);
    } else {
      childMap[person.id] = [];
    }
  });
  console.log(childMap);
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
  if (!node) return { totalCount: 0, aliveCount: 0, familiesCount: 0 };

  const children = node.children || [];

  const childCounts = children.map(countTreeNodes);

  const totalCount = 1 + childCounts.reduce((sum, c) => sum + c.totalCount, 0);
  const aliveCount = (node.isAlive ? 1 : 0) + childCounts.reduce((sum, c) => sum + c.aliveCount, 0);

  const familiesCount = (children.length > 0 ? 1 : 0) + childCounts.reduce((sum, c) => sum + c.familiesCount, 0);

  return { totalCount, aliveCount, familiesCount };
};


const FamilyTree = () => {
  const treeContainerRef = useRef(null);
  const nodePositions = useRef({});
  const spouseNodePositions = useRef({});
  const treeRef = useRef(null);
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
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedSubtree, setSelectedSubtree] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedGeneration, setSelectedGeneration] = useState(null);
  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const [personDetails, setPersonDetails] = useState(null);
  const [lookoutMode, setLookoutMode] = useState("");
  const [branchingMode, setBranchingMode] = useState("Branch");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [treeMode, setTreeMode] = useState("lazy");
  const [title, setTitle] = useState("");
  const [showSpouse, setShowSpouse] = useState(false);
  const [treeFetchMode, setTreeFetchMode] = useState('Normal');
  const [treeSearchQuery, setTreeSearchQuery] = useState("");
  const [focusTrigger, setFocusTrigger] = useState(0);
  const [childrenMap, setChildrenMap] = useState(null);

  let holdTimer = null;
  usePageTracking();

  useEffect(() => {
    if (personDetails?.personID) {
      const timeout = setTimeout(() => {
        if (treeContainerRef.current) {
          goToPersonById();
        } else {
          console.warn("Tree container not ready yet.");
        }
      }, 1000);

      return () => clearTimeout(timeout);
    }
  }, [personDetails]);

  useEffect(() => {
    console.log(familyTree);
  }, [familyTree]);

  useEffect(() => {
    document.title = 'شجرة عرش أولاد بوبكر';
  }, []);

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


  useEffect(() => {
    const treeCount = countTreeNodes(familyTree);
    const maxDepth = getTreeDepth(familyTree);
    setTreeCount(treeCount);
    setTreeDepth(maxDepth);
  }, [familyTree]);

  const handleSearch = async () => {
    let inputValue = '';
    setPersonDetails(null);
    if (lookoutMode === 'Node') {
      console.log("Mode: Node");
      
      inputValue = treeSearchQuery;
    } 
    else if (lookoutMode === 'Tree') {
      console.log("Mode: Tree");
      inputValue = document.getElementById("TreeRoot").value;
    }
    
    inputValue = inputValue.trim();
    if (!inputValue) return;

    if (!isNaN(inputValue)) {
      const id = parseInt(inputValue, 10);
      setPersonID(id);
      lookoutMode === 'Node' ? await goToPersonById(personID) : await handlePersonTreeDisplay();
    } 
    else {
      await searchPerson(inputValue);
    }
  };
  
  const fetchFamilyTree = async (rootID) => {
    const session = driver.session();
    try {
      const queryParamsObject = { rootID: Number(rootID) };
      const query = `
        MATCH (root:Person)
        WHERE id(root) = $rootID

        CALL {
          WITH root
          // Get all descendants via FATHER_OF
          MATCH (root)-[:FATHER_OF*]->(fDescendant)
          RETURN collect(DISTINCT fDescendant) AS allDescendants
        }

        WITH [root] + allDescendants AS allPeople
        UNWIND allPeople AS person
        
        OPTIONAL MATCH (mother:Person)-[:MOTHER_OF]->(person)
        OPTIONAL MATCH (person)-[:MARRIED_TO]-(sp:Person)
        WITH person, mother, collect(DISTINCT sp) AS allSpouses, count(DISTINCT sp) AS marriageCount

        OPTIONAL MATCH (person)-[:FATHER_OF]->(child:Person)
        OPTIONAL MATCH (childMother:Person)-[:MOTHER_OF]->(child)

        WITH person, mother, allSpouses, marriageCount,
            collect(DISTINCT {
              id: id(child),
              name: child.name,
              lastName: child.lastName,
              gender: child.gender,
              isAlive: child.isAlive,
              Nickname: child.Nickname,
              Notes: child.Notes,
              motherId: CASE WHEN childMother IS NULL THEN -1 ELSE id(childMother) END
            }) AS rawChildren

        // Now get child spouses separately
        OPTIONAL MATCH (person)-[:FATHER_OF]->(c:Person)
        OPTIONAL MATCH (c)-[:MARRIED_TO]-(s:Person)
        WITH person, mother, allSpouses, marriageCount, rawChildren,
            collect(DISTINCT {cid: id(c), sid: id(s)}) AS childSpousePairs

        // Merge children with their spouses
        WITH person, mother, allSpouses, marriageCount,
            [rc IN rawChildren |
          {
            id: rc.id,
            name: rc.name,
            lastName: rc.lastName,
            gender: rc.gender,
            isAlive: rc.isAlive,
            Nickname: rc.Nickname,
            Notes: rc.Notes,
            motherId: rc.motherId,
            spouseId: [pair IN childSpousePairs WHERE pair.cid = rc.id | pair.sid]
          }
        ] AS childrenData

        RETURN {
          id: id(person),
          name: person.name,
          lastName: person.lastName,
          gender: person.gender,
          isAlive: person.isAlive,
          Nickname: person.Nickname,
          Notes: person.Notes,
          motherId: CASE WHEN mother IS NULL THEN -1 ELSE id(mother) END,
          spouseId: [
            sp IN allSpouses |
              {
                id: id(sp),
                name: sp.name,
                nickname: sp.Nickname,
                lastName: sp.lastName,
                branch: sp.Branch,
                origin: CASE WHEN sp.Origin <> '' THEN sp.Origin ELSE 'Ksar Ouled Boubaker' END
              }
          ],
          marriageCount: marriageCount,
          children: childrenData
        } AS treeNode
        ORDER BY person.gender DESC


      `;

      const result = await session.run(query, queryParamsObject);

const familyTree = result.records.map(record => {
  const node = record.get('treeNode');

  // Filter out children with null IDs
  const validChildren = Array.isArray(node.children)
    ? node.children.filter(child => child && child.id !== null)
    : [];

  return {
    id: Number(node.id),
    name: node.name,
    gender: node.gender,
    lastName: node.lastName,
    isAlive: node.isAlive,
    Nickname: node.Nickname,
    Notes: node.Notes,
    motherId: node.motherId !== -1 ? Number(node.motherId) : null,
    spouseId: Array.isArray(node.spouseId)
      ? node.spouseId
          .filter(sp => sp && sp.id !== null)
          .map(sp => ({
            id: Number(sp.id),
            name: sp.name,
            nickname: sp.Nickname,
            lastName: sp.lastName,
            branch: sp.branch,
            origin: sp.origin
          }))
      : [],
    children: validChildren.map(child => ({
      id: Number(child.id),
      name: child.name,
      gender: child.gender,
      isAlive: child.isAlive,
      lastName: child.lastName,
      Nickname: child.Nickname,
      Notes: child.Notes,
      motherId: child.motherId !== -1 ? Number(child.motherId) : null,
      spouseId: Array.isArray(child.spouseId)
        ? child.spouseId
            .filter(sp => sp && sp.id !== null)
            .map(sp => ({
              id: Number(sp.id),
              name: sp.name,
              nickname: sp.Nickname,
              lastName: sp.lastName,
              branch: sp.branch,
              origin: sp.origin
            }))
        : []
    }))
  };
});



      return familyTree;
    } catch (error) {
      console.error('Error fetching family tree:', error);
      return [];
    } finally {
      await session.close();
    }
  };

  const fetchLineageTree = async (rootID) => {
  const session = driver.session();

  try {
    const queryParamsObject = { rootID: Number(rootID) };
    const query = `
     MATCH (target:Person)
WHERE id(target) = $rootID

// Step 1: Find the full ancestry path from oldest to the person
OPTIONAL MATCH path = (ancestor:Person)-[:FATHER_OF*]->(target)
WITH (CASE WHEN path IS NULL THEN [target] ELSE nodes(path) END) AS lineageNodes, target

// Step 2: Get all descendants of the target person (D)
CALL {
  WITH target
  MATCH (target)-[:FATHER_OF*]->(descendant)
  RETURN collect(DISTINCT descendant) AS descendants
}

// Step 3: Merge lineage path and descendants
WITH lineageNodes + descendants AS allPeople
UNWIND allPeople AS person

// Get mother, spouse, and children of the person
OPTIONAL MATCH (mother:Person)-[:MOTHER_OF]->(person)
OPTIONAL MATCH (person)-[:MARRIED_TO]-(sp:Person)
WITH person, mother, collect(DISTINCT sp) AS allSpouses, count(DISTINCT sp) AS marriageCount

// Get direct children of person (both father and mother)
OPTIONAL MATCH (person)-[:FATHER_OF|MOTHER_OF]->(child:Person)
OPTIONAL MATCH (childMother:Person)-[:MOTHER_OF]->(child)

WITH person, mother, allSpouses, marriageCount,
  collect(DISTINCT {
    id: id(child),
    name: child.name,
    lastName: child.lastName,
    gender: child.gender,
    isAlive: child.isAlive,
    Nickname: child.Nickname,
    Notes: child.Notes,
    motherId: CASE WHEN childMother IS NULL THEN -1 ELSE id(childMother) END
  }) AS rawChildren

// Get spouses of each child
OPTIONAL MATCH (person)-[:FATHER_OF|MOTHER_OF]->(c:Person)
OPTIONAL MATCH (c)-[:MARRIED_TO]-(s:Person)
WITH person, mother, allSpouses, marriageCount, rawChildren,
  collect(DISTINCT {cid: id(c), sid: id(s)}) AS childSpousePairs

WITH person, mother, allSpouses, marriageCount,
  [rc IN rawChildren |
    {
      id: rc.id,
      name: rc.name,
      lastName: rc.lastName,
      gender: rc.gender,
      isAlive: rc.isAlive,
      Nickname: rc.Nickname,
      Notes: rc.Notes,
      motherId: rc.motherId,
      spouseId: [pair IN childSpousePairs WHERE pair.cid = rc.id | pair.sid]
    }
  ] AS childrenData

RETURN {
  id: id(person),
  name: person.name,
  lastName: person.lastName,
  gender: person.gender,
  isAlive: person.isAlive,
  Nickname: person.Nickname,
  Notes: person.Notes,
  motherId: CASE WHEN mother IS NULL THEN -1 ELSE id(mother) END,
  spouseId: [
    sp IN allSpouses |
      {
        id: id(sp),
        name: sp.name,
        nickname: sp.Nickname,
        lastName: sp.lastName,
        branch: sp.Branch,
        origin: CASE WHEN sp.Origin <> '' THEN sp.Origin ELSE 'Ksar Ouled Boubaker' END
      }
  ],
  marriageCount: marriageCount,
  children: childrenData
} AS treeNode
ORDER BY person.gender DESC


    `;

    const result = await session.run(query, queryParamsObject);

    const familyTree = result.records.map(record => {
  const node = record.get('treeNode');
  const validChildren = Array.isArray(node.children)
    ? node.children.filter(child => child && child.id !== null)
    : [];

  return {
    id: Number(node.id),
    name: node.name,
    gender: node.gender,
    lastName: node.lastName,
    isAlive: node.isAlive,
    Nickname: node.Nickname,
    Notes: node.Notes,
    motherId: node.motherId !== -1 ? Number(node.motherId) : null,
    spouseId: Array.isArray(node.spouseId)
      ? node.spouseId
          .filter(sp => sp && sp.id !== null)
          .map(sp => ({
            id: Number(sp.id),
            name: sp.name,
            nickname: sp.nickname,
            lastName: sp.lastName,
            branch: sp.branch,
            origin: sp.origin
          }))
      : [],
    children: validChildren.map(child => ({
      id: Number(child.id),
      name: child.name,
      gender: child.gender,
      isAlive: child.isAlive,
      lastName: child.lastName,
      Nickname: child.Nickname,
      Notes: child.Notes,
      motherId: child.motherId !== -1 ? Number(child.motherId) : null,
      spouseId: Array.isArray(child.spouseId)
        ? child.spouseId
            .filter(sp => sp && sp.id !== null)
            .map(sp => ({
              id: Number(sp.id),
              name: sp.name,
              nickname: sp.nickname,
              lastName: sp.lastName,
              branch: sp.branch,
              origin: sp.origin
            }))
        : []
    }))
  };
});
    console.log(familyTree);
    return familyTree;
  } catch (error) {
    console.error('Error fetching lineage tree:', error);
    return [];
  } finally {
    await session.close();
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

  function rebuildTreeForPerson(root, childrenMap, targetId) {
    let found = false;

    function containsTarget(person) {
      if (person.id === targetId) {
        found = true;
        return true;
      }
      const children = childrenMap[person.id] || [];
      return children.some(containsTarget);
    }

    function build(node) {

      const realChildren = childrenMap[node.id] || [];

      const shouldExpand = realChildren.some(child => containsTarget(child));

      const lazyNode = {
        ...node,
        name: utils.translateName(node.name),
        lastName: utils.translateFamilyName(node.lastName),
        _realChildren: realChildren.map(child => build(child)),
        _lazyLoaded: shouldExpand,
        children: shouldExpand ? realChildren.map(child => build(child)) : [],
      };

      return lazyNode;
    }
    const tree = build(root);
    setFamilyTree(tree);
    return { tree, found };
  };

  
  const goToPersonById = async (ID) => {
    const container = treeContainerRef.current;

    if (!container) {
      toast.warning("الرجاء إظهار الشجرة أولاً.");
      return;
    }

    const coords = nodePositions.current[ID];
    if (!coords) {
      const { tree: updatedTree, found } = rebuildTreeForPerson(familyTree, childrenMap, personID);
      if (!found) {
        toast.warning("الشخص غير موجود في هذه الشجرة.");
      } 
      else {
        setFamilyTree(updatedTree);
      }
      return;
    }

    const { width, height } = container.getBoundingClientRect();
    const zoom = 0.8;

    // ✅ Calculate the new translate to center the node after applying zoom
    const translateX = width / 2 - coords.x * zoom;
    const translateY = height / 2 - coords.y * zoom;

    // ✅ Apply zoom and translate
    setZoomLevel(zoom);
    setTranslate({
      x: translateX,
      y: translateY,
    });
  };

  const handleBranchSelect = async (personID) => {
    setFamilyTree(null);
    const id = parseInt(personID);
    setSelectedBranch(personID);
    setSelectedSubtree('');
    if (!isNaN(id)) {
      await loadFamilyTree(id, treeMode === 'lazy');
      setPersonID(personID);
    }
  };

  const toggleFullscreen = async () => {
    const el = treeRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      try {
        await el.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        console.error('Failed to enter fullscreen:', err);
      }
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };
  
  const handlePersonClickPopup = async (person) => {
    const session = driver.session();
    setWifeId(null);
    setHusbandId(null);
    setSpouseId(person.spouseId) 
    try {
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
  if (treeMode === "lazy") {
    if (!Array.isArray(nodeDatum._realChildren) || nodeDatum._realChildren.length === 0) {
      if (nodeDatum.gender === "Male") {
        toast.info(`${nodeDatum.name} ${nodeDatum.lastName} ليس لديه أطفال.`);
      }
      else{
        if (!Array.isArray(nodeDatum.spouseId) || nodeDatum.spouseId.length === 0){
          toast.warning(`${nodeDatum.name} ${nodeDatum.lastName} ليس لديها أطفال.`);
        }
        else{
          toast.warning(`الرجاء الذهاب الى زوج ${nodeDatum.name} ${nodeDatum.lastName} من أجل رؤية أطفالها.`);
        }
      }
    }

    // Recursive function to collapse all descendants
    const recursivelyCollapse = (node) => ({
      ...node,
      _lazyLoaded: false,
      children: [],
      _realChildren: (node._realChildren || []).map(recursivelyCollapse),
    });

    const updateLazyTree = (node) => {
      if (node.id === nodeDatum.id) {
        const expanded = !node._lazyLoaded;
        console.log(`Toggle node ${node.id} to ${expanded ? 'expanded' : 'collapsed'}`);
        if (expanded) {
          setTreeCount(treeCount + node._realChildren.length);
          return {
            ...node,
            children: node._realChildren,
            _lazyLoaded: true,
          };
        } else {
          // Collapse the node and all its descendants
          return recursivelyCollapse(node);
        }
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
    setFamilyTree(null);
    console.log("Displaying tree mode for :", personID);
    await loadFamilyTree(personID, treeMode === "lazy");
    setTimeout(() => {
      goToPersonById();
    }, 1000);
  };

  const loadFamilyTree = async (rootID, isLazy) => {
    try {
      setLoading(true);
      console.log(rootID, isLazy);
      let people = [];

      people = await fetchFamilyTree(rootID);
      console.log(nodePositions);
      if (!Array.isArray(people) || people.length === 0) {
        console.warn("Empty or invalid people data");
        return;
      }

      const childrenMap = buildChildrenMap(people);
      setChildrenMap(childrenMap);
      if (isLazy) {
        const rootPerson = people.find(p => p.id === rootID);
        const rootLazyNode = buildLazyNode(rootPerson, childrenMap);
        setFamilyTree(rootLazyNode);
        setShowTree(true);
        return;
      }
      const rootPersonFlat = people.find(p => p.id === rootID);
      if (!rootPersonFlat) {
        console.warn(`Root ID ${rootID} not found in fetched people.`);
        return;
      }

      const rootWrapped = {
        ...rootPersonFlat,
      };
      
      const fullTree = buildTreeSafe(rootWrapped, childrenMap, new Set());
      setFamilyTree(fullTree);
      const treeCount = countTreeNodes(fullTree);
      const maxDepth = getTreeDepth(fullTree);
      setTreeCount(treeCount);
      setTreeDepth(maxDepth);
      setShowTree(true);

    } catch (error) {
      console.error("Error loading family tree:", error);
    } finally {
      setLoading(false);
    }
  };

  const startHoldTimer = (person) => {
    holdTimer = setTimeout(() => {
      handlePersonClickPopup(person); // your popup info function
    }, 500); // 500ms hold = long press
  };

  const cancelHoldTimer = () => {
    clearTimeout(holdTimer);
  };

  const scrollToTree = () => {
    const el = treeRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const scrollTop = window.pageYOffset + rect.top;
    window.scrollTo({
      top: scrollTop / 2,
      behavior: 'smooth'
    });
  };

  return (
    <div className="treePage">
      <header>
          <h1 id="title">شجرة عرش قصر أولاد بوبكر</h1>
          <div className="d">
            <p id="paragraph">
              يمكنك من خلال هذه الصفحة، تصفح شجرة عرش قصر أولاد بوبكر كاملة، من الجد الأول بوبكر، حتى الأجيال الحالية.
              حيث تسطيع تصفح هذه الشجرة عبر الفروع الأساسية (فرحات ، امحمد، عمر، سالم)، أو حتى عبر العائلات.
              يمكنك اختيار مشاهدة الشجرة كاملة  أو بالجيل عبر النقر على الشخص لمعرفة أبناءه.
            </p>
          </div>
      </header>
      <div className="screen">
          
    <aside className="panel panel--controls">
      
      <div className="filterChoice">
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
                      case "203": setTitle("شجرة عرش أولاد بوبكر"); break
                      case "202": setTitle("شجرة فرع فرحات"); break
                      case "176": setTitle("شجرة فرع إمحمّد"); break
                      case "224": setTitle("شجرة فرع عمر"); break
                      case "223": setTitle("شجرة فرع سالم"); break
                    }
                  }}
                > 
                  <option value="">-- اختر فرعًا --</option>
                  <option value="203">الجد الأول بوبكر</option>
                  <option value="202">فرع فرحات</option>
                  <option value="176">فرع إمحمّد</option>
                  <option value="224">فرع عمر</option>
                  <optgroup label='فرع سالم بن بوبكر'>
                    <option value="223">فرع سالم الأول</option>
                    <option value="390">فرع علي بن سالم</option>
                    <option value="391">فرع احمد بن سالم</option>
                  </optgroup>
                  
                </select>

                {selectedBranch === '223' && (
                  <div className="subtreeSelect">
                    <p className="branch-selector-description">اختر فرعًا ثانويًا من فرع سالم:</p>
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
                      <option value="">-- اختر فرعًا ثانويًا --</option>
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
                    <p className="branch-selector-description">اختر فرعًا ثانويًا من فرع إمحمّد:</p>
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
                      <option value="">-- اختر فرعًا ثانويًا --</option>
                      <option value="175">فرع أولاد بوبكر بن إمحِمّدْ</option>
                      <option value="353">فرع أولاد حسن بن إمحِمّدْ</option>
                      <option value="174">فرع أولاد ابراهيم بن إمحِمّدْ</option>
                    </select>
                  </div>
                )}

                {selectedBranch === '202' && (
                  <div className="subtreeSelect">
                    <p className="branch-selector-description">اختر فرعًا ثانويًا من فرع فرحات:</p>
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
                      <option value="">-- اختر فرعًا ثانويًا --</option>
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
                      case "137": setTitle("شجرة عائلة التائب "); break;
                      case "443": setTitle("شجرة عائلة اللقماني"); break;
                      case "303": setTitle("شجرة عائلة مصدق"); break;
                      case "395": setTitle("شجرة عائلة الرحموني"); break;
                      case "444": setTitle("شجرة عائلة السقراطي"); break;
                      case "204": setTitle("شجرة عائلة الفرجاني"); break;
                      case "469": setTitle("شجرة عائلة المحسني"); break;
                      case "491": setTitle("شجرة عائلة السالمي"); break;
                      case "860": setTitle("شجرة عائلة الفرابي"); break;
                      case "397": setTitle("شجرة عائلة الأمجد"); break;
                      case "384": setTitle("شجرة عائلة الشاكري"); break;
                      case "821": setTitle("شجرة عائلة الشامخي"); break;
                      case "521": setTitle("شجرة عائلة الجامعي"); break;
                      case "847": setTitle("شجرة عائلة العزابي"); break;

                    }
                  
                  }}
                >
                  <option value="">-- اختر عائلة --</option>
                  <option value="137">فرع التائب</option>
                  <option value="443">فرع اللقماني</option>
                  <option value="303">فرع مصدق</option>
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
          <select
            id="mode"
            value={treeMode}
            onChange={(e) => {
              setTreeMode(e.target.value);
            }}
          >
            <option value="lazy">تحميل الشجرة عند النقر على الشخص</option>
            <option value="full">تحميل الشجرة كاملة</option>
          </select> <br/>
          <button className='searchButton' onClick={() => {
            setTreeFetchMode("Lineage");
            if (!selectedBranch && !selectedSubtree){
              toast.warning("الرجاء إختيار فرع");
            }
            else{
              handleBranchSelect(selectedSubtree || selectedBranch);
              setSelectedBranch('');
              scrollToTree();
              toggleFullscreen();
            }
            
          }}
          >عرض الشجرة
          </button>
        </div>

        <div className="card">
          <h3>عرض شجرة انطلاقًا من شخص معين</h3>

          <p className="info-text">
            اكتب اسم الشخص كاملاً أو جزئياً، أو أدخل الرقم التسلسلي (ID)، لعرض شجرته مع أجداده وذريته.
          </p>
          
          <input className="SearchInput" id="TreeRoot" type="text" placeholder="أَدخِل الرقم التسلسلي أو اسم الشخص"/>
          <button
            className='searchButton'
            onClick={async () => {
              scrollToTree();
              setFamilyTree(null);
              setLookoutMode("Tree");
              setTreeFetchMode("Lineage");
              toggleFullscreen();
              await handleSearch();
            }}
          >
            عرض الشجرة
          </button>
        </div>
      </div>
    </aside>
         
    <main className="panel panel--tree" ref={treeRef}>
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
      {personDetails && (
        personDetails.multipleMatches && personDetails.multipleMatches.length > 1 ? (
          <div className="modal-overlay">
            <div className="modal-content multiple-matches">
              {lookoutMode === "Node" && (
                <button className="closeButton" onClick={() => setPersonDetails(null)}>
                  <FiX />
                </button>
              )}
              <h2>
                   تم العثور على {personDetails.multipleMatches.length} شخصًا يحملون إسم {treeSearchQuery}
              </h2>
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
                            if (lookoutMode === "Tree") {
                              handlePersonTreeDisplay(person.personID);
                            } else {
                              setPersonID(person.personID);
                              await goToPersonById();
                            }
                          }}
                        >
                          اختيار
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="returnButton" onClick={() => setPersonDetails(null)}>إغلاق</button>
            </div>
          </div>
        ) : (
          lookoutMode === "Tree" && personDetails.personID && (
            <>
              {handlePersonTreeDisplay(personDetails.personID)}
              {setPersonDetails(null)}
            </>
          )
        )
      )}
 
      {showTree && familyTree && !loading ? (
      
          <FamilyTreeComponent
          familyTree={familyTree}
          setFamilyTree={setFamilyTree}
          translate={translate}
          setTranslate={setTranslate}
          setFocusTrigger={setFocusTrigger}
          focusTrigger={focusTrigger}
          zoomLevel={zoomLevel}
          selectedGeneration={selectedGeneration}
          treeCount={treeCount}
          treeDepth={treeDepth}
          title={title}
          showPopup={showPopup}
          selectedPerson={selectedPerson}
          showSpouse={showSpouse}
          spouseId={spouseId}
          personID={personID}
          goToPersonById={goToPersonById}
          setPersonID={setPersonID}
          setZoomLevel={setZoomLevel}
          setShowPopup={setShowPopup}
          setTitle={setTitle}
          setShowSpouse={setShowSpouse}
          setSpouseId={setSpouseId}
          handlePersonClick={handlePersonClick}
          handlePersonClickPopup={handlePersonClickPopup}
          startHoldTimer={startHoldTimer}
          cancelHoldTimer={cancelHoldTimer}
          nodePositions={nodePositions}
          spouseNodePositions={spouseNodePositions}
          treeContainerRef={treeContainerRef}
          smalltreeContainerRef={smalltreeContainerRef}
          isFullscreen={isFullscreen}
          husbandId={husbandId}
          wifeId={wifeId}
          peopleWithNoChildren={[]}
          setSelectedGeneration={setSelectedGeneration}
          setLookoutMode={setLookoutMode}
          handleSearch={handleSearch}
          treeSearchQuery={treeSearchQuery}
          setTreeSearchQuery={setTreeSearchQuery}
          setLoading={setLoading}
          loading={loading}
          setPersonDetails={setPersonDetails}
          personDetails={personDetails}
          handlePersonTreeDisplay={handlePersonClick}
        />
      ) : 
      <p id="noTreeText">
        لا توجد شجرة لعرضها حالياً
      </p>
      }

      {showTree && familyTree && !loading && 
        <div id="keys">
          <div class="key-box">
            <span class="key-color special-border male" id="k1"></span>
            <span class="key-label">ذكر</span>
          </div>
          <div class="key-box">
            <span class="key-color special-border female" id="k2"></span>
            <span class="key-label">أنثى</span>
          </div>
          <div class="key-box">∅
            <span class="key-label">ليس لديه عقب</span>
          </div>
          <div class="key-box">
            <span class="key-color" id="k4"></span>
            <span class="key-label">الشخص المبحوث عليه</span>
          </div>
          <div class="key-box">
            <span class="key-color" id="k5"></span>
            <span class="key-label">شخص متوفى</span>
          </div>
        </div>
      }
    </main>
    
    </div>
    
    {loading && !showTree && !familyTree && (
      <div className="loading-indicator">
        <p>جاري تحميل الشجرة...</p>
        <div className="spinner"></div>
      </div>
    )}

  </div>  
  );
};

export default FamilyTree;