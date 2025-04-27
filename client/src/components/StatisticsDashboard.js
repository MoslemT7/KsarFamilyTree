import { useEffect, useState } from 'react';
import neo4j from 'neo4j-driver';
import './StatisticsDashboard.css';
const translations = require('./translation.json');
require('dotenv').config(); // Load .env file

const driver = neo4j.driver(
  'neo4j+s://2cd0ce39.databases.neo4j.io',
  neo4j.auth.basic('neo4j', 'nW1azrzTK-lrTOO5G1uOkUVFwelcQlEmKPHggPUB7xQ')
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

const oldestPerson = async () => {
    const session = driver.session();
    try {
      const result = await session.run(`
        MATCH (n:Person)
        WHERE n.YoB IS NOT NULL
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
        console.log(maleCount);
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

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const total = await totalPopulation();
        const totalAlive = await totalAlivePopulation();
        const oldest = await oldestPerson();
        const youngest = await youngestPerson();
        const avgAge = await averageAge();
        const { maleCount, femaleCount } = await SexCount();
  
        setStats({
          totalPopulation: total,
          totalAlivePopulation: totalAlive,
          totalMen: maleCount,
          totalWomen: femaleCount,
          averageAge: avgAge.averageAge, 
          oldestPerson: oldest,
          youngestPerson: youngest
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };
  
    fetchStats();
  }, []);

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

        
      </div>
    </div>
  );
};

export default StatisticsDashboard;
