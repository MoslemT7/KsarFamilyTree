import React, { useEffect, useState } from "react";
import "../styles/AIPredictionZone.css";

function predictMarriagesLinearRegression(pastData, yearsToPredict = 5, startYear) {
  const n = pastData.length;
  const x = pastData.map(d => d.year);
  const y = pastData.map(d => d.count);

  // Calculate means
  const xMean = x.reduce((a, b) => a + b, 0) / n;
  const yMean = y.reduce((a, b) => a + b, 0) / n;

  // Calculate slope (m) and intercept (b) for y = mx + b
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (x[i] - xMean) * (y[i] - yMean);
    denominator += (x[i] - xMean) ** 2;
  }
  const m = numerator / denominator;
  const b = yMean - m * xMean;

  const predictions = {};

  for (let i = 1; i <= yearsToPredict; i++) {
    const year = startYear + i;
    const predicted = Math.round(m * year + b);
    const clamped = predicted < 0 ? 0 : predicted;
    predictions[`predictedMarriages${year}`] = {
      min: clamped - 1 < 0 ? 0 : clamped - 1,
      max: clamped + 1,
      predicted: clamped,
    };
  }

  return predictions;
}

function predictBirthsNextDecade(predictedMarriages, childrenPerFamily) {
  const totalBirths = predictedMarriages * childrenPerFamily;

  return {
    predictedBirths: totalBirths,
    details: `Based on ${predictedMarriages} predicted marriages and an average of ${childrenPerFamily} children per family.`,
    range: {
      min: Math.round(totalBirths * 0.9), // 10% less as lower bound
      max: Math.round(totalBirths * 1.1), // 10% more as upper bound
    },
  };
}

function predictAgedPopulation(currentAged, growthFactor = 1.6) {
  const predictedAged = Math.round(currentAged * growthFactor);

  return {
    predictedAged,
    details: `Based on current aged population of ${currentAged} and an estimated growth factor of ${growthFactor}.`,
    range: {
      min: Math.round(predictedAged * 0.95), // 5% less lower bound
      max: Math.round(predictedAged * 1.05), // 5% more upper bound
    },
  };
}

const AIPredictionZone = ({ stats }) => {
  const [predictions, setPredictions] = useState({
    predictedPopulation2030: 0,
    predictedMarriages2029: 0,
    predictedBirthsNextDecade: 0,
    predictedAged2035: 0
  });
//   const yearlyWeddings = stats.yearlyWeddings;
const yearlyWeddings = [
  { year: 2010, count: 3 },
  { year: 2011, count: 7 },
  { year: 2012, count: 1 },
  { year: 2013, count: 9 },
  { year: 2014, count: 4 },
  { year: 2015, count: 10 },
  { year: 2016, count: 6 },
  { year: 2017, count: 11 },
  { year: 2018, count: 5 },
  { year: 2019, count: 12 },
  { year: 2020, count: 4 },
  { year: 2021, count: 3 },
  { year: 2022, count: 4 },
  { year: 2023, count: 2 },
  { year: 2024, count: 1 },
  { year: 2025, count: 1 },
];


  return (
    <div className="ai-prediction-zone">
      <h2 className="futuristic-title">🔮 منطقة التنبؤات المستقبلية بالذكاء الاصطناعي</h2>
      <p className="prediction-intro">
        اعتمادًا على البيانات الحالية، يتوقع النظام اتجاهات السكان والزواج والولادات في المستقبل.
      </p>

      <div className="prediction-grid">
        <div className="prediction-card">
          <h3>📈 عدد السكان المتوقع في 2030</h3>
          <p className="prediction-value">{predictions.predictedPopulation2030} شخص</p>
        </div>

        <div className="prediction-card">
            <h3>💍 توقعات عدد الزيجات خلال المواسم الخمسة القادمة</h3>
           <ul>
                {Object.entries(predictions)
                    .filter(([key]) => key.startsWith("predictedMarriages"))
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([key, value]) => {
                    const year = key.replace("predictedMarriages", "");
                    return (
                        <li key={key}>
                        {year}: {value.predicted} زيجات (بين {value.min} و {value.max})
                        </li>
                    );
                    })}
                </ul>
            </div>


       <div className="prediction-card">
        <h3>👶 مواليد العقد القادم</h3>
        <p className="prediction-value">
            {predictions.predictedBirthsNextDecade.predictedBirths} طفل
        </p>
        </div>

        <div className="prediction-card">
        <h3>🧓 كبار السن (+70) في 2035</h3>
        <p className="prediction-value">
            {predictions.predictedAged2035.predictedAged} شخص
        </p>
        </div>


      </div>
    </div>
  );
};

export default AIPredictionZone;
