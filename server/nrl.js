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

const createParentChildRelationship = async (parentFullName, childFullName, relationshipLabel) => {
  const [parentFirst, ...parentLastArr] = parentFullName.trim().split(' ');
  const [childFirst, ...childLastArr] = childFullName.trim().split(' ');
  const parentFirstName = formatName(parentFirst);
  const parentLastName = formatName(parentLastArr.join(' '));
  const childFirstName = formatName(childFirst);
  const childLastName = formatName(childLastArr.join(' '));

  try {
    const parentCandidates = await getPeopleWithSameName(parentFirstName, parentLastName);
    const childCandidates = await getPeopleWithSameName(childFirstName, childLastName);

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

    const result = await session.run(
      `
      MATCH (parent:Person), (child:Person)
      WHERE id(parent) = $parentId AND id(child) = $childId
      MERGE (parent)-[:${relationshipLabel}]->(child)
      RETURN parent.name AS parentName, child.name AS childName
      `,
      { parentId: parentId, childId: childId }
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
}) => {
  if (!name || !lastName || !gender || isAlive === undefined) {
    console.error('❌ Missing required fields (name, lastName, gender, isAlive)');
    return;
  }

  // Format & sanitize
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
    const result = await session.run(
      `CREATE (person:Person {${cypherFields}}) RETURN person`,
      props
    );
    if (result.records.length > 0) {
      console.log(`✅ Created person: ${props.name} ${props.lastName}`);
    } else {
      console.log('⚠️ Person not created.');
    }
  } catch (err) {
    console.error('❌ Error creating person:', err);
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
  linkChildren = false // new param, default false
) => {
  const [maleFirst, ...maleLastArr] = maleFullName.trim().split(' ');
  const [femaleFirst, ...femaleLastArr] = femaleFullName.trim().split(' ');

  const maleFirstName = formatName(maleFirst);
  const maleLastName = formatName(maleLastArr.join(' '));
  const femaleFirstName = formatName(femaleFirst);
  const femaleLastName = formatName(femaleLastArr.join(' '));

  try {
    const maleCandidates = await getPeopleWithSameName(maleFirstName, maleLastName);
    const femaleCandidates = await getPeopleWithSameName(femaleFirstName, femaleLastName);

    if (maleCandidates.length === 0 || femaleCandidates.length === 0) {
      console.log('❌ Male or female person not found.');
      return;
    }

    const maleId = maleCandidates.length > 1
      ? await promptUserForSelection(maleCandidates)
      : maleCandidates[0].personId;

    const femaleId = femaleCandidates.length > 1
      ? await promptUserForSelection(femaleCandidates)
      : femaleCandidates[0].personId;

    const result = await session.run(
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
        maleId: maleId.toNumber ? maleId.toNumber() : maleId,
        femaleId: femaleId.toNumber ? femaleId.toNumber() : femaleId,
        ...(marriageYear !== null ? { marriageYear } : {}),
        status,
        ...(endYear !== null ? { endYear } : {})
      }
    );

    if (result.records.length > 0) {
      console.log(`✅ Created MARRIED_TO between ${maleFullName} and ${femaleFullName} (${status}${marriageYear ? `, ${marriageYear}` : ''}${endYear ? ` – ${endYear}` : ''})`);

      if (linkChildren) {
        await session.run(
          `
          MATCH (father:Person)-[:FATHER_OF]->(child)
          WHERE id(father) = $maleId
          AND NOT ( (child)<-[:MOTHER_OF]-(:Person) )
          MATCH (mother:Person) WHERE id(mother) = $femaleId
          CREATE (mother)-[:MOTHER_OF]->(child)
          `,
          { maleId: maleId.toNumber ? maleId.toNumber() : maleId, femaleId: femaleId.toNumber ? femaleId.toNumber() : femaleId }
        );

        await session.run(
          `
          MATCH (mother:Person)-[:MOTHER_OF]->(child)
          WHERE id(mother) = $femaleId
          AND NOT ( (child)<-[:FATHER_OF]-(:Person) )
          MATCH (father:Person) WHERE id(father) = $maleId
          CREATE (father)-[:FATHER_OF]->(child)
          `,
          { maleId: maleId.toNumber ? maleId.toNumber() : maleId, femaleId: femaleId.toNumber ? femaleId.toNumber() : femaleId }
        );

        console.log('🔗 All children linked to both parents where missing.');
      }

    } else {
      console.log('⚠️ Marriage not created — check selected persons.');
    }
  } catch (err) {
    console.error('❌ Error creating MARRIED_TO relationship:', err);
  }
};


const getPeopleWithSameName = async (name, lastName) => {
  const query = `
    MATCH (p:Person {name: $name, lastName: $lastName})
    OPTIONAL MATCH (father:Person)-[:FATHER_OF]->(p)
    OPTIONAL MATCH (grandfather:Person)-[:FATHER_OF]->(father)
    RETURN id(p) AS personId, 
           p.name AS personName, p.lastName AS lastName,
           father.name AS fatherName, 
           grandfather.name AS grandfatherName
  `;

  const result = await session.run(query, { name, lastName });

  // Map the result records to include the person's ID and other information
  const people = result.records.map(record => ({
    personId: record.get('personId'),
    personName: record.get('personName'),
    lastName: record.get('lastName'),
    fatherName: record.get('fatherName'),
    grandfatherName: record.get('grandfatherName')
  }));

  return people;
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


async function askValidatedQuestion(prompt, validAnswers) {
  while (true) {
    const answer = (await question(prompt)).trim().toLowerCase();
    if (validAnswers.includes(answer)) {
      return answer;
    }
    console.log(`Please enter one of the following: ${validAnswers.join(', ')}`);
  }
}

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
        await createParentChildRelationship(fatherFullName, childFullName, "FATHER_OF");
        break;
      }

      case '3': {
        const motherFullNameRaw = await question('Mother Full Name (First Last): ');
        const childFullNameRaw = await question('Child Full Name (First Last): ');
        const motherFullName = formatFullName(motherFullNameRaw);
        const childFullName = formatFullName(childFullNameRaw);
        await createParentChildRelationship(motherFullName, childFullName, "MOTHER_OF");
        break;
      }

      case '4': {
        const maleFullNameRaw = await question('Husband Full Name (First Last): ');
        const femaleFullNameRaw = await question('Wife Full Name (First Last): ');
        const marriageYearInput = await question('Year of Marriage: ');
        const statusInput = await question("Marriage Status ('married', 'divorced', 'widowed', 'historical'): ");
        const status = statusInput.trim().toLowerCase();
        let endYearInput;
        let endYear;
        if (status !== 'married') {
          endYearInput = await question('Year of End (leave empty if not ended): ');
          if (endYearInput.trim() && !isNaN(endYearInput)) {
            endYear = parseInt(endYearInput);
          }
        }

        const maleFullName = formatFullName(maleFullNameRaw);
        const femaleFullName = formatFullName(femaleFullNameRaw);

        const marriageYear = marriageYearInput.trim() && !isNaN(marriageYearInput) ? parseInt(marriageYearInput) : null;
         endYear = !isNaN(endYearInput) ? parseInt(endYearInput) : null;

        if (!status || !['married', 'divorced', 'widowed', 'historical', 'm', 'd', 'w', 'h'].includes(status)) {
          console.log("⚠️ Invalid input. 'Status' is required.");
          break;
        }
        const linkChildrenInput = await question('Link all children between husband and wife? (yes/no): ');
        const linkChildren = ['yes', 'y', 'true', 't'].includes(linkChildrenInput.trim().toLowerCase());

        await createMarriage(maleFullName, femaleFullName, marriageYear, status, endYear, linkChildren);
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
  const fatherFullNameRaw = await question('Father Full Name (First Last, leave empty if none): ');
  const motherFullNameRaw = await question('Mother Full Name (First Last, leave empty if none): ');

  const fatherFullName = fatherFullNameRaw.trim() ? formatFullName(fatherFullNameRaw) : null;
  const motherFullName = motherFullNameRaw.trim() ? formatFullName(motherFullNameRaw) : null;

  if (!fatherFullName && !motherFullName) {
    console.log('❌ At least one parent is required.');
    break;
  }

  const howManyInput = await question('How many children do you want to add? ');
  const howMany = parseInt(howManyInput);
  if (isNaN(howMany) || howMany <= 0) {
    console.log('❌ Invalid number.');
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

    const childFullName = `${name} ${lastName}`;

    if (fatherFullName) {
      await createParentChildRelationship(fatherFullName, childFullName, "FATHER_OF");
    }

    if (motherFullName) {
      await createParentChildRelationship(motherFullName, childFullName, "MOTHER_OF");
    }

    console.log(`✅ Child ${childFullName} created and linked.`);
  }

  break;
}

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

