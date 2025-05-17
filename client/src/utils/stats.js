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

export const getPopulationStats = async () => {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (n:Person)
      RETURN 
        count(n) AS totalPopulation,
        sum(CASE WHEN n.isAlive = true THEN 1 ELSE 0 END) AS totalAlive
    `);
    const record = result.records[0];
    return {
      totalPopulation: record.get('totalPopulation').toInt(),
      totalAlive: record.get('totalAlive').toInt(),
    };
  } catch (error) {
    console.error("Error getting population stats:", error);
    return { totalPopulation: 0, totalAlive: 0 };
  } finally {
    await session.close();
  }
};

export const mostUsedFamilyName = async () => {
    const session = driver.session();
      try {
        const result = await session.run(`
          MATCH (p:Person)
          WHERE p.lastName IS NOT NULL
          RETURN p.lastName AS familyName, count(*) AS Count
          ORDER BY Count DESC
          LIMIT 5
        `);
        return result.records.map(record => ({
          familyName: utils.translateFamilyName(record.get('familyName')),
          occurences: record.get('Count').toNumber()
        }));
      } catch (error) {
        console.error("Error counting population:", error);
        return 0;
      } finally {
        await session.close();
      }
};

export const mostUsedName = async () => {
    const session = driver.session();
      try {
        const result = await session.run(`
          MATCH (p:Person)
          WHERE p.name IS NOT NULL
          RETURN p.name AS name, count(*) AS Count
          ORDER BY Count DESC
          LIMIT 5
        `);
        return result.records.map(record => ({
          name: utils.translateName(record.get('name')),
          occurences: record.get('Count').toNumber()
        }));
      } catch (error) {
        console.error("Error counting population:", error);
        return 0;
      } finally {
        await session.close();
      }
};

export const getAgeStats = async () => {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (n:Person)
      WHERE n.YoB IS NOT NULL

      WITH COLLECT(n.YoB) AS allYOBs, AVG(n.YoB) AS avgYoB

      WITH allYOBs, avgYoB,
           SIZE(allYOBs) AS totalCount,
           CASE
             WHEN SIZE(allYOBs) % 2 = 1 THEN
               allYOBs[TOINTEGER(SIZE(allYOBs) / 2)]
             ELSE
               (allYOBs[TOINTEGER(SIZE(allYOBs) / 2) - 1] + allYOBs[TOINTEGER(SIZE(allYOBs) / 2)]) / 2.0
           END AS medianYoB

      RETURN avgYoB, medianYoB
    `);

    if (result.records.length > 0) {
      const currentYear = new Date().getFullYear();

      const avgYoB = result.records[0].get('avgYoB');
      const medianYoB = result.records[0].get('medianYoB');
      const averageAge = Math.round(currentYear - avgYoB);
      const medianAge = Math.round(currentYear - medianYoB);
        console.log(averageAge, medianAge);

      return { averageAge, medianAge };
    } else {
      return { averageAge: "-", medianAge: "-" };
    }
  } catch (error) {
    console.error("Error fetching age stats:", error);
    return { averageAge: "-", medianAge: "-" };
  } finally {
    await session.close();
  }
};

export const oldestPerson = async () => {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (n:Person)
      WHERE n.YoB IS NOT NULL AND n.isAlive = true
      WITH n
      ORDER BY n.YoB ASC
      LIMIT 1
      OPTIONAL MATCH (n)<-[:FATHER_OF]-(father:Person)
      OPTIONAL MATCH (father)<-[:FATHER_OF]-(grandfather:Person)
      RETURN 
        n.name AS Name, 
        n.lastName AS lastName, 
        n.YoB AS YoB,
        father.name AS fatherName,
        grandfather.name AS grandfatherName,
        n.gender AS gender
    `);

    if (result.records.length > 0) {
      const record = result.records[0];
      const yobRaw = record.get("YoB");
      const yob = parseFloat(yobRaw);
      const age = new Date().getFullYear() - yob;
      return {
        name: record.get("Name") || '',
        lastName: record.get("lastName") || '',
        fatherName: record.get("fatherName") || '',
        grandfatherName: record.get("grandfatherName") || '',
        gender: record.get("gender") || '',
        age,
        
      };
    } else {
      return { name: "غير معروف", lastName: "", fatherName: "", grandfatherName: "", age: "-" };
    }
  } catch (error) {
    console.error("Error fetching oldest person:", error);
    return { name: "خطأ", lastName: "", fatherName: "", grandfatherName: "", age: "-" };
  } finally {
    await session.close();
  }
};

export const youngestPerson = async () => {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (n:Person)
      WHERE n.YoB IS NOT NULL AND n.isAlive = true
      WITH n
      ORDER BY n.YoB DESC
      LIMIT 1
      OPTIONAL MATCH (n)<-[:FATHER_OF]-(father:Person)
      OPTIONAL MATCH (father)<-[:FATHER_OF]-(grandfather:Person)
      RETURN 
        n.name AS Name, 
        n.lastName AS lastName, 
        n.YoB AS YoB,
        father.name AS fatherName,
        grandfather.name AS grandfatherName
    `);

    if (result.records.length > 0) {
      const record = result.records[0];
      const yobRaw = record.get("YoB");
      const yob = parseFloat(yobRaw);
      const age = new Date().getFullYear() - yob;
      return {
        name: record.get("Name") || '',
        lastName: record.get("lastName") || '',
        fatherName: record.get("fatherName") || '',
        grandfatherName: record.get("grandfatherName") || '',
        age
      };
    } else {
      return { name: "غير معروف", lastName: "", fatherName: "", grandfatherName: "", age: "-" };
    }
  } catch (error) {
    console.error("Error fetching oldest person:", error);
    return { name: "خطأ", lastName: "", fatherName: "", grandfatherName: "", age: "-" };
  } finally {
    await session.close();
  }
};

export const averageChildrenPerFamily = async () => {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (f:Person)-[:FATHER_OF]->(c:Person)
      WITH f, count(c) AS num_children
      RETURN avg(num_children) AS average_children
    `);

    if (result.records.length > 0) {
      const average_children = result.records[0].get('average_children');  // Extract the value
      return parseFloat(average_children.toFixed(2));
    } else {
      return null;  // Return null if no result is found
    }
  } catch (error) {
    console.error("Error fetching average number of children:", error);
    return null;  // Return null in case of an error
  } finally {
    await session.close();
  }
};

export const biggestFamily = async () =>{
  const session = driver.session();
    try {
      const result = await session.run(`
        MATCH (father:Person)-[:FATHER_OF]->(child:Person)
        WITH father, COUNT(child) AS childrenCount
        ORDER BY childrenCount DESC
        LIMIT 1
        RETURN father.name AS FatherName, father.lastName AS FatherLastName, childrenCount

      `);
  
      if (result.records.length > 0) {
        const fatherName = result.records[0].get('FatherName');
        const FatherLastName = result.records[0].get('FatherLastName');
        const childrenCount = result.records[0].get('childrenCount').toNumber();

        return { fatherName, FatherLastName, childrenCount};
      } else {
        return { fatherName:"-", FatherLastName:"-", childrenCount : -1 };
      }
    } catch (error) {
      console.error("Error fetching average age:", error);
      return { fatherName: "-", FatherLastName:"-", childrenCount : "-"};
    } finally {
      await session.close();
    }
};

export const topAbroadCountry = async () =>{
  const session = driver.session();
    try {
      const result = await session.run(`
        MATCH (p:Person)
        WHERE p.WorkCountry IS NOT NULL
        RETURN COUNT(p) AS abroadPeople, p.WorkCountry
        LIMIT 1
      `);
  
      if (result.records.length > 0) {
        const countryCount = result.records[0].get('abroadPeople').toNumber();
        const countryName = result.records[0].get('p.WorkCountry');

        return { countryCount, countryName};
      } else {
        return { countryCount:"-", countryName:"-"};
      }
    } catch (error) {
      console.error("Error fetching average age:", error);
      return { countryCount: "-", countryName:"-"};
    } finally {
      await session.close();
    }
};

export const agedPersonCount = async () => {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (n:Person)
      WHERE n.YoB IS NOT NULL AND n.isAlive = true
      WITH n, (date().year - n.YoB) AS age
      WHERE age > 100
      RETURN COUNT(n) as agedPeopleCount
    `);

    if (result.records.length > 0) {
      const record = result.records[0];
      return {
        count: record.get("agedPeopleCount").toNumber(),
      };
    } else {
      return { count : -1};
    }
  } catch (error) {
    console.error("Error fetching oldest person:", error);
    return { count: "خطأ"};
  } finally {
    await session.close();
  }
};

export const SexCount = async () => {
    const session = driver.session();
    try {
      const resultM = await session.run(`
        MATCH (n:Person)
        WHERE n.gender = 'Male'
        RETURN COUNT(n) AS MaleCount
      `);
      const resultF = await session.run(`
        MATCH (n:Person)
        WHERE n.gender = 'Female'
        RETURN COUNT(n) AS FemaleCount
      `);
  
      if (resultM.records.length > 0 && resultF.records.length > 0) {
        const maleCount = resultM.records[0].get('MaleCount').toNumber(); // ensure it's a number
        const femaleCount = resultF.records[0].get('FemaleCount').toNumber(); // ensure it's a number
        return { maleCount, femaleCount };
      } else {
        return { maleCount: "-", femaleCount: "-" };
      }
    } catch (error) {
      console.error("Error fetching gender counts:", error);
      return { maleCount: "-", femaleCount: "-" };
    } finally {
      await session.close();
    }
};

export const unmariedMales = async () => {
  const session = driver.session();
    try {
      const result = await session.run(`
       MATCH (p:Person)
      WHERE p.gender = 'Male' 
        AND p.YoB IS NOT NULL 
        AND (2025 - p.YoB) > 35 
        AND NOT EXISTS((p)-[:HUSBAND_OF]->()) // Check if there are no marriage relations
      RETURN COUNT(p) AS unmarriedMenOver35
      `);
      return result.records[0].get('unmarriedMenOver35').toNumber();
    } catch (error) {
      console.error("Error counting population:", error);
      return 0;
    } finally {
      await session.close();
    }
};

export const avgMarringAgeMale = async () => {
  const session = driver.session();
    try {
      const result = await session.run(`
        MATCH (p:Person)
        WHERE p.gender = 'Male' 
        AND p.YoB IS NOT NULL AND p.YoM IS NOT NULL
        RETURN SUM(p.YoM - p.YoB)/COUNT(p) AS avgMarringAge
      `);
      return ((result.records[0].get('avgMarringAge')))
      
    } catch (error) {
      console.error("Error counting population:", error);
      return 0;
    } finally {
      await session.close();
    }
};

export const avgMarringAgeFemale = async () => {
  const session = driver.session();
    try {
      const result = await session.run(`
        MATCH (p:Person)
        WHERE p.gender = 'Female' 
        AND p.YoB IS NOT NULL AND p.YoM IS NOT NULL
        RETURN SUM(p.YoM - p.YoB)/COUNT(p) AS avgMarringAge
      `);
      return result.records[0].get('avgMarringAge');
    } catch (error) {
      console.error("Error counting population:", error);
      return 0;
    } finally {
      await session.close();
    }
};

export const families6pluschildren = async () => {
  const session = driver.session();
    try {
      const result = await session.run(`
        MATCH (f:Person)-[:FATHER_OF]->(c:Person)
        WITH f, count(c) AS childrenCount
        WHERE childrenCount >= 3
        RETURN count(f) AS familiesWith6PlusChildren
      `);
  
      if (result.records.length > 0) {
        return  result.records[0].get('familiesWith6PlusChildren').toNumber() ;
      } else {
        return { count:"-"};
      }
    } catch (error) {
      console.error("Error fetching average age:", error);
      return { count: "-"};
    } finally {
      await session.close();
    }
};

export const livingAbroad = async () => {
  const session = driver.session();
    try {
      const result = await session.run(`
        MATCH (p:Person)
        WHERE p.WorkCountry IS NOT NULL
        RETURN COUNT(p) AS abroadPeople
      `);
      return result.records[0].get('abroadPeople').toNumber();
    } catch (error) {
      console.error("Error counting population:", error);
      return 0;
    } finally {
      await session.close();
    }
};

export const familiesNumber = async () => {
  const session = driver.session();
    try {
      const result = await session.run(`
        MATCH (h:Person)-[:HUSBAND_OF]->(w:Person)
        RETURN COUNT(DISTINCT h) AS totalFamilies
      `);
      return result.records[0].get('totalFamilies').toNumber();
    } catch (error) {
      console.error("Error counting families:", error);
      return 0;
    } finally {
      await session.close();
    }
}

export const getAllYearsOfMarriage = async () => {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (p:Person)-[r:MARRIED_TO]->(s:Person)
      WHERE r.marriageYear IS NOT NULL
      RETURN r.marriageYear AS year
      ORDER BY year
    `);

    const years = result.records.map(record => record.get('year'));
    return years;
  } catch (error) {
    console.error('Error fetching Years of Marriage:', error);
    return [];
  } finally {
    await session.close();
  }
};