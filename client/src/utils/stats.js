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
        sum(CASE WHEN n.isAlive = TRUE THEN 1 ELSE 0 END) AS totalAlive,
        sum(CASE WHEN n.isAlive = TRUE AND n.gender = 'Male' THEN 1 ELSE 0 END) AS aliveMen,
        sum(CASE WHEN n.isAlive = TRUE AND n.gender = 'Female' THEN 1 ELSE 0 END) AS aliveWomen
    `);
    const record = result.records[0];
    return {
      totalPopulation: record.get('totalPopulation').toInt(),
      totalAlive: record.get('totalAlive').toInt(),
      aliveMen: record.get('aliveMen').toInt(),
      aliveWomen: record.get('aliveWomen').toInt(),
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
          WHERE p.name <> 'Unknown'
          RETURN p.name AS name, count(*) AS Count
          ORDER BY Count DESC
          LIMIT 1
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
      RETURN n.YoB AS yob
    `);

    const currentYear = new Date().getFullYear();
    const yobs = [];

    result.records.forEach(record => {
      const yobRaw = record.get('yob');
      const yob = typeof yobRaw === 'object' && yobRaw.toNumber
        ? yobRaw.toNumber()
        : parseInt(yobRaw);

      if (!isNaN(yob)) {
        yobs.push(yob);
      }
    });

    if (yobs.length === 0) return { averageAge: "-", medianAge: "-" };

    // Sort YOBs
    yobs.sort((a, b) => a - b);

    // Calculate average and median YOB
    const total = yobs.reduce((sum, yob) => sum + yob, 0);
    const avgYoB = total / yobs.length;

    const mid = Math.floor(yobs.length / 2);
    const medianYoB = yobs.length % 2 === 0
      ? (yobs[mid - 1] + yobs[mid]) / 2
      : yobs[mid];

    const averageAge = Math.round(currentYear - avgYoB);
    const medianAge = Math.round(currentYear - medianYoB);

    return { averageAge, medianAge };
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
      WHERE n.YoB IS NOT NULL AND n.isAlive = TRUE
      WITH n
      ORDER BY n.YoB ASC
      LIMIT 1
      OPTIONAL MATCH (n)<-[:FATHER_OF]-(father:Person)
      OPTIONAL MATCH (father)<-[:FATHER_OF]-(grandfather:Person)
      RETURN
        id(n) AS id,
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
        id: record.get("id") || '',
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
      WHERE n.YoB IS NOT NULL AND n.isAlive = TRUE
      RETURN n.YoB AS yob
    `);

    const currentYear = new Date().getFullYear();
    let count = 0;

    result.records.forEach(record => {
      const yobRaw = record.get('yob');
      const yob = typeof yobRaw === 'object' && yobRaw.toNumber
        ? yobRaw.toNumber()
        : parseInt(yobRaw);

      if (!isNaN(yob)) {
        const age = currentYear - yob;
        if (age > 100) count++;
      }
    });

    return { count };
  } catch (error) {
    console.error("Error fetching oldest person:", error);
    return { count: "خطأ" };
  } finally {
    await session.close();
  }
};


export const getAgeGenderData = async () => {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (n:Person)
      WHERE n.gender IN ['Male', 'Female'] AND n.YoB IS NOT NULL AND n.isAlive = TRUE
      RETURN n.gender AS gender, n.YoB AS yob
    `);

    let maleCount = 0;
    let femaleCount = 0;
    const maleAges = [];
    const femaleAges = [];

    const currentYear = new Date().getFullYear();

    result.records.forEach(record => {
      const gender = record.get('gender');
      const yobRaw = record.get('yob');

      const yob = typeof yobRaw === 'object' && yobRaw.toNumber ? yobRaw.toNumber() : parseInt(yobRaw);
      if (isNaN(yob)) return; // skip if not a number

      const age = currentYear - yob;

      if (gender === 'Male') {
        maleCount++;
        maleAges.push(age);
      } else if (gender === 'Female') {
        femaleCount++;
        femaleAges.push(age);
      }
    });


    return { maleCount, femaleCount, maleAges, femaleAges };

  } catch (error) {
    console.error("Error fetching age/gender data:", error);
    return {
      maleCount: "-", femaleCount: "-",
      maleAges: [], femaleAges: []
    };
  } finally {
    await session.close();
  }
};

export const avgMarringAgeMale = async () => {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (person:Person)-[r:MARRIED_TO]-(spouse:Person)
      WHERE person.gender = 'Male'
        AND person.YoB IS NOT NULL
        AND NOT r.marriageYear IS NULL
      RETURN round(toFloat(SUM(r.marriageYear - person.YoB)) / COUNT(person)) AS avgMarriageAge
    `);

    return result.records[0].get('avgMarriageAge'); // ✅ fixed key name

  } catch (error) {
    console.error("Error calculating average male marriage age:", error);
    return 0;
  } finally {
    await session.close();
  }
};


export const avgMarringAgeFemale = async () => {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (person:Person)-[r:MARRIED_TO]-(spouse:Person)
      WHERE person.gender = 'Female'
        AND person.YoB IS NOT NULL
        AND NOT r.marriageYear IS NULL
      RETURN round(toFloat(SUM(r.marriageYear - person.YoB)) / COUNT(person)) AS avgMarriageAge
    `);
    return result.records[0].get('avgMarriageAge'); // ✅ fixed key
  } catch (error) {
    console.error("Error calculating average female marriage age:", error);
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
        WHERE childrenCount >= 6
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