<?php

$password = rawurldecode($_GET["password"]);

$password_file = "password.txt";

$file = fopen($password_file, "r") or die("Unable to access previous password");
$password_hash = fread($file, filesize($password_file));
fclose($file);

$is_valid;

if (password_verify($password, $password_hash)) {
  $is_valid = true;
} else {
  $is_valid = false;
}

header("Content-Type: application/json");

echo json_encode(["valid" => $is_valid]);

?>