const nameTranslation = require('../translations/names.json');
const compoundNameTranslation = require('../translations/compundNames.json');
const familyNameTranslation = require('../translations/familyNames.json');
const countriesTranslation = require('../translations/countries.json');

export function translateCountry(country){
    return countriesTranslation[country] || country;
}

export function countBenAndBent(str) {
  const words = str.trim().split(/\s+/);
  if (words.length < 3) return 0;
  const interior = words.slice(1, -1);
  return interior.filter(w => w === 'بن' || w === 'بنت').length;
};

export function isCompoundName(name) {
  return Object.values(compoundNameTranslation).includes(name);
};

export function splitName(fullName) {
  if (typeof fullName !== 'string') {
    console.error("fullName is not a string:", fullName);
    return [];
  }
  const parts = fullName.replace(/\s*(بن|بنت)\s*/gi, ' ').trim().split(/\s+/);
  const bentCount = countBenAndBent(fullName);
  console.log(bentCount, parts);
  if (isCompoundName(parts[0] + " " + parts[1])) {
    console.log("It's a compound name!");
  }
  let compundName;

  if (parts.length === 2) {
    if (bentCount === 0) {
      if (isCompoundName(parts[0]+ " " + parts[1])){
        compundName = `${parts[0]} ${parts[1]}`;
        return {
          personName: compundName,
          fatherName: "",
          grandfatherName: "",
          familyName: ""
        };
      }
      else{
        return {
          personName: parts[0],
          fatherName: "",
          grandfatherName: "",
          familyName: parts[1]
        };
      }
    } 
    else if (bentCount === 1) {
      return {
        personName: parts[0],
        fatherName: parts[1],
        grandfatherName: "",
        familyName: ""
      };
    }
  } 

  else if (parts.length === 3) {
    if (bentCount === 0) {
        return {
          personName: `${parts[0]} ${parts[1]}`,
          fatherName: "",
          grandfatherName: "",
          familyName: parts[2]
        };
    }
    else if (bentCount === 1) {
      if (isCompoundName(parts[0]+ " " + parts[1])){
        console.log("COMPUND DETECTED");
        compundName = `${parts[0]} ${parts[1]}`;
        return {
          personName: compundName,
          fatherName: parts[2],
          grandfatherName: "",
          familyName: ""
        };
      }
      else if (isCompoundName(parts[1]+ " " + parts[2])){
          console.log("COMPUND DETECTED");
          compundName = `${parts[1]} ${parts[2]}`;
          return {
            personName: parts[0],
            fatherName: compundName,
            grandfatherName: "",
            familyName: ""
          };
        }
      else{
        return {
          personName: parts[0],
          fatherName: parts[1],
          grandfatherName: "",
          familyName: parts[2]
        };
      }

    }
    else if (bentCount === 2) {
      return {
        personName: parts[0],
        fatherName: parts[1],
        grandfatherName: parts[2],
        familyName: ""
      };
    }
  }
  else if (parts.length === 4) {
    if (bentCount === 1) {
      if (isCompoundName(parts[0]+ " " + parts[1]) && isCompoundName(parts[2]+ " " + parts[3])){
        return {
          personName: `${parts[0]} ${parts[1]}`,
          fatherName: `${parts[2]} ${parts[3]}`,
          grandfatherName: "",
          familyName: ""
        };
      }
      if (isCompoundName(parts[0]+ " " + parts[1])){
        return {
          personName: `${parts[0]} ${parts[1]}`,
          fatherName: parts[2],
          grandfatherName: "",
          familyName: parts[3]
        };
      }
      if (isCompoundName(parts[1]+ " " + parts[2])){
        return {
          personName: parts[0],
          fatherName: `${parts[1]} ${parts[2]}`,
          grandfatherName: "",
          familyName: parts[3]
        };
      }
    }
    else if (bentCount === 2){
        if (isCompoundName(parts[0]+ " " + parts[1])){
          return {
            personName: `${parts[0]} ${parts[1]}`,
            fatherName: parts[2],
            grandfatherName: parts[3],
            familyName: ""
          };
        }
        if (isCompoundName(parts[1] + " " + parts[2])){
          return {
            personName: parts[0],
            fatherName: `${parts[1]} ${parts[2]}`,
            grandfatherName: parts[3],
            familyName: ""
          };
        }
        else if(!isCompoundName(parts[0]+ " " + parts[1]) && !isCompoundName(parts[1] + " " + parts[2])) {
          return {
            personName: parts[0],
            fatherName: parts[1],
            grandfatherName: parts[2],
            familyName: parts[3]
          };
        }
    }
  }
  else if (parts.length === 5) {
    if (bentCount === 2){
      if (isCompoundName(parts[0]+ " " + parts[1])){
        return {
          personName: `${parts[0]} ${parts[1]}`,
          fatherName: parts[2],
          grandfatherName: parts[3],
          familyName: parts[4]
        };
      }
      if (isCompoundName(parts[1] + " " + parts[2])){
        return {
          personName: parts[0],
          fatherName: `${parts[1]} ${parts[2]}`,
          grandfatherName: parts[3],
          familyName: parts[4]
        };
      }
      if (isCompoundName(parts[0] + " " + parts[1]) && isCompoundName(parts[2]+ " " + parts[3])){
        return {
          personName: `${parts[0]} ${parts[1]}`,
          fatherName: `${parts[2]} ${parts[3]}`,
          grandfatherName: parts[4],
          familyName: ""
        };
      }
    }
  }
  else if (parts.length === 6) {
    if (bentCount === 2){
      if (isCompoundName(parts[0] + " " + parts[1]) && isCompoundName(parts[2]+ " " + parts[3]) && isCompoundName(parts[4]+ " " + parts[5])){
        return {
          personName: `${parts[0]} ${parts[1]}`,
          fatherName: `${parts[2]} ${parts[3]}`,
          grandfatherName: `${parts[4]} ${parts[5]}`,
          familyName: ""
        };
      }
    }
  }
  else if (parts.length === 7) {
      if (isCompoundName(parts[0] + " " + parts[1]) && isCompoundName(parts[2]+ " " + parts[3]) && isCompoundName(parts[4]+ " " + parts[5])){
        return {
          personName: `${parts[0]} ${parts[1]}`,
          fatherName: `${parts[2]} ${parts[3]}`,
          grandfatherName: `${parts[4]} ${parts[5]}`,
          familyName: parts[6]
        };
      }
  }
  return { personName: parts[0], fatherName: "", grandfatherName: "", familyName: parts[1] || "" };
};

export function buildTreePath(path) {
  if (path.length === 0) return null;

  return path.reduceRight((acc, person) => {
    return {
      id: (person.id).toNumber(),
      name: `${person.name} ${person.lastName}`,
      children: acc ? [acc] : []
    };
  }, null);
};

export function mergePaths(pathToP1, pathToP2) {
  if (pathToP1.length === 0 && pathToP2.length === 0) return null;
  const ancestor = pathToP1[0]; 
  const branch1 = pathToP1.slice(1);
  const branch2 = pathToP2.slice(1);

  const children = [];
  if (branch1.length > 0) {
    children.push(buildTreePath(branch1));
  }
  if (branch2.length > 0) {
    children.push(buildTreePath(branch2));
  }
  return {
    id: (ancestor.id).toNumber(),
    name: `${ancestor.name} ${ancestor.lastName}`,
    children: children.length > 0 ? children : undefined
  }
}

export const translateName = (fullName, language = true) => {
  const reverseTranslations = Object.fromEntries(
    Object.entries(nameTranslation).map(([key, value]) => [value, key])
  );
  const reverseCompound = Object.fromEntries(
    Object.entries(compoundNameTranslation).map(([key, value]) => [value, key])
  );

  const dict = language ? nameTranslation : reverseTranslations;
  const compoundDict = language ? compoundNameTranslation : reverseCompound;

  const normalized = fullName.trim().replace(/\s+/g, ' ');
  if (compoundDict[normalized]) {
    return compoundDict[normalized];
  }

  const nameParts = normalized.split(' ');
  const translatedParts = nameParts.map(part => dict[part] || part);

  return translatedParts.join(' ');
};

export const translateFamilyName = (fullFamilyName, language = true) => {
  const reverseTranslations = Object.fromEntries(
    Object.entries(familyNameTranslation).map(([en, ar]) => [ar, en])
  );

  const reverseCompound = Object.fromEntries(
    Object.entries(compoundNameTranslation).map(([en, ar]) => [ar, en])
  );

  const dict = language ? familyNameTranslation : reverseTranslations;
  const compoundDict = language ? compoundNameTranslation : reverseCompound;

  const normalized = fullFamilyName.trim().replace(/\s+/g, ' ');

  // Check compound match first
  if (compoundDict[normalized]) {
    return compoundDict[normalized];
  }

  // Split and translate each part
  const nameParts = normalized.split(' ');
  const translatedParts = nameParts.map(part => dict[part] || part);

  return translatedParts.join(' ');
};
