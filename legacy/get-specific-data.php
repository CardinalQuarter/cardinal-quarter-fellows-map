<?php

include "student.php";

$search_category = rawurldecode($_GET["category"]);
$search_item = rawurldecode($_GET["data"]);
$search_file = rawurldecode($_GET["file"]);

$color = getColor($search_category, $search_item);
$json_data = retrieveData($search_category, $search_item, $color, $search_file); //returns a json file

echo $json_data;

//grabs the color of the element
function getColor($search_category, $search_item)
{
  global $search_file;
  $file_name = "nav_content_" . $search_file . ".json";

  if (file_exists($file_name)) {
    $file = fopen($file_name, "r") or die("Unable to find file");
    $responseText = fread($file, filesize($file_name));
    fclose($file);

    $json_arr = json_decode($responseText, true);
    $category = (array) $json_arr[$search_category];

    return $category[$search_item];
  }
}

//returns a json data of student info
function retrieveData($search_category, $search_item, $color, $search_file)
{
  // connect to database
  $mysqli = require __DIR__ . "/database.php";

  //massage the search item and category to prevent injection
  $search_item = stripcslashes($mysqli->real_escape_string($search_item));
  $search_category = stripcslashes($mysqli->real_escape_string($search_category));

  $table_name = "cardink5_haas_db.fellows_" . $search_file;
  $sql = "SELECT * FROM $table_name WHERE $search_category = ?";

  $stmt = $mysqli->prepare($sql);
  $stmt->bind_param("s", $search_item);
  $stmt->execute();

  $result = $stmt->get_result();

  $students_arr = array();

  while ($row = $result->fetch_assoc()) {
    $student = createProfile($row, $color);
    $studentAssocArr = $student->generate_assoc_arr();

    array_push($students_arr, $studentAssocArr);
  }

  $students_json_arr = json_encode($students_arr);
  return $students_json_arr;
}

//creates a student profile and populates it with content
function createProfile($row, $color)
{
  $student = new Student();
  $student->setAffiliation($row["affiliation"]);
  $student->setFellowship($row["fellowship"]);
  $student->setName($row["name"]);
  $student->setEmail($row["email"]);
  $student->setClassYear($row["class_year"]);
  $student->setMajor($row["major"]);
  $student->setSchool($row["school"]);
  $student->setPartnerOrganization($row["partner_organization"]);
  $student->setFellowshipLocation($row["fellowship_loc"]);
  $student->setCountry($row["country"]);
  $student->setLatitude($row["latitude"]);
  $student->setLongitude($row["longitude"]);
  $student->setPartnerWebsite($row["partner_website"]);
  $student->setCompanyLogo($row["partner_logo"]);
  $student->setInterestAreas($row["interest_area"]);
  $student->setColor($color);

  return $student;
}

?>