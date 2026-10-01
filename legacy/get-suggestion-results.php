<?php

$table_names = array();
instantiateTableNames();

$search_item = rawurldecode($_GET["search_item"]);
$search_file = rawurldecode($_GET["file"]);

$students = array();

updateStudentsArray($search_item);

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
function updateStudentsArray($searchItem)
{
  global $table_names, $students, $search_file;

  // connect to the database
  $mysqli = require __DIR__ . "/database.php";

  //massage the search item and category to prevent injection
  $search_item = "%" . $searchItem . "%";
  $search_item = stripcslashes($mysqli->real_escape_string($search_item));

  $table_specific_name = "cardink5_haas_db.fellows_" . $search_file;
  foreach ($table_names as $column) {
    $search_category = stripcslashes($mysqli->real_escape_string($column));

    $sql = "SELECT * FROM $table_specific_name WHERE $search_category LIKE '$search_item'";

    $result = $mysqli->query($sql);

    if ($result) {
      while ($row = $result->fetch_assoc()) {
        $suggestion = $row[$column];
        $students[$suggestion] = $column;
      }
    }
  }
}

?>