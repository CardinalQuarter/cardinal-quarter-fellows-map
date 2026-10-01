<?php

session_start();

if (!isset($_SESSION["user_id"])) {
  echo ("Please log in first");
  exit;
}

# Processes the file from the upload
# Stores the data from the file into the database
# Stores navigation content in a json file

// array that stores unique elements of navigation
$nav_content = array();

$arr_assoc = array(); // json file that is stored for quick lookup
$arr_assoc_json = ""; // associative array that holds student's data

$file_directory = getcwd() . "/";
$file_location = $file_directory . basename($_FILES["file-to-upload"]["name"]);
$file_type = strtolower(pathinfo($file_location, PATHINFO_EXTENSION));

if ($file_type != "csv") {
  echo ("Sorry, we cannot process ." . $file_type . "files.");
  exit;
}

// store uploaded file into upload directory
if (move_uploaded_file($_FILES["file-to-upload"]["tmp_name"], $file_location)) {
  // store data into the database
  saveToDatabase();

  // update fellowship_titles list
  updateFellowshipTitles();
} else {
  echo ("Error, does not have permission to modify files.");
  exit;
}

function updateFellowshipTitles()
{
  $fellowship_year = explode(".", basename($_FILES["file-to-upload"]["name"]))[0];

  $display_name = "";

  if (empty($_POST["display-name"])) {
    $display_name = $fellowship_year;
  } else {
    $display_name = $_POST["display-name"];
  }

  if (file_exists("../fellowship_titles.json")) {
    $file_readable = fopen("../fellowship_titles.json", "r") or die("Unable to open fellowship titles file");
    $response_text = fread($file_readable, filesize("../fellowship_titles.json"));

    if ($response_text === null || trim($response_text) === "") {
      $response_arr = [];
    } else {
      $response_arr = json_decode($response_text, true);
    }

    $response_arr[count($response_arr)] = array(
      "fileName" => $fellowship_year,
      "displayName" => $display_name
    );

    krsort($response_arr);

    fclose($file_readable);

    $file_writable = fopen("../fellowship_titles.json", "w+") or die("Unable to find file");
    $json_file = json_encode($response_arr);
    fwrite($file_writable, $json_file);
    fclose($file_writable);
  } else {
    $file_writable = fopen("../fellowship_titles.json", "w+") or die("Unable to find file");

    $response_arr = [];
    $response_arr[0] = array(
      "fileName" => $fellowship_year,
      "displayName" => $display_name
    );

    $jsonFile = json_encode($response_arr);
    fwrite($file_writable, $jsonFile);
    fclose($file_writable);
  }
}

function saveToDatabase()
{
  global $file_location;
  $uploaded_file = fopen($file_location, "r");

  if ($uploaded_file === FALSE) {
    echo ("Error reading file.");
    exit;
  }

  $mysqli = require dirname(__DIR__) . "/database.php";

  $table_name = "cardink5_haas_db.fellows_" . explode(".", basename($_FILES["file-to-upload"]["name"]))[0];

  createTable($mysqli, $table_name);

  instantiateNavigationContent();

  fseek($uploaded_file, 0);
  fgetcsv($uploaded_file);

  while (!feof($uploaded_file)) {
    $line = fgetcsv($uploaded_file);

    if (count($line) != 15) {
      deleteCSVFile();

      $stmt = "DROP TABLE IF EXISTS $table_name";
      $mysqli->query($stmt);

      echo ("Error in csv formatting. Please ensure that there are 15 columns.");
      exit;
    }

    if (missingInput($line)) {
      continue;
    }

    orderNavigationContent($line);
    insertStudentIntoTable($mysqli, $line, $table_name);
  }

  fclose($uploaded_file);

  $mysqli->close();

  // map navigation content to their unique color before saving hashmap
  orderNavContentByColor();

  // stores navigation content as a json
  pushNavContentToJson();

  echo ("Information updated Successfully! Please refresh your page to see the changes.");
}

function createTable($conn, $table_name)
{
  $stmt = "DROP TABLE IF EXISTS $table_name";

  $result = $conn->query($stmt);

  if (!$result) {
    deleteCSVFile();

    echo ("Error: Please rename your file and try again. " .
      "See error message 1 in the README.md for more details. <br /><br />" .
      "Full error message: " . $conn->error);
    exit;
  }

  $stmt = "CREATE TABLE $table_name (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    email VARCHAR(320) NOT NULL,
    class_year VARCHAR(128) NOT NULL,
    major VARCHAR(128) NOT NULL,
    school VARCHAR(128) NOT NULL,
    fellowship VARCHAR(128) NOT NULL,
    partner_organization VARCHAR(255) NOT NULL,
    country VARCHAR(128) NOT NULL,
    latitude VARCHAR(128) NOT NULL,
    longitude VARCHAR(128) NOT NULL,
    affiliation VARCHAR(255) NOT NULL,
    fellowship_loc VARCHAR(255) NOT NULL,
    partner_website VARCHAR(2083) NOT NULL,
    partner_logo VARCHAR(2083) NOT NULL,
    interest_area VARCHAR(255) NOT NULL
  )";

  $result = $conn->query($stmt);

  if (!$result) {
    deleteCSVFile();

    echo ("Error: Error creating table. <br/><br />" .
      "Full Error Message: " . $conn->error);
    exit;
  }

  return TRUE;
}

function instantiateNavigationContent()
{
  global $nav_content;
  $nav_content["affiliation"] = array();
  $nav_content["interest_area"] = array();
  $nav_content["school"] = array();
  $nav_content["class_year"] = array();
  $nav_content["name"] = array();
  $nav_content["major"] = array();
  $nav_content["fellowship"] = array();
  $nav_content["partner_organization"] = array();
  $nav_content["fellowship_loc"] = array();
  $nav_content["country"] = array();
}

function orderNavigationContent($line)
{
  global $nav_content;

  //populate the assoc array
  $affiliation = $line[0];
  $interest = $line[14];
  $school = $line[6];
  $class_year = $line[4];
  $name = $line[2];
  $major = $line[5];
  $fellowship = $line[1];
  $partner_organization = $line[7];
  $fellowship_loc = $line[8];
  $country = $line[9];

  //add to affiliation
  array_push($nav_content["affiliation"], $affiliation);
  $nav_content["affiliation"] = array_unique($nav_content["affiliation"]);

  //add to interest_area
  array_push($nav_content["interest_area"], $interest);
  $nav_content["interest_area"] = array_unique($nav_content["interest_area"]);

  //add to school
  array_push($nav_content["school"], $school);
  $nav_content["school"] = array_unique($nav_content["school"]);

  //add to affiliation
  array_push($nav_content["class_year"], $class_year);
  $nav_content["class_year"] = array_unique($nav_content["class_year"]);

  //add to name
  array_push($nav_content["name"], $name);
  $nav_content["name"] = array_unique($nav_content["name"]);

  //add to major
  array_push($nav_content["major"], $major);
  $nav_content["major"] = array_unique($nav_content["major"]);

  //add to fellowship
  array_push($nav_content["fellowship"], $fellowship);
  $nav_content["fellowship"] = array_unique($nav_content["fellowship"]);

  //add to partner organization
  array_push($nav_content["partner_organization"], $partner_organization);
  $nav_content["partner_organization"] = array_unique($nav_content["partner_organization"]);

  //add to fellowship location
  array_push($nav_content["fellowship_loc"], $fellowship_loc);
  $nav_content["fellowship_loc"] = array_unique($nav_content["fellowship_loc"]);

  //add to country
  array_push($nav_content["country"], $country);
  $nav_content["country"] = array_unique($nav_content["country"]);
}

function missingInput($line)
{
  if (empty($line[2])) {
    return TRUE;
  }

  $arr[] = $line;
  $count = 0;

  for ($i = 0; $i < count($arr); $i++) {
    if (empty($arr[$i])) {
      $count++;
    }
  }

  // 5 is arbitrary - means a lot of input data is not there which is abnormal
  if ($count > 5) {
    return TRUE;
  }

  return FALSE;
}

function insertStudentIntoTable($conn, $line, $table_name)
{
  //escape all the characters than can cause injection
  $line[2] = stripcslashes($conn->real_escape_string($line[2])); // name
  $line[3] = stripcslashes($conn->real_escape_string($line[3])); // email
  $line[4] = stripcslashes($conn->real_escape_string($line[4])); // class_year
  $line[5] = stripcslashes($conn->real_escape_string($line[5])); // major
  $line[6] = stripcslashes($conn->real_escape_string($line[6])); // school
  $line[1] = stripcslashes($conn->real_escape_string($line[1])); // fellowship
  $line[7] = stripcslashes($conn->real_escape_string($line[7])); // partner_organization
  $line[9] = stripcslashes($conn->real_escape_string($line[9])); // country
  $line[10] = stripcslashes($conn->real_escape_string($line[10])); // latitude
  $line[11] = stripcslashes($conn->real_escape_string($line[11])); // longitude
  $line[0] = stripcslashes($conn->real_escape_string($line[0])); // affiliation
  $line[8] = stripcslashes($conn->real_escape_string($line[8])); // fellowship_loc
  $line[12] = stripcslashes($conn->real_escape_string($line[12])); // partner_website
  $line[13] = stripcslashes($conn->real_escape_string($line[13])); // partner_logo
  $line[14] = stripcslashes($conn->real_escape_string($line[14])); // interst_area

  // if do not select old-image-rendering, change link to google drive link
  if ($_POST["old-image-rendering"] === NULL) {
    // Handle both ?id=<ID> and /file/d/<ID>/ share-link formats
    $drive_id = null;
    if (preg_match('#/file/d/([a-zA-Z0-9_-]+)#', $line[13], $m)) {
      $drive_id = $m[1];
    } elseif (preg_match('#[?&]id=([a-zA-Z0-9_-]+)#', $line[13], $m)) {
      $drive_id = $m[1];
    }
    if ($drive_id !== null) {
      $line[13] = "https://lh3.googleusercontent.com/d/" . $drive_id . "=w200";
    }
  }

  // insert into table
  $stmt = "INSERT INTO $table_name (
    name,
    email,
    class_year,
    major,
    school,
    fellowship,
    partner_organization,
    country,
    latitude,
    longitude,
    affiliation,
    fellowship_loc,
    partner_website,
    partner_logo,
    interest_area
  ) VALUES (
    ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
  )";

  $stmt = $conn->prepare($stmt);
  $stmt->bind_param(
    'sssssssssssssss',
    $line[2],
    $line[3],
    $line[4],
    $line[5],
    $line[6],
    $line[1],
    $line[7],
    $line[9],
    $line[10],
    $line[11],
    $line[0],
    $line[8],
    $line[12],
    $line[13],
    $line[14]
  );

  $result = $stmt->execute();

  if (!$result) {
    echo ("There was an error processing student " . $line[2] . ". " .
      "We have entered in all other student data except for " . $line[2] . ". " .
      "See error message 2 in README.md for more details. <br /> <br />" .
      "Full Error Message: " . $conn->error . "<br /><br />");
  }

}

function orderNavContentByColor()
{
  global $nav_content, $arr_assoc;

  //sort the nav_content categories to be shown alphabetically
  sort($nav_content["affiliation"]);
  sort($nav_content["interest_area"]);
  sort($nav_content["school"]);
  sort($nav_content["class_year"]);

  // loop through and assign colors
  foreach ($nav_content as $key => $value) {
    $arr_assoc[$key] = array();

    for ($i = 0; $i < count($value); $i++) {
      // generate random rgb values
      $color = "rgb(" . rand(0, 255) . "," . rand(0, 150) . "," . rand(0, 255) . ")";
      $arr_assoc[$key][$value[$i]] = $color;
    }
  }
}

function pushNavContentToJson()
{
  global $arr_assoc;

  // push to json file named nav_content.json
  $file_name = "../nav_content_" . explode(".", basename($_FILES["file-to-upload"]["name"]))[0] . ".json";
  $file = fopen($file_name, "w+");

  // generate the json of $nav_content and store in text file
  mb_convert_encoding($arr_assoc, "UTF-8", "UTF-8");
  $json_file = json_encode($arr_assoc, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_NUMERIC_CHECK | JSON_INVALID_UTF8_IGNORE);

  // dump the json into the file
  fwrite($file, $json_file);
  fclose($file);
}

function deleteCSVFile()
{
  global $file_location;

  if (!unlink($file_location)) {
    return false;
  } else {
    return true;
  }
}

?>