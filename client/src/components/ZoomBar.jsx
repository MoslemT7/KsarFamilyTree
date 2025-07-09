// ZoomBar.jsx
import React from 'react';
import "../styles/ZoomBar.css";

const ZoomBar = ({ zoomLevel, setZoomLevel }) => {
  const handleZoomChange = (e) => {
    const newZoom = parseFloat(e.target.value);
    setZoomLevel(newZoom);
  };

  return (
    <div className="zoom-bar-container">
      <input
        type="range"
        min="0.01"
        max="1"
        step="0.001"
        value={zoomLevel}
        onChange={handleZoomChange}
        className="zoom-slider"
        orient="vertical"
      />
      <div className="zoom-percent">{Math.round(zoomLevel * 100)}%</div>
    </div>
  );
};

export default ZoomBar;
