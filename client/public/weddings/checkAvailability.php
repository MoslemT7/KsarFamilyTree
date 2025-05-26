<?php
$host = "10.10.10.100";  // or "localhost" depending on your host config
$username = "sdnkzayf_admin";
$password = "06610326mos";
$dbname = "sdnkzayf_Weddingsceremonies";

$conn = new mysqli($host, $username, $password, $dbname);

if (!$conn) {
    die("Connection failed: " . mysqli_connect_error());
}

$startDate = $_POST["start_date"];
$endDate = $_POST["end_date"];

$sql = "
    SELECT 
        b.nameBride, b.fatherBride, b.grandFatherBride, b.lastNameBride,
        g.nameGroom, g.fatherGroom, g.grandFatherGroom, g.lastNameGroom,
        w.date1, w.date2, w.date3, w.date4
    FROM 
        wedding w
    JOIN bride b ON b.idBride = w.idBride
    JOIN groom g ON g.idGroom = w.idGroom
    WHERE 
        (w.date1 BETWEEN '$startDate' AND '$endDate' 
        OR w.date2 BETWEEN '$startDate' AND '$endDate' 
        OR w.date3 BETWEEN '$startDate' AND '$endDate' 
        OR w.date4 BETWEEN '$startDate' AND '$endDate')
";

$result = mysqli_query($conn, $sql);
$num_rows = mysqli_num_rows($result);
?>
<!DOCTYPE html>
<html lang="ar">
<head>
    <meta charset="UTF-8">
    <title>نتائج الأعراس</title>
    <link rel="stylesheet" href="availability.css"> <!-- ✅ Your CSS file path -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Almarai:wght@300;400;700;800&family=Amiri:ital,wght@0,400;0,700;1,400;1,700&family=Cairo:wght@200..1000&family=Lalezar&family=Noto+Kufi+Arabic:wght@100..900&display=swap" rel="stylesheet">

</head>
<body>

<h2>عدد الأعراس بين <?php echo $startDate ?> و <?php echo $endDate ?> هو: <?php echo $num_rows ?></h2>

<?php if ($num_rows > 0): ?>
    <table>
        <tr>
             <th>التواريخ</th>
            <th>العريس</th>
            <th>العروس</th>
        </tr>
        <?php while ($row = mysqli_fetch_array($result, MYSQLI_ASSOC)): ?>
        <tr>
            <td><?php echo $row['date1'] . ", " . $row['date2'] . ", " . $row['date3'] . ", " . $row['date4']; ?></td>
            <td><?php echo $row['nameGroom'] . " بنت " . $row['fatherGroom'] . " بن " . $row['grandFatherGroom'] . " " . $row['lastNameGroom']; ?></td>
            <td><?php echo $row['nameBride'] . " بن " . $row['fatherBride'] . " بن " . $row['grandFatherBride'] . " " . $row['lastNameBride']; ?></td>

        </tr>
        <?php endwhile; ?>
    </table>
<?php else: ?>
    <p>لا يوجد أعراس في هذه الفترة.</p>
<?php endif; ?>

<?php
mysqli_free_result($result);
mysqli_close($conn);
?>
</body>
</html>
