<!DOCTYPE html>
<html lang="ar">
<head>
    <meta charset="UTF-8">
    <title>إضافة عرس</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>

<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

$conn = mysqli_connect("10.10.10.100", "sdnkzayf_admin", "06610326mos", "sdnkzayf_Weddingsceremonies");
if (!$conn) {
    die("❌ Connection failed: " . mysqli_connect_error());
}
echo "✅ Connected to DB<br>";

$mName    = $_POST["menName"];
$mFather  = $_POST["menFather"];
$mGFather = $_POST["menGrandFatherName"];
$mLname   = $_POST["menLastName"];

$fName    = $_POST["womenName"];
$fFather  = $_POST["womenFatherName"];
$fGFather = $_POST["womenGrandFatherName"];
$fLname   = $_POST["womenLastName"];

$d1 = $_POST["WomenParty"];
$d2 = $_POST["DinnerDay"];
$d3 = $_POST["PartyDay"];
$d4 = $_POST["LastDay"];

echo "📦 Data collected<br>";

// Step 3: Check for conflicts
$checkQuery = "
    SELECT * FROM wedding 
    WHERE status = 'approved' 
    AND (date1 = '$d1' OR date2 = '$d2' OR date3 = '$d3' OR date4 = '$d4')
";

$checkResult = mysqli_query($conn, $checkQuery);
if (!$checkResult) {
    die("❌ Error in checking wedding dates: " . mysqli_error($conn));
}

if (mysqli_num_rows($checkResult) > 0) {
    echo '<div class="alert error">❌ يوجد عرس آخر في نفس التاريخ</div>';
} else {
    echo "✅ No conflicts found<br>";

    // Step 4: Insert bride
    $brideQuery = "
        INSERT INTO bride(nameBride, fatherBride, grandFatherBride, lastNameBride)
        VALUES ('$mName', '$mFather', '$mGFather', '$mLname')
    ";
    if (!mysqli_query($conn, $brideQuery)) {
        die("❌ Bride insert failed: " . mysqli_error($conn));
    }
    $brideID = mysqli_insert_id($conn);
    echo "👰 Bride inserted ID: $brideID<br>";

    // Step 5: Insert groom
    $groomQuery = "
        INSERT INTO groom(nameGroom, fatherGroom, grandFatherGroom, lastNameGroom)
        VALUES ('$fName', '$fFather', '$fGFather', '$fLname')
    ";
    if (!mysqli_query($conn, $groomQuery)) {
        die("❌ Groom insert failed: " . mysqli_error($conn));
    }
    $groomID = mysqli_insert_id($conn);
    echo "🤵 Groom inserted ID: $groomID<br>";

    // Step 6: Insert wedding
    $weddingQuery = "
        INSERT INTO wedding(idBride, idGroom, date1, date2, date3, date4, status)
        VALUES ($brideID, $groomID, '$d1', '$d2', '$d3', '$d4', 'pending')
    ";
    if (mysqli_query($conn, $weddingQuery)) {
        echo '<div class="alert success">✅ تمت إضافة العرس بنجاح</div>';
        echo '<div><a href="inputWedding.html">الرجوع</a></div>';
    } else {
        echo '<div class="alert error">❌ فشل في إضافة العرس: ' . mysqli_error($conn) . '</div>';
    }
}

// Close connection
mysqli_close($conn);
?>

</body>
</html>
