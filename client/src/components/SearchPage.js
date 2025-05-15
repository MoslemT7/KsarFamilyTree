import React, {useRef,  useState, useEffect } from 'react';
import "../styles/SearchPage.css"
import Tree from 'react-d3-tree';
import * as utils from '../utils/utils';

const neo4jURI = process.env.REACT_APP_NEO4J_URI;
const neo4jUser = process.env.REACT_APP_NEO4J_USER;
const neo4jPassword = process.env.REACT_APP_NEO4J_PASSWORD;

const driver = require('neo4j-driver').driver(
    neo4jURI,
    require('neo4j-driver').auth.basic(neo4jUser, neo4jPassword)
);

const SearchPage = () => {
  const [treeVisible, setTreeVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [personDetails, setPersonDetails] = useState(null);
  const [treeData, setTreeData] = useState(null);
  const [error, setError] = useState('');
  const containerRef = useRef();
  const [translate, setTranslate] = useState({ x: 500, y: 0 });
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

  
  const getChildrenOfFather = async (fatherId) => {
    const session = driver.session();
    try {
      const result = await session.run(
        `
        MATCH (father:Person)
        WHERE id(father) = $fatherId
        OPTIONAL MATCH (father)-[:FATHER_OF|MOTHER_OF]->(child:Person)
        RETURN father, collect(child) AS children
        `,
        { fatherId }
      );
  
      if (result.records.length > 0) {
        const record = result.records[0];
        const fatherNode = record.get('father');
        const childrenNodes = record.get('children');
  
        const father = {
          id: fatherNode.identity.toNumber(),
          ...fatherNode.properties,
        };
  
        const children = childrenNodes
          .filter(child => child) // filter out nulls if no children
          .map(child => ({
            id: child.identity.toNumber(),
            ...child.properties,
          }));
  
        return { father, children };
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error fetching father and children:', error);
      return null;
    } finally {
      await session.close();
    }
  };
  
  const handleShowChildren = async (e) => {
    setTreeVisible(true);
    e.stopPropagation();
    const { father, children } = await getChildrenOfFather(personDetails.personID);
  
    // Transform into correct format for Tree component
    const formattedData = {
      id: father.id,
      name: father.name,
      children: children.map(child => ({
        id: child.id,
        name: child.name
      }))
    };
  
    setTreeData(formattedData);
    
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handlePersonSelect = (selectedPerson) => {
    setPersonDetails({
      personID: selectedPerson.personID,
      personName: selectedPerson.personName,
      fatherName: selectedPerson.fatherName,
      grandfatherName: selectedPerson.grandfatherName,
      familyName: selectedPerson.familyName,
      gender: selectedPerson.gender,
      age: selectedPerson.age,
      YoD: selectedPerson.YoD,
      motherName: selectedPerson.motherName,
      motherFatherName: selectedPerson.motherFatherName,
      motherGrandFatherName: selectedPerson.motherGrandFatherName,
      motherFamilyName: selectedPerson.motherFamilyName,
      lifeStatus: selectedPerson.lifeStatus,
      martialStatus: selectedPerson.martialStatus,
      childrenCount: selectedPerson.childrenCount,
    });
  };

  const handleSearchSubmit = async () => {
    setTreeVisible(false);
    if (!searchQuery.trim()) {
      setError('الرجاء إدخال نص للبحث.');
      setPersonDetails(null);
      return;
    }
    await searchPerson(searchQuery.trim());
  };
  const handleResetPerson = async () => {
    setSearchQuery('');
  };
  const searchPerson = async (searchText) => {
    const isArabic = (text) => /[\u0600-\u06FF]/.test(text);
    let translatedInputName = utils.translateName(searchText, false);
    const { personName: personName, fatherName: fatherName, grandfatherName: grandfatherName, familyName: familyName } = utils.splitName(translatedInputName);
    let translatedpersonName = isArabic(personName) ? utils.translateName(personName, false) : personName;
    let translatedfatherNamee = isArabic(fatherName) ? utils.translateName(fatherName, false) : fatherName;
    let translatedgrandfatherName = isArabic(grandfatherName) ? utils.translateName(grandfatherName, false) : grandfatherName;
    let translatedfamilyName = isArabic(familyName) ? utils.translateFamilyName(familyName, false) : familyName;
    let cypherQuery = ``;
    const queryParamsObject = {};
    setLoading(true);
    setLoadingMessage("جاري البحث عن الشخص ...");
    if (translatedpersonName){
      
      if (translatedfatherNamee) {
        
        if (translatedgrandfatherName) {
          
          if (translatedfamilyName) {
            
            cypherQuery += `
              MATCH (grandfather:Person)-[:FATHER_OF]->(father:Person)-[:FATHER_OF]->(child:Person)
              WHERE child.name = $personName AND 
                    father.name = $fatherName AND 
                    grandfather.name = $grandfatherName AND 
                    child.lastName = $familyName
              RETURN child.name AS childName, father.name AS fatherName, grandfather.name AS grandfatherName, child.lastName AS familyName,  
              child.YoB AS childYoB, child.gender AS childGender, id(child) AS childID,
              child.isAlive AS lifeStatus, child.YoD AS YoD
            `;
            
            queryParamsObject.personName = translatedpersonName;
            queryParamsObject.fatherName = translatedfatherNamee;
            queryParamsObject.grandfatherName = translatedgrandfatherName;
            queryParamsObject.familyName = translatedfamilyName;
            
          } 
          else {
            cypherQuery += `
              MATCH (grandfather:Person)-[:FATHER_OF]->(father:Person)-[:FATHER_OF]->(child:Person)
              WHERE child.name = $personName AND 
                    father.name = $fatherName AND 
                    grandfather.name = $grandfatherName
              RETURN child.name AS childName, father.name AS fatherName, grandfather.name AS grandfatherName, 
              child.YoB AS childYoB, child.gender AS childGender, id(child) AS childID, child.isAlive AS lifeStatus, child.YoD AS YoD`;
            
            queryParamsObject.personName = translatedpersonName;
            queryParamsObject.fatherName = translatedfatherNamee;
            queryParamsObject.grandfatherName = translatedgrandfatherName;
          }
          
        } else {
          if (translatedfamilyName){
            cypherQuery += `
            MATCH (father:Person)-[:FATHER_OF]->(child:Person)
            WHERE child.name = $personName AND 
                  father.name = $fatherName AND
                  child.lastName = $familyName
            OPTIONAL MATCH (grandfather:Person)-[:FATHER_OF]->(father)
            RETURN child.name AS childName, 
                  father.name AS fatherName,
                  grandfather.name as grandfatherName,
                  child.lastName AS familyName,
                  child.YoB AS childYoB, 
                  child.gender AS childGender, 
                  id(child) AS childID,
                  child.isAlive AS lifeStatus, 
                  child.YoD AS YoD
            `;
            queryParamsObject.personName = translatedpersonName;
            queryParamsObject.fatherName = translatedfatherNamee;
            queryParamsObject.familyName = translatedfamilyName;
          }
          else{
            cypherQuery += `
            MATCH (father:Person)-[:FATHER_OF]->(child:Person)
            
            WHERE child.name = $personName AND 
                  father.name = $fatherName
            OPTIONAL MATCH (grandfather:Person)-[:FATHER_OF]->(father)
            RETURN child.name AS childName, 
                   father.name AS fatherName, 
                   grandfather.name as grandfatherName,
                   child.lastName AS familyName,
                   child.YoB AS childYoB, 
                   child.gender AS childGender, 
                   id(child) AS childID, 
                   child.isAlive AS lifeStatus,
                   child.YoD AS YoD
            `;
            queryParamsObject.personName = translatedpersonName;
            queryParamsObject.fatherName = translatedfatherNamee;
          }
          }
      }
      else {
        if (translatedfamilyName){
          cypherQuery += `
          MATCH (child:Person)
          WHERE child.name = $personName AND child.lastName = $familyName
          OPTIONAL MATCH (father:Person)-[:FATHER_OF]->(child)
          OPTIONAL MATCH (grandfather:Person)-[:FATHER_OF]->(father)
          RETURN 
            child.name AS childName, 
            father.name AS fatherName,
            grandfather.name AS grandfatherName,
            child.lastName AS familyName,
            child.YoB AS childYoB, 
            child.gender AS childGender, 
            id(child) AS childID,
            child.isAlive AS lifeStatus,
            child.YoD AS YoD
        `;
        queryParamsObject.personName = translatedpersonName;
        queryParamsObject.familyName = translatedfamilyName;
        }
        else{
          cypherQuery += `
            MATCH (child:Person)
            WHERE child.name = $personName
            OPTIONAL MATCH (father:Person)-[:FATHER_OF]->(child)
            OPTIONAL MATCH (grandfather:Person)-[:FATHER_OF]->(father)
            RETURN child.name AS childName, 
                  child.YoB AS childYoB, 
                  child.gender AS childGender,
                  father.name AS fatherName, 
                  grandfather.name AS grandfatherName,
                   child.lastName AS familyName,
                  id(child) AS childID,
                  child.isAlive AS lifeStatus,
                  child.YoD AS YoD

          `;
          queryParamsObject.personName = translatedpersonName;
        }
      }
    }
    
    const session = driver.session();
    try {
      const result = await session.run(cypherQuery, queryParamsObject);
      if (result.records.length === 0) {
        setLoading(false);
        setError('هذا الشخص ليس مسجل في الشجرة ، الرجاء التحقق من الإسم.');
        setPersonDetails(null);
        return;
      }
      else if (result.records.length === 1) {
        setLoading(false);
        setLoadingMessage("تم إيجاد الشخص ...");
        const record = result.records[0];
        let age;
        let YoB = record.get('childYoB');
        let YoD = record.get('YoD');
        if (YoB == null){
          age = -1;
        }
        else{
          age = new Date().getFullYear() - YoB;
        }
        const childID = record.get("childID").toNumber();
        setLoadingMessage("جاري التحقق من المعلومات ...");
        const motherQuery = await session.run(`
          OPTIONAL MATCH (mother:Person)-[:MOTHER_OF]->(child:Person)
          WHERE id(child) = $childID
          OPTIONAL MATCH (motherFather)-[:FATHER_OF]->(mother:Person)
          OPTIONAL MATCH (motherGrandFather)-[:FATHER_OF]->(motherFather:Person)
          RETURN 
            mother.name AS motherName,
            motherFather.name AS motherFatherName,
            motherGrandFather.name AS motherGrandFatherName,
            mother.lastName AS motherFamilyName
        `, {childID});
        const motherResult = motherQuery.records[0];

        const childrenCountRecord = await session.run(`
          MATCH (p:Person)-[:FATHER_OF|MOTHER_OF]->(child:Person)
          WHERE id(p) = $childID
          RETURN count(child) AS childrenCount
        `, { childID });

        const siblingsCountsRecord = await session.run(`
        MATCH (target:Person)
        WHERE id(target) = 23
        MATCH (parent:Person)-[:FATHER_OF|MOTHER_OF]->(target)
        MATCH (parent)-[:FATHER_OF|MOTHER_OF]->(sibling:Person)
        WHERE id(sibling) <> 23

        RETURN count(DISTINCT sibling) AS siblingCount  
        `, {childID});
        const isMarried = await session.run(`
          MATCH (p)-[:HUSBAND_OF|WIFE_OF]->(:Person)
          WHERE id(p) = $childID
          RETURN count(*) > 0 AS isMarried
        `, { childID });
        const personDetails = {
          personID: childID,
          personName: record.get('childName') ?? "غير متوفر",
          fatherName: record.has('fatherName') ? record.get('fatherName') : "غير متوفر",
          grandfatherName: record.has('grandfatherName') ? record.get('grandfatherName') : "غير متوفر", 
          familyName: record.has('familyName') ? record.get('familyName') : "غير متوفر", 
          gender: record.has('childGender') ? record.get('childGender') : "غير متوفر", 
          age,
          YoD: YoD,
          motherName: motherResult.has('motherName') ? motherResult.get('motherName') : "غير متوفر", 
          motherFatherName: motherResult.has('motherFatherName') ? motherResult.get('motherFatherName') : "غير متوفر", // Check if motherFatherName exists
          motherGrandFatherName: motherResult.has('motherGrandFatherName') ? motherResult.get('motherGrandFatherName') : "غير متوفر", // Check if motherGrandfatherName exists
          motherFamilyName: motherResult.has('motherFamilyName') ? motherResult.get('motherFamilyName') : "غير متوفر", // Check if motherFamilyName exists
          
          lifeStatus: record.has('lifeStatus') ? record.get('lifeStatus') : "غير متوفر", // Check if lifeStatus exists
          martialStatus: isMarried.records[0]?.get('isMarried') ?? "غير متوفر", // Safe access for marital status
          childrenCount: childrenCountRecord.records[0]?.get('childrenCount')?.toInt() ?? 0, // Default to 0 if missing
          siblingsCountsRecord: siblingsCountsRecord.records[0]?.get('siblingCount')?.toInt() ?? 0
        };
    
        setPersonDetails(personDetails);
        setLoading(false);
        setError('');
    
      } 
      else if (result.records.length >= 2) {
        const multipleMatches = [];
      
        for (const record of result.records) {
          let age;
          let YoB = record.get('childYoB');
          let YoD = record.get('YoD');
      
          if (YoB == null) {
            age = -1;
          } else {
            age = new Date().getFullYear() - YoB;
          }
      
          const childID = record.get("childID").toNumber();
      
          const motherQuery = await session.run(`
            MATCH (child:Person) WHERE id(child) = $childID
            OPTIONAL MATCH (mother:Person)-[:MOTHER_OF]->(child)
            OPTIONAL MATCH (motherFather:Person)-[:FATHER_OF]->(mother)
            OPTIONAL MATCH (motherGrandFather:Person)-[:FATHER_OF]->(motherFather)
            RETURN 
              mother.name AS motherName,
              motherFather.name AS motherFatherName,
              motherGrandFather.name AS motherGrandFatherName,
              mother.lastName AS motherFamilyName
          `, { childID });
      
          const motherResult = motherQuery.records[0] ?? null;
          const childrenCountRecord = await session.run(`
            MATCH (p:Person)-[:FATHER_OF|MOTHER_OF]->(child:Person)
            WHERE id(p) = $childID
            RETURN count(child) AS childrenCount
          `, { childID });
      
          const isMarried = await session.run(`
            MATCH (m:Person)-[r:HUSBAND_OF]->(w:Person)
            WHERE id(m) = $childID
            RETURN count(r) > 0 AS isMarried
          `, { childID });
      
          const personDetails = {
            personID: childID,
            personName: record.get('childName') ?? "غير متوفر",
            fatherName: record.has('fatherName') ? record.get('fatherName') : "غير متوفر",
            grandfatherName: record.has('grandfatherName') ? record.get('grandfatherName') : "غير متوفر",
            familyName: record.has('familyName') ? record.get('familyName') : "غير متوفر",
            gender: record.has('childGender') ? record.get('childGender') : "غير متوفر",
            age,
            YoD,
            motherName: motherResult?.get('motherName') ?? "غير متوفر",
            motherFatherName: motherResult?.get('motherFatherName') ?? "غير متوفر",
            motherGrandFatherName: motherResult?.get('motherGrandFatherName') ?? "غير متوفر",
            motherFamilyName: motherResult?.get('motherFamilyName') ?? "غير متوفر",

            lifeStatus: record.has('lifeStatus') ? record.get('lifeStatus') : "غير متوفر",
            martialStatus: isMarried.records[0]?.get('isMarried') ?? "غير متوفر",
            childrenCount: childrenCountRecord.records[0]?.get('childrenCount')?.toInt() ?? 0
          };
      
          multipleMatches.push(personDetails);
        }
      
        setPersonDetails({ multipleMatches });
        setError('هناك العديد من الأشخاص يحملون نفس الاسم. الرجاء اختيار الشخص الصحيح.');
      }
       else {
        setLoading(false);
        setPersonDetails(null);
        setError('لم يتم العثور على شخص مطابق.');
      }
    } catch (err) {
      setLoading(false);
      console.error('Query Error:', err);
      setError('حدث خطأ أثناء البحث.');
      setPersonDetails(null);
    } finally {
      setLoading(false);
      await session.close();
    }
    
  };

  return (
    <div className="search-page">
      <header className="search-header">
      <h1>إبحث عن الأفراد في شجرة عائلتك</h1>
        <p>
          في هذه المخصصة للبحث عن الأفراد، يمكنك الوصول بسهولة إلى معلومات دقيقة عن أي شخص داخل شجرة العائلة،
           وذلك عبر إدخال أي تركيبة من الأسماء — سواء الاسم الكامل، أو اسم الأب، أو حتى جزء من الاسم. بمجرد إدخال البيانات،
           إذا تم العثور على الشخص المطلوب، يتم عرض رقمه التسلسلي في الشجرة،
           إلى جانب اسمه الكامل، واسم والده، واسم والدته.
           كما يمكن للمستخدم الاطلاع على تفاصيل إضافية تشمل سنة الميلاد، وسنة الوفاة (إن وجدت)، وعمر الشخص، وعدد أبنائه، وعدد إخوته. هذه الصفحة تتيح تجربة بحث متقدمة ودقيقة تُمكّن كل فرد من التعرف بشكل أعمق على جذوره وروابطه العائلية.
          </p>

        <input
          type="text"
          className="search-bar"
          placeholder="ادخل الاسم الثلاثي أو الرباعي..."
          value={searchQuery}
          onChange={handleSearchChange}
        />
        <div className='buttons'>
          <button className="search-button" onClick={handleSearchSubmit}>ابحث</button>
          <button className='reset-button' onClick={handleResetPerson}>إلغاء</button>
        </div>
        
      </header>

      {error && <div className="error-message">{error}</div>}
      {loading && (
            <div className="loading-message">
              <div className="spinner"></div>
              <p>{loadingMessage}</p>
            </div>
      )}
      {personDetails && personDetails.multipleMatches ? (
        <div className="multiple-matches">
          <h2>نتائج متعددة:</h2>
          {personDetails.multipleMatches.map((person, index) => (
            <div 
              key={index} 
              className="match-item"
              onClick={() => handlePersonSelect(person)}
              style={{ cursor: 'pointer' }}
            >
            <p className='dupPersonName'>{index + 1}- 
              {utils.translateName(person.personName)} بن 
              {utils.translateName(person.fatherName)} بن 
              {utils.translateName(person.grandfatherName)} 
              {utils.translateFamilyName(person.familyName)}</p>
              <hr />
            </div>
          ))}
        </div>
        ) : personDetails ? (
        <div className="person-details">
          <div className='titles'>
            <h2>تفاصيل الشخص : <p id="idPerson"> الرقم التسلسلي : <span className='highlight-id'>{personDetails.personID}</span></p></h2>
            <h3>
              {utils.translateName(personDetails?.personName ?? "غير معروف")}
              {personDetails?.fatherName
                ? ` ${personDetails.gender === 'Female' ? 'بنت' : 'بن'} ${utils.translateName(personDetails.fatherName)}`
                : ''}
              {personDetails?.grandfatherName
                ? ` بن ${utils.translateName(personDetails.grandfatherName)}`
                : ''}
              {personDetails?.familyName
                ? ` ${utils.translateFamilyName(personDetails.familyName)}`
                : ''}
            </h3>
          </div>
          <div className='personTables'>
            <table className="person-details-table">
              <thead>
                <tr>
                  <th className='blankHeader'></th>
                  <th>الإسم</th>
                  <th>إسم الأب</th>
                  <th>إسم الجّد</th>
                  <th>إسم العائلة / اللقب</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td id="person"><strong>الشخص</strong></td>
                  <td><p className='personDetails'>{utils.translateName(personDetails?.personName ?? '') || 'غير متوفر'}</p></td>
                  <td><p className='personDetails'>{utils.translateName(personDetails?.fatherName ?? '') || 'غير متوفر'}</p></td>
                  <td><p className='personDetails'>{utils.translateName(personDetails?.grandfatherName ?? '') || 'غير متوفر'}</p></td>
                  <td><p className='personDetails'>{utils.translateFamilyName(personDetails?.familyName ?? '') || 'غير متوفر'}</p></td>
                </tr>
                <tr>
                  <td id="mother"><strong>الأم</strong></td>
                  <td><p className='personDetails'>{utils.translateName(personDetails?.motherName ?? '') || 'غير متوفر'}</p></td>
                  <td><p className='personDetails'>{utils.translateName(personDetails?.motherFatherName ?? '') || 'غير متوفر'}</p></td>
                  <td><p className='personDetails'>{utils.translateName(personDetails?.motherGrandFatherName ?? '') || 'غير متوفر'}</p></td>
                  <td><p className='personDetails'>{utils.translateFamilyName(personDetails?.motherFamilyName ?? '') || 'غير متوفر'}</p></td>
                </tr>
              </tbody>
            </table>
            <table className="person-details2-table">
              <thead>
                <tr>
                  <th>الجنس</th>
                  <th>العمر</th>
                  <th>الحالة المدنية</th>
                  <th>حالة الحياة</th>
                  <th>عدد الأطفال</th>
                  <th>عدد الإخوة</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{personDetails.gender === 'Male' ? 'ذكر 👨'  : 'أنثى 👩'}</td>
                  <td
                    dangerouslySetInnerHTML={{
                      __html: personDetails.lifeStatus === true
                        ? personDetails.age !== -1
                          ? personDetails.age === 1
                            ? `سنة واحدة (مواليد ${new Date().getFullYear() - personDetails.age})`
                            : personDetails.age === 2
                            ? `سنتان (مواليد ${new Date().getFullYear() - personDetails.age})`
                            : personDetails.age >= 3 && personDetails.age <= 10
                            ? `${personDetails.age} سنوات (مواليد ${new Date().getFullYear() - personDetails.age})`
                            : `${personDetails.age} سنة (مواليد ${new Date().getFullYear() - personDetails.age})`
                          : 'العمر غير معروف'
                        : personDetails.hasOwnProperty('YoD') && personDetails.YoD
                        ? personDetails.age !== -1
                          ? `مواليد سنة ${new Date().getFullYear() - personDetails.age} <br /> 
                              عاش ${personDetails.YoD - (new Date().getFullYear() - personDetails.age)} سنة <br /> 
                              توفي في ${personDetails.YoD}`
                          : `مواليد ${new Date().getFullYear() - personDetails.age} <br /> 
                              توفي في سنة ${personDetails.YoD}`
                        : personDetails.hasOwnProperty('YoB') && personDetails.YoB
                        ? `مواليد ${personDetails.YoB} <br /> العمر غير معروف`
                        : 'غير متوفر'
                    }}
                  />
                  <td>
                    {personDetails.lifeStatus === true
                      ? personDetails.martialStatus === true
                        ? personDetails.gender === 'Male'
                          ? 'متزوج'
                          : 'متزوجة'
                        : personDetails.gender === 'Male'
                        ? 'أعزب'
                        : 'عزباء'
                      : '-'}
                  </td>
                  <td>
                  {personDetails.lifeStatus === true 
                    ? (personDetails.gender === 'Male' ? 'حي' : 'حية') 
                    : (personDetails.gender === 'Male' ? 'متوفى' : 'متوفية')}
                  </td>
                <td>
                <button id='childrenButton' 
                onClick={handleShowChildren}>
                  {personDetails.childrenCount === 0 || personDetails.childrenCount == null
                    ? 'ليس لديه أطفال'
                    : personDetails.childrenCount === 1
                    ? 'طفل واحد'
                    : personDetails.childrenCount === 2
                    ? 'طفلان'
                    : personDetails.childrenCount >= 3 && personDetails.childrenCount <= 10
                    ? `${personDetails.childrenCount} أطفال`
                    : `${personDetails.childrenCount} طفلا`
                  }
                </button>
                
              </td>
              <td>
                {personDetails.siblingsCountsRecord === 0 || personDetails.siblingsCountsRecord == null
                  ? 'ليس لديه إخوة'
                  : personDetails.siblingsCountsRecord === 1
                  ? `أخٌ واحدٌ (${2})`
                  : personDetails.siblingsCountsRecord === 2
                  ? `أخوان (${2})`
                  : personDetails.siblingsCountsRecord >= 3 && personDetails.siblingsCountsRecord <= 10
                  ? `${personDetails.siblingsCountsRecord} إخوة`
                  : `${personDetails.siblingsCountsRecord} أخا`}
              </td>

                </tr>
              </tbody>
            </table>
          </div>
          
          <div className="tree-wrapper" ref={containerRef}>
          <div className='titleTree'>

          </div>
          
          {treeData && !loading && (
            <div className="tree-container">
              <Tree
                data={treeData}
                orientation="vertical"
                pathFunc="step"
                nodeSize={{ x: 60, y: 100 }}
                separation={{ siblings: 2, nonSiblings: 2 }}
                translate={translate}
                scaleExtent={{ min: 1, max: 1 }} // Disable zooming
                renderCustomNodeElement={
                ({ nodeDatum }) => (
                  <g className="tree-node">
                    <title>{nodeDatum.id}</title>
                    <rect
                      className="tree-node-rect"
                      x="-50"
                      y="-20"
                      width="100"
                      height="40"
                      styles={{
                        fill: "#ffffff",
                        
                        rx: '10',
                        ry: '10',
                        stroke: '#4a90e2',
                        strokeWidth: '2.5px'
                      }}
                    />
                    <text className="tree-node-text" x="0" y="5"
                    style={{
                      fontSize: '16px',
                      fontFamily: 'Cairo',
                      fill: '#333',
                      textAnchor: 'middle',
                      dominantBaseline: 'middle',
                      letterSpacing: '1px',
                      strokeWidth: '1px',
                      pointerEvents: 'none',
                    }}
                    >
                      {utils.translateName(nodeDatum.name)}
                    </text>
                  </g>
                )}
              />
            </div>
          )}
      </div>
    </div>
      ) : (
        <div className="no-results">
        </div>
      )}
  <div>  
  </div>
      <div className='tipsFooter'>
        <p class="minor-tip">💡 يمكنك البحث باستخدام الاسم الكامل أو جزء منه فقط.</p>
        <p class="minor-tip">🔍 إذا لم تجد الشخص، جرّب كتابة اسم الأب أو الجد أيضاً.</p>
        <p class="minor-tip">📛 تأكد من عدم وجود أخطاء إملائية في الأسماء المدخلة.</p>
        <p class="minor-tip">🔒 جميع المعلومات محفوظة ولا تُستخدم إلا لأغراض توثيق العائلة.</p>
        <p class="minor-tip">🔒 إذا أرّدت إخفاء بعض من معطياتك الشخصية ، عليك فقط التواصل معنا ، اننا نحترم خصوصيتك.</p>
        <p class="minor-tip">🤝 إذا لاحظت خطأ في المعلومات، ساعدنا بتحديثها عبر التواصل معنا.</p>
        <p class="minor-tip">📚 هذا الموقع لا يزال قيد التطوير، سيتم إضافة المزيد من الميزات قريباً.</p>
      </div>
    </div>
  );
};

export default SearchPage;

