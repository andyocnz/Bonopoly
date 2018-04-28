<?php
if(!isset($_GET["act"])){header ('Location:index.php?act=homepage');exit();}
?>
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<title>Business game simulation</title>
	<link rel="stylesheet" type="text/css" href="reset.css" />
	<link rel="stylesheet" type="text/css" href="style.css" />
	<link rel="stylesheet" type="text/css" href="media-queries.css" />
	<script type="text/javascript" src="js/simpletabs_1.3.js"></script>
		<!-- Load jQuery library -->
	<script type="text/javascript" src="js/jquery.min.js"></script>
	<!-- Load custom js -->
	<script type="text/javascript" src="js/custom.js"></script>
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<link rel="shortcut icon" type="image/x-icon" href="imgs/favicon.ico">

	<!--[if IE]>
		<script src="http://html5shiv.googlecode.com/svn/trunk/html5.js"></script>
	<![endif]-->
</head>

<?php
  session_start();

  //Define Language file paths
  //define("LANG_DE_PATH", $_SERVER['DOCUMENT_ROOT'] . '/include/lang/de/');
  define("LANG_VN_PATH", $_SERVER['DOCUMENT_ROOT'] . '/simu/lang/');
  define("LANG_EN_PATH", $_SERVER['DOCUMENT_ROOT'] . '/simu/lang/');
 
 
  if (isset($_GET['lang'])) {
     
    // GET request found
 
    if ($_GET['lang'] == 'vn') {
       
      // asked for the language 'de' so include the 'de.php' file
      include LANG_VN_PATH . '/vn.php';
      $_SESSION['lang'] = 'vn';
    } else {
 
      // if not asked for 'de', include 'en.php' as default
      include LANG_EN_PATH . '/en.php';
      $_SESSION['lang'] = 'en';
    }
  } else if (isset($_SESSION['lang'])) {
 
    //SESSION variable found
 
    if ($_SESSION['lang'] == 'vn') {
 
      // language already set to 'de', so include 'de.php'

      include LANG_VN_PATH . '/vn.php';
    } else {
 
      // SESSION variable not set to 'de', so include 'en.php' by default
      include LANG_EN_PATH . '/en.php';
    }
  } else {
     
    // SESSION varibale not set, so set it to 'en' and include 'en.php' by default
    include LANG_EN_PATH . 'en.php';
    $_SESSION['lang'] = 'en';
  }
?>
<body id="home">
	<div id="wrapper">
		<div align="right" style="margin-right: 20px;"> 
	
<?php		
$server_header=$_SERVER['REQUEST_URI'];
$server_headeren=$server_header."&lang=en";
$server_headervn=$server_header."&lang=vn";
		echo"<a href=".$server_headeren."><img width=20 height=20 src='imgs/uk.ico' alt='English' /></a> ";
		echo"<a href=".$server_headervn.">  <img width=20 height=20 src='imgs/vietnam.ico' alt='Vietnamese' /></a>";
?>	

		</div>
		<header>


		
		<center><img src="imgs/logo.png" width="25%" height="25%" alt="Realmulation and challange" /><div class='clearfix'><br></div></center>
		<div id="search">
		<!-- Main Title -->
		<!-- Main Input -->
		<input type="text" value="<?php echo $LANG['termdefi']; ?>" onFocus="this.value=''" id="search">
		<!-- Show Results -->
		</div>
			<ul id="results"></ul>
		</header>

<?php
//echo $_SESSION['id'];
if($_GET["act"]=='homepage'){$s11="class=current"; } else {$s11='';} 	
if($_GET["act"]=='about'){$s12="class=current"; } else {$s12='';} 	
if($_GET["act"]=='simulations') {$s13="class=current"; } else {$s13='';} 	
if( $_GET["act"]=='solutions'){$s14="class=current"; } else {$s14='';} 	
if( $_GET["act"]=='contact'){$s15="class=current"; } else {$s15='';} 		
if( $_GET["act"]=='howto'){$s16="class=current"; } else {$s16='';} 
if( $_GET["act"]=='success'){$s17="class=current"; } else {$s17='';} 	

	echo"<ul id='nav'>";
	

	echo"<li ".$s11."><a href='?act=homepage'>".$LANG['HOME']."</a></li>";
echo"<li ".$s12."><a href='?act=about'>".$LANG['about']."</a></li>";
echo"<li ".$s14."><a href='?act=solutions'>".$LANG['solutions']."</a></li>";
echo"<li ".$s13."><a href='?act=simulations'>".$LANG['simulations']."</a></li>";
echo"<li ".$s15."><a href='?act=contact'>".$LANG['contact']."</a></li>";
echo"<li ".$s16."><a href='?act=howto'>How to</a></li>";
echo"<li ".$s17."><a href='?act=success'>Success stories</a></li>";
echo"<li class=menu><a href='game.php'>".$LANG['login']."</a></li>";
echo"<li class=menu><a href='?act=request'>Demo</a></li>";

	echo"</ul>";

?>
      		
		<section id="main-content">
			<div id="featured">

<?php
// for content 			
			 if(isset($_GET['act']))
  {
  require('global.php');
  $page=$_GET['act'];
   $lang=$_SESSION['lang'];
   $contentdb="content_".$lang;
  $result1 = mysql_query("SELECT ".$contentdb." FROM `content` where page='$page'");
  $array = mysql_fetch_array($result1);
 // $title=$array['title'];
  $content=$array[$contentdb];
  $content=str_replace("\n", "<br>", $content);
  
  //echo "<h4>".$title."</h4>";
  if(isset($_GET['output']))
	{
	$output=$_GET['output'];
	$msg="Thank you for your request!";
	if ($output==1) {echo "<div class=success><div><center><BR>".$msg."<br>--- </center></div></div><br>";}
	}
  if($_GET['act']!='homepage'){echo "<div class=note3>".$content."</div>";} else {echo $content;} 
  }
?>		

<?php
// for request			
			 if(isset($_POST['email']))
  {
			$ip=$_SERVER['REMOTE_ADDR'];
			$email=$_POST['email'];
			$email=str_replace('"', "", $email);
			$email=str_replace("'", "", $email);
			$email=mysql_real_escape_string($email);
			$date = date('Y-m-d H:i:s');
			
			$sql="INSERT INTO `request` (email,ip,date) VALUES ('$email','$ip','$date')";
			$result = mysql_query($sql);  //order executes 
			//echo $sql;
			  
			//echo $result;
			//$t=logs($_SESSION['username'],$_SESSION['id'],$sql,$result);
			header ("Location:?act=request&output=1");	
  }
?>					
			</div> <!-- END Featured !!!!!!!!!KEEP THIS-->
			</section>	
		

		
	</div> <!-- END Wrapper -->
<?php include('footer.php');?>		
</body>

</html>
