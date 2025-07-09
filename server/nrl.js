const neo4j = require('neo4j-driver');
const { type } = require('os');
const readline = require('readline');
require('dotenv').config();

const neo4jURI = process.env.REACT_APP_NEO4J_URI;
const neo4jUser = process.env.REACT_APP_NEO4J_USER;
const neo4jPassword = process.env.REACT_APP_NEO4J_PASSWORD;

const driver = require('neo4j-driver').driver(
    neo4jURI,
    require('neo4j-driver').auth.basic(neo4jUser, neo4jPassword)
);
const session = driver.session();

const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });

const createParentChildRelationship = async (
  sessionOrTx, // pass session or transaction here
  parentFullName,
  childFullName,
  relationshipLabel
) => {
  const [parentFirst, ...parentLastArr] = parentFullName.trim().split(' ');
  const [childFirst, ...childLastArr] = childFullName.trim().split(' ');
  const parentFirstName = formatName(parentFirst);
  const parentLastName = formatName(parentLastArr.join(' '));
  const childFirstName = formatName(childFirst);
  const childLastName = formatName(childLastArr.join(' '));

  try {
    // Now getPeopleWithSameName uses the global session, so no need to pass session here

    const parentCandidates = await getPeopleWithSameName(parentFirstName, parentLastName, sessionOrTx);
    const childCandidates = await getPeopleWithSameName(childFirstName, childLastName, sessionOrTx);

    if (parentCandidates.length === 0 || childCandidates.length === 0) {
      console.log('❌ Parent or child not found.');
      return;
    }

    const parentId = parentCandidates.length > 1
      ? await promptUserForSelection(parentCandidates)
      : parentCandidates[0].personId;

    const childId = childCandidates.length > 1
      ? await promptUserForSelection(childCandidates)
      : childCandidates[0].personId;

    const result = await sessionOrTx.run(
      `
      MATCH (parent:Person), (child:Person)
      WHERE id(parent) = $parentId AND id(child) = $childId
      MERGE (parent)-[:${relationshipLabel}]->(child)
      RETURN parent.name AS parentName, child.name AS childName
      `,
      { parentId, childId }
    );

    if (result.records.length > 0) {
      const record = result.records[0];
      console.log(`✅ Relationship created: ${record.get('parentName')} is ${relationshipLabel.replace('_OF', '').toLowerCase()} of ${record.get('childName')}.`);
    } else {
      console.log(`⚠️ No relationship was created.`);
    }

  } catch (err) {
    console.error(`❌ Error creating ${relationshipLabel} relationship:`, err);
  }
};

const createPerson = async ({
  name,
  lastName,
  gender,
  isAlive,
  YoB,
  YoD,
  WorkCountry,
  nickname,
  notes,
  YoB_confidence
}, tx = null) => {
  if (!name || !lastName || !gender || isAlive === undefined) {
    console.error('❌ Missing required fields (name, lastName, gender, isAlive)');
    return null;
  }

  const props = {
    name: formatName(name),
    lastName: formatName(lastName),
    gender: formatName(gender),
    isAlive: !!isAlive
  };

  if (YoB && !isNaN(YoB)) props.YoB = parseInt(YoB);
  if (YoD && !isNaN(YoD)) props.YoD = parseInt(YoD);
  if (WorkCountry) props.WorkCountry = formatName(WorkCountry);
  if (nickname) props.nickname = nickname.trim();
  if (notes) props.notes = notes.trim();
  if (YoB_confidence && !isNaN(YoB_confidence)) props.YoB_confidence = parseFloat(YoB_confidence);

  const cypherFields = Object.keys(props).map(k => `${k}: $${k}`).join(', ');

  try {
    const runner = tx || session;
    const result = await runner.run(
      `CREATE (person:Person {${cypherFields}}) RETURN id(person) AS personId`,
      props
    );

    if (result.records.length > 0) {
      const personId = result.records[0].get('personId').toNumber();
      console.log(`✅ Created person: ${props.name} ${props.lastName} (ID: ${personId})`);
      return personId;
    } else {
      console.log('⚠️ Person not created.');
      return null;
    }
  } catch (err) {
    console.error('❌ Error creating person:', err);
    return null;
  }
};


const deletePerson = async (ID) => {
  try {
    const result = await session.run(
      `MATCH (person:Person) 
       WHERE id(person) = $ID
       DETACH DELETE person`,
      { ID: neo4j.int(ID) }
    );

    if (result.summary.counters.updates().nodesDeleted > 0) {
      console.log(`✅ Deleted person with ID: ${Number(ID)}`);
    } else {
      console.log('⚠️ No person found with that ID.');
    }
  } catch (err) {
    console.error('❌ Error deleting person:', err);
  }
};

const selectPerson = async (ID) => {
  try {
    const result = await session.run(
      `MATCH (person:Person) 
       WHERE id(person) = $ID
       RETURN person.name AS name, 
              person.lastName AS lastName,
              person.YoB AS YoB,
              person.YoD AS YoD,
              person.gender AS gender,
              person.isAlive AS isAlive`,
      { ID: neo4j.int(ID) }
    );

    if (result.records.length > 0) {
      const record = result.records[0];
      // Get values safely, null if missing
      const personData = {
        name: record.get('name') || null,
        lastName: record.get('lastName') || null,
        YoB: record.get('YoB') || null,
        YoD: record.get('YoD') || null,
        gender: record.get('gender') || null,
        isAlive: record.get('isAlive') ?? null, // can be boolean false
      };

      console.log('✅ Person data:', personData);
      return personData;
    } else {
      console.log('⚠️ No person found with that ID.');
      return null;
    }
  } catch (err) {
    console.error('❌ Error selecting person:', err);
    return null;
  }
};

const changeAlive = async (ID, newStatus) => {
  let result;
  try {
    newStatus === 'true' ? 
    result = await session.run(
      `MATCH (person:Person) 
       WHERE id(person) = $ID
       SET person.isAlive = TRUE
       RETURN person`,
      { ID: neo4j.int(ID)}
    )
    : result = await session.run(
      `MATCH (person:Person) 
       WHERE id(person) = $ID
       SET person.isAlive = FALSE
       RETURN person`,
      { ID: neo4j.int(ID)}
    );
    if (result.summary.counters.updates().nodesModified > 0) {
      console.log(`✅ Updated isAlive status to ${newStatus} for person with ID: ${Number(ID)}`);
    } else {
      console.log('⚠️ No person found with that ID.');
    }
  } catch (err) {
    console.error('❌ Error updating isAlive status:', err);
  }
};

const createMarriage = async (
  maleFullName,
  femaleFullName,
  marriageYear = null,
  status,
  endYear = null,
  linkChildren = false
) => {
  const [maleFirst, ...maleLastArr] = maleFullName.trim().split(' ');
  const [femaleFirst, ...femaleLastArr] = femaleFullName.trim().split(' ');

  const maleFirstName = formatName(maleFirst);
  const maleLastName = formatName(maleLastArr.join(' '));
  const femaleFirstName = formatName(femaleFirst);
  const femaleLastName = formatName(femaleLastArr.join(' '));

  const session = driver.session();
  const tx = session.beginTransaction();

  try {
    // Search both once using tx
    const [maleCandidates, femaleCandidates] = await Promise.all([
      getPeopleWithSameName(maleFirstName, maleLastName, tx),
      getPeopleWithSameName(femaleFirstName, femaleLastName, tx)
    ]);

    if (maleCandidates.length === 0 || femaleCandidates.length === 0) {
      console.log('❌ Male or female person not found.');
      await tx.rollback();
      await session.close();
      return;
    }

    const maleId = maleCandidates.length > 1
      ? await promptUserForSelection(maleCandidates)
      : (maleCandidates[0].personId.toNumber?.() ?? maleCandidates[0].personId);

    const femaleId = femaleCandidates.length > 1
      ? await promptUserForSelection(femaleCandidates)
      : (femaleCandidates[0].personId.toNumber?.() ?? femaleCandidates[0].personId);

    // Create MARRIED_TO
    const result = await tx.run(
      `
      MATCH (husband:Person), (wife:Person)
      WHERE id(husband) = $maleId AND id(wife) = $femaleId
      MERGE (husband)-[r:MARRIED_TO]-(wife)
      SET 
        ${marriageYear !== null ? 'r.marriageYear = $marriageYear,' : ''}
        r.status = $status
        ${endYear !== null ? ', r.endYear = $endYear' : ''}
      RETURN husband.name AS husband, wife.name AS wife
      `,
      {
        maleId,
        femaleId,
        ...(marriageYear !== null ? { marriageYear } : {}),
        status,
        ...(endYear !== null ? { endYear } : {})
      }
    );

    if (result.records.length > 0) {
      console.log(`✅ Created MARRIED_TO between ${maleFullName} and ${femaleFullName} (${status}${marriageYear ? `, ${marriageYear}` : ''}${endYear ? ` – ${endYear}` : ''})`);

      if (linkChildren) {
        await tx.run(
          `
          MATCH (father:Person)-[:FATHER_OF]->(child)
          WHERE id(father) = $maleId
          AND NOT ( (child)<-[:MOTHER_OF]-(:Person) )
          MATCH (mother:Person) WHERE id(mother) = $femaleId
          CREATE (mother)-[:MOTHER_OF]->(child)
          `,
          { maleId, femaleId }
        );

        await tx.run(
          `
          MATCH (mother:Person)-[:MOTHER_OF]->(child)
          WHERE id(mother) = $femaleId
          AND NOT ( (child)<-[:FATHER_OF]-(:Person) )
          MATCH (father:Person) WHERE id(father) = $maleId
          CREATE (father)-[:FATHER_OF]->(child)
          `,
          { maleId, femaleId }
        );

        console.log('🔗 All children linked to both parents where missing.');
      }

      await tx.commit();
    } else {
      console.log('⚠️ Marriage not created — check selected persons.');
      await tx.rollback();
    }

  } catch (err) {
    await tx.rollback();
    console.error('❌ Error creating MARRIED_TO relationship:', err);
  } finally {
    await session.close();
  }
};

const getPeopleWithSameName = async (name, lastName, tx) => {
  const query = `
    MATCH (p:Person {name: $name, lastName: $lastName})
    OPTIONAL MATCH (father:Person)-[:FATHER_OF]->(p)
    OPTIONAL MATCH (grandfather:Person)-[:FATHER_OF]->(father)
    RETURN id(p) AS personId, 
           p.name AS personName, p.lastName AS lastName,
           father.name AS fatherName, 
           grandfather.name AS grandfatherName
  `;

  const result = await tx.run(query, { name, lastName });

  return result.records.map(record => ({
    personId: record.get('personId'),
    personName: record.get('personName'),
    lastName: record.get('lastName'),
    fatherName: record.get('fatherName'),
    grandfatherName: record.get('grandfatherName')
  }));
};

const promptUserForSelection = (people) => {
  return new Promise((resolve) => {
    

    console.log("\nMultiple people found with the same name. Please select the correct one:\n");

    people.forEach((person, index) => {
      const id = person.personId.toNumber ? person.personId.toNumber() : person.personId;
      const personName = person.personName || 'Unknown';
      const fatherName = person.fatherName || 'Unknown';
      const grandfatherName = person.grandfatherName || 'Unknown';
      const lastName = person.lastName || '';
      console.log(`${index + 1}) ID: ${id} | ${personName} ben ${fatherName} ben ${grandfatherName} ${lastName}`);
    });

    const ask = () => {
      rl.question('\nEnter the number of the correct person: ', (answer) => {
        const selectedIndex = parseInt(answer, 10) - 1;
        if (!isNaN(selectedIndex) && selectedIndex >= 0 && selectedIndex < people.length) {
          const selectedPersonId = people[selectedIndex].personId.toNumber ? people[selectedIndex].personId.toNumber() : people[selectedIndex].personId;
          resolve(selectedPersonId);
        } else {
          console.log('Invalid selection, please enter a valid number.');
          ask();
        }
      });
    };

    ask();
  });
};

const questionAsync = (q) => new Promise(res => rl.question(q, a => res(a.trim())));

// Generic updater by end-node IDs
async function setStatusByNodeIds(session, startId, endId, relType, status) {
  // validate status
  const s = Number(status);
  if (![1,2,3,4].includes(s)) {
    throw new Error(`Status must be 1–4, got "${status}".`);
  }
  const cypher = `
    MATCH (a)-[r:${relType}]-(b)
    WHERE id(a) = $startId AND id(b) = $endId
    SET r.verificationStatus = $status
    RETURN count(r) AS updated
  `;
  const res = await session.run(cypher, {
    startId: neo4j.int(startId),
    endId:   neo4j.int(endId),
    status:  neo4j.int(s)
  });
  return res.records[0].get('updated').toNumber() > 0;
}

// 1) Verify MOTHER_OF by mother/child IDs
async function verifyMotherOf(driver) {
  const session = driver.session();
  try {
    const q = `
      MATCH (m:Person)-[r:MOTHER_OF]->(c:Person)
      WHERE r.verificationStatus IS NULL OR r.verificationStatus <> 1
      OPTIONAL MATCH (mf:Person)-[:FATHER_OF]->(m)
      OPTIONAL MATCH (mgf:Person)-[:FATHER_OF]->(mf)
      OPTIONAL MATCH (cf:Person)-[:FATHER_OF]->(c)
      OPTIONAL MATCH (cgf:Person)-[:FATHER_OF]->(cf)
      RETURN
        id(m) AS mId, m.name AS mName, m.lastName AS mLN,
        mf.name AS mFa, mgf.name AS mGfa,
        id(c) AS cId, c.name AS cName, c.lastName AS cLN,
        cf.name AS cFa, cgf.name AS cGfa
      ORDER BY id(m)
    `;
    const result = await session.run(q);
    console.log(`\nFound ${result.records.length} MOTHER_OF rels.\n`);

    for (let i=0; i<result.records.length; i++) {
      const r = result.records[i];
      const mId = r.get('mId').toNumber(),
            mName = r.get('mName')   || 'غير معروف',
            mLN   = r.get('mLN')     || '',
            mFa   = r.get('mFa')     || 'غير معروف',
            mGfa  = r.get('mGfa')    || 'غير معروف',
            cId   = r.get('cId').toNumber(),
            cName = r.get('cName')   || 'غير معروف',
            cLN   = r.get('cLN')     || '',
            cFa   = r.get('cFa')     || 'غير معروف',
            cGfa  = r.get('cGfa')    || 'غير معروف';

      console.log(`\n[${i+1}/${result.records.length}]`);
      console.log(` Mother: ${mName} ben ${mFa} ben ${mGfa} ${mLN} (ID:${mId})`);
      console.log(` Child : ${cName} ben ${cFa} ben ${cGfa} ${cLN} (ID:${cId})`);

      const status = await questionAsync(
        '  Status [1 = OK, 2 = Verify, 3 = Error, 4 = No Info]: '
      );

      let ok = false;
      try {
        ok = await setStatusByNodeIds(session, mId, cId, 'MOTHER_OF', status);
      } catch (e) {
        console.error('  ✖', e.message);
      }
      console.log(ok ? `  ✔ Updated` : `  ⚠️  No rel found or update failed`);
    }
  } finally {
    await session.close();
  }
}

// 2) Verify MARRIED_TO by person A/B IDs
async function verifyMarriedTo(driver) {
  const session = driver.session();
  try {
    const q = `
      MATCH (a:Person)-[r:MARRIED_TO]-(b:Person)
      WHERE (r.verificationStatus IS NULL OR r.verificationStatus <> 1)
      AND id(a) < id(b)
      OPTIONAL MATCH (af:Person)-[:FATHER_OF]->(a)
      OPTIONAL MATCH (agf:Person)-[:FATHER_OF]->(af)
      OPTIONAL MATCH (bf:Person)-[:FATHER_OF]->(b)
      OPTIONAL MATCH (bgf:Person)-[:FATHER_OF]->(bf)
      RETURN
        id(a) AS aId, a.name AS aName, a.lastName AS aLN, af.name AS aFa, agf.name AS aGfa,
        id(b) AS bId, b.name AS bName, b.lastName AS bLN, bf.name AS bFa, bgf.name AS bGfa
      ORDER BY id(a)
    `;
    const result = await session.run(q);
    console.log(`\nFound ${result.records.length} MARRIED_TO relationships.\n`);

    for (let i=0; i<result.records.length; i++) {
      const r = result.records[i];
      const aId = r.get('aId').toNumber(),
            aName = r.get('aName')   || 'غير معروف',
            aLN   = r.get('aLN')     || '',
            aFa   = r.get('aFa')     || 'غير معروف',
            aGfa  = r.get('aGfa')    || 'غير معروف',
            bId   = r.get('bId').toNumber(),
            bName = r.get('bName')   || 'غير معروف',
            bLN   = r.get('bLN')     || '',
            bFa   = r.get('bFa')     || 'غير معروف',
            bGfa  = r.get('bGfa')    || 'غير معروف';

      console.log(`\n[${i+1}/${result.records.length}]`);
      console.log(` Person A: ${aName} ben ${aFa} ben ${aGfa} ${aLN} (ID:${aId})`);
      console.log(` Person B: ${bName} ben ${bFa} ben ${bGfa} ${bLN} (ID:${bId})`);

      const status = await questionAsync(
        '  Status [1 = OK, 2 = Verify, 3 = Error, 4 = No Info]: '
      );

      let ok = false;
      try {
        ok = await setStatusByNodeIds(session, aId, bId, 'MARRIED_TO', status);
      } catch (e) {
        console.error('  ✖', e.message);
      }
      console.log(ok ? `  ✔ Updated` : `  ⚠️  No rel found or update failed`);
    }
  } finally {
    await session.close();
  }
}

async function askValidatedQuestion(prompt, validAnswers) {
  while (true) {
    const answer = (await question(prompt)).trim().toLowerCase();
    if (validAnswers.includes(answer)) {
      return answer;
    }
    console.log(`Please enter one of the following: ${validAnswers.join(', ')}`);
  }
};

const question = (q) =>
  new Promise((resolve) => {
    rl.question(q, (answer) => {
      resolve(answer.trim());
    });
  });
  
const formatName = (input) =>
  input
    .trim()
    .toLowerCase()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

const formatFullName = (input) => {
  return input
    .trim()
    .split(' ')
    .map(part => formatName(part))
    .join(' ');
};


async function terminalConversation() {
  while (true) {
    console.log('\nChoose an action:');
    console.log('1. Create One Person.');
    console.log('2. Create Father-Child Relationship.');
    console.log('3. Create Mother-Child Relationship.');
    console.log('4. Create Marriage.');
    console.log('5. Delete Person.')
    console.log('6. Change Life Status.');
    console.log('7. Select Person.')
    console.log('8. Mass Add Children (via Full Names).');
    console.log('9. Checking MOTHER_OF Relationships.');
    console.log('10. Verify MARRIED_TO relationships');
    console.log('-1. Exit.');

    const choice = (await question('Enter option number: ')).trim();
    let IDinput, ID;
    switch (choice) {
      case '1': {
        const nameInput = await question('First Name: ');
        const lastNameInput = await question('Last Name: ');
        const genderInput = await askValidatedQuestion('Gender (Male/Female): ', ['male', 'female', 'm', 'f']);
        const isAliveInput = await askValidatedQuestion('Is Alive? (yes/no): ', ['yes', 'no', 'y', 'n', 'true', 'false']);

        const name = formatName(nameInput);
        const lastName = formatName(lastNameInput);
        const gender = ['male', 'm'].includes(genderInput.toLowerCase()) ? 'Male' : 'Female';
        const isAlive = ['yes', 'y', 'true'].includes(isAliveInput.toLowerCase());

        const YoBInput = await question('Year of Birth (optional): ');
        const YoB = YoBInput.trim() && !isNaN(YoBInput) ? parseInt(YoBInput) : undefined;

        let YoB_confidence;
        if (YoB !== undefined) {
          const YoBConfInput = await question('Year of Birth Confidence (optional, numeric): ');
          if (YoBConfInput.trim() && !isNaN(YoBConfInput)) {
            YoB_confidence = parseFloat(YoBConfInput);
          }
        }

        let YoD;
        if (!isAlive) {
          const YoDInput = await question('Year of Death (optional): ');
          if (YoDInput.trim() && !isNaN(YoDInput)) {
            YoD = parseInt(YoDInput);
          }
        }

        const WorkCountryInput = await question('Work Country (optional): ');
        const nicknameInput = await question('Nickname (optional): ');
        const notesInput = await question('Notes (optional): ');

        const WorkCountry = WorkCountryInput.trim() || undefined;
        const nickname = nicknameInput.trim() || undefined;
        const notes = notesInput.trim() || undefined;

        await createPerson({
          name,
          lastName,
          gender,
          isAlive,
          YoB,
          YoD,
          WorkCountry,
          nickname,
          notes,
          YoB_confidence
        });

        break;
      }

      case '2': {
        const fatherFullNameRaw = await question('Father Full Name (First Last): ');
        const childFullNameRaw = await question('Child Full Name (First Last): ');
        const fatherFullName = formatFullName(fatherFullNameRaw);
        const childFullName = formatFullName(childFullNameRaw);
        await session.writeTransaction(async (tx) => {
          await createParentChildRelationship(tx, fatherFullName, childFullName, "FATHER_OF");
        });
        break;
      }

      case '3': {
        const motherFullNameRaw = await question('Mother Full Name (First Last): ');
        const childFullNameRaw = await question('Child Full Name (First Last): ');
        const motherFullName = formatFullName(motherFullNameRaw);
        const childFullName = formatFullName(childFullNameRaw);

        await session.writeTransaction(async (tx) => {
          await createParentChildRelationship(tx, motherFullNameRaw, childFullName, "MOTHER_OF");
        });
        break;
      }

      case '4': {
        const maleFullNameRaw = await question('👤 Husband Full Name (First Last): ');
        const femaleFullNameRaw = await question('👩 Wife Full Name (First Last): ');

        if (!maleFullNameRaw.trim() || !femaleFullNameRaw.trim()) {
          console.log('❌ Both husband and wife names are required.');
          break;
        }

        const maleFullName = formatFullName(maleFullNameRaw.trim());
        const femaleFullName = formatFullName(femaleFullNameRaw.trim());

        const marriageYearInput = await question('📅 Year of Marriage (optional): ');
        const marriageYear = marriageYearInput.trim() && !isNaN(marriageYearInput)
          ? parseInt(marriageYearInput)
          : null;

        const statusInput = await question("🔗 Marriage Status ('married', 'divorced', 'widowed', 'historical'): ");
        const statusMap = {
          m: 'married',
          d: 'divorced',
          w: 'widowed',
          h: 'historical'
        };
        let status = statusInput.trim().toLowerCase();
        status = statusMap[status] || status;

        const validStatuses = ['married', 'divorced', 'widowed', 'historical'];
        if (!validStatuses.includes(status)) {
          console.log(`⚠️ Invalid status. Must be one of: ${validStatuses.join(', ')}`);
          break;
        }

        let endYear = null;
        if (status !== 'married') {
          const endYearInput = await question('📅 Year of End (optional): ');
          if (endYearInput.trim() && !isNaN(endYearInput)) {
            endYear = parseInt(endYearInput);
          }
        }

        const linkChildrenInput = await question('👶 Link all children between husband and wife? (yes/no): ');
        const linkChildren = ['yes', 'y', 'true', 't'].includes(linkChildrenInput.trim().toLowerCase());

        linkChildren ? 
        await createMarriage(maleFullName, femaleFullName, marriageYear, status, endYear, linkChildren) : 
        await createMarriage(maleFullName, femaleFullName, marriageYear, status, endYear);
        break;
      }
      case '5':
        IDinput = await question('Person ID: ');
        ID = Number(IDinput);
        if (isNaN(ID)) {
          console.log("⚠️ Invalid input. 'ID' must be a number.");
          break;
        }

        await deletePerson({ ID }); // ✅ wrapped as object
        break;
      
      case '6':
        IDinput = await question('Person ID to Modify life status : ');
        ID = Number(IDinput);
        if (isNaN(ID)) {
          console.log("⚠️ Invalid input. 'ID' must be a number.");
          break;
        }

        const statusInput = await question('Set alive status (true/false): ');
        const isAlive = statusInput.trim().toLowerCase() === 'true';

        await changeAlive(ID, isAlive);  // call with ID and boolean status
        break;
      
      case '7':
        IDinput = await question('Person ID to display : ');
        ID = Number(IDinput);
        if (isNaN(ID)) {
          console.log("⚠️ Invalid input. 'ID' must be a number.");
          break;
        }
        await selectPerson(ID);  // call with ID and boolean status
        break;
      
      case '8': {
        const fatherFullNameRaw = await question('👨 Father Full Name (First Last, leave empty if none): ');
        const motherFullNameRaw = await question('👩 Mother Full Name (First Last, leave empty if none): ');

        const fatherFullName = fatherFullNameRaw.trim() ? formatFullName(fatherFullNameRaw) : null;
        const motherFullName = motherFullNameRaw.trim() ? formatFullName(motherFullNameRaw) : null;

        if (!fatherFullName && !motherFullName) {
          console.log('❌ At least one parent is required.');
          break;
        }

        // Prepare to fetch father/mother only once
        const session = driver.session();
        const tx = session.beginTransaction();

        try {
          let fatherId = null;
          let motherId = null;

          // Get father ID once
          if (fatherFullName) {
            const [fatherFirst, ...fatherLastArr] = fatherFullName.split(' ');
            const fatherCandidates = await getPeopleWithSameName(
              formatName(fatherFirst),
              formatName(fatherLastArr.join(' ')),
              tx
            );
            if (fatherCandidates.length === 0) {
              console.log(`❌ Father "${fatherFullName}" not found.`);
              await tx.rollback(); await session.close();
              break;
            }
            fatherId = fatherCandidates.length === 1
              ? fatherCandidates[0].personId
              : await promptUserForSelection(fatherCandidates);
          }

          // Get mother ID once
          if (motherFullName) {
            const [motherFirst, ...motherLastArr] = motherFullName.split(' ');
            const motherCandidates = await getPeopleWithSameName(
              formatName(motherFirst),
              formatName(motherLastArr.join(' ')),
              tx
            );
            if (motherCandidates.length === 0) {
              console.log(`❌ Mother "${motherFullName}" not found.`);
              await tx.rollback(); await session.close();
              break;
            }
            motherId = motherCandidates.length === 1
              ? motherCandidates[0].personId
              : await promptUserForSelection(motherCandidates);
          }

          // Ask how many children to add
          const howManyInput = await question('👶 How many children do you want to add? ');
          const howMany = parseInt(howManyInput);
          if (isNaN(howMany) || howMany <= 0) {
            console.log('❌ Invalid number.');
            await tx.rollback(); await session.close();
            break;
          }

          for (let i = 0; i < howMany; i++) {
            console.log(`\n👶 Child ${i + 1} of ${howMany}`);

            const nameInput = await question('  First Name: ');
            const lastNameInput = await question('  Last Name: ');
            const genderInput = await askValidatedQuestion('  Gender (Male/Female): ', ['male', 'female', 'm', 'f']);
            const isAliveInput = await askValidatedQuestion('  Is Alive? (yes/no): ', ['yes', 'no', 'y', 'n', 'true', 'false']);

            const name = formatName(nameInput);
            const lastName = formatName(lastNameInput);
            const gender = ['male', 'm'].includes(genderInput.toLowerCase()) ? 'Male' : 'Female';
            const isAlive = ['yes', 'y', 'true'].includes(isAliveInput.toLowerCase());

            const YoBInput = await question('  Year of Birth (optional): ');
            const YoB = YoBInput.trim() && !isNaN(YoBInput) ? parseInt(YoBInput) : undefined;

            let YoB_confidence;
            if (YoB !== undefined) {
              const YoBConfInput = await question('  YoB Confidence (optional): ');
              if (YoBConfInput.trim() && !isNaN(YoBConfInput)) {
                YoB_confidence = parseFloat(YoBConfInput);
              }
            }

            let YoD;
            if (!isAlive) {
              const YoDInput = await question('  Year of Death (optional): ');
              if (YoDInput.trim() && !isNaN(YoDInput)) {
                YoD = parseInt(YoDInput);
              }
            }

            const WorkCountryInput = await question('  Work Country (optional): ');
            const nicknameInput = await question('  Nickname (optional): ');
            const notesInput = await question('  Notes (optional): ');

            const WorkCountry = WorkCountryInput.trim() || undefined;
            const nickname = nicknameInput.trim() || undefined;
            const notes = notesInput.trim() || undefined;

            // Create child person
            const childId = await createPerson({
              name,
              lastName,
              gender,
              isAlive,
              YoB,
              YoD,
              WorkCountry,
              nickname,
              notes,
              YoB_confidence
            });

            const childFullName = `${name} ${lastName}`;

            // Link to father (within transaction)
            if (fatherId !== null) {
              await tx.run(
                `
                MATCH (father:Person), (child:Person)
                WHERE id(father) = $fatherId AND id(child) = $childId
                MERGE (father)-[:FATHER_OF]->(child)
                `,
                { fatherId, childId }
              );
            }

            // Link to mother
            if (motherId !== null) {
              await tx.run(
                `
                MATCH (mother:Person), (child:Person)
                WHERE id(mother) = $motherId AND id(child) = $childId
                MERGE (mother)-[:MOTHER_OF]->(child)
                `,
                { motherId, childId }
              );
            }

            console.log(`✅ Child ${childFullName} created and linked.`);
          }

          await tx.commit();
          await session.close();
        } catch (err) {
          console.error('❌ Error linking children:', err);
          await tx.rollback();
          await session.close();
        }

        break;
      }
      case '9':
        console.log('🔍 Starting MOTHER_OF relationships verification...');
        await verifyMotherOf(driver);
        break;

      case '10':
        console.log('🔍 Starting MARRIED_TO relationships verification...');
        await verifyMarriedTo(driver);
        break;

      case '-1':
        console.log('👋 Exiting...');
        rl.close();
        return;

      default:
        console.log('⚠️ Invalid option, please try again.');
    }
  }
}


terminalConversation();

