import Tree from 'react-d3-tree';
import peopleWithNoChildren from '../data/peopleWithNoChildren.json';
import * as utils from '../utils/utils';
import { useEffect } from 'react';

const TreeView = ({
  key,
  data,
  translate,
  zoom,
  setZoomLevel,
  showSpouse,
  treeRef,
  draggable,
  zoomable,
  nodePositions,
  spouseNodePositions,
  onNodeClick,
  onNodeContextMenu,
  startHoldTimer,
  cancelHoldTimer,
  personID,
  showID,
  showNickname,
  nightMode,
  rectWidth,
  rectHeight,
  seperation,
  nodeSize,
  pathFunc,
  orientation,
  showNoChildren
  }) => {

  useEffect(() => {
    nodePositions.current = {};
  }, [data]);

  const rectX = -(rectWidth / 2);
  const rectY = -(rectHeight / 2);

  return (
  <Tree
    data={data}
    ref={treeRef}
    orientation={orientation}
    pathFunc={pathFunc}
    translate={translate}
    initialZoom={0.01}
    zoom={zoom}
    draggable={draggable}
    zoomable={zoomable}
    debug={true}
    separation={seperation}
    nodeSize={nodeSize}
    styles={{
    links: {
        stroke: nightMode ? '#f8d36e' : '#4b8fe3',
        strokeWidth: 2,
      }
    }}
    renderCustomNodeElement={({ nodeDatum, hierarchyPointNode }) => {
      nodePositions.current[nodeDatum.id] = {
        x: hierarchyPointNode.x,
        y: hierarchyPointNode.y,
      };

      const specialColors = {
        [personID?.toString() || 'default-person']: '#cf14d9',
        };

        const fill = specialColors[nodeDatum.id?.toString()] 


      return (
        <g
          onMouseDown={(e) => {
            e.preventDefault();
            startHoldTimer(nodeDatum);
          }}
          onMouseUp={(e) => {
            e.preventDefault();
            cancelHoldTimer();
          }}
          onMouseLeave={(e) => {
            e.preventDefault();
            cancelHoldTimer();
          }}
          onTouchStart={(e) => {
            startHoldTimer(nodeDatum);
          }}
          onTouchEnd={(e) => {
            cancelHoldTimer();
          }}
          onTouchCancel={(e) => {
            cancelHoldTimer();
          }}
          onClick={(e) => {
            e.preventDefault();
            onNodeClick(nodeDatum, e);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            onNodeContextMenu(nodeDatum, e);
          }}
          style={{ cursor: 'pointer', touchAction: 'manipulation' }}
        >
          <defs>
            <linearGradient id={`grad-${nodeDatum.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop
                offset="30%"
                stopColor={nightMode ? "#3a3a3a" : "#fdf6e3"}   // darker color for night mode
                stopOpacity={nightMode ? "0.9" : "0.75"}
              />
              <stop
                offset="100%"
                stopColor={
                  specialColors[nodeDatum.id?.toString()] ||
                  (nodeDatum.isAlive
                    ? (nightMode ? "#8f9a3a" : "#d4b483")   // olive green lighter in day, muted in night
                    : (nightMode ? "#222222" : "#1c1818"))  // very dark shades in night mode
                }
                stopOpacity="1.25"
              />
            </linearGradient>

            <filter id={`soft-shadow-${nodeDatum.id}`} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow
                dx="0"
                dy="4"
                stdDeviation="3.5"
                floodColor={nightMode ? "#5a5a4f" : "#a58e6f"} // softer shadow color in night mode
                floodOpacity={nightMode ? "0.6" : "0.8"}
              />
            </filter>
          </defs>

          <rect
            x={rectX}
            y={rectY}
            width={rectWidth}
            height={rectHeight}
            rx="16"
            ry="14"
            fill={`url(#grad-${nodeDatum.id})`}
            stroke={nodeDatum.gender === "Female"
              ? (nightMode ? "#d07a9a" : "#b52155")  // softer pink in night mode
              : (nightMode ? "#7299d0" : "#4b8fe3")}  // lighter blue in night mode
            strokeWidth="3"
            filter={`url(#soft-shadow-${nodeDatum.id})`}
          />


          {(() => {
          const words = nodeDatum.name.split(" ");
          const lines = (showID) ? [nodeDatum.id] : [];
          let curr = "";
          words.forEach((w) => {
            const test = curr ? `${curr} ${w}` : w;
            if (test.length > 12) {
              lines.push(curr);
              curr = w;
            } else curr = test;
          });
          if (curr) lines.push(curr);

          let marriageStatus = "";
          if (Array.isArray(nodeDatum.spouseId)) {
            const validSpouses = nodeDatum.spouseId;
            
            if (validSpouses.length === 1) {
              marriageStatus = "M"; 
            } else if (validSpouses.length > 1) {
              marriageStatus = "MM";
            }
          }
          const all = [...lines];
          if (peopleWithNoChildren.includes(nodeDatum.id) && showNoChildren) all.push("∅");
          if (nodeDatum.Nickname && showNickname) all.push(`(${utils.translateNickname(nodeDatum.Nickname)})`);
          if (marriageStatus) all.push(marriageStatus);
          return (
            <>
              {all.map((line, i) => (
                <text
                  key={`name-line-${i}`}
                  x="0"
                  y={i * 18 - (all.length - 1) * 9}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{
                    fontSize: "22px",
                    fontFamily: "Cairo",
                    fill: nightMode
                      ? nodeDatum.isAlive
                        ? "#d2d8e0ff"   // lighter, cool color for alive in night mode
                        : "#ffffffff"   // muted dark for deceased in night mode
                      : nodeDatum.isAlive
                      ? "#0d1f2d"
                      : "#1c1818",
                    fontWeight: 900,
                    pointerEvents: "none",
                    letterSpacing: 1.5,
                    strokeWidth: 0
                  }}
                >
                  {line}
                </text>

              ))}

    </>
  );
})()}


        </g>

      );
    }}
  />
  );
};

export default TreeView;
