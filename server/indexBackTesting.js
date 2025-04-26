const { createPerson, createFatherChildRelationship, createMarriage,
  getFather, getGrandMother, getMother, getRelationship, getGender, 
  createMotherChildRelationship, getHusbandID} = require('./neo4jRelationships');

// Example function call to create a Father-Child relationship and fetch relationships
const run = async () => {
try {
  await createFatherChildRelationship("Boubaker", "Imhemmed");

} catch (error) {
  console.error('Error executing functions:', error);
}
};

// Run the function directly
run();
