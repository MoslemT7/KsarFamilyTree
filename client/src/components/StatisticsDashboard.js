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
        RETURN n
        ORDER BY n.YoB ASC
        LIMIT 1
      `);
      if (result.records.length > 0) {
        const person = result.records[0].get("n").properties;
        const age = new Date().getFullYear() - person.YoB;
        return {
          name: person.name || '',
          lastName: person.lastName || '',
          age
        };
      } else {
        return { name: "غير معروف", lastName: "", age: "-" };
      }
    } catch (error) {
      console.error("Error fetching oldest person:", error);
      return { name: "خطأ", lastName: "", age: "-" };
    } finally {
      await session.close();
    }
  };
  
const youngestPerson = async () => {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (n:Person)
      WHERE n.YoB IS NOT NULL
      RETURN n
      ORDER BY n.YoB DESC
      LIMIT 1
    `);
    if (result.records.length > 0) {
      const person = result.records[0].get("n").properties;
      const age = new Date().getFullYear() - person.YoB;
      return {
        name: person.name || '',
        lastName: person.lastName || '',
        age
      };
    } else {
        return { name: "غير معروف", lastName: "", age: "-" };
    }
  } catch (error) {
    console.error("Error fetching youngest person:", error);
    return { name: "خطأ", lastName: "", age: "-" };
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

export const translateName = (firstName, lastName) => {
    const translatedFirstName = translations[firstName] || firstName; // Translate first name
    const translatedLastName = translations[lastName] || lastName; // Translate last name
    return `${translatedFirstName} ${translatedLastName}`; // Return combined translated names
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


const StatisticsDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ageDistribution, setAgeDistribution] = useState([]);

    // Use different refs for each canvas
    const ageDistributionChartRef = useRef(null);
    const genderRatioChartRef = useRef(null);
    
    let ageDistributionChartInstance = useRef(null);
    let genderRatioChartInstance = useRef(null);

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
          WHEN age < 13 THEN '3-12'
          WHEN age < 19 THEN '13-18'
          WHEN age < 30 THEN '19-29'
          WHEN age < 45 THEN '30-44'
          WHEN age < 60 THEN '45-59'
          WHEN age < 70 THEN '60-69'
          WHEN age < 80 THEN '70-79'
          ELSE '80+'
        END AS ageBin
        RETURN ageBin, count(*) AS count
        ORDER BY ageBin
      `);
  
      // Map the result to an array of objects
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

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const total = await totalPopulation();
        const totalAlive = await totalAlivePopulation();
        const oldest = await oldestPerson();
        const youngest = await youngestPerson();
        const avgAge = await averageAge();
        const avgChild = await averageChildrenPerFamily();
        const { maleCount, femaleCount } = await SexCount();
        const fetchedAgeDistribution = await ageBins();

        setStats({
          totalPopulation: total,
          totalAlivePopulation: totalAlive,
          totalMen: maleCount,
          totalWomen: femaleCount,
          averageAge: avgAge.averageAge, 
          oldestPerson: oldest,
          youngestPerson: youngest,
          averageChildrenPerFamily: avgChild
        });
        setAgeDistribution(fetchedAgeDistribution); // Store the age distribution data
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };
  
    fetchStats();
  }, []);

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
          },
        },
      },
    });

    return () => {
      ageDistributionChartInstance.current?.destroy(); // Clean up chart instance when the component unmounts or updates
    };
  }, [ageDistribution]); // Runs when age distribution data is available

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
  }, [stats]); // Runs when stats are available (totalMen and totalWomen)

  if (loading) return <p>جاري تحميل الإحصائيات...</p>;
  if (!stats) return <p>تعذر تحميل البيانات.</p>;

  return (
    <div className="stats-dashboard">
      <h2>📊 لوحة الإحصائيات</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <h3>👥 أبناء قصر أولاد بوبكر</h3>
          <p>{stats.totalPopulation}</p>
        </div>

        <div className="stat-card">
          <h3>💓 عدد السكان الإجمالي</h3>
          <p>{stats.totalAlivePopulation}</p>
        </div>

        <div className="stat-card">
          <h3>👩 عدد النساء</h3>
          <p>{stats.totalWomen}</p>
        </div>

        <div className="stat-card">
          <h3>👨 عدد الرجال</h3>
          <p>{stats.totalMen}</p>
        </div>

        <div className="stat-card">
          <h3>📈 متوسط العمر</h3>
          <p>{stats.averageAge} سنة</p>
        </div>

        <div className="stat-card">
          <h3>👴أكبر شخص سنًا</h3>
          <p>{translateName(stats.oldestPerson.name, stats.oldestPerson.lastName)} ({stats.oldestPerson.age} سنة)</p>
        </div>

        <div className="stat-card">
          <h3>👶أصغر شخص سنًا</h3>
          <p>{translateName(stats.youngestPerson.name, stats.youngestPerson.lastName)} ({stats.youngestPerson.age} سنة)</p>
        </div>
        <div className="stat-card">
          <h3>معدل الأبناء في العائلة</h3>
          <p>{stats.averageChildrenPerFamily}</p>
        </div>
      </div>
      <div className="charts">
        <div className="chart-container">
          <h3>Age Distribution</h3>
          <canvas id="ageChart" ref={ageDistributionChartRef }></canvas>
        </div>

        <div className="chart-container">
          <h3>Gender Ratio</h3>
          <canvas id="genderChart" ref={genderRatioChartRef}></canvas>
        </div>

        <div className="chart-container">
          <h3>Alive vs Deceased</h3>
          <canvas id="lifeStatusChart"></canvas>
        </div>
      </div>
    </div>
  );
};

export default StatisticsDashboard;
