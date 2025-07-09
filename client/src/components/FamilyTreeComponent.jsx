import { useEffect, useRef, useState , forwardRef, useImperativeHandle, use  } from 'react';
import TreeView from './TreeView';
import { FiMaximize, FiMinimize, FiRotateCcw, FiSearch, FiArrowLeft, FiX, FiMenu  } from 'react-icons/fi';
import '../styles/FamilyTree.css';
import * as utils from '../utils/utils';
import { ToastContainer } from 'react-toastify';
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

  let {
    familyTree,
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
  return translateNodeRecursive(rawTree);
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

    const coords = nodePositions.current[ID];
    if (!coords) {
      alert("تعذر العثور على إحداثيات الشخص.");
      return;
    }

    const { width, height } = container.getBoundingClientRect();

    setTranslate({
      x: width / 2 - coords.x,
      y: height / 2 - coords.y,
    });
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
            <FiArrowLeft size={24} />
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
            <h4>
              {selectedPerson.id} - {selectedPerson.name + " "} 
              {selectedPerson.lastName}
              {selectedPerson.Nickname !== selectedPerson.Nickname
              ? `(${utils.translateNickname(selectedPerson.Nickname)}) `
              : ""}
            </h4>
          <p>
            {selectedPerson.Notes}
          </p>
          {showSpouseDetails && 
              <>
              <p>
                
                {selectedPerson.name}{" "}
                {selectedPerson.gender === "Male" ? "متزوج" : "متزوجة"}{" "}
                {selectedPerson.spouseId?.length > 0 && (
                  <>
                    
                    {selectedPerson.spouseId[0].name !== "Unknown"
                      ? utils.translateName(selectedPerson.spouseId[0].name)
                      : ""}{" "}
                    {selectedPerson.spouseId[0].lastName !== "Unknown"
                      ? utils.translateFamilyName(selectedPerson.spouseId[0].lastName)
                      : ""}{" "}
                    {" ( "} {selectedPerson.spouseId[0].id} {" ) "}
                    {selectedPerson.spouseId[0].origin !== "Ksar Ouled Boubaker"
                      ? "من " + selectedPerson.spouseId[0].Origin
                      : ""}
                    {" ( "} {selectedPerson.spouseId[0].branch} {" ) "}
                  </>
                )}
              </p>
              </>
          }
              <div className="popup-buttons">
            {Array.isArray(spouseId) && spouseId.length === 1 && (
              <button
              onClick={async () => {
                

                const spouse = selectedPerson.spouseId[0];

                setPersonID(spouse.id); // reset first
                setSpouseId(spouse.id);
                console.log(spouse, !nodePositions.current[spouse.id]);

                if (spouse.origin !== "Ksar Ouled Boubaker") {
                  setShowSpouseDetails(true);
                } else {
                  if (!nodePositions.current[spouse.id]) {
                    console.log("fdsfdsf");
                    setPersonID(spouse.id);
                    await spouseFamilyTree(spouse.id);
                    setShowSpouse(true);
                    setShowSpouseDetails(true);
                  } 
                  else {
                    console.log("22222");
                    setShowPopup(false);
                    setPersonID(spouse.id);
                    if (typeof props.goToPersonById === "function") {
                      await props.goToPersonById();
                    }
                  }
                }
              }}
            >
              {selectedPerson.gender === "Male" ? "إذهب الى الزوجة" : "اذهب إلى الزوج"}
            </button>


            )}
            <button
              onClick={() => {
                setShowPopup(false);
                setShowSpouse(false);
                setSpouseId(null);
                setSmallFamilyTree(false);
                setPersonID(selectedPerson.id);
              }}
            >
              إغلاق
            </button>
          </div>
          </aside>
          <main>
              {smallFamilyTree && (
            <div
              id="smallTreeDisplay"
              ref={smalltreeContainerRef}
            >
              <TreeView
                data={smallFamilyTree}
                ref={smalltreeContainerRef}
                translate={{x: 200, y:50}}
                zoom={0.3}
                draggable={true}
                zoomable={true}
                nodePositions={nodePositions}
                onNodeClick={handlePersonClick}
                onNodeContextMenu={handlePersonClickPopup}
                startHoldTimer={startHoldTimer}
                cancelHoldTimer={cancelHoldTimer}
                goToPersonById={props.goToPersonById}
                selectedGeneration={selectedGeneration}
                personID={spouseId}
                showID={showID}
              />
            </div>
          )}
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
