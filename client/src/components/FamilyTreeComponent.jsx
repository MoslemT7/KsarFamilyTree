// --- FamilyTreeComponent.jsx ---
import React, { useEffect, useRef, useState } from 'react';
import TreeView from './TreeView';
import { FiMaximize, FiMinimize, FiRotateCcw  } from 'react-icons/fi';
import '../styles/FamilyTree.css';

function FamilyTreeComponent(props) {
  const [husbandID, setHusbandID] = useState(-1);
  const [wifeID, setWifeID] = useState(-1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  let {
    familyTree,
    smallFamilyTree,
    translate,
    zoomLevel,
    selectedGeneration,
    treeCount,
    treeDepth,
    maxGeneration,
    title,
    showPopup,
    selectedPerson,
    showSpouse,
    spouseId,
    personID,
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
    peopleWithNoChildren
  } = props;
  function resetSettings(){
    title = "";
  }
  const toggleFullscreen = async () => {
    const elem = treeContainerRef.current;
    if (!document.fullscreenElement) {
      try {
        await elem.requestFullscreen();
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
  
  return (
    <div id="treeWrapper" ref={treeContainerRef}>
      {/* Inline Popup */}
      {showPopup && selectedPerson && (
        <div className="popup">
          <h4>الرقم التسلسلي: {selectedPerson.id}</h4>
          <h4>
            الاسم: {selectedPerson.name}{" "}
            {selectedPerson.Nickname && `(${selectedPerson.Nickname})`}
          </h4>
          <h4>اللقب: {selectedPerson.lastName}</h4>
          {selectedPerson.Notes && <h4>ملاحظات: {selectedPerson.Notes}</h4>}

          {/* Mini-spouse tree */}
          {smallFamilyTree && showSpouse && (
            <div
              id="treedisplayerP"
              ref={smalltreeContainerRef}
              style={{ width: '100%', height: '300px', overflow: 'auto' }}
            >
              <TreeView
                data={smallFamilyTree}
                translate={translate}
                zoom={0.35}
                draggable={true}
                zoomable={false}
                nodePositions={nodePositions}
                onNodeClick={handlePersonClick}
                onNodeContextMenu={handlePersonClickPopup}
                startHoldTimer={startHoldTimer}
                cancelHoldTimer={cancelHoldTimer}
                selectedGeneration={selectedGeneration}
                husbandId={husbandID}
                wifeId={wifeID}
                personID={spouseId}
              />
            </div>
          )}

          <div className="popup-buttons">
            {spouseId !== -1 && (
              <button
                onClick={async () => {
                  if (!nodePositions.current[spouseId]) {
                    await props.spouseFamilyTree(spouseId);
                    setShowSpouse(true);
                  } else {
                    setShowPopup(false);
                    goToPersonById(spouseId);
                  }
                }}
              >
                {selectedPerson.gender === "Male" ? "اذهب إلى الزوجة" : "اذهب إلى الزوج"}
              </button>
            )}
            <button
              onClick={() => {
                setShowPopup(false);
                setShowSpouse(false);
                setSpouseId(null);
              }}
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="treeHeader">
        <div className="infoStats">
          <p>مجموع الأشخاص: {treeCount.totalCount}</p>
          <p>على قيد الحياة: {treeCount.aliveCount}</p>
          <p>عدد الأجيال: {treeDepth}</p>
        </div>
        <div id="titleDiv">
          <h2>{title}</h2>
        </div>
        <div id="buttonsZone">
        <button id="buttonsZone" onClick={toggleFullscreen} aria-label="Toggle fullscreen">
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

        <button onClick={() => resetSettings()} id="resetViewBtn">
          <>
            <FiRotateCcw />
            <span>إعادة ضبط العرض</span>
          </>
        </button>

        </div>
        
      </div>

      {/* Main Tree */}
      <div id="treedisplayer1" ref={treeContainerRef} style={{ display: 'flex' }}>
        <div
          id="treedisplayer2"
          style={{ pointerEvents: showPopup ? 'none' : 'auto' }}
        >
          <TreeView
            data={familyTree}
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
          />
        </div>
      </div>

      {/* Legend */}
      <div id="keys">
        {/* ... your key-boxes ... */}
      </div>
    </div>
  );
}

export default FamilyTreeComponent;
