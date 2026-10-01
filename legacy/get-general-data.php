<?php

include "student.php"; //to create profiles

$colors_json_arr = array();

$search_category = rawurldecode($_GET["category"]);
$search_file = rawurldecode($_GET["file"]);

instantiateColorsJSON($search_category); //prepares to gather color

$json_data = retrieveData($search_category);

echo $json_data;


//instantiates the color of the element
function instantiateColorsJSON($search_category)
{
  global $colors_json_arr, $search_file;

  $file_name = "nav_content_" . $search_file . ".json";

  if (file_exists($file_name) == 1) {
    $file = fopen($file_name, "r") or die("Unable to find file");

    $responseText = fread($file, filesize($file_name));
    fclose($file);

    $jsonArr = json_decode($responseText, true);
    $colors_json_arr = (array) $jsonArr[$search_category];
  }
}

//returns a json data of student info
function retrieveData($search_category)
{
  global $search_file;

  // connect to database
  $mysqli = require __DIR__ . "/database.php";

  //massage the search item and category to prevent injection
  $search_category = stripcslashes($mysqli->real_escape_string($search_category));

  $tableName = "cardink5_haas_db.fellows_" . $search_file;
  $sql = "SELECT * FROM $tableName";
  $result = $mysqli->query($sql);

  if ($result->num_rows > 0) {
    $students_arr = array();

    while ($row = $result->fetch_assoc()) {
      $student = createProfile($row, $search_category);

      $studentAssocArr = $student->generate_assoc_arr();

      array_push($students_arr, $studentAssocArr);
    }

    $students_json_arr = json_encode($students_arr);

    return $students_json_arr;
  } else {
    return json_encode(array("Not enough student info")); //return empty json data
  }
}

//creates a student profile
function createProfile($row, $search_category)
{
  global $colors_json_arr;

  $color = "#000000";

  //get color based on distribution of off category
  if ($search_category === "interest_area") {
    $color = $colors_json_arr[$row["interest_area"]];
  } else if ($search_category === "class_year") {
    $color = $colors_json_arr[$row["class_year"]];
  } else if ($search_category === "school") {
    $color = $colors_json_arr[$row["school"]];
  } else {
    $color = $colors_json_arr[$row["affiliation"]];
  }

  //creates a student profile and populates it with content
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