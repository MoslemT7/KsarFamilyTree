// src/utils/CypherUtils.js

export const formatName = (input) =>
  input
    .trim()
    .toLowerCase()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

export const formatFullName = (input) => {
  return input
    .trim()
    .split(' ')
    .map(part => formatName(part))
    .join(' ');
};

export const createPersonQuery = ({
  name,
  lastName,
  gender,
  isAlive,
  YoB,
  YoD,
  WorkCountry
}) => {
  const props = {
    name: formatName(name),
    lastName: formatName(lastName),
    gender: formatName(gender),
    isAlive: !!isAlive
  };

  if (YoB && !isNaN(YoB)) props.YoB = parseInt(YoB);
  if (YoD && !isNaN(YoD)) props.YoD = parseInt(YoD);
  if (WorkCountry) props.WorkCountry = formatName(WorkCountry);

  const cypherFields = Object.keys(props).map(k => `${k}: $${k}`).join(', ');

  const query = `CREATE (person:Person {${cypherFields}}) RETURN person`;

  return { query, params: props };
};

export const createParentChildRelationshipQuery = (parentId, childId, relationshipLabel) => {
  const query = `
    MATCH (parent:Person), (child:Person)
    WHERE id(parent) = $parentId AND id(child) = $childId
    MERGE (parent)-[:${relationshipLabel}]->(child)
    RETURN parent.name AS parentName, child.name AS childName
  `;
  return { query, params: { parentId, childId } };
};

export const createMarriageQuery = (maleId, femaleId, marriageYear = null, status, endYear = null) => {
  const query = `
    MATCH (husband:Person), (wife:Person)
    WHERE id(husband) = $maleId AND id(wife) = $femaleId
    MERGE (husband)-[r:MARRIED_TO]-(wife)
    SET 
      ${marriageYear !== null ? 'r.marriageYear = $marriageYear,' : ''}
      r.status = $status
      ${endYear !== null ? ', r.endYear = $endYear' : ''}
    RETURN husband.name AS husband, wife.name AS wife
  `;
  const params = {
    maleId,
    femaleId,
    ...(marriageYear !== null ? { marriageYear } : {}),
    status,
    ...(endYear !== null ? { endYear } : {})
  };
  return { query, params };
};

export const getPeopleWithSameNameQuery = (name, lastName) => {
  const query = `
    MATCH (p:Person {name: $name, lastName: $lastName})
    OPTIONAL MATCH (father:Person)-[:FATHER_OF]->(p)
    OPTIONAL MATCH (grandfather:Person)-[:FATHER_OF]->(father)
    RETURN id(p) AS personId, 
           p.name AS personName, p.lastName AS lastName,
           father.name AS fatherName, 
           grandfather.name AS grandfatherName
  `;
  const params = { name, lastName };
  return { query, params };
};
