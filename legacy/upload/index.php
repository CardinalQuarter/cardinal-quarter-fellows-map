<?php

$logged_in = false;
$is_invalid = false;

session_start();

if (isset($_SESSION["user_id"])) {
  $logged_in = true;
}

if ($_SERVER["REQUEST_METHOD"] === "POST") {
  $password_file = "password.txt";

  $file = fopen($password_file, "r") or die("Unable to access previous password");
  $password_hash = fread($file, filesize($password_file));
  fclose($file);

  if (password_verify($_POST["password"], $password_hash)) {
    session_start();
    session_regenerate_id();

    $_SESSION["user_id"] = "user";

    $logged_in = true;
  }

  $is_invalid = true;
}

?>

<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.1/dist/css/bootstrap.min.css" rel="stylesheet"
    integrity="sha384-4bw+/aepP/YC94hEpVNVgiZdgIC5+VKNBQNGCHeKRQN+PtmoHDEXuppvnDJzQIu9" crossorigin="anonymous" />
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.1/dist/js/bootstrap.bundle.min.js"
    integrity="sha384-HwwvtgBNo3bZJJLYd8oVXjrBZt8cqVSpeBNS5n7C8IVInixGAoxmnlMuBnhbgrkm"
    crossorigin="anonymous"></script>

  <script type="text/javascript" src="scripting.js"></script>

  <link rel="stylesheet" type="text/css" href="../styling.css" />
  <link rel="stylesheet" type="text/css" href="upload-page-styles.css" />

  <title>Uploads</title>
  <link rel="icon" type="image/x-icon" href="../favicon.ico" />
</head>

<body class="background-tan" onload="reinstantiateTableList()">
  <?php if ($logged_in): ?>
    <script type="text/javascript">
      if (window.history.replaceState) {
        window.history.replaceState(null, null, window.location.href);
      }
    </script>

    <section class="title mb-5">
      <h1>Upload File Page</h1>
    </section>

    <section class="d-flex flex-column align-items-center">
      <div class="container mb-3 text-align-center d-flex align-items-center">
        <div class="me-auto">
          <button type="button" class="btn text-white" data-bs-toggle="modal" data-bs-target="#upload-modal"
            style="background-color: #8c1515">
            Upload Files
          </button>

          <div class="modal fade" id="upload-modal" tabindex="-1" aria-labelledby="upload-modal-label" aria-hidden="true">
            <div class="modal-dialog">
              <div class="modal-content">
                <div class="modal-header">
                  <h5 class="modal-title" id="upload-modal-label">File Upload</h5>
                  <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>

                <form action="process-data.php" enctype="multipart/form-data" method="post" target="response-frame">
                  <div class="modal-body">
                    <iframe name="response-frame"></iframe>

                    <div class="mb-3">
                      <label class="form-label" for="upload-file-display-name">Display Name</label>
                      <input type="text" class="form-control" name="display-name" id="upload-file-display-name" />
                    </div>

                    <div class="mb-2">
                      <label class="form-label" for="upload-file-input">Please Select Your CSV File</label>
                      <input accept=".csv" class="form-control" id="upload-file-input" name="file-to-upload" type="file"
                        required />

                      <p class="mt-2 text-danger">Do not use any spaces or special characters in the name of your CSV
                        file. </p>
                    </div>

                    <div class="form-check">
                      <input class="form-check-input" type="checkbox" value="" id="old-image-rendering"
                        name="old-image-rendering" />
                      <label class="form-check-label" for="old-image-rendering">Use Old Image Rendering</label>
                    </div>
                  </div>

                  <div class="modal-footer">
                    <button type="button" class="btn btn-light" data-bs-dismiss="modal">Close</button>
                    <button type="submit" class="btn text-white" style="background-color: #8c1515">Upload</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

        <a href="logout.php">Logout</a>
      </div>

      <div class="container">
        <table class="table">
          <thead>
            <tr>
              <td>Uploaded Files</td>
              <td>Display Names</td>
            </tr>
          </thead>
          <tbody id="upload-table-body"></tbody>
        </table>
      </div>
    </section>
  <?php else: ?>
    <section class="vh-100" style="background-color: #f9f6ef;">
      <div class="container py-5 h-100">
        <div class="row d-flex justify-content-center align-items-center h-100">
          <div class="col-12 col-md-8 col-lg-6 col-xl-5">
            <div class="card shadow-2-strong" style="border-radius: 1rem;">
              <div class="card-body p-5">
                <form method="post">
                  <h1 class="mb-5">Log In</h1>

                  <div class="form-outline mb-2">
                    <label class="form-label" for="password">Password</label>
                    <input type="password" id="password" class="form-control form-control" name="password" />
                  </div>

                  <p class="mb-3 pb-lg-2"><a href="change-password.html">Change password</a></p>

                  <?php if ($is_invalid): ?>
                    <p class="fw-bold fst-italic text-danger">Invalid login</p>
                  <?php endif; ?>

                  <button class="btn btn-block text-white w-100" style="background-color: #8c1515;"
                    type="submit">Login</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  <?php endif; ?>
</body>

</html>