<?php

session_start();

if (!isset($_SESSION["user_id"])) {
  die("Please log in first");
}

$first_index = $_GET["first_index"];
$second_index = $_GET["second_index"];

$successful = false;

if (file_exists("../fellowship_titles.json")) {
  $file_readable = fopen("../fellowship_titles.json", "r") or die("Unable to find file");
  $response_text = fread($file_readable, filesize("../fellowship_titles.json"));
  fclose($file_readable);

  if ($response_text !== null && trim($response_text) !== "") {
    $response_arr = json_decode($response_text, true);

    $temp_first_index = $response_arr[$first_index];
    $temp_second_index = $response_arr[$second_index];

    $response_arr[$first_index] = $temp_second_index;
    $response_arr[$second_index] = $temp_first_index;

    $file_writable = fopen("../fellowship_titles.json", "w+") or die("Unable to find file");
    $json_file = json_encode($response_arr);
    fwrite($file_writable, $json_file);
    fclose($file_writable);
  }

  $successful = true;
}

echo json_encode([
  "successful" => $successful
]);

exit;

?>