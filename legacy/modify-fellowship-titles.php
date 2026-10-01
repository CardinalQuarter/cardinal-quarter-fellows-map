<?php

session_start();

if (!isset($_SESSION["user_id"])) {
  die("Please log in first");
}

if (file_exists("fellowship_titles.json")) {
  $key = rawurldecode($_GET["key"]);
  $new_value = rawurldecode($_GET["newValue"]);

  $file_readable = fopen("fellowship_titles.json", "r") or die("Unable to find file");
  $response_text = fread($file_readable, filesize("fellowship_titles.json"));

  if ($response_text === null || trim($response_text) === "") {
    $response_arr = [];
  } else {
    $response_arr = json_decode($response_text, true);
    $response_arr[$key]["displayName"] = $new_value;
  }

  fclose($file_readable);

  $file_writable = fopen("fellowship_titles.json", "w+") or die("Unable to find file");
  $json_file = json_encode($response_arr);
  fwrite($file_writable, $json_file);
  fclose($file_writable);

  echo "success";
} else {
  echo "fail";
}

?>