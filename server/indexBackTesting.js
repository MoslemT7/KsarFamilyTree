const { createPerson, createFatherChildRelationship, createMarriage,
  getFather, getGrandMother, getMother, getRelationship, getGender, 
  createMotherChildRelationship, getHusbandID} = require('./nrl.js');

// Example function call to create a Father-Child relationship and fetch relationships
const run = async () => {
try {
    await createPerson("Firas", "Lokmani", "Male", "2005", "True");
} catch (error) {
  console.error('Error executing functions:', error);
}
};

run();
