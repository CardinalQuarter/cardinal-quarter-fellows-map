let map;
let markers = [];
let currentInfoWindow;
let students;

let searchCategory;
let searchItem;

let fellowshipTitles = {};
let fellowshipFile;
let fellowshipFileIndex;

// Normalize a stored partner_logo URL into a reliably embeddable image URL.
// Recovers the Drive file ID from clean share links AND from URLs mangled by
// a prior extractor bug (e.g. "...thumbnail?id=ps://drive.google.com/file/d/<ID>/view...").
function toDriveImageUrl(url) {
  if (!url) return url;
  let id = null;
  let m = url.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
  if (m) id = m[1];
  if (!id) {
    m = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
    if (m) id = m[1];
  }
  if (!id) return url;
  return "https://lh3.googleusercontent.com/d/" + id + "=w200";
}

const initPage = () => {
  document.addEventListener("click", () => {
    closeAllLists();
  });
}

function initMap() {
  const myMap = document.getElementById("map");
  // Create a new StyledMapType object, passing it an array of styles,
  // and the name to be displayed on the map type control.

  const options = {
    center: {lat:15, lng:15},
    mapTypeControl: false,
    mapTypeId: "roadmap",
    minZoom: 2,
    maxZoom: 16,
    streetViewControl: false,
    zoom: 2,
  };

  map = new google.maps.Map(myMap, options);

  // closes info windows if map is clicked
  google.maps.event.addListener(map, 'click', function(){
    if (currentInfoWindow != null) currentInfoWindow.close();
  });

  getListOfFellowships();
}

const getListOfFellowships = () => {
  const xhttp = new XMLHttpRequest();

  xhttp.onreadystatechange = () => {
    if (xhttp.readyState == 4) {
      if (xhttp.status == 0 || xhttp.status == 200) {
        fellowshipTitles = JSON.parse(xhttp.responseText);

        if (Object.keys(fellowshipTitles).length !== 0 && !fellowshipFile && !fellowshipFileIndex) {
          fellowshipFileIndex = 0;
          fellowshipFile = fellowshipTitles[fellowshipFileIndex]["fileName"];

          document.getElementById("current-year-header").innerHTML = fellowshipTitles[fellowshipFileIndex]["displayName"];
          showMapInterestArea();
        } else {
          fellowshipFileIndex = null;
          fellowshipFile = "";
        }

        fillFellowshipDropdownList();
      }
    }
  }

  xhttp.open("GET", "get-fellowship-titles.php", true);
  xhttp.send();
}

const fillFellowshipDropdownList = () => {
  const dropdownMenuList = document.getElementById("fellowship-dropdown-list");
  dropdownMenuList.innerHTML = "";

  const titlesLength = Object.keys(fellowshipTitles).length;



  for (let i = 0; i < titlesLength; i++) {
    const listItem = document.createElement("li");
    const linkItem = document.createElement("a");
    const textItem = document.createTextNode(fellowshipTitles[i]["displayName"]);

    linkItem.classList.add("dropdown-item");
    linkItem.href = "#";

    linkItem.onclick = () => {
      document.getElementById("current-year-header").innerHTML = textItem.textContent;  

      fellowshipFile = fellowshipTitles[i]["fileName"];
      showMapInterestArea();
    }

    linkItem.appendChild(textItem);
    listItem.appendChild(linkItem);
    dropdownMenuList.appendChild(listItem);
  }
}

const showMapInterestArea = () => {
  updateSidebarHeader("Interest Area");
  updateCurrentNavBar("interest_area");

  fillSublist("interest_area");
  displayMarkers("interest_area");
}

const showMapAffiliation = () => {
  updateSidebarHeader("Affiliation");
  updateCurrentNavBar("affiliation");

  fillSublist("affiliation");
  displayMarkers("affiliation");
}

const showMapSchool = () => {
  updateSidebarHeader("School");
  updateCurrentNavBar("school");

  fillSublist("school");
  displayMarkers("school");
}

const showMapClassYear = () => {
  updateSidebarHeader("Class Year");
  updateCurrentNavBar("class_year");

  fillSublist("class_year");
  displayMarkers("class_year");
}

const updateSidebarHeader = (text) => {
  const sidebarHeader = document.getElementById("sort-by-header");
  sidebarHeader.innerHTML = text;
}

const updateCurrentNavBar = (key) => {
  const affiliationFilter = document.getElementById("affiliation-filter");
  const interestAreaFilter = document.getElementById("interest-area-filter");
  const schoolFilter = document.getElementById("school-filter");
  const classYearFilter = document.getElementById("class-year-filter");

  affiliationFilter.classList.remove("active");
  interestAreaFilter.classList.remove("active");
  schoolFilter.classList.remove("active");
  classYearFilter.classList.remove("active");

  if (key == "affiliation") {
    affiliationFilter.classList.add("active");
  } else if (key == "interest_area") {
    interestAreaFilter.classList.add("active");
  } else if (key == "school") {
    schoolFilter.classList.add("active");
  } else if (key == "class_year") {
    classYearFilter.classList.add("active");
  }
}

const fillSublist = (key) => {
  const xhttp = new XMLHttpRequest();

  xhttp.onreadystatechange = () => {
    if (xhttp.readyState == 4) {
      if (xhttp.status == 0 | xhttp.status == 200) {
        const jsonFile = JSON.parse(xhttp.responseText);
        let data = [];

        if (key == "affiliation") {
          data = jsonFile.affiliation;
          populateView(data);
        } else if (key == "interest_area") {
          data = jsonFile.interest_area;
          populateView(data);
        } else if (key == "school") {
          data = jsonFile.school;
          populateView(data);
        } else {
          data = jsonFile.class_year;
          populateView(data);
        }
      }
    }
  }

  xhttp.open("GET", "nav-content.php?file=" + encodeURIComponent(fellowshipFile), true);
  xhttp.send();
}

const displayMarkers = (category) => {
  for (let i = 0; i < markers.length; i++) {
    markers[i].setMap(null);
  }

  markers = [];

  const xhttp = new XMLHttpRequest();

  xhttp.onreadystatechange = () => {
    if (xhttp.readyState == 4) {
      if (xhttp.status == 0 || xhttp.status == 200) {
        const responseText = xhttp.responseText;

        const jsonArray = JSON.parse(responseText);
        updateMap(jsonArray);
      }
    }
  }

  const url = "get-general-data.php?category=" + encodeURIComponent(category) + "&file=" + encodeURIComponent(fellowshipFile);
  xhttp.open("GET", url, true);
  xhttp.send();
}

const populateView = (data, type = "circle") => {
  const newListHolder = document.createElement("tbody");

  for (elem in data) {
    const newElemTr = document.createElement("tr");
    const newElemTdSvg = document.createElement("td");
    const newElemTdData = document.createElement("td");
    const newElemSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const newElemSpan = document.createElement("span");
    newElemSpan.innerHTML = elem;

    newElemSvg.setAttribute("width", 10);
    newElemSvg.setAttribute("height", 10);

    const newElement = createElementType(type, data[elem]);

    newElemSvg.appendChild(newElement);
    newElemTdSvg.appendChild(newElemSvg);
    newElemTdData.appendChild(newElemSpan);
    newElemTr.appendChild(newElemTdSvg);
    newElemTr.appendChild(newElemTdData);

    setTableOnClick(newElemTr);

    newListHolder.appendChild(newElemTr);
  }

  const divHolder = document.getElementById("information-table");
  divHolder.innerHTML = "";
  divHolder.appendChild(newListHolder);
}

const setTableOnClick = (element) => {
  element.onclick = () => {
    for (let i = 0; i < markers.length; i++) {
      markers[i].setMap(null);
    }

    markers = [];

    if (currentInfoWindow != null) {
      currentInfoWindow.close();
    }

    let category = document.getElementById("sort-by-header").innerHTML;
    category = category.trim().toLowerCase().replace(" ", "_");

    const text = element.children[1].children[0];

    if (document.getElementById("sort-by-header").innerHTML === "Search Result") {
      const studentName = (text.innerHTML).trim();

      if (students != null) {
        let student;

        for (let i = 0; i < students.length; i++) {
          const elem = students[i];

          if (elem["name"] == studentName) {
            student = elem;
            break;
          }
        }

        if (student != null) {
          updateMap([student]);
        }
      }
    } else {
      const xhttp = new XMLHttpRequest();

      xhttp.onreadystatechange = () => {
        if (xhttp.readyState == 4) {
          if (xhttp.status == 0 || xhttp.status == 200) {
            const responseText = xhttp.responseText;
            
            const jsonArr = JSON.parse(responseText);
            updateMap(jsonArr);
          }
        }
      }

      const url = "get-specific-data.php?category=" + encodeURIComponent(category) + 
                   "&data=" + encodeURIComponent(text.textContent) + 
                   "&file=" + encodeURIComponent(fellowshipFile);
      xhttp.open("GET", url, true);
      xhttp.send();
    }
  }
}

const updateMap = (jsonArr) => {
  const bounds = new google.maps.LatLngBounds();

  for (let i = 0; i < jsonArr.length; i++) {
    // variable scoping requires this nested function
    ((index) => {
      const latitude = parseFloat(jsonArr[index]["latitude"]);
      const longitude = parseFloat(jsonArr[index]["longitude"]);
      const color = jsonArr[index]["color"];

      const iconImage = {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 5,
        strokeWeight: 0,
        fillColor: color,
        fillOpacity: 0.9
      };

      const marker = new google.maps.Marker({
        position: {lat:latitude, lng:longitude},
        map: map,
        icon: iconImage,
      });

      //extend the bounds
      const myLatLng = new google.maps.LatLng(latitude, longitude);
      bounds.extend(myLatLng);

      //create the infoWindow
      const contentInfo = getDisplayHTML(jsonArr, index).innerHTML;
      const infoWindow = new google.maps.InfoWindow({
        content:contentInfo
      });

      //add a listener
      marker.addListener("click", () => {
        if (currentInfoWindow != null) {
          currentInfoWindow.close();
        }

        infoWindow.open(map, marker);
        currentInfoWindow = infoWindow;
      });
      markers.push(marker);
    })(i);
  }

  map.fitBounds(bounds);
}

const createElementType = (type, color) => {
  let elem;

  if (type == "star") {
    elem = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    elem.setAttribute("points", "5,0,10,5,5,10,0,5");
    elem.setAttribute("fill", color);
  } else if (type == "circle") {
    elem = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    elem.setAttribute("cx", 5);
    elem.setAttribute("cy", 5);
    elem.setAttribute("r", 5);
    elem.setAttribute("fill", color);
  } else if (type == "square") { //it is a square
    elem = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    elem.setAttribute("x", 1);
    elem.setAttribute("y", 1);
    elem.setAttribute("width", 8);
    elem.setAttribute("height", 8);
    elem.setAttribute("fill", color);
  } else { //make strange star
    elem = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    elem.setAttribute("points", "4,0,6,0,10,4,10,6,6,10,4,10,0,6,0,4");
    elem.setAttribute("fill", color);
  }
  return elem; //returns the elem to the parent svg
}

//returns an html display for the infoWindow
//make it handle more info for same location
function getDisplayHTML(jsonArr, index) {
  //create the elements
  var parent = document.createElement("div"); //this is used to retrieve innerHTML
  var mainDiv = document.createElement("div");
  var h5 = document.createElement("h5");
  var br = document.createElement("br");
  var table = document.createElement("table");
  var tbody = document.createElement("tbody");
  var tr1 = document.createElement("tr");
  var td1Tr1 = document.createElement("td");
  var td2Tr1 = document.createElement("td");
  var tr2 = document.createElement("tr");
  var td1Tr2 = document.createElement("td");
  var td2Tr2 = document.createElement("td");
  var tr3 = document.createElement("tr");
  var td1Tr3 = document.createElement("td");
  var td2Tr3 = document.createElement("td");
  var tr4 = document.createElement("tr");
  var td1Tr4 = document.createElement("td");
  var td2Tr4 = document.createElement("td");
  var h6 = document.createElement("h6");
  var img = document.createElement("img");
  var a = document.createElement('a');
  //body and table properties (center table)
  table.style.margin = "auto";
  table.style.width = "100%";
  tr1.style.padding = "5px";
  tr2.style.padding = "5px";
  tr3.style.padding = "5px";
  tr4.style.padding = "5px";
  //set the properties of main div
  mainDiv.style.width = "200px";
  mainDiv.style.height = "270px";
  mainDiv.style.overflow = "auto";
  //set the heights of the rows
  td1Tr1.style.width = "20%";
  td1Tr1.style.height = "auto";
  td1Tr1.style.textAlign = "left";
  td2Tr1.style.width = "80%";
  td2Tr1.style.height = "auto";
  td2Tr1.style.textAlign = "left";
  td2Tr1.style.paddingLeft = "10px";
  //for info set 2
  td1Tr2.style.width = "20%";
  td1Tr2.style.height = "auto";
  td1Tr2.style.textAlign = "left";
  td2Tr2.style.width = "80%";
  td2Tr2.style.height = "auto";
  td2Tr2.style.textAlign = "left";
  td2Tr2.style.paddingLeft = "10px";
  //for info set 3
  td1Tr3.style.width = "20%";
  td1Tr3.style.height = "auto";
  td1Tr3.style.textAlign = "left";
  td2Tr3.style.width = "80%";
  td2Tr3.style.height = "auto";
  td2Tr3.style.textAlign = "left";
  td2Tr3.style.paddingLeft = "10px";
  //for info set 4
  td1Tr4.style.width = "20%";
  td1Tr4.style.height = "auto";
  td1Tr4.style.textAlign = "left";
  td2Tr4.style.width = "80%";
  td2Tr4.style.height = "auto";
  td2Tr4.style.textAlign = "left";
  td2Tr4.style.paddingLeft = "10px";

  //create and fill the td themselves
  var td1Tr1Content = document.createTextNode("Name");
  var td2Tr1Content = document.createTextNode(jsonArr[index]["name"]);
  td1Tr1.appendChild(td1Tr1Content);
  td2Tr1.appendChild(td2Tr1Content);

  //fill content for info set 2
  var td1Tr2Content = document.createTextNode("Class");
  var td2Tr2Content = document.createTextNode(jsonArr[index]["class_year"]);
  td1Tr2.appendChild(td1Tr2Content);
  td2Tr2.appendChild(td2Tr2Content);

  //fill content for info set 3
  var td1Tr3Content = document.createTextNode("Major");
  var td2Tr3Content = document.createTextNode(jsonArr[index]["major"]);
  td1Tr3.appendChild(td1Tr3Content);
  td2Tr3.appendChild(td2Tr3Content);

  //fill content for info set 4
  var td1Tr4Content = document.createTextNode("Interest");
  var td2Tr4Content = document.createTextNode(jsonArr[index]["interest_area"]);
  td1Tr4.appendChild(td1Tr4Content);
  td2Tr4.appendChild(td2Tr4Content);

  //add the company's info image & name & links
  h5.appendChild(document.createTextNode(jsonArr[index]["affiliation"]));
  h6.appendChild(document.createTextNode(jsonArr[index]["partner_organization"]));
  a.href = jsonArr[index]["partner_website"]; //set the link from the image
  a.rel = "external"; //indicates that visiting site is external
  a.target = "_blank"; //link opens up in a different tab
  img.src = toDriveImageUrl(jsonArr[index]["partner_logo"]);
  img.alt = jsonArr[index]["partner_organization"] + " Logo";
  img.width = "100";
  img.height = "80";
  img.style.objectFit = "contain";

  //push heading into link
  a.appendChild(h6);

  //nest the rows
  tr1.appendChild(td1Tr1);
  tr1.appendChild(td2Tr1);
  tr2.appendChild(td1Tr2);
  tr2.appendChild(td2Tr2);
  tr3.appendChild(td1Tr3);
  tr3.appendChild(td2Tr3);
  tr4.appendChild(td1Tr4);
  tr4.appendChild(td2Tr4);

  //nest the rows into the tbody element
  tbody.appendChild(tr1);
  tbody.appendChild(tr2);
  tbody.appendChild(tr3);
  tbody.appendChild(tr4);

  //nest into the main table
  table.appendChild(tbody);

  //nest the current structure ...
  mainDiv.appendChild(h5);
  mainDiv.appendChild(br);
  mainDiv.appendChild(table);
  mainDiv.appendChild(br);
  mainDiv.appendChild(a);
  mainDiv.appendChild(img);

  //nest into parent and return
  parent.appendChild(mainDiv);
  return parent;
}

const getSuggestionsArray = () => {
  if (currentInfoWindow != null) {
    currentInfoWindow.close();
  }

  const searchBox = document.getElementById("search-input");

  if (searchBox.value == null || searchBox.value == "") {
    closeAllLists();
  } else {
    const xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = () => {
      if (xhttp.readyState == 4 && xhttp.status == 200) {
        const jsonArr = JSON.parse(xhttp.responseText);

        autocomplete(jsonArr);
      }
    }

    const searchItem = searchBox.value;

    let strArr = searchItem.split(" ");
    strArr = strArr.map((item) => {
      return item.charAt(0).toUpperCase() + item.slice(1).toLowerCase();
    });

    const newStr = strArr.join(" ");

    const url = "get-suggestion-results.php?search_item=" + encodeURIComponent(newStr) + 
                "&file=" + encodeURIComponent(fellowshipFile);
    xhttp.open("GET", url, true);
    xhttp.send();
  }
}

const autocomplete = (arr) => {
  const searchBox = document.getElementById("search-input");
  const searchValue = searchBox.value;

  const searchBoxParent = searchBox.parentNode;

  if (!searchValue) {
    return false;
  }

  closeAllLists();

  const suggestionsList = document.createElement("ul");
  suggestionsList.classList.add("autocomplete-suggestions-list");
  suggestionsList.classList.add("dropdown-menu");
  suggestionsList.classList.add("show");

  let count = 0;

  for (let key in arr) {
    if (key.substring(0, searchValue.length).toUpperCase() == searchValue.toUpperCase()) {
      const matchingItem = document.createElement("li");
      matchingItem.classList.add("dropdown-item");

      matchingItem.innerHTML = 
        "<strong>" + key.substring(0, searchValue.length) + "</strong>" + 
        key.substring(searchValue.length);

      matchingItem.innerHTML += "<input type='hidden' value='" + key + "' " + "id='" + arr[key] + "'>";

      matchingItem.addEventListener("click", () => {
        searchItem = matchingItem.getElementsByTagName("input")[0].value;
        searchCategory = matchingItem.getElementsByTagName("input")[0].id;

        searchBox.value = searchItem;

        closeAllLists();

        updateMapViaSearch();
      });

      count += 1;
      suggestionsList.appendChild(matchingItem);
    }
  }

  if (count != 0) {
    searchBoxParent.appendChild(suggestionsList);
  }
}

const closeAllLists = () => {
  const lists = document.getElementsByClassName("autocomplete-suggestions-list");

  for (let i = 0; i < lists.length; i++) {
    lists[i].parentNode.removeChild(lists[i]);
  }
}

const updateMapViaSearch = () => {
  const searchInput = document.getElementById("search-input").value;

  if (searchInput === "") {
    return;
  }

  for (let i = 0; i < markers.length; i++) {
    markers[i].setMap(null);
  }

  markers = [];

  const xhttp = new XMLHttpRequest();

  xhttp.onreadystatechange = () => {
    searchCategory = "";
    searchItem = "";

    if (xhttp.readyState === 4 && xhttp.status === 200) {
      const jsonArr = JSON.parse(xhttp.responseText);

      populateSearchView(jsonArr);
      updateMap(jsonArr);
    }
  }

  const url = "get-search-data.php?data=" + encodeURIComponent(searchInput) + 
              "&file=" + encodeURIComponent(fellowshipFile);

  xhttp.open("GET", url, true);
  xhttp.send();
}

const populateSearchView = (jsonArr, type="circle") => {
  if (jsonArr.length == 0) {
    return;
  }

  document.getElementById("sort-by-header").innerHTML = "Search Result";

  const distinctGroups = groupByColor(jsonArr);

  students = jsonArr;
  populateView(distinctGroups, type);
}

const groupByColor = (jsonArr) => {
  const colors = [];
  const groups = [];

  for (let i = 0; i < jsonArr.length; i++) {
    const elem = jsonArr[i];

    let color = "rgb(";

    let first = Math.floor(Math.random() * 255);
    let second = Math.floor(Math.random() * 150);
    let third = Math.floor(Math.random() * 255);

    color += (first + "," + second + "," + third + ")");

    //generate new color if old one exists in array
    while (colors.includes(color) == true){
      color = "rgb(";

      first = Math.floor(Math.random() * 255);
      second = Math.floor(Math.random() * 150);
      third = Math.floor(Math.random() * 255);

      color += (first + "," + second + "," + third + ")");
    }

    jsonArr[i]["color"] = color;
    groups[elem["name"]] = color; //or create new color
  }

  return groups;
}
