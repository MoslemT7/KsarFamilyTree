import { useEffect, useRef, useState , forwardRef, useImperativeHandle, use  } from 'react';
import TreeView from './TreeView';
import { FiMaximize, FiMinimize, FiRotateCcw, FiSearch, FiArrowLeft, FiX, FiMenu, FiInfo  } from 'react-icons/fi';
import '../styles/FamilyTree.css';
import * as utils from '../utils/utils';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import neo4j from 'neo4j-driver';
import ZoomBar from './ZoomBar';

const neo4jURI = process.env.REACT_APP_NEO4J_URI;
const neo4jUser = process.env.REACT_APP_NEO4J_USER; 
const neo4jPassword = process.env.REACT_APP_NEO4J_PASSWORD;
const driver = neo4j.driver(
  neo4jURI, 
  neo4j.auth.basic(neo4jUser, neo4jPassword)
);

const FamilyTreeComponent = forwardRef((props, ref) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showID, setShowID] = useState(false);
  const [showTreeHeader, setShowTreeHeader] = useState(false);
  const [showSpouseDetails, setShowSpouseDetails] = useState(false)
  const [smallFamilyTree, setSmallFamilyTree] = useState(null);
  const [activeSpouseIndex, setActiveSpouseIndex] = useState(0);
  const [translate2, setTranslate2] = useState({x: 0, y: 0});
  const [zoomLevel2, setZoomLevel2] = useState(1);

  let {
    familyTree,
    setFocusTrigger,
    focusTrigger,
    setFamilyTree,
    translate,
    zoomLevel,
    setZoomLevel,
    setTranslate,
    selectedGeneration,
    treeCount,
    treeDepth,
    title,
    setTitle,
    showPopup,
    selectedPerson,
    showSpouse,
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
    loading,
    setLoading,
    setPersonDetails,
    personDetails,
    handlePersonTreeDisplay,
    lookoutMode,
    
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
      console.log("TESTE FDSJFKDSJFL;");
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
        else {
          console.log("Spouse found");
        }
        
        const tree = buildSmallFamilyTree(result.records[0]);
        console.log(tree);
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
    console.log(minX, minY, maxX, maxY, treeWidth, treeHeight, zoomX, zoomY, zoom);
    // Step 3: Center the focus person after zoom
    setZoomLevel2(zoom);
    setTranslate2({
      x: treeWidth / 2 * zoom + 35,
      y: treeHeight / 2 * zoom,
    });
  };
  useEffect(() =>{
    console.log(translate2);
  }, [translate2]);

  const TreeHeaderWithTooltip = () => {
    const [showTooltip, setShowTooltip] = useState(false);

    const label = "إرشادات";
    const tooltip = `
    اضغط واسحب للتنقل داخل الشجرة.
    استخدم عجلة الفأرة للتكبير والتصغير.
    انقر على أي شخص لعرض التفاصيل في نافذة منبثقة.
    ستظهر معلومات مثل الاسم، المعرف، النسب، والملاحظات.
    إذا كان متزوجًا، ستُعرض بيانات الزوج/الزوجة، الأصل والفرع.
    اضغط على زر القائمة لعرض عناصر التحكم الأخرى و الاحصائيات.
    `;

    return (
      <div className="InfoHeader">
        <h2>{label}</h2>

        <button
          onClick={() => setShowTooltip(prev => !prev)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            display: "flex",
            alignItems: "center",
          }}
          aria-label="إظهار التعليمات"
        >
          <FiInfo size={18} style={{ color: "#555" }} />
        </button>

        {showTooltip && (
          <div className='InfoTips'>
            {tooltip}
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    console.log(smallFamilyTree);
  }, [smallFamilyTree])

  useEffect (() => {
    setShowSpouseDetails(false);
  }, [selectedPerson])

  return (
    <div id="treeWrapper" ref={treeContainerRef} >
       
      <div id="treeMenuToggle">
        <button  onClick={() => {setShowTreeHeader(!showTreeHeader)}}>
          <FiMenu size={24}/>
        </button>
        <button  onClick={toggleFullscreen} className="back-button">
          {isFullscreen ?  <FiArrowLeft size={24} /> : <FiMaximize></FiMaximize> }
        </button>
        <TreeHeaderWithTooltip />
      </div>
      
      <ToastContainer 
        position="top-center" autoClose={3000} 
        newestOnTop={true}
        rtl={true}
        theme='dark'
        style={{ fontSize: '18px', fontWeight: "bolder" , fontFamily:"Cairo", textAlign:"center"}}
      />
      {showPopup && selectedPerson && (
        
        <div className="popup">
          <aside>
            <button className="HeaderButtons">
              <FiX id="CloseButtonPopup"
                onClick={() => {
                  setShowPopup(false);
                  setShowSpouse(false);
                  setSpouseId(null);
                  setSmallFamilyTree(false);
                  setPersonID(selectedPerson.id);
                  
                }}
              ></FiX>
            </button>
            <h2>تفاصيل الشخص:</h2>
          <p>
            {selectedPerson.Notes}
          </p>
        
            <table className="person-marriage-vertical-table">
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
                {showSpouseDetails && (
                  <>
                    {selectedPerson.spouseId?.length >= 1 ? (
                  <>
                    <tr>
                      <th>اسم {selectedPerson.gender === "Male" ? "الزوجة ولقبها" : "الزوج ولقبه"}</th>
                      <td>
                        {selectedPerson.spouseId[activeSpouseIndex]?.id} {" - "}
                        {selectedPerson.spouseId[activeSpouseIndex]?.name !== "Unknown"
                          ? utils.translateName(selectedPerson.spouseId[activeSpouseIndex].name)
                          : ""}{" "}
                        {selectedPerson.spouseId[activeSpouseIndex]?.lastName !== "Unknown"
                          ? utils.translateFamilyName(selectedPerson.spouseId[activeSpouseIndex].lastName)
                          : ""}
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
                      <td>({selectedPerson.spouseId[activeSpouseIndex]?.branch || "غير معروف"})</td>
                    </tr>

                  </>
                ) : (
                    <p colSpan="2" style={{ textAlign: "center" }}>غير معروف أو غير متزوج</p>
                )}
                  </>
                )}
            </tbody>
          </table>
          {selectedPerson.spouseId.length > 1 && (
            <>
              <h2>اختر الزوجة لعرض تفاصيلها:</h2>
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

          <div className="popup-buttons">
        {Array.isArray(selectedPerson.spouseId) && selectedPerson.spouseId.length >= 1 && (
                <button
                  onClick={async () => {
                    const spouse = selectedPerson.spouseId[activeSpouseIndex];

                    setPersonID(spouse.id);
                    setSpouseId(spouse.id);

                    if (spouse.origin !== "Ksar Ouled Boubaker") {
                      setShowSpouseDetails(true);
                      return;
                    }
                    else {
                      const inTree = nodePositions.current[spouse.id];

                      if (!inTree) {
                        await spouseFamilyTree(spouse.id);
                        setShowSpouse(true);
                        setShowSpouseDetails(true);
                        await goToPersonById2(spouse.id);
                      } else {
                        setShowPopup(false);
                        setPersonID(spouse.id);
                        await goToPersonById(spouse.id);
                      }
                    }
                  }}
                >
                  {selectedPerson.gender === "Male"
                    ? "إذهب الى عائلة الزوجة"
                    : "اذهب إلى عائلة الزوج"}
                </button>

              )}
          
          </div>
          </aside>
          <main>
            
            <div id="smallTreeDisplay" ref={smalltreeContainerRef}>
              
              {smallFamilyTree && (
                <>
                <button onClick={() => {goToPersonById2(personID)}}>التركيز على الشخص</button>
                <TreeView
                  data={smallFamilyTree}
                  ref={smalltreeContainerRef}
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
        </div>
      )}
      {showTreeHeader && 
        <div className="treeHeader">
          <div className="infoStats">
            <table>
              <tbody>
              <tr>
                <td className="st">مجموع الأشخاص:</td>
                <td className="st">{treeCount.totalCount}</td>
              </tr>
              <tr>
                <td className="st">مجموع الأحياء</td>
                <td className="st">{treeCount.aliveCount}</td>
              </tr>
              <tr>
                <td className="st">عدد الأجيال</td>
                <td className="st">{treeDepth}</td>
              </tr>
              <tr>
                <td className="st">عدد العائلات</td>
                <td className="st">{treeCount.familiesCount}</td>
              </tr>
              </tbody>
            </table>
          </div>

          <div id="titleDiv">
            <h2>{title}</h2>
            
            <button
              className='searchButton'
              onClick={ async () => {
                setLookoutMode('Node');
                await handleSearch();
              }}
            >
              <FiSearch></FiSearch>
            </button>
              <textarea placeholder='ابحث عن أي شخص في هذه الشجرة' value={treeSearchQuery} onChange={(e) => setTreeSearchQuery(e.target.value)}/>
          </div>

          <div id="buttonsZone">
            <button onClick={toggleFullscreen} aria-label="Toggle fullscreen">
              {isFullscreen ? (
                <>
                  <FiMinimize />
                  <span>تصغير الشاشة</span>
                </>
              ) : (
                <>
                  <FiMaximize />
                  <span>تكبير الشاشة</span>
                </>
              )}
            </button>

            <button onClick={() => resetSettings(title)} id="resetViewBtn">
              <>
                <FiRotateCcw />
                <span>إعادة ضبط العرض</span>
              </>
            </button>

            <button>
              <input type="checkbox" value={showID} onChange={() => {setShowID(!showID)}}></input><label class="buttonLabel">عرض الرقم التسلسلي </label>
            </button>
            <button onClick={() => {goToPersonById()}}>
              اعادة التركيز
            </button>
          </div>
        </div>
      }
      
      <div id="treedisplayer1" style={{display: 'flex'}}>
        
        
        <div id="treedisplayer2" style={{ pointerEvents: showPopup ? 'none' : 'auto', display: 'flex', flex: 1 }}>
      
          <div id="treedisplayer3">
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
            />
          </div>

            <div style={{display: isFullscreen ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center' }}>
              <ZoomBar zoomLevel={zoomLevel} setZoomLevel={setZoomLevel} />
            </div>
        </div>
      </div>
    </div>
  );
});

export default FamilyTreeComponent;
