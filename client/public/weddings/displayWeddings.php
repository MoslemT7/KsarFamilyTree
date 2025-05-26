<?php
// Set content type
header('Content-Type: text/html; charset=UTF-8');

// Connect using mysqli with environment variables
$host = "10.10.10.100";  // or "localhost" depending on your host config
$username = "sdnkzayf_admin";
$password = "06610326mos";
$dbname = "sdnkzayf_Weddingsceremonies";

$conn = new mysqli($host, $username, $password, $dbname);
// Check connection
if (!$conn) {
    die("فشل الاتصال بقاعدة البيانات: " . mysqli_connect_error());
}

// Fetch weddings
$sql = "
    SELECT 
        b.nameBride AS bride_name,
        b.fatherBride AS bride_father,
        b.grandfatherBride AS bride_grandfather,
        b.lastNameBride AS bride_lastname,
        g.nameGroom AS groom_name,
        g.fatherGroom AS groom_father,
        g.grandFatherGroom AS groom_grandfather,
        g.lastNameGroom AS groom_lastname,
        w.date1, w.date2, w.date3, w.date4
    FROM wedding w
    JOIN bride b ON w.idBride = b.idBride
    JOIN groom g ON w.idGroom = g.idGroom
";

$result = mysqli_query($conn, $sql);
if (!$result) {
    die("فشل تحميل بيانات الأعراس: " . mysqli_error($conn));
}

// Start HTML
echo '
<!DOCTYPE html>
<html lang="ar">
<head>
    <meta charset="UTF-8">
    <title>إضافة عرس</title>
    <style>
        table {
            width: 100%;
            border-collapse: collapse;
            font-family: Arial, sans-serif;
            margin-top: 20px;
        }
        th, td {
            border: 1px solid #444;
            padding: 10px;
            text-align: center;
        }
        th {
            background-color: #2c3e50;
            color: #ecf0f1;
        }
        tr:nth-child(even) {
            background-color: #f4f6f8;
        }
        tr:hover {
            background-color: #d1e7ff;
        }
        .names { width: 25%; }
        .dates { width: 10%; }
    </style>
</head>
<body>
<table>
    <thead>
        <tr>
            <th>اسم العروس الكامل</th>
            <th>اسم العريس الكامل</th>
            <th>التاريخ 1</th>
            <th>التاريخ 2</th>
            <th>التاريخ 3</th>
            <th>التاريخ 4</th>
        </tr>
    </thead>
    <tbody>
';

// Loop through rows
while ($row = mysqli_fetch_assoc($result)) {
    $bride = $row['bride_name'] . ' بن ' . $row['bride_father'] . ' بن ' . $row['bride_grandfather'] . ' ' . $row['bride_lastname'];
    $groom = $row['groom_name'] . ' بن ' . $row['groom_father'] . ' بن ' . $row['groom_grandfather'] . ' ' . $row['groom_lastname'];

    echo "<tr>
        <td class='names'>{$bride}</td>
        <td class='names'>{$groom}</td>
        <td class='dates'>{$row['date1']}</td>
        <td class='dates'>{$row['date2']}</td>
        <td class='dates'>{$row['date3']}</td>
        <td class='dates'>{$row['date4']}</td>
    </tr>";
}

echo '
    </tbody>
</table>
</body>
</html>
';

// Close connection
mysqli_close($conn);
?>
