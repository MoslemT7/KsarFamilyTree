
const nameTranslation = require('../translations/names.json');
const compoundNameTranslation = require('../translations/compundNames.json');
const familyNameTranslation = require('../translations/familyNames.json');
const countriesTranslation = require('../translations/countries.json');
const NicknameTranslation  = require('../translations/nicknames.json');

export function translateCountry(country){
    return countriesTranslation[country] || country;
};

export function countBenAndBent(str) {
  const words = str.trim().split(/\s+/);
  if (words.length < 3) return 0;
  const interior = words.slice(1, -1);
  return interior.filter(w => w === 'بن' || w === 'بنت' || w === 'ben' || w === 'bent').length;
};

export function isCompoundName(name) {
  return Object.values(compoundNameTranslation).includes(name) || Object.keys(compoundNameTranslation).includes(name);
};

export function isNickname(name) {
  return Object.values(NicknameTranslation).includes(name) || Object.keys(NicknameTranslation).includes(name);
};

export function splitName(fullName) {
  console.log(fullName);
  if (typeof fullName !== 'string') {
    console.error("fullName is not a string:", fullName);
    return [];
  }
  const parts = fullName.replace(/\s*(بنت|بن|bent|ben)\s*/gi, ' ').trim().split(/\s+/);
  const bentCount = countBenAndBent(fullName);
  let compundName;
  let nickname;
  console.log(parts, bentCount);

  if (parts.length === 2) {
    if (bentCount === 0) {
      if (isCompoundName(parts[0]+ " " + parts[1])){
        compundName = `${parts[0]} ${parts[1]}`;
        console.log("fdsfds");
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
      
      if (isCompoundName(parts[0] + " " + parts[1]) && isCompoundName(parts[2]+ " " + parts[3])){
        return {
          personName: `${parts[0]} ${parts[1]}`,
          fatherName: `${parts[2]} ${parts[3]}`,
          grandfatherName: parts[4],
          familyName: ""
        };
      }
      if (isCompoundName(parts[0]+ " " + parts[1])){
        return {
          personName: `${parts[0]} ${parts[1]}`,
          fatherName: parts[2],
          grandfatherName: parts[3],
          familyName: parts[4]
        };
      }
      if (isCompoundName(parts[1] + " " + parts[2]) && isCompoundName(parts[3]+ " " + parts[4])){
        return {
          personName: parts[0],
          fatherName: `${parts[1]} ${parts[2]}`,
          grandfatherName: `${parts[3]} ${parts[4]}`,
          familyName: ""
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
    id: typeof ancestor.id === 'object' && ancestor.id.toNumber
      ? ancestor.id.toNumber()
      : ancestor.id,
    name: `${ancestor.name} ${ancestor.lastName}`,
    children: children.length > 0 ? children : undefined
  }
};

function normalizeArabicName(name) {
  return name
    .replace(/[أإآ]/g, 'ا')
    .trim()
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/\s+/g, ' ') // Collapse spaces;
};

function _translate(raw, toEnglish, simpleDict, compoundDict) {
  if (!raw || typeof raw !== 'string') return '';

  const normalized = normalizeArabicName(raw.trim());
  const dict = toEnglish
    ? simpleDict
    : Object.fromEntries(Object.entries(simpleDict).map(([k, v]) => [v, k]));
  const compDict = toEnglish
    ? compoundDict
    : Object.fromEntries(Object.entries(compoundDict).map(([k, v]) => [v, k]));

  // 1. Try exact match
  if (compDict[normalized]) return compDict[normalized];

  // 2. Try exact match with removed spaces
  const noSpace = normalized.replace(/\s+/g, '');
  const foundEntry = Object.entries(compDict).find(([key, val]) => {
    const keyNorm = normalizeArabicName(key).replace(/\s+/g, '');
    const valNorm = normalizeArabicName(val).replace(/\s+/g, '');
    return toEnglish ? valNorm === noSpace : keyNorm === noSpace;
  });
  if (foundEntry) {
    return toEnglish ? foundEntry[0] : foundEntry[1];
  }

  // 3. Match compound words inside the sentence
  let temp = normalized;
  Object.entries(compDict).forEach(([key, val]) => {
    const normKey = normalizeArabicName(key);
    const normVal = normalizeArabicName(val);
    const search = toEnglish ? normKey : normVal;
    const replace = toEnglish ? val : key;

    // Replace only if whole words match
    const regex = new RegExp(`\\b${search}\\b`, 'g');
    temp = temp.replace(regex, replace);
  });

  // 4. Translate individual words not covered by compound
  return temp
    .split(' ')
    .map((tok) => dict[tok] || tok)
    .join(' ');
}


export const translateName = (fullName, toEnglish = true) =>
  _translate(fullName, toEnglish, nameTranslation, compoundNameTranslation);

export const translateNickname = (fullName, toEnglish = false) =>
  _translate(fullName, toEnglish, {}, NicknameTranslation);

export const translateFamilyName = (fullFamilyName, toEnglish = true) =>
  _translate(fullFamilyName, toEnglish, familyNameTranslation, compoundNameTranslation);

export const translateNodeName = (fullName, toEnglish = true) => {
  if (!fullName || typeof fullName !== 'string') return '';

  const normalized = fullName.trim().replace(/\s+/g, ' ');

  const direct = _translate(
    normalized,
    toEnglish,
    {},
    compoundNameTranslation
  );
  if (direct !== normalized) return direct;

  const parts = normalized.split(' ');

  const translatedParts = parts.map(part => {
    const name = translateName(part, toEnglish);
    const family = translateFamilyName(part, toEnglish);

    if (name !== part) return name;
    if (family !== part) return family;

    return part; 
  });

  return translatedParts.join(' ');
};

export const formatArabicYears = (num) => {
  if (num === 1) return "سنة";
  if (num === 2) return "سنتين";
  if (num >= 3 && num <= 10) return "سنوات";
  return "سنة"; // for 11+
};


export function formatFullName(nameArray, gender, begin = 0, max = -1) {
  if (!Array.isArray(nameArray) || nameArray.length < 2) return "";

  const end = max === -1 ? nameArray.length : Math.min(max, nameArray.length);

  let fullName = translateName(nameArray[begin]) 
               + (gender === "Male" ? " بن " : " بنت ");

  for (let i = begin + 1; i < end; i++) {
    fullName += translateName(nameArray[i]);
    if (i < end - 1) fullName += " بن ";
  }

  return fullName;
}