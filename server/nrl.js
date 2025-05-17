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
  WorkCountry
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


const createMarriage = async (maleFullName, femaleFullName, marriageYear = null, status, endYear = null) => {
  const [maleFirst, ...maleLastArr] = maleFullName.trim().split(' ');
  const [femaleFirst, ...femaleLastArr] = femaleFullName.trim().split(' ');

  const maleFirstName = formatName(maleFirst);
  const maleLastName = formatName(maleLastArr.join(' '));
  const femaleFirstName = formatName(femaleFirst);
  const femaleLastName = formatName(femaleLastArr.join(' '));

  try {
    // Find all male candidates with the given first and last name
    const maleCandidates = await getPeopleWithSameName(maleFirstName, maleLastName);
    // Find all female candidates with the given first and last name
    const femaleCandidates = await getPeopleWithSameName(femaleFirstName, femaleLastName);

    if (maleCandidates.length === 0 || femaleCandidates.length === 0) {
      console.log('❌ Male or female person not found.');
      return;
    }

    // If multiple male candidates, prompt user to select
    const maleId = maleCandidates.length > 1
      ? await promptUserForSelection(maleCandidates)
      : maleCandidates[0].personId;

    // If multiple female candidates, prompt user to select
    const femaleId = femaleCandidates.length > 1
      ? await promptUserForSelection(femaleCandidates)
      : femaleCandidates[0].personId;

    // Create marriage relationship in Neo4j using internal node IDs
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
          rl.close();
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
    console.log('1. Create Person');
    console.log('2. Create Father-Child Relationship');
    console.log('3. Create Mother-Child Relationship');
    console.log('4. Create Marriage');
    console.log('5. Exit');

    const choice = (await question('Enter option number: ')).trim();

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
        const YoDInput = await question('Year of Death (optional): ');
        const WorkCountryInput = await question('Work Country (optional): ');

        const YoB = YoBInput.trim() && !isNaN(YoBInput) ? parseInt(YoBInput) : undefined;
        const YoD = YoDInput.trim() && !isNaN(YoDInput) ? parseInt(YoDInput) : undefined;
        const WorkCountry = WorkCountryInput.trim() || undefined;

        await createPerson({
          name,
          lastName,
          gender,
          isAlive,
          YoB,
          YoD,
          WorkCountry
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
        const statusInput = await question("Marriage Status ('married', 'divorced', 'widowed'): ");
        const endYearInput = await question('Year of End (leave empty if not ended): ');

        const maleFullName = formatFullName(maleFullNameRaw);
        const femaleFullName = formatFullName(femaleFullNameRaw);

        const marriageYear = marriageYearInput.trim() && !isNaN(marriageYearInput) ? parseInt(marriageYearInput) : null;
        const status = statusInput.trim().toLowerCase();
        const endYear = endYearInput.trim() && !isNaN(endYearInput) ? parseInt(endYearInput) : null;

        if (!status || !['married', 'divorced', 'widowed'].includes(status)) {
          console.log("⚠️ Invalid input. 'Status' is required.");
          break;
        }

        await createMarriage(maleFullName, femaleFullName, marriageYear, status, endYear);
        break;
      }

      case '5':
        console.log('👋 Exiting...');
        rl.close();
        return;

      default:
        console.log('⚠️ Invalid option, please try again.');
    }
  }
}


terminalConversation();

