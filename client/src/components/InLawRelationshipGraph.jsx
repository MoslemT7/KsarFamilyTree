import React, { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';

const InLawRelationshipGraph = ({ nodes, edges }) => {
  const containerRef = useRef(null);
  const cyRef = useRef(null);

  useEffect(() => {
    let resizeObserver;

    const initializeGraph = () => {
      if (!containerRef.current) return;

      if (cyRef.current) {
        cyRef.current.destroy();
      }

      const processedNodes = nodes.map((node) => ({
        data: {
          id: node.data?.id || node.id,
          label: node.data?.label || node.label || '❓',
        },
      }));

      const processedEdges = edges.map((edge) => ({
        data: {
          id: edge.data?.id || edge.id,
          source: edge.data?.source || edge.source,
          target: edge.data?.target || edge.target,
          label: edge.data?.label || edge.label || '',
        },
      }));

      cyRef.current = cytoscape({
        container: containerRef.current,
        elements: [...processedNodes, ...processedEdges],
        style: [
          {
            selector: 'node',
            style: {
              label: 'data(label)',
              'text-valign': 'center',
              'text-halign': 'center',
              'background-color': '#007ACC',
              'color': '#fff',
              'font-size': '14px',
              'width': '60px',
              'height': '60px',
              'text-outline-width': 2,
              'text-outline-color': '#007ACC',
            },
          },
          {
            selector: 'edge',
            style: {
              label: 'data(label)',
              'curve-style': 'bezier',
              'target-arrow-shape': 'triangle',
              'line-color': '#999',
              'target-arrow-color': '#999',
              'font-size': '12px',
              'text-background-color': '#ffffff',
              'text-background-opacity': 1,
              'text-rotation': 'autorotate',
              'width': 2,
            },
          },
        ],
        layout: {
          name: 'cose',
          fit: true,
        },
         userZoomingEnabled: false,
  boxSelectionEnabled: false,
  autoungrabify: true,
      });

      resizeObserver = new ResizeObserver(() => {
        if (cyRef.current) {
          cyRef.current.resize();
          cyRef.current.fit();
        }
      });

      resizeObserver.observe(containerRef.current);
    };

    // Defer init to next tick to ensure proper sizing
    const timeout = setTimeout(initializeGraph, 0);

    return () => {
      clearTimeout(timeout);
      if (resizeObserver) resizeObserver.disconnect();
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [nodes, edges]);

  return (
    <div style={{ width: '100%', height: '500px' }}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          border: '2px solid #ccc',
          borderRadius: '8px',
        }}
      />
    </div>
  );
};

export default InLawRelationshipGraph;
