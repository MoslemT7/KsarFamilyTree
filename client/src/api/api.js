// client/src/api.js
export async function fetchFamilyTree() {
  const response = await fetch('http://localhost:5000/api/family-tree');
  const data = await response.json();
  return data;
}