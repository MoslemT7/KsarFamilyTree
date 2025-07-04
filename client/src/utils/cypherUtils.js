import neo4j from 'neo4j-driver';
import * as utils from '../utils/utils';
import * as statistics from '../utils/stats';

const neo4jURI = process.env.REACT_APP_NEO4J_URI;
const neo4jUser = process.env.REACT_APP_NEO4J_USER;
const neo4jPassword = process.env.REACT_APP_NEO4J_PASSWORD;

const driver = require('neo4j-driver').driver(
    neo4jURI,
    require('neo4j-driver').auth.basic(neo4jUser, neo4jPassword)
);

export async function getFormattedLineage(personID) {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH paths = (p:Person)<-[:FATHER_OF*]-(ancestor:Person)
      WHERE id(p) = $personID
      WITH paths
      ORDER BY length(paths) DESC
      LIMIT 1
      WITH nodes(paths) AS lineage, p
      RETURN [n IN reverse(lineage) | n.name] + p.name AS lineageNames
    `, { personID: neo4j.int(personID) });

    const lineageNames = result.records[0]?.get('lineageNames') || [];

    // Join names using " بن "
    const formatted = lineageNames.join(' بن ');
    return formatted;

  } catch (error) {
    console.error('Error fetching lineage:', error);
    return null;
  } finally {
    await session.close();
  }
}
