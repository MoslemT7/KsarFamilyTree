const neo4j = require('neo4j-driver');
const { type } = require('os');
const readline = require('readline');


// Initialize the Neo4j driver
const driver = neo4j.driver(
  'neo4j+s://2cd0ce39.databases.neo4j.io',  // URI of the Neo4j server
  neo4j.auth.basic('neo4j', 'nW1azrzTK-lrTOO5G1uOkUVFwelcQlEmKPHggPUB7xQ')
);

// Create a session to run queries
const session = driver.session();

// Function to create a Father-Child relationship
const createFatherChildRelationship = async (fatherFullName, childFullName) => {
  const [fatherFirstName, ...fatherLastParts] = fatherFullName.trim().split(' ');
  const [childFirstName, ...childLastParts] = childFullName.trim().split(' ');
  const fatherLastName = fatherLastParts.join(' ');
  const childLastName = childLastParts.join(' ');

  try {
    const fatherCandidates = await getPeopleWithSameName(fatherFirstName, fatherLastName);
    const childCandidates = await getPeopleWithSameName(childFirstName, childLastName);

    if (fatherCandidates.length === 0 || childCandidates.length === 0) {
      console.log('❌ Either father or child not found.');
      return;
    }

    // If multiple fathers or children, prompt for selection, otherwise just take the first one
    let selectedFatherId;
    if (fatherCandidates.length > 1) {
      selectedFatherId = await promptUserForSelection(fatherCandidates);  // Prompt will return the selected ID
    } else {
      selectedFatherId = fatherCandidates[0].personId;  // Directly use the ID if only one
    }

    let selectedChildId;
    if (childCandidates.length > 1) {
      selectedChildId = await promptUserForSelection(childCandidates);  // Prompt will return the selected ID
    } else {
      selectedChildId = childCandidates[0].personId;  // Directly use the ID if only one
    }

    // Check that the selected IDs are valid
    const fatherId = selectedFatherId.toNumber();
    const childId = selectedChildId.toNumber();

    console.log("Selected Father ID:", fatherId, typeof(fatherId));
    console.log("Selected Child ID:", childId);

    const createQuery = `
      MATCH (father:Person), (child:Person)
      WHERE id(father) = ${fatherId} AND id(child) = ${childId}
      MERGE (father)-[:FATHER_OF]->(child)
      RETURN father.name AS father, child.name AS child
    `;

    // Run the query with the split ID values
    const result = await session.run(createQuery, {
      fatherId: fatherId,
      childId: childId
    });

    console.log(`✅ Created father-child relationship between ${fatherFullName} and ${childFullName}`);

  } catch (error) {
    console.error('Error creating relationship:', error);
  }
};

const createPerson = async (name, lastName, gender) => {
  try {

    const result = await session.run(
      `
      CREATE (person:Person {name: $name, lastName: $lastName, gender: $gender})
      RETURN person
      `,
      { name: name, lastName, gender }
    );

    if (result.records.length > 0) {
      console.log(`✅ Created person: ${name} ${lastName}, Gender: ${gender}`);
    } else {
      console.log(`⚠️ Could not create person.`);
    }
  } catch (error) {
    console.error('❌ Error creating person:', error);
  }
};

const createMotherChildRelationship = async (motherFullName, childFullName) => {
  const [motherFirstName, ...fatherLastParts] = motherFullName.trim().split(' ');
  const [childFirstName, ...childLastParts] = childFullName.trim().split(' ');
  const motherLastName = fatherLastParts.join(' ');
  const childLastName = childLastParts.join(' ');

  try {
    const motherCandidates = await getPeopleWithSameName(motherFirstName, motherLastName);
    const childCandidates = await getPeopleWithSameName(childFirstName, childLastName);

    if (motherCandidates.length === 0 || childCandidates.length === 0) {
      console.log('❌ Either father or child not found.');
      return;
    }

    // If multiple fathers or children, prompt for selection, otherwise just take the first one
    let selectedMotherId;
    if (motherCandidates.length > 1) {
      selectedMotherId = await promptUserForSelection(motherCandidates);  // Prompt will return the selected ID
    } else {
      selectedMotherId = motherCandidates[0].personId;  // Directly use the ID if only one
    }

    let selectedChildId;
    if (childCandidates.length > 1) {
      selectedChildId = await promptUserForSelection(childCandidates);  // Prompt will return the selected ID
    } else {
      selectedChildId = childCandidates[0].personId;  // Directly use the ID if only one
    }

    // Check that the selected IDs are valid
    const motherId = selectedMotherId.toNumber();
    const childId = selectedChildId.toNumber();

    console.log("Selected Father ID:", motherId, typeof(motherId));
    console.log("Selected Child ID:", childId);

    const createQuery = `
      MATCH (mother:Person), (child:Person)
      WHERE id(mother) = ${motherId} AND id(child) = ${childId}
      MERGE (mother)-[:MOTHER_OF]->(child)
      RETURN mother.name AS mother, child.name AS child
    `;

    // Run the query with the split ID values
    const result = await session.run(createQuery, {
      motherId: motherId,
      childId: childId
    });

    console.log(`✅ Created mother-child relationship between ${motherFullName} ->MOTHER_OF-> ${childFullName}`);

  } catch (error) {
    console.error('Error creating relationship:', error);
  }
};

const getFather = async (personFullName) => {
  try {
    const [name, lastName] = personFullName.trim().split(' ');

    const result = await session.run(
      `
      MATCH (child:Person {name: $name, lastName: $lastName})
      MATCH (father:Person)-[:FATHER_OF]->(child)
      RETURN father.name AS fatherName, father.lastName AS fatherLastName
      `,
      { name, lastName }
    );

    if (result.records.length > 0) {
      const father = result.records[0].get('fatherName') + ' ' + result.records[0].get('fatherLastName');
      console.log(`Father of ${personFullName}: ${father}`);
      return father;
    } else {
      console.log(`No father found for ${personFullName}`);
      return null;
    }
  } catch (error) {
    console.error('❌ Error fetching father:', error);
  }
};

const getMother = async (personFullName) => {
  try {
    const [name, lastName] = personFullName.trim().split(' ');

    const result = await session.run(
      `
      MATCH (child:Person {name: $name, lastName: $lastName})
      MATCH (mother:Person)-[:MOTHER_OF]->(child)
      RETURN mother.name AS motherName, mother.lastName AS motherLastName
      `,
      { name, lastName }
    );

    if (result.records.length > 0) {
      const mother = result.records[0].get('motherName') + ' ' + result.records[0].get('motherLastName');
      console.log(`Mother of ${personFullName}: ${mother}`);
      return mother;
    } else {
      console.log(`No mother found for ${personFullName}`);
      return null;
    }
  } catch (error) {
    console.error('❌ Error fetching mother:', error);
  }
};

const getGrandMother = async (personFullName) => {
  try {
    const [name, lastName] = personFullName.trim().split(' ');

    // Get maternal grandmother (mother of the mother)
    const maternalGrandmotherResult = await session.run(
      `
      MATCH (child:Person {name: $name, lastName: $lastName})
      MATCH (child)-[:MOTHER_OF]->(mother)
      MATCH (mother)-[:MOTHER_OF]->(grandmother)
      RETURN grandmother.name AS grandmotherName, grandmother.lastName AS grandmotherLastName
      `,
      { name, lastName }
    );

    // Get paternal grandmother (mother of the father)
    const paternalGrandmotherResult = await session.run(
      `
      MATCH (child:Person {name: $name, lastName: $lastName})
      MATCH (child)-[:FATHER_OF]->(father)
      MATCH (father)-[:MOTHER_OF]->(grandmother)
      RETURN grandmother.name AS grandmotherName, grandmother.lastName AS grandmotherLastName
      `,
      { name, lastName }
    );

    let maternalGrandmother = null;
    let paternalGrandmother = null;

    if (maternalGrandmotherResult.records.length > 0) {
      maternalGrandmother = maternalGrandmotherResult.records[0].get('grandmotherName') + ' ' + maternalGrandmotherResult.records[0].get('grandmotherLastName');
    }

    if (paternalGrandmotherResult.records.length > 0) {
      paternalGrandmother = paternalGrandmotherResult.records[0].get('grandmotherName') + ' ' + paternalGrandmotherResult.records[0].get('grandmotherLastName');
    }

    console.log(`Maternal Grandmother of ${personFullName}: ${maternalGrandmother}`);
    console.log(`Paternal Grandmother of ${personFullName}: ${paternalGrandmother}`);

    return { maternalGrandmother, paternalGrandmother };
  } catch (error) {
    console.error('❌ Error fetching grandmothers:', error);
  }
};

const createMarriage = async (maleFullName, femaleFullName) => {
  try {
    const [maleName, maleLastName] = maleFullName.trim().split(' ');
    const [femaleName, femaleLastName] = femaleFullName.trim().split(' ');

    const result = await session.run(
      `
      MATCH (husband:Person {name: $maleName, lastName: $maleLastName})
      MATCH (wife:Person {name: $femaleName, lastName: $femaleLastName})
      MERGE (wife)-[:WIFE_OF]->(husband)
      MERGE (husband)-[:HUSBAND_OF]->(wife)
      RETURN wife, husband
      `,
      { maleName, maleLastName, femaleName, femaleLastName }
    );

    if (result.records.length > 0) {
      console.log(`✅ Created relationship: ${maleFullName} → Are Married to → ${femaleFullName}`);
    } else {
      console.log(`⚠️ Could not create relationship — one or both persons not found.`);
    }
  } catch (error) {
    console.error('❌ Error creating MARRIED relationship:', error);
  }
};

const getGender = async (fullName) => {
  const session = driver.session(); // Open a session

  try {
    // Split the full name into first and last name
    const [firstName, lastName] = fullName.split(" ");

    // Run the query using both first name and last name
    const result = await session.run(
      `MATCH (p:Person) WHERE toLower(p.name) = toLower($firstName) AND toLower(p.lastName) = toLower($lastName) RETURN p.gender AS gender`,
      { firstName, lastName }
    );
    
    if (result.records.length > 0) {
      const gender = result.records[0].get('gender');
      // console.log(`Gender of ${fullName}: ${gender}`);
      return gender; // Return the gender value
    } else {
      console.log(`No person found with the name ${fullName}`);
      return null; // Return null when no person is found
    }
  } catch (error) {
    console.error('Error retrieving gender:', error);
    return null; // Return null in case of an error
  } finally {
    await session.close(); // Always close the session after the query
  }
};

const getHusbandID = async (wifeID) => {
  try {
    const result = await session.run(
      `
        MATCH (wife:Person)-[:WIFE_OF]->(husband:Person)
        WHERE id(wife) = $wifeID
        RETURN id(husband) AS husbandID
      `,
      { wifeID: neo4j.int(wifeID) }
    );

    if (result.records.length > 0) {
      console.log("Husband ID is : ", result.records[0].get('husbandID').toNumber());
      return result.records[0].get('husbandID').toNumber();
    } else {
      return null; // No husband found
    }
  } catch (error) {
    console.error('Error fetching husband ID:', error);
    return null;
  }
};

const getAncestorFullName = (personAncestors, level) => {
  // Check if the ancestor exists at the given level
  if (!personAncestors[level - 1] || !personAncestors[level - 1].properties) {
    return `Unknown (Level: ${level})`;
  }

  const ancestor = personAncestors[level - 1].properties;
  const name = ancestor.name || "Unknown"; // Default to "Unknown" if name is missing
  const lastName = ancestor.lastName || "Unknown"; // Default to "Unknown" if lastName is missing

  return `${name} ${lastName}`;
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

// Function to prompt user to select the correct person
const promptUserForSelection = (people) => {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    console.log("Multiple people found with the same name. Please select the correct one:");
    console.log(people);
    people.forEach((person, index) => {
      console.log(`${index + 1}: ${person.personName} ben ${person.fatherName || 'Unknown'} ben ${person.grandfatherName || 'Unknown'} ${person.lastName}`);
    });

    rl.question('Please select the number of the correct person: ', (answer) => {
      const selectedIndex = parseInt(answer) - 1;
      // Extract the correct ID
      const selectedPersonId = people[selectedIndex].personId;

      rl.close();
      resolve(selectedPersonId); // Resolve with the ID
    });
  });
};



const getRelationship = async (person1FullName, person2FullName) => {
  const gender1 = await getGender(person1FullName);
  const gender2 = await getGender(person2FullName);
  try {
    const [person1Name, person1LastName] = person1FullName.trim().split(' ');
    const [person2Name, person2LastName] = person2FullName.trim().split(' ');

    console.log(`Looking up relationship between: ${person1FullName} and ${person2FullName}`);

    // Function to get the parents/ancestors of a person
    const getAncestors = async (personName, personLastName, maxLevels) => {
      const ancestors = [];
      let currentPersonName = personName;
      let currentPersonLastName = personLastName;

      for (let level = 0; level < maxLevels; level++) {
        // Query the parents of the current person
        const parentResult = await session.run(`
          MATCH (parent)-[:FATHER_OF|MOTHER_OF*]->(p:Person {name: $currentPersonName, lastName: $currentPersonLastName})
          RETURN parent
        `, { currentPersonName, currentPersonLastName });

        if (parentResult.records.length > 0) {
          const parent = parentResult.records[0].get('parent');
          ancestors.push(parent);
          currentPersonName = parent.properties.name;
          currentPersonLastName = parent.properties.lastName;
        } else {
          break; // If no parent is found, stop the search
        }
      }

      return ancestors;
    };

    // Get the ancestors for both persons
    const maxLevels = 4; // Adjust the maximum levels to go up the tree
    let person1Ancestors = await getAncestors(person1Name, person1LastName, maxLevels);
    let person2Ancestors = await getAncestors(person2Name, person2LastName, maxLevels);

    console.log(`Person 1 Ancestors: ${person1Ancestors.map(a => a.properties.name).join(' ben ')}`);
    console.log(`Person 2 Ancestors: ${person2Ancestors.map(a => a.properties.name).join(' ben ')}`);

    // Check for common ancestors between the two persons
    for (let i = 0; i < person1Ancestors.length; i++) {
      for (let j = 0; j < person2Ancestors.length; j++) {
        if (person1Ancestors[i].identity.equals(person2Ancestors[j].identity)) {
          // Found a common ancestor, calculate their relationship
          var p1Level = i+1;
          var p2Level = j+1;
          
          console.log(`Level: (${p1Level}, ${p2Level})`);

          // Check for the relationship based on levels and gender

          // FATHER 
          if (p1Level === 0 && p2Level === 1) {
            if (gender1 === 'Male'){
              console.log(`${person1FullName} is ${person2FullName}'s father.`);
              return `${person1FullName} is ${person2FullName}'s father`;
            }
            else{
              console.log(`${person1FullName} is ${person2FullName}'s mother.`);
              return `${person1FullName} is ${person2FullName}'s mother`;
            }
          }

          else if (p1Level === 1 && p2Level === 0) {
            if (gender1 === 'Male'){
              console.log(`${person1FullName} is ${person2FullName}'s son.`);
              return `${person1FullName} is ${person2FullName}'s son`;
            }
            else{
              console.log(`${person1FullName} is ${person2FullName}'s daughter.`);
              return `${person1FullName} is ${person2FullName}'s daughter`;
            }
          } 

          else if (p1Level === 2 && p2Level === 0) {
            if (gender1 === 'Male'){
              console.log(`${person1FullName} is ${person2FullName}'s grandson.`);
              return `${person1FullName} is ${person2FullName}'s grandson`;
            }
            else{
              console.log(`${person1FullName} is ${person2FullName}'s granddaughter.`);
              return `${person1FullName} is ${person2FullName}'s granddaughter`;
            }
          }

          else if (p1Level === 0 && p2Level === 2) {
            if (gender1 === 'Male'){
              console.log(`${person1FullName} is ${person2FullName}'s grandfather.`);
              return `${person1FullName} is ${person2FullName}'s grandfather`;
            }
            else{
              console.log(`${person1FullName} is ${person2FullName}'s grandmother.`);
              return `${person1FullName} is ${person2FullName}'s grandmother`;
            }
          }

          else if (p1Level === 3 && p2Level === 0) {
            if (gender1 === 'Male'){
              console.log(`${person1FullName} is ${person2FullName}'s great-grandson.`);
              return `${person1FullName} is ${person2FullName}'s great-grandson`;
            }
            else{
              console.log(`${person1FullName} is ${person2FullName}'s great-granddaughter.`);
              return `${person1FullName} is ${person2FullName}'s great-granddaughter`;
            }
          }

          else if (p1Level === 0 && p2Level === 3) {
            if (gender1 === 'Male'){
              console.log(`${person1FullName} is ${person2FullName}'s great-grandfather.`);
              return `${person1FullName} is ${person2FullName}'s great-grandfather`;
            }
            else{
              console.log(`${person1FullName} is ${person2FullName}'s great-grandmother.`);
              return `${person1FullName} is ${person2FullName}'s great-grandmother`;
            }
          } 
          
          else if (p1Level === 1 && p2Level === 1) {
            if (gender1 === 'Male' && gender2 === 'Male'){
              console.log(`${person1FullName} and ${person2FullName} are brothers.`);
              return `${person1FullName} and ${person2FullName} are brothers`;
            }
            else if (gender1 === 'Female' && gender2 === 'Female'){
              console.log(`${person1FullName} and ${person2FullName} are sisters.`);
              return `${person1FullName} and ${person2FullName} are sisters`;
            }
            else{
              console.log(`${person1FullName} and ${person2FullName} are siblings.`);
              return `${person1FullName} and ${person2FullName} are siblings`;
            }
          } 
          
          else if (p1Level === 2 && p2Level === 1) {
            if (gender1 === 'Male'){
              console.log(`${person1FullName} is ${person2FullName}'s nephew.`);
              return `${person1FullName} is ${person2FullName}'s nephew`;
            }
            else{
              console.log(`${person1FullName} is ${person2FullName}'s niece.`);
              return `${person1FullName} is ${person2FullName}'s niece`;
            }
          } 
          
          else if (p1Level === 1 && p2Level === 2) {
            if (gender1 === 'Male'){
              console.log(`${person1FullName} is ${person2FullName}'s uncle.`);
              return `${person1FullName} is ${person2FullName}'s uncle`;
            }
            else{
              console.log(`${person1FullName} is ${person2FullName}'s aunt.`);
              return `${person1FullName} is ${person2FullName}'s aunt`;
            }
          }

          else if (p1Level === 2 && p2Level === 2) {
            console.log(`${person1FullName} and ${person2FullName} are cousins.`);
          
            const p1AncestorFullName = getAncestorFullName(person1Ancestors, 1);
            const p1AncestorGender = await getGender(p1AncestorFullName);

            const p2AncestorFullName = getAncestorFullName(person2Ancestors, 1);
            const p2AncestorGender = await getGender(p2AncestorFullName);

            if (gender1 === 'Male') { 
              if (p1AncestorGender === 'Male') { 
                if (p2AncestorGender === 'Male'){  // ولد عمه
                  console.log(`${person1FullName} is ${person2FullName}'s paternal uncle's son.`);
                  return `${person1FullName} is ${person2FullName}'s paternal uncle's son`;
                }
                else{ // ولد عمته
                  console.log(`${person1FullName} is ${person2FullName}'s paternal aunt's son.`);
                  return `${person1FullName} is ${person2FullName}'s paternal aunt's son`;
                }
              } 
              else {  
                if (p2AncestorGender === 'Male'){  // ولد خاله
                  console.log(`${person1FullName} is ${person2FullName}'s maternal uncle's son.`);
                  return `${person1FullName} is ${person2FullName}'s maternal uncle's son`;
                }
                else{ // ولد خالته
                  console.log(`${person1FullName} is ${person2FullName}'s maternal aunt's son.`);
                  return `${person1FullName} is ${person2FullName}'s maternal aunt's son`;
                }
              }
            }
            else {
              if (p1AncestorGender === 'Male') { 
                if (p2AncestorGender === 'Male'){  // بنت عمه
                  console.log(`${person1FullName} is ${person2FullName}'s paternal uncle's daughter.`);
                  return `${person1FullName} is ${person2FullName}'s paternal uncle's daughter`;
                }
                else{ // بنت عمته
                  console.log(`${person1FullName} is ${person2FullName}'s paternal aunt's daughter.`);
                  return `${person1FullName} is ${person2FullName}'s paternal aunt's daughter`;
                }
              } 
              else {  
                if (p2AncestorGender === 'Male'){  // بنت خاله
                  console.log(`${person1FullName} is ${person2FullName}'s maternal uncle's daughter.`);
                  return `${person1FullName} is ${person2FullName}'s maternal uncle's daughter`;
                }
                else{ // بنت خالته
                  console.log(`${person1FullName} is ${person2FullName}'s maternal aunt's daughter.`);
                  return `${person1FullName} is ${person2FullName}'s maternal aunt's daughter`;
                }
              }
            }
          }

          else if (p1Level === 2 && p2Level === 3) {          
            const p1AncestorFullName = getAncestorFullName(person1Ancestors, 1);
            const p1AncestorGender = await getGender(p1AncestorFullName);

            const p2AncestorFullName = getAncestorFullName(person2Ancestors, 1);
            const p2AncestorGender = await getGender(p2AncestorFullName);

            if (gender1 === 'Male') { 
              
              if (p1AncestorGender === 'Male') {  // father's side
                if (p2AncestorGender === 'Male') {  // father's brother's son
                  console.log(`${person1FullName} is ${person2FullName}'s father paternal uncle's son.`);
                  return `${person1FullName} is ${person2FullName}'s father paternal uncle's son`;
                } else {  // father's brother's daughter
                  console.log(`${person1FullName} is ${person2FullName}'s father paternal uncle's son.`);
                  return `${person1FullName} is ${person2FullName}'s father paternal uncle's son`;
                }
              } else {  // mother's side
                if (p2AncestorGender === 'Male') {  // mother's brother's son
                  console.log(`${person1FullName} is ${person2FullName}'s father paternal uncle's son.`);
                  return `${person1FullName} is ${person2FullName}'s father paternal uncle's son.`;
                } else {  // mother's brother's daughter
                  console.log(`${person1FullName} is ${person2FullName}'s maternal aunt's son.`);
                  return `${person1FullName} is ${person2FullName}'s maternal aunt's son`;
                }
              }
            } else {  // If person1 is female
            
              if (p1AncestorGender === 'Male') {  // father's side
                if (p2AncestorGender === 'Male') {  // father's brother's son
                  console.log(`${person1FullName} is ${person2FullName}'s paternal uncle's daughter.`);
                  return `${person1FullName} is ${person2FullName}'s paternal uncle's daughter`;
                } else {  // father's brother's daughter
                  console.log(`${person1FullName} is ${person2FullName}'s paternal aunt's daughter.`);
                  return `${person1FullName} is ${person2FullName}'s paternal aunt's daughter`;
                }
              } else {  // mother's side
                if (p2AncestorGender === 'Male') {  // mother's brother's son
                  console.log(`${person1FullName} is ${person2FullName}'s maternal uncle's daughter.`);
                  return `${person1FullName} is ${person2FullName}'s maternal uncle's daughter`;
                } else {  // mother's brother's daughter
                  console.log(`${person1FullName} is ${person2FullName}'s maternal aunt's daughter.`);
                  return `${person1FullName} is ${person2FullName}'s maternal aunt's daughter`;
                }
              }
            }
            
          }
          
          else if (p1Level === 3 && p2Level === 2) {          
            const p1AncestorFullName = getAncestorFullName(person1Ancestors, 1);
            const p1AncestorGender = await getGender(p1AncestorFullName);

            const p2AncestorFullName = getAncestorFullName(person2Ancestors, 1);
            const p2AncestorGender = await getGender(p2AncestorFullName);

            if (gender1 === 'Male') { 
              if (p1AncestorGender === 'Male') {  // father's side
                if (p2AncestorGender === 'Male') {  // father's brother's son
                  console.log(`${person1FullName}'s father is ${person2FullName}'s paternal uncle's son.`);
                  return `${person1FullName}'s father is ${person2FullName}'s paternal uncle's son`;
                } else {  // father's brother's daughter
                  console.log(`${person1FullName}'s father is ${person2FullName}'s paternal uncle's son.`);
                  return `${person1FullName}'s father is ${person2FullName}'s paternal uncle's son`;
                }
              } else {  // mother's side
                if (p2AncestorGender === 'Male') {  // mother's brother's son
                  console.log(`${person1FullName}'s father is ${person2FullName}'s maternal uncle's son.`);
                  return `${person1FullName}'s father is ${person2FullName}'s maternal uncle's son.`;
                } else {  // mother's brother's daughter
                  console.log(`${person1FullName}'s mother is ${person2FullName}'s maternal aunt's son.`);
                  return `${person1FullName}'s mother is ${person2FullName}'s maternal aunt's son`;
                }
              }
            } else {  // If person1 is female
              if (p1AncestorGender === 'Male') {  // father's side
                if (p2AncestorGender === 'Male') {  // father's brother's son
                  console.log(`${person1FullName}'s father is ${person2FullName}'s paternal uncle's daughter.`);
                  return `${person1FullName}'s father is ${person2FullName}'s paternal uncle's daughter`;
                } else {  // father's brother's daughter
                  console.log(`${person1FullName}'s father is ${person2FullName}'s paternal aunt's daughter.`);
                  return `${person1FullName}'s father is ${person2FullName}'s paternal aunt's daughter`;
                }
              } else {  // mother's side
                if (p2AncestorGender === 'Male') {  // mother's brother's son
                  console.log(`${person1FullName}'s mother is ${person2FullName}'s maternal uncle's daughter.`);
                  return `${person1FullName}'s mother is ${person2FullName}'s maternal uncle's daughter`;
                } else {  // mother's brother's daughter
                  console.log(`${person1FullName}'s mother is ${person2FullName}'s maternal aunt's daughter.`);
                  return `${person1FullName}'s mother is ${person2FullName}'s maternal aunt's daughter`;
                }
              }
            }
            
            
          }

          // Their father are cousins OR Their Grandfathers/grandmothers are siblings.
          else if (p1Level === 3 && p2Level === 3) {          
            
            const p1AncestorFullName = getAncestorFullName(person1Ancestors, 1);
            const p1AncestorGender = await getGender(p1AncestorFullName);

            const p1GreatAncestorFullName = getAncestorFullName(person1Ancestors, 2);
            const p1GreatAncestorGender = await getGender(p1GreatAncestorFullName);

            const p2AncestorFullName = getAncestorFullName(person2Ancestors, 1);
            const p2AncestorGender = await getGender(p2AncestorFullName);

            const p2GreatAncestorFullName = getAncestorFullName(person2Ancestors, 2);
            const p2GreatAncestorGender = await getGender(p2GreatAncestorFullName);
            // Ancestor changes paternal/maternal
            // Great Ancestor changes grandfather/grandmother
            if (p1AncestorGender === 'Male') { 
              if (p2AncestorGender === 'Male'){
                if (p1GreatAncestorGender === 'Male'){
                  if (p2GreatAncestorGender === 'Male'){
                    console.log(`${person1FullName}'s paternal grandfather and ${person2FullName}'s paternal grandfather are brothers.`);
                    return `${person1FullName}'s grandfather and ${person2FullName}'s grandfather are brothers.`;
                  }
                  else{
                    console.log(`${person1FullName}'s paternal grandfather and ${person2FullName}'s paternal grandmother are siblings.`);
                    return `${person1FullName}'s grandfather and ${person2FullName}'s grandmother are brothers.`;
                  }
                }
                else {
                  if (p2GreatAncestorGender === 'Male'){
                    console.log(`${person1FullName}'s paternal grandmother and ${person2FullName}'s paternal grandfather are siblings.`);
                    return `${person1FullName}'s grandmother and ${person2FullName}'s grandfather are brothers.`;
                  }
                  else{
                    console.log(`${person1FullName}'s paternal grandmother and ${person2FullName}'s paternal grandmother are sisters.`);
                    return `${person1FullName}'s grandmother and ${person2FullName}'s grandmother are brothers.`;
                  }
                }
              }
              else {
                if (p1GreatAncestorGender === 'Male'){
                  if (p2GreatAncestorGender === 'Male'){
                    console.log(`${person1FullName}'s paternal grandfather and ${person2FullName}'s maternal grandfather are brothers.`);
                    return `${person1FullName}'s grandfather and ${person2FullName}'s grandfather are brothers.`;
                  }
                  else{
                    console.log(`${person1FullName}'s paternal grandfather and ${person2FullName}'s maternal grandmother are siblings.`);
                    return `${person1FullName}'s grandfather and ${person2FullName}'s grandmother are brothers.`;
                  }
                }
                else {
                  if (p2GreatAncestorGender === 'Male'){
                    console.log(`${person1FullName}'s paternal grandmother and ${person2FullName}'s maternal grandfather are siblings.`);
                    return `${person1FullName}'s grandmother and ${person2FullName}'s grandfather are brothers.`;
                  }
                  else{
                    console.log(`${person1FullName}'s paternal grandmother and ${person2FullName}'s maternal grandmother are sisters.`);
                    return `${person1FullName}'s grandmother and ${person2FullName}'s grandmother are brothers.`;
                  }
                }
              }
            }
            else {
              if (p2AncestorGender === 'Male'){
                if (p1GreatAncestorGender === 'Male'){
                  if (p2GreatAncestorGender === 'Male'){
                    console.log(`${person1FullName}'s maternal grandfather and ${person2FullName}'s paternal grandfather are brothers.`);
                    return `${person1FullName}'s grandfather and ${person2FullName}'s grandfather are brothers.`;
                  }
                  else{
                    console.log(`${person1FullName}'s maternal grandfather and ${person2FullName}'s paternal grandmother are siblings.`);
                    return `${person1FullName}'s grandfather and ${person2FullName}'s grandmother are brothers.`;
                  }
                }
                else {
                  if (p2GreatAncestorGender === 'Male'){
                    console.log(`${person1FullName}'s maternal grandmother and ${person2FullName}'s paternal grandfather are siblings.`);
                    return `${person1FullName}'s grandmother and ${person2FullName}'s grandfather are brothers.`;
                  }
                  else{
                    console.log(`${person1FullName}'s maternal grandmother and ${person2FullName}'s paternal grandmother are sisters.`);
                    return `${person1FullName}'s grandmother and ${person2FullName}'s grandmother are brothers.`;
                  }
                }
              }
              else {
                if (p1GreatAncestorGender === 'Male'){
                  if (p2GreatAncestorGender === 'Male'){
                    console.log(`${person1FullName}'s maternal grandfather and ${person2FullName}'s maternal grandfather are brothers.`);
                    return `${person1FullName}'s grandfather and ${person2FullName}'s grandfather are brothers.`;
                  }
                  else{
                    console.log(`${person1FullName}'s maternal grandfather and ${person2FullName}'s maternal grandmother are siblings.`);
                    return `${person1FullName}'s grandfather and ${person2FullName}'s grandmother are brothers.`;
                  }
                }
                else {
                  if (p2GreatAncestorGender === 'Male'){
                    console.log(`${person1FullName}'s maternal grandmother and ${person2FullName}'s maternal grandfather are siblings.`);
                    return `${person1FullName}'s grandmother and ${person2FullName}'s grandfather are brothers.`;
                  }
                  else{
                    console.log(`${person1FullName}'s maternal grandmother and ${person2FullName}'s maternal grandmother are sisters.`);
                    return `${person1FullName}'s grandmother and ${person2FullName}'s grandmother are brothers.`;
                  }
                }
              }
            }
            
          }


        }
      }
    }
    console.log('No direct relation found.');
    return 'No direct relation found';
  } catch (error) {
    console.error('Error in relationship lookup:', error);
    return 'Error in relationship lookup';
  }
};


module.exports = {
  createFatherChildRelationship,
  createPerson,
  createMotherChildRelationship,
  getMother,
  getFather,
  getGrandMother,
  getRelationship,
  createMarriage,
  getGender,
  getHusbandID
};
