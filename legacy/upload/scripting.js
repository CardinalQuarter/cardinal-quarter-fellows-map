let fellowshipTitles;

const reinstantiateTableList = () => {
  const xhttp = new XMLHttpRequest();

  xhttp.onreadystatechange = () => {
    if (xhttp.readyState === 4) {
      if (xhttp.status === 0 || xhttp.status === 200) {
        const responseText = JSON.parse(xhttp.responseText);

        fellowshipTitles = responseText || [];
        refreshTable();
      }
    }
  }

  xhttp.open("GET", "../get-fellowship-titles.php", true);
  xhttp.send();
}

const refreshTable = () => {
  const tableBody = document.getElementById("upload-table-body");
  tableBody.innerHTML = "";

  const jsonLength = Object.keys(fellowshipTitles).length;

  for (let i = 0; i < jsonLength; i++) {
    const tr = document.createElement("tr");

    const fileNameTd = document.createElement("td");
    const fileNameLink = document.createElement("a");
    const fileNameTextNode = document.createTextNode(fellowshipTitles[i]["fileName"] + ".csv");

    fileNameLink.appendChild(fileNameTextNode);

    fileNameLink.href = fellowshipTitles[i]["fileName"] + ".csv";
    fileNameLink.download = fellowshipTitles[i]["fileName"] + ".csv";

    fileNameTd.appendChild(fileNameLink);

    const displayName = document.createElement("td");
    const displayNameDiv = document.createElement("div");
    displayNameDiv.classList.add("d-flex");

    displayEditButton(i, displayNameDiv);

    displayName.appendChild(displayNameDiv);

    tr.appendChild(fileNameTd);
    tr.appendChild(displayName);
    tableBody.appendChild(tr);
  }
}

const displayEditButton = (index, displayNameDiv) => {
  displayNameDiv.innerHTML = "";

  const displayNameTextDiv = document.createElement("div");
  const displayNameTextSpan = document.createElement("span");
  const displayNameTextNode = document.createTextNode(fellowshipTitles[index]["displayName"]);
  
  displayNameTextSpan.appendChild(displayNameTextNode);
  displayNameTextDiv.appendChild(displayNameTextSpan);

  displayNameTextDiv.classList.add("d-flex");
  displayNameTextDiv.classList.add("flex-wrap");
  displayNameTextDiv.classList.add("align-content-center");

  displayNameTextDiv.classList.add("me-auto");
    
  const editButton = document.createElement("button");
  const editButtonTextNode = document.createTextNode("Edit");

  editButton.appendChild(editButtonTextNode);
  editButton.classList.add("btn");
  editButton.classList.add("btn-sm");
  editButton.classList.add("text-white");
  editButton.style.backgroundColor = "#8c1515";

  editButton.type = "button";
  editButton.onclick = () => {
    displayEditControls(index, displayNameDiv);
  }

  displayNameDiv.appendChild(displayNameTextDiv);
  displayNameDiv.appendChild(editButton);
}

const displayEditControls = (index, displayNameDiv) => {
  displayNameDiv.innerHTML = "";

  const displayNameInput = document.createElement("input");

  displayNameInput.type = "text";
  displayNameInput.value = fellowshipTitles[index]["displayName"];

  const updateButton = document.createElement("button");
  const updateButtonTextNode = document.createTextNode("Update");

  updateButton.appendChild(updateButtonTextNode);
  updateButton.classList.add("btn");
  updateButton.classList.add("btn-sm");
  updateButton.classList.add("text-white");
  updateButton.classList.add("me-auto");
  updateButton.style.backgroundColor = "#8c1515";

  updateButton.type = "button";
  updateButton.onclick = () => {
    updateFellowshipTitlesFile(index, displayNameInput.value);
  }  

  const deleteButton = document.createElement("button");
  const deleteButtonTextNode = document.createTextNode("Delete");

  deleteButton.appendChild(deleteButtonTextNode);
  deleteButton.classList.add("btn");
  deleteButton.classList.add("btn-sm");
  deleteButton.classList.add("btn-danger");
  
  deleteButton.type = "button";
  deleteButton.onclick = () => {
    deleteFile(index);
  }

  const closeButton = document.createElement("button");
  const closeButtonTextNode = document.createTextNode("Close");

  closeButton.appendChild(closeButtonTextNode);
  closeButton.classList.add("btn-sm");
  closeButton.classList.add("btn");
  closeButton.classList.add("btn-light");

  closeButton.type = "button";
  closeButton.onclick = () => {
    displayEditButton(index, displayNameDiv);
  }

  displayNameDiv.appendChild(displayNameInput);
  displayNameDiv.appendChild(updateButton);

  if (index !== 0) {
    const moveUpButton = document.createElement("button");
    const moveUpButtonTextNode = document.createTextNode("Move Up");
  
    moveUpButton.type = "button";
    moveUpButton.appendChild(moveUpButtonTextNode);

    moveUpButton.classList.add("btn-sm");
    moveUpButton.classList.add("btn");
    moveUpButton.classList.add("btn-light");

    moveUpButton.onclick = () => {
      moveFileUp(index);
    }

    displayNameDiv.appendChild(moveUpButton);
  }

  if (index !== Object.keys(fellowshipTitles).length - 1) {
    const moveDownButton = document.createElement("button");
    const moveDownButtonTextNode = document.createTextNode("Move Down");
  
    moveDownButton.type = "button";
    moveDownButton.appendChild(moveDownButtonTextNode);

    moveDownButton.classList.add("btn-sm");
    moveDownButton.classList.add("btn");
    moveDownButton.classList.add("btn-light");

    moveDownButton.onclick = () => {
      moveFileDown(index);
    }

    displayNameDiv.appendChild(moveDownButton);
  }

  displayNameDiv.appendChild(deleteButton);
  displayNameDiv.appendChild(closeButton);
}

const updateFellowshipTitlesFile = (index, newValue) => {
  const xhttp = new XMLHttpRequest();

  xhttp.onreadystatechange = () => {
    if (xhttp.readyState == 4) {
      if (xhttp.status == 0 || xhttp.status == 200) {
        const responseText = xhttp.responseText;

        if (responseText.trim() === "success") {
          reinstantiateTableList();
        }
      }
    }
  }

  const url = "../modify-fellowship-titles.php?key=" + encodeURIComponent(index) + 
              "&newValue=" + encodeURIComponent(newValue);
  xhttp.open("GET", url, true);
  xhttp.send();
}

const deleteFile = (index) => {
  const xhttp = new XMLHttpRequest();

  xhttp.onreadystatechange = () => {
    if (xhttp.readyState == 4) {
      if (xhttp.status == 0 || xhttp.status == 200) {
        const response = JSON.parse(xhttp.responseText);

        for (item in response) {
          if (response[item] == false) {
            console.log("Error removing: " + item);
          }
        }

        reinstantiateTableList();
      }
    }
  }

  const url = "../delete-fellowship-file.php?key=" + encodeURIComponent(index);
  xhttp.open("GET", url, true);
  xhttp.send();
}

const moveFileUp = (index) => {
  const xhttp = new XMLHttpRequest();

  xhttp.onreadystatechange = () => {
    if (xhttp.readyState == 4) {
      if (xhttp.status == 0 || xhttp.status == 200) {
        const response = JSON.parse(xhttp.responseText);

        if (response["successful"]) {
          reinstantiateTableList();
        } else {
          console.log("Error swapping files");
        }
      }
    }
  }

  const url = "swap-file-index.php?first_index=" + encodeURIComponent(index) + "&second_index=" + encodeURIComponent(index - 1);
  xhttp.open("GET", url, true);
  xhttp.send();
}

const moveFileDown = (index) => {
  const xhttp = new XMLHttpRequest();

  xhttp.onreadystatechange = () => {
    if (xhttp.readyState == 4) {
      if (xhttp.status == 0 || xhttp.status == 200) {
        const response = JSON.parse(xhttp.responseText);

        if (response["successful"]) {
          reinstantiateTableList();
        } else {
          console.log("Error swapping files");
        }
      }
    }
  }

  const url = "swap-file-index.php?first_index=" + encodeURIComponent(index) + "&second_index=" + encodeURIComponent(index + 1);
  xhttp.open("GET", url, true);
  xhttp.send();
}
