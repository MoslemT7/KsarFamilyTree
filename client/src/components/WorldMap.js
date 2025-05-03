// src/components/WorldMap.js
import React from 'react';
import Plot from 'react-plotly.js';
import './WorldMap.css';  // Import the CSS file for styling

const WorldMap = () => {
  // Example data (replace with real Ksar population numbers)
  const countries = ['TUN', 'FRA', 'ITA', 'USA', 'QAT']; // ISO 3166-1 alpha-3 country codes
  const values = [2200, 370, 152, 80, 20]; // Ksar population per country

  return (
    <div className="world-map-container">
      <h3>عدد أفراد الكُسَر حسب الدول</h3>
      <Plot
        data={[
          {
            type: 'choropleth',
            locationmode: 'ISO-3',
            locations: countries,
            z: values,
            colorscale: 'Viridis', // Choose a more distinguishable color scale
            colorbar: {
              title: 'عدد أفراد الكُسَر',
              tickvals: [0, 500, 1000, 1500, 2000],
              ticktext: ['0', '500', '1000', '1500', '2000+'],
              thickness: 20, // Set the thickness of the color bar
              tickwidth: 3, // Increase tick width for better clarity
              ticklen: 10,  // Increase the length of ticks for visibility
            },
          },
        ]}
        layout={{
          title: 'توزيع سكان قصر أولاد بوبكر حسب البلدان',
          geo: {
            projection: { type: 'natural earth' },
            showcoastlines: true,
            coastlinecolor: 'rgb(255, 255, 255)',
            showland: true,
            landcolor: 'rgb(242, 242, 242)',
            showlakes: true,
            lakecolor: 'rgb(255, 255, 255)',
            // Enable zooming and adjust scale
            center: { lat: 20, lon: 0 }, // Set default zoom center
            projection_scale: 6, // Adjust zoom level
            showcountries: true,
            countrycolor: 'rgb(255, 255, 255)', // Country borders in white
          },
          margin: { t: 50, b: 0, l: 0, r: 0 },
        }}
      />
    </div>
  );
};

export default WorldMap;
