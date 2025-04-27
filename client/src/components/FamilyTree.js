import React, { useEffect, useState , useRef } from 'react';
import Tree from 'react-d3-tree';
import './FamilyTree.css';
import neo4j from 'neo4j-driver';
import Fuse from 'fuse.js'; // Import Fuse.js for fuzzy search
const translations = require('./translation.json');


const driver = neo4j.driver(
  'neo4j+s://2cd0ce39.databases.neo4j.io',
  neo4j.auth.basic('neo4j', 'nW1azrzTK-lrTOO5G1uOkUVFwelcQlEmKPHggPUB7xQ')
);
const session = driver.session();

let uniqueKeyCounter = 0;
export const translateName = (name) => {
  return translations[name] || name;
};

const renderFamilyTree = (person, parentId = null, level = 0) => {
  const uniqueKey = `${person.name}-${person.lastName}-${parentId}-${level}-${uniqueKeyCounter++}`;

  return (
    <div key={uniqueKey}>
      <div>
        <strong>{person.name} {person.lastName}</strong>
      </div>
      {person.children && person.children.length > 0 && (
        <div style={{ marginLeft: '20px' }}>
          {person.children.map((child) => renderFamilyTree(child, person.id, level + 1))}
        </div>
      )}
    </div>
  );
};

const fetchFamilyTree = async () => {
  try {
    const response = await fetch('http://localhost:5000/api/family-tree');

    if (!response.ok) {
      throw new Error('Server error');
    }

    const data = await response.json(); // Parse JSON if response is valid
    return data;
  } catch (error) {
    console.error('Error fetching family tree:', error.message);
    return [];
  }
};

const formatFamilyTreeData = (person) => {
  const children = person.children && person.children.length > 0
    ? person.children.map(formatFamilyTreeData) // Recursively format children
    : [];

  return {
    name: `${person.name} ${person.lastName}`,
    children: children // Include children for each person
  };
};

const getChildrenOfFather = (fatherId, allPeople) => {
  const father = allPeople.filter(father => father.id === fatherId)[0];  
  return father && father.children ? father.children : [];  
};

const buildTree = (person, allPeople) => {
  if (!person) return null;

  const children = getChildrenOfFather(person.id, allPeople)
    .map(child => buildTree(child, allPeople))
    .filter(Boolean); 

    
    return {
      id: person.id,
      name: translateName(person.name),
      children: children.length > 0 ? children : undefined,
    };
};

const getGenderbyID = async (personID) => {
  const session = driver.session(); // Open a session

  try {
    // Fix the parameter name to match the query variable
    const result = await session.run(
      `MATCH (p:Person) WHERE id(p) = $personId 
      RETURN p.gender AS gender`,
      { personId: personID } // Ensure the key matches the query's parameter
    );
    
    if (result.records.length > 0) {
      const gender = result.records[0].get('gender');
      return gender; // Return the gender value
    } else {
      console.log(`No person found with the ID ${personID}`);
      return null; // Return null when no person is found
    }
  } catch (error) {
    console.error('Error retrieving gender:', error);
    return null; // Return null in case of an error
  } finally {
    await session.close(); // Always close the session after the query
  }
};



const FamilyTree = ({ searchQuery }) => {
  const treeContainerRef = useRef(null);
  const [familyTree, setFamilyTree] = useState(null);
  const [husbandId, setHusbandId] = useState(null);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const nodePositions = useRef({});

  const handleWomanClick = async (person) => {
    const gender = await getGenderbyID(person.id);
    if (gender !== "Female") return;

    try {
      const result = await session.run(
        `
        MATCH (w:Person)-[:WIFE_OF]-(h:Person)
        WHERE id(w) = $womanId
        RETURN id(h) as HusbandID
        LIMIT 1
      `,
        { womanId: person.id }
      );

      if (result.records.length > 0) {
        const husband = result.records[0].get("HusbandID").toNumber();
        const coords = nodePositions.current[husband];
        const container = treeContainerRef.current;

        if (coords && container) {
          const bounds = container.getBoundingClientRect();
          setTranslate({
            x: bounds.width / 2 - coords.x,
            y: bounds.height / 2 - coords.y,
          });
        }

        setHusbandId(husband);
      } else {
        console.log("No husband found for", person.name);
      }
    } catch (error) {
      console.error("Error fetching husband:", error);
    } finally {
      await session.close();
    }
  };

  useEffect(() => {
    const loadFamilyTree = async () => {
      try {
        const people = await fetchFamilyTree();
        if (Array.isArray(people) && people.length > 0) {
          const rootPerson = people.find((p) => p.id === 17); // ROOT
          const treeData = buildTree(rootPerson, people);
          setFamilyTree(treeData);
        } else {
          console.warn("Empty or invalid people data");
        }
      } catch (error) {
        console.error("Error loading family tree:", error);
      }
    };

    loadFamilyTree();
  }, []);

  if (!familyTree) return <div>Loading...</div>;

  return (
    <div
      id="treeWrapper"
      ref={treeContainerRef}
      style={{ width: "100vw", height: "100vh" }}
    >
      <Tree
        data={familyTree}
        orientation="vertical"
        pathFunc="step"
        translate={translate}
        nodeSize={{ x: 100, y: 100 }} // Adjust node size if needed
        separation={{ siblings: 1, nonSiblings: 2 }} // Adjust separation between nodes
        renderCustomNodeElement={({ nodeDatum, hierarchyPointNode }) => {
          const isHusband = nodeDatum.id === husbandId;

          // Record node position
          nodePositions.current[nodeDatum.id] = {
            x: hierarchyPointNode.x,
            y: hierarchyPointNode.y,
          };

          return (
            <g
              onClick={() => handleWomanClick(nodeDatum)}
              style={{ cursor: "pointer" }}
            >
              <title>{nodeDatum.id}</title>
              <rect
                x="-50"
                y="-20"
                width="100"
                height="40"
                fill={isHusband ? "lightgreen" : "#a8e6cf "}
                stroke="black"
                strokeWidth="2"
                rx="8"
              />
              <text
                x="0"
                y="5"
                fontSize="24"
                textAnchor="middle"
                fill="black"
              >
                {nodeDatum.name}
              </text>
            </g>
          );
        }}
      />
    </div>
  );
};

export default FamilyTree;