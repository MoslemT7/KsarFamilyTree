import { useEffect, useRef, useState , forwardRef, useImperativeHandle, use  } from 'react';
import TreeView from './TreeView';
import { FiMaximize, FiMinimize, FiRotateCcw, FiSearch, FiArrowLeft, FiX, FiMenu, FiInfo, FiTarget, FiRefreshCw, FiDownload, FiMoon, FiSun,
  FiBarChart, FiSettings } from 'react-icons/fi';
import { FaCog } from "react-icons/fa"; // Font Awesome gear icon
import '../styles/familyTreeStyles/FamilyTree.css';
import '../styles/familyTreeStyles/popup.css';
import '../styles/familyTreeStyles/TreeStats.css';
import '../styles/familyTreeStyles/TreeSettings.css';
import '../styles/familyTreeStyles/TreeSearch.css';
import '../styles/familyTreeStyles/ToolTip.css';

import * as utils from '../utils/utils';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import neo4j from 'neo4j-driver';

import bgDay from '../media/bg2-low.jpg';
import bgNight from '../media/bg2-low-night.png';

const neo4jURI = process.env.REACT_APP_NEO4J_URI;
const neo4jUser = process.env.REACT_APP_NEO4J_USER; 
const neo4jPassword = process.env.REACT_APP_NEO4J_PASSWORD;
const driver = neo4j.driver(
  neo4jURI, 
  neo4j.auth.basic(neo4jUser, neo4jPassword)
);

function countChildrenGender(ChildrenArray){
  let female = 0, male = 0;
  for (let i = 0; i < ChildrenArray.length; i++){
    if (ChildrenArray[i].gender === 'Male'){
      male++;
    }
    else{
      female++;
    }
  }
  return {male, female}
};

function formatArabicCount(count, singular, dual, plural) {
  if (count === 0) return `0 ${plural}`;
  if (count === 1) return `1 ${singular}`;
  if (count === 2) return `2 ${dual}`;
  if (count >= 3 && count <= 10) return `${count} ${plural}`;
  return `${count} ${plural}`; // for >10, often plural is used in Arabic
};

function isInTree(treeRoot, targetId, lazyMode = false) {
  if (!treeRoot) {
    console.warn("[isInTree] treeRoot is null or undefined");
    return false;
  }

  const children = lazyMode ? treeRoot._realChildren : treeRoot.children;

  if (!Array.isArray(children)) {
    console.warn(`[isInTree] children is not an array. lazyMode=${lazyMode}`, children);
    return false;
  }

  for (const child of children) {
    console.log(`[isInTree] Checking child ID=${child.id} against targetId=${targetId}`);

    if (child.id === targetId) {
      console.log(`[isInTree] Found targetId=${targetId} ✅`);
      return true;
    }

    const foundInSubtree = isInTree(child, targetId, lazyMode);
    if (foundInSubtree) return true;
  }

  return false;
}

const FamilyTreeComponent = forwardRef((props, ref) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSpouseDetails, setShowSpouseDetails] = useState(false)
  const [smallFamilyTree, setSmallFamilyTree] = useState(null);
  const [activeSpouseIndex, setActiveSpouseIndex] = useState(0);
  const [translate2, setTranslate2] = useState({x: 0, y: 0});
  const [zoomLevel2, setZoomLevel2] = useState(1);
  const [focusTrigger, setFocusTrigger] = useState(0);
  const [smallTreeLoading, setSmallTreeLoading] = useState(false); 
  const [showStats, setShowStats] = useState(false);
  const [showSearchPopup, setShowSearchPopup] = useState(false);
  const [showSettingsPopup, setShowSettingsPopup]= useState(false);
  const [showNickname, setShowNickname] = useState(false);
  const [showID, setShowID] = useState(false);
  const [treeNightMode, setTreeNightMode] = useState(false);
  const [rectWidth, setRectWidth] = useState(120);
  const [rectHeight, setRectHeight] = useState(60);
  const [nodeSize, setNodeSize] = useState({ x: 140, y: 100 });
  const [separation, setSeparation] = useState({ siblings: 1.25, nonSiblings: 1.75 });
  const [orientation, setOrientation] = useState("vertical");
  const [pathFunc, setPathFunc] = useState("step"); 
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showNoChildren, setShowNoChildren] = useState(true);
  const [showToolTip, setShowTooltip] = useState(false);

  let {
    familyTree,
    setFamilyTree,
    translate,
    zoomLevel,
    setPopupMode,
    popupMode,
    selectedGeneration,
    treeCount,
    treeDepth,
    title,
    setTitle,
    showPopup,
    selectedPerson,
    spouseId,
    personID,
    setPersonID,
    setShowPopup,
    setShowSpouse,
    setSpouseId,
    goToPersonById,
    handlePersonClick,
    handlePersonClickPopup,
    startHoldTimer,
    cancelHoldTimer,
    spouseNodePositions,
    nodePositions,
    treeContainerRef,
    smalltreeContainerRef,
    peopleWithNoChildren,
    setLookoutMode,
    handleSearch,
    setTreeSearchQuery,
    treeSearchQuery,
    treeMode
  } = props;

  useImperativeHandle(ref, () => ({
    enterFullscreen: async () => {
      if (treeContainerRef.current && !document.fullscreenElement) {
        await treeContainerRef.current.requestFullscreen();
        setIsFullscreen(true);
      }
    },
    exitFullscreen: async () => {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  }));

  function resetSettings(){
    setTitle("");
    setPersonID(null);
    setFamilyTree(null);
  };

  useEffect(() => {
    if (!personID) return;

    const coords = nodePositions.current[personID];
    if (!coords) return;

    const timeout = setTimeout(() => {
      goToPersonById(personID);
    }, 100);

    return () => clearTimeout(timeout);
  }, [personID, familyTree]);

  useEffect(() => {
    if (!isFullscreen){
      setShowSettingsPopup(false);
      setShowSearchPopup(false);
      setShowStats(false);
    }
    goToPersonById(personID);
  }, [isFullscreen]);

  const toggleFullscreen = async () => {
    if (!treeContainerRef.current) return;

    if (!document.fullscreenElement) {
      try {
        await treeContainerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        console.error('Failed to enter fullscreen:', err);
      }
    } else {
      try {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } catch (err) {
        console.error('Failed to exit fullscreen:', err);
      }
    }
  };

  const buildSmallFamilyTree = (record) => {
    const personId = record.get("personId")?.toNumber();

    const grandfatherNode = record.get("grandfather");
    const fatherNode = record.get("father");
    const fatherChildrenRaw = record.get("fatherChildren") || [];
    const personChildrenRaw = record.get("personChildren") || [];

    if (!fatherNode || !fatherNode.properties) {
      console.warn("No father found in the record.");
      return null;
    }

    // 🧓 Build father node
    const father = {
      ...fatherNode.properties,
      id: fatherNode.identity?.toNumber?.() ?? fatherNode.properties.id,
    };

    // 👶 Person's children
    const formattedPersonChildren = personChildrenRaw.map((child) => ({
      ...child.properties,
      id: child.identity?.toNumber?.() ?? child.properties.id,
      children: [],
    }));

    // 🧒 Father's children (siblings), attach children if it's the person
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

    const fatherWithChildren = {
      ...father,
      children: formattedFatherChildren,
    };

    // 🧓 If grandfather exists, attach the father under him
    if (grandfatherNode && grandfatherNode.properties) {
      const grandfather = {
        ...grandfatherNode.properties,
        id: grandfatherNode.identity?.toNumber?.() ?? grandfatherNode.properties.id,
        children: [fatherWithChildren],
      };
      return translateNodeRecursive(grandfather);
    }

    // 👤 If no grandfather, just return from father level
    return translateNodeRecursive(fatherWithChildren);
  };

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

  const spouseFamilyTree = async (rootID) => {
      const session = driver.session();
      try {
        const query = `
         MATCH (p:Person)
          WHERE id(p) = $rootID

          // Get father and grandfather
          OPTIONAL MATCH (grandfather:Person)-[:FATHER_OF]->(father:Person)-[:FATHER_OF]->(p)

          // Get siblings of p (father's children)
          OPTIONAL MATCH (father)-[:FATHER_OF]->(sibling:Person)

          // Get all children of grandfather (uncle/aunts)
          OPTIONAL MATCH (grandfather)-[:FATHER_OF]->(uncleOrAunt:Person)

          // Get p's children
          OPTIONAL MATCH (p)-[:FATHER_OF|MOTHER_OF]->(child:Person)

          RETURN 
            grandfather, 
            father, 
            collect(DISTINCT uncleOrAunt) AS grandfatherChildren, 
            collect(DISTINCT sibling) AS fatherChildren, 
            collect(DISTINCT child) AS personChildren, 
            id(p) AS personId

        `;

        const result = await session.run(query, { rootID });

        if (result.records.length === 0) {
          console.warn("No data returned from spouseFamilyTree query.");
          return null;
        }
        
        const tree = buildSmallFamilyTree(result.records[0]);
        setSmallFamilyTree(tree);

      } catch (error) {
        console.error('❌ Error fetching spouse family tree:', error);
        return null;
      } finally {
        await session.close();
      }
  };

  const goToPersonById2 = async (ID) => {
    const container = smalltreeContainerRef.current;

    if (!container) {
      return;
    }
    
    const coords = spouseNodePositions.current[ID];
    if (!coords) {
      console.warn(`⚠️ Coordinates not found for person ID ${ID}`);
    }
      const { width: containerWidth, height: containerHeight } = container.getBoundingClientRect();

    // Step 1: Estimate full tree bounds (find min/max of all node positions)
    const allCoords = Object.values(spouseNodePositions.current);
    const minX = Math.min(...allCoords.map(pos => pos.x));
    const maxX = Math.max(...allCoords.map(pos => pos.x));
    const minY = Math.min(...allCoords.map(pos => pos.y));
    const maxY = Math.max(...allCoords.map(pos => pos.y));

    const treeWidth = maxX - minX;
    const treeHeight = maxY - minY;

    // Step 2: Calculate best zoom that fits tree in container (with margin)
    const zoomX = containerWidth / (treeWidth + 200);
    const zoomY = containerHeight / (treeHeight + 200);
    const zoom = Math.min(zoomX, zoomY);
    // Step 3: Center the focus person after zoom
    setZoomLevel2(zoom);
    setTranslate2({
      x: treeWidth / 2 * zoom * 2.5,
      y: treeHeight / 2 * zoom * 0.5 ,
    });
    setTranslate2(prev => ({
      x: prev.x + 0.0001,
      y: prev.y + 0.0001
    }));
  };

  const TreeStatsPopup = ({ treeCount, treeDepth, onClose }) => {
    return (
      <div className="stats-popup-overlay">
        <div className="stats-popup">
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
          <h2>إحصائيات الشجرة العائلية</h2>
          <p className="StatsDescription">
            يعرض هذا القسم إحصائيات تفصيلية حول الأشخاص والعائلات والأجيال في هذه الشجرة.
          </p>

          <table className="stats-table">
            <tbody>
              <tr>
                <td>🧑 مجموع الأشخاص:</td>
                <td>{treeCount.totalCount}</td>
              </tr>
              <tr>
                <td>💖 مجموع الأحياء:</td>
                <td>{treeCount.aliveCount}</td>
              </tr>
              <tr>
                <td>🌳 عدد الأجيال:</td>
                <td>{treeDepth}</td>
              </tr>
              <tr>
                <td>🏘️ عدد العائلات:</td>
                <td>{treeCount.familiesCount}</td>
              </tr>
            </tbody>
          </table>

          <div className="popup-actions">
            <button className="popup-btn">
              <FiDownload /> <label>تصدير البيانات</label>
            </button>
            <button className="popup-btn">
              <FiX/><label>إغلاق الإحصائيات</label>
             </button>
          </div>
        </div>
      </div>
    );
  };

  const SearchTreePopup = ({ treeSearchQuery, setTreeSearchQuery, handleSearch, setLookoutMode, onClose }) => {
    const handleSubmit = async () => {
      setLookoutMode('Node');
      await handleSearch();
    };

    return (
      <div className="search-popup-overlay">
        <div className="search-popup">
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
          <h2>🔍 البحث في الشجرة</h2>
          <p className="SearchDescription">أدخل اسم شخص أو جزء منه للبحث في هذه الشجرة العائلية.</p>
          
          <textarea
            placeholder="ابحث عن أي شخص في هذه الشجرة"
            value={treeSearchQuery}
            onChange={(e) => setTreeSearchQuery(e.target.value)}
            className="search-input"
          />
          
          <button className="search-btn" onClick={handleSubmit}>
            <FiSearch /> <label>البحث</label>
          </button>
        </div>
      </div>
    );
  };

  const resetTreeLayoutSettings = () =>{
    setRectHeight(60);
    setRectWidth(120);
    setNodeSize({x: 120, y:100});
    setSeparation({siblings: 1.2, nonSiblings: 1.75});
  };

  const TreeSettingsPopup = ({ showID, setShowID, resetSettings, goToPersonById, personID, title, onClose }) => {
    return (
      <div className="settings-popup-overlay">
        <div className="settings-popup">
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
          <h2>⚙️ إعدادات العرض والتنقل</h2>

          <div className="setting-item checkbox-item">
            <input
              type="checkbox"
              id="showIdCheckbox"
              checked={showID}
              onChange={() => setShowID(!showID)}
            />
            <label htmlFor="showIdCheckbox">عرض الرقم التسلسلي</label>
          </div>
          <div className="setting-item checkbox-item">
            <input
              type="checkbox"
              id="showIdCheckbox"
              checked={showNickname}
              onChange={() => setShowNickname(!showNickname)}
            />
            <label htmlFor="showIdCheckbox">عرض إسم الشهرة</label>
          </div>
          <div className="setting-item checkbox-item">
            <input
              type="checkbox"
              id="showIdCheckbox"
              checked={showNickname}
              onChange={() => setShowNoChildren(!showNoChildren)}
            />
            <label htmlFor="showIdCheckbox">عرض رمز الشخص بدون نسل</label>
          </div>

          <div className="nightModeToggle">
            <button className={`nightModeButton ${!treeNightMode ? 'active' : ''}`} onClick={() => setTreeNightMode(!treeNightMode)}>
              {!treeNightMode ? (
                <>
                  <FiSun />
                  <label>الوضع الليلي</label>
                </>
              ) : (
                <>
                  <FiMoon />
                  <label>الوضع العادي</label>
                </>
              )}
            </button>
          </div>
          <div className='advanced-settings'>
              <button   
              className="advanced-settings-btn"
              onClick={() => {setShowAdvancedSettings(!showAdvancedSettings)}}>
               <FaCog /> <label>{showAdvancedSettings ? "إخفاء الإعدادات المتقدمة" : "إظهار الإعدادات المتقدمة"}</label>
              </button>
              {showAdvancedSettings && 
                <div>
                  <fieldset>
                  <legend>إعداد عرض الشجرة</legend>
                <table>
                  <tbody>
                    <tr>
                      <td style={{ width: "40%", textAlign: "right" }}>
                        <label htmlFor="nonSiblingsRange">مسافة بين غير الأشقاء:</label>
                      </td>
                      <td style={{ width: "45%" }}>
                        <input
                          id="nonSiblingsRange"
                          type="range"
                          min="0.5"
                          max="5"
                          step="0.05"
                          value={separation.nonSiblings}
                          onChange={e =>
                            setSeparation({ ...separation, nonSiblings: parseFloat(e.target.value) })
                          }
                          style={{ width: "100%" }}
                        />
                      </td>
                      <td style={{ width: "15%", textAlign: "center", fontWeight: "bold" }}>
                        {separation.nonSiblings.toFixed(2)}
                      </td>
                    </tr>

                    <tr>
                      <td style={{ textAlign: "right" }}>
                        <label htmlFor="nodeWidthRange">عرض العقدة:</label>
                      </td>
                      <td>
                        <input
                          id="nodeWidthRange"
                          type="range"
                          min="120"
                          max="250"
                          step="1"
                          value={nodeSize.x}
                          onChange={e => setNodeSize({ ...nodeSize, x: parseInt(e.target.value) })}
                          style={{ width: "100%" }}
                        />
                      </td>
                      <td style={{ textAlign: "center", fontWeight: "bold" }}>
                        {nodeSize.x}px
                      </td>
                    </tr>

                    <tr>
                      <td style={{ textAlign: "right" }}>
                        <label htmlFor="nodeHeightRange">ارتفاع العقدة:</label>
                      </td>
                      <td>
                        <input
                          id="nodeHeightRange"
                          type="range"
                          min="90"
                          max="175"
                          step="1"
                          value={nodeSize.y}
                          onChange={e => setNodeSize({ ...nodeSize, y: parseInt(e.target.value) })}
                          style={{ width: "100%" }}
                        />
                      </td>
                      <td style={{ textAlign: "center", fontWeight: "bold" }}>
                        {nodeSize.y}px
                      </td>
                    </tr>

                    <tr>
                      <td style={{ textAlign: "right" }}>
                        <label htmlFor="rectWidthRange">عرض المستطيل:</label>
                      </td>
                      <td>
                        <input
                          id="rectWidthRange"
                          type="range"
                          min="75"
                          max="100"
                          step="1"
                          value={rectWidth}
                          onChange={e => setRectWidth(parseInt(e.target.value))}
                          style={{ width: "100%" }}
                        />
                      </td>
                      <td style={{ textAlign: "center", fontWeight: "bold" }}>
                        {rectWidth}px
                      </td>
                    </tr>

                    <tr>
                      <td style={{ textAlign: "right" }}>
                        <label htmlFor="rectHeightRange">ارتفاع المستطيل:</label>
                      </td>
                      <td>
                        <input
                          id="rectHeightRange"
                          type="range"
                          min="40"
                          max="80"
                          step="1"
                          value={rectHeight}
                          onChange={e => setRectHeight(parseInt(e.target.value))}
                          style={{ width: "100%" }}
                        />
                      </td>
                      <td style={{ textAlign: "center", fontWeight: "bold" }}>
                        {rectHeight}px
                      </td>
                    </tr>
                  </tbody>
                </table>
              <div className="setting-item">
                <button className="action-btn" onClick={resetTreeLayoutSettings}>
                  إعادة ضبظ إعدادات الشجرة
                </button>
              </div>
                  </fieldset>
                  <div className='selectType'>
                    <label>
                      نوع الخطوط بين العقد:
                      </label>
                      <select value={pathFunc} onChange={e => setPathFunc(e.target.value)}>
                        <option value="diagonal">منحني (diagonal)</option>
                        <option value="elbow">زاوي (elbow)</option>
                        <option value="straight">مباشر (straight)</option>
                        <option value="step">درجات (step)</option>
                      </select>
                    
                  </div>
                  <div className='selectType'>
                    <label>
                      اتجاه عرض الشجرة:
                    </label>
                      <select value={orientation} onChange={e => setOrientation(e.target.value)}>
                        <option value="horizontal">أفقي (horizontal)</option>
                        <option value="vertical">عمودي (vertical)</option>
                      </select>
                    
                  </div>
                </div>
              }
          </div>  
          
        <div className="setting-item">
          <button onClick={() => resetSettings(title)} className="action-btn">
            <FiRotateCcw /> إعادة ضبط العرض
          </button>
        </div>

        <div className="setting-item">
          <button onClick={() => goToPersonById(personID)} className="action-btn">
            <FiTarget /> التركيز على الشخص
          </button>
        </div>
        
          
        </div>
      </div>
    );
  };

  const InfoTooltip = ({ show, onClose }) => {
    if (!show) return null;

    return (
      <div className="tooltip-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="tooltip-title">
        <div
          className="tooltip-popup"
          onClick={(e) => e.stopPropagation()}
          dir="rtl"
          tabIndex={-1}
        >
          <button
            className="tooltip-close-btn"
            aria-label="Close tooltip"
            onClick={onClose}
          >
            <FiX/>
          </button>

          <h2 id="tooltip-title">تنقل في شجرة العائلة</h2>

          <div className="tooltip-content">
            <p>مرحبًا بك في دليل تنقل شجرة العائلة. هنا بعض النصائح:</p>

            <ul>
              <li>
                اضغط على الشخص لرؤية أبناءه
                </li>
              <li>قم بالضغط المتواصل على أي شخص لرؤية تفاصيله : الاسم ، اللقب ، الأم واسم الزوجة وحتى الفروع.</li>
              <li>في وضع ملء الشاشة، اضغط على زر الرجوع للخروج من العرض.</li>
              <li>يمكنك البحث عن الأشخاص باستخدام زر البحث أعلى الصفحة.</li>
              <li>إضعط على زر الإعدادات لجعل تصفح الشجرة تجربة مميزة وفريدة لك.</li>
            </ul>

            <p>
              تأكد من تحديث الصفحة بانتظام للحصول على أحدث البيانات، وشارك مساهماتك مع العائلة.
            </p>
          </div>
          <button className="action-btn" onClick={onClose}>إغلاق</button>
        </div>
      </div>
    );
  };
  return (
    <div
      id="treeWrapper"
      ref={treeContainerRef}
      style={{
        backgroundImage: treeNightMode
          ? `url(${bgNight})`
          : `url(${bgDay})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
       
      <div id="treeMenuToggle">
        
        <button onClick={toggleFullscreen} className="back-button" style={{color: treeNightMode ? 'white': 'black'}}>
          {!isFullscreen ? (
            <>
              <FiArrowLeft /> <label>الرجوع</label>
            </>
          ) : (
            <>
              <FiMaximize/> <label>تكبير الشاشة</label>
            </>
          )}
        </button>
        <button
          onClick={() => setShowTooltip(!showToolTip)}
          style={{color: treeNightMode ? 'white': 'black'}}
        >
          <FiInfo /> <label>ارشادات</label>
        </button>
        <button onClick={() => setShowStats(!showStats)}>
            <FiBarChart style={{ marginRight: 6, color: treeNightMode ? 'white': 'black'}}/>
            <label style={{color: treeNightMode ? 'white': 'black'}}>الإحصائيات</label>
        </button>

        <button onClick={() => setShowSearchPopup(!showSearchPopup)} style={{color: treeNightMode ? 'white': 'black'}}>
          <FiSearch style={{ marginRight: 6 }} />
          <label>البحث</label>
        </button>

        <button onClick={() => setShowSettingsPopup(!showSettingsPopup)} style={{color: treeNightMode ? 'white': 'black'}}>
          <FiSettings style={{ marginRight: 6}} />
          <label>الإعدادات</label>
        </button>
      </div>
      
      <ToastContainer 
        position="top-center" autoClose={3000} 
        newestOnTop={true}
        rtl={true}
        theme='dark'
        style={{ fontSize: '18px', fontWeight: "bolder" , fontFamily:"Cairo", textAlign:"center"}}
      />

      {showPopup && selectedPerson && (
        <>
          
          <div className="popup">
            <div className="popupHeader">
              <button className="HeaderButtons">
                <FiX id="CloseButtonPopup"
                  onClick={() => {
                    setShowPopup(false);
                    setShowSpouse(false);
                    setSpouseId(null);
                    setSmallFamilyTree(false);
                    setPersonID(selectedPerson.id);
                    
                  }}
                >
                </FiX>
              </button>
              <button 
                className={`HeaderButton ${popupMode === "details" ? "selected" : ""}`}
                onClick={() => {setPopupMode("details")}}>
                إظهار التفاصيل
              </button>
              {Array.isArray(selectedPerson.spouseId) && selectedPerson.spouseId.length >= 1 && (
              <button
                className={`HeaderButton ${popupMode === "tree" ? "selected" : ""}`}
                onClick={async () => {
                  
                  const spouse = selectedPerson.spouseId[activeSpouseIndex];
                  const found = isInTree(familyTree, spouse.id , treeMode === "lazy");
                  console.log(found, treeMode === "lazy");
                  setPersonID(spouse.id);
                  setSpouseId(spouse.id);

                  if (spouse.origin !== "Ksar Ouled Boubaker") {
                    setShowSpouseDetails(true);
                    toast.info(`لا شجرة لـ${utils.translateName(spouse.name)} ${utils.translateFamilyName(spouse.lastName)}.`)
                    return;
                  }

                  if (!found) {
                    setSmallTreeLoading(true);
                    setPopupMode('tree');
                    await spouseFamilyTree(spouse.id);
                    setShowSpouse(true);
                    setShowSpouseDetails(true);
                    
                  } else {
                    setShowPopup(false);
                  }
                  setFocusTrigger(prev => prev + 1);
                }}
              >
                {selectedPerson.gender === "Male"
                  ? "إذهب الى عائلة الزوجة"
                  : "اذهب إلى عائلة الزوج"}
              </button>
              )}
              
            </div>
            <section>
            {popupMode === "details" ? 
              <>
                <aside>
                  <div className="personDetails">
                      <h2 className='personDetailsTitle'>تفاصيل الشخص:</h2>
                        <table className="person-details-vertical-table">
                          <tbody>
                            <tr>
                              <th>الاسم</th>
                              <td>
                                {selectedPerson.id} - {selectedPerson.name} {selectedPerson.lastName}{" "}
                                {selectedPerson.Nickname && selectedPerson.Nickname !== selectedPerson.name
                                  ? `(${utils.translateNickname(selectedPerson.Nickname)}) `
                                  : ""}
                              </td>
                            </tr>
                            {selectedPerson.gender === "Male" && (
                              <tr>
                                <th>
                                  

                                  
                                  عدد الأبناء
                                </th>
                                {(() => {
                                  const counts = countChildrenGender(selectedPerson._realChildren || selectedPerson.children || []);
                                  const hasSpouse = selectedPerson.spouseId.length > 0;
                                  const childArray = Array.isArray(selectedPerson._realChildren)
                                    ? selectedPerson._realChildren
                                    : Array.isArray(selectedPerson.children)
                                      ? selectedPerson.children
                                      : [];

                                  // 2. Now it’s always an array, so .length is safe
                                  const hasChildren = childArray.length > 0;

                                  if (!hasSpouse) {
                                    return <td>غير متزوج</td>;
                                  } else {
                                    if (hasChildren) {
                                      return (
                                        <td>
                                          {(selectedPerson._realChildren?.length || selectedPerson.children.length)} : (
                                              {formatArabicCount(counts.male, 'ولد', 'ولدان', 'أولاد')}, {' '}
                                              {formatArabicCount(counts.female, 'بنت', 'بنتان', 'بنات')}
                                            )

                                        </td>
                                      );
                                    } else {
                                      return <td>لا أبناء.</td>;
                                    }
                                  }
                                })()}
                              </tr>
                            )}
                            <tr>
                              <th>الجنس</th>
                              <td>{selectedPerson.gender === "Male" ? "ذكر" : "انثى"}</td>
                            </tr>
                           
                            <tr>
                              <th>الفرع</th>
                              <td>{selectedPerson.Branch}</td>
                            </tr>
                             <tr>
                              <th>اسم الأم ولقبها</th>
                              <td>{selectedPerson.mother ? 
                                selectedPerson.mother.id + " - " + 
                                utils.translateName(selectedPerson.mother.name) + " " + 
                                utils.translateFamilyName(selectedPerson.mother.lastName)
                                : " غير متوفر "}
                              </td>
                            </tr>
                            <tr>
                              <th>ملاحضات</th>
                              <td>{selectedPerson.Notes ?? "-"}</td>
                            </tr>
                        </tbody>
                      </table>
                  </div>
                  <div className="spouseDetails">
                    <div className="person-marriage-vertical-table">
                      <h2 className='personDetailsTitle'>تفاصيل {selectedPerson.gender === 'Male' ? "الزوجة" : "الزوج"}:</h2>
                    <table >
                        <tbody>
                            <>
                              {selectedPerson.spouseId?.length >= 1 ? (
                            <>
                              <tr>
                                <th>اسم {selectedPerson.gender === "Male" ? "الزوجة ولقبها" : "الزوج ولقبه"}</th>
                                <td>
                                  {selectedPerson.spouseId[activeSpouseIndex]?.id}{" - "}
                                  {
                                    selectedPerson.spouseId[activeSpouseIndex]?.name !== "Unknown"
                                      ? utils.translateName(selectedPerson.spouseId[activeSpouseIndex].name)
                                      : "؟"
                                  }
                                  {
                                    selectedPerson.gender === "Male"
                                      ? (
                                          selectedPerson.spouseId[activeSpouseIndex]?.father
                                            ? " بنت "
                                            : ""
                                        )
                                      : (
                                          selectedPerson.spouseId[activeSpouseIndex]?.father
                                            ? " بن "
                                            : ""
                                        )
                                  }
                                  {
                                    selectedPerson.spouseId[activeSpouseIndex]?.father
                                      ? utils.translateName(selectedPerson.spouseId[activeSpouseIndex].father)
                                      : ""
                                  }
                                  {
                                    selectedPerson.spouseId[activeSpouseIndex]?.grandfather
                                      ? " بن " + utils.translateName(selectedPerson.spouseId[activeSpouseIndex].grandfather)
                                      : ""
                                  }
                                  {" "}
                                  {
                                    selectedPerson.spouseId[activeSpouseIndex]?.lastName !== "Unknown"
                                      ? utils.translateFamilyName(selectedPerson.spouseId[activeSpouseIndex].lastName)
                                      : "؟"
                                  }
                                </td>
                              </tr>

                              <tr>
                                <th>الأصل</th>
                                <td>
                                  {selectedPerson.spouseId[activeSpouseIndex]?.origin !== "Ksar Ouled Boubaker"
                                    ? "من " + selectedPerson.spouseId[activeSpouseIndex].origin
                                    : "قصر أولاد بوبكر"}
                                </td>
                              </tr>

                              <tr>
                                <th>الفرع</th>
                                <td>{selectedPerson.spouseId[activeSpouseIndex]?.branch 
                                || selectedPerson.spouseId[activeSpouseIndex].origin}</td>
                              </tr>
                              <tr>
                                <th>ملاحظات</th>
                                <td>{selectedPerson.Notes ?? "-"}</td>
                              </tr>
                            </>
                          ) : (
                              <td colSpan="2" style={{ textAlign: "center" }}>غير معروف أو غير متزوج</td>
                          )}
                            </>
                      </tbody>
                    </table>            
                    </div>
                    
                    <div className='spouseButtons'>
                    {selectedPerson.spouseId.length > 1 && (
                      <>
                        <h2>{selectedPerson.gender === "Male" ? 
                        "اختر الزوجة لعرض تفاصيلها:":
                        "اختر الزوج لعرض تفاصيله"}</h2>
                          <div className="MultipleSpouses">
                          {selectedPerson.spouseId.map((sp, index) => (
                            <button
                              key={sp.id}
                              className={index === activeSpouseIndex ? "active-spouse-button" : ""}
                              onClick={() => {
                                setActiveSpouseIndex(index);
                                setShowSpouseDetails(true);
                                setPersonID(sp.id);
                              }}
                            >
                              {utils.translateName(sp.name)}{" "}
                              {sp.lastName !== "Unknown" ? utils.translateFamilyName(sp.lastName) : ""}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    </div> 
                  </div>
                </aside>
                
              </>
              :
              <main>
                
                <div id="smallTreeDisplay" ref={smalltreeContainerRef}>
                  {smallTreeLoading && !smallFamilyTree ? (
                    <div><p>جاري تحميل الشجرة</p></div>
                  ) : (
                    <>
                    <button id="FocusButton" onClick={() => {goToPersonById2(personID)}}>التركيز على الشخص</button>
                    <TreeView
                      key={zoomLevel2 + '-' + translate2.x + '-' + translate2.y}
                      data={smallFamilyTree}
                      ref={smalltreeContainerRef}
                      pathFunc={pathFunc}
                      orientation={orientation}
                      rectHeight={rectHeight}
                      rectWidth={rectWidth}
                      translate={translate2}
                      zoom={zoomLevel2}
                      draggable={true}
                      zoomable={true}
                      nodePositions={spouseNodePositions}
                      onNodeClick={handlePersonClick}
                      onNodeContextMenu={handlePersonClickPopup}
                      startHoldTimer={startHoldTimer}
                      cancelHoldTimer={cancelHoldTimer}
                      goToPersonById={props.goToPersonById}
                      selectedGeneration={selectedGeneration}
                      personID={spouseId}
                      showID={showID}
                    />
                    </>
                    )}
                </div>
              
              </main>
            
            }
            </section>
          </div>
          
        </>
      )}
      {showStats && (
        <TreeStatsPopup
          treeCount={treeCount}
          treeDepth={treeDepth}
          onClose={() => setShowStats(false)}
        />
      )}
      {showSearchPopup && (
        <SearchTreePopup
          treeSearchQuery={treeSearchQuery}
          setTreeSearchQuery={setTreeSearchQuery}
          handleSearch={handleSearch}
          setLookoutMode={setLookoutMode}
          onClose={() => setShowSearchPopup(false)}
        />
      )}
      {showSettingsPopup && (
        <TreeSettingsPopup
          showID={showID}
          setShowID={setShowID}
          resetSettings={resetSettings}
          goToPersonById={goToPersonById}
          personID={personID}
          title={title}
          onClose={() => setShowSettingsPopup(false)}
        />
      )}
      {showToolTip && (
        <InfoTooltip show={showToolTip} onClose={() => setShowTooltip(false)} />
      )}
      <div id="treedisplayer1" style={{display: 'flex'}} >
                  <TreeView
              data={familyTree}
              ref={treeContainerRef}
              translate={translate}
              zoom={zoomLevel}
              draggable={!showPopup}
              zoomable={!showPopup}
              nodePositions={nodePositions}
              onNodeClick={handlePersonClick}
              onNodeContextMenu={handlePersonClickPopup}
              startHoldTimer={startHoldTimer}
              cancelHoldTimer={cancelHoldTimer}
              selectedGeneration={selectedGeneration}
              husbandId={props.husbandId}
              spouseId={props.spouseId}
              personID={props.personID}
              peopleWithNoChildren={peopleWithNoChildren}
              showID={showID}
              showNickname={showNickname}
              showNoChildren={showNoChildren}
              nightMode={treeNightMode}
              nodeSize={nodeSize}
              separation={separation}
              rectWidth={rectWidth}
              rectHeight={rectHeight}
              orientation={orientation}
              pathFunc={pathFunc}
            />
      </div>
    </div>
  );
});

export default FamilyTreeComponent;
