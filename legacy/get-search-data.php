<?php

include "student.php";

$table_names = array();

$search_item = rawurldecode($_GET["data"]);
$search_file = rawurldecode($_GET["file"]);

instantiateTableNames();

$students = array();
updateStudentsArray($search_item, $search_file);

$studentsInfoJSON = json_encode($students);
echo $studentsInfoJSON;

//instantiates this table -> contains searchable columns
function instantiateTableNames()
{
  global $table_names;
  array_push($table_names, "name");
  array_push($table_names, "major");
  array_push($table_names, "class_year");
  array_push($table_names, "school");
  array_push($table_names, "fellowship");
  array_push($table_names, "partner_organization");
  array_push($table_names, "country");
  array_push($table_names, "affiliation");
  array_push($table_names, "fellowship_loc");
  array_push($table_names, "interest_area");
}

//responsible for getting all the possible suggestions
function updateStudentsArray($searchItem, $searchYear)
{
  global $table_names, $students;

  $mysqli = require __DIR__ . "/database.php";

  //massage the search item and category to prevent injection
  $search_item = "%" . $searchItem . "%";
  $search_item = stripcslashes($mysqli->real_escape_string($search_item));

  $tableName = 'cardink5_haas_db.fellows_' . $searchYear;

  foreach ($table_names as $column) {
    $search_category = stripcslashes($mysqli->real_escape_string($column));

    $sql = "SELECT * FROM $tableName WHERE $search_category LIKE '$search_item'";

    $result = $mysqli->query($sql);

    if ($result) {
      while ($row = $result->fetch_assoc()) {
        //check if the item has the same substring as the passed in stuff
        $item = $row[$column];

        if (strlen($searchItem) <= strlen($item)) {
          if ($searchItem === substr($item, 0, strlen($searchItem))) {
            $student = createProfile($row, $column);

            $student_assoc_arr = $student->generate_assoc_arr();

            if (in_array($student_assoc_arr, $students) == false) {
              array_push($students, $student_assoc_arr);
            }
          }
        }
      }
    }
  }
}

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

//creates a student profile
function createProfile($row, $column)
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
  $student->setColor(getColor($column, $row[$column]));

  return $student;
}

?>