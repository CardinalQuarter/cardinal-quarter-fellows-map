<?php

if (empty($_POST["old-password"])) {
  die("Please enter old password");
}

if (empty($_POST["new-password"])) {
  die("Please enter a new password");
}

if (empty($_POST["new-password-confirmation"])) {
  die("Please confirm your new password");
}

if (strlen($_POST["new-password"]) < 8) {
  die("Password must be at least 8 characters");
}

if (!preg_match("/[a-z]/i", $_POST["new-password"])) {
  die("Password must contain at least one letter");
}

if (!preg_match("/[0-9]/", $_POST["new-password"])) {
  die("Password must contain at least one number");
}

if ($_POST["new-password"] !== $_POST["new-password-confirmation"]) {
  die("Passwords must match");
}

$new_password_hash = password_hash($_POST["new-password"], PASSWORD_DEFAULT);

$password_file = "password.txt";

$file = fopen($password_file, "r") or die("Unable to access previous password");
$previous_password_hash = fread($file, filesize($password_file));
fclose($file);

if (password_verify($_POST["old-password"], $previous_password_hash)) {
  $file = fopen($password_file, "w+") or die("Unable to save password");
  fwrite($file, $new_password_hash);
  fclose($file);

  header("Location: change-password-success.html");
  exit;
}

die("Incorrect old password");

?>