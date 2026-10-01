<?php

session_start();

if (!isset($_SESSION["user_id"])) {
  die("Please log in first");
}

$key = rawurldecode($_GET["key"]);
$file_name;

// Gets the fileName
if (file_exists("fellowship_titles.json")) {
  $file_readable = fopen("fellowship_titles.json", "r") or die("Unable to find file");
  $response_text = fread($file_readable, filesize("fellowship_titles.json"));
  fclose($file_readable);

  if ($response_text !== null && trim($response_text) !== "") {
    $response_arr = json_decode($response_text, true);

    $file_name = $response_arr[$key]["fileName"];
  } else {
    die("fileName could not be found");
  }
} else {
  die("fellowship_titles cannot be found");
}

$dropped_database = dropDatabaseTable($file_name);
$deleted_fellowship_title = deleteFellowshipTitleEntry($key);
$deleted_nav_content = deleteNavContentFile($file_name);
$deleted_csv_file = deleteCSVFile($file_name);

echo json_encode([
  "database" => $dropped_database,
  "fellowshipTitle" => $deleted_fellowship_title,
  "navContent" => $deleted_nav_content,
  "csvFile" => $deleted_csv_file
]);
exit;

function dropDatabaseTable($key)
{
  // connect to database
  $mysqli = require __DIR__ . "/database.php";

  //massage the search item and category to prevent injection
  $key = stripcslashes($mysqli->real_escape_string($key));

  $table_name = "cardink5_haas_db.fellows_" . $key;

  $sql = "DROP TABLE IF EXISTS $table_name";

  if ($mysqli->query($sql)) {
    return true;
  } else {
    return false;
  }
}

function deleteFellowshipTitleEntry($key)
{
  if (file_exists("fellowship_titles.json")) {
    $file_readable = fopen("fellowship_titles.json", "r") or die("Unable to find file");
    $response_text = fread($file_readable, filesize("fellowship_titles.json"));
    fclose($file_readable);

    if ($response_text !== null && trim($response_text) !== "") {
      $response_arr = json_decode($response_text, true);

      for ($i = $key + 1; $i < count($response_arr); $i++) {
        $response_arr[$i - 1] = $response_arr[$i];
      }

      unset($response_arr[count($response_arr) - 1]);

      $file_writable = fopen("fellowship_titles.json", "w+") or die("Unable to find file");
      $json_file = json_encode($response_arr);
      fwrite($file_writable, $json_file);
      fclose($file_writable);
    }

    return true;
  } else {
    return false;
  }
}

function deleteNavContentFile($key)
{
  $file_name = "nav_content_" . $key . ".json";

  if (!unlink($file_name)) {
    return false;
  } else {
    return true;
  }
}

function deleteCSVFile($key)
{
  $file_name = "upload/" . $key . ".csv";

  if (!unlink($file_name)) {
    return false;
  } else {
    return true;
  }
}

?>