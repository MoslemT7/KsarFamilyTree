import React, {useRef,  useState, useEffect } from 'react';
import "../styles/SearchPage.css"
import PersonCINCard from './PersonCardCIN';
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
  const [viewMode, setViewMode] = useState('card');
  
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
    let translatedfatherName = isArabic(fatherName) ? utils.translateName(fatherName, false) : fatherName;
    let translatedgrandfatherName = isArabic(grandfatherName) ? utils.translateName(grandfatherName, false) : grandfatherName;
    let translatedfamilyName = isArabic(familyName) ? utils.translateFamilyName(familyName, false) : familyName;
    let cypherQuery = ``;
    const queryParamsObject = {};
    setLoading(true);
    setLoadingMessage("جاري البحث عن الشخص ...");
    if (translatedpersonName){
      
      if (translatedfatherName) {
        
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
            queryParamsObject.fatherName = translatedfatherName;
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
            queryParamsObject.fatherName = translatedfatherName;
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
            queryParamsObject.fatherName = translatedfatherName;
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
            queryParamsObject.fatherName = translatedfatherName;
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
        WHERE id(target) = $childID
        MATCH (parent:Person)-[:FATHER_OF|MOTHER_OF]->(target)
        MATCH (parent)-[:FATHER_OF|MOTHER_OF]->(sibling:Person)
        WHERE id(sibling) <> $childID
        RETURN count(DISTINCT sibling) AS siblingCount  
        `, {childID});
        const isMarried = await session.run(`
          MATCH (p)-[:MARRIED_TO]->(:Person)
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
          maritalStatus: isMarried.records[0]?.get('isMarried') ?? "غير متوفر", // Safe access for marital status
          childrenCount: childrenCountRecord.records[0]?.get('childrenCount')?.toInt() ?? 0, // Default to 0 if missing
          siblingsCounts: siblingsCountsRecord.records[0]?.get('siblingCount')?.toInt() ?? 0
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
            const siblingsCountsRecord = await session.run(`
              MATCH (target:Person)
              WHERE id(target) = $childID
              MATCH (parent:Person)-[:FATHER_OF|MOTHER_OF]->(target)
              MATCH (parent)-[:FATHER_OF|MOTHER_OF]->(sibling:Person)
              WHERE id(sibling) <> $childID
              RETURN count(DISTINCT sibling) AS siblingCount  
              `, {childID});

          const isMarried = await session.run(`
            MATCH (m:Person)-[r:MARRIED_TO]->(w:Person)
            WHERE id(m) = $childID
            RETURN count(r) > 0 AS isMarried
          `, { childID });
          console.log(isMarried.records[0]?.get('isMarried'));
          const personDetails = {
            personID: childID,
            personName: record.get('childName') ?? "غير متوفر",
            fatherName: record.has('fatherName') ? record.get('fatherName') : "غير متوفر",
            grandfatherName: record.has('grandfatherName') ? record.get('grandfatherName') : "غير متوفر",
            familyName: record.has('familyName') ? record.get('familyName') : "غير متوفر",
            gender: record.has('childGender') ? record.get('childGender') : "غير متوفر",
            age, YoB,
            YoD,
            motherName: motherResult?.get('motherName') ?? "غير متوفر",
            motherFatherName: motherResult?.get('motherFatherName') ?? "غير متوفر",
            motherGrandFatherName: motherResult?.get('motherGrandFatherName') ?? "غير متوفر",
            motherFamilyName: motherResult?.get('motherFamilyName') ?? "غير متوفر",

            lifeStatus: record.has('lifeStatus') ? record.get('lifeStatus') : "غير متوفر",
            maritalStatus: isMarried.records[0]?.get('isMarried') ?? "غير متوفر",
            childrenCount: childrenCountRecord.records[0]?.get('childrenCount')?.toInt() ?? 0,
            siblingsCounts: siblingsCountsRecord.records[0]?.get('siblingCount')?.toInt() ?? 0

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
      {personDetails && !personDetails.multipleMatches && (
        <div className="view-toggle-buttons">
          <button
            className={viewMode === 'card' ? 'active' : ''}
            onClick={() => setViewMode('card')}
          >
            عرض البطاقة
          </button>
          <button
            className={viewMode === 'table' ? 'active' : ''}
            onClick={() => setViewMode('table')}
          >
            عرض الجدول
          </button>
        </div>
      )}

      {personDetails && personDetails.multipleMatches ? (
        <div className="multiple-matches">
          <h2 id="">نتائج متعددة:</h2>
            <table className='duplicated-table'>
              <thead>
                <tr>
                  <th>الترتيب</th>
                  <th>الإسم</th>
                  <th>إسم الأب</th>
                  <th>إسم الجدّ</th>
                  <th>اللقب</th>
                  <th>العمر </th>
                  <th>سنة الوفاة </th>
                  <th>عدد الأطفال</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {personDetails.multipleMatches.map((person, index) => (
                  <tr 
                    key={index} 
                    onClick={() => handlePersonSelect(person)}
                  >
                    <td>{index + 1}</td>
                    <td>{utils.translateName(person.personName)}</td>
                    <td>{person.fatherName ? ` ${utils.translateName(person.fatherName)}` : ''}</td>
                    <td>{person.grandfatherName ? ` ${utils.translateName(person.grandfatherName)}` : ''}</td>
                    <td>{person.familyName ? utils.translateFamilyName(person.familyName) : ''}</td>
                    <td>{person.age !== -1 ? person.age : " - "}</td>
                    <td>{person.YoD ? person.YoD : " - "}</td>
                    <td>{person.childrenCount ? person.YoD : " - "}</td>
                    <td><button className='choiceButton'>إختيار</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
      ) : personDetails ? (
        <div className="person-card-container">
          {viewMode === 'card' ? (
            <PersonCINCard person={personDetails} />
          ) : (
            <div className="person-table-view">
              <table className="person-side-table">
                <tbody>
                  <tr><th>الرقم التسلسلي</th>
                  <td className='highlight-id'>{personDetails.personID}</td></tr>
                  <tr><th>الإسم الكامل</th>

                  <td>
                    {utils.translateName(personDetails?.personName)}
                    {personDetails?.fatherName
                      ? ` ${personDetails.gender === 'Female' ? 'بنت' : 'بن'} ${utils.translateName(personDetails.fatherName)}`
                      : ''}
                    {personDetails?.grandfatherName
                      ? ` بن ${utils.translateName(personDetails.grandfatherName)}`
                      : ''}
                    {personDetails?.familyName ? 
                      ` ${utils.translateFamilyName(personDetails.familyName)}` 
                      : ''}
                  </td></tr>
                  

                  <tr>
                    <th>إسم الأم الكامل</th>
                    <td>
                      {utils.translateName(personDetails?.motherName) || ''}
                      {personDetails?.motherFatherName
                        ? ` بنت ${utils.translateName(personDetails.motherFatherName)}`
                        : ''}
                      {personDetails?.motherGrandFatherName
                        ? ` بن ${utils.translateName(personDetails.motherGrandFatherName)}`
                        : ''}
                      {personDetails?.motherFamilyName 
                        ? ` ${utils.translateFamilyName(personDetails.motherFamilyName)}` 
                        : ''}
                    </td>
                  </tr>
                  <tr>
                    <th>سنة الولادة</th>
                    <td>{personDetails?.YoB || 'غير معروف'}</td>
                  </tr>
                  <tr>
                    <th>سنة الوفاة</th>
                    <td>{personDetails?.YoD || '—'}</td>
                  </tr>
                  <tr>
                    <th>العمر</th>
                    <td>{personDetails?.age || '—'}</td>
                  </tr>
                  <tr>
                    <th>الجنس</th>
                    <td>{personDetails?.gender === 'Male' ? 'ذكر' : 'أنثى'}</td>
                  </tr>
                  <tr>
                  <th>الحالة الإجتماعية :</th>
                  <td>
                    {personDetails?.maritalStatus === true
                      ? (personDetails.gender === 'Male' ? 'متزوج' : 'متزوجة')
                      : (personDetails.gender === 'Female' ? 'عازبة' : 'عازب')}
                  </td>
                </tr>
                <tr>
                  <th>عدد الأبناء</th>
                  <td>
                    {personDetails?.childrenCount === 0
                      ? "لا أطفال"
                      : personDetails.childrenCount === 1
                      ? "طفل واحد (1)"
                      : personDetails.childrenCount === 2
                      ? "طفلان (2)"
                      : personDetails.childrenCount >= 3 && personDetails.childrenCount <= 10
                      ? `${personDetails.childrenCount} أطفال`
                      : `${personDetails.childrenCount} طفل`}
                  </td>

                </tr>
                <tr>
                  <th>عدد الإخوة</th>
                  <td>{personDetails?.childrenCount === 0
                      ? "لا إخوة"
                      : personDetails.childrenCount === 1
                      ? "أخ واحد (1)"
                      : personDetails.childrenCount === 2
                      ? "أخوان (2)"
                      : personDetails.childrenCount >= 3 && personDetails.childrenCount <= 10
                      ? `${personDetails.childrenCount} إخوة`
                      : `${personDetails.childrenCount} أخـًا`}</td>
                </tr>
                <tr>
                  <th>بلاد السكنة أو العمل</th>
                  <td></td>
                </tr>
                </tbody>
              </table>

            </div>
          )}
        </div>
      ) : (
        <div className="no-results"></div>
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

