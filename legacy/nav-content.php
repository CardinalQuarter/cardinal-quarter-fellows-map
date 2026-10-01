<?php

$search_file = rawurldecode($_GET["file"]);
$file_name = "nav_content_" . $search_file . ".json";
if (file_exists($file_name)) {
  $file = fopen($file_name, "r") or die("Unable to find file");
  $response_text = fread($file, filesize($file_name));
  fclose($file);
  echo $response_text;
} else {
  echo "File doesn't exist";
}

?>