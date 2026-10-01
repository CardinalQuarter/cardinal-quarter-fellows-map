<?php

/**
 * creates a class profile for each student
 */

class Student
{
  private $name;
  private $email;
  private $class_year;
  private $major;
  private $school;
  private $fellowship;
  private $partner_organization;
  private $country;
  private $latitude;
  private $longitude;
  private $affiliation;
  private $fellowship_loc;
  private $partner_website;
  private $partner_logo;
  private $interest_area;
  private $jsonInfo;
  private $color;

  function __construct()
  {
    //...we use getters and setters
  }

  function setName($name)
  {
    $this->name = $name;
  }
  function getName()
  {
    return $this->name;
  }

  function setEmail($email)
  {
    $this->email = $email;
  }
  function getEmail()
  {
    return $this->email;
  }

  function setClassYear($class_year)
  {
    $this->class_year = $class_year;
  }
  function getClassYear()
  {
    return $this->class_year;
  }

  function setMajor($major)
  {
    $this->major = $major;
  }
  function getMajor()
  {
    return $this->major;
  }

  function setSchool($school)
  {
    $this->school = $school;
  }
  function getSchool()
  {
    return $this->school;
  }

  function setFellowship($fellowship)
  {
    $this->fellowship = $fellowship;
  }
  function getFellowship()
  {
    return $this->fellowship;
  }

  function setPartnerOrganization($partner_organization)
  {
    $this->partner_organization = $partner_organization;
  }
  function getPartnerOrganization()
  {
    return $this->partner_organization;
  }

  function setCountry($country)
  {
    $this->country = $country;
  }
  function getCountry()
  {
    return $this->country;
  }

  function setFellowshipLocation($fellowship_loc)
  {
    $this->fellowship_loc = $fellowship_loc;
  }
  function getFellowshipLocation()
  {
    return $this->fellowship_loc;
  }

  function setLatitude($latitude)
  {
    $this->latitude = $latitude;
  }
  function getLatitude()
  {
    return $this->latitude;
  }

  function setLongitude($longitude)
  {
    $this->longitude = $longitude;
  }
  function getLongitude()
  {
    return $this->longitude;
  }

  function setAffiliation($affiliation)
  {
    $this->affiliation = $affiliation;
  }
  function getAffiliation()
  {
    return $this->affiliation;
  }

  function setPartnerWebsite($partner_website)
  {
    $this->partner_website = $partner_website;
  }
  function getPartnerWebsite()
  {
    return $this->partner_website;
  }

  function setCompanyLogo($partner_logo)
  {
    $this->partner_logo = $partner_logo;
  }
  function getCompanyLogo()
  {
    return $this->partner_logo;
  }

  function setInterestAreas($interests)
  {
    $this->interest_area = $interests;
  }
  function getInterestAreas()
  {
    return $this->interest_area;
  }

  function setColor($color)
  {
    $this->color = $color;
  }
  function getColor()
  {
    return $this->color;
  }

  function generate_assoc_arr()
  {
    $keys = array();
    $values = array();
    array_push($keys, "name");
    array_push($keys, "email");
    array_push($keys, "class_year");
    array_push($keys, "major");
    array_push($keys, "school");
    array_push($keys, "fellowship");
    array_push($keys, "partner_organization");
    array_push($keys, "country");
    array_push($keys, "fellowship_loc");
    array_push($keys, "latitude");
    array_push($keys, "longitude");
    array_push($keys, "affiliation");
    array_push($keys, "partner_website");
    array_push($keys, "partner_logo");
    array_push($keys, "interest_area");
    array_push($keys, "color");

    //create the array of the actual values
    array_push($values, $this->name);
    array_push($values, $this->email);
    array_push($values, $this->class_year);
    array_push($values, $this->major);
    array_push($values, $this->school);
    array_push($values, $this->fellowship);
    array_push($values, $this->partner_organization);
    array_push($values, $this->country);
    array_push($values, $this->fellowship_loc);
    array_push($values, $this->latitude);
    array_push($values, $this->longitude);
    array_push($values, $this->affiliation);
    array_push($values, $this->partner_website);
    array_push($values, $this->partner_logo);
    array_push($values, $this->interest_area);
    array_push($values, $this->color);

    //combine them into an associative array and dump ocifetchstatement
    $arr_assoc = array_combine($keys, $values);
    return $arr_assoc;
  }
}

/*
 * Stores the latitude and longitudes as doubles/floats
 * Encapsulates lat-long locations on map
 */
class Location
{
  private $longitude;
  private $latitude;
  function __construct($latitude, $longitude)
  {
    $this->latitude = $latitude;
    $this->longitude = $longitude;
  }

  function getLatitude()
  {
    return $this->latitude;
  }
  function getLongitude()
  {
    return $this->longitude;
  }

  function setLatitude($latitude)
  {
    $this->latitude = $latitude;
  }
  function setLongitude($longitude)
  {
    $this->longitude = $longitude;
  }
}

?>