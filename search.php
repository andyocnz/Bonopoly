<?php
/************************************************
	The Search PHP File
************************************************/


/************************************************
	MySQL Connect
************************************************/

// Credentials
//$dbhost = "localhost";
//$dbname = "simu";
//$dbuser = "root";
//$dbpass = "";
require_once('global.php');
//	Connection
//global $tutorial_db;

//$tutorial_db = new mysqli();
//$tutorial_db->connect($dbhost, $dbuser, $dbpass, $dbname);
//$tutorial_db->set_charset("utf8");

//	Check Connection
//if ($tutorial_db->connect_errno) {
//    printf("Connect failed: %s\n", $tutorial_db->connect_error);
///    exit();
//}

/************************************************
	Search Functionality
************************************************/

// Get Search
$search_string = preg_replace("[^A-Za-z0-9]", " ", $_POST['query']);
$search_string =mysql_real_escape_string($search_string);

// Check Length More Than One Character
if (strlen($search_string) >= 3 && $search_string !== ' ') {
	// Build Query
	$query = 'SELECT * FROM library WHERE title LIKE "%'.$search_string.'%"';

	// Do Search
	$result = mysql_query($query);
	while($results = mysql_fetch_array($result)) {
		$result_array[] = $results;
	}

	// Check If We Have Results
	if (isset($result_array)) {
		foreach ($result_array as $result) {

			// Format Output Strings And Hightlight Matches
			//$display_function = preg_replace("/".$search_string."/",$search_string,$result['description']);
	

			// Insert Name
			

			// Insert Function
			

			// Insert URL
			$output = "<b>[".$result['title']."]</b> ".$result['description']."";
			
			// update search
			$search=$result['search']+1;
			$id=$result['id'];
			$sql1="UPDATE `library` SET search='$search' where id='$id'";
			$update = mysql_query($sql1);  //order executes
			//echo $update;
			// Output
			echo($output);

		}
	}else{

		// Format No Results Output
	
		$output = "<br><center><h5>Sorry :( No Results Found.</h5></center>";

			$sql2="INSERT INTO `unknownterm` (term) VALUES ('$search_string')";
			$update2 = mysql_query($sql2);  //order executes
			
		// Output
		echo($output);
	}
}


/*
// Build Function List (Insert All Functions Into DB - From PHP)

// Compile Functions Array
$functions = get_defined_functions();
$functions = $functions['internal'];

// Loop, Format and Insert
foreach ($functions as $function) {
	$function_name = str_replace("_", " ", $function);
	$function_name = ucwords($function_name);

	$query = '';
	$query = 'INSERT INTO search SET id = "", function = "'.$function.'", name = "'.$function_name.'"';

	$tutorial_db->query($query);
}
*/
?>