// --- TreeView.jsx ---
import React from 'react';
import Tree from 'react-d3-tree';
import peopleWithNoChildren from '../data/peopleWithNoChildren.json';

const TreeView = ({
  data,
  translate,
  zoom,
  draggable,
  zoomable,
  nodePositions,
  onNodeClick,
  onNodeContextMenu,
  startHoldTimer,
  cancelHoldTimer,
  husbandId,
  wifeId,
  personID,
  spouseId
}) => (
  <Tree
    data={data}
    orientation="vertical"
    pathFunc="step"
    translate={translate}
    zoom={zoom}
    draggable={draggable}
    zoomable={zoomable}
    collapsible
    separation={{ siblings: 1.2, nonSiblings: 1.2 }}
    nodeSize={{ x: 110, y: 150 }}
    renderCustomNodeElement={({ nodeDatum, hierarchyPointNode }) => {
      nodePositions.current[nodeDatum.id] = {
        x: hierarchyPointNode.x,
        y: hierarchyPointNode.y,
      };

      const specialColors = {
        [husbandId?.toString() || 'default-husband']: '#66bb6a',
        [wifeId?.toString() || 'default-wife']: '#ff8a65',
        [personID?.toString() || 'default-person']: '#cf14d9',
        };

        const fill = specialColors[nodeDatum.id?.toString()] 


      return (
        <g
          onMouseDown={() => startHoldTimer(nodeDatum)}
          onMouseUp={cancelHoldTimer}
          onMouseLeave={cancelHoldTimer}
          onClick={(e) => onNodeClick(nodeDatum, e)}
          onContextMenu={(e) => {
            e.preventDefault();
            onNodeContextMenu(nodeDatum, e);
          }}
          style={{ cursor: 'pointer' }}
        >
          <defs>
            <linearGradient id={`grad-${nodeDatum.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fdf6e3" stopOpacity="0.95" />
              <stop
                offset="100%"
                stopColor={
                  specialColors[nodeDatum.id?.toString()] ||
                  (nodeDatum.isAlive ? "#d4b483" : "#8b6f47")
                }
                stopOpacity="1"
              />
            </linearGradient>
            <filter id={`soft-shadow-${nodeDatum.id}`} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#a58e6f" floodOpacity="0.25" />
            </filter>
          </defs>

          <rect
            x="-60"
            y="-30"
            width="120"
            height="60"
            rx="16"
            ry="14"
            fill={`url(#grad-${nodeDatum.id})`}
            stroke={nodeDatum.gender === "Female" ? "#b52155" : "#1bbc7b"}
            strokeWidth="2"
            filter={`url(#soft-shadow-${nodeDatum.id})`}
          />

          {(() => {
          const words = nodeDatum.name.split(" ");
          const lines = [nodeDatum.id];
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
              marriageStatus = "M";    // Married once
            } else if (validSpouses.length > 1) {
              marriageStatus = "MM";   // Married multiple times
            }
          }
          const all = [...lines];
          if (peopleWithNoChildren.includes(nodeDatum.id)) all.push("∅");
          if (nodeDatum.Nickname) all.push(`(${nodeDatum.Nickname})`);
          if (marriageStatus) all.push(marriageStatus);

          return (
            <>
              {/* Render the person's name lines */}
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
                    fill: nodeDatum.isAlive ? "#0d1f2d" : "#ffffff",
                    fontWeight: 900,
                    pointerEvents: "none",
                    letterSpacing: 1.5,
                    strokeWidth: nodeDatum.isAlive ? 1 : 0,
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

export default TreeView;
