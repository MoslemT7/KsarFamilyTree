// controllers/familyTreeController.js
const neo4j = require('neo4j-driver');

// Initialize the Neo4j driver
const driver = neo4j.driver(
  'neo4j+s://2cd0ce39.databases.neo4j.io',  // Neo4j URI
  neo4j.auth.basic('neo4j', 'nW1azrzTK-lrTOO5G1uOkUVFwelcQlEmKPHggPUB7xQ')  // Neo4j auth
);


const getFamilyTree = async (req, res) => {
  const session = driver.session();
  try {
    const query = `
      MATCH (root:Person)
      WHERE id(root) = 17
      CALL {
        WITH root
        MATCH (root)-[:FATHER_OF*]->(descendant)
        RETURN collect(DISTINCT descendant) AS allDescendants
      }
      WITH root, allDescendants
      UNWIND [root] + allDescendants AS person
      OPTIONAL MATCH (person)-[:FATHER_OF]->(child)
      WITH person, collect(child) AS children
      RETURN {
        id: id(person),
        name: person.name,
        lastName: person.lastName,
        children: [child IN children | {
          id: id(child),
          name: child.name,
          lastName: child.lastName
        }]
      } AS treeNode
    `;

    const result = await session.run(query);
    const familyTree = result.records.map(record => {
        const node = record.get('treeNode');
        return {
          id: Number(node.id),
          name: node.name,
          lastName: node.lastName,
          children: node.children.map(child => ({
            id: Number(child.id),
            name: child.name,
            lastName: child.lastName
          }))
        };
      });
      

    res.json(familyTree);  // Send the family tree data to the frontend
  } catch (error) {
    console.error('Error fetching family tree:', error);
    res.status(500).send('Server error');
  } finally {
    session.close(); // Close the session to avoid resource leaks
  }
};

module.exports = { getFamilyTree };
