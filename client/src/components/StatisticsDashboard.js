import { useEffect, useState } from 'react';
import React, { useRef } from 'react';
import './StatisticsDashboard.css';
import Chart from 'chart.js/dist/chart.js';

const translations = require('./translation.json');
require('dotenv').config();


const neo4jURI = process.env.REACT_APP_NEO4J_URI;
const neo4jUser = process.env.REACT_APP_NEO4J_USER;
const neo4jPassword = process.env.REACT_APP_NEO4J_PASSWORD;

const driver = require('neo4j-driver').driver(
    neo4jURI,
    require('neo4j-driver').auth.basic(neo4jUser, neo4jPassword)
);
const totalPopulation = async () => {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (n:Person)
      RETURN count(n) AS total
    `);
    return result.records[0].get('total').toInt();
  } catch (error) {
    console.error("Error counting population:", error);
    return 0;
  } finally {
    await session.close();
  }
};

const averageChildrenPerFamily = async () => {
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
}

const oldestPerson = async () => {
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

const youngestPerson = async () => {
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

const biggestFamily = async () =>{
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

const topAbroadCountry = async () =>{
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

const averageAge = async () => {
    const session = driver.session();
    try {
      const result = await session.run(`
        MATCH (n:Person)
        WHERE n.YoB IS NOT NULL
        RETURN AVG(n.YoB) AS averageYoB
      `);
  
      if (result.records.length > 0) {
        const avgYoB = result.records[0].get('averageYoB');
        const currentYear = new Date().getFullYear();
        const averageAge = Math.round(currentYear - avgYoB);
        return { averageAge };
      } else {
        return { averageAge: "-" };
      }
    } catch (error) {
      console.error("Error fetching average age:", error);
      return { averageAge: "-" };
    } finally {
      await session.close();
    }
};

const medianAge = async () => {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (n:Person)
      WHERE n.YoB IS NOT NULL AND n.isAlive = true
      WITH COLLECT(n.YoB) AS ages
      WITH 
        ages, 
        SIZE(ages) AS totalCount, 
        CASE
          WHEN SIZE(ages) % 2 = 1 THEN
            ages[(SIZE(ages) / 2)]
          ELSE
            (ages[(SIZE(ages) / 2) - 1] + ages[SIZE(ages) / 2]) / 2.0
        END AS medianAge
      RETURN medianAge
    `);

    if (result.records.length > 0) {
      const avgYoB = result.records[0].get('medianAge');
      const currentYear = new Date().getFullYear();
      const medianAge = Math.round(currentYear - avgYoB);
      return { medianAge };
    } else {
      return { medianAge: "-" };
    }
  } catch (error) {
    console.error("Error fetching average age:", error);
    return { medianAge: "-" };
  } finally {
    await session.close();
  }
};

const agedPersonCount = async () => {
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

const SexCount = async () => {
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

export const translateName = (fullName, language = true) => {
  const nameParts = fullName.split(' ');

const reverseTranslations = Object.fromEntries(
  Object.entries(translations).map(([key, value]) => [value, key])
);

  const dict = language ? translations : reverseTranslations;

  const translatedParts = nameParts.map(part => dict[part] || part);

  return translatedParts.join(' ');
};

const totalAlivePopulation = async () => {
    const session = driver.session();
    try {
      const result = await session.run(`
        MATCH (n:Person)
        WHERE n.isAlive = True
        RETURN count(n) AS total
      `);
      return result.records[0].get('total').toNumber();
    } catch (error) {
      console.error("Error counting population:", error);
      return 0;
    } finally {
      await session.close();
    }
};

const mostUsedFamilyName = async () => {
  const session = driver.session();
    try {
      const result = await session.run(`
        MATCH (p:Person)
        WHERE p.name IS NOT NULL
        RETURN p.lastName AS lastName, count(*) AS occurrences
        ORDER BY occurrences DESC
        LIMIT 5
      `);
      return {familyName: result.records[0].get('lastName'), 
              occurences: (result.records[0].get('occurrences').toNumber())
      };
    } catch (error) {
      console.error("Error counting population:", error);
      return 0;
    } finally {
      await session.close();
    }
};

const unmariedMales = async () => {
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

const avgMarringAgeMale = async () => {
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

const avgMarringAgeFemale = async () => {
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

const families6pluschildren = async () => {
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

const livingAbroad = async () => {
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

const familiesNumber = async () => {
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
const StatisticsDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ageDistribution, setAgeDistribution] = useState([]);
  const [cumulativePopulationGrowth, setpopulationGrowth] = useState([]);
  const [weddingData, setWeddingData] = useState([]);
  const [topFamiliesData, setTopFamilies] = useState([]);

  const weddingYears = [
    2016, 2003, 2014, 2022, 2019, 2012, 2017, 2024, 2024, 2021, 2025,
    2024, 2024, 2024, 2023, 2023, 2023, 2023, 2023, 2022, 2022, 2022,
    2023, 2022, 2021, 2020, 2019, 2023, 2022, 2023, 2021, 2021, 2023,
    2022, 2022, 2022, 2023, 2021, 2021, 2021, 2021, 2021, 2022, 2021,
  ];
  const topFamilies = [
    { family: 'البوبكري', count: 320 },
    { family: 'اللقماني', count: 275 },
    { family: 'الفرحاتي', count: 240 },
    { family: 'السقراطي', count: 215 },
    { family: 'الرحموني', count: 198 }
  ];
  
  const ageDistributionChartRef = useRef(null);
  const genderRatioChartRef = useRef(null);
  const weddingChartRef = useRef(null);
  const cumulativePopulationGrowthRef = useRef(null);
  const topFamiliesRef = useRef(null);

  let ageDistributionChartInstance = useRef(null);
  let genderRatioChartInstance = useRef(null);
  let weddingChartInstance = useRef(null);
  let cumulativePopulationGrowthInstance = useRef(null);
  let topFamiliesInstance = useRef(null);

  const ageBins = async () => {
    const session = driver.session();
    try {
      // Run the Cypher query
      const result = await session.run(`
        WITH date().year AS currentYear
        MATCH (p:Person)
        WHERE p.YoB IS NOT NULL AND p.isAlive = true
        WITH currentYear - p.YoB AS age
        WITH CASE
          WHEN age < 3 THEN '0-2'
          WHEN age < 19 THEN '13-18'
          WHEN age < 30 THEN '19-29'
          WHEN age < 13 THEN '3-12'

          WHEN age < 45 THEN '30-44'
          WHEN age < 60 THEN '45-59'
          WHEN age < 70 THEN '60-69'
          WHEN age < 80 THEN '70-79'
          ELSE '80+'
        END AS ageBin
        RETURN ageBin, count(*) AS count
        ORDER BY ageBin
      `);
  
      const ageDistribution = result.records.map(record => ({
        ageBin: record.get('ageBin'),
        count: record.get('count').toNumber(),
      }));
      return ageDistribution;
    } catch (error) {
      console.error('Error running the query:', error);
    } finally {
      await session.close();
    }
  };

  const populationGrowth = async () => {
    const session = driver.session();
    try {
      // Run the Cypher query
      const result = await session.run(`
        WITH range(1900, 2025) AS years
        UNWIND years AS year
        MATCH (p:Person)
        WHERE p.YoB <= year
        WITH year, 
            count(p) AS cumulativePopulation,
            count(CASE 
              WHEN (p.YoD IS NULL OR toInteger(p.YoD) >= year) THEN p 
              END) AS alivePopulation
        RETURN year, cumulativePopulation, alivePopulation
        ORDER BY year
      `);
  
      const ageDistribution = result.records.map(record => ({
        year: record.get('year').toNumber(),
        cumulativePopulation: record.get('cumulativePopulation').toNumber(),
        alivePopulation: record.get('alivePopulation').toNumber(),
      }));
      return ageDistribution;
    } catch (error) {
      console.error('Error running the query:', error);
    } finally {
      await session.close();
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const total = await totalPopulation();
        const totalAlive = await totalAlivePopulation();
        const totalDead = (total-totalAlive).toFixed(1);
        const oldest = await oldestPerson();
        const youngest = await youngestPerson();
      
        const avgAge = await averageAge();
        const medAge = await medianAge();
        const avgChild = await averageChildrenPerFamily();
        const nbrOfAgedPeople = await agedPersonCount();
        const biggestFamilyCount = await biggestFamily();
        const abroadPeoplePercentage = ((await livingAbroad()) * 100 / totalAlive).toFixed(2);
        const topAbroadCountryCount = await topAbroadCountry();

        const avgMarAgeMale = (await avgMarringAgeMale()).toFixed(0);
        const avgMarAgeFemale = (await avgMarringAgeFemale()).toFixed(0);
        const sixPlusFamilies = await families6pluschildren();

        const unmariedMalesCount = await unmariedMales();
        const mostUsedFamilyNameCount = await mostUsedFamilyName();
        const { maleCount, femaleCount } = await SexCount();
        const fetchedAgeDistribution = await ageBins();
        const fetchedCumGrowth = await populationGrowth();
        const familiesCount = await familiesNumber();
        setStats({
          totalPopulation: total,
          totalAlivePopulation: totalAlive,
          totalMen: maleCount,
          deadPopulation: totalDead,
          totalWomen: femaleCount,
          averageAge: avgAge.averageAge,
          medianAge: medAge.medianAge,
          agedPeopleCount: nbrOfAgedPeople.count,
          oldestPerson: oldest,
          youngestPerson: youngest,
          biggestFamily: biggestFamilyCount,
          mostUsedFamilyNameCount,
          unmariedMalesCount,
          abroadPeoplePercentage,
          avgMarAgeMale,
          avgMarAgeFemale,
          topAbroadCountryCount,
          sixPlusFamilies: sixPlusFamilies,
          averageChildrenPerFamily: avgChild,
          familiesCount
        });
        setAgeDistribution(fetchedAgeDistribution);
        setpopulationGrowth(fetchedCumGrowth);
        setWeddingData(weddingYears);
        setTopFamilies(topFamilies);

      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
  }, []);

  // AGE DISTRIBUTION DATA
  useEffect(() => {
    if (!ageDistributionChartRef.current || ageDistribution.length === 0) return;

    // Destroy previous chart if it exists
    if (ageDistributionChartInstance.current) {
      ageDistributionChartInstance.current.destroy();
    }

    const ctx = ageDistributionChartRef.current.getContext('2d');

    // Create a new chart instance
    ageDistributionChartInstance.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ageDistribution.map((item) => item.ageBin),
        datasets: [
          {
            label: 'Age Distribution',
            data: ageDistribution.map((item) => item.count),
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Population',
            },
          },
          x: {
            title: {
              display: true,
              text: 'Age Distribution',
            },
          }
        },
      },
    });

    return () => {
      ageDistributionChartInstance.current?.destroy(); // Clean up chart instance when the component unmounts or updates
    };
  }, [ageDistribution]);

  // GENDER DISTRIBUTION DATA
  useEffect(() => {
    if (!stats || !stats.totalMen || !stats.totalWomen) return;

    const ctx = genderRatioChartRef.current.getContext('2d');

    // Destroy previous chart if it exists
    if (genderRatioChartInstance.current) {
      genderRatioChartInstance.current.destroy();
    }

    // Create a new chart instance for Gender Ratio
    genderRatioChartInstance.current = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Male', 'Female'],
        datasets: [
          {
            data: [stats.totalMen, stats.totalWomen],
            backgroundColor: ['#36A2EB', '#FF6384'],
            hoverBackgroundColor: ['#5DADE2', '#FF8F9E'],
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: function (tooltipItem) {
                return ' people' + tooltipItem.raw;
              },
            },
          },
          legend: {
            position: 'bottom',
          },
        },
      },
    });

    return () => {
      genderRatioChartInstance.current?.destroy(); // Clean up chart instance when the component unmounts or updates
    };
  }, [stats]);

  // POPULATION GROWTH:
  useEffect(() => {
    if (!cumulativePopulationGrowthRef.current || cumulativePopulationGrowth.length === 0) return;
  
    const ctx = cumulativePopulationGrowthRef.current.getContext('2d');
  
    // Destroy previous chart if it exists
    if (cumulativePopulationGrowthInstance.current) {
      cumulativePopulationGrowthInstance.current.destroy();
    }
  
    // Prepare labels and datasets for both populations
    const labels = cumulativePopulationGrowth.map(item => item.year);
    const cumulativeValues = cumulativePopulationGrowth.map(item => item.cumulativePopulation);
    const aliveValues = cumulativePopulationGrowth.map(item => item.alivePopulation);  // Assuming you added alivePopulation to your data
    // Create line chart
    cumulativePopulationGrowthInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Cumulative Population',
            data: cumulativeValues,
            borderColor: '#36A2EB', // Blue color for cumulative population
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            fill: true,
            tension: 0.4,
            pointRadius: 3,
          },
          {
            label: 'Alive Population',
            data: aliveValues,
            borderColor: '#FF6384', // Red color for alive population
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            fill: true,
            tension: 0.4,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: function (tooltipItem) {
                return tooltipItem.raw + ' people';
              },
            },
          },
          legend: {
            position: 'bottom',
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Year',
            },
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Population',
            },
          },
        },
      },
    });
  
    return () => {
      cumulativePopulationGrowthInstance.current?.destroy();
    };
  }, [cumulativePopulationGrowth]);

  useEffect(() => {
    if (!weddingChartRef.current || weddingData.length === 0) return;

  // Destroy previous chart if it exists
  if (weddingChartInstance.current) {
    weddingChartInstance.current.destroy();
  }
    // Count the occurrences of each year in the wedding data
    const countOccurrences = (data) => {
      const counts = {};
      data.forEach(year => {
        counts[year] = (counts[year] || 0) + 1;
      });
      return counts;
    };

    const weddingCount = countOccurrences(weddingData);
    // Convert the object to arrays for labels and data
    const labels = Object.keys(weddingCount);
    const data = Object.values(weddingCount);

    // Destroy previous chart if it exists
    if (weddingChartInstance.current) {
      weddingChartInstance.current.destroy();
    }

    // Create a new chart instance
    const ctx = weddingChartRef.current.getContext('2d');
    
    weddingChartInstance.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'عدد حفلات الزواج حسب السنة',
            data: data,
            backgroundColor: 'rgba(54, 162, 235, 0.6)', // Blue color
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            font: {
              size: 20,
            },
          },
          tooltip: {
            callbacks: {
              label: (tooltipItem) => {
                return `${tooltipItem.raw} حفلة زواج`;
              },
            },
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'السنة',
            },
          },
          y: {
            title: {
              display: true,
              text: 'عدد الحفلات',
            },
            beginAtZero: true,
          },
        },
      },
    });

    return () => {
      weddingChartInstance.current?.destroy(); // Clean up chart instance when the component unmounts or updates
    };
  }, [weddingData]); // Trigger the effect when weddingData changes

  useEffect(() => {
    if (!topFamiliesRef.current || topFamiliesData.length === 0) return;

    if (topFamiliesInstance.current) {
      topFamiliesInstance.current.destroy();
    }

    const ctx = topFamiliesRef.current.getContext('2d');

    topFamiliesInstance.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: topFamiliesData.map(f => f.family),
        datasets: [{
          label: 'عدد الأفراد في العائلة',
          data: topFamiliesData.map(f => f.count),
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        indexAxis : 'y',
        plugins: {
          title: {
            display: true,
            text: 'أكثر 5 عائلات عددًا في قصر أولاد بوبكر'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'اللقب'
            }
          },
          x: {
            title: {
              display: true,
              text: "عدد الأشخاص الحاملين لـاللقب"
            }
          }
        }
      }
    });


    return () => {
      topFamiliesInstance.current?.destroy(); // Clean up chart instance when the component unmounts or updates
    };

  }, [topFamilies]);

  if (loading) return <p className="loading-text">جاري تحميل الإحصائيات...</p>;
  if (!stats) return <p>تعذر تحميل البيانات.</p>;

  return (
    <div className="stats-dashboard">
      <section className="statistics-dashboard">

        <h2 class="dashboard-title">لوحة الإحصائيات العامة</h2>

        <div class="category-block population-overview">
          <h3 class="category-title">نظرة عامة على السكان</h3>
          <div class="stats-grid">
            <div class="stat-card"> <h4>إجمالي عدد الأفراد</h4> <p class="stat-number">{stats.totalPopulation}</p> </div>
            <div class="stat-card"> <h4>عدد الأحياء</h4> <p class="stat-number">{stats.totalAlivePopulation}</p> </div>
            <div class="stat-card" id="men"> <h4>عدد الرجال الأحياء</h4> <p class="stat-number">{stats.totalMen}</p> </div>
            <div class="stat-card" id="women"> <h4>عدد النساء الأحياء</h4> <p class="stat-number">{stats.totalWomen}</p> </div>
            <div class="stat-card"> <h4>عدد العائلات المسجلة</h4> <p class="stat-number">{stats.familiesCount}</p> </div>
            <div class="stat-card"> <h4>نسبة الأحياء مقابل المتوفين</h4> <p class="stat-number">{stats.totalAlivePopulation * 100 / stats.totalPopulation}% أحياء</p> </div>
          </div>
        </div>

        <div class="category-block demographics">
          <h3 class="category-title">العمر والديموغرافيا</h3>
          <div class="stats-grid">
          <div className="stat-card">
            <h4>أكبر فرد</h4>
            <p className="stat-number">
              {translateName(stats.oldestPerson.name || '')}{" "}
              {translateName(stats.oldestPerson.lastName || '')} بن{" "} 
              {translateName(stats.oldestPerson.fatherName || '')} بن{" "}
              {translateName(stats.oldestPerson.grandfatherName || '')}
            </p>
            <p className="stat-note">
              {stats.oldestPerson.age} سنة
            </p>
          </div>
            <div class="stat-card"> 
              <h4>أكبر فرد</h4>
              <p className="stat-number">
                {translateName(stats.youngestPerson.name || '')}{" "}
                {translateName(stats.youngestPerson.lastName || '')} بن{" "} 
                {translateName(stats.youngestPerson.fatherName || '')} بن{" "}
                {translateName(stats.youngestPerson.grandfatherName || '')}
              </p>
              <p className="stat-note">
                {stats.youngestPerson.age} سنة
              </p>
            </div>
            <div class="stat-card"> <h4>متوسط الأعمار</h4> <p class="stat-number">{stats.averageAge} سنة</p> </div>
            <div class="stat-card"> <h4>الوسيط العمري</h4> <p class="stat-number">{stats.medianAge} سنة</p> </div>
            <div class="stat-card"> <h4>عدد المعمرين (+100 سنة)</h4> <p class="stat-number">{stats.agedPeopleCount}</p> </div>
          </div>
        </div>

        <div class="category-block family-structure">
          <h3 class="category-title">بنية العائلة</h3>
          <div class="stats-grid">
            <div class="stat-card"> <h4>متوسط عدد الأطفال لكل عائلة</h4> <p class="stat-number">{stats.averageChildrenPerFamily}</p> </div>
            <div class="stat-card"> <h4>أكبر عائلة من حيث الأبناء</h4> <p class="stat-number"> عائلة {translateName(stats.biggestFamily.fatherName)} {translateName(stats.biggestFamily.FatherLastName)}  </p>
            <p className="stat-note"> {stats.biggestFamily.childrenCount} أبناء </p>  </div>
            <div class="stat-card"> <h4>عدد العائلات بـ 6 أطفال أو أكثر</h4> <p class="stat-number">{stats.sixPlusFamilies}</p> </div>
            <div class="stat-card average-marriage-card">
              <h4>متوسط عمر الزواج</h4>
              <div class="marriage-averages">
                <div class="average-item men">
                  <span class="label">الرجال:</span>
                  <span class="value">{stats.avgMarAgeMale}</span>
                </div>
                <div class="average-item women">
                  <span class="label">النساء:</span>
                  <span class="value">{stats.avgMarAgeFemale}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        </section>


      <h1 class="dashboard-title">عرض البيانات الرسومي</h1>
      <div className="charts">
        <div className="row">
        <div className="chart-container">
            <h3>توزيع الفئات العمرية</h3>
            <canvas id="ageChart" ref={ageDistributionChartRef}></canvas>
          </div>
          <div className="chart-container">
            <h3>الرجال VS النساء</h3>
            <canvas id="genderChart" ref={genderRatioChartRef}></canvas>
          </div>
        
        </div>

        <div className="chart-container full-width">
          <h3>تطور عدد السكان</h3>
          <canvas id="cumulativeGrowth" ref={cumulativePopulationGrowthRef}></canvas>
        </div>

        <div className="row">
          <div className="chart-container">
            <h3>أكثر الألقاب إستعمالاً</h3>
            <canvas id="topFamilyName" ref={topFamiliesRef}></canvas>
          </div>

          <div className="chart-container">
            <h3>عدد الأعراس في كل سنة</h3>
            <canvas id="weddingCount" ref={weddingChartRef}></canvas>
          </div>
        </div>
      </div>

      <div id="funFacts">
      <h1 class="dashboard-title">هل تعلم؟ </h1>
      <div class="fun-facts-container">
        <div class="fun-fact">
          <h2 class="fun-chart">58</h2>
          <p>58 شخص، يحملون اسم <strong>محمد</strong> كأكثر اسم مستعمل، ويمثل <strong>18٪</strong> من السكان.</p>
        </div>
        <div class="fun-fact">
          <h2 class="fun-chart">{stats.mostUsedFamilyNameCount.occurences}</h2>
          <p>{stats.mostUsedFamilyNameCount.occurences} شخص، يحملون لقب <strong>{translateName(stats.mostUsedFamilyNameCount.familyName)}</strong>   كأكثر لقب شائع، ويمثل  
             <strong>{(((stats.mostUsedFamilyNameCount.occurences))*100/stats.totalPopulation).toFixed(1)}% </strong> من السكان.</p>
        </div>
        <div class="fun-fact">
          <h2 class="fun-chart">{stats.unmariedMalesCount}</h2>
          <p>
          <strong>{stats.unmariedMalesCount}</strong> شاب تجاوزوا الـ<strong>35</strong> عاما ليسوا متزوجين
          </p>
        </div>
        <div class="fun-fact">
          <h2 class="fun-chart">{stats.abroadPeoplePercentage}%</h2>
          <p>
          حوالي <strong>{stats.abroadPeoplePercentage}%</strong> من أبناء قصر أولاد بوبكر يعيشون خارج البلدة، سواء في مدن تونسية أخرى أو في الخارج.
          </p>
        </div>
        <div class="fun-fact">
          <h2 class="fun-chart">{stats.topAbroadCountryCount.countryCount}</h2>
          <p>
          يُقيم <strong>{stats.topAbroadCountryCount.countryCount}</strong> شخصًا من أبناء قصر أولاد بوبكر في <strong>{stats.topAbroadCountryCount.countryName}</strong>، مما يجعلها الوجهة الأجنبية الأكثر استقطابًا لأبناء البلدة في المهجر.
          </p>
        </div>
        <br>
        </br>
        <div class="fun-fact">
          <h2 class="fun-chart">142</h2>
          <p>
          يبلغ عدد تلاميذ المدرسة الابتدائية في قصر أولاد بوبكر حوالي <strong>142</strong> تلميذ، مما يشكل نسبة كبيرة من الأطفال في البلدة.
          </p>
        </div>
        <div class="fun-fact">
          <h2 class="fun-chart">11</h2>
          <p>
          تمتد شجرة العائلة من الجيل الأول حتى الجيل <strong>الحادي عشر</strong>، أي أن هناك <strong>11 جيلاً</strong> متتالياً تربط بين الجد الأول وأبعد حفيد مسجَّل في قصر أولاد بوبكر.      </p>
        </div>
        </div>
        <br></br>
        <div class="data-completeness-container">
          <div class="data-completeness-card">
            <h2>نسبة إكتمال البيانات لجميع أفراد الشجرة</h2>
            <div class="content-wrapper">
              <div class="percentage">
                <span className='percentageText'>{stats.totalAlivePopulation * 100 / 3000}%</span>
                <div class="progress-bar">
                <div className="progress" style={{ width: `${stats.totalAlivePopulation * 100 / 3000}%` }}></div>
                </div>
              </div>
              <div class="data-completeness-content">
                <p>التقدير الحالي يُظهر أننا غطّينا حوالي <strong>{stats.totalAlivePopulation * 100 / 3000}%</strong> من جميع أفراد الشجرة العائلية، بناءً على عدد تقريبي إجمالي للسكان في الشجرة من الجد الأول بوبكر يصل إلى <strong>3000</strong> شخص.</p>
              </div>
            </div>
          </div>

          <div class="data-completeness-card">
            <h2>نسبة الأفراد الأحياء في قاعدة البيانات</h2>
            <div class="content-wrapper">
              <div class="percentage">
                <span>{(stats.totalAlivePopulation * 100 / 1600).toFixed(1)}%</span>
                <div class="progress-bar">
                <div className="progress" style={{ width: `${(stats.totalAlivePopulation * 100 / 1600).toFixed(1)}%` }}></div>
                </div>
              </div>
              <div class="data-completeness-content">
                <p>نحن حاليًا قمنا بتوثيق حوالي <strong>{(stats.totalAlivePopulation * 100 / 1600).toFixed(1)}%</strong> من الأفراد الأحياء في قاعدة البيانات، مما يعكس جهودنا المستمرة لتحديث وتوسيع الشجرة العائلية.</p>
              </div>
            </div>
          </div>
        </div>




        <div class="important-info">
          <h2>دقة توثيق التاريخ القديم</h2>
          <p>تم تسجيل <strong><span class="highlight">{(stats.deadPopulation*100/1400).toFixed(1)}%</span></strong> من الأفراد العائلة القدامى في قاعدة البيانات، ما يعكس جهدًا دقيقًا لتوثيق التاريخ العائلي الكامل.</p>
        </div>
        </div>
        <div className="engagement-panel">
          <h2>مشاركة المجتمع في توثيق شجرة العائلة</h2>
          <p className="engagement-text">
            بفضل جهود المجتمع، ساهم <strong>150 شخصًا</strong> حتى الآن في توثيق شجرة العائلة، مما يعكس روح التعاون والانتماء القوي لهذا المشروع العائلي الفريد.
          </p>
          <div className="progress-bar">
            <div className="progress" style={{ width: '70%' }}></div>
          </div>
        </div>




  
    </div>
  );
};

export default StatisticsDashboard;
