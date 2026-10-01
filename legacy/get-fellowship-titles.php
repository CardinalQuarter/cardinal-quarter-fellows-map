<?php

if (file_exists("fellowship_titles.json") == 1) {
  $file = fopen("fellowship_titles.json", "r") or die("Unable to find file");
  $response_text = fread($file, filesize("fellowship_titles.json"));
  fclose($file);
  echo $response_text;
} else {
  echo "File doesn't exist";
}

?>