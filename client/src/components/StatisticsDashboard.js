import { useEffect, useState } from 'react';
import React, { useRef } from 'react';
import '../styles/StatisticsDashboard.css';
import Chart from 'chart.js/dist/chart.js';
import * as utils from '../utils/utils';
import * as statistics from '../utils/stats';
import usePageTracking from '../utils/trackers';

const neo4jURI = process.env.REACT_APP_NEO4J_URI;
const neo4jUser = process.env.REACT_APP_NEO4J_USER;
const neo4jPassword = process.env.REACT_APP_NEO4J_PASSWORD;

const driver = require('neo4j-driver').driver(
    neo4jURI,
    require('neo4j-driver').auth.basic(neo4jUser, neo4jPassword)
);

function groupAgesByRange(ages, rangeSize = 5, maxRange = 80) {
  const grouped = {};

  ages.forEach(age => {
    if (age >= maxRange) {
      grouped[`${maxRange}+`] = (grouped[`${maxRange}+`] || 0) + 1;
    } else {
      const lower = Math.floor(age / rangeSize) * rangeSize;
      const upper = lower + rangeSize - 1;
      const label = `${lower}-${upper}`;
      grouped[label] = (grouped[label] || 0) + 1;
    }
  });

  return grouped;
}

function buildPyramidData(maleAges, femaleAges, rangeSize = 5) {
  const maleGroups = groupAgesByRange(maleAges, rangeSize);
  const femaleGroups = groupAgesByRange(femaleAges, rangeSize);

  const allRanges = Array.from(new Set([...Object.keys(maleGroups), ...Object.keys(femaleGroups)]))
    .sort((a, b) => parseInt(a.split('-')[0]) - parseInt(b.split('-')[0]));

  const labels = allRanges;
  const maleData = allRanges.map(range => -1 * (maleGroups[range] || 0));  // Negative for left
  const femaleData = allRanges.map(range => femaleGroups[range] || 0);     // Positive for right

  return { labels, maleData, femaleData };
};

const StatisticsDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ageDistribution, setAgeDistribution] = useState([]);
  const [cumulativePopulationGrowth, setpopulationGrowth] = useState([]);
  const [weddingData, setWeddingData] = useState([]);
  const [topFamiliesData, setTopFamilies] = useState([]);
  const [ageGenderDATA, setAgeGenderDATA] = useState([]);
  const ageDistributionChartRef = useRef(null);
  const weddingChartRef = useRef(null);
  const cumulativePopulationGrowthRef = useRef(null);
  const topFamiliesRef = useRef(null);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  usePageTracking();
  
  let ageDistributionChartInstance = useRef(null);
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
        const Population = await statistics.getPopulationStats();
        const AgeStats = await statistics.getAgeStats()
        const oldest = await statistics.oldestPerson();

        const total = Population.totalPopulation;
        const totalAlive = Population.totalAlive;
        const totalDead = (total-totalAlive).toFixed(1);
      
        const avgAge = AgeStats.averageAge;
        const medAge = AgeStats.medianAge;

        const avgChild = await statistics.averageChildrenPerFamily();
        const nbrOfAgedPeople = await statistics.agedPersonCount();
        const biggestFamilyCount = await statistics.biggestFamily();
        const abroadPeoplePercentage = ((await statistics.livingAbroad()) * 100 / totalAlive).toFixed(2);
        const topAbroadCountryCount = await statistics.topAbroadCountry();

        const avgMarAgeMale = (await statistics.avgMarringAgeMale()).toFixed(0);
        const avgMarAgeFemale = (await statistics.avgMarringAgeFemale()).toFixed(0);
        const sixPlusFamilies = await statistics.families6pluschildren();

        const unmariedMalesCount = await statistics.unmariedMales();
        const top5families = await statistics.mostUsedFamilyName();
        const mostUsedFamilyNameCount = top5families[0];
        const mostUsedNameCount = (await statistics.mostUsedName())[0];
        const GenderStats = await statistics.getAgeGenderData();
        const fetchedAgeDistribution = await ageBins();
        const fetchedCumGrowth = await populationGrowth();
        const familiesCount = await statistics.familiesNumber();
        const yearlyWeddings = await statistics.getAllYearsOfMarriage();
        setStats({
          totalPopulation: total,
          totalAlivePopulation: totalAlive,
          totalMen: GenderStats.maleCount,
          totalWomen: GenderStats.femaleCount,
          deadPopulation: totalDead,
          avgAge,
          medAge,
          agedPeopleCount: nbrOfAgedPeople.count,
          oldestPerson: oldest,
          biggestFamily: biggestFamilyCount,
          mostUsedFamilyNameCount,
          mostUsedNameCount: mostUsedNameCount.occurences,
          mostUsedNameCountName: mostUsedNameCount.name,
          unmariedMalesCount,
          abroadPeoplePercentage,
          avgMarAgeMale,
          avgMarAgeFemale,
          topAbroadCountryCount,
          sixPlusFamilies: sixPlusFamilies,
          averageChildrenPerFamily: avgChild,
          familiesCount,
          yearlyWeddings
        });
        setAgeDistribution(fetchedAgeDistribution);
        setpopulationGrowth(fetchedCumGrowth);
        setTopFamilies(top5families);
        setWeddingData(yearlyWeddings);
        setAgeGenderDATA(GenderStats);
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

  // Set canvas height dynamically: 40px per age bin (adjust if needed)
  ageDistributionChartRef.current.height = ageDistribution.length * 40;

  if (ageDistributionChartInstance.current) {
    ageDistributionChartInstance.current.destroy();
  }

  const ctx = ageDistributionChartRef.current.getContext('2d');

  ageDistributionChartInstance.current = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ageDistribution.map((item) => item.ageBin),
      datasets: [
        {
          label: 'توزيع السكّان',
          data: ageDistribution.map((item) => item.count),
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false, // let canvas height control chart height
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'عدد السكان',
          },
        },
        x: {
          title: {
            display: true,
            text: 'مجالات الأعمار',
          },
        },
      },
    },
  });

  return () => {
    ageDistributionChartInstance.current?.destroy();
  };
}, [ageDistribution]);


  useEffect(() => {
  if (!chartRef.current) return;
  const DATA = ageGenderDATA;
  const maleAges = DATA.maleAges;
  const femaleAges = DATA.femaleAges;
  const { labels, maleData, femaleData } = buildPyramidData(maleAges, femaleAges);

  // Dynamically set canvas height based on number of labels
  // e.g. 40px height per label, adjust as needed
  chartRef.current.height = labels.length * 40;

  const ctx = chartRef.current.getContext('2d');
  if (chartInstance.current) chartInstance.current.destroy();

  chartInstance.current = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'ذكور',
          data: maleData,
          backgroundColor: '#36A2EB',
        },
        {
          label: 'إناث',
          data: femaleData,
          backgroundColor: '#FF6384',
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false, // allow canvas height to control chart height
      scales: {
        x: {
          stacked: true,
          ticks: {
            callback: value => Math.abs(value),
          },
          title: {
            display: true,
            text: 'عدد الأشخاص',
          },
        },
        y: {
          stacked: true,
          title: {
            display: true,
            text: 'الفئة العمرية',
          },
        },
      },
      plugins: {
        legend: {
          position: 'bottom',
        },
        tooltip: {
          callbacks: {
            label: tooltipItem =>
              `${tooltipItem.dataset.label}: ${Math.abs(tooltipItem.raw)} أشخاص`,
          },
        },
      },
    },
  });

  return () => {
    chartInstance.current?.destroy();
  };
}, [ageGenderDATA]);

  useEffect(() => {
  // Simple mobile check (adjust breakpoint as needed)
  const isMobile = window.innerWidth <= 768;

  if (!isMobile) {
    // If not mobile, destroy the chart if exists and skip rendering
    if (cumulativePopulationGrowthInstance.current) {
      cumulativePopulationGrowthInstance.current.destroy();
      cumulativePopulationGrowthInstance.current = null;
    }
    return;
  }

  if (!cumulativePopulationGrowthRef.current || cumulativePopulationGrowth.length === 0) return;

  const ctx = cumulativePopulationGrowthRef.current.getContext('2d');

  if (cumulativePopulationGrowthInstance.current) {
    cumulativePopulationGrowthInstance.current.destroy();
  }

  const labels = cumulativePopulationGrowth.map(item => item.year);
  const cumulativeValues = cumulativePopulationGrowth.map(item => item.cumulativePopulation);
  const aliveValues = cumulativePopulationGrowth.map(item => item.alivePopulation);

  cumulativePopulationGrowthInstance.current = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'عدد السكان التراكمي',
          data: cumulativeValues,
          borderColor: '#36A2EB',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
        },
        {
          label: 'الأشخاص الأحياء',
          data: aliveValues,
          borderColor: '#FF6384',
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
            label: (tooltipItem) => tooltipItem.raw + ' نسمة',
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
            text: 'السنة',
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'السكّان',
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

  // Dynamically set canvas height: 50px per bar (adjust as needed)
  weddingChartRef.current.height = labels.length * 50;

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
      maintainAspectRatio: false,  // important to respect canvas height
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
    weddingChartInstance.current?.destroy(); // Clean up chart instance when unmounting/updating
  };
}, [weddingData]);

  useEffect(() => {
  if (!topFamiliesRef.current || topFamiliesData.length === 0) return;

  if (topFamiliesInstance.current) {
    topFamiliesInstance.current.destroy();
  }

  const ctx = topFamiliesRef.current.getContext('2d');

  // Dynamically set canvas height before chart creation
  const barCount = topFamiliesData.length;
  topFamiliesRef.current.height = barCount * 50; // 50px per bar — adjust as needed

  topFamiliesInstance.current = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: topFamiliesData.map(f => f.familyName),
      datasets: [{
        label: 'عدد الأفراد في العائلة',
        data: topFamiliesData.map(f => f.occurences),
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false, // important for dynamic height
      indexAxis: 'y',
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
    topFamiliesInstance.current?.destroy();
  };

}, [topFamiliesData]);

  if (loading) return (
    <div className="loading-container">
      <div className="spinner"></div>
      <p className="loading-message">جاري تحميل الإحصائيات... الرجاء الانتظار</p>
    </div>
  );
  if (!stats) return <p>تعذر تحميل البيانات.</p>;

  return (
    <div className="stats-dashboard">
      <section className="statistics-dashboard">

        <h1 class="dashboard-title">لوحة الإحصائيات العامة</h1>
        <p>صفحة الإحصائيات هي مصدر شامل يقدم مجموعة متنوعة من البيانات والرسوم البيانية التي تسلط الضوء على مختلف جوانب المجتمع. تشمل الصفحة نظرة عامة عن التعداد السكاني، الهيكل العائلي، التوزيع الجغرافي، والتوجهات الديموغرافية. كما توفر تفاصيل حول نسبة الجنس، متوسط الأعمار، وأنماط الزواج، بالإضافة إلى تحليل مفصل حول الظروف الاقتصادية والاجتماعية. من خلال الرسوم البيانية التفاعلية والمخططات المبتكرة، يتمكن المستخدمون من استكشاف الإحصائيات بسهولة ومعرفة التوجهات التاريخية والمقارنات مع المتوسطات المحلية والعالمية. تُعتبر هذه الصفحة أداة قيمة لفهم التغيرات الاجتماعية والاقتصادية في المجتمع وتتبع التطورات المستقبلية.
        </p>
        <div class="category-block population-overview">
          <h3 class="category-title" id="overview">نظرة عامة على السكان</h3>
          <div class="stats-grid">
            <div class="stat-card"> <h4>إجمالي عدد الأفراد</h4> <p class="stat-number">{stats.totalPopulation}</p> </div>
            <div class="stat-card"> <h4>عدد الأحياء</h4> <p class="stat-number">{stats.totalAlivePopulation}</p> </div>
            <div class="stat-card" id="men"> <h4>عدد الرجال الأحياء</h4> <p class="stat-number">{stats.totalMen}</p> </div>
            <div class="stat-card" id="women"> <h4>عدد النساء الأحياء</h4> <p class="stat-number">{stats.totalWomen}</p> </div>
            <div class="stat-card"> <h4>عدد العائلات المسجلة</h4> <p class="stat-number">{stats.familiesCount}</p> </div>
            <div class="stat-card"> <h4>نسبة الأحياء مقابل المتوفين</h4> <p class="stat-number">%{(stats.totalAlivePopulation * 100 / stats.totalPopulation).toFixed(2)} أحياء</p> </div>
          </div>
        </div>
        <div class="category-block demographics">
          <h3 class="category-title" id="demo">العمر والديموغرافيا</h3>
          <div class="stats-grid">
          <div className="stat-card">
            <h4>أكبر فرد</h4>
            <p className="stat-number">
                {utils.translateName(stats.oldestPerson.name || '')}{" "}
                {utils.translateName(stats.oldestPerson.fatherName ? (stats.oldestPerson.gender === 'Male' ? 'بن ': 'بنت ') +stats.oldestPerson.fatherName : '')} {" "} 
                {utils.translateName(stats.oldestPerson.grandfatherName ? 'بن ' +stats.oldestPerson.grandfatherName : '')}{" "}
                {utils.translateFamilyName(stats.oldestPerson.lastName || '')}
              </p>
            <p className="stat-note">
              {stats.oldestPerson.age} سنة
            </p>
          </div>
            <div class="stat-card"> <h4>متوسط الأعمار</h4> <p class="stat-number">{stats.avgAge} سنة</p> </div>
            <div class="stat-card"> <h4>الوسيط العمري</h4> <p class="stat-number">{stats.medAge} سنة</p> </div>
            <div class="stat-card"> <h4>عدد المعمرين (+100 سنة)</h4> <p class="stat-number">{stats.agedPeopleCount}</p> </div>
          </div>
        </div>
        <div class="category-block family-structure">
          <h3 class="category-title" id="family">بنية العائلة</h3>
          <div class="stats-grid">
            <div class="stat-card"> <h4>متوسط عدد الأطفال لكل عائلة</h4> <p class="stat-number">{stats.averageChildrenPerFamily}</p> </div>
            <div class="stat-card"> <h4>أكبر عائلة من حيث الأبناء</h4> <p class="stat-number"> عائلة {utils.translateName(stats.biggestFamily.fatherName)} {utils.translateFamilyName(stats.biggestFamily.FatherLastName)}  </p>
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
      <h1 class="dashboard-title">عرض البيانات الرسومية</h1>
      <div className="charts">
        <div className="row">
        <div className="chart-container">
            <h3>توزيع الفئات العمرية</h3>
            <canvas id="ageChart" ref={ageDistributionChartRef}></canvas>
          </div>
          <div className="chart-container">
            <h3>الهرم السكّانـي</h3>
            <canvas id="genderChart" ref={chartRef}></canvas>
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
        <div className="fun-fact">
          <h2 className="fun-chart">{stats.mostUsedNameCount}</h2>
          <p>
            <strong>{stats.mostUsedNameCount}</strong> شخص، يحملون لقب <strong>{stats.mostUsedNameCountName}</strong> كأكثر لقب شائع، ويمثل  
            <strong>{((stats.mostUsedNameCount * 100) / stats.totalPopulation).toFixed(1)}%</strong> من السكان.
          </p>
        </div>

        <div class="fun-fact">
          <h2 class="fun-chart">{stats.mostUsedFamilyNameCount.occurences}</h2>
          <p><strong>{stats.mostUsedFamilyNameCount.occurences}</strong>  شخص، يحملون لقب {stats.mostUsedFamilyNameCount.familyName}  كأكثر لقب شائع، ويمثل  
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
          يُقيم <strong>{stats.topAbroadCountryCount.countryCount}</strong> شخصًا من أبناء قصر أولاد بوبكر في <strong>{utils.translateCountry(stats.topAbroadCountryCount.countryName)}</strong>، مما يجعلها الوجهة الأجنبية الأكثر استقطابًا لأبناء البلدة في المهجر.
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
                <span className='percentageText'>{(stats.totalAlivePopulation * 100 / 3000).toFixed(1)}%</span>
                <div class="progress-bar">
                <div className="progress" style={{ width: `${(stats.totalAlivePopulation * 100 / 3000).toFixed(1)}%` }}></div>
                </div>
              </div>
              <div class="data-completeness-content">
                <p>التقدير الحالي يُظهر أننا غطّينا حوالي <strong>{(stats.totalAlivePopulation * 100 / 3000).toFixed(1)}%</strong> من جميع أفراد الشجرة العائلية، بناءً على عدد تقريبي إجمالي للسكان في الشجرة من الجد الأول بوبكر يصل إلى <strong>3000</strong> شخص.</p>
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
        <div className="data-accuracy-note">
        <p className="minor-tip">
          🧾 تعتمد هذه الإحصائيات على بيانات تم جمعها بعناية من مصادر موثوقة، إلا أنها قد لا تكون مكتملة بنسبة 100٪.
          يمكنك معرفة المزيد عن{' '}
          <a href="/docs/data-collection-method.html" target="_blank" rel="noopener noreferrer">
            طريقة جمع المعلومات
          </a>{' '}
          أو الاطلاع على{' '}
          <a href="/stats/data-accuracy.html" target="_blank" rel="noopener noreferrer">
            نسب دقة البيانات
          </a>{' '}
          المعروضة (مثل نسبة توفر سنة الولادة).
        </p>

        </div>

        <div className="tipsFooter">
            <p className="minor-tip">📊 تعرض هذه الصفحة إحصائيات حيّة ومُحدّثة عن عائلة قصر أولاد بوبكر.</p>
            <p className="minor-tip">🧓 الأعمار تحسب تلقائيًا استنادًا إلى سنة الميلاد المتوفرة.</p>
            <p className="minor-tip">🚻 يتم فصل الإحصائيات حسب الجنس لتقديم رؤية أوضح.</p>
            <p className="minor-tip">📉 بعض الإحصائيات قد لا تكون دقيقة 100٪ بسبب نقص البيانات أو عدم التحديث.</p>
            <p className="minor-tip">🔄 يتم تحديث البيانات تلقائيًا عند إضافة أو تعديل الأفراد في الشجرة.</p>
            <p className="minor-tip">📥 يمكنك اقتراح تحسينات أو ملاحظات على طريقة عرض الإحصائيات عبر التواصل معنا.</p>
            <p className="minor-tip">🔎 قريبًا: ستتمكن من استكشاف الإحصائيات حسب الفروع العائلية والمناطق.</p>
        </div>
      </div>
  );
};

export default StatisticsDashboard;