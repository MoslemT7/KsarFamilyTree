// src/components/DataEntryForm.jsx
import React, { useState, useRef } from 'react';
import {
  createPersonQuery,
  createParentChildRelationshipQuery,
  createMarriageQuery,
} from '../utils/cypherUtils';
import neo4j from 'neo4j-driver';
import '../styles/DataEntryForm.css';
import * as utils from '../utils/utils';
const neo4jURI = process.env.REACT_APP_NEO4J_URI;
const neo4jUser = process.env.REACT_APP_NEO4J_USER;
const neo4jPassword = process.env.REACT_APP_NEO4J_PASSWORD;

const driver = require('neo4j-driver').driver(
    neo4jURI,
    require('neo4j-driver').auth.basic(neo4jUser, neo4jPassword)
);


const initialForm = {
  name: '',
  lastName: '',
  gender: '',
  isAlive: false,
  YoB: '',
  YoD: '',
  WorkCountry: '',
  parentId: '',
  childId: '',
  maleId: '',
  femaleId: '',
  marriageYear: '',
  status: '',
  endYear: '',
};

export default function DataEntryForm() {
  const [action, setAction] = useState('');
  const [formState, setFormState] = useState({ ...initialForm });
  const [result, setResult] = useState(null);

  const handleActionChange = (e) => {
    setAction(e.target.value);
    setFormState({ ...initialForm });
    setResult(null);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormState((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const session = driver.session();
    try {
      let cq;
      switch (action) {
        case 'createPerson':
          cq = createPersonQuery(formState);
          break;
        case 'createFatherChild':
          cq = createParentChildRelationshipQuery(
            parseInt(formState.parentId, 10),
            parseInt(formState.childId, 10),
            'FATHER_OF'
          );
          break;
        case 'createMotherChild':
          cq = createParentChildRelationshipQuery(
            parseInt(formState.parentId, 10),
            parseInt(formState.childId, 10),
            'MOTHER_OF'
          );
          break;
        case 'createMarriage':
          cq = createMarriageQuery(
            parseInt(formState.maleId, 10),
            parseInt(formState.femaleId, 10),
            formState.marriageYear
              ? parseInt(formState.marriageYear, 10)
              : null,
            formState.status,
            formState.endYear ? parseInt(formState.endYear, 10) : null
          );
          break;
        default:
          setResult({ success: false, error: 'Invalid action' });
          return;
      }

      const res = await session.run(cq.query, cq.params);
      setResult({ success: true, data: res.records });
    } catch (err) {
      setResult({ success: false, error: err.message });
    } finally {
      await session.close();
    }
  };

  const renderFormFields = () => {
    switch (action) {
      case 'createPerson':
        return (
          <>
            <label>
              First Name:
              <input
                name="name"
                value={formState.name}
                onChange={handleChange}
                required
              />
            </label>
            <label>
              Last Name:
              <input
                name="lastName"
                value={formState.lastName}
                onChange={handleChange}
                required
              />
            </label>
            <label>
              Gender:
              <select
                name="gender"
                value={formState.gender}
                onChange={handleChange}
                required
              >
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </label>
            <label>
              Is Alive:
              <input
                type="checkbox"
                name="isAlive"
                checked={formState.isAlive}
                onChange={handleChange}
              />
            </label>
            <label>
              Year of Birth:
              <input
                type="number"
                name="YoB"
                value={formState.YoB}
                onChange={handleChange}
              />
            </label>
            <label>
              Year of Death:
              <input
                type="number"
                name="YoD"
                value={formState.YoD}
                onChange={handleChange}
              />
            </label>
            <label>
              Work Country:
              <input
                name="WorkCountry"
                value={formState.WorkCountry}
                onChange={handleChange}
              />
            </label>
          </>
        );

      case 'createFatherChild':
      case 'createMotherChild':
        return (
          <>
            <label>
              Parent ID:
              <input
                type="number"
                name="parentId"
                value={formState.parentId}
                onChange={handleChange}
                required
              />
            </label>
            <label>
              Child ID:
              <input
                type="number"
                name="childId"
                value={formState.childId}
                onChange={handleChange}
                required
              />
            </label>
          </>
        );

      case 'createMarriage':
        return (
          <>
            <label>
              Husband ID:
              <input
                type="number"
                name="maleId"
                value={formState.maleId}
                onChange={handleChange}
                required
              />
            </label>
            <label>
              Wife ID:
              <input
                type="number"
                name="femaleId"
                value={formState.femaleId}
                onChange={handleChange}
                required
              />
            </label>
            <label>
              Marriage Year:
              <input
                type="number"
                name="marriageYear"
                value={formState.marriageYear}
                onChange={handleChange}
              />
            </label>
            <label>
              Status:
              <select
                name="status"
                value={formState.status}
                onChange={handleChange}
                required
              >
                <option value="">Select</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
              </select>
            </label>
            <label>
              End Year:
              <input
                type="number"
                name="endYear"
                value={formState.endYear}
                onChange={handleChange}
              />
            </label>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="data-entry-container">
      <h2>Data Entry</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Select Action:
          <select value={action} onChange={handleActionChange} required>
            <option value="">-- Select --</option>
            <option value="createPerson">Create Person</option>
            <option value="createFatherChild">Father‑Child</option>
            <option value="createMotherChild">Mother‑Child</option>
            <option value="createMarriage">Marriage</option>
          </select>
        </label>

        {renderFormFields()}

        {action && (
          <button type="submit" className="submit-btn">
            Submit
          </button>
        )}
      </form>

      {result && (
        <div className={result.success ? 'success' : 'error'}>
          <h3>{result.success ? 'Success' : 'Error'}</h3>
          {result.success ? (
            <p>Operation completed successfully.</p>
          ) : (
            <p>{result.error}</p>
          )}
        </div>
      )}
    </div>
  );
}