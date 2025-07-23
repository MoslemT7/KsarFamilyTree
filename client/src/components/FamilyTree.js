import { useEffect, useState , useRef, use, lazy } from 'react';
import FamilyTreeComponent from './FamilyTreeComponent';
import usePageTracking from '../utils/trackers';
import neo4j from 'neo4j-driver';
import * as utils from '../utils/utils';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/familyTreeStyles/FamilyTree.css';

import { FiX } from 'react-icons/fi';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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
        Branch: person.Branch,
        mother: child.mother,
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
    Branch: person.Branch,
    mother: person.mother,
    spouseId: person.spouseId,
    generation,
    ...(childrenNodes.length > 0 ? { children: childrenNodes } : {})
  };
};

const buildChildrenMap = (allPeople) => {
  const peopleById = new Map(allPeople.map(p => [p.id, p]));
  const childMap = Object.create(null);

  allPeople.forEach(person => {
    if (person.gender === 'Male' && Array.isArray(person.children)) {
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
          Branch: orig.Branch,
          mother: orig.mother && typeof orig.mother.id === 'number'
            ? {
                id: orig.mother.id,
                name: orig.mother.name,
                lastName: orig.mother.lastName
              }
            : null,
          spouseId: Array.isArray(orig.spouseId)
            ? orig.spouseId.map(sp => ({
                id: sp.id,
                name: sp.name,
                lastName: sp.lastName,
                nickname: sp.nickname,
                branch: sp.branch,
                origin: sp.origin,
                father: typeof sp.father === 'string' ? sp.father : "",
                grandfather: typeof sp.grandfather === 'string' ? sp.grandfather : ""
              }))
            : []
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

const DATA_VERSION = "2025-07-23-v1";
const CACHE_PREFIX = "familyTree_";
const VERSION_KEY = "familyTree_version";

const clearFamilyTreeCache = () => {
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith(CACHE_PREFIX) || key === VERSION_KEY) {
      localStorage.removeItem(key);
      console.log(`[Cache] Removed key: ${key}`);
    }
  });
};

const setCachedFamilyTree = (rootID, data, isLazy) => {
  const key = `${CACHE_PREFIX}${rootID}_${isLazy ? "lazy" : "full"}`;
  try {
    localStorage.setItem(key, JSON.stringify(data));
    localStorage.setItem(VERSION_KEY, DATA_VERSION);
    console.log(`[Cache] Cached family tree data for key: ${key}`);
  } catch (e) {
    console.warn(`[Cache] Failed to cache family tree for key: ${key}`, e);
  }
};

const getCachedFamilyTree = (rootID, isLazy) => {
  const cachedVersion = localStorage.getItem(VERSION_KEY);

  if (cachedVersion !== DATA_VERSION) {
    console.log(`[Cache] Data version mismatch (was: ${cachedVersion}, now: ${DATA_VERSION}). Clearing cache.`);
    clearFamilyTreeCache();
    return null;
  }

  const key = `${CACHE_PREFIX}${rootID}_${isLazy ? "lazy" : "full"}`;
  const cached = localStorage.getItem(key);

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      localStorage.removeItem(key);
      console.warn(`[Cache] Corrupted cache removed for key: ${key}`);
    }
  }

  return null;
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
  const [showTree, setShowTree] = useState(false);
  const [loading, setLoading] = useState(false);  
  const [translate, setTranslate] = useState({x : 0, y : 0});
  const [personID, setPersonID] = useState(null);
  const [treeCount, setTreeCount] = useState(0);
  const [treeDepth, setTreeDepth] = useState(0);
  const [spouseId, setSpouseId] = useState(null);
  const [popupMode, setPopupMode] = useState("details");
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
  const [treeSearchQuery, setTreeSearchQuery] = useState("");
  const [focusTrigger, setFocusTrigger] = useState(0);
  const [childrenMap, setChildrenMap] = useState(null);

  let holdTimer = null;
  usePageTracking();

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
  if (showTree && familyTree && personID && !showPopup) {
      const timer = setTimeout(() => {
        goToPersonById(personID);
      }, 50);
      return () => clearTimeout(timer);
    }
    console.log(familyTree);
  }, [showTree, familyTree, personID, focusTrigger]);

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
      lookoutMode === 'Node' ? await goToPersonById(id) : await handlePersonTreeDisplay(id);
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
        MATCH (target:Person) WHERE id(target) = $rootID

        OPTIONAL MATCH path = (ancestor:Person)-[:FATHER_OF*]->(target)
        WITH CASE WHEN path IS NULL THEN [target] ELSE nodes(path) END AS lineageNodes, target

        CALL {
          WITH target
          MATCH (target)-[:FATHER_OF*]->(descendant)
          RETURN collect(DISTINCT descendant) AS descendants
        }

        WITH lineageNodes + descendants AS allPeople
        UNWIND allPeople AS person

        OPTIONAL MATCH (mother:Person)-[:MOTHER_OF]->(person)
        OPTIONAL MATCH (person)-[:MARRIED_TO]-(sp:Person)
        OPTIONAL MATCH (fatherSp:Person)-[:FATHER_OF]->(sp)
        OPTIONAL MATCH (grandfatherSp:Person)-[:FATHER_OF]->(fatherSp)

        WITH person, mother, collect(DISTINCT {
          id: id(sp),
          name: sp.name,
          nickname: sp.Nickname,
          lastName: sp.lastName,
          branch: sp.Branch,
          origin: CASE WHEN sp.Origin <> '' THEN sp.Origin ELSE 'Ksar Ouled Boubaker' END,
          father: CASE WHEN fatherSp IS NULL THEN null ELSE fatherSp.name END,
          grandfather: CASE WHEN grandfatherSp IS NULL THEN null ELSE grandfatherSp.name END
        }) AS enrichedSpouses, count(DISTINCT sp) AS marriageCount

        OPTIONAL MATCH (person)-[:FATHER_OF|MOTHER_OF]->(child:Person)
        OPTIONAL MATCH (childMother:Person)-[:MOTHER_OF]->(child)

        WITH person, mother, enrichedSpouses, marriageCount, child, childMother

        WITH person, mother, enrichedSpouses, marriageCount,
          collect(DISTINCT {
            id: id(child),
            name: child.name,
            lastName: child.lastName,
            gender: child.gender,
            isAlive: child.isAlive,
            Nickname: child.Nickname,
            Notes: child.Notes,
            Branch: child.Branch,
            mother: CASE 
              WHEN childMother IS NULL THEN null 
              ELSE {
                id: id(childMother),
                name: childMother.name,
                lastName: childMother.lastName
              }
            END
          }) AS rawChildren

        OPTIONAL MATCH (person)-[:FATHER_OF|MOTHER_OF]->(c:Person)
        OPTIONAL MATCH (c)-[:MARRIED_TO]-(s:Person)
        WITH person, mother, enrichedSpouses, marriageCount, rawChildren,
          collect(DISTINCT { cid: id(c), sid: id(s) }) AS childSpousePairs

        WITH person, mother, enrichedSpouses, marriageCount,
          [rc IN rawChildren |
            {
              id: rc.id,
              name: rc.name,
              lastName: rc.lastName,
              gender: rc.gender,
              isAlive: rc.isAlive,
              Nickname: rc.Nickname,
              Notes: rc.Notes,
              Branch: rc.Branch,
              mother: rc.mother,
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
          Branch: person.Branch,
          mother: CASE 
            WHEN mother IS NULL THEN null 
            ELSE {
              id: id(mother),
              name: mother.name,
              lastName: mother.lastName
            }
          END,
          spouseId: enrichedSpouses,
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
    Branch: node.Branch,
    mother: node.mother
      ? {
          id: Number(node.mother.id),
          name: node.mother.name,
          lastName: node.mother.lastName
        }
      : null,

    spouseId: Array.isArray(node.spouseId)
      ? node.spouseId
          .filter(sp => sp && sp.id !== null)
          .map(sp => ({
            id: Number(sp.id),
            name: sp.name,
            nickname: sp.nickname,
            lastName: sp.lastName,
            branch: sp.branch,
            origin: sp.origin,
            father: sp.father || "",
            grandfather: sp.grandfather || ""
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
      Branch: child.Branch,
      mother: child.mother
        ? {
            id: Number(child.mother.id),
            name: child.mother.name,
            lastName: child.mother.lastName
          }
        : null,
      spouseId: Array.isArray(child.spouseId)
        ? child.spouseId
            .filter(sp => sp && sp !== null)
            .map(sid => ({ id: Number(sid) }))
        : []
    }))
  };

      });

      console.log(familyTree);
      return familyTree;
    } catch (error) {
      console.error('Error fetching family tree:', error);
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
    };

    function build(node) {
      if (!node || typeof node !== 'object') {
        console.warn("Invalid node passed to build():", node);
        return null;
      }

      const realChildren = childrenMap?.[node.id] || [];

      const shouldExpand = realChildren?.some?.(child => containsTarget(child)) || false;

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
    console.log(ID);
    const container = treeContainerRef.current;
    if (!container || !nodePositions.current) {
      toast.warning("الرجاء إظهار الشجرة أولاً.");
      return;
    }
    console.log("nodePositions:", nodePositions.current);
    console.log("Trying to access ID:", ID);
    const coords = nodePositions.current[ID];
    if (!coords) {
      if (treeMode === "lazy") {
        const { tree: updatedTree, found } = rebuildTreeForPerson(familyTree, childrenMap, ID);
        if (!found) {
          toast.warning("الشخص غير موجود في هذه الشجرة.");
        } else {
          setFamilyTree(updatedTree);
        }
        return;
      } else {
        toast.warning("الشخص غير موجود في هذه الشجرة.");
        return;
      }
    }



    const { width, height } = container.getBoundingClientRect();
    const zoom = 0.8;

    const translateX = width / 2 - coords.x * zoom;
    const translateY = height / 2 - coords.y * zoom;

    setZoomLevel(zoom);
    setTranslate({ x: translateX, y: translateY });
  };

  const handleBranchSelect = async (personID) => {
    setShowTree(false);
    setFamilyTree(null);
    const id = parseInt(personID);
    setSelectedBranch(personID);
    setSelectedSubtree('');
    if (!isNaN(id)) {
      const treeData = await fetchFamilyTreeWithCache(id, treeMode === "lazy");
      console.log(treeData);
      setFamilyTree(treeData);
      setPersonID(personID);
      setShowTree(true);
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
    if (showPopup) return;
    const session = driver.session();
    setWifeId(null);
    setHusbandId(null);
    setSpouseId(person.spouseId) 
    try {
      setSelectedPerson(person);
      setPopupMode('info');
      setShowPopup(true);
      setPopupMode("details");

    } catch (error) {
      console.error("Error fetching spouse:", error);
    } finally {
      await session.close();
    }
  };

  const handlePersonClick = (nodeDatum) => {
    setPersonID(null);
    console.log(nodeDatum);
    if (popupMode === "tree"){
      toast.info("الرجاء الذهاب الى شجرة هذا الشخص لرؤية تفاصيله.");
      return;
    }
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

  const handlePersonTreeDisplay = async (rootID) => {
    const personID = rootID;
    setFamilyTree(null);
    const cached = getCachedFamilyTree(personID);

    if (cached) {
      setFamilyTree(cached);
      setTimeout(() => {
        goToPersonById(personID);
      }, 100);
    } else {
      const treeData = await loadFamilyTree(personID, treeMode === "lazy");

      if (treeData) {
        setCachedFamilyTree(personID, treeData);
        setFamilyTree(treeData);
        setTimeout(() => {
          goToPersonById(personID);
        }, 100);
      } else {
        console.warn("Failed to load tree data");
      }
    }
  };

  const loadFamilyTree = async (rootID, isLazy) => {
    try {
      setLoading(true);
      console.log(rootID, isLazy);
      let people = [];

      people = await fetchFamilyTree(rootID);
      if (!Array.isArray(people) || people.length === 0) {
        console.warn("Empty or invalid people data");
        return;
      }

      const childrenMap = buildChildrenMap(people);
      console.log(childrenMap);
      setChildrenMap(childrenMap);
      if (isLazy) {
        const rootPerson = people.find(p => p.id === rootID);
        const rootLazyNode = buildLazyNode(rootPerson, childrenMap);
        setFamilyTree(rootLazyNode);
        setShowTree(true);
        return rootLazyNode;
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
      console.log(fullTree);
      const treeCount = countTreeNodes(fullTree);
      const maxDepth = getTreeDepth(fullTree);
      setTreeCount(treeCount);
      setTreeDepth(maxDepth);
      setShowTree(true);

      return fullTree;
    } catch (error) {
      console.error("Error loading family tree:", error);
    } finally {
      setLoading(false);
      
    }

    
  };

  const startHoldTimer = (person) => {
    holdTimer = setTimeout(() => {
      handlePersonClickPopup(person);
    }, 500);
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

  const clearFamilyTreeCache = () => {
    const confirmed = window.confirm(
      "⚠️ هل أنت متأكد أنك تريد إعادة تعيين كاش شجرة العائلة؟\n\n" +
      "هذا الإجراء سيحذف البيانات المخزنة مؤقتاً وسيتم تحميل الشجرة من جديد عند عرضها.\n" +
      "قد يستغرق ذلك وقتًا أطول حسب سرعة الإنترنت."
    );

    if (!confirmed) return;

    alert("✅ تم مسح الكاش بنجاح. سيتم تحميل الشجرة من جديد عند الطلب.");
  };

  const fetchFamilyTreeWithCache = async (rootID, isLazy) => {
    console.log(`fetchFamilyTreeWithCache called with rootID: ${rootID}, isLazy: ${isLazy}`);

    const cachedTree = getCachedFamilyTree(rootID, isLazy);
    if (cachedTree) {
      console.log("Using cached family tree for ID:", rootID, "Lazy mode:", isLazy);
      return cachedTree;
    }

    console.log("No cached data found or cache invalidated, calling loadFamilyTree...");
    const tree = await loadFamilyTree(rootID, isLazy);

    console.log("Loaded tree:", tree);

    if (!tree) {
      console.warn("loadFamilyTree returned null or undefined tree.");
      return null;
    }

    if (Array.isArray(tree) && tree.length === 0) {
      console.warn("Loaded tree is an empty array.");
      return tree;
    }

    setCachedFamilyTree(rootID, tree, isLazy);
    console.log("Cached the loaded tree.");

    return tree;
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
                    <p className="branch-selector-description">اختر فرعًا ثانويًا من فرع سالم:</p>
                    <select
                      className="branch-selector"
                      onChange={(e) =>{ 
                        setSelectedSubtree(e.target.value);
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
                  }}
                >
                  <option value="">-- اختر من بين 19 عائلة --</option>
                  <option value="137">فرع التائب</option>
                  <option value="443">فرع اللقماني</option>
                  <option value="303">فرع مصدق</option>
                  <option value="395">فرع الرحموني</option>
                  <option value="444">فرع السقراطي</option>
                  <option value="204">فرع الفرجاني</option>
                  <option value="469">فرع المحسني</option>
                  <option value="398">فرع المنذري</option>
                  <option value="491">فرع السالمي</option>
                  <option value="860">فرع الفرابي</option>
                  <option value="397">فرع الأمجد</option>
                  <option value="384">فرع الشاكري</option>
                  <option value="821">فرع الشامخي</option>
                  <option value="521">فرع الجامعي</option>
                  <option value="847">فرع العزابي</option>
                  <option value="200">فرع الفرجاني + الغمراسني</option>
                  <option value="719">فرع الغمراسني / الرحموني</option>
                  <option value="374">فرع المطيع</option>
                  <option value="375">قرع الشطي</option>
                  <option value="702">فرع الماجدي</option>
                  <option value="332">فرع العازم</option>
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
          
          <button className='searchButton' onClick={async () => {
            if (!selectedBranch && !selectedSubtree){
              alert("الرجاء إختيار فرع");
            }
            else{
              handleBranchSelect(selectedSubtree || selectedBranch);
              setSelectedBranch('');
              scrollToTree();
              toggleFullscreen();
              setPersonID(selectedSubtree || selectedBranch);
            }
            setFocusTrigger(prev => prev + 1);
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
              toggleFullscreen();
              await handleSearch();
            }}
          >
            عرض الشجرة
          </button>
        </div>
      </div>
      <button id="resetCache" onClick={clearFamilyTreeCache}>
        إعادة تعيين ذاكرة التخزين المؤقت لشجرة العائلة
      </button>
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
                    <tr key={person.personID}>
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
                            console.log(personID);

                            if (lookoutMode === "Tree") {
                              handlePersonTreeDisplay(person.personID);
                            } else {
                              await goToPersonById(person.personID);
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
          popupMode={popupMode}
          setPopupMode={setPopupMode}
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
          treeMode={treeMode}
        />
      ) : 
      <p id="noTreeText">
        لا توجد شجرة لعرضها حالياً
      </p>
      }

      {showTree && familyTree && !loading && 
        <div id="keys">
          <div className="key-box">
            <span className="key-color special-border male" id="k1"></span>
            <span className="key-label">ذكر</span>
          </div>
          <div className="key-box">
            <span className="key-color special-border female" id="k2"></span>
            <span className="key-label">أنثى</span>
          </div>
          <div className="key-box">∅
            <span className="key-label">ليس لديه عقب</span>
          </div>
          <div className="key-box">
            <span className="key-color" id="k4"></span>
            <span className="key-label">الشخص المبحوث عليه</span>
          </div>
          <div className="key-box">
            <span className="key-color" id="k5"></span>
            <span className="key-label">شخص متوفى</span>
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