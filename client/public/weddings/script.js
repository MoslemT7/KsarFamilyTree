function isNameValid(name) {
    if (name == ''){
        return false;
    }
    for (let i = 0; i < name.length; i++) {
        if (!isNaN(name[i]) && name[i] !== ' ') {
            return false;
        }
    }
    return true;
}

function check() {
    // Groom data
    let mName = document.getElementById("menName").value.trim();
    let mFather = document.getElementById("menFather").value.trim();
    let mGFather = document.getElementById("menGrandFatherName").value.trim();
    let mLname = document.getElementById("menLastName").value.trim();

    // Bride data
    let fName = document.getElementById("womenName").value.trim();
    let fFather = document.getElementById("womenFatherName").value.trim();
    let fGFather = document.getElementById("womenGrandFatherName").value.trim();
    let fLname = document.getElementById("womenLastName").value.trim();

    // Dates
    let d1 = document.getElementById("WomenParty").value;
    let d2 = document.getElementById("DinnerDay").value;
    let d3 = document.getElementById("PartyDay").value;
    let d4 = document.getElementById("LastDay").value;

    // Groom name validation
    if (!isNameValid(mName) || !isNameValid(mFather) || !isNameValid(mGFather) || !isNameValid(mLname)) {
        alert("الرجاء التحقق من الاسم الرباعي للعريس (بدون أرقام)");
        return false;
    }

    // Bride name validation
    if (!isNameValid(fName) || !isNameValid(fFather) || !isNameValid(fGFather) || !isNameValid(fLname)) {
        alert("الرجاء التحقق من الاسم الرباعي للعروس (بدون أرقام)");
        return false;
    }

    // Dates validation
    if (!d1 || !d2 || !d3 || !d4) {
        alert("الرجاء إدخال جميع تواريخ العرس");
        return false;
    }

    return true;
}


function checkDate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startVal = document.getElementById("start_date").value;
  const endVal   = document.getElementById("end_date").value;

  const startDate = new Date(startVal);
  const endDate   = new Date(endVal);

  if (startDate <= today) {
    alert("🚫 الرجاء اختيار تاريخ بعد اليوم");
    return false;
  }

  if (endDate <= startDate) {
    alert("🚫 الرجاء اختيار تاريخ النهاية بعد تاريخ البداية");
    return false;
  }

  return true;
}
