# Cardinal Quarter Map

Welcome to the newly built Cardinal Quarter Map!

This application displays the locations and information of the cardinal quarter fellows from multiple periods throughout the years.

A large part of this application was influenced by the previously developed Cardinal Quarter Map from Isaac Osafo.

## Map Overview

Here is a link to the map:

> https://cardinalquarterfellows.cardinalservice.org/

There are many features in the map. Below is a list of the features:

- Displays the location of all cardinal quarter fellows during a given period on a map
- Clicking on the location marker opens a popup window that shows more information about the fellow
- Can sort fellows by Interest Area, Affiliation, School, and Class Year by clicking items on the navigation bar
- Can sort by categories within the above categories by clicking on the legend on the left (ex. can sort by Arts & Media in the Interest Area)
- Can search for members and other categories using the search box

## Upload Overview

To publish new cardinal quarter fellows, you will need to upload a new CSV file.

Here is the link to uploading new CSV files:

> https://cardinalquarterfellows.cardinalservice.org/upload

[credential line removed]
After uploading, there are some features that you can manipulate your files with. Below is a list of the features:

- Ability to edit the name of the fellowship period that will be displayed on the map
- Can delete previously uploaded files
- Order files features (Move Up and Move Down buttons determine the order in which time period is displayed first and in what order they will be shown in the dropdown menu)

## How to Upload New Student Information

To upload new student information, we will first need to create a Google Form to obtain the student information. To do so, we will need to create a form that takes in the following information:

- Full Name (first and last)
- Fellowship/Opportunity
- Stanford Email
- Class Year
- Declared Major
- School
- Name of Partner Organization
- Partner Organization Website (URL)
- Location of Fellowship (City/Town)
- Location of Fellowship (Country)
- Latitude of Organization
- Longitude of Organization
- Organization's Logo (see below)
- Fellowship Interest Area (see options below)
  - Arts & Media
  - Education & Youth Development
  - Environmental Sustainability
  - Health
  - Human Rights
  - Identity
  - Law & Justice
  - Philanthropy
  - Policy & Governance
  - Social Entrepreneurship & Corporate Social Responsibility
  - Socio-Economic Prosperity
  - Technology & Engineering

**Organization Logo Special Requirements**
Getting the organization logos will require something more than just a text entry on a Google Form. It will require a file upload from the student's side.

Below is an explanation of how to create the file upload question, but if you need more help with visuals, here is a [guide](https://www.howtogeek.com/817296/how-to-let-users-upload-files-and-photos-in-google-forms/).

1.  Create a new question on the form
2.  Change the question type to File Upload
3.  Say yes to "Let respondents upload files to Drive"
4.  Name the question accordingly
5.  Enable "Allow only specific file types"
6.  Select the "Image" checkbox
7.  Keep the maximum number of files to 1
8.  Keep the maximum file size to 10 MB.
9.  Depending on how many fellows we have, we may have to change how much this form can accept in files. If we have more than 1000 fellows at some point, please change this value to something over 1 GB. With each fellow only getting 10 MB, 1000 fellows will exceed the 1 GB limit.

When a user now submits this form, the image they upload will be stored in your Google Drive. With a Stanford Drive account, you should have [unlimited free storage space](https://uit.stanford.edu/service/gsuite/drive) so do not worry about running out of space from students submitting images!

Now, we need to change the share permissions of the Google Drive folder that is holding the images that the students are uploading. This way, our map will be able to access these images!

When you create the file upload question, you should be able to see a "View Folder" button in the question menu. Click on this button and it will redirect you to the folder that it has created. Click on the folder name on the top bar and click "Share/Share". Then under the General access text, change "Restricted" to "Anyone with the link".

**Note** - This folder should not be deleted until you are sure that you no longer want to display these images on the site anymore. If the folder is deleted, the map will no longer be able to access these images.

With this, you should be all set with your image uploads.

For more help changing permissions, use the following [guide](https://support.google.com/drive/answer/7166529?hl=en&co=GENIE.Platform=Desktop#zippy=,allow-general-access-to-the-folder) using the instructions under "Allow general access to the folder".

### Formatting Into CSV File

After the students have uploaded their information, please [convert the responses to a Google Sheet](https://form-publisher.com/blog/google-forms-to-google-sheets/).

Locate this Google Sheet, and we need to ensure that your table is formatted correctly.

The first row of your table should contain no student information. It should only contain heading information for each column.

We also need to ensure that your CSV file is 15 columns wide and has the correct values in each column. Please make changes in the columns accordingly based on the specified order.

The columns should be ordered as follows:

1.  Affiliation
2.  Fellowship/Opportunity
3.  Name
4.  Stanford Email
5.  Class Year
6.  Major
7.  School
8.  Name of Partner Organization
9.  Fellowship Location
10. Country
11. Latitude
12. Longitude
13. Community Partner Website
14. Link to Logo
15. Interest Areas

Next, [download the Google Sheet as a CSV file](https://xfanatical.com/blog/how-to-export-google-sheets-as-csv/).

**IMPORTANT: When naming your file after downloading, please avoid using special characters. Please only use underscores "\_" for spacing**

[Here](./EXAMPLE.csv) is a link to an example of a correctly formatted CSV file.

Now, you should be good to go with your file.

### Uploading CSV File

After downloading your CSV file, we are now ready to upload the file into the application.

Navigate to the [upload link](https://cardinalquarterfellows.cardinalservice.org/upload) and log in.

Click the "Upload Files" button and a box should pop up.

The "Display Name" box lets you choose a custom display name to be shown on the map application.

The "Use Old Image Rendering" checkbox should only be checked for CSV files that do not use Google Drive for the partner logo. I believe all years before and including 2023 did not use Google Drive. So when re-uploading these files, make sure to check this box.

Fill out the values accordingly and click upload.

Now you should be able to see the new upload!

### Uploading Logos Without Student Form Submission

If you would like to upload your own logo images, here is how to do it.

The easiest way to do it is to submit a Google Form entry yourself with the student data and the new logo.

However, if you would like to upload it by yourself, this process will be a bit more complicated.

1. First, you would need to upload the new logo into the previously created Google Drive Folder from the Google Form or create a new folder that has share access via link.
2. Upload the new logo into that folder
3. Get the ID of this logo. To do this, you will need to copy the share link of the image. The share link should look something like: `https://drive.google.com/file/d/1WCgIp7y3lSx4R7ml36jf0F-qpaFu_OYK/view?usp=drive_link`. You can find the ID of this image in between the `/d/` and the `/view` part of the URL. For this URL, the ID would be `1WCgIp7y3lSx4R7ml36jf0F-qpaFu_OYK`.
4. Copy this ID and format it in this way: `https://drive.google.com/open?id={id_goes_here}`. For example, if your ID is `1WCgIp7y3lSx4R7ml36jf0F-qpaFu_OYK`, then the correct format would be `https://drive.google.com/open?id=1WCgIp7y3lSx4R7ml36jf0F-qpaFu_OYK`. A way to know if this works is that if you enter the formatted URL into a web browser, it should take you to the correct image.
5. Use this formatted link and paste it to the respective students partner logo link entry in the CSV file.

### Upload Error Messages

If you run into some errors uploading files, please check out the following:

#### Error Message 1

If you get this error, please rename your file. Remove all special characters from the file name and only use underscores "\_" if spaces are needed. Make sure there are no extra whitespace characters in the file name.

#### Error Message 2

If you get this error, there is something wrong with a certain entry in the CSV file.

If the full error message says something about an incorrect string, this is due to a special character in the CSV file that is not normally found in the English language. If you are using Google Sheets, downloading the Sheet as a CSV file should normally fix this. However, if it does not, please reopen your CSV file using another application other than Google Sheets and export it as a CSV file but using UTF8 encoding. Here is a [link](https://help.cheqroom.com/en/articles/1101540-how-do-i-export-my-spreadsheet-to-a-utf-8-encoded-csv) on how to do it on Mac with Apple Numbers.

If this does not work, you may have to track down the entry that contains the special character and remove it manually.

If the full error message says something is too long, it is likely that one of your CSV entires has an entry that is too long for the database. Please check your CSV file to see if there are any columns that contain text that is longer than what is allowed.

Here is a list of the maximum length that each column can have:

| Column                             | Max Length (in characters) |
| ---------------------------------- | -------------------------- |
| Full Name                          | 128                        |
| Stanford Email                     | 320                        |
| Class Year                         | 128                        |
| Declared Major                     | 128                        |
| School                             | 128                        |
| Fellowship/Opportunity             | 128                        |
| Name of Partner Organization       | 255                        |
| Location of Fellowhip (Country)    | 128                        |
| Latitude                           | 128                        |
| Longitude                          | 128                        |
| Affiliation                        | 255                        |
| Location of Fellowship (City/Town) | 255                        |
| Partner Organization Website (URL) | 2083                       |
| Partner Organization Logo Link     | 2083                       |
| Interest Area                      | 255                        |

## Technologies Used (for future developers)

This application was built using HTML, CSS, JavaScript, PHP, and MySQL.

For CSS, I employed the use of [Bootstrap](https://getbootstrap.com/) for a large chunk of the styling. I added this by using a CDN link in the headers of the HTML files.

### Google Map API

I used the Google Map API to display the markers on the map. Here is [documentation](https://developers.google.com/maps/documentation/javascript/adding-a-google-map) on how to use it.

### MySQL Database Access

The database access information can be found in the [database.php](database.php) file.

When developing locally, use the following login information to access the local MySQL database:

```
$host = "localhost";
$username = "root";
[credential line removed]
$dbname = "cardink5_haas_db";
```

When deploying onto BlueHost, use the following login information instead:

```
$host = "localhost";
$username = "cardink5_cq_fellows";
[credential line removed]
$dbname = "cardink5_haas_db";
```

### Local Development

To develop this locally, I used [XAMPP](https://www.apachefriends.org/) to simulate a web server with a MySQL database. To set this up, you should download XAMPP from the link above. There is no need to download MySQL or anything else individually. Then, once installed, find the location of the htdocs directory within the XAMPP directory. Create a new directory and upload the program files in there. Then start the server through the XAMPP application. Using a browser, you should be able to navigate to `localhost/{insert-directory-name-here}` and run the site.

Here is a [video](https://www.youtube.com/watch?v=YXCK03O-wjM&ab_channel=johangodinho) of how to set it up if needed.

[credential line removed]

### Deployment

This application is deployed via [BlueHost](https://my.bluehost.com/web-hosting/cplogin) and cPanel. Please ask for the login information.

When logged in, you can see the current site files by clicking the "Advanced" settings. Then navigate to "File Manager". The files should be stored in the `public_html` directory.

## Further Questions

If you have any further questions, please feel free to contact me!

My email address is: williammzhu@gmail.com
