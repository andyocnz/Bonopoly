<?php
if (!isset($_SESSION['username'])&&!isset($_GET['act'])){
    header ("Location:game.php?act=home");
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
   
	<meta charset="utf-8" />
	<title>Bonopoly - Business game simulation for School</title>
	<link rel="stylesheet" type="text/css" href="reset.css" />
	<link rel="stylesheet" type="text/css" href="style.css" />
	
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
<?php  //Start the Session
  
if (isset($_GET['mod']))
{
session_start();

if (isset($_SESSION['LAST_ACTIVITY']) && (time() - $_SESSION['LAST_ACTIVITY'] > 1800)) {
    // last request was more than 30 minutes ago
    session_unset();     // unset $_SESSION variable for the run-time 
    session_destroy();   // destroy session data in storage
}

$_SESSION['LAST_ACTIVITY'] = time();

//echo time()."-";
//echo $_SESSION['LAST_ACTIVITY'];

 require('global.php');
//3. If the form is submitted or not.
//3.1 If the form is submitted
if (isset($_POST['username']) and isset($_POST['password'])){
//3.1.1 Assigning posted values to variables.
$username = $_POST['username'];
$password = $_POST['password'];
//3.1.2 Checking the values are existing in the database or not
$query = "SELECT id FROM `mod` WHERE email='$username' and password='$password'";
$result = mysql_query($query) or die(mysql_error());
$id_r= mysql_fetch_array($result);
$id=$id_r['id'];
$_SESSION['id'] = $id;
//exit();
$count = mysql_num_rows($result);
//3.1.2 If the posted values are equal to the database values, then session will be created for the user.
if ($count == 1){
$_SESSION['username'] = $username;

if ($id==0)
{
$_SESSION['admin'] = 1;
$_SESSION['aid'] = $id;

}
else
{
$_SESSION['mod'] = 1;
$_SESSION['mid'] = $id;

}
$_SESSION['start'] = time();

header ("Location:game.php?act=home");
}else{
//3.1.3 If the login credentials doesn't match, he will be shown with an error message.
echo "<p><center>Wrong username or password!</center>";
//header ("Location:game.php");
exit;
}
}
//3.1.4 if the user is logged in Greets the user with message
if (isset($_SESSION['username'])){
$username = $_SESSION['username'];
//echo "Hi" . $username . "";
//echo "This is the Members Area";
//echo "<a href='logout.php'>Logout</a>";
//$msg=$username ."<a href='logout.php'>Logout</a>";

}else{
echo"<div id=\"login\"><h2><span class=\"fontawesome-lock\"></span>Sign In</h2>";
echo"<form action='game.php?mod&act=home' method='POST'>";
echo"<fieldset><p><label for=\"email\">E-mail address</label></p>";
echo"<p><input type=\"email\" name='username' id=\"email\" value=\"mail@address.com\" onBlur=\"if(this.value=='')this.value='mail@address.com'\" onFocus=\"if(this.value=='mail@address.com')this.value=''\"></p>"; 
echo"<p><label for=\"password\">Password</label></p>";
echo"<p><input type=\"password\" name='password' id=\"password\" value=\"password\" onBlur=\"if(this.value=='')this.value='password'\" onFocus=\"if(this.value=='password')this.value=''\"></p>"; 
echo"<p><input type=\"submit\" value=\"Sign In\"></p>";
echo"</fieldset></form></div>";
echo"<center><footer>© 2014 - <a href='game.php?mod&act=home'>Admin</a> | All Rights Reserved</center></footer>";
exit;
//3.2 When the user visits the page first time, simple login form will be displayed.
}
// for bounce
}
?>	
<?php  //Start the Session
//if (isset($_GET['user']))
//{
session_start();

if (isset($_SESSION['LAST_ACTIVITY']) && (time() - $_SESSION['LAST_ACTIVITY'] > 1800)) {
    // last request was more than 30 minutes ago
    session_unset();     // unset $_SESSION variable for the run-time 
    session_destroy();   // destroy session data in storage
}

$_SESSION['LAST_ACTIVITY'] = time();

//echo time()."-";
//echo $_SESSION['LAST_ACTIVITY'];

 require('global.php');
//3. If the form is submitted or not.
//3.1 If the form is submitted


if (isset($_POST['uemail']) and isset($_POST['upass'])){
//3.1.1 Assigning posted values to variables.
$email = $_POST['uemail'];
$password = $_POST['upass'];

//3.1.2 Checking the values are existing in the database or not
$query = "SELECT id,team_id,game_id FROM `player` WHERE email='$email' and password='$password'";
$result = mysql_query($query) or die(mysql_error());
$id_r= mysql_fetch_array($result);
$id=$id_r['id'];
// get team id
$team_id=$id_r['team_id'];
$game_id=$id_r['game_id'];

//exit();
$count = mysql_num_rows($result);
//3.1.2 If the posted values are equal to the database values, then session will be created for the user.
if ($count == 1){
$_SESSION['username'] = $email;
$_SESSION['user_id'] = $id;
$_SESSION['id'] = $id;
$_SESSION['start'] = time();
$_SESSION['game_id'] = $game_id;
$_SESSION['team_id'] = $team_id;
$_SESSION['player']=1;
header ("Location:game.php?act=home");exit();
}else{
//3.1.3 If the login credentials doesn't match, he will be shown with an error message.
echo "<p><center>Wrong username or password USER!</center>";
header ("Location:game.php");
exit;
}
}
//3.1.4 if the user is logged in Greets the user with message
if (isset($_SESSION['username'])){
$username = $_SESSION['username'];
//echo "Hi" . $username . "";
//echo "This is the Members Area";
//echo "<a href='logout.php'>Logout</a>";
//$msg=$username ."<a href='logout.php'>Logout</a>";

}else{
echo"<div id=\"login\"><h2><span class=\"fontawesome-lock\"></span>Sign In</h2>";
echo"<form action='game.php' method='POST'>";
echo"<fieldset><p><label for=\"email\">E-mail address</label></p>";
echo"<p><input type=\"email\" name='uemail' id=\"email\" value=\"mail@address.com\" onBlur=\"if(this.value=='')this.value='mail@address.com'\" onFocus=\"if(this.value=='mail@address.com')this.value=''\"></p>"; 
echo"<p><label for=\"password\">Password</label></p>";
echo"<p><input type=\"password\" name='upass' id=\"password\" value=\"\" onBlur=\"if(this.value=='')this.value='password'\" onFocus=\"if(this.value=='password')this.value=''\"></p>"; 
echo"<p><input type=\"submit\" value=\"Sign In\"></p>";
echo"</fieldset></form></div>";
echo"<center><footer>© 2014 - <a href='game.php?mod&act=home'>Admin</a> | All Rights Reserved</center></footer>";
exit;
//3.2 When the user visits the page first time, simple login form will be displayed.
//}

}
?>	
<?php
 // session_start();

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
<?php
function message($message,$result)
{
//success warning
if ($result==1) {$info="success";} 
if ($result==0){$info="error";}
if ($result==2){$info="info";}
if ($result==3){$info="warning";}
$msg="<div class='".$info."'><div><center><BR>".$message."<br>--- </center></div></div><br>";	
return $msg;

}
?>
<?php

function checktime($gid,$tid)
{
 require('global.php');
if (isset($_SESSION['lang'])) {
 
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
 if ($gid!="" & $tid!="")
 {
 	// round
	$res_round = mysql_query("SELECT max(round) FROM output where game_id='$gid' and final='1' and team_id='$tid'");
	$array_round = mysql_fetch_array($res_round);
	$round=$array_round[0];
	$round_for_input=$round+1;	
	
	$d= "SELECT deadline,id FROM `round_assumption` where game_id='$gid' and round='$round_for_input'";
	$result_d = mysql_query($d) or die(mysql_error());
	$deadline = mysql_fetch_array($result_d);
	$dline=$deadline['deadline'];
	
	// time	
	$game = mysql_query("SELECT hours_per_round FROM `game` where id='$gid'");
	$hpr = mysql_fetch_array($game);
	$hours_per_round=$hpr['hours_per_round']; 
	
	// hours left
	$date = date('Y-m-d H:i:s');
	$now = strtotime($date);
	$deadline = strtotime($dline);
	$time_diff=round(($deadline - $now)/60/60,2);
	
	if ($time_diff>0 and $time_diff<$hours_per_round)
	{	
	// change to days and weeks
	if ($time_diff>=24)
	{
	$day_diff=round($time_diff/24,2);
	$fix=$LANG['day'];
	}
	else
	{
	$day_diff=$time_diff;
	$fix=$LANG['hour'];
	}
	$m=$LANG['Round']." ".$round_for_input." ".$LANG['timeremaining']." ".$day_diff." ".$fix;
	if ($time_diff<0.5){$msg=message($m,3);}
	if ($time_diff>0.5){$msg=message($m,2);}
	$msg=message($m,2);
	return $msg;
	}
	else
	{
	$m=$LANG['noteditable'];
	$msg=message($m,0);
	echo $msg;
	//$over_time=TRUE;
	//return $over_time;
	//header ("Location:game.php?act=schedule&time=0&gid=$gid");
	//exit();
	}
 
 }
	
}

function overtime($gid,$tid)
{
 require('global.php');
 if ($gid!="" & $tid!="")
 {

 	// round
	$res_round = mysql_query("SELECT max(round) FROM output where game_id='$gid' and final='1' and team_id='$tid'");
	$array_round = mysql_fetch_array($res_round);
	$round=$array_round[0];
	$round_for_input=$round+1;	
	
	$d= "SELECT deadline,id FROM `round_assumption` where game_id='$gid' and round='$round_for_input'";
	$result_d = mysql_query($d) or die(mysql_error());
	$deadline = mysql_fetch_array($result_d);
	$dline=$deadline['deadline'];
	
	// time	
	$game = mysql_query("SELECT hours_per_round,no_of_rounds FROM `game` where id='$gid'");
	$hpr = mysql_fetch_array($game);
	$hours_per_round=$hpr['hours_per_round']; 
	$no_round=$hpr['no_of_rounds'];
	
	// hours left
	$date = date('Y-m-d H:i:s');
	$now = strtotime($date);
	$deadline = strtotime($dline);
	$time_diff=round(($deadline - $now)/60/60,2);
	
	if ($time_diff>0 and $time_diff<=$hours_per_round)
	{	
	$over_time=0;
	return $over_time;
	}
	else
	{
	$over_time=1;
	if ($round>=$no_round) {$over_time=0;}
	return $over_time;
	}
	
	
 }
	
}

?>
<?php
if ($_SESSION['mod']==1)
{
$user_for_logs=1;
}
if ($_SESSION['admin']==1)
{
$user_for_logs=0;
}
if ($_SESSION['player']==1)
{
$user_for_logs=2;
}
?>
<?php

function logs($user_name,$user_id,$msg,$result)
{
 require('global.php');
 if ($msg!="")
 {
 //database
 //user_name /user_id  /message   /result  /date /IP  /view
 //
 $date = date('Y-m-d H:i:s');
 $view=0;
 $ip=$_SERVER['REMOTE_ADDR'];
 
$sql="INSERT INTO `logs` (user_name,user_id,message,result,date,ip,view)VALUES ('$user_name',$user_id,'$msg','$result','$date','$ip','$view')";
$result = mysql_query($sql);  //order executes 
return $result;
 }
	
}
?>
<?php
function output_round0($country,$price,$sale,$var_cost,$los_cost,$promotion_rate,$depreciation,$asset_value,$admin_cost,$Receivables_rate,$Payables_rate,$tax,$Inventory,$share_cap,$Longterm_loans,$interest,$min_cash,$face_value,$rnd)
{
//echo $sale*($var_cost+$los_cost)*$promotion;
$sale_rev_title=0;
//echo $price."/".number_format($sale);

$from_market=round($price*$sale,0);
//echo "/".$from_market."/";
//exit;
//echo "<br>".number_format($from_market)."/";exit;
//$from_market=0;
$transfer=0;
$revenue_total=$from_market;
$Receivables=$Receivables_rate*$revenue_total;
$cost_ex=0;


$feature=0;
$trans=round($sale*$los_cost,0);
//$rnd=0;
$promotion=$sale*($var_cost+$los_cost)*$promotion_rate;

$admin=$admin_cost;

if ($country=='1')
{
$var_cost_total=round($var_cost*$sale);
$costofimport=0;
}
if ($country=='2' or $country=='3')
{
$var_cost_total=0;
$costofimport=round($var_cost*$sale);
}


$total_cost=$var_cost_total+$feature+$trans+$promotion+$admin+$rnd;
$Payables=$Payables_rate*$total_cost;
$ebitda=$from_market-$total_cost;
//------------------ test balance
//$Payables=0;
//$interest=0;
//$Receivables=0;
//$Inventory=0;
//$tax=0;
//$depreciation=0;
//-------------------end test
// hard input hardinput
$retain_ratio=rand(5,15);
//
$depreciation=$depreciation*$asset_value*1000;
$ebit=$ebitda-$depreciation;
$netfinance=$interest*1000;
$profit_b4_tax=$ebit-$netfinance;
$income_tax=$profit_b4_tax*$tax;
if ($profit_b4_tax<0){$income_tax=0;}
$profit_after_tax=$profit_b4_tax-$income_tax;

// -----------------------Balance sheet
$ASSETS=0;

$Fixed_assets=($asset_value*1000-$depreciation);

$SHAREHOLDERS=0;
$Equity=0;
$Sharecapital=($asset_value-$Longterm_loans)*1000;
//echo "<br>asset value".$asset_value;
//echo"<br>log term".$Longterm_loans;
//echo"<br>share cap".$Sharecapital;

$Other_restricted_equity=0;
$Profit_for_the_round=$profit_after_tax;

$LIABILITIES=0;


// Get short_term_loan

//$Retained_earnings=$retain_ratio/100*$revenue_total;
$Retained_earnings=0;
// end
$Cash=$Retained_earnings+$ebitda-$Inventory-$income_tax+$Payables-$Receivables-$netfinance;
if ($Cash<$min_cash)
{$Short_term_loans=$min_cash-$Cash;$Cash=$min_cash;} else {$Short_term_loans=0;}
$Longterm_loans=$Longterm_loans*1000;

// end
$Total_equity=$Retained_earnings+$Sharecapital+$Other_restricted_equity+$Profit_for_the_round;
$Total_liabilities=$Longterm_loans+$Short_term_loans+$Payables;
$Total_shareholder=$Total_equity+$Total_liabilities;
$Total_assets=$Fixed_assets+$Inventory+$Receivables+$Cash;
// print
//echo "total asset :".$Total_assets."====";echo "total shareholder :".$Total_shareholder."<br>";
//echo "cash :".$Cash."<br>";
//echo "total equity :".$Total_equity."<br>";
//echo "total liablity :".$Total_liabilities."<br>";

//exit();
// Ratio outputs
//$Ratios.",".$Market_cap.",".$Shares_outstanding.",".$Share_price_end.",".$Average_share_price.",".$Dividend.",".$PE.",".$Cumulative_return.",".$Others_ratio.",".$ratio_EBITDA.",".$ratio_EBIT.",".$ROS.",".$Equity_ratio.",".$Net_debt_to_equity.",".$ROCE.",".$ROE.",".$EPS.",".

$Ratios=0;
$Shares_outstanding=((int)$Sharecapital)*0.1; 
//echo "$Sharecapital<br>share out".$Sharecapital*0.1;
//$mul=rand(5,25);
//$Share_price_end=$face_value*$mul; 
// hardinput hard input
$expect_div=40;
$expect_shareprice=100;
$mul=rand(10,25);
$Share_price_end=($expect_div+$expect_shareprice)/(1+$mul/100); 
$Market_cap=$Shares_outstanding*$Share_price_end;
$Average_share_price=rand($Share_price_end*0.8,$Share_price_end);
$Dividend=0;
$PE="-";
$Cumulative_return=0; 
$Others_ratio=0;
$ratio_EBITDA=$ebitda/$revenue_total;
$ratio_EBIT=$ebit/$revenue_total; 
$ROS=$profit_after_tax/$revenue_total;
$Equity_ratio=$Total_equity/$Total_liabilities;
$Net_debt_to_equity=($Longterm_loans-$Short_term_loans)/$Total_liabilities;
$ROCE=$ebit/$Total_liabilities;
$ROE=$profit_after_tax/$Total_equity;
if($Shares_outstanding==0){ $EPS=0;} else {$EPS=$profit_after_tax/$Shares_outstanding;}

//print check
//echo "ROE :".$ROE."<br>";
//echo "Ave share price :".$Average_share_price."<br>";
//echo "end share price:".$Share_price_end."<br>";


//echo "shareout :".$Shares_outstanding."<br>";
// make up ouput
$internal_loans=0;
$output=$sale_rev_title.",".$from_market.",".$transfer.",".$revenue_total.",".$cost_ex.",".$var_cost_total.",".$feature.",".$trans.",".$rnd.",".$promotion.",".$admin.",".$costofimport.",".$total_cost.",".$ebitda.",".$depreciation.",".$ebit.",".$netfinance.",".$profit_b4_tax.",".$income_tax.",".$profit_after_tax.",".$ASSETS.",".$Fixed_assets.",".$Inventory.",".$Receivables.",".$Cash.",".$Total_assets.",".$SHAREHOLDERS.",".$Equity.",".$Sharecapital.",".$Other_restricted_equity.",".$Profit_for_the_round.",".$Retained_earnings.",".$Total_equity.",".$LIABILITIES.",".$Longterm_loans.",".$Short_term_loans.",".$internal_loans.",".$Payables.",".$Total_liabilities.",".$Total_shareholder.",".$Ratios.",".$Market_cap.",".$Shares_outstanding.",".$Share_price_end.",".$Average_share_price.",".$Dividend.",".$PE.",".$Cumulative_return.",".$Others_ratio.",".$ratio_EBITDA.",".$ratio_EBIT.",".$ROS.",".$Equity_ratio.",".$Net_debt_to_equity.",".$ROCE.",".$ROE.",".$EPS;

//echo $output;
//echo "Rev :".$sale_rev_title."<br>";
//echo "frommart :".$from_market."<br>";
//echo "transfer :".$transfer."<br>";
//echo "rev total :".$revenue_total."<br>";
//echo "cost ex :".$cost_ex."<br>";
//echo "varcost :".$var_cost_total."<br>";
//echo "feature :".$feature."<br>";
//echo "los cost :".$trans."<br>";
//echo "rnd :".$rnd."<br>";
//echo "promotio :".$promotion."<br>";
//echo "admin :".$admin."<br>";
//echo "import :".$costofimport."<br>";
//echo "total cost :".$total_cost."<br>";

//echo "EBITDA :".$ebitda."<br>";
//echo "Depreciation :".$depreciation."<br>";

//echo "EBIT :".$ebit."<br>";
//echo "net finance:".$netfinance."<br>";
//echo "P4tax :".$profit_b4_tax."-".$tax."<br>";
//echo "Tax :".$income_tax."<br>";
//echo "Profit_after_tax :".$profit_after_tax."<br>";


return $output;
}
?>
<?php
//------------------------------------ INSERT NEW GAME
  if( isset($_POST["mod_id"]) and  $_GET['act']=='5' and isset($_POST["name_game"]) and $_POST["create_game"]=='1' )
  {
   require('global.php');
// GET INPUT  
$name_game=$_POST['name_game'];
$prefix=$_POST['prefix'];
$name_game=$prefix.$name_game;
//echo $name_game;
//exit;
$no_of_teamsname=$_POST['no_of_teams'];
$no_of_rounds=$_POST['no_of_rounds'];
$hours_per_round=$_POST['hours_per_round'];
$no_of_factory_c1=$_POST['no_of_factory_c1'];


$cap_allocate=$_POST['cap_allocate'];
$cap_allocate=$cap_allocate/100;
if( isset($_POST['tech1']) )
  {$tech1=$_POST['tech1'];  } else {$tech1="0";}
if( isset($_POST['tech2']) )
  {$tech2=$_POST['tech2'];  } else {$tech2="0";}
if( isset($_POST['tech3']) )
  {$tech3=$_POST['tech3'];  } else {$tech3="0";}
if( isset($_POST['tech4']) )
  {$tech4=$_POST['tech4'];  } else {$tech4="0";}
$tech=$tech1.",".$tech2.",".$tech3.",".$tech4;
$mark_up_price=$_POST['mark_up_price'];
// GET ROUND 0 result
$capacity_per_plant=$_POST['capacity_per_plant']*1000;
$Inventory_1st_r=$_POST['Inventory_1st_r'];
$totalsale=round($no_of_teamsname*($capacity_per_plant*$cap_allocate*$no_of_factory_c1)*(100-$Inventory_1st_r/100)/100,0);

$Marketshare_c1_r0=$_POST['Marketshare_c1_r0'];
$Marketshare_c2_r0=$_POST['Marketshare_c2_r0'];
$Marketshare_c3_r0=100-($Marketshare_c2_r0+$Marketshare_c1_r0);
$totalsale_c1=round($totalsale*$Marketshare_c1_r0/100,0);
$totalsale_c2=round($totalsale*$Marketshare_c2_r0/100,0);
//echo $totalsale_c2;
//exit;
$totalsale_c3=round($totalsale*$Marketshare_c3_r0/100,0);
$production_c1=$totalsale_c1*(1+$Inventory_1st_r/100);
$production_c2=$totalsale_c2*(1);
$production_c3=$totalsale_c3*(1);

//$production_c1_input="1,100".",".$totalsale_c1*(1+$Inventory_1st_r/100).",0,0,0";
//$production_c2_input="1,0,0,0,0,0";
//$production_c3_input="1,0,0,0,0,0";

$est_production_c1=$totalsale_c1.",0,0,0";
$est_production_c2=$totalsale_c2.",0,0,0";

// Sale for each team
$sale_per_team_r0_c1=round($totalsale_c1/$no_of_teamsname,0);
$sale_per_team_r0_c2=round($totalsale_c2/$no_of_teamsname,0);
$sale_per_team_r0_c3=round($totalsale_c3/$no_of_teamsname,0);
// Get price
$min_cash=$_POST['Minimum_cash']*1000000;
$Unitcost_supplier1=$_POST['Unitcost_supplier1'];
$Unitcost_direct_material=$_POST['Unitcost_direct_material'];
$Unitcost_direct_labour=$_POST['Unitcost_direct_labour'];
$Cost_equation=$_POST['Cost_equation'];
$Logistic_tariffs_c1_c3=$_POST['Logistic_tariffs_c1_c3'];
$Logistic_tariffs_c1_c2=$_POST['Logistic_tariffs_c1_c2'];
$equation_array = preg_split("/[\s,]+/",$Cost_equation);
$Promotion=$_POST['Promotion'];
$Promotion=$Promotion/100;
$cost_multiplier=(1+$Promotion)*($equation_array[0]* pow($cap_allocate,$equation_array[1]))+($equation_array[2]*$cap_allocate)+$equation_array[3];
$cost_multiplier_round0=$cost_multiplier*($Unitcost_supplier1+$Unitcost_direct_material+$Unitcost_direct_labour);
// hardinput hard input
$x=1;
$c_p_u_c3=$x*(1+$Promotion)*($cost_multiplier*($Unitcost_supplier1+$Unitcost_direct_material+$Unitcost_direct_labour)+$Logistic_tariffs_c1_c3);
$c_p_u_c2=$x*(1+$Promotion)*($cost_multiplier*($Unitcost_supplier1+$Unitcost_direct_material+$Unitcost_direct_labour)+$Logistic_tariffs_c1_c2);
$c_p_u_c1=$x*(1+$Promotion)*($cost_multiplier*($Unitcost_supplier1+$Unitcost_direct_material+$Unitcost_direct_labour));
// Inventory
$inventory_c1=($production_c1-$totalsale_c1)*$c_p_u_c1;
$inventory_c2=0;
$inventory_c3=0;

//production array for input
$production_c1_input="1,100".",".$totalsale_c1*(1+$Inventory_1st_r/100).",1,".$cost_multiplier.",".$cost_multiplier_round0;
$production_c2_input="0,0,0,0,0,0";
$production_c3_input="0,0,0,0,0,0";

//production[tech] 0
//production[cap]  1
//production[number] 2
//production[supplier] 3
//production[costmultiplier]
//production[unitcost] 5

//variable cost-logistic cost
$var_cost=($cost_multiplier*($Unitcost_supplier1+$Unitcost_direct_material+$Unitcost_direct_labour));
$los_cost_c1=0;
$los_cost_c2=$Logistic_tariffs_c1_c2;
$los_cost_c3=$Logistic_tariffs_c1_c3;

// Xchange rate
$Exchange_rate_c2_c1=$_POST['Exchange_rate_c2_c1'];
$Exchange_rate_c3_c1=$_POST['Exchange_rate_c3_c1'];

//echo $c_p_u_c2;echo "<br>";
//$c_p_u_c2=1/($Exchange_rate_c2_c1/1000)*$c_p_u_c2;
//$c_p_u_c3=1/($Exchange_rate_c3_c1/1000)*$c_p_u_c3;


$sale_price_c1=(1+$mark_up_price/100)*$c_p_u_c1;
$sale_price_c2=(1+$mark_up_price/100)*$c_p_u_c2;
$sale_price_c3=(1+$mark_up_price/100)*$c_p_u_c3;
// ------------------Begin insert onput
$payable_rate=$_POST['Percentage_of_payable'];
$receivable_rate=$_POST['Percentage_of_receivable'];
$tax=$_POST['Fin_tax_c1'];
$tax=$tax/100;
$tax2=$_POST['Fin_tax_c2'];
$tax2=$tax2/100;
$tax3=$_POST['Fin_tax_c3'];
$tax3=$tax3/100;
$depreciation=$_POST['Depreciation_rate'];
$depreciation=$depreciation/100;
$Cost_per_Plant_c1=$_POST['Cost_per_Plant_c1'];
$asset_value=$Cost_per_Plant_c1*$no_of_factory_c1;
$long_loan_rate=$_POST['Long_term_loan'];
$asset_value=$asset_value*1000;
$longterm_loan=$long_loan_rate/100*$asset_value;
//admin cost
$fix_admin=$_POST['Fix_admin_cost_c1'];
$var_admin=$_POST['Variable_admin_cost_c1'];
$admin_cost=($fix_admin+$var_admin*$no_of_factory_c1)*1000000;

$fix_admin23=$_POST['Fix_admin_cost_c2'];
$fix_admin23=$fix_admin23*1000000;
$receivable1=$receivable_rate/100;;
//echo $receivable;
//exit;
$receivable2=$receivable_rate/100;
$receivable3=$receivable_rate/100;
//$payable1=$payable_rate/100*$c_p_u_c1*$production_c1;
$payable1=$payable_rate/100;
$payable2=$payable_rate/100;
$payable3=$payable_rate/100;

$Share_capital=$_POST['Share_capital'];
$share_cap=$Share_capital*1000;
$share_out=round($share_cap*0.9)/10;
$interest_rate=$_POST['Interest_c1'];
$interest=$interest_rate/100*$longterm_loan;
// get share value for ratio
$face_value=$_POST['Share_face_value'];



//--------------------------BEGIN INSERT GAME
$mod_id=$_POST['mod_id'];
if ($mod_id!=0)
{
// --- check game limit
$query = "SELECT no_games FROM `mod` WHERE id='$mod_id'";
$result = mysql_query($query) or die(mysql_error());
$row = mysql_fetch_array($result);
$gamelimit=$row['no_games'];
$result1 = mysql_query("SELECT id FROM game where mod_id='$mod_id'");
$num_game_played = mysql_num_rows($result1);
$num_game_played=$num_game_played+1;

IF ($num_game_played>$gamelimit)
{
echo "Exceed number of game limits";
exit();
}
}
// --- check game
$tech_avai_c1['tech1']=$_POST['Tech1_avai_c1'];
$tech_avai_c1['tech2']=$_POST['Tech2_avai_c1'];
$tech_avai_c1['tech3']=$_POST['Tech3_avai_c1'];
$tech_avai_c1['tech4']=$_POST['Tech4_avai_c1'];

$tech_avai_c2['tech1']=$_POST['Tech1_avai_c2'];
$tech_avai_c2['tech2']=$_POST['Tech2_avai_c2'];
$tech_avai_c2['tech3']=$_POST['Tech3_avai_c2'];
$tech_avai_c2['tech4']=$_POST['Tech4_avai_c2'];

$tech_avai_c3['tech1']=$_POST['Tech1_avai_c3'];
$tech_avai_c3['tech2']=$_POST['Tech2_avai_c3'];
$tech_avai_c3['tech3']=$_POST['Tech3_avai_c3'];
$tech_avai_c3['tech4']=$_POST['Tech4_avai_c3'];
// serialize
$tech_avai_cn1=serialize($tech_avai_c1);
$tech_avai_cn2=serialize($tech_avai_c2);
$tech_avai_cn3=serialize($tech_avai_c3);

$cost_equation=$Cost_equation;
$hr_stan_wage=$_POST['Hr_standard_wage'];
$hr_standard_training_budget=$_POST['Hr_standard_training_budget'];
$hr_standard_turnover_rate=$_POST['HR_turnover_rate'];
$hr_manday_per_worker=$_POST['Hr_Manday_per_worker'];
$hr_recruitment_layoff_cost=$_POST['Hr_recruitment_layoff_cost'];
$rate_of_tech_price_reduce=$_POST['RnD_rate_of_reducing'];
$inventory_cost_per_uni=$_POST['Inventory_cost_per_unit'];
$depreciation_rate=$_POST['Depreciation_rate'];
$share_capital=$share_cap;
$share_face_value=$face_value;
$feature_cost=$_POST['Rnd_cost_per_feature'];
$feature_cost_increase=$rate_of_tech_price_reduce;
$min_cash=$_POST['Minimum_cash']*1000000;
$practice=$_POST['no_of_practice'];

// insert to game
$deadline=date('Y-m-d H:i:s'); 
$sql="INSERT INTO `game` (name,mod_id,no_of_rounds,no_of_teams,complete,hours_per_round,start_time,cost_equation,hr_stan_wage,hr_standard_training_budget,hr_standard_turnover_rate,hr_manday_per_worker,hr_recruitment_layoff_cost,rate_of_tech_price_reduce,inventory_cost_per_uni,depreciation_rate,receivable,payable,share_capital,share_face_value,tech_avai_c1,tech_avai_c2,tech_avai_c3,min_cash,practice_round) VALUES ('$name_game','$mod_id','$no_of_rounds','$no_of_teamsname','0','$hours_per_round','$deadline','$cost_equation','$hr_stan_wage','$hr_standard_training_budget','$hr_standard_turnover_rate','$hr_manday_per_worker','$hr_recruitment_layoff_cost','$rate_of_tech_price_reduce','$inventory_cost_per_uni','$depreciation_rate','$receivable_rate','$payable_rate','$share_capital','$share_face_value','$tech_avai_cn1','$tech_avai_cn2','$tech_avai_cn3','$min_cash','$practice')";
$result = mysql_query($sql);
$id_max = mysql_insert_id();

$sql=mysql_real_escape_string($sql);
$t=logs($user_for_logs,$_SESSION['id'],$sql,$result);

if($result === FALSE) 
{
    die(mysql_error()); // TODO: better error handling
}

// end insert to game

// Insert to round assumption
// get variable outputs
$change_in_demand1=1;

$diff=$_POST['diff_unitcost_c12'];
// get unit cost
$unitcost_direct_materia1=$_POST['Unitcost_direct_material'];
$unitcost_direct_materia3=0;
$unitcost_direct_labour1=$Unitcost_direct_labour;
$unitcost_direct_materia2=$unitcost_direct_materia1*(1+$diff/100);
$unitcost_direct_labour2=$unitcost_direct_labour1*(1+$diff/100);
$unitcost_direct_labour3=0;
$unitcost_supplier1=$Unitcost_supplier1;
$unitcost_supplier2=$_POST['Unitcost_supplier2'];
$unitcost_supplier3=$_POST['Unitcost_supplier3'];
$unitcost_supplier4=$_POST['Unitcost_supplier4'];
// outsource
$production_max_outsource1=$_POST['Production_max_outsource_c1']*1000;
$production_max_outsource2=$_POST['Production_max_outsource_c2']*1000;
$production_max_outsource3=0;
$cost_outsource=$_POST['cost_outsource'];
// tax
$tax1=$_POST['Fin_tax_c1']/100;
$tax2=$_POST['Fin_tax_c2']/100;
$tax3=$_POST['Fin_tax_c3']/100;
// interest
$interest1=$_POST['Interest_c1'];
$interest2=$_POST['Interest_c2'];
$interest3=$_POST['Interest_c3'];
$short_interest=$_POST['premium_short_interest_rate'];
// min wage
$min_wage=$_POST['Hr_min_wage'];
// cost tech
$cost_tech1=$_POST['RnD_tech1_cost'];
$cost_tech2=$_POST['RnD_tech2_cost'];
$cost_tech3=$_POST['RnD_tech3_cost'];
$cost_tech4=$_POST['RnD_tech4_cost'];
// exchange
$Exchange_rate21=$Exchange_rate_c2_c1;
$Exchange_rate31=$Exchange_rate_c3_c1;
//logistic
$Logistic_tariffs_c1_c2=$_POST['Logistic_tariffs_c1_c2'];
$Logistic_tariffs_c2_c1=$_POST['Logistic_tariffs_c2_c1'];
$Logistic_tariffs_c1_c3=$_POST['Logistic_tariffs_c1_c3'];
$Logistic_tariffs_c2_c3=$_POST['Logistic_tariffs_c2_c3'];
// admin cost
$fix_admin_cost1=$_POST['Fix_admin_cost_c1'];
$fix_admin_cost2=$_POST['Fix_admin_cost_c2'];
$fix_admin_cost3=$fix_admin_cost2;
$variable_admin_cost1=$_POST['Variable_admin_cost_c1'];
$variable_admin_cost2=$_POST['Variable_admin_cost_c2'];
$variable_admin_cost3=0;
// cost_per_plant
$cost_per_plant1=$Cost_per_Plant_c1;
$cost_per_plant2=$_POST['Cost_per_Plant_c2'];
$cost_per_plant3=0;
//tech attract
$tech1_att=$_POST['tech1_att'];
$tech2_att=$_POST['tech2_att'];
$tech3_att=$_POST['tech3_att'];
$tech4_att=$_POST['tech4_att'];

// for country 1
$country1=$change_in_demand1.",".$unitcost_direct_materia1.",".$unitcost_supplier1.",".$unitcost_supplier2.",".$unitcost_supplier3.",".$unitcost_supplier4.",".$unitcost_direct_labour1.",".$production_max_outsource1.",".$tax1.",".$interest1.",".$min_wage.",".$cost_tech1.",".$cost_tech2.",".$cost_tech3.",".$cost_tech4.",".$Exchange_rate21.",".$Exchange_rate31.",".$Logistic_tariffs_c1_c2.",".$Logistic_tariffs_c2_c1.",".$Logistic_tariffs_c1_c3.",".$fix_admin_cost1.",".$variable_admin_cost1.",".$cost_per_plant1.",".$cost_outsource.",".$short_interest.",".$tech1_att.",".$tech2_att.",".$tech3_att.",".$tech4_att;;
// for country 2
$country2=$change_in_demand1.",".$unitcost_direct_materia2.",".$unitcost_supplier1.",".$unitcost_supplier2.",".$unitcost_supplier3.",".$unitcost_supplier4.",".$unitcost_direct_labour2.",".$production_max_outsource2.",".$tax2.",".$interest2.",".$min_wage.",".$cost_tech1.",".$cost_tech2.",".$cost_tech3.",".$cost_tech4.",".$Exchange_rate21.",".$Exchange_rate31.",".$Logistic_tariffs_c1_c2.",".$Logistic_tariffs_c2_c1.",".$Logistic_tariffs_c1_c3.",".$fix_admin_cost2.",".$variable_admin_cost2.",".$cost_per_plant2.",".$cost_outsource.",".$short_interest.",".$tech1_att.",".$tech2_att.",".$tech3_att.",".$tech4_att;;
// for country 3
$country3=$change_in_demand1.",".$unitcost_direct_materia3.",".$unitcost_supplier1.",".$unitcost_supplier2.",".$unitcost_supplier3.",".$unitcost_supplier4.",".$unitcost_direct_labour3.",".$production_max_outsource3.",".$tax3.",".$interest3.",".$min_wage.",".$cost_tech1.",".$cost_tech2.",".$cost_tech3.",".$cost_tech4.",".$Exchange_rate21.",".$Exchange_rate31.",".$Logistic_tariffs_c1_c2.",".$Logistic_tariffs_c2_c1.",".$Logistic_tariffs_c1_c3.",".$fix_admin_cost3.",".$variable_admin_cost3.",".$cost_per_plant3.",".$cost_outsource.",".$short_interest.",".$tech1_att.",".$tech2_att.",".$tech3_att.",".$tech4_att;
// end get variables
//echo $country1."<br>";
//echo $country2."<br>";
//echo $country3."<br>";
$ct1 = preg_split("/[,]+/",$country1);
$ct2 = preg_split("/[,]+/",$country2);
$ct3 = preg_split("/[,]+/",$country3);

// get start time game
$query = "SELECT start_time FROM `game` WHERE id='$id_max'";
$result = mysql_query($query) or die(mysql_error());
$row = mysql_fetch_array($result);
$start_time=$row['start_time'];
$final1="";
$final2="";
$final3="";
$query = "SELECT MAX(id) FROM `scenario`";
$result = mysql_query($query) or die(mysql_error());
$row = mysql_fetch_array($result);
$max_id=$row[0];
//echo "<br>max_id:".$max_id;
// end get start time

for ($x=0; $x<=$no_of_rounds; $x++) 
{
if($x>0)
{
$oput1=$final1;
$oput2=$final2;
$oput3=$final3;
}
$final1="";
$final2="";
$final3="";
//$oput1=0;
//echo "<br>gia tri dau khi vong lap quay lai[".$oput1."]";
// get random scenario
// get new assumption for next round
//for country 1
$scenario_id1=rand(1,$max_id);
//echo "<br>sid3:".$scenario_id1;
$query1 = "SELECT value FROM `scenario` WHERE id='$scenario_id1'";
$result1 = mysql_query($query1) or die(mysql_error());
$row1 = mysql_fetch_array($result1);
$change1=$row1['value'];
//echo "<br>".$x."country1:".$change1;
// end c1
//for country 2
$scenario_id2=rand(1,$max_id);
//echo "<br>sid3:".$scenario_id2;
$query1 = "SELECT value FROM `scenario` WHERE id='$scenario_id2'";
$result1 = mysql_query($query1) or die(mysql_error());
$row1 = mysql_fetch_array($result1);
$change2=$row1['value'];
//echo "<br>change2:".$change2;
// end c1
//for country 3
$scenario_id3=rand(1,$max_id);
//echo "<br>sid3:".$scenario_id3;
$query1 = "SELECT value FROM `scenario` WHERE id='$scenario_id3'";
$result1 = mysql_query($query1) or die(mysql_error());
$row1 = mysql_fetch_array($result1);
$change3=$row1['value'];
//echo "<br>change3:".$change3;
//scenario track


$scenario=$scenario_id1.",".$scenario_id2.",".$scenario_id3;
// end c1
$comma=explode(",",$change1);
$no_value=count($comma)-1;
//echo "soluong tilte".$no_value."<br	>";
$change1 = preg_split("/[,]+/",$change1);
$change2 = preg_split("/[,]+/",$change2);
$change3 = preg_split("/[,]+/",$change3);
if ($x==0)
{
//echo "x=bang 0";
$oput1=$country1;
$final1=$oput1;
//echo "<br>khi x=0 :".$oput1;
$oput2=$country2;
$final2=$oput2;
$oput3=$country3;
$final3=$oput3;
}
else 
{
//echo "<br>vong lap quay lai".$oput1;

for ($v=0; $v<=$no_value; $v++) 
{
// change ratio

$c1=$change1[$v];
$c1=(int)$c1;
//echo "/".$c1."/";
$c2=$change2[$v];
$c2=(int)$c2;
$c3=$change3[$v];
$c3=(int)$c3;

// value
//echo "<br>gia tri trong vong lap".$oput1."<br>";
$oput11 =preg_split("/[,]+/",$oput1);
$oput12 =preg_split("/[,]+/",$oput2);
$oput13 =preg_split("/[,]+/",$oput3);

$v1=$oput11[$v];
$v1=(float)$v1;
//echo "/".$v1."/";
$v2=$oput12[$v];
$v2=(float)$v2;
$v3=$oput13[$v];
$v3=(float)$v3;

$ct1=$v1*(1+$c1/100);
$ct2=$v2*(1+$c2/100);
$ct3=$v3*(1+$c3/100);
//echo "#".$ct1;
//echo "<br>nhan".$v1."voi".$c1."thanh".$ct1."<br>";

//add final string
if ($v==0)
{
$final1=$ct1;
$final2=$ct2;
$final3=$ct3;
} else
{
$final1=$final1.",".$ct1;
//echo "+".$final1."<br>";
$final2=$final2.",".$ct2;
$final3=$final3.",".$ct3;
}
//echo "<".$fct1;
}
//echo "<br>addstrings".$final1;
}

//end get
$time_remaining=$hours_per_round*($x)*60*60;
//echo  "time remaining".$time_remaining;

$time = strtotime($start_time) + $time_remaining; // Add time remaining
$time = date('Y-m-d H:i:s', $time); // Back to string
// get tech att and marketshare

$t_marketshare_c1="100,0,0,0";
$t_marketshare_c2="100,0,0,0";
$t_marketshare_c3="100,0,0,0";
//
$sql="INSERT INTO `round_assumption` (game_id,mod_id,round,scenario_id,deadline,country1,country2,country3,t_marketshare_c1,t_marketshare_c2,t_marketshare_c3,cap_per_plant) VALUES ('$id_max','$mod_id','$x','$scenario','$time','$final1','$final2','$final3','$t_marketshare_c1','$t_marketshare_c2','$t_marketshare_c3','$capacity_per_plant')";
$result = mysql_query($sql);
$id_round_assumption = mysql_insert_id();

$sql=mysql_real_escape_string($sql);
$t=logs($user_for_logs,$_SESSION['id'],$sql,$result);
if($result === FALSE) { die(mysql_error());}
}

// end insert to round assumption
//-------------------------Update game in group

//echo "gameID".$gam_id."end ";
//$tech_avai=$tech1.",".$tech2.",".$tech3.",".$tech4;
//$sql="INSERT INTO `assumption` (mod_id,round,game_id,tech_avai)VALUES ('$mod_id','0','$id_max','$tech_avai')";
//$result = mysql_query($sql);
//$assu_id = mysql_insert_id();


//-------------------- INSERT TO TEAM DB
// insert team
// hardinput hard input
$team_name = array("Banana","Coconut","Cherry","Carrot","Durian","Grape","Lemon","Mango","Litchi","Orange","Longan","Starfruit","Tomato","Potato","Melon","Pear","Pineapple","Pumpkin");

shuffle($team_name);

for ($x=1; $x<=$no_of_teamsname; $x++) 
{
//echo "The number is: $x <br>";
$tname=$team_name[$x];
$sql="INSERT INTO `team` (name,mod_id,game_id) VALUES ('$tname','$mod_id','$id_max')";
$result = mysql_query($sql);
$sql=mysql_real_escape_string($sql);
$t=logs($user_for_logs,$_SESSION['id'],$sql,$result);
if($result)
{
//echo "<br>Input data is succeed";
} else
{
//echo ("<br>Input data is fail");
}
} 

//-------------------- END INSERT TO assumption

//--------------- Call output_round0 function
$dep2=0;
$dep3=0;
$asset_value2=0;
$asset_value3=0;
$share_cap2=0;
$share_cap3=0;
$longterm_loan2=0;
$longterm_loan3=0;

// for feature
$no_worker=$_POST['Rnd_workers'];
//$hr_manday_per_worker
$wa=$_POST['Hr_standard_wage'];
$train=$_POST['Hr_standard_training_budget'];
$rnd1=$no_worker*($wa+$train);
$rnd2=0;
$rnd3=0;

$fe_hours=($no_worker*$hr_manday_per_worker)*0.99;
$f_cost=$no_worker*$wa*12*10;

//$feature_cost_increase
//echo $sale_price_c2."/".$totalsale_c2."<br>";
//exit;
//echo "[".$sale_price_c2."-".$totalsale_c2."]";

$output_c1=output_round0(1,$sale_price_c1,$sale_per_team_r0_c1,$var_cost,$los_cost_c1,$Promotion,$depreciation,$asset_value,$admin_cost,$receivable1,$payable1,$tax,$inventory_c1,$share_cap,$longterm_loan,$interest,$min_cash,$face_value,$rnd1);
$output_c2=output_round0(2,$sale_price_c2,$sale_per_team_r0_c2,$var_cost,$los_cost_c2,$Promotion,$dep2,$asset_value2,$fix_admin23,$receivable2,$payable2,$tax2,$inventory_c2,$share_cap2,$longterm_loan2,$interest,$min_cash,$face_value,$rnd2);
$output_c3=output_round0(3,$sale_price_c3,$sale_per_team_r0_c3,$var_cost,$los_cost_c3,$Promotion,$dep3,$asset_value3,$fix_admin23,$receivable3,$payable3,$tax3,$inventory_c3,$share_cap3,$longterm_loan3,$interest,$min_cash,$face_value,$rnd3);




					
// ------------------get input variables

// for country 1
$input_c1['est_demand']=10;
$input_c1['est_marketshare_t1']=$sale_per_team_r0_c1;
$input_c1['est_marketshare_t2']=0;
$input_c1['est_marketshare_t3']=0;
$input_c1['est_marketshare_t4']=0;
$input_c1['price_tech1']=$sale_price_c1;
$input_c1['price_tech2']="";
$input_c1['price_tech3']="";
$input_c1['price_tech4']="";
$input_c1['feature_tech1']="0,".$fe_hours.",".$f_cost.",0,0,0";
$input_c1['feature_tech2']="0,".$fe_hours.",".$f_cost.",0,0,0";
$input_c1['feature_tech3']="0,".$fe_hours.",".$f_cost.",0,0,0";
$input_c1['feature_tech4']="0,".$fe_hours.",".$f_cost.",0,0,0";
$input_c1['promotion1']=$_POST['Promotion'];
$input_c1['promotion2']="";
$input_c1['production1']=$production_c1_input;
$input_c1['production2']="0,0,0,0,0,0";
$input_c1['outsource1']="0,0,0,0,0,0";
$input_c1['outsource2']="0,0,0,0,0,0";
$input_c1['HR_no_of_staffs']=$_POST['Rnd_workers'];
$input_c1['HR_wage_pe']=$_POST['Hr_standard_wage'];
$input_c1['HR_training_budget_pe']=$_POST['Hr_standard_training_budget'];
$input_c1['HR_turnover_rate']=$_POST['HR_turnover_rate'];
$input_c1['HR_min_wage']=$_POST['Hr_standard_wage'];
$input_c1['hr_layoff']=0;

$input_c1['promotion3']=0;
$input_c1['promotion4']=0;
$input_c1['sale_feature1']=0;
$input_c1['sale_feature2']=0;
$input_c1['sale_feature3']=0;
$input_c1['sale_feature4']=0;

$input_c1['unit_cost1']=$cost_multiplier_round0;
$input_c1['unit_cost2']=0;
$input_c1['unit_cost3']=0;
$input_c1['unit_cost4']=0;
$input_c1['sale_margin1']=($sale_price_c1-$cost_multiplier_round0)/$cost_multiplier_round0;
$input_c1['sale_margin2']=0;
$input_c1['sale_margin3']=0;
$input_c1['sale_margin4']=0;
// for country 2
$input_c2['est_demand']=10;
$input_c2['est_marketshare_t1']=$sale_per_team_r0_c2;
$input_c2['est_marketshare_t2']=0;
$input_c2['est_marketshare_t3']=0;
$input_c2['est_marketshare_t4']=0;
$input_c2['price_tech1']=$sale_price_c2;
$input_c2['price_tech2']="";
$input_c2['price_tech3']="";
$input_c2['price_tech4']="";
$input_c2['feature_tech1']="0,0,0,0,0,0,0,0";
$input_c2['feature_tech2']="0,0,0,0,0,0,0,0";
$input_c2['feature_tech3']="0,0,0,0,0,0,0,0";
$input_c2['feature_tech4']="0,0,0,0,0,0,0,0";
$input_c2['promotion1']=$_POST['Promotion'];
$input_c2['promotion2']=0;
//=$c2_t1.",".$cap1_c2.",".$c2_pro_1.",".$supp2.",".$cm21.",".$ucost5;
$input_c2['production1']="1,".$production_c2_input.",0,0,0,0";
$input_c2['production2']="0,0,0,0,0,0";
$input_c2['outsource1']="0,0,0,0,0,0";
$input_c2['outsource2']="0,0,0,0,0,0";
$input_c2['HR_no_of_staffs']="";
$input_c2['HR_wage_pe']="";
$input_c2['HR_training_budget_pe']="";
$input_c2['HR_estimated_turnover_rate']="";
$input_c2['HR_min_wage']="";
$input_c2['hr_layoff']=0;

$input_c2['promotion3']=0;
$input_c2['promotion4']=0;
$input_c2['sale_feature1']=0;
$input_c2['sale_feature2']=0;
$input_c2['sale_feature3']=0;
$input_c2['sale_feature4']=0;

$input_c2['unit_cost1']=0;
$input_c2['unit_cost2']=0;
$input_c2['unit_cost3']=0;
$input_c2['unit_cost4']=0;
$input_c2['sale_margin1']=($sale_price_c1-$cost_multiplier_round0)/$cost_multiplier_round0;
$input_c2['sale_margin2']=0;
$input_c2['sale_margin3']=0;
$input_c2['sale_margin4']=0;
// for country 3
//hardinput hard input
$input_c3['est_demand']=10;
$input_c3['est_marketshare_t1']=$sale_per_team_r0_c3;
$input_c3['est_marketshare_t2']=0;
$input_c3['est_marketshare_t3']=0;
$input_c3['est_marketshare_t4']=0;
$input_c3['price_tech1']=$sale_price_c3;
$input_c3['price_tech2']="";
$input_c3['price_tech3']="";
$input_c3['price_tech4']="";
$input_c3['feature_tech1']="0,0,0,0,0,0,0,0";
$input_c3['feature_tech2']="0,0,0,0,0,0,0,0";
$input_c3['feature_tech3']="0,0,0,0,0,0,0,0";
$input_c3['feature_tech4']="0,0,0,0,0,0,0,0";
$input_c3['promotion1']=$_POST['Promotion'];
$input_c3['promotion2']="";
$input_c3['production1']="0,0,0,0,0,0";
$input_c3['production2']="0,0,0,0,0,0";
$input_c3['outsource1']="0,0,0,0,0,0";
$input_c3['outsource2']="0,0,0,0,0,0";
$input_c3['HR_no_of_staffs']="";
$input_c3['HR_wage_pe']="";
$input_c3['HR_training_budget_pe']="";
$input_c3['HR_estimated_turnover_rate']="";
$input_c3['HR_min_wage']="";
$input_c3['hr_layoff']=0;

$input_c3['promotion3']=0;
$input_c3['promotion4']=0;
$input_c3['sale_feature1']=0;
$input_c3['sale_feature2']=0;
$input_c3['sale_feature3']=0;
$input_c3['sale_feature4']=0;

$input_c3['unit_cost1']=0;
$input_c3['unit_cost2']=0;
$input_c3['unit_cost3']=0;
$input_c2['unit_cost4']=0;
$input_c2['sale_margin1']=($sale_price_c1-$cost_multiplier_round0)/$cost_multiplier_round0;
$input_c2['sale_margin2']=0;
$input_c2['sale_margin3']=0;
$input_c2['sale_margin4']=0;
// end get input

//serialize
$input_c1=base64_encode(serialize($input_c1));
$input_c2=base64_encode(serialize($input_c2));
$input_c3=base64_encode(serialize($input_c3));

$logistic_order_c1="132,132,132,132";
$logistic_order_c2="231,231,231,231";
$transfer_price="1,1,1,1";
$fin_longterm_debt=0;
$fin_shareissue=0;
$fin_dividends=0;
//$fin_internal_loan_c1_c2=0;
//$fin_internal_loan_c2_c3=0;
$investment_c1="0,0,0";
$investment_c2="0,0,0";

$tmarketshare_c1=$sale_per_team_r0_c1.",0,0,0";
$tmarketshare_c2=$sale_per_team_r0_c2.",0,0,0";
$tmarketshare_c3=$sale_per_team_r0_c3.",0,0,0";
//--------------------- insert to output/input

$hr_turnover=$_POST['HR_turnover_rate'];
$featuretech="0,0,0,0";  // for feature
$inventory_c1=$totalsale_c1*($Inventory_1st_r/100).",0,0,0";
$inventory_c2="0,0,0,0";
$ucost_inven1=$c_p_u_c1.",0,0,0";
$ucost_inven2=$c_p_u_c2.",0,0,0";
//$ucost_inven3="0,0,0,0";
$feature_out="0,0,0,0";

$price_report=$sale_price_c1.",0,0,0,".$sale_price_c2.",0,0,0,".$sale_price_c3.",0,0,0";
$promotion_report=($Promotion*100).",0,0,0".($Promotion*100).",0,0,0".($Promotion*100).",0,0,0";
$feature_report="0,0,0,0,0,0,0,0,0,0,0,0";


$factory['c1']=$_POST['no_of_factory_c1'];
$factory['c2']=0;
$factory=serialize($factory);
$next_factory="0,0";
$result1 = mysql_query("SELECT id FROM `team` where game_id='$id_max'");
if($result1 === FALSE) 
{
    die(mysql_error()); // TODO: better error handling
}
while ($array = mysql_fetch_array($result1))
{
$team_id=$array['id'];
//insert output
//echo $totalsale_c2;
//exit;
$sql="INSERT INTO `output` (game_id,team_id,round,date,output_c1,output_c2,output_c3,factory,tech,hr_efficiency_rate,demand_c1,demand_c2,demand_c3,tmarketshare_c1,tmarketshare_c2,tmarketshare_c3,hr_turnover, inventory_c1,inventory_c2,ucost_inven1,ucost_inven2,next_factory,feature,final,price_report,promotion_report,feature_report) VALUES ('$id_max','$team_id','0',NOW(),'$output_c1','$output_c2','$output_c3','$factory','$tech',1,'$totalsale_c1','$totalsale_c2','$totalsale_c3','$tmarketshare_c1','$tmarketshare_c2','$tmarketshare_c3','$hr_turnover','$inventory_c1','$inventory_c2','$ucost_inven1','$ucost_inven2','$next_factory','$feature_out','1','$price_report','$promotion_report','$feature_report')";
$result = mysql_query($sql);  //order executes
$sql=mysql_real_escape_string($sql);
$t=logs($user_for_logs,$_SESSION['id'],$sql,$result);

if($result)
	{
    //echo("<br>Input data is succeed");
	} 
	else
	{
    //echo("<br>Input data is fail");
	}
//insert input
$sql2="INSERT INTO `input` (assumption_id,game_id,team_id,round,date,country1,country2,country3,logistic_order_c1,logistic_order_c2,transfer_price,fin_longterm_debt,fin_shareissue,fin_dividends,investment_c1,investment_c2,team_decision) VALUES ('$id_round_assumption','$id_max','$team_id','0',NOW(),'$input_c1','$input_c2','$input_c3','$logistic_order_c1','$logistic_order_c2','$transfer_price','$fin_longterm_debt','$fin_shareissue','$fin_dividends','$investment_c1','$investment_c2','1')";
$result2 = mysql_query($sql2);  //order executes
$sql=mysql_real_escape_string($sql2);
$t=logs($user_for_logs,$_SESSION['id'],$sql,$result2);
if($result2)
	{
   // echo("<br>Input data is succeed");
	} 
	else
	{
    //echo("<br>Input data is fail");
	}	
}
header ("Location:game.php?act=5&m_id=$mid&gid=$id_max");
// END insert output/input
//exit();


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

<?php
if(!isset($_GET["act"])){	header ("Location:game.php?act=home");}
?>
		
		<center><img src="imgs/logo.png" width="20%" height="20%" alt="Realmulation and challange" /><div class='clearfix'><br></div></center>
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
if($_GET["act"]=='group' or $_GET["act"]=='mod' or $_GET["act"]=='assumption' or $_GET["act"]=='scenario' ){$s1="class=current"; } else {$s1='';} 
if($_GET["act"]=='game' or $_GET["act"]=='team' or $_GET["act"]=='player' ){$s2="class=current"; } else {$s2='';} 
if($_GET["act"]=='home'){$s3="class=current"; } else {$s3='';} 	
if($_GET["act"]=='production' or $_GET["act"]=='hr' or $_GET["act"]=='rnd' or $_GET["act"]=='investment' or $_GET["act"]=='marketing' or $_GET["act"]=='logistic' or $_GET["act"]=='finance'){$s4="class=current"; } else {$s4='';} 	
if($_GET["act"]=='result'){$s5="class=current"; } else {$s5='';} 	
if($_GET["act"]=='newgame'){$s6="class=current"; } else {$s6='';} 	
if($_GET["act"]=='scenario'){$s19="class=current"; } else {$s19='';} 	

if($_GET["act"]=='production'){$s11="class=current"; } else {$s11='';} 	
if($_GET["act"]=='hr'){$s12="class=current"; } else {$s12='';} 	
if($_GET["act"]=='rnd') {$s13="class=current"; } else {$s13='';} 	
if( $_GET["act"]=='investment'){$s14="class=current"; } else {$s14='';} 	
if($_GET["act"]=='marketing'){$s16="class=current"; } else {$s16='';} 	
if($_GET["act"]=='logistic'){$s15="class=current"; } else {$s15='';} 	
if($_GET["act"]=='finance'){$s17="class=current"; } else {$s17='';} 	
if($_GET["act"]=='content'){$s21="class=current"; } else {$s21='';} 	
if($_GET["act"]=='checklist'){$s90="class=current"; } else {$s90='';} 	
if($_GET["act"]=='logs'){$s220="class=current"; } else {$s220='';} 	
	if($_GET["act"]=='home'){$s110="class=current"; } else {$s110='';} 	
// check who this is to print menu
	
	if(!isset($_SESSION['admin'])) {$_SESSION['admin']=0;}
	if(!isset($_SESSION['mod'])) {$_SESSION['mod']=0;}
	if(!isset($_SESSION['player'])) {$_SESSION['player']=0;}
	
	
// admin for full function
// mod for create game
// player for decision	
	echo"<ul id='nav'>";
		if ($_SESSION['admin']==1 or $_SESSION['mod']==1)
		{	
	echo"<li  ".$s3."><a href='?act=home'>".$LANG['HOME']."</a>";
	}
	//if ($_SESSION['admin']==1)
	

	
		if ($_SESSION['admin']==1)
		{
		echo"<li ".$s1."><a href=''>".$LANG['Menu']."</a>";
		echo"<ul>";
			echo"<li><a href='?act=group'>".$LANG['GROUPS']."</a></li>";
			echo"<li><a href='?act=mod'>".$LANG['INSTRUCTORS']."</a></li>";
			echo"<li><a href='?act=assumption'>".$LANG['ASSUMPTIONS']."</a></li>";
			echo"<li><a href='?act=scenario'>".$LANG['SCENARIOS']."</a></li>";
			echo"<li ".$s220."><a href='?act=logs'>".$LANG['logs']."</a></li>";
		echo"</ul>";
		echo"</li>";
		echo"<li ".$s21."><a href='?act=content'>".$LANG['content']."</a></li>";
		
		}
		if ($_SESSION['admin']==1 or $_SESSION['mod']==1)
		{
		
	if ($_SESSION['admin']==1){echo"<li  ".$s2."><a href=''>".$LANG['cpanel']."</a>";}
			if ($_SESSION['admin']==1){echo"<ul>";}
		
		echo"<li ".$s6."><a href='?act=newgame'>".$LANG['newgame']."</a></li>";
	
		//echo"<li><a href='?act=team'>Result</a></li>";
		echo"<li><a href='?act=game'>".$LANG['GAMES']."</a></li>";
		echo"<li><a href='?act=team'>".$LANG['TEAMS']."</a></li>";
			echo"<li><a href='?act=player'>".$LANG['PLAYERS']."</a></li>";
		echo"<li><a href='?act=lib'>".$LANG['termdefi']."</a></li>";
		echo"<li ".$s19."><a href='?act=scenario'>".$LANG['SCENARIOS']."</a></li>";
		
	// menu for mod
	if ($_SESSION['mod']==1)
		{	
		
			echo"<li class=menu><a href=''>".$LANG['Menu']."</a><ul>";
			echo"<li ><a href='?act=account'>".$LANG['myacc']."</a></li>";
			echo"<li><a href='logout.php'>".$LANG['Logout']." ".$_SESSION['username']."</a></li>";
			echo"</ul></li>";
			
		}
		if ($_SESSION['admin']==1){echo"</ul>";}
	if ($_SESSION['admin']==1) {echo"</li>	";}
		}
		

	// for decision at admin panel
		if ($_SESSION['admin']==1 or $_SESSION['player']==1)
		{
	if ($_SESSION['player']==1){} else {echo"<li  ".$s4."><a href=''>".$LANG['DECISIONS']."</a>";}
	if ($_SESSION['admin']==1){echo"<ul>";}
	
if ($_SESSION['player']==1){echo"<li ".$s110."><a href='?act=home'>".$LANG['HOME']."</a></li>";;}

	if ($_SESSION['player']==1){echo"<li ".$s11."><a href='?act=production'>".$LANG['Production']."</a></li>";;}
	if ($_SESSION['player']==1){echo"<li ".$s12."><a href='?act=hr'>".$LANG['hr']."</a></li>";;}
	if ($_SESSION['player']==1){echo"<li ".$s13."><a href='?act=rnd'>".$LANG['rnd']."</a></li>";;}
	if ($_SESSION['player']==1){echo"<li ".$s14."><a href='?act=investment'>".$LANG['invest']."</a></li>";;}
	if ($_SESSION['player']==1){echo"<li ".$s15."><a href='?act=logistic'>".$LANG['logistic']."</a></li>";;}
	if ($_SESSION['player']==1){echo"<li ".$s16."><a href='?act=marketing'>".$LANG['marketing']."</a></li>";;}
	if ($_SESSION['player']==1){echo"<li ".$s17."><a href='?act=finance'>".$LANG['finance']."</a></li>";}
	
	if ($_SESSION['player']==1){echo"<li ".$s90."><a href='?act=checklist'>".$LANG['checklist']."</a>";}
	
		if ($_SESSION['player']==1) {echo"<li class=menu><a href='?act=home'>".$LANG['Menu']."</a><ul>";echo"<li><a href='?act=case'>".$LANG['Case']."</a></li>";}
	//if ($_SESSION['player']==1){echo"";}
	
	echo"<li><a href='?act=guide'>".$LANG['Guide']."</a></li>";
	if ($_SESSION['admin']!=1) {echo"<li><a href='?act=schedule'>".$LANG['SCHEDULE']."</a></li>";}
	echo"<li ><a href='?act=result'>".$LANG['RESULTS']."</a></li>";
	echo"<li ><a href='?act=account'>".$LANG['myacc']."</a></li>";
	echo"<li ><a href='logout.php'>".$LANG['Logout']." ".$_SESSION['username']."</a></li>";
	if ($_SESSION['player']==1){echo"</ul></li>";}
	
	if ($_SESSION['admin']==1){echo"</ul>";};
	echo"</li>";	
		}

	//echo"<li><a href='logout.php'>".$LANG['Logout']."</a></li>";
	echo"</ul>";

?>



		
		<section id="main-content">
			<div id="featured">
			
<?php
//check if any logs unshown
if ($_SESSION['admin']==1 or $_SESSION['mod']==1)
{
$id=$_SESSION['id'];
if ($_SESSION['mod']==1)
{
$result0 = mysql_query("SELECT * FROM `logs` where view=0 and user_id='$id'");
}
if ($_SESSION['admin']==1)
{
$result0 = mysql_query("SELECT * FROM `logs` where view=0 and user_id='$id'");
}
while ($row = mysql_fetch_array($result0))
{
$id=$row['id'];
$name=$row['user_name'];
$msg=$row['message'];
$result=$row['result'];
if ($result==1) {$re="Input data is succeed";}
$mess=$name.":<br>".$msg."<br>Result:".$result;

$email=mysql_real_escape_string($mess);
			$email=str_replace('"', "", $email);
			$email=str_replace('<', "", $email);
			$email=str_replace('>', "", $email);
			$email=str_replace("'", "", $email);
$return=message($email,$result);
echo $return;
$sql1="UPDATE `logs` SET view='1' where id='$id'";
$result1 = mysql_query($sql1);  //order executes
}
}
?>


		
<?php
$title_pnl=$LANG['salerevenue'].","." &nbsp;- ".$LANG['frommarket']."".","." &nbsp;- ".$LANG['frominternaltransfer']."".","."".$LANG['totalrevenue']."".",".$LANG['costandexpense'].","." &nbsp;- ".$LANG['variablecost']."".","." &nbsp;- ".$LANG['featurecost']."".","." &nbsp;- ".$LANG['transportation']."".","." &nbsp;- ".$LANG['researchcost']."".","." &nbsp;- ".$LANG['promotion']."".","." &nbsp;- ".$LANG['admincost']."".","." &nbsp;- ".$LANG['costofimported']."".",".$LANG['totalcost'].",".$LANG['ebitda'].","." &nbsp;- ".$LANG['depreciation']."".",".$LANG['ebit'].","." &nbsp;- ".$LANG['netfinance']."".",".$LANG['pb4t'].","." &nbsp;- ".$LANG['incometax']."".",".$LANG['paftert'];

$title_bs=$LANG['assets'].","." - ".$LANG['fixassest']."".","." - ".$LANG['inventory']."".","." - ".$LANG['receivable']."".","." - ".$LANG['cashandcash']."".",".$LANG['totalasset'].",".$LANG['shareholders'].",".$LANG['Equity'].","." - ".$LANG['sharecap']."".","." - ".$LANG['otherrestricted']."".","." - ".$LANG['profitfortheround']."".","." - ".$LANG['retainedearning']."".",".$LANG['totalequity'].",".$LANG['Liabilities'].","." - ".$LANG['longdebt']."".","." - ".$LANG['shortdebt']."".","." - ".$LANG['internalloan']."".","." - ".$LANG['payable']."".",".$LANG['totalli'].",".$LANG['totalshare'];

$title_ratio=$LANG['ratio'].",".$LANG['marketcap'].",".$LANG['shareout'].",".$LANG['sharepriceend'].",".$LANG['averagetradingprice'].",".$LANG['divyield'].",".$LANG['peratio'].",".$LANG['cumsharereturn'].",".$LANG['financialindi'].",".$LANG['operatingebitda'].",".$LANG['operateingebit'].",".$LANG['ros'].",".$LANG['eratio'].",".$LANG['gearing'].",".$LANG['roce'].",".$LANG['roe'].",".$LANG['eps'];
?>
		 
<?php
if ($_GET['act']=='checklist')
{
if($_SESSION['player']==1)
 {
 $gid=$_SESSION['game_id'] ;
 $tid=$_SESSION['team_id'] ;
 $overtime=overtime($gid,$tid);
 }
}
//prevent edit Get
if ($_GET['act']=='production' or $_GET['act']=='hr' or $_GET['act']=='rnd' or $_GET['act']=='investment'  or $_GET['act']=='logistic' or $_GET['act']=='marketing' or $_GET['act']=='finance')
{
//check overtime
if($_SESSION['player']==1)
 {
 $gid=$_SESSION['game_id'] ;
 $tid=$_SESSION['team_id'] ;
 $overtime=overtime($gid,$tid);
 }
// for mod
if($_SESSION['mod']==1)
 {
  $overtime=1;
 $mid=$_SESSION['id'];
 
 if(isset($_GET['gid']))
 {
  $gid=$_GET['gid'] ;
 } else {header ("Location:?act=home");}
  if(isset($_GET['tid']))
 {
   $tid=$_GET['tid'] ;
 } else {header ("Location:?act=home");}
// check if game belong to mod
$query = "SELECT mod_id FROM `game` WHERE id='$gid'";
$result = mysql_query($query) or die(mysql_error());
$row = mysql_fetch_array($result);
$mod_id=$row['mod_id'];
if ($mod_id!=$mid)
 {
 //echo"not belong";
 header ("Location:?act=home");
 exit();
 }
 // check if correct team
$query = "SELECT game_id FROM `team` WHERE id='$tid'";
$result = mysql_query($query) or die(mysql_error());
$row = mysql_fetch_array($result);
$game_id=$row['game_id'];
if ($game_id!=$gid)
{
//echo"wrong team";
 header ("Location:?act=home");
 exit();
}
 } 
 
 
//for admin 
 if($_SESSION['admin']==1)
 {
  $overtime=1;
 $aid=$_SESSION['id'];
  if(isset($_GET['gid']))
 {
  $gid=$_GET['gid'] ;
 } else {	header ("Location:?act=home");}
  if(isset($_GET['tid']))
 {
   $tid=$_GET['tid'] ;
 } else {	header ("Location:?act=home");} 
 // check if game is correct
$query = "SELECT id FROM `game` WHERE id='$gid'";
$result = mysql_query($query) or die(mysql_error());
if( mysql_num_rows($result) != 1) 
{
//echo "bad game id";
 header ("Location:?act=home");
 exit();
}
  // check if correct team
$query = "SELECT game_id FROM `team` WHERE id='$tid'";
$result = mysql_query($query) or die(mysql_error());
$row = mysql_fetch_array($result);
$game_id=$row['game_id'];
if ($game_id!=$gid)
{
//echo "bad team";
 header ("Location:?act=home");
 exit();
}

 }
}
?>
		 
		 <?php
// UPDATE GROUP
  if( isset($_POST["name_update"]) and isset($_POST["game_avail"]) and $_GET["act"]=='1' and isset($_GET["id"])  )
  {
 echo "<h3>".$LANG['Updategroup']."</h3><br>"; 
$name=$_POST['name_update'];
$id=$_POST['id'];
$contact=$_POST['contact'];
$email=$_POST['email'];
$game_avail=$_POST['game_avail'];

$sql="UPDATE `group` SET name='$name', contact='$contact',email='$email',games_available='$game_avail' where id='$id'";
$result = mysql_query($sql);  //order executes
$sql=mysql_real_escape_string($sql);
if($result)
{
  //  $log="Input data is succeed";
	
	$t=logs($user_for_logs,$_SESSION['id'],$sql,$result);
   
	header ("Location:game.php?act=group");
} 
else
{
    //$log="Input data is fail";
	$t=logs($user_for_logs,$_SESSION['id'],$sql,$result);

	header ("Location:game.php?act=group");
}
  }
?>
<?php
// UPDATE MOD
  if( isset($_POST["mod_name_update"]) and isset($_POST["email"]) and isset($_POST["phone"]) and $_GET["act"]=='2' and isset($_GET["id"])  )
  {
 echo "<h3>".$LANG['Updatemod']."</h3><br>"; 
$name=$_POST['mod_name_update'];
$id=$_POST['id'];
$gid=$_POST['gid'];
$phone=$_POST['phone'];
$email=$_POST['email'];
$game=$_POST['game'];
$student=$_POST['student'];
$sql="UPDATE `mod` SET name='$name', phone='$phone',email='$email',no_games='$game' ,no_students='$student'where id='$id'";
$result = mysql_query($sql);  //order executes
$sql=mysql_real_escape_string($sql);
if($result){
    //echo("<br>Input data is succeed");
	 
	$t=logs($user_for_logs,$_SESSION['id'],$sql,$result);
	header ("Location:game.php?act=2&id=$gid");
} else{
    //echo("<br>Input data is fail");
	
	header ("Location:game.php?act=2&id=$gid");
}
  }
?>
<?php
// UPDATE weight_assumption
  if( isset($_POST["edit"]) and  $_GET["act"]=='4'  and  $_POST["edit"]=='1')
  {
$result = mysql_query("SELECT * FROM `weight_assumption`");
while ($row = mysql_fetch_array($result))
{
$name=$row['name'];
$name1=$row['name']."_c1";
$name2=$row['name']."_c2";
$name3=$row['name']."_c3";


$value1=$_POST[$name1];
$value2=$_POST[$name2];
$value3=$_POST[$name3];
$sql1="UPDATE `weight_assumption` SET c1='$value1',c2='$value2',c3='$value3' where name='$name'";
$result1 = mysql_query($sql1);  //order executes

}
$sql=mysql_real_escape_string($sql1);
$t=logs($user_for_logs,$_SESSION['id'],$sql,$result1);
header ("Location:game.php?act=assumption");
  }
  
  // UPDATE parameter_assumption
  if( isset($_POST["edit"]) and  $_GET["act"]=='4'  and  $_POST["edit"]=='2')
  {
$result = mysql_query("SELECT * FROM `parameters_assumption`");
while ($row = mysql_fetch_array($result))
{
$id=$row['id'];

if ($id<14)
{
$id_string=$id."_string";
$string=$_POST[$id_string];
$sql1="UPDATE `parameters_assumption` SET string='$string' where id='$id'";
$result1 = mysql_query($sql1);  //order executes
$sql=mysql_real_escape_string($sql1);
$t=logs($user_for_logs,$_SESSION['id'],$sql,$result1);
}
else
{
$id_max=$id."_max";
$id_min=$id."_min";
$min=$_POST[$id_min];
$max=$_POST[$id_max];
$sql1="UPDATE `parameters_assumption` SET min='$min', max='$max' where id='$id'";
$result1 = mysql_query($sql1);  //order executes
$sql=mysql_real_escape_string($sql1);
$t=logs($user_for_logs,$_SESSION['id'],$sql,$result1);
}

}
header ("Location:game.php?act=assumption");
  }
?>
<?php
// EDIT GROUP
  if( $_GET['act']=='1' and isset($_GET["id"]) and $_GET["id"]<>"" and $_GET['edit']=='1')
  {

echo "<h3>".$LANG['Editgroup']."</h3><br>";
$id=$_GET["id"];  
$query = "SELECT * FROM `group` WHERE id='$id'";
$result = mysql_query($query) or die(mysql_error());
$row = mysql_fetch_array($result);
$name=$row['name'];
$contact=$row['contact'];
$email=$row['email'];
$game_avail=$row['games_available'];
echo"<table>";
echo"<form action='game.php?act=1&id=$id&edit=1' method='POST'>";
echo "<th>ID</th><th>".$LANG['name']."</th><th>".$LANG['contact']."</th><th>Email</th><th>".$LANG['Gamelimit']."</th><th>".$LANG['action']."</th>";
echo"<tr><td>$id<input type='hidden' name='id' value='$id' /></td><td><input type='text' name='name_update' value='$name' /></td><td><input type='text' name='contact' value='$contact'/></td><td><input type='text' name='email' value='$email' /></td><td><input type='text' name='game_avail'value='$game_avail' /></td><td>  <input class=submit type=submit value='Edit'/></td><tr>";
echo "</form>";
echo "</table>";
include('footer.php');
exit();
  }
?>

<?php
// EDIT MOD
  if( $_GET['act']=='2' and isset($_GET["id"]) and $_GET["id"]<>"" and isset($_GET['edit']))
  {

echo "<h3>".$LANG['Editmod']."</h3><br>";
$id=$_GET["id"];  $gid=$_GET["gid"];  
$query = "SELECT * FROM `mod` WHERE id='$id'";
$result = mysql_query($query) or die(mysql_error());
$row = mysql_fetch_array($result);
$name=$row['name'];
$email=$row['email'];
$phone=$row['phone'];
$no_students=$row['no_students'];
$no_games=$row['no_games'];
echo"<table>";
echo"<form action='game.php?act=2&id=$id&edit=1' method='POST'>";
echo "<th>ID</th><th>".$LANG['name']."</th><th>Email</th><th>Phone</th><th>".$LANG['students']."</th><th>".$LANG['Games']."</th><th>".$LANG['action']."</th>";
echo"<tr><td>$id<input type='hidden' name='id' value='$id' /><input type='hidden' name='gid' value='$gid' /></td><td><input type='text' name='mod_name_update' value='$name' /></td><td><input type='text' name='email' value='$email'/></td><td><input type='text' name='phone' value='$phone'/></td><td><input type='text' name='student' value='$no_students' /></td><td><input type='text' name='game' value='$no_games' /></td><td>  <input class=submit  type=submit value='Edit'/></td><tr>";
echo "</form>";
echo "</table>";
include('footer.php');
exit();
  }
?>
 
<?php

// PRESENT GROUP TABLE
  if( $_GET['act']=='group' )
  {
echo "<h3>".$LANG['Customer']."</h3><br>";
$result = mysql_query("SELECT * FROM `group`");
echo "<table>"; 
echo "<th>ID</th><th>".$LANG['name']."</th><th>".$LANG['contact']."</th><th>Email</th><th>".$LANG['Games']."</th><th>".$LANG['action']."</th>";
if($result === FALSE) {
    die(mysql_error()); // TODO: better error handling
}
while ($row = mysql_fetch_array($result))
{
 
 echo"<tr><td>".$row['id']."</td><td><a href=game.php?act=2&id=".$row['id'].">".$row['name']."</a><br>".$row['no_of_instructors']." | ".$row['no_of_students']."</td><td>".$row['contact']."</td><td>".$row['email']."</td><td>".$row['games_available']." | ".$row['on_going_games']." on going</td><td><a href=game.php?id=".$row['id']."&act=1&edit=1>Edit </a></td></tr>";

}
echo"<form action='game.php?act=1' method='POST'>";
echo "<th>ID</th><th>".$LANG['name']."</th><th>".$LANG['contact']."</th><th>Email</th><th>".$LANG['Gamelimit']."</th><th>".$LANG['action']."</th>";
echo"<tr><td>+</td><td><input type='text' name='name' /></td><td><input type='text' name='contact' /></td><td><input type='text' name='email' /></td><td><input type='text' name='game_avail' /></td><td>  <input type=submit value='Add' /></td><tr>";
echo "</form>";
echo "</table>";
 }
// end 
 
 //Present game table
   if( $_GET['act']=='game' )
  {
// -----------------------------------check who is 
 //echo $_SESSION['mid'];
  if (isset($_SESSION['mid']) or isset($_SESSION['aid'])) 
  {
  
    if (isset($_SESSION['aid'])) {$result = mysql_query("SELECT * FROM `game` order by id desc");}
	  if (isset($_SESSION['mid'])) {$result = mysql_query("SELECT * FROM `game` where mod_id=".$_SESSION['mid']." ORDER BY  id DESC ");}
  }
	else
{
//header ("Location:game.php");
exit();
	
}	
// ----------------------------------------end check
  
  
  
  
  
echo "<h3>".$LANG['Games']."</h3><br>";

echo "<table>"; 
echo "<th>ID</th><th>".$LANG['name']."</th><th>".$LANG['ongame']."</th><th>".$LANG['TEAM']."</th><th>".$LANG['rounds']."</th><th>".$LANG['hours_per_round']."</th><th>".$LANG['Starttime']."</th><th>".$LANG['action']."</th>";
if($result === FALSE) {
    die(mysql_error()); // TODO: better error handling
}
while ($row = mysql_fetch_array($result))
{
 $mid=$row['mod_id'];
 $gameid=$row['id'];
 $result2 = mysql_query("SELECT group_id,name FROM `mod` where id='$mid'");
 $row1 = mysql_fetch_array($result2);
 $gid=$row1['group_id'];
 $modname=$row1['name'];
// GET group name 
 $result3 = mysql_query("SELECT name FROM `group` where id='$gid'");
 $row2 = mysql_fetch_array($result3);
 $gname=$row2['name'];
 $hpr=$row['hours_per_round'];
 $from=$row['start_time'];
 $nr=$row['no_of_rounds'];
 $ttime=$nr*$hpr;
 
 	$date = date('Y-m-d H:i:s');
	$now = strtotime($date);
	$from = strtotime($from);
	//echo $now."/";
	
 //$endtime=round(($from + $ttime)/60/60,2);
 $time_diff=round(($now - $from)/60/60,2);
// $endtime= date('Y-m-d H:i:s', $endtime);
 
 // update game to complete if game end
 if ($time_diff>$ttime) 
 {
 $sql1="UPDATE `game` SET complete='1' where id='$gameid'";
$result1 = mysql_query($sql1);  //order executes
$img="imgs/icon-cross.png";
 } 
 else 
 {
 $img="imgs/icon-tick.png";
 }
 
//echo $time_diff."/";
 echo"<tr><td>".$row['id']."</td><td><a href=game.php?act=5&m_id=".$row['mod_id']."&gid=".$row['id'].">".$row['name']."</a></td><td><img style='width:10px;height:10px' src='".$img."'></td><td>".$row['no_of_teams']."</td><td>".$row['no_of_rounds']."</td><td>".$row['hours_per_round']."</td><td>".$row['start_time']."</td><td><a href=game.php?act=3&m_id=".$row['mod_id']."&edit=1&id=".$row['id'].">".$LANG['edit']." </a> | <a href=game.php?act=result&id=".$row['id'].">".$LANG['RESULTS']."</a> | <a href=game.php?act=5&m_id=".$row['mod_id']."&gid=".$row['id'].">".$LANG['addPLAYERS']."</a></td></tr>";

}
echo "</table>";
 }
 
 //Present team table
   if( $_GET['act']=='team')
  {
	 if (isset($_SESSION['aid'])) 
	 {
	 $result = mysql_query("SELECT * FROM `team`");
	 }
	  
	 if (isset($_SESSION['mid'])) 
	 { 
	 $result = mysql_query("SELECT * FROM `team` where mod_id='".$_SESSION['mid']."'");
	 }
	  
echo "<h3>".$LANG['TEAMS']."</h3><br>";

echo "<table>"; 
echo "<th>ID</th><th>".$LANG['course']."</th><th>".$LANG['TEAM']."</th><th>".$LANG['no_of_player']."</th><th>".$LANG['action']."</th>";
if($result === FALSE) {
    die(mysql_error()); // TODO: better error handling
}
while ($row = mysql_fetch_array($result))
{



 $mid=$row['mod_id'];
 $result2 = mysql_query("SELECT group_id FROM `mod` where id='$mid'");
 $row2 = mysql_fetch_array($result2);
 $gid=$row2['group_id'];
 
 
// Get game name 
$gaid=$row['game_id'];
$query1 = "SELECT name FROM `game` WHERE id='$gaid'";
$result1 = mysql_query($query1) or die(mysql_error());
$row1 = mysql_fetch_array($result1);
$ganame=$row1['name'];
// get total players
$t_id=$row['id'];
 $result3 = mysql_query("SELECT COUNT(id) FROM `player` where team_id='$t_id'");
 $row22 = mysql_fetch_array($result3);
 $no_of_players=$row22[0]; 
 echo"<tr><td>".$row['id']."</td><td>".$ganame."</td><td><a href=game.php?act=6&gid=".$gid."&tid=".$row['id'].">".$row['name']."</a></td><td>".$no_of_players."</td><td><a href=game.php?act=5&gid=$gid&edit=1&tid=".$row['id'].">".$LANG['edit']." </a> | <a href=game.php?act=6&gid=".$gid."&tid=".$row['id'].">".$LANG['addPLAYERS']." </a></td></tr>";

 
 }
echo "</table>";
 } 
 // end

  //Present player table
   if( $_GET['act']=='player' )
  {
echo "<h3>".$LANG['PLAYERS']."</h3><br>";
$result = mysql_query("SELECT * FROM `player`");
echo "<table>"; 
echo "<th>ID</th><th>Player Name</th><th>".$LANG['Games']."</th><th>".$LANG['TEAM']."</th><th>Email</th><th>".$LANG['action']."</th><th>Assign new team</th><th>Assign new game</th>";
if($result === FALSE) {
    die(mysql_error()); // TODO: better error handling
}
while ($row = mysql_fetch_array($result))
{
// check if belongs to this mod
if ($_SESSION['mod']==1) 

{
// get mod_id
$gid=$row['game_id'];
$query2 = "SELECT mod_id,name FROM `game` WHERE id='$gid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$mid=$row2['mod_id'];
$gname=$row2['name'];
// get team name
$tid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$tid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
if ($mid==$_SESSION['mid'])
	{
 echo"<tr><td>".$row['id']."</td><td><a href=game.php?act=6tid=".$row['team_id'].">".$row['name']."</a></td><td>".$gname." [".$row['game_id']."]</td><td>".$tname." [".$row['team_id']."]</td><td>".$row['email']."</td><td><a href=game.php?act=6&edit=1&pid=".$row['id'].">Edit </a></td>";

 
 
$result0 = mysql_query("SELECT id,name FROM `team` where game_id=$gid");
echo"<td class=demo>";
echo"<select name='team_id' onchange='this.form.submit()'>";
while ($row = mysql_fetch_array($result0))
{
$teamname=$row['name'];
$t_id=$row['id'];
echo"<option value=".$t_id.">".$teamname."[".$t_id."]</option>";
			
}
echo"</select>";
echo"</td>";
// for assign new game
echo"<td class=demo>";
echo"<select name='game_id' onchange='this.form.submit()'>";
$result0 = mysql_query("SELECT id,name FROM `game` where mod_id=$mid and complete=0");
while ($row = mysql_fetch_array($result0))
{
$g_name=$row['name'];
$g_id=$row['id'];
echo"<option value=".$g_id.">".$g_name." </option>";
			
}
echo"</select>";
echo"</td>";


 echo"</tr>";
	}
	
 }
 if ($_SESSION['admin']==1) 
 {
 echo"<tr><td>".$row['id']."</td><td><a href=game.php?act=6tid=".$row['team_id'].">".$row['name']."</a></td><td>[".$row['game_id']."]</td><td> [".$row['team_id']."]</td><td>".$row['email']."</td><td><a href=game.php?act=6&edit=1&pid=".$row['id'].">Edit </a></td>";
$result0 = mysql_query("SELECT id,name FROM `team`");
echo"<td class=demo>";
echo"<select name='team_id' onchange='this.form.submit()'>";
while ($row = mysql_fetch_array($result0))
{
$teamname=$row['name'];
$t_id=$row['id'];
echo"<option value=".$t_id.">".$teamname."[".$t_id."]</option>";
			
}
echo"</select>";
echo"</td>";
// for assign new game
echo"<td class=demo>";
echo"<select name='game_id' onchange='this.form.submit()'>";
$result0 = mysql_query("SELECT id,name FROM `game` where complete=0");
while ($row = mysql_fetch_array($result0))
{
$g_name=$row['name'];
$g_id=$row['id'];
echo"<option value=".$g_id.">".$g_name." </option>";
			
}
echo"</select>";
echo"</td>";


 echo"</tr>";
 }
 
 }
echo "</table>";
 } 
 // end
 
 // Present input form
 //if( $_GET['act']=='input' and  isset($_GET['id'])  and  isset($_GET['tid']))
 if( $_GET['act']=='production')
  {
 // echo"ok";
 if($_SESSION['mod']==1 or $_SESSION['admin']==1 )
 {
 $gid=$_GET['gid'] ;
 $tid=$_GET['tid'] ;
 } else 
 {
  $gid=$_SESSION['game_id'] ;
 $tid=$_SESSION['team_id'] ;
 }
 


 //--------------------------- check time
 if($_SESSION['mod']==1 or $_SESSION['admin']==1 )
 {
 // get team name
$query2 = "SELECT name FROM `team` WHERE id='$tid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
if (isset($_GET['pid']))
{
$pid=$_GET['pid'];
$query2 = "SELECT name FROM `player` WHERE id='$pid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$pname=$row2['name'];
$string="player";
} else {$pname="";$string="player";}
 	$message="You are on ".$string." :".$pname." [Team]: ".$tname." decision page";
	$msg=message($message,3);
	echo $msg;
 }
else 
{ 
 $checktime=checktime($gid,$tid);
 echo $checktime;
 	//$m="Not eligible for input this round, deadline is expired!<br> Time remaining: 0 hours";
	//$msg=message($m,0);

}  
 //--------------------------- end check time

// check if it is not available for input and not overtime


	// round
	$res_round = mysql_query("SELECT max(round) FROM output where game_id='$gid' and final='1' and team_id='$tid'");
	$array_round = mysql_fetch_array($res_round);
	$round=$array_round[0];
	$round_for_input=$round+1;	
	
	$d= "SELECT deadline,id FROM `round_assumption` where game_id='$gid' and round='$round_for_input'";
	$result_d = mysql_query($d) or die(mysql_error());
	$deadline = mysql_fetch_array($result_d);
	
	$assumption_id=$deadline['id'];

  
  
  //---------------------------------------- present nav tab  start input form
  
  			if($_GET['act']=='production')
			
			{ 
		
     echo"<div class='simpleTabs'>";
		 echo"<ul class='simpleTabsNavigation'>";	
					echo"<li><a href='#'>".$LANG['demandforecast']."</a></li>";	
					echo"<li><a href='#'>".$LANG['marketshare']."</a></li>";
					echo"<li><a href='#'>".$LANG['supplier']."</a></li>";
					echo"<li><a href='#'>".$LANG['capacity']."</a></li>";
		 echo"</ul>"; 
		 
echo"<div class='simpleTabsContent'>";
	 echo"<br><h4>".$LANG['marketoutlook']."</h4>";	 
	 //get market outlook
	 $result1 = mysql_query("SELECT scenario_id FROM round_assumption where game_id='$gid' and round='$round'");
	 $array = mysql_fetch_array($result1);
	 $sce=$array['scenario_id'];	
	 $sce = preg_split("/[\s,]+/",$sce);
	 $s_c1=$sce[0];
	 $s_c2=$sce[1];
	 $s_c3=$sce[2];
	 echo "<table>";
	 echo "<th width=10%>".$LANG['country']."</th><th>".$LANG['outlook']."</th>";
	 
	   for ($x=0; $x<=2; $x++) 
{
$lang=$_SESSION['lang'];
	 $descript="description_".$lang;
	 $result1 = mysql_query("SELECT ".$descript." FROM scenario where id=$sce[$x]");
	 $array = mysql_fetch_array($result1);
	 $des=$array[$descript];
if(!isset($_POST['post_production']) and !isset($_POST['post_allocation']) and !isset($_POST['post_marketshare']))	
	{ 
	 echo "<tr><td><b>".$LANG[$x+1]."</b></td>";
	 echo "<td>".$des."</td></tr>";
	 }
}	 
	echo"</table>";
		        echo"<br><h4>".$LANG['demandforecast']."</h4>";
		       //  DECISION PRODUCTION DEMAND
				// get total demand last round
				//echo $round."acb";
	// round
	$res_round = mysql_query("SELECT max(round) FROM output where game_id='$gid' and final='1' and team_id='$tid'");
	$array_round = mysql_fetch_array($res_round);
	$round=$array_round[0];
	$round_new=$round+1;	
		// get practice round
$game = mysql_query("SELECT practice_round FROM `game` where id='$gid'");
$hpr = mysql_fetch_array($game);
$pround=$hpr['practice_round'];
if ($round==$pround) {$round=0;} 

	//echo $round."abcs";
				$dlr = mysql_query("SELECT demand_c1,demand_c2,demand_c3,tmarketshare_c1,tmarketshare_c2,tmarketshare_c3 FROM `output` where game_id='$gid' and team_id='$tid' and round='$round' and final='1'");
				$der = mysql_fetch_array($dlr);
				// get country 1/2/3
				$dmd_c1=$der['demand_c1']; 				
				$dmd_c2=$der['demand_c2'];
				$dmd_c3=$der['demand_c3']; 		
//echo $dmd_c1."abcs";
				$tms1=$der['tmarketshare_c1']; $tms1 = preg_split("/[\s,]+/",$tms1);
				$tms2=$der['tmarketshare_c2']; $tms2 = preg_split("/[\s,]+/",$tms2);
				$tms3=$der['tmarketshare_c3']; $tms3 = preg_split("/[\s,]+/",$tms3);
// get total sale last round
$ttech11=$ttech21=$ttech31=$ttech41=0;
$ttech12=$ttech22=$ttech32=$ttech42=0;
$ttech13=$ttech23=$ttech33=$ttech43=0;
$result5 = mysql_query("SELECT team_id FROM `output` where game_id='$gid' and round='$round' and final='1'");
while ($row5 = mysql_fetch_array($result5))
{
 $tid2=$row5['team_id'];

   $result21 = mysql_query("SELECT tmarketshare_c1,tmarketshare_c2,tmarketshare_c3 FROM output where game_id='$gid' and team_id='$tid2' and round='$round'and final='1'");
   $array21 = mysql_fetch_array($result21);
   $tech1=$array21['tmarketshare_c1'];	$tech1= preg_split("/[\s,]+/",$tech1);
   $tech2=$array21['tmarketshare_c2'];	$tech2= preg_split("/[\s,]+/",$tech2);
   $tech3=$array21['tmarketshare_c3'];	$tech3= preg_split("/[\s,]+/",$tech3);
   $tt11=$tech1['0'];
   $tt21=$tech1['1'];
   $tt31=$tech1['2'];
   $tt41=$tech1['3'];
   $tt12=$tech2['0'];
   $tt22=$tech2['1'];
   $tt32=$tech2['2'];
   $tt42=$tech2['3'];
   $tt13=$tech3['0'];
   $tt23=$tech3['1'];
   $tt33=$tech3['2'];
   $tt43=$tech3['3'];  
   $ttech11=$ttech11+$tt11;
   $ttech21=$ttech21+$tt21;
   $ttech31=$ttech31+$tt31;
   $ttech41=$ttech41+$tt41;
   
   $ttech12=$ttech12+$tt12;
   $ttech22=$ttech22+$tt22;
   $ttech32=$ttech32+$tt32;
   $ttech42=$ttech42+$tt42;
   
   $ttech13=$ttech13+$tt13;
   $ttech23=$ttech23+$tt23;
   $ttech33=$ttech33+$tt33;
   $ttech43=$ttech43+$tt43;
}

// end get				
if ($ttech11!=0) {$m_t1_c1=$tms1['0']/$ttech11*100;} else {$m_t1_c1=0;}
//echo $m_t1_c1."abcs";
if ($ttech21!=0) {$m_t2_c1=$tms1['1']/$ttech21*100;} else {$m_t2_c1=0;}
if ($ttech31!=0) {$m_t3_c1=$tms1['2']/$ttech31*100;} else {$m_t3_c1=0;}
if ($ttech41!=0) {$m_t4_c1=$tms1['3']/$ttech41*100;} else {$m_t4_c1=0;}
				
if ($ttech12!=0) {$m_t1_c2=$tms2['0']/$ttech12*100;} else {$m_t1_c2=0;}
if ($ttech22!=0) {$m_t2_c2=$tms2['1']/$ttech22*100;} else {$m_t2_c2=0;}
if ($ttech32!=0) {$m_t3_c2=$tms2['2']/$ttech32*100;} else {$m_t3_c2=0;}
if ($ttech42!=0) {$m_t4_c2=$tms2['3']/$ttech42*100;} else {$m_t4_c2=0;}
				
if ($ttech13!=0) {$m_t1_c3=$tms3['0']/$ttech13*100;} else {$m_t1_c3=0;}				
if ($ttech23!=0) {$m_t2_c3=$tms3['1']/$ttech23*100;} else {$m_t2_c3=0;}
if ($ttech33!=0) {$m_t3_c3=$tms3['2']/$ttech33*100;} else {$m_t3_c3=0;}
if ($ttech43!=0) {$m_t4_c3=$tms3['3']/$ttech43*100;} else {$m_t4_c3=0;}

				
				// get last round value
		//		$dnp1 = mysql_query("SELECT country1,country2,country3 FROM `input` where game_id='$gid' and team_id='$tid'  and team_decision='1' and round='$round'");
		//		$rw1 = mysql_fetch_array($dnp1);
				// get country 1/2/3
		//		$c1=$rw1['country1']; 
		//		$country1=unserialize(base64_decode($c1));
		//		$c2=$rw1['country2']; 
		//		$country2=unserialize(base64_decode($c2));
		//		$c3=$rw1['country3']; 
		//		$country3=unserialize(base64_decode($c3));
				// Get demand and market share last round

				
		//		$m_t1_c1=$country1['est_marketshare_t1'];
		//		$m_t2_c1=$country1['est_marketshare_t2'];
		//		$m_t3_c1=$country1['est_marketshare_t3'];
		//		$m_t4_c1=$country1['est_marketshare_t4'];
				
		//		$m_t1_c2=$country2['est_marketshare_t1'];
		//		$m_t2_c2=$country2['est_marketshare_t2'];
		//		$m_t3_c2=$country2['est_marketshare_t3'];
		//		$m_t4_c2=$country2['est_marketshare_t4'];
				
		//		$m_t1_c3=$country3['est_marketshare_t1'];				
		//		$m_t2_c3=$country3['est_marketshare_t2'];
		//		$m_t3_c3=$country3['est_marketshare_t3'];
		//		$m_t4_c3=$country3['est_marketshare_t4'];
				
			//$round_new=$round+1;
	

				// table for market share
				$ld1f=number_format($dmd_c1);
				
				$ld2f=number_format($dmd_c2);
				$ld3f=number_format($dmd_c3);

				// ----------------------------------------------GET POST FOR THIS ROUND VALUES
				
				if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
				$res = mysql_query("SELECT country1, country2, country3 FROM input WHERE game_id='$gid' and player_id='$pid' and team_id='$tid' and round='$round_new' ");
				
				
				if( mysql_num_rows($res) == 1) 
				{
					$row = mysql_fetch_array($res);
					$ct1=$row['country1'];
					$c1=base64_decode($ct1);
					$c11=unserialize($c1);
					//echo $c1;
					$ct2=$row['country2'];
					//echo $ct2;
					$c2=base64_decode($ct2);
					//echo $c2;
					$c22=unserialize($c2);
					//echo $c22['est_demand'] ;
					$ct3=$row['country3'];
					$c3=base64_decode($ct3);
					$c33=unserialize($c3);
	// ---------------------- for feature research tech
// get tech rate reduce					
$result1 = mysql_query("SELECT rate_of_tech_price_reduce FROM game where id='$gid'");
$array = mysql_fetch_array($result1);
$rate_reduce=$array['rate_of_tech_price_reduce']/100;						
					
//get tech cost					
$result1 = mysql_query("SELECT country1 FROM round_assumption where game_id='$gid' and round='$round'");
$array = mysql_fetch_array($result1);
$cost_tech=$array['country1'];	
//echo $cost_tech."<br>";
$tech = preg_split("/[\s,]+/",$cost_tech);

//$cost_t1=$tech[11]*(1-$rate_reduce*($round+1))*1000;
$cost_t2=$tech[12]*(1-$rate_reduce*($round+1))*1000;
$cost_t3=$tech[13]*(1-$rate_reduce*($round+1))*1000;
$cost_t4=$tech[14]*(1-$rate_reduce*($round+1))*1000;
					
					//$f11=$c11['feature_tech1'];
					$f21=$c11['feature_tech2'];
					$f31=$c11['feature_tech3'];
					$f41=$c11['feature_tech4'];
					
					$f21 =preg_split("/[,]+/",$f21);
					$f31 =preg_split("/[,]+/",$f31);
					$f41 =preg_split("/[,]+/",$f41);
					//$te1=round($f11[5]-$f11[4]*$f11[2]-$cost_t1);
					$te2=round($f21[5]-$f21[4]*$f21[2]-$cost_t2);
					$te3=round($f31[5]-$f31[4]*$f31[2]-$cost_t3);
					$te4=round($f41[5]-$f41[4]*$f41[2]-$cost_t4);
					//if ($te1==0) {$tech_r1=1;}
					//	echo $te3;
					if ($te2==0) {$tech_r2=1;} else {$tech_r2=0;}
					if ($te3==0) {$tech_r3=1;} else {$tech_r3=0;}
					if ($te4==0) {$tech_r4=1;} else {$tech_r4=0;}
	// ------------------- end for feature research tech			
					//echo $f11;
					
					// demand
					$ct1=$c11['est_demand'];
					$ct2=$c22['est_demand'];
					$ct3=$c33['est_demand'];
					
					$mst11=$c11['est_marketshare_t1'];
					$mst12=$c11['est_marketshare_t2'];
					$mst13=$c11['est_marketshare_t3'];
					$mst14=$c11['est_marketshare_t4'];

					$mst21=$c22['est_marketshare_t1'];
					$mst22=$c22['est_marketshare_t2'];
					$mst23=$c22['est_marketshare_t3'];
					$mst24=$c22['est_marketshare_t4'];
					
					
					$mst31=$c33['est_marketshare_t1'];
					$mst32=$c33['est_marketshare_t2'];
					$mst33=$c33['est_marketshare_t3'];
					$mst34=$c33['est_marketshare_t4'];

					//production country 1/2
		// country1			
					$p_11=$c11['production1'];
					$p_12=$c11['production2'];
					$o_11=$c11['outsource1'];
					$o_12=$c11['outsource2'];
					// to array
					$p_11 = preg_split("/[\s,]+/",$p_11);
					$p_12 = preg_split("/[\s,]+/",$p_12);
					$o_11 = preg_split("/[\s,]+/",$o_11);
					$o_12 = preg_split("/[\s,]+/",$o_12);
					// to value
//p11					
					$t1_c1=$p_11[0];
					$p_c1_t1=$p_11[1];
					$v_c1_t1=$p_11[2];
					$supp1=$p_11[3];
					$mc1=$p_11[4];
					$ucost1=$p_11[5];
//p12
					$t2_c1=$p_12[0];
					$p_c1_t2=$p_12[1];
					$v_c1_t2=$p_12[2];
					$mc2=$p_12[4];					
					$ucost2=$p_12[5];
//o11
					$ot1_c1=$o_11[0];
					$op_c1_t1=$o_11[1];
					$ov_c1_t1=$o_11[2];
					$mc3=$o_11[4];
					$ucost3=$o_11[5];
//o12				
					$ot2_c1=$o_12[0];
					$op_c1_t2=$o_12[1];
					$ov_c1_t2=$o_12[2];
					$mc4=$o_12[4];
					$ucost4=$o_12[5];
					//echo "/".$t1_c1."/".$p_c1_t1."/".$v_c1_t1;
		// country2			
					$p_21=$c22['production1'];
					$p_22=$c22['production2'];
					$o_21=$c22['outsource1'];
					$o_22=$c22['outsource2'];
					//echo $o_22;
					$p_21 = preg_split("/[\s,]+/",$p_21);
					$p_22 = preg_split("/[\s,]+/",$p_22);
					$o_21 = preg_split("/[\s,]+/",$o_21);
					$o_22 = preg_split("/[\s,]+/",$o_22);
					
//p21					
					$t1_c2=$p_21[0];
					$p_c2_t1=$p_21[1];
					$v_c2_t1=$p_21[2];
					$supp2=$p_21[3];
					$mc5=$p_21[4];
					$ucost5=$p_21[5];
//p22
					$t2_c2=$p_22[0];
					$p_c2_t2=$p_22[1];
					$v_c2_t2=$p_22[2];
					$mc6=$p_22[4];					
					$ucost6=$p_22[5];
//o21
					$ot1_c2=$o_21[0];
					$op_c2_t1=$o_21[1];
					$ov_c2_t1=$o_21[2];
					$mc7=$o_21[4];
					$ucost7=$o_21[5];
//o22				
					$ot2_c2=$o_22[0];
					$op_c2_t2=$o_22[1];
					//echo $op_c2_t2;
					$ov_c2_t2=$o_22[2];
					$mc8=$o_22[4];
					$ucost8=$o_22[5];					
					
					}
				else
				{
					$ct1=0;
					$ct2=0;
					$ct3=0;
					
					$mst11=0;
					$mst12=0;
					$mst13=0;
					$mst14=0;

					$mst21=0;
					$mst22=0;
					$mst23=0;
					$mst24=0;
					
					
					$mst31=0;
					$mst32=0;
					$mst33=0;
					$mst34=0;
					
					$v_c1_t1=0;
					$v_c1_t2=0;
					$ov_c1_t1=0;
					$ov_c1_t2=0;
					$v_c2_t1=0;
					$v_c2_t2=0;
					$ov_c2_t1=0;
					$ov_c2_t2=0;
					$mc1=0;
					$mc2=0;
					$mc3=0;
					$mc4=0;
					$mc5=0;
					$mc6=0;
					$mc7=0;
					$mc8=0;
					
					$supp1=4;
					$supp2=4;
					$ucost1=0;
					$ucost2=0;
					$ucost3=0;
					$ucost4=0;
					$ucost5=0;
					$ucost6=0;
					$ucost7=0;
					$ucost8=0;		


					$tech_r2=0;
					$tech_r3=0;
					$tech_r4=0;
// create input array format with null value
$result = mysql_query("SELECT * FROM `input_title`");

while ($row = mysql_fetch_array($result))
{	
					if ($row['title']=='production1' or $row['title']=='production2' or $row['title']=='outsource1' or $row['title']=='outsource2' or $row['title']=='feature_tech1' or $row['title']=='feature_tech2' or $row['title']=='feature_tech3' or $row['title']=='feature_tech4')
					{
				    $c11[$row['title']]="0,0,0,0,0,0";
					$c22[$row['title']]="0,0,0,0,0,0";
					$c33[$row['title']]="0,0,0,0,0,0";
					
					}

					else
					{
					$c11[$row['title']]=0;
					$c22[$row['title']]=0;
					$c33[$row['title']]=0;
					}
}
$transfer="1,1,1,1";
$logistic_order_c1="132,132,132,132";
$logistic_order_c2="231,231,231,231";
$investment_c1="0,0,0";
$investment_c2="0,0,0";
$c11=base64_encode(serialize($c11));
$c22=base64_encode(serialize($c22));
$c33=base64_encode(serialize($c33));
$date = date('Y-m-d H:i:s');
if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}

$result_input=mysql_query("INSERT INTO `input` (assumption_id,game_id,team_id,player_id,round,date,country1,country2,country3,transfer_price,logistic_order_c1,logistic_order_c2,investment_c1,investment_c2) VALUES ('$assumption_id','$gid','$tid','$pid','$round_for_input','$date','$c11','$c22','$c33','$transfer','$logistic_order_c1','$logistic_order_c2','$investment_c1','$investment_c2')  ");
$sql=mysql_real_escape_string("INSERT INTO `input` (assumption_id,game_id,team_id,round,date,country1,country2,country3,transfer_price,logistic_order_c1,logistic_order_c2,investment_c1,investment_c2) VALUES ('$assumption_id','$gid','$tid','$round_for_input','$date','$c11','$c22','$c33','$transfer','$logistic_order_c1','$logistic_order_c2','$investment_c1','$investment_c2')  ");
$t=logs($user_for_logs,$_SESSION['id'],$sql,$result_input);
$server_header=$_SERVER['REQUEST_URI'];
 header ("Location:$server_header");
				}

				// -------------------------------------------------------END
			
				// ---------------------- GET POST
				
			if(isset($_POST['post_production']))
{

$ldc1=$_POST['ld_c1'];
$ldc2=$_POST['ld_c2'];
$ldc3=$_POST['ld_c3'];

$dc1=$_POST['d_c1'];
$dc2=$_POST['d_c2'];
$dc3=$_POST['d_c3'];

$assumption_id=$_POST['assumption_id'];
$gid=$_POST['game_id'];
$tid=$_POST['team_id'];
$round_2=$_POST['round'];
$date = date('Y-m-d H:i:s');

$c11['est_demand']=$dc1;
$c11=base64_encode(serialize($c11));


$c22['est_demand']=$dc2;
$c22=base64_encode(serialize($c22));
$c33['est_demand']=$dc3;
$c33=base64_encode(serialize($c33));

$new_d1=round($ldc1*(1+$dc1/100),0);
$new_d2=round($ldc2*(1+$dc2/100),0);
$new_d3=round($ldc3*(1+$dc3/100),0);

if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
$result = mysql_query("SELECT id FROM input WHERE assumption_id ='$assumption_id' and game_id='$gid' and player_id='$pid' and team_id='$tid' and round='$round_2' ");

if( mysql_num_rows($result) == 1) {
$date = date('Y-m-d H:i:s');

$result_input=mysql_query("UPDATE `input` SET date='$date', country1='$c11', country2 = '$c22', country3 = '$c33'  WHERE assumption_id ='$assumption_id'  and player_id='$pid' and game_id='$gid' and team_id='$tid' and round='$round_2'  ");
$sql=mysql_real_escape_string("UPDATE `input` SET country1='$c11', country2 = '$c22', country3 = '$c33'  WHERE assumption_id ='$assumption_id' and game_id='$gid' and team_id='$tid' and round='$round_2'  ");
$t=logs($user_for_logs,$_SESSION['id'],$sql,$result_input);
$server_header=$_SERVER['REQUEST_URI'];
header ("Location:$server_header");
	}
else
{

	}



if($result_input)
	{
    //echo("<br>Input data is succeed");
	
	} 
	else
	{
    //echo("<br>Input data is fail");
	}	

}	
else
{
$ldc1=$dmd_c1;
$ldc2=$dmd_c2;
$ldc3=$dmd_c3;
$new_d1=round($ldc1*(1+$ct1/100),0);
$new_d2=round($ldc2*(1+$ct2/100),0);
$new_d3=round($ldc3*(1+$ct3/100),0);
$dc1=0;
$dc2=0;
$dc3=0;
}
	
		// for marketshare
			if(isset($_POST['post_marketshare']))
{

					for ($c=1; $c<=3; $c++) 
					{
				//-------- loop country
				
				$y=0;
				
				for ($x=0; $x<=3; $x++) 
				{
				++$y;
				$in="c".$c."t".$y;
								
				IF(isset($_POST[$in])) 
					{ 
				$$in=$_POST[$in];
				//echo $$in;
					}	 
				else 
					{
					$$in=0;
					}
				
				}
					}
				
				//end loop country
					
					

$assumption_id=$_POST['assumption_id'];
$gid=$_POST['game_id'];
$tid=$_POST['team_id'];
$round_2=$_POST['round'];
$date = date('Y-m-d H:i:s');

$c11['est_marketshare_t1']=$c1t1; 
$c22['est_marketshare_t1']=$c2t1;
$c33['est_marketshare_t1']=$c3t1;

$c11['est_marketshare_t2']=$c1t2; 
$c22['est_marketshare_t2']=$c2t2;
$c33['est_marketshare_t2']=$c3t2;

$c11['est_marketshare_t3']=$c1t3; 
$c22['est_marketshare_t3']=$c2t3;
$c33['est_marketshare_t3']=$c3t3;

$c11['est_marketshare_t4']=$c1t4; 
$c22['est_marketshare_t4']=$c2t4;
$c33['est_marketshare_t4']=$c3t4;
//echo $c33['est_marketshare_t1'];

$c11=base64_encode(serialize($c11));
$c22=base64_encode(serialize($c22));
$c33=base64_encode(serialize($c33));

if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
$result = mysql_query("SELECT id FROM input WHERE assumption_id ='$assumption_id' and game_id='$gid' and player_id='$pid' and team_id='$tid' and round='$round_2' ");

if( mysql_num_rows($result) == 1) {
$date = date('Y-m-d H:i:s');


$result_input=mysql_query("UPDATE `input` SET date='$date', country1='$c11', country2 = '$c22', country3 = '$c33'  WHERE assumption_id ='$assumption_id' and game_id='$gid' and player_id='$pid' and team_id='$tid' and round='$round_2'  ");
$sql=mysql_real_escape_string("UPDATE `input` SET country1='$c11', country2 = '$c22', country3 = '$c33'  WHERE assumption_id ='$assumption_id' and game_id='$gid' and team_id='$tid' and round='$round_2'  ");
$t=logs($user_for_logs,$_SESSION['id'],$sql,$result_input);
$server_header=$_SERVER['REQUEST_URI'];
header ("Location:$server_header");
	}
else
{

	}



if($result_input)
	{
    //echo("<br>Input data is succeed");
	
	} 
	else
	{
    //echo("<br>Input data is fail");
	}	

}	
else
{

}
//-------------- for cap allocation
			if(isset($_POST['post_allocation']))
{

//echo "allocation";
$assumption_id=$_POST['assumption_id'];
$gid=$_POST['game_id'];
$tid=$_POST['team_id'];
$round_2=$_POST['round'];
$date = date('Y-m-d H:i:s');


$cap1_c1=$_POST['cap1_c1'];  // cap11
$c1_t1=$_POST['c1_t1'];// 					tech kind1
$cap2_c1=$_POST['cap2_c1'];  //cap12
$c1_t2=$_POST['c1_t2'];// 					tech kind2
$os1_c1=$_POST['os1_c1']; //cap outsource 11
$os1_t1=$_POST['os1_t1'];// 				tech kind1
$os2_c1=$_POST['os2_c1'];// cap outsource 12
$os1_t2=$_POST['os1_t2'];// 				tech kind2
$supp1=$_POST['supp_c1'];


$cap1_c2=$_POST['cap1_c2']; 
$c2_t1=$_POST['c2_t1'];
$cap2_c2=$_POST['cap2_c2']; 
$c2_t2=$_POST['c2_t2'];
$os1_c2=$_POST['os1_c2']; // cap outsource 21
$os2_t1=$_POST['os2_t1'];
$os2_c2=$_POST['os2_c2'];// cap outsource 22
$os2_t2=$_POST['os2_t2'];
$supp2=$_POST['supp_c2'];

// get production max outsource from round_assumption id=7
   $result1 = mysql_query("SELECT country1, country2, cap_per_plant FROM round_assumption where game_id='$gid' and round=$round_2");
   $array = mysql_fetch_array($result1);
   $max_os1=$array['country1'];	
   $max_os2=$array['country2'];	
   $cap_per_plant=$array['cap_per_plant'];	
   $max_os1 = preg_split("/[\s,]+/",$max_os1);
   $max_os2 = preg_split("/[\s,]+/",$max_os2);
   	
	//echo "max outsource1:".$max_os1[7]."/";
   $total_out_c1=$max_os1[7]/2;   
   $total_out_c2=$max_os2[7]/2;
   
   // get direct labour and direct material 
   $dl=$max_os1[1];
   $dm=$max_os1[6];
   $su=$max_os1[$supp1+1];
   $unitcost=$dl+$dm+$su;
   // get ratio unitcost for tech1/2/3/40
   $t1=$max_os1[11];
   $t2=$max_os1[12];
   $t3=$max_os1[13];
   $t4=$max_os1[14];
   //cost outsource premium compare to inhouse
   $costoutsource1=$max_os1[23]/100;
   $costoutsource2=$max_os2[23]/100;
   
   $tucost[1]=1;
   $tucost[2]=$t2/$t1;
   $tucost[3]=$t3/$t1;
   $tucost[4]=$t4/$t1;

   
  // echo "dl:".$dl."dm:".$dm."supp:".$su;
  
// get factory from output --> get max production number
   $round1=$round_2-1;
   $result1 = mysql_query("SELECT factory FROM output where game_id='$gid' and round='$round1' and final='1'");
   $array = mysql_fetch_array($result1);
   $no_fac=$array['factory'];	
   
   $factory=unserialize($no_fac);
   $fac_c1=$factory['c1'];
   $fac_c2=$factory['c2'];
	
	$total_pro_c1=$fac_c1* $cap_per_plant/2;
	$total_pro_c2=$fac_c2* $cap_per_plant/2;
// get cost equation_array

   $result1 = mysql_query("SELECT cost_equation FROM game where id='$gid'");
   $array = mysql_fetch_array($result1);
   $cost_equation=$array['cost_equation'];	

   
$equation_array = preg_split("/[\s,]+/",$cost_equation);
// get cost multiplier
//cap11
$cap_allocate=$cap1_c1/100;
$cm11=($equation_array[0]* pow($cap_allocate,$equation_array[1]))+($equation_array[2]*$cap_allocate)+$equation_array[3];
//cap12
$cap_allocate=$cap2_c1/100;
$cm12=($equation_array[0]* pow($cap_allocate,$equation_array[1]))+($equation_array[2]*$cap_allocate)+$equation_array[3];
//cap outsource 11
$cro=$total_out_c1/20000000;
$cm13=$os1_c1/10*$cro*(1+$costoutsource1);

//cap outsource 12

$cm14=$os2_c1/10*$cro*(1+$costoutsource1);

// get unit cost

$ucost1=round($unitcost*$cm11*$tucost[$c1_t1],1);
$ucost2=round($unitcost*$cm12*$tucost[$c1_t2],1);
$ucost3=round($unitcost/(0.5+$cm13)*$tucost[$os1_t1],1);
$ucost4=round($unitcost/(0.5+$cm14)*$tucost[$os1_t2],1);

//cap 21
$cap_allocate=$cap1_c2/100;
$cm21=($equation_array[0]* pow($cap_allocate,$equation_array[1]))+($equation_array[2]*$cap_allocate)+$equation_array[3];
//cap 22
$cap_allocate=$cap2_c2/100;
$cm22=($equation_array[0]* pow($cap_allocate,$equation_array[1]))+($equation_array[2]*$cap_allocate)+$equation_array[3];
// cap outsource 21
$cro2=$total_out_c2/20000000;
$cm23=$os1_c2/10*$cro2*(1+$costoutsource2);
// cap outsource 22
$cap_allocate=$os2_c2/100;
$cm24=$os2_c2/10*$cro2*(1+$costoutsource2);
// unitcost country2

$ucost5=round($unitcost*$cm21*$tucost[$c2_t1],1);
$ucost6=round($unitcost*$cm22*$tucost[$c2_t2],1);
$ucost7=round($unitcost/(0.5+$cm23)*$tucost[$os2_t1],1);
$ucost8=round($unitcost/(0.5+$cm24)*$tucost[$os2_t2],1);


// ------------------=for country 1 --------------------------
$c1_pro_1=($cap1_c1/100)*$total_pro_c1;
$c11['production1']=$c1_t1.",".$cap1_c1.",".$c1_pro_1.",".$supp1.",".$cm11.",".$ucost1;
$c1_pro_2=($cap2_c1/100)*$total_pro_c1;
$c11['production2']=$c1_t2.",".$cap2_c1.",".$c1_pro_2.",".$supp1.",".$cm12.",".$ucost2;
//outsource
$c1_os_1=($os1_c1/100)*$total_out_c1;
$c11['outsource1']=$os1_t1.",".$os1_c1.",".$c1_os_1.",".$supp1.",".$cm13.",".$ucost3;
$c1_os_2=($os2_c1/100)*$total_out_c1;
$c11['outsource2']=$os1_t2.",".$os2_c1.",".$c1_os_2.",".$supp1.",".$cm14.",".$ucost4;

//---------------------------- end country 1

// ------------------=for country 2 --------------------------
$c2_pro_1=($cap1_c2/100)*$total_pro_c2;
//echo $cap1_c."lll";
$c22['production1']=$c2_t1.",".$cap1_c2.",".$c2_pro_1.",".$supp2.",".$cm21.",".$ucost5;
$c2_pro_2=($cap2_c2/100)*$total_pro_c2;
$c22['production2']=$c2_t2.",".$cap2_c2.",".$c2_pro_2.",".$supp2.",".$cm22.",".$ucost6;
//outsource
$c2_os_1=($os1_c2/100)*$total_out_c2;
$c22['outsource1']=$os2_t1.",".$os1_c2.",".$c2_os_1.",".$supp2.",".$cm23.",".$ucost7;
$c2_os_2=($os2_c2/100)*$total_out_c2;
//echo $os2_t2;

$c22['outsource2']=$os2_t2.",".$os2_c2.",".$c2_os_2.",".$supp2.",".$cm24.",".$ucost8;
//echo $c22['outsource2'];
//---------------------------- end country 2
$c11=base64_encode(serialize($c11));
$c22=base64_encode(serialize($c22));

//echo "<br>total production tech1:".$total_tech1_pro."</><br>";
//echo "total outsource tech1:".$total_tech1_os."</><br>";
if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
$result = mysql_query("SELECT id FROM input WHERE assumption_id ='$assumption_id' and game_id='$gid' and player_id='$pid' and team_id='$tid' and round='$round_2' ");

if( mysql_num_rows($result) == 1) {
$date = date('Y-m-d H:i:s');

$result_input=mysql_query("UPDATE `input` SET date='$date', country1='$c11', country2 = '$c22'  WHERE assumption_id ='$assumption_id' and game_id='$gid' and player_id='$pid' and team_id='$tid' and round='$round_2'  ");
$sql=mysql_real_escape_string("UPDATE `input` SET country1='$c11', country2 = '$c22'  WHERE assumption_id ='$assumption_id' and game_id='$gid' and team_id='$tid' and round='$round_2'  ");
$t=logs($user_for_logs,$_SESSION['id'],$sql,$result_input);	
$server_header=$_SERVER['REQUEST_URI'];
header ("Location:$server_header");
	}
if($result_input)
	{    //echo("<br>Input data is succeed");	
	} 
	else
	{    //echo("<br>Input data is fail");
	}	


// set value for selected option = post value
$cap1_c1=$_POST['cap1_c1'];  // cap11
$c1_t1=$_POST['c1_t1'];// 					tech kind1
$cap2_c1=$_POST['cap2_c1'];  //cap12
$c1_t2=$_POST['c1_t2'];// 					tech kind2
$os1_c1=$_POST['os1_c1']; //cap outsource 11
$os1_t1=$_POST['os1_t1'];// 				tech kind1
$os2_c1=$_POST['os2_c1'];// cap outsource 12
$os1_t2=$_POST['os1_t2'];// 				tech kind2
$supp_c1=$_POST['supp_c1'];
//p11					
					$t1_c1=$c1_t1;
					$p_c1_t1=$cap1_c1;
					$s1=$supp1;
					$v_c1_t1=round($c1_pro_1,0);
					$mc1=round($cm11,1);
					//$ucost1=round($unitcost*$mc1,1);
				//echo "----".$c2_pro_1;
//p12
					$t2_c1=$c1_t2;
					$p_c1_t2=$cap2_c1;
					$v_c1_t2=round($c1_pro_2,0);
					$mc2=round($cm12,1);
					//$ucost2=round($unitcost*$mc2,1);
//o11
					$ot1_c1=$os1_t1;
					$op_c1_t1=$os1_c1;
					$ov_c1_t1=round($c1_os_1,0);
					$mc3=round($cm13,1);
					//$ucost3=round($unitcost*$mc3,1);
//o12				
					$ot2_c1=$os1_t2;
					$op_c1_t2=$os2_c1;
					$ov_c1_t2=round($c1_os_2,0);
					$mc4=round($cm14,1);
					//$ucost4=round($unitcost*$mc4,1);
// for country 2

// set value for selected option = post value
$cap1_c2=$_POST['cap1_c2'];  // cap11
$c2_t1=$_POST['c2_t1'];// 					tech kind1
$cap2_c2=$_POST['cap2_c2'];  //cap12
$c2_t2=$_POST['c2_t2'];// 					tech kind2
$os1_c2=$_POST['os1_c2']; //cap outsource 11
$os2_t1=$_POST['os2_t1'];// 				tech kind1
$os2_c2=$_POST['os2_c2'];// cap outsource 12
$os2_t2=$_POST['os2_t2'];// 				tech kind2
$supp_c2=$_POST['supp_c2'];
//p21					
					$t1_c2=$c2_t1;
					$p_c2_t1=$cap1_c2;
					$s2=$supp2;
					$v_c2_t1=round($c2_pro_1,0);
					$mc5=round($cm21,1);
					//$ucost1=round($unitcost*$mc1,1);
				//echo "----".$c2_pro_1;
//p22
					$t2_c2=$c2_t2;
					$p_c2_t2=$cap2_c2;
					$v_c2_t2=round($c2_pro_2,0);
					$mc6=round($cm22,1);
					//$ucost2=round($unitcost*$mc2,1);
//o21
					$ot1_c2=$os2_t1;
					$op_c2_t1=$os1_c2;
					$ov_c2_t1=round($c2_os_1,0);
					$mc7=round($cm23,1);
					//$ucost3=round($unitcost*$mc3,1);
//o22				
					$ot2_c2=$os2_t2;
					$op_c2_t2=$os2_c2;
					//echo $c2_os_2;
					$ov_c2_t2=round($c2_os_2,0);
					$mc8=round($cm24,1);
					//$ucost4=round($unitcost*$mc4,1);

					
}
else
{
// get value from database if exist;
// selected value is from post if post exist else = database value

}				
// ---------------------- END GET POST
$hn = max($new_d1, $new_d2, $new_d3,$dmd_c1,$dmd_c2,$dmd_c3);	
if ($overtime==0){	echo"<form action='game.php?act=production&tid=".$tid."&id=".$gid."' class=demo method='POST'>";}
		
				echo"<table><th width=30%>".$LANG['market']."</th><th width=15%>".$LANG['lastrounddemand']."</th><th width=15%>".$LANG['growth']." %</th><th width=15%>".$LANG['expecteddemand']."</th><th width=40%>".$LANG['graph']."</th>";
				//c1			
				echo"<tr><td><b>".$LANG['1']."</b></td><td class=right>".$ld1f."</td>";
				echo"<td class=demo>";
				
				echo"<select name='d_c1' onchange='this.form.submit()'>";
				for ($s=-50; $s<=100; $s++) 
				{
				if($dc1==0){$dc1=$ct1;}
				if ($dc1==$s) {$selected="selected";} else {$selected="";}
				echo"<option value=".$s." ".$selected.">".$s." %</option>";
				}
				echo"</select>";
				echo"</td>";	
				echo"<td class=right>".number_format($new_d1)."</td>";
				echo"<td>";
				echo"<dl><dd class='old' style='width:".($ldc1/$hn*100)."%'></dd><dd class='new' style='width:".($new_d1/$hn*100)."%'></dd></dl>";
				echo"</td></tr>";
				//c2			
				echo"<tr><td><b>".$LANG['2']."</b></td><td class=right>".$ld2f."</td>";
				echo"<td class=demo>";
				
				echo"<select name='d_c2' onchange='this.form.submit()'>";
				for ($s=-50; $s<=100; $s++) 
				{
				if($dc2==0){$dc2=$ct2;}
				if ($dc2==$s) {$selected="selected";} else {$selected="";}
				echo"<option value=".$s." ".$selected.">".$s." %</option>";
				}
				echo"</select>";
				echo"</td>";	
				echo"<td class=right>".number_format($new_d2)."</td>";
				echo"<td>";
				echo"<dl><dd class='old' style='width:".($ldc2/$hn*100)."%'></dd><dd class='new' style='width:".($new_d2/$hn*100)."%'></dd></dl>";
				echo"</td></tr>";				
				//c3			
				echo"<tr><td><b>".$LANG['3']."</b></td><td class=right>".$ld3f."</td>";
				echo"<td class=demo>";
				
				echo"<select name='d_c3' onchange='this.form.submit()'>";
				for ($s=-50; $s<=100; $s++) 
				{
				if($dc3==0){$dc3=$ct3;}
				if ($dc3==$s) {$selected="selected";} else {$selected="";}
				echo"<option value=".$s." ".$selected.">".$s." %</option>";
				}
				echo"</select>";
				echo"</td>";	
				echo"<td class=right>".number_format($new_d3)."</td>";	
				echo"<td>";
				echo"<dl><dd class='old' style='width:".($ldc3/$hn*100)."%'></dd><dd class='new' style='width:".($new_d3/$hn*100)."%'></dd></dl>";
				echo"</td></tr>";	
				
				// end

				echo"</table>";
				echo"<input type=hidden name='assumption_id' value='".$assumption_id."'/>";
				echo"<input type=hidden name='round' value='".$round_new."'/>";
				echo"<input type=hidden name='game_id' value='".$gid."'/>";
				echo"<input type=hidden name='team_id' value='".$tid."'/>";
				echo"<input type=hidden name='ld_c1' value='".$dmd_c1."'/>";
				echo"<input type=hidden name='ld_c2' value='".$dmd_c2."'/>";
				echo"<input type=hidden name='ld_c3' value='".$dmd_c3."'/>";
				echo"<input type=hidden name='post_production' value='1'/>";
				echo"</form>";	
				

				$newd1=round((1+$ct1/100)*$dmd_c1,0);
				$newd2=round((1+$ct2/100)*$dmd_c2,0);
				$newd3=round((1+$ct3/100)*$dmd_c3,0);
				

				// table for tech marketshare
					// get tech available
				$tech = mysql_query("SELECT tech FROM `output` where game_id='$gid' and team_id='$tid' and round='$round' and final='1'");
				$ctech = mysql_fetch_array($tech);
				$t= preg_split("/[\s,]+/",$ctech[0]);
				$tech_1= $t[0];
				$tech_2= $t[1]+$tech_r2;
				$tech_3= $t[2]+$tech_r3;
				$tech_4= $t[3]+$tech_r4;
				// get from research
	
				
				$rowspan=$tech_1+$tech_2+$tech_3+$tech_4;
					// get market share
		$maxd=max($newd1,$newd2,$newd3,$dmd_c1,$dmd_c2,$dmd_c3);
		$hms = max($mst11,$mst12,$mst13,$mst14,$mst11,$mst22,$mst23,$mst24,$mst31,$mst32,$mst33,$mst34,$m_t1_c1,$m_t2_c1,$m_t3_c1,$m_t4_c1,$m_t1_c2,$m_t2_c2,$m_t3_c2,$m_t4_c2,$m_t1_c3,$m_t2_c3,$m_t3_c3,$m_t4_c3);		$hno=$maxd*(1+$hms/100);	
				
			echo"</div><div class='simpleTabsContent'>";	

				echo"<br><h4>".$LANG['techmarket']."</h4>";	

				
				if ($overtime==0){echo"<form action='game.php?act=production&tid=".$tid."&id=".$gid."' class=demo method='POST'>";}
				
				echo"<table><th width=15%>".$LANG['market']."</th><th width=15%>".$LANG['technology']."</th><th width=15%>".$LANG['lastroundmarket']." %</th><th width=15%>".$LANG['expectedmarketshare']." %</th><th width=15%>".$LANG['expecteddemand']."</th><th width=40%>".$LANG['graph']."</th>";
				
			    $te1=$te2=$te3=$te4=0;
								for ($c=1; $c<=3; $c++) 
					{
				//-------- loop country
				
				$y=0;
			
				echo"<tr><td rowspan=$rowspan><b>".$LANG[$c]."</b></td>";
				for ($x=0; $x<=3; $x++) 
				{
				++$y;
				
				//$ud="";
				
				//echo $ud."<br>";
				$t="tech_".$y;
				if ($$t==1)
					{
				if ($x!=0 and $rowspan==1) {echo"<td></td>";}	
				$mk="m_t".$y."_c".$c;
				$m="mst".$c.$y;
				$ud="newd".$c;
				$l="dmd_c".$c;
				
				//echo $mk;
				$t="tech_".$y;
				
				echo "<td class=result3>".$LANG[$t]."</td>";
				echo"<td class=right>".number_format($$mk)." %</td>";
				$in="c".$c."t".$y;
				//echo $$ud."/";
				
				echo"<td class='demo' >";
				echo"<select name='".$in."' onchange='this.form.submit()'>";
				for ($s=0; $s<=100; $s++) 
				{
			
				if (isset($$in)) {if($$in==0){$$in=$$m;}} else  {$$in=0;}
				$mks=round($$ud*($$in/100),0);	
				
				if($$in==$s) {$select="selected";} else {$select="";}
				echo"<option ".$select." value=".$s.">".$s." %</option>";
				
				}
				// get total for each tech
				$te="exdemand".$c.$y;
			  // echo $mks;
				if (isset($$te)) {$$te=$$te+$mks;} 
				else 
				{
				if (isset($mks)) {$$te=$mks;} else {$$te=0;}
				}

				echo"</select>";
				echo"</td>";
				echo"<td class=right>".number_format($mks)."</td>";
				echo"<td>";
								echo"<dl><dd class='old' style='width:".($$l*($$mk/100)/$hno*100)."%'></dd><dd class='new' style='width:".($mks/$hno*100)."%'></dd></dl>";
				echo"</td>";
				
					}
					
					echo"</tr>";
				}
				//end loop country
					}
				echo"</table>";
				
				//echo "tech4".$te4;
				echo"<input type=hidden name='assumption_id' value='".$assumption_id."'/>";
				echo"<input type=hidden name='round' value='".$round_new."'/>";
				echo"<input type=hidden name='game_id' value='".$gid."'/>";
				echo"<input type=hidden name='team_id' value='".$tid."'/>";
				echo"<input type=hidden name='ld_c1' value='".$dmd_c1."'/>";
				echo"<input type=hidden name='ld_c2' value='".$dmd_c2."'/>";
				echo"<input type=hidden name='ld_c3' value='".$dmd_c3."'/>";
				echo"<input type=hidden name='post_marketshare' value='1'/>";
				echo"</form>";
				//end
			echo"<br><h4>".$LANG['networkforecast']."</h4>";
			// drawing
echo"<table>";			
echo"<th>".$LANG['1']."</th><th>".$LANG['2']."</th><th>".$LANG['3']."</th>";
echo"<tr><td width=33%><img src='graph.php?id=$gid&c=1'></td>";
echo"<td width=33%><img src='graph.php?id=$gid&c=2'></td>";
echo"<td width=33%><img src='graph.php?id=$gid&c=3'></td></tr>";
echo"<tr><td colspan=3>";

echo"<ul class='legend'>";
echo"<li><span class='t1'></span> ".$LANG['tech_1']."</li>";
echo"<li><span class='t2'></span> ".$LANG['tech_2']."</li>";
echo"<li><span class='t3'></span> ".$LANG['tech_3']."</li>";
echo"<li><span class='t4'></span> ".$LANG['tech_4']."</li>";
echo"</ul>";

echo"</td></tr>";
echo"</table><br>";			
// end drawing				
// for production

echo"</div><div class='simpleTabsContent'>";	
				echo"<br><h4>".$LANG['productioncost']."</h4>";
// cost cost equation
	$result1 = mysql_query("SELECT cost_equation FROM game where id='$gid'");
   $array = mysql_fetch_array($result1);
   $cost_equation=$array['cost_equation'];	
   
   $equation_array = preg_split("/[\s,]+/",$cost_equation);
   $a1=$equation_array[0];
   $a2=$equation_array[1];
   $a3=$equation_array[2];
   $a4=$equation_array[3];
echo"<table>";
echo"<th>".$LANG['capacityuti']."</th>";
echo"<tr><td><img style='width:100%' src='graph.php?cost=1&a1=$a1&a2=$a2&a3=$a3&a4=$a4'></td></tr>";
echo"</table>";	
	
				
				echo"<br><h4>".$LANG['productionsupp']."</h4>";
// get number of factory				
   $result2 = mysql_query("SELECT factory,inventory_c1,inventory_c2 FROM output where game_id='$gid' and team_id='$tid' and round='$round'and final='1'");
   $array2 = mysql_fetch_array($result2);
   $no_fac2=$array2['factory'];	
   
   $factory2=unserialize($no_fac2);
   $fac_c1=$factory2['c1'];
   $fac_c2=$factory2['c2'];
// get old inventory
	
$inven1=$array2['inventory_c1'];	
$inven2=$array2['inventory_c2'];
$inven1 = preg_split("/[,]+/",$inven1);
$inven2 = preg_split("/[,]+/",$inven2);		

$inven11=$inven1[0];
$inven12=$inven1[1];
$inven13=$inven1[2];
$inven14=$inven1[3];

$inven21=$inven2[0];
$inven22=$inven2[1];
$inven23=$inven2[2];
$inven24=$inven2[3];


				//echo"Choose suppliers";
	// get suppliers
	$round_2=$round+1;
$sup = mysql_query("SELECT country1 FROM `round_assumption` WHERE id='$assumption_id' and game_id='$gid' and round='$round_2'");

$suppliers = mysql_fetch_array($sup);
$supp=$suppliers['country1'];
$supp = preg_split("/[,]+/",$supp);
//echo $supp[2];
//echo $round_2."ádadadsad";
	echo "<table>"; 
	echo "<th></th><th>".$LANG['s1']."</th><th>".$LANG['s2']."</th><th>".$LANG['s3']."</th><th>".$LANG['s4']."</th>";
	echo"<tr><td>".$LANG['costperunit']." (USD)</td><td>$ ".$supp[2]."</td><td>$ ".$supp[3]."</td><td>$ ".$supp[4]."</td><td>$ ".$supp[5]."</td></tr>";
	echo"<tr><td>".$LANG['sustainrating']."</td><td><dl class='rate'><dd class='new' style='width:30%'></dd></dl></td><td><dl class='rate'><dd class='new' style='width:50%'></dd></dl></td><td><dl class='rate'><dd class='new' style='width:70%'></dd></dl></td><td><dl class='rate'><dd class='new' style='width:90%'></dd></dl></td></tr>";
	echo"</table>";
	// end get
// capacity allocation	table	
echo"</div>";

echo"<div class='simpleTabsContent'>";	
echo"<br><h4>".$LANG['capacity']."</h4>";	
	
if ($overtime==0){echo"<form action='game.php?act=production&tid=".$tid."&id=".$gid."' class=demo method='POST'>";}
		echo"<table><th>".$LANG['market']."</th><th>".$LANG['productionline']." 1</th><th>".$LANG['productionline']." 2</th><th>".$LANG['outsource']." 1</th><th>".$LANG['outsource']." 2</th><th>".$LANG['supplier']."</th>";
		echo"<tr><td><b>".$LANG['1']."</b><br>".$LANG['factory'].": ".$fac_c1."</td>";
		echo"<td class=demo>";
// for cap
echo"<select style='width:48%;' onchange='this.form.submit()' name='cap1_c1' >";
  for ($x=0; $x<=100; $x++) 
{
if($x==$p_c1_t1) {$s="selected";} else {$s="";}
echo"<option ".$s." value=".$x.">".$x."%</option>";
}
echo"</select>";
// end
// for tech
echo"<select style='width:48%;' onchange='this.form.submit()' name='c1_t1' >";
  for ($x=1; $x<=4; $x++) 
{
$tech="tech_".$x;
if($x==$t1_c1){$s="selected";} else {$s="";}
if ($$tech==1){
echo"<option value=".$x." ".$s.">Tech ".$x."</option>";
			}
}
echo"</select>";
// end
echo"<br><br><b>".$LANG['total'].":</b> ".number_format($v_c1_t1)." ".$LANG['unit']."<br><b>".$LANG['unitcost'].": </b>US$ ".$ucost1;
echo"</td>";		
//-------------for production line 2	
		echo"<td class=demo>";
// for cap
echo"<select style='width:48%;' onchange='this.form.submit()' name='cap2_c1' >";
  for ($x=0; $x<=100; $x++) 
{
if($x==$p_c1_t2) {$s="selected";} else {$s="";}
echo"<option ".$s." value=".$x.">".$x."%</option>";
}
echo"</select>";
// end
// for tech
echo"<select style='width:48%;' onchange='this.form.submit()' name='c1_t2' >";
  for ($x=1; $x<=4; $x++) 
{
$tech="tech_".$x;
if($x==$t2_c1){$s="selected";} else {$s="";}
if ($$tech==1){
echo"<option ".$s." value=".$x.">Tech ".$x."</option>";
			}
}
echo"</select>";
// end
echo"<br><br><b>".$LANG['total'].": </b>".number_format($v_c1_t2)." ".$LANG['unit']."<br><b>".$LANG['unitcost'].": </b>US$ ".$ucost2;
echo"</td>";
		
//-------------for outsource line 1
		echo"<td class=demo>";
// for cap
echo"<select style='width:48%;' onchange='this.form.submit()' name='os1_c1' >";
  for ($x=0; $x<=100; $x++) 
{
if($x==$op_c1_t1) {$s="selected";echo $x;} else {$s="";}

echo"<option ".$s." value=".$x.">".$x."%</option>";
}
echo"</select>";
// end
// for tech
echo"<select style='width:48%;' onchange='this.form.submit()' name='os1_t1' >";
  for ($x=1; $x<=4; $x++) 
{
$tech="tech_".$x;
if($x==$ot1_c1){$s="selected";} else {$s="";}
if ($$tech==1){
echo"<option ".$s." value=".$x.">Tech ".$x."</option>";
			}
}
echo"</select>";
// end
echo"<br><br><b>".$LANG['total'].": </b>".number_format($ov_c1_t1)." ".$LANG['unit']."<br><b>".$LANG['unitcost'].": </b>US$ ".$ucost3;
echo"</td>";
//-------------for outsource line 2
		echo"<td class=demo>";
// for cap
echo"<select style='width:48%;' onchange='this.form.submit()' name='os2_c1' >";
  for ($x=0; $x<=100; $x++) 
{
if($x==$op_c1_t2) {$s="selected";} else {$s="";}
echo"<option ".$s." value=".$x.">".$x."%</option>";
}
echo"</select>";
// end
// for tech
echo"<select style='width:48%;' onchange='this.form.submit()' name='os1_t2' >";
  for ($x=1; $x<=4; $x++) 
{
$tech="tech_".$x;
if($x==$ot2_c1){$s="selected";} else {$s="";}
if ($$tech==1){
echo"<option ".$s." value=".$x.">Tech ".$x."</option>";
			}
}
echo"</select>";
// end
echo"<br><br><b>".$LANG['total'].": </b>".number_format($ov_c1_t2)." ".$LANG['unit']."<br><b>".$LANG['unitcost'].": </b>US$ ".$ucost4;
echo"</td>";
//-------------for suppliers
		echo"<td class=demo>";
if($supp1==1){$s1="selected";$s2=$s3=$s4="";} else {$s1="";}		
if($supp1==2){$s2="selected";$s1=$s3=$s4="";} else {$s2="";}
if($supp1==3){$s3="selected";$s2=$s1=$s4="";} else {$s3="";}
if($supp1==4){$s4="selected";$s2=$s3=$s1="";} else {$s4="";}

echo"<select style='width:100%;' onchange='this.form.submit()' name='supp_c1' >";
echo"<option ".$s1." value='1'>".$LANG['s1']."</option>";
echo"<option ".$s2." value='2'>".$LANG['s2']."</option>";
echo"<option ".$s3." value='3'>".$LANG['s3']."</option>";
echo"<option ".$s4." value='4' >".$LANG['s4']."</option>";
echo"</select>";
echo"</td>";
		echo"</tr>";		
// start country 2
if($fac_c2==0) {$r="";} else {$r="";}
		echo"<tr><td><b>".$LANG['2']."</b><br>".$LANG['factory'].": ".$fac_c2."</td>";
		echo"<td class=demo>";
// for cap
echo"<select ".$r." style='width:48%;' onchange='this.form.submit()' name='cap1_c2' >";
  for ($x=0; $x<=100; $x++) 
{
if($x==$p_c2_t1) {$s="selected";} else {$s="";}
echo"<option ".$s." value=".$x.">".$x."%</option>";
}
echo"</select>";
// end
// for tech
echo"<select style='width:48%;' onchange='this.form.submit()' name='c2_t1' >";
  for ($x=1; $x<=4; $x++) 
{
$tech="tech_".$x;
if($x==$t1_c2){$s="selected";} else {$s="";}
if ($$tech==1){
echo"<option value=".$x." ".$s.">Tech ".$x."</option>";
			}
}
echo"</select>";
// end
echo"<br><br><b>".$LANG['total'].": </b> ".number_format($v_c2_t1)." ".$LANG['unit']."<br><b>".$LANG['unitcost'].": </b>US$ ".$ucost5;
echo"</td>";		
//-------------for production line 2	
		echo"<td class=demo>";
// for cap
echo"<select ".$r."  style='width:48%;' onchange='this.form.submit()' name='cap2_c2' >";
  for ($x=0; $x<=100; $x++) 
{
if($x==$p_c2_t2) {$s="selected";} else {$s="";}
echo"<option ".$s." value=".$x.">".$x."%</option>";
}
echo"</select>";
// end
// for tech
echo"<select style='width:48%;' onchange='this.form.submit()' name='c2_t2' >";
  for ($x=1; $x<=4; $x++) 
{
$tech="tech_".$x;
if($x==$t2_c2){$s="selected";} else {$s="";}
if ($$tech==1){
echo"<option ".$s." value=".$x.">Tech ".$x."</option>";
			}
}
echo"</select>";
// end
echo"<br><br><b>".$LANG['total'].": </b>".number_format($v_c2_t2)." ".$LANG['unit']."<br><b>".$LANG['unitcost'].": </b>US$ ".$ucost6;
echo"</td>";
		
//-------------for outsource line 1
		echo"<td class=demo>";
// for cap
echo"<select style='width:48%;' onchange='this.form.submit()' name='os1_c2' >";
  for ($x=0; $x<=100; $x++) 
{
if($x==$op_c2_t1) {$s="selected";echo $x;} else {$s="";}

echo"<option ".$s." value=".$x.">".$x."%</option>";
}
echo"</select>";
// end
// for tech
echo"<select style='width:48%;' onchange='this.form.submit()' name='os2_t1' >";
  for ($x=1; $x<=4; $x++) 
{
$tech="tech_".$x;
if($x==$ot1_c2){$s="selected";} else {$s="";}
if ($$tech==1){
echo"<option ".$s." value=".$x.">Tech ".$x."</option>";
			}
}
echo"</select>";
// end
echo"<br><br><b>".$LANG['total'].": </b>".number_format($ov_c2_t1)." ".$LANG['unit']."<br><b>".$LANG['unitcost'].": </b>US$ ".$ucost7;
echo"</td>";
//-------------for outsource line 2
		echo"<td class=demo>";
// for cap

echo"<select style='width:48%;' onchange='this.form.submit()' name='os2_c2' >";
//echo $op_c2_t2;
  for ($x=0; $x<=100; $x++) 
{
if($x==$op_c2_t2) {$s="selected";} else {$s="";}
echo"<option ".$s." value=".$x.">".$x."%</option>";
}
echo"</select>";
// end
// for tech
echo"<select style='width:48%;' onchange='this.form.submit()' name='os2_t2' >";
  for ($x=1; $x<=4; $x++) 
{
$tech="tech_".$x;
if($x==$ot2_c2){$s="selected";} else {$s="";}
if ($$tech==1){
echo"<option ".$s." value=".$x.">Tech ".$x."</option>";
			}
}
echo"</select>";
// end
echo"<br><br><b>".$LANG['total'].": </b>".number_format($ov_c2_t2)." ".$LANG['unit']."<br><b>".$LANG['unitcost'].": </b>US$ ".$ucost8;
echo"</td>";
//-------------for suppliers
		echo"<td class=demo>";
if($supp2==1){$s1="selected";$s2=$s3=$s4="";} else {$s1="";}		
if($supp2==2){$s2="selected";$s1=$s3=$s4="";} else {$s2="";}
if($supp2==3){$s3="selected";$s2=$s1=$s4="";} else {$s3="";}
if($supp2==4){$s4="selected";$s2=$s3=$s1="";} else {$s4="";}

echo"<select ".$r."  style='width:100%;' onchange='this.form.submit()' name='supp_c2' >";
echo"<option ".$s1." value='1'>".$LANG['s1']."</option>";
echo"<option ".$s2." value='2'>".$LANG['s2']."</option>";
echo"<option ".$s3." value='3'>".$LANG['s3']."</option>";
echo"<option ".$s4." value='4' >".$LANG['s4']."</option>";
echo"</select>";
echo"</td>";
		echo"</tr>";	
		
		echo"</table>";
				echo"<input type=hidden name='assumption_id' value='".$assumption_id."'/>";
				echo"<input type=hidden name='round' value='".$round_new."'/>";
				echo"<input type=hidden name='game_id' value='".$gid."'/>";
				echo"<input type=hidden name='team_id' value='".$tid."'/>";
				echo"<input type=hidden name='ld_c1' value='".$dmd_c1."'/>";
				echo"<input type=hidden name='ld_c2' value='".$dmd_c2."'/>";
				echo"<input type=hidden name='ld_c3' value='".$dmd_c3."'/>";
				//for market growth				
				echo"<input type=hidden name='d_c1' value='".$dc1."'/>";
				echo"<input type=hidden name='d_c2' value='".$dc2."'/>";
				echo"<input type=hidden name='d_c3' value='".$dc3."'/>";
				echo"<input type=hidden name='post_allocation' value='1'/>";
echo"</form>";		
//------------------------------- end cap allocation		


// get total production each tech
//c1
if (!isset($t1_c1)) {$t1_c1=0;}
if (!isset($t2_c1)) {$t2_c1=0;}
if (!isset($ot1_c1)) {$ot1_c1=0;}
if (!isset($ot2_c1)) {$ot2_c1=0;}

$a[1]=$t1_c1;
$a[2]=$t2_c1;
$a[3]=$ot1_c1;
$a[4]=$ot2_c1;

if (!isset($v_c1_t1)) {$v_c1_t1=1;}
if (!isset($v_c1_t2)) {$v_c1_t1=1;}
if (!isset($ov_c1_t1)) {$ov_c1_t1=1;}
if (!isset($ov_c1_t2)) {$ov_c1_t2=1;}

$b[1]=$v_c1_t1;
$b[2]=$v_c1_t2;
$b[3]=$ov_c1_t1;
$b[4]=$ov_c1_t2;

$tech11=0;
$tech12=0;
$tech13=0;
$tech14=0;

  for ($x=1; $x<=4; $x++) 
{
if ($a[$x]==1){$tech11=$tech11+$b[$x];}
if ($a[$x]==2){$tech12=$tech12+$b[$x];}
if ($a[$x]==3){$tech13=$tech13+$b[$x];}
if ($a[$x]==4){$tech14=$tech14+$b[$x];}
}

//c2
if (!isset($t1_c2)) {$t1_c2=0;}
if (!isset($t2_c2)) {$t2_c2=0;}
if (!isset($ot1_c2)) {$ot1_c2=0;}
if (!isset($ot2_c2)) {$ot2_c2=0;}

$a[1]=$t1_c2;
$a[2]=$t2_c2;
$a[3]=$ot1_c2; 
$a[4]=$ot2_c2;

$b[1]=$v_c2_t1;
$b[2]=$v_c2_t2;
$b[3]=$ov_c2_t1;
$b[4]=$ov_c2_t2;

$tech21=0;
$tech22=0;
$tech23=0;
$tech24=0;

  for ($x=1; $x<=4; $x++) 
{
if ($a[$x]==1){$tech21=$tech21+$b[$x];}
if ($a[$x]==2){$tech22=$tech22+$b[$x];}
if ($a[$x]==3){$tech23=$tech23+$b[$x];}
if ($a[$x]==4){$tech24=$tech24+$b[$x];}
}
// update to output

//echo $tech11;
$production_c1=$tech11.",".$tech12.",".$tech13.",".$tech14;
$production_c2=$tech21.",".$tech22.",".$tech23.",".$tech24;

//echo $round_2;

echo"<br><h4>".$LANG['inventory']."</h4>";		
//$bar=0;
//for ($c=1; $c<=2; $c++) 
//{
//echo"<h4>".$LANG[$c]."</h4>";
echo"<table><th>".$LANG['technology']."</th><th>".$LANG['begininginventory']."</th><th>".$LANG['totalproduction']."</th><th>".$LANG['expectedsale']."</th><th>".$LANG['endinginventory']."</th><th>".$LANG['productionvssale']."</th>";	
for ($t=1; $t<=4; $t++) 
{
$tt1="tech1".$t;
$tt2="tech2".$t;
//$tt3="tech3".$t;

$tttotal=$$tt1+$$tt2;

//$tt2=$tech12+$tech22;
//$tt3=$tech13+$tech23;
//$tt4=$tech14+$tech24;

$tech="tech_".$t;
$production="tt".$t;
$demand="te".$t;
$inven1="inven1".$t;
$inven2="inven2".$t;
//$inven3="inven3".$t;

$inventotal=$$inven1+$$inven2;

$te1="exdemand1".$t;
$te2="exdemand2".$t;
$te3="exdemand3".$t;
//echo $$te1."<br>";
if (isset($$te1))
{ $te1_1=$$te1; } else  {$te1_1=0;}
if (isset($$te2))
{ $te2_1=$$te2; } else  {$te2_1=0;}
if (isset($$te3))
{ $te3_1=$$te3; } else  {$te3_1=0;}

$tetotal=$te3_1+$te2_1+$te1_1;

if (!isset($tetotal)) {$tetotal=0;}

//$inven2="inven2".$t;
//$totali=$$inven1+$$inven2;

echo"<tr><td><b>".$LANG[$tech]."</b></td>";


//if ($bar==0) {$bar=1;}
//$bar=$bar+$$inven1;

echo"<td>".number_format((float)$inventotal)."</td>";
echo"<td>".number_format((float)$tttotal)."</td>";
echo"<td>".number_format((float)$tetotal)."</td>";
echo"<td>".number_format($tttotal-$tetotal+$inventotal)."</td>";
if ($tttotal>=$tetotal) {$max=$tttotal;} else 
 {$max=$tetotal;}
if ($max!=0) {$t1=$tttotal/($max);$t2=$tetotal/($max);} else {$t1=0;$t2=0;}
echo"<td><dl><dd class='old' style='width:".($t1*100)."%'></dd><dd class='new' style='width:".($t2*100)."%'></dd></dl></td>";
}	
echo "</tr></table>";
//}

echo "</div>";
echo "</div>";

}				
  //---------------------------------------------end nav tab 	

 }
 

 //------------------- HR FORM
 			if(isset($_POST['post_hr']) and $_GET['act']=='hr')
{
// get value

$worker_rate=$_POST['worker'];
$turnover=$_POST['turnover'];
$wage_rate=$_POST['wage'];
$old_wage=$_POST['old_wage'];
$training_rate=$_POST['training'];
$old_training=$_POST['old_training'];
$old_worker=$_POST['old_worker'];
$new_worker=$old_worker*(1+$worker_rate/100);
$wage=$old_wage*(1+$wage_rate/100);
$training=$old_training*(1+$training_rate/100);

if ($new_worker<$old_worker) {$layoff=$old_worker-$new_worker;} else {$layoff=0;}

$gid=$_SESSION['game_id'] ;
$tid=$_SESSION['team_id'] ;

//--------------------------- check time
 
 $checktime=checktime($gid,$tid);
 echo $checktime;
  
 //--------------------------- end check time
$round_2=$_POST['round'];
$date = date('Y-m-d H:i:s');
				if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
				$res = mysql_query("SELECT country1, country2, country3 FROM input WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_2' ");
				
				
				if( mysql_num_rows($res) == 1) 
				{
					$row = mysql_fetch_array($res);
					$ct1=$row['country1'];
					$c1=base64_decode($ct1);
					$c11=unserialize($c1);

					//update new number
					$c11['HR_no_of_staffs']=$new_worker;
					$c11['HR_wage_pe']=$wage;
					$c11['HR_training_budget_pe']=$training;
					$c11['HR_turnover_rate']=$turnover;
					$c11['hr_layoff']=$layoff;
					
					$c11=base64_encode(serialize($c11));
					
					$date = date('Y-m-d H:i:s');
					

					$result_input=mysql_query("UPDATE `input` SET date='$date', country1='$c11' WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_2'  ");
					$sql=mysql_real_escape_string("UPDATE `input` SET country1='$c11' WHERE game_id='$gid' and team_id='$tid' and round='$round_2'  ");  
					$t=logs($user_for_logs,$_SESSION['id'],$sql,$result_input);
					$server_header=$_SERVER['REQUEST_URI'];
					header ("Location:$server_header");
				}
					else
					{

					}


}
  if( $_GET['act']=='hr')
  {
  
 if($_SESSION['mod']==1 or $_SESSION['admin']==1 )
 {
  $gid=$_GET['gid'] ;
 $tid=$_GET['tid'] ;
 } else 
 {
  $gid=$_SESSION['game_id'] ;
 $tid=$_SESSION['team_id'] ;
 }
 
 //--------------------------- check time
 
 $checktime=checktime($gid,$tid);
 echo $checktime;
  
 //--------------------------- end check time
 	// round
	$res_round = mysql_query("SELECT max(round) FROM output where game_id='$gid' and final='1' and team_id='$tid'");
	$array_round = mysql_fetch_array($res_round);
	$round=$array_round[0];
	$round_for_input=$round+1;
	// get practice round
$game = mysql_query("SELECT practice_round FROM `game` where id='$gid'");
$hpr = mysql_fetch_array($game);
$pround=$hpr['practice_round'];
if ($round==$pround) {$round=0;} 
	//manday per worker
	$manday1 = mysql_query("SELECT hr_manday_per_worker,hr_recruitment_layoff_cost FROM game where id='$gid'");
	$manday1 = mysql_fetch_array($manday1);
	$manday=$manday1['hr_manday_per_worker'];	
	$rela_cost=$manday1['hr_recruitment_layoff_cost'];	
	// get hr_efficiency_rate
	$hr_rate = mysql_query("SELECT hr_efficiency_rate FROM output WHERE game_id='$gid' and team_id='$tid' and round='$round'and final='1'");
	$hr_rate = mysql_fetch_array($hr_rate);
	$hrate = $hr_rate[0];

	//$hrate=$hr_rate['hr_manday_per_worker'];	
	
	//echo$rela_cost;
 // get value for last round
 
				if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
 				$res = mysql_query("SELECT country1  FROM input WHERE game_id='$gid' and team_id='$tid' and team_decision='1' and round='$round' ");
				
				
				if( mysql_num_rows($res) == 1) 
				{
					$row = mysql_fetch_array($res);
					$ct1=$row['country1'];
					$c1=base64_decode($ct1);
					$c10=unserialize($c1);

				
				    $worker=$c10['HR_no_of_staffs'];
					$wage=$c10['HR_wage_pe'];
					//echo $wage;
					$training=$c10['HR_training_budget_pe'];
					//$turnover=$c10['HR_turnover_rate'];
					$layoff=$c10['hr_layoff'];
					//echo $worker;
					if ($worker==0 and $wage==0 and $training==0 and $layoff==0) 
			{
			
						$res1 = mysql_query("SELECT country1,country2,country3  FROM input WHERE game_id='$gid' and team_id='$tid' and team_decision='1' and round='0' ");
				
				
				if( mysql_num_rows($res1) == 1) 
				{
				//echo "ues";
					$row1 = mysql_fetch_array($res1);
					$ct1=$row1['country1'];
					$c1=base64_decode($ct1);
					$c10=unserialize($c1);
					
					$ct2=$row1['country2'];
					$c2=base64_decode($ct2);
					$c20=unserialize($c2);

					$ct3=$row1['country3'];
					$c3=base64_decode($ct3);
					$c30=unserialize($c3);
					
					$worker=$c10['HR_no_of_staffs'];
					$wage=$c10['HR_wage_pe'];
					$training=$c10['HR_training_budget_pe'];
					$layoff=$c10['hr_layoff'];
					
					$f10=$c10['feature_tech1'];
					$f20=$c10['feature_tech2'];
					$f30=$c10['feature_tech3'];
					$f40=$c10['feature_tech4'];
					
			
				}
				
			
			}

					
					// get from output value of hr eff and turnover last round
						$game = mysql_query("SELECT hr_efficiency_rate,hr_turnover FROM `output` where game_id='$gid' and team_id='$tid' and round='$round' and final='1'");
						$hpr = mysql_fetch_array($game);
						$turnover=$hpr['hr_efficiency_rate']; 
						
				}

// get value for this round

if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
 				$res = mysql_query("SELECT country1  FROM input WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input' ");
				
				
				if( mysql_num_rows($res) == 1) 
				{
					$row = mysql_fetch_array($res);
					$ct1=$row['country1'];
					$c1=base64_decode($ct1);
					$c10=unserialize($c1);

				
				    $worker2=$c10['HR_no_of_staffs'];
					$wage2=$c10['HR_wage_pe'];
					$training2=$c10['HR_training_budget_pe'];
					$turnover2=$c10['HR_turnover_rate'];
					$layoff2=$c10['hr_layoff'];
					if ($worker2==0 or $wage2==0)
					{
			        $worker2=$worker;
					$wage2=$wage;
					$training2=$training;
					$turnover2=$turnover;
					$layoff2=$layoff;	
					}

				}
				else
				{
			
				}
				
if ($overtime==0){echo"<form action='game.php?act=hr&tid=".$tid."&id=".$gid."' class=demo method='POST'>";}
echo"<table>";
echo"<th>".$LANG['rndpersonel']."</th><th>".$LANG['lastround']."</th><th>".$LANG['estimatedchange']."</th><th>".$LANG['thisround']."</th><th>".$LANG['units']."</th><th>".$LANG['lastroundvsthisround']."</th>"; 
echo"<tr><td>".$LANG['noofworkers']."</td>";
echo"<td>".number_format($worker)."</td>";
echo"<td class=demo><select style='width:100%;' onchange='this.form.submit()' name='worker' >";

$worker_select=round(($worker2-$worker)/$worker*100,0);
//echo $worker_select;
  for ($x=-50; $x<=100; $x++) 
{
if($x==0) {$s="selected";} else {$s="";}
if($x==$worker_select) {$s="selected";} else {$s="";}
echo"<option ".$s." value=".$x.">".$x." %</option>";
}
echo"</select></td>"; 	
echo"<td>".number_format($worker2)."</td>";
echo"<td>".$LANG['personnel']."</td>"; 	
//graph
echo"<td><dl><dd class='old' style='width:".($worker/($worker+$worker2)*100)."%'></dd><dd class='new' style='width:".($worker2/($worker+$worker2)*100)."%'></dd></dl></td>";
// end graph
echo"<tr><td>".$LANG['turnoverrate']."</td>";
echo"<td>".$turnover." %</td>";
echo"<td class=demo><select style='width:100%;' onchange='this.form.submit()' name='turnover' >";

  for ($x=0; $x<=100; $x++) 
{
if($x==$turnover2) {$s="selected";} else {$s="";}
echo"<option ".$s." value=".$x.">".$x." %</option>";
}
echo"</select></td>";

echo"<td>".$turnover2." %</td>";
echo"<td> % </td>";
//graph
echo"<td><dl><dd class='old' style='width:".($turnover/($turnover2+$turnover)*100)."%'></dd><dd class='new' style='width:".($turnover2/($turnover2+$turnover)*100)."%'></dd></dl></td>";
// end graph
echo"</tr>";
echo"<tr><td>".$LANG['recruitrate']."</td>";
$recruit=($worker*$turnover/100);
$recruit2=($worker2*$turnover2/100);
echo"<td>".number_format($recruit-$layoff)." </td>";
if (round($recruit-$layoff)==0) {$chr=0;} else {$chr=(($recruit2-$layoff2)-($recruit-$layoff))/($recruit-$layoff)*100;}
echo"<td>".number_format($chr)." %</td>";
echo"<td>".number_format($recruit2-$layoff2)." </td>";
echo"<td>".$LANG['personnel']."</td>";

//graph
echo"<td></td>";
// end graph
echo"</tr>";

echo"<tr><td colspan=6 class=result2><b>".$LANG['salary']."</b></td></tr>";
echo"<tr><td>".$LANG['averagewage']."</td>";
if ($wage!=0)
{
$wage_select=round(($wage2-$wage)/$wage*100,0);
}
else
{
$wage_select=0;
}
echo"<td>US$ ".number_format((float)$wage)."</td>";
echo"<td class=demo><select style='width:100%;' onchange='this.form.submit()' name='wage' >";
  for ($x=-50; $x<=100; $x++) 
{
if($x==0) {$s="selected";} else {$s="";}
if($x==$wage_select) {$s="selected";} else {$s="";}
echo"<option ".$s." value=".$x.">".$x." %</option>";
}
echo"</select></td>";
echo"<td>US$ ".number_format($wage2)."</td><td>USD ".$LANG['permonth']."</td>";
//graph
echo"<td><dl><dd class='old' style='width:".(($wage)/($wage2+$wage)*100)."%'></dd><dd class='new' style='width:".(($training2)/($wage2+$wage)*100)."%'></dd></dl></td>";
// end graph
echo"</tr>";
echo"<tr><td>".$LANG['avgtraining']."</td>";
echo"<td>US$ ".$training."</td>";
$tra_select=round(($training2-$training)/$training*100,0);
echo"<td class=demo><select style='width:100%;' onchange='this.form.submit()' name='training' >";
  for ($x=-50; $x<=100; $x++) 
{
if($x==0 or $x==$tra_select) {$s="selected";} else {$s="";}

echo"<option ".$s." value=".$x.">".$x." %</option>";
}
echo"</select></td>";
echo"<td>US$ ".$training2."</td>";
echo"<td>USD ".$LANG['permonth']."</td>";
//graph
echo"<td><dl><dd class='old' style='width:".(($training)/($training2+$training)*100)."%'></dd><dd class='new' style='width:".(($training2)/($training2+$training)*100)."%'></dd></dl></td>";
// end graph
echo"</tr>";

echo"<tr><td><b>".$LANG['totalresearchhour']."</b></td>";
echo"<td>".number_format(($manday*$worker))." ".$LANG['hour']."</td>";
echo"<td>".number_format(((($manday*$worker2)/$hrate)-($manday*$worker))/($manday*$worker)*100)." %</td>";
echo"<td>".number_format(($manday*$worker2)/$hrate)." ".$LANG['hour']."</td>";
echo"<td>".$LANG['researchhour']."</td>";
//graph
echo"<td><dl><dd class='old' style='width:".(($manday*$worker)/((($manday*$worker2)/$hrate)+($manday*$worker))*100)."%'></dd><dd class='new' style='width:".((($manday*$worker2)/$hrate)/((($manday*$worker2)/$hrate)+($manday*$worker))*100)."%'></dd></dl></td>";
// end graph
echo"</tr>";
echo"<tr><td colspan=6 class=result2><b>".$LANG['costs']."</b></td></tr>";
echo"<tr><td>".$LANG['layoffcost']."</td>";
echo"<td>US$ ".number_format($layoff*$rela_cost)."</td>";
echo"<td>".number_format(($layoff2*$rela_cost)-($layoff*$rela_cost))."</td>";
echo"<td>US$ ".number_format($layoff2*$rela_cost)."</td>";
echo"<td>USD</td>";
//graph
if (($layoff*$rela_cost)!=0 and ($layoff2*$rela_cost)!=0)
{
echo"<td><dl><dd class='old' style='width:".(($layoff*$rela_cost)/(($layoff*$rela_cost)+($layoff2*$rela_cost))*100)."%'></dd><dd class='new' style='width:".(($layoff2*$rela_cost)/(($layoff*$rela_cost)+($layoff2*$rela_cost))*100)."%'></dd></dl></td>";
}
else
{
echo"<td></td>";
}
// end graph
echo"</tr>";
echo"<tr><td>".$LANG['recruitingcost']."</td>";
echo"<td>US$ ".number_format($recruit*$rela_cost)."</td>";
echo"<td>".number_format((($recruit2*$rela_cost)-($recruit*$rela_cost))/($recruit*$rela_cost))." %</td>";
echo"<td>US$ ".number_format($recruit2*$rela_cost)."</td>";
echo"<td>USD</td>";
//graph
echo"<td><dl><dd class='old' style='width:".(($recruit*$rela_cost)/(($recruit*$rela_cost)+($recruit2*$rela_cost))*100)."%'></dd><dd class='new' style='width:".(($recruit2*$rela_cost)/(($recruit*$rela_cost)+($recruit2*$rela_cost))*100)."%'></dd></dl></td>";
// end graph
echo"</tr>";
echo"<tr><td><b>".$LANG['employmentcost']."</b></td>";
echo"<td>US$ ".number_format($worker*$wage*12)."</td>";
if($wage!=0)
{
$w3=(($worker2*$wage2*12)-($worker*$wage*12))/($worker*$wage*12)*100;
}
else
{
$w3=0;
}
echo"<td>".number_format($w3)." %</td>";
echo"<td>US$ ".number_format($worker2*$wage2*12)."</td>";
echo"<td>USD</td>";
//graph
echo"<td><dl><dd class='old' style='width:".(($worker*$wage*12)/(($worker*$wage*12)+($worker2*$wage2*12))*100)."%'></dd><dd class='new' style='width:".(($worker2*$wage2*12)/(($worker*$wage*12)+($worker2*$wage2*12))*100)."%'></dd></dl></td>";
// end graph
echo"</tr>";
echo"<tr><td><b>".$LANG['trainingcost']."</b></td>";
echo"<td>US$ ".number_format($worker*$training*12)."</td>";
echo"<td>".number_format((($worker2*$training2*12)-($worker*$training*12))/($worker*$training*12)*100)." %</td>";
echo"<td>US$ ".number_format($worker2*$training2*12)."</td>";
echo"<td>USD ".$LANG['perround']."</td>";
//graph
echo"<td><dl><dd class='old' style='width:".(($worker*$training*12)/(($worker*$training*12)+($worker2*$training2*12))*100)."%'></dd><dd class='new' style='width:".(($worker2*$training2*12)/(($worker*$training*12)+($worker2*$training2*12))*100)."%'></dd></dl></td>";
// end graph
echo"</tr>";


 echo"</table>";
 				//echo"<input type=hidden name='assumption_id' value='".$assumption_id."'/>";
				echo"<input type=hidden name='round' value='".$round_for_input."'/>";
				echo"<input type=hidden name='old_wage' value='".$wage."'/>";
				echo"<input type=hidden name='old_training' value='".$training."'/>";
				echo"<input type=hidden name='old_worker' value='".$worker."'/>";
				echo"<input type=hidden name='game_id' value='".$gid."'/>";
				echo"<input type=hidden name='team_id' value='".$tid."'/>";
				echo"<input type=hidden name='post_hr' value='1'/>";
 
 echo"</form>";
 }
 
 // ------------ end HR form
 
  //--------------------------- RnD FORM
  //feature[0] current feature   fix** ---- get from output
  //feature[1] research hours required
  //feature[2] cost to buy
  //feature[3] no of features research this round
  //feature[4] no of features bought this round
  //feature[5] cost
  
 			if( $_GET['act']=='rnd')
			
			{
			
 if($_SESSION['mod']==1 or $_SESSION['admin']==1 )
 {
  $gid=$_GET['gid'] ;
 $tid=$_GET['tid'] ;
 } else 
 {
  $gid=$_SESSION['game_id'] ;
 $tid=$_SESSION['team_id'] ;
 }
 
 //--------------------------- check time
 
 $checktime=checktime($gid,$tid);
 echo $checktime;
  
 //--------------------------- end check time
 	// round
	$res_round = mysql_query("SELECT max(round) FROM output where game_id='$gid' and final='1' and team_id='$tid'");
	$array_round = mysql_fetch_array($res_round);
	$round=$array_round[0];
	$round_for_input=$round+1;
	// get practice round
$game = mysql_query("SELECT practice_round FROM `game` where id='$gid'");
$hpr = mysql_fetch_array($game);
$pround=$hpr['practice_round'];
if ($round==$pround) {$round=0;} 
	//manday per worker
	$manday1 = mysql_query("SELECT hr_manday_per_worker FROM game where id='$gid'");
	$manday1 = mysql_fetch_array($manday1);
	$manday=$manday1['hr_manday_per_worker'];
	// get hr_efficiency_rate
	$hr_rate = mysql_query("SELECT hr_efficiency_rate FROM output WHERE game_id='$gid' and team_id='$tid' and round='$round' and final='1'");
	$hr_rate = mysql_fetch_array($hr_rate);
	$hrate = $hr_rate[0];	

	
	
	// get value for last round

if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
 				$res = mysql_query("SELECT country1,country2,country3  FROM input WHERE game_id='$gid' and team_id='$tid' and team_decision='1' and round='$round' ");
				
				
				if( mysql_num_rows($res) == 1) 
				{
				//echo "ues";
					$row = mysql_fetch_array($res);
					$ct1=$row['country1'];
					$c1=base64_decode($ct1);
					$c10=unserialize($c1);

					$old_worker=$c10['HR_no_of_staffs'];
					//echo $old_worker;
					
			
				}
				
				
 				$res = mysql_query("SELECT country1,country2,country3  FROM input WHERE game_id='$gid' and team_id='$tid' and team_decision='1' and round='0' ");
				
				
				if( mysql_num_rows($res) == 1) 
				{
				//echo "ues";
					$row = mysql_fetch_array($res);
					$ct1=$row['country1'];
					$c1=base64_decode($ct1);
					$c10=unserialize($c1);
					
					$ct2=$row['country2'];
					$c2=base64_decode($ct2);
					$c20=unserialize($c2);

					$ct3=$row['country3'];
					$c3=base64_decode($ct3);
					$c30=unserialize($c3);
					
					$old_worker=$c10['HR_no_of_staffs'];
					
					$f10=$c10['feature_tech1'];
					$f20=$c10['feature_tech2'];
					$f30=$c10['feature_tech3'];
					$f40=$c10['feature_tech4'];
					
			
				}				
				
				
				
				
				
	// get number of worker
			if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
			$res = mysql_query("SELECT country1,country2,country3  FROM input WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input' ");
				
				
							if( mysql_num_rows($res) == 1) 
				{ 
			
					$row = mysql_fetch_array($res);
					$ct1=$row['country1'];
					$c1=base64_decode($ct1);
					$c11=unserialize($c1);

					$ct2=$row['country2'];
					$c2=base64_decode($ct2);	
					$c22=unserialize($c2);
					
					$ct3=$row['country3'];
					$c3=base64_decode($ct3);	
					$c33=unserialize($c3);
					
					$f11=$c11['feature_tech1'];
					$f21=$c11['feature_tech2'];
					$f31=$c11['feature_tech3'];
					$f41=$c11['feature_tech4'];
					
					//echo $f11;
					$f11 =preg_split("/[,]+/",$f11);
					$f21 =preg_split("/[,]+/",$f21);
					$f31 =preg_split("/[,]+/",$f31);
					$f41 =preg_split("/[,]+/",$f41);
				    $worker=$c11['HR_no_of_staffs'];
					
					$buyt1=$f11[4];
					$buyt2=$f21[4];
					$buyt3=$f31[4];
					$buyt4=$f41[4];
					//echo $buyt4;
					if ($f11[2]==0)
					{
				
					$c11['feature_tech1']=$c10['feature_tech1'];
					$c11['feature_tech2']=$c10['feature_tech2'];	
					$c11['feature_tech3']=$c10['feature_tech3'];
					$c11['feature_tech4']=$c10['feature_tech4'];
					
					 $c11=base64_encode(serialize($c11));
					 $date = date('Y-m-d H:i:s');
					
					$ri="UPDATE `input` SET country1='$c11',date='$date' WHERE game_id='$gid' and team_id='$tid' and player_id='$pid'  and round='$round_for_input'  ";
					 $result_input=mysql_query("UPDATE `input` SET country1='$c11' WHERE game_id='$gid' and team_id='$tid' and round='$round_for_input'  ");
				//	$sql=mysql_real_escape_string($ri);  
				//	$t=logs($user_for_logs,$_SESSION['id'],$sql,$result_input);

					
					$f11=$f10;
					$f21=$f20;
					$f31=$f30;
					$f41=$f40;
					$f11 =preg_split("/[,]+/",$f11);
					$f21 =preg_split("/[,]+/",$f21);
					$f31 =preg_split("/[,]+/",$f31);
					$f41 =preg_split("/[,]+/",$f41);
					
					$server_header=$_SERVER['REQUEST_URI'];
				//	header ("Location:$server_header");
					}
				

				}
				else
				{ 
					$buyt1=0;
					$buyt2=0;
					$buyt3=0;
					$buyt4=0;
				}
				
 // get current feature
 	$feature1 = mysql_query("SELECT feature FROM output where game_id='$gid' and team_id='$tid' and round='$round' and final='1' ");
	$feature1 = mysql_fetch_array($feature1);
	$f0=$feature1['feature'];
		$f0 =preg_split("/[,]+/",$f0);
		$f1=$f0[0];
		$f2=$f0[1];
		$f3=$f0[2];
		$f4=$f0[3];
	//end current feature
	
if ($worker==0) {$worker=$old_worker;}
echo"<h4>".$LANG['inhouseresearch']."</h4>";	
if ($overtime==0){echo"<form action='game.php?act=rnd&tid=".$tid."&id=".$gid."' class=demo method='POST'>";			}
	echo"<table>";
	echo"<th width=15%>".$LANG['technology']."</th><th width=15%>".$LANG['featureavailable']."</th><th width=15%>".$LANG['allocateresearchhour']."</th><th width=10%>".$LANG['allocatedhours']."</th><th>".$LANG['researchhourforfeature']."</th><th width=15%> ".$LANG['totalfeature']."</th>";	

$avai_hours=$worker*$manday/$hrate-$f11[3]*$f11[1]-$f21[3]*$f21[1]-$f31[3]*$f31[1]-$f41[3]*$f41[1];
// if drop HR number
if ($avai_hours<0)
{
			$f11[3]=$f1;
			$f21[3]=$f2;
			$f31[3]=$f3;
			$f41[3]=$f4;
			$avai_hours=$worker*$manday/$hrate-$f11[3]*$f11[1]-$f21[3]*$f21[1]-$f31[3]*$f31[1]-$f41[3]*$f41[1];
			for ($i=0; $i<=5; $i++) 
			{
			if ($i==0){$string1=$f11[$i];$string2=$f21[$i];$string3=$f31[$i];$string4=$f41[$i];}
			else{$string1=$string1.",".$f11[$i];$string2=$string2.",".$f21[$i];$string3=$string3.",".$f31[$i];$string4=$string4.",".$f41[$i];}
			}	
			$c11['feature_tech1']=$string1;
			$c11['feature_tech2']=$string2;
			$c11['feature_tech3']=$string3;
			$c11['feature_tech4']=$string4;
			$c11=base64_encode(serialize($c11));
			if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
			$res = mysql_query("SELECT country1  FROM input WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input' ");
				if( mysql_num_rows($res) == 1) 
				{
				$date = date('Y-m-d H:i:s');
				
				$result_input=mysql_query("UPDATE `input` SET date='$date', country1='$c11'  WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input'  ");
					$sql=mysql_real_escape_string("UPDATE `input` SET country1='$c11'  WHERE game_id='$gid' and team_id='$tid' and round='$round_for_input'  ");  
				//	$t=logs($user_for_logs,$_SESSION['id'],$sql,$result_input);
					$server_header=$_SERVER['REQUEST_URI'];
				//	header ("Location:$server_header");
				}
				
}	
// end drop in hr

	// main engine for Rnd inhouse
	//tech1
if (isset($_POST['allocated1']))
	{

	if ($_POST['allocated1']==-1)
		{
		//echo "unallocated1";
			
			$f11[3]=$f1;
			$avai_hours=$worker*$manday/$hrate-$f11[3]*$f11[1]-$f21[3]*$f21[1]-$f31[3]*$f31[1]-$f41[3]*$f41[1];
			for ($i=0; $i<=5; $i++) 
			{
			if ($i==0){$string=$f11[$i];}
			else{$string=$string.",".$f11[$i];}
			}	
			$c11['feature_tech1']=$string;

			$c1=base64_encode(serialize($c11));
			if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
			$res = mysql_query("SELECT country1  FROM input WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input' ");
				if( mysql_num_rows($res) == 1) 
				{
				$date = date('Y-m-d H:i:s');
				
				$result_input=mysql_query("UPDATE `input` SET country1='$c1', date='$date'  WHERE game_id='$gid' and team_id='$tid'  and player_id='$pid' and round='$round_for_input'  ");
					$sql=mysql_real_escape_string($result_input);  

					//$t=logs($_SESSION['username'],$_SESSION['id'],$sql,$result_input);
					$server_header=$_SERVER['REQUEST_URI'];
					header ("Location:$server_header");
				}
		}
		else
		{
		$allocated=$_POST['allocated1'];
		$avai_hours=$worker*$manday/$hrate-($f11[3]*$f11[1]+$f21[3]*$f21[1]+$f31[3]*$f31[1]+$f41[3]*$f41[1]);
		//echo"[".($f11[3]*$f11[1]+$f21[3]*$f21[1]+$f31[3]*$f31[1]+$f41[3]*$f41[1])."]";
		if ($avai_hours<$allocated) 
		{
		$allocated=$avai_hours;
		//echo "nho hon";
		}
		//echo "[".$avai_hours."/";
		//echo $allocated;
		$check=round($avai_hours-$allocated);
		//echo "bien kiem tra:".number_format($check)."]";
		if ($check==0) 
		{
		//echo "STOP";
		
		$allocated=0;
		}
		//echo "truoc allocated:".$f11[3]."<br>";
		//echo "con ton luc dau:".$avai_hours;
		$f11[3]=$f11[3]+($allocated)/$f11[1];
		//echo "sau allocated:".$f11[3]."<br>";
		$avai_hours=$worker*$manday/$hrate-$f11[3]*$f11[1]-$f21[3]*$f21[1]-$f31[3]*$f31[1]-$f41[3]*$f41[1];
		//echo "allocated:".$allocated."/".$avai_hours;
		//---- insert to input
			for ($i=0; $i<=5; $i++) 
		{
		 if ($i==0){$string=$f11[$i];}
		 else{$string=$string.",".$f11[$i];}
		}	
		$c11['feature_tech1']=$string;
		$c1=base64_encode(serialize($c11));
			if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
			$res = mysql_query("SELECT country1  FROM input WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input' ");
			if( mysql_num_rows($res) == 1) 
				{
				$date = date('Y-m-d H:i:s');
				
				$result_input=mysql_query("UPDATE `input` SET country1='$c1',date='$date'  WHERE game_id='$gid' and team_id='$tid'  and player_id='$pid' and round='$round_for_input'  ");
					$sql=mysql_real_escape_string($result_input);  
					
					//$t=logs($_SESSION['username'],$_SESSION['id'],$sql,$result_input);
					$server_header=$_SERVER['REQUEST_URI'];
					header ("Location:$server_header");
				}
			
		// end insert
		}
	}
	// end tech1
//	echo $c11['feature_tech3'];

	//tech2
if (isset($_POST['allocated2']))
	{

	if ($_POST['allocated2']==-1)
		{
		//echo "unallocated1";
			
			$f21[3]=$f2;
			$avai_hours=$worker*$manday/$hrate-$f11[3]*$f11[1]-$f21[3]*$f21[1]-$f31[3]*$f31[1]-$f41[3]*$f41[1];
			for ($i=0; $i<=5; $i++) 
			{
			if ($i==0){$string=$f21[$i];}
			else{$string=$string.",".$f21[$i];}
			}	
			$c11['feature_tech2']=$string;

			$c2=base64_encode(serialize($c11));
			if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
			$res = mysql_query("SELECT country1  FROM input WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input' ");
				if( mysql_num_rows($res) == 1) 
				{
				$date = date('Y-m-d H:i:s');
				
				$result_input=mysql_query("UPDATE `input` SET country1='$c2',date='$date'  WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input'  ");
					$sql=mysql_real_escape_string($result_input);  
					//$t=logs($_SESSION['username'],$_SESSION['id'],$sql,$result_input);
					$server_header=$_SERVER['REQUEST_URI'];
					header ("Location:$server_header");
				}
		}
		else
		{
		$allocated=$_POST['allocated2'];
		$avai_hours=$worker*$manday/$hrate-($f11[3]*$f11[1]+$f21[3]*$f21[1]+$f31[3]*$f31[1]+$f41[3]*$f41[1]);

		if ($avai_hours<$allocated) 
		{
		$allocated=$avai_hours;

		}

		$check=round($avai_hours-$allocated);
	
		if ($check==0) 
		{
		$allocated=0;
		}
		
		
		$f21[3]=$f21[3]+($allocated)/$f21[1];
		
		$avai_hours=$worker*$manday/$hrate-$f11[3]*$f11[1]-$f21[3]*$f21[1]-$f31[3]*$f31[1]-$f41[3]*$f41[1];
		
			for ($i=0; $i<=5; $i++) 
		{
		 if ($i==0){$string=$f21[$i];}
		 else{$string=$string.",".$f21[$i];}
		}	

		$c11['feature_tech2']=$string;
		
		$c2=base64_encode(serialize($c11));
			if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
			$res = mysql_query("SELECT country1  FROM input WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input' ");
			if( mysql_num_rows($res) == 1) 
				{
				$date = date('Y-m-d H:i:s');
				
				$result_input=mysql_query("UPDATE `input` SET country1='$c2',date='$date'  WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input'  ");
					$sql=mysql_real_escape_string($result_input);  
					//$t=logs($_SESSION['username'],$_SESSION['id'],$sql,$result_input);
					$server_header=$_SERVER['REQUEST_URI'];
					header ("Location:$server_header");
				}
			
		// end insert
		}
		
		
	// end post in-house rnd	
	}
	// end tech2
	
//tech3
if (isset($_POST['allocated3']))
	{

	if ($_POST['allocated3']==-1)
		{

			
			$f31[3]=$f3;
			$avai_hours=$worker*$manday/$hrate-$f11[3]*$f11[1]-$f21[3]*$f21[1]-$f31[3]*$f31[1]-$f41[3]*$f41[1];
			for ($i=0; $i<=5; $i++) 
			{
			if ($i==0){$string=$f31[$i];}
			else{$string=$string.",".$f31[$i];}
			}	
			$c11['feature_tech3']=$string;

			$c3=base64_encode(serialize($c11));
			if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}			
			$res = mysql_query("SELECT country1  FROM input WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input' ");
				if( mysql_num_rows($res) == 1) 
				{
				$date = date('Y-m-d H:i:s');

				$result_input=mysql_query("UPDATE `input` SET country1='$c3', date='$date'  WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input'  ");
					$sql=mysql_real_escape_string($result_input);  
					//$t=logs($_SESSION['username'],$_SESSION['id'],$sql,$result_input);
					$server_header=$_SERVER['REQUEST_URI'];
					header ("Location:$server_header");
				}
		}
		else
		{
		$allocated=$_POST['allocated3'];
		$avai_hours=$worker*$manday/$hrate-($f11[3]*$f11[1]+$f21[3]*$f21[1]+$f31[3]*$f31[1]+$f41[3]*$f41[1]);

		if ($avai_hours<$allocated) 
		{
		$allocated=$avai_hours;

		}

		$check=round($avai_hours-$allocated);
	
		if ($check==0) 
		{
		$allocated=0;
		}
		
		
		$f31[3]=$f31[3]+($allocated)/$f31[1];
		
		$avai_hours=$worker*$manday/$hrate-$f11[3]*$f11[1]-$f21[3]*$f21[1]-$f31[3]*$f31[1]-$f41[3]*$f41[1];
		
			for ($i=0; $i<=5; $i++) 
		{
		 if ($i==0){$string=$f31[$i];}
		 else{$string=$string.",".$f31[$i];}
		}	

		$c11['feature_tech3']=$string;
		
		$c3=base64_encode(serialize($c11));
			if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
			$res = mysql_query("SELECT country1  FROM input WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input' ");
			if( mysql_num_rows($res) == 1) 
				{
				$date = date('Y-m-d H:i:s');

				$result_input=mysql_query("UPDATE `input` SET country1='$c3', date='$date'  WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input'  ");
					$sql=mysql_real_escape_string($result_input);  
					//$t=logs($_SESSION['username'],$_SESSION['id'],$sql,$result_input);
					$server_header=$_SERVER['REQUEST_URI'];
					header ("Location:$server_header");
				}
			
		// end insert
		}
	}
	// end tech3	
//tech4
if (isset($_POST['allocated4']))
	{

	if ($_POST['allocated4']==-1)
		{

			
			$f41[3]=$f4;
			$avai_hours=$worker*$manday/$hrate-$f11[3]*$f11[1]-$f21[3]*$f21[1]-$f31[3]*$f31[1]-$f41[3]*$f41[1];
			for ($i=0; $i<=5; $i++) 
			{
			if ($i==0){$string=$f41[$i];}
			else{$string=$string.",".$f41[$i];}
			}	
			$c11['feature_tech4']=$string;

			$c4=base64_encode(serialize($c11));
			if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
			$res = mysql_query("SELECT country1  FROM input WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input' ");
				if( mysql_num_rows($res) == 1) 
				{
				$date = date('Y-m-d H:i:s');
				
				$result_input=mysql_query("UPDATE `input` SET country1='$c4' ,date='$date' WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input'  ");
					$sql=mysql_real_escape_string($result_input);  
					
					//$t=logs($_SESSION['username'],$_SESSION['id'],$sql,$result_input);
					$server_header=$_SERVER['REQUEST_URI'];
					header ("Location:$server_header");
				}
		}
		else
		{
		$allocated=$_POST['allocated4'];
		$avai_hours=$worker*$manday/$hrate-($f11[3]*$f11[1]+$f21[3]*$f21[1]+$f31[3]*$f31[1]+$f41[3]*$f41[1]);

		if ($avai_hours<$allocated) 
		{
		$allocated=$avai_hours;

		}

		$check=round($avai_hours-$allocated);
	
		if ($check==0) 
		{
		$allocated=0;
		}
		
		
		$f41[3]=$f41[3]+($allocated)/$f41[1];
		
		$avai_hours=$worker*$manday/$hrate-$f11[3]*$f11[1]-$f21[3]*$f21[1]-$f31[3]*$f31[1]-$f41[3]*$f41[1];
		
			for ($i=0; $i<=5; $i++) 
		{
		 if ($i==0){$string=$f41[$i];}
		 else{$string=$string.",".$f41[$i];}
		}	

		$c11['feature_tech4']=$string;
		
		$c4=base64_encode(serialize($c11));
			if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
			$res = mysql_query("SELECT country1  FROM input WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input' ");
			if( mysql_num_rows($res) == 1) 
				{
				$date = date('Y-m-d H:i:s');
				
				$result_input=mysql_query("UPDATE `input` SET country1='$c4',date='$date'  WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input'  ");
					$sql=mysql_real_escape_string("Update in house feature");  
					
					$t=logs($user_for_logs,$_SESSION['id'],$sql,$result_input);
					$server_header=$_SERVER['REQUEST_URI'];
					header ("Location:$server_header");
				}
			
		// end insert
		}
	}
	// end tech4	
	
	// engine stop
	
// Rnd for purchase
	
	
//$t_avai="1,0,0,0";
//$update_tech=mysql_query("UPDATE `output` SET tech='$t_avai'  WHERE game_id='$gid' and team_id='$tid' and round='$round'  ");
  if( $_GET['act']=='rnd')
  {

		

				$tech = mysql_query("SELECT tech FROM `output` where game_id='$gid' and team_id='$tid' and round='$round' and final='1'");
				$ctech = mysql_fetch_array($tech);
				$t= preg_split("/[\s,]+/",$ctech[0]);
				$tech_1= $t[0];
				$tech_2= $t[1];
				$tech_3= $t[2];
				$tech_4= $t[3];
				//echo $tech_2;
				
				
	// get cost tech
// get tech reduce rate
$result1 = mysql_query("SELECT rate_of_tech_price_reduce FROM game where id='$gid'");
$array = mysql_fetch_array($result1);
$rate_reduce=$array['rate_of_tech_price_reduce']/100;	
	
$result1 = mysql_query("SELECT country1 FROM round_assumption where game_id='$gid' and round='$round'");
$array = mysql_fetch_array($result1);
$cost_tech=$array['country1'];	
//echo $cost_tech."<br>";
$tech = preg_split("/[\s,]+/",$cost_tech);

$cost_t1=$tech[11]*(1-$rate_reduce*($round+1))*1000;
$cost_t2=$tech[12]*(1-$rate_reduce*($round+1))*1000;
$cost_t3=$tech[13]*(1-$rate_reduce*($round+1))*1000;
$cost_t4=$tech[14]*(1-$rate_reduce*($round+1))*1000;
//	echo $cost_t1."/".$cost_t2."/".$cost_t3."/".$cost_t4;
if (isset($_POST['buy_t1']))
	{
	$buyt1=$_POST['buy_t1'];
	$f11[4]=$buyt1;
	$f11[5]=$buyt1*$f11[2];
	if ($buyt1==0)
	{
	//------------update sale_feature to last round??or 0??
	$c11['sale_feature1']=$c10['salefeature1'];
	$c22['sale_feature1']=$c20['salefeature1'];
	$c33['sale_feature1']=$c30['salefeature1'];
	
			$b1=base64_encode(serialize($c11));
			$b2=base64_encode(serialize($c22));
			$b3=base64_encode(serialize($c33));
			if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
			$res = mysql_query("SELECT country1  FROM input WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input' ");
				if( mysql_num_rows($res) == 1) 
				{
				$date = date('Y-m-d H:i:s');
				
				$result_input=mysql_query("UPDATE `input` SET country1='$b1',country2='$b2',country3='$b3',date='$date'  WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input'  ");
					$sql=mysql_real_escape_string($result_input);  
					//$t=logs($_SESSION['username'],$_SESSION['id'],$sql,$result_input);
					$server_header=$_SERVER['REQUEST_URI'];
					header ("Location:$server_header");
				}
	//------------end update sale feature
	}
	//echo $f11[4];	
				for ($i=0; $i<=5; $i++) 
			{
			if ($i==0){$string=$f11[$i];}
			else{$string=$string.",".$f11[$i];}
			}	
			$c11['feature_tech1']=$string;

			$b1=base64_encode(serialize($c11));
			if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
			$res = mysql_query("SELECT country1  FROM input WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input' ");
				if( mysql_num_rows($res) == 1) 
				{
				$date = date('Y-m-d H:i:s');
				
				$result_input=mysql_query("UPDATE `input` SET country1='$b1',date='$date'  WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input'  ");
					$sql=mysql_real_escape_string($result_input);  
					//$t=logs($_SESSION['username'],$_SESSION['id'],$sql,$result_input);
					$server_header=$_SERVER['REQUEST_URI'];
					header ("Location:$server_header");
				}
				
	}	
	else
	{
	
	}
// engine for tech2	
if (isset($_POST['buy_t2']))
	{
	$buyt2=$_POST['buy_t2'];
	if ($buyt2>=0)
	{
	$f21[4]=$buyt2;
	if ($buyt2==0) 
	{
	$unlock=0;
		//------------update sale_feature to last round??or 0??
	$c11['sale_feature2']=$c10['salefeature2'];
	$c22['sale_feature2']=$c20['salefeature2'];
	$c33['sale_feature2']=$c30['salefeature2'];
	
			$b1=base64_encode(serialize($c11));
			$b2=base64_encode(serialize($c22));
			$b3=base64_encode(serialize($c33));
			if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
			$res = mysql_query("SELECT country1  FROM input WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input' ");
				if( mysql_num_rows($res) == 1) 
				{
				$date = date('Y-m-d H:i:s');
				
				$result_input=mysql_query("UPDATE `input` SET country1='$b1',country2='$b2',country3='$b3',date='$date'  WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input'  ");
					$sql=mysql_real_escape_string($result_input);  
					//$t=logs($_SESSION['username'],$_SESSION['id'],$sql,$result_input);
					$server_header=$_SERVER['REQUEST_URI'];
					header ("Location:$server_header");
				}
	//------------end update sale feature
	} 
	else {$unlock=$cost_t2;}
	$f21[5]=$buyt2*$f21[2]+$unlock;
	//echo $f11[4];	
				for ($i=0; $i<=5; $i++) 
			{
			if ($i==0){$string=$f21[$i];}
			else{$string=$string.",".$f21[$i];}
			}	
			$c11['feature_tech2']=$string;

			$b2=base64_encode(serialize($c11));
			if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
			$res = mysql_query("SELECT country1  FROM input WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input' ");
				if( mysql_num_rows($res) == 1) 
				{
				$date = date('Y-m-d H:i:s');
				
				$result_input=mysql_query("UPDATE `input` SET country1='$b2',date='$date'  WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input'  ");
				$sql=mysql_real_escape_string($result_input);  
					//$t=logs($_SESSION['username'],$_SESSION['id'],$sql,$result_input);
					$server_header=$_SERVER['REQUEST_URI'];
					header ("Location:$server_header");
				// update tech available
				
				}
	}
	
	}	
	else
	{
	}	
// engine for tech3
if (isset($_POST['buy_t3']))
	{
	$buyt3=$_POST['buy_t3'];
	if ($buyt3>=0)
	{
	$f31[4]=$buyt3;
	if ($buyt3==0) 
	{
	$unlock=0;
		//------------update sale_feature to last round??or 0??
	$c11['sale_feature3']=$c10['salefeature3'];
	$c22['sale_feature3']=$c20['salefeature3'];
	$c33['sale_feature3']=$c30['salefeature3'];
	
			$b1=base64_encode(serialize($c11));
			$b2=base64_encode(serialize($c22));
			$b3=base64_encode(serialize($c33));
			if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
			$res = mysql_query("SELECT country1  FROM input WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input' ");
				if( mysql_num_rows($res) == 1) 
				{
				$date = date('Y-m-d H:i:s');
				
				$result_input=mysql_query("UPDATE `input` SET country1='$b1',country2='$b2',country3='$b3',date='$date'  WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input'  ");
					$sql=mysql_real_escape_string($result_input);  
					//$t=logs($_SESSION['username'],$_SESSION['id'],$sql,$result_input);
					$server_header=$_SERVER['REQUEST_URI'];
					header ("Location:$server_header");
				}
	//------------end update sale feature
	} else {$unlock=$cost_t3;}
	$f31[5]=$buyt3*$f31[2]+$unlock;
	//echo $f11[4];	
				for ($i=0; $i<=5; $i++) 
			{
			if ($i==0){$string=$f31[$i];}
			else{$string=$string.",".$f31[$i];}
			}	
			$c11['feature_tech3']=$string;

			$b3=base64_encode(serialize($c11));
			if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
			$res = mysql_query("SELECT country1  FROM input WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input' ");
				if( mysql_num_rows($res) == 1) 
				{
				$date = date('Y-m-d H:i:s');
				
				$result_input=mysql_query("UPDATE `input` SET date='$date', country1='$b3'  WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input'  ");
				$sql=mysql_real_escape_string($result_input);  
					//$t=logs($_SESSION['username'],$_SESSION['id'],$sql,$result_input);
					$server_header=$_SERVER['REQUEST_URI'];
					header ("Location:$server_header");
				}
	}
	
	}	
	else
	{
	
	}			
// engine for tech4
if (isset($_POST['buy_t4']))
	{
	$buyt4=$_POST['buy_t4'];
	if ($buyt4>=0)
	{
	$f41[4]=$buyt4;
	if ($buyt4==0) 
	{
	$unlock=0;
		//------------update sale_feature to last round??or 0??
	$c11['sale_feature4']=$c10['salefeature4'];
	$c22['sale_feature4']=$c20['salefeature4'];
	$c33['sale_feature4']=$c30['salefeature4'];
	
			$b1=base64_encode(serialize($c11));
			$b2=base64_encode(serialize($c22));
			$b3=base64_encode(serialize($c33));
			if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
			$res = mysql_query("SELECT country1  FROM input WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input' ");
				if( mysql_num_rows($res) == 1) 
				{
				$date = date('Y-m-d H:i:s');
				
				$result_input=mysql_query("UPDATE `input` SET country1='$b1',country2='$b2',country3='$b3',date='$date'  WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input'  ");
					$sql=mysql_real_escape_string($result_input);  
					//$t=logs($_SESSION['username'],$_SESSION['id'],$sql,$result_input);
					$server_header=$_SERVER['REQUEST_URI'];
					header ("Location:$server_header");
				}
	//------------end update sale feature
	} else {$unlock=$cost_t4;}
	$f41[5]=$buyt4*$f41[2]+$unlock;
	//echo $f11[4];	
				for ($i=0; $i<=5; $i++) 
			{
			if ($i==0){$string=$f41[$i];}
			else{$string=$string.",".$f41[$i];}
			}	
			$c11['feature_tech4']=$string;

			$b4=base64_encode(serialize($c11));
			if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
			$res = mysql_query("SELECT country1  FROM input WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input' ");
				if( mysql_num_rows($res) == 1) 
				{
				$date = date('Y-m-d H:i:s');
				
				$result_input=mysql_query("UPDATE `input` SET date='$date', country1='$b4'  WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input'  ");
				$sql=mysql_real_escape_string("Buy feature/technology successful");  
				//update marketing
				
					$t=logs($user_for_logs,$_SESSION['id'],$sql,$result_input);
					$server_header=$_SERVER['REQUEST_URI'];
					header ("Location:$server_header");
				}
	}
	
	}	
	else
	{
	
	}	

	//--------------------------------------- tech 1
	if 	($f11[3]-floor($f11[3])>0) 
	{
	$remain=$f11[3]-floor($f11[3]);
	
	}
	else
	{
	$remain=1;
	}
	//	echo "<br> con lai".$remain;
	
	echo"<tr><td><b>".$LANG['tech_1']."</b></td>";
		//echo "<td>".($f11[0]+$f11[4])." features</td>";
	echo "<td>".floor($f11[3])." ".$LANG['features']."</td>";
		echo"<td  class=demo><select style='width:100%;' name='allocated1' onchange='this.form.submit()'>";
		echo"<option value=0> </option>";	
		if ($f11[1]*$remain<=$avai_hours) 
		{
		$a=$f11[1]*$remain;
		echo"<option ".$s." value=".$a.">".number_format($a)." ".$LANG['hour']."</option>";		
		$short1="<font color=green>";
		$shortno=$f21[1]*$remain-$avai_hours;
		$short2="</font>";
		
		}
		else
		{
		$short1="<font color=red>(";
		$shortno=$f21[1]*$remain-$avai_hours;
		$short2=")</font>";
		echo"<option selected value=0>".$LANG['insufficient']."</option>";	
		}
	    
		echo"<option value=-1><i>".$LANG['unallocated']." </i></option>";	
		echo"</select>";
		echo"</td>";	
	echo"<td>".number_format($f11[1]*$f11[3])." ".$LANG['hour']."</td>";
	echo"<td>".number_format($f11[1]*($remain))." ".$LANG['hour']." | ".$short1.number_format(abs($shortno)).$short2."</td>";
	echo"<td><dl class='rate'><dd class='new' style='width:".(($f11[3]+$f11[4])/15*100)."%'></dd></dl></td>";	
	echo"</tr>";	
// ------------------------------------end tech1	
// ------------------------------------begin tech 2
	if 	($f21[3]-floor($f21[3])>0) 
	{
	$remain=$f21[3]-floor($f21[3]);
	}
	else
	{
	$remain=1;
	}
		
	echo"<tr><td><b>".$LANG['tech_2']."</b></td>";
	//echo "<td>".$f21[0]." features</td>";
	echo "<td>".floor($f21[3])." ".$LANG['features']."</td>";
		echo"<td  class=demo><select style='width:100%;' name='allocated2' onchange='this.form.submit()'>";
		echo"<option value=0></option>";
		if ($f21[1]*$remain<=$avai_hours) {$a=$f21[1]*$remain;
		echo"<option value=".$a.">".number_format($a)." ".$LANG['hour']."</option>";		
		
		$short1="<font color=green>";
		$shortno=$f21[1]*$remain-$avai_hours;
		$short2="</font>";
		
		}
		else
		{
		$short1="<font color=red>(";
		$shortno=$f21[1]*$remain-$avai_hours;
		$short2=")</font>";
		echo"<option selected value=0>".$LANG['insufficient']."</option>";	
		}		
	    echo"<option value=-1><i>".$LANG['unallocated']." </i></option>";	
		echo"</select>";
		echo"</td>";	
	echo"<td>".number_format($f21[1]*$f21[3])." ".$LANG['hour']."</td>";
	echo"<td>".number_format($f21[1]*$remain)." ".$LANG['hour']." | ".$short1.number_format(abs($shortno)).$short2."</td>";
	echo"<td><dl class='rate'><dd class='new' style='width:".(($f21[3]+$f21[4])/15*100)."%'></dd></dl></td>";		
	echo"</tr>";	
// ------------------------------------end tech2
// ------------------------------------begin tech 3
	if 	($f31[3]-floor($f31[3])>0) 
	{
	$remain=$f31[3]-floor($f31[3]);
	}
	else
	{
	$remain=1;
	}
	
	echo"<tr><td><b>".$LANG['tech_3']."</b></td>";
	//echo "<td>".$f31[0]." features</td>";
	echo "<td>".floor($f31[3])." ".$LANG['features']."</td>";
		echo"<td  class=demo><select style='width:100%;' name='allocated3' onchange='this.form.submit()'>";
		echo"<option value=0></option>";
				if ($f31[1]*$remain<$avai_hours) {$a=$f31[1]*$remain;
		echo"<option value=".$a.">".number_format($a)." ".$LANG['hour']."</option>";		
		$short1="<font color=green>";
		$shortno=$f21[1]*$remain-$avai_hours;
		$short2="</font>";
		
		}
		else
		{
		$short1="<font color=red>(";
		$shortno=$f21[1]*$remain-$avai_hours;
		$short2=")</font>";
		echo"<option selected value=0>".$LANG['insufficient']."</option>";	
		}		
	    echo"<option value=-1><i>".$LANG['unallocated']." </i></option>";	
		echo"</select>";
		echo"</td>";	
	echo"<td>".number_format($f31[1]*$f31[3])." ".$LANG['hour']."</td>";	
	echo"<td>".number_format($f31[1]*$remain)." ".$LANG['hour']." | ".$short1.number_format(abs($shortno)).$short2."</td>";
	echo"<td><dl class='rate'><dd class='new' style='width:".(($f31[3]+$f31[4])/15*100)."%'></dd></dl></td>";		
	echo"</tr>";	
// ------------------------------------end tech3
// ------------------------------------begin tech 4
	if 	($f41[3]-floor($f41[3])>0) 
	{
	$remain=$f41[3]-floor($f41[3]);
	}
	else
	{
	$remain=1;
	}
		
	echo"<tr><td><b>".$LANG['tech_4']."</b></td>";
	//echo "<td>".($f41[0]+$f41[4])." features</td>";
	echo "<td>".floor($f41[3])." ".$LANG['features']."</td>";
		echo"<td  class=demo><select style='width:100%;' name='allocated4' onchange='this.form.submit()'>";
		echo"<option value=0> </option>";
		if ($f41[1]*$remain<$avai_hours) {$a=$f41[1]*$remain;
		echo"<option value=".$a.">".number_format($a)." ".$LANG['hour']."</option>";		
		$short1="<font color=green>";
		$shortno=$f21[1]*$remain-$avai_hours;
		$short2="</font>";
		
		}
		else
		{
		$short1="<font color=red>(";
		$shortno=$f21[1]*$remain-$avai_hours;
		$short2=")</font>";
		echo"<option selected value=0>".$LANG['insufficient']."</option>";
		}		
	    echo"<option value=-1><i>".$LANG['unallocated']." </i></option>";	
		echo"</select>";
		echo"</td>";	
	echo"<td>".number_format($f41[1]*$f41[3])." ".$LANG['hour']."</td>";
	echo"<td>".number_format($f41[1]*$remain)." ".$LANG['hour']." | ".$short1.number_format(abs($shortno)).$short2."</td>";
	echo"<td><dl class='rate'><dd class='new' style='width:".(($f41[3]+$f41[4])/15*100)."%'></dd></dl></td>";		
	echo"</tr>";	
// ------------------------------------end tech4
	// total available research hours
	echo"<tr><td colspan=5><b>".$LANG['totalresearch']."</b></td><td>".number_format($worker)."</td></tr>";
	
	echo"<tr><td colspan=5><b>".$LANG['totalresearchallocated']."</b></td><td>".number_format(($worker*$manday)/$hrate-$avai_hours)." ".$LANG['hour']."</td></tr>";
	echo"<tr><td colspan=5><b>".$LANG['totalresearchavailable']."</b></td><td>".number_format(round($avai_hours,0))." ".$LANG['hour']."</td></tr>";
			    
				echo"<input type=hidden name='round' value='".$round_for_input."'/>";
				echo"<input type=hidden name='game_id' value='".$gid."'/>";
				echo"<input type=hidden name='team_id' value='".$tid."'/>";
				echo"<input type=hidden name='feature' value='1'/>";
echo"</form></table>";
} 


echo"<br><h4>".$LANG['buyingnewtech']."</h4>";	
if ($overtime==0){echo"<form action='game.php?act=rnd&tid=".$tid."&id=".$gid."' class=demo method='POST'>";	}
echo"<table>";
echo"<th width=15%>".$LANG['technology']."</th><th width=15%>".$LANG['nooffeature']."</th><th width=25%>".$LANG['buyingtech']."</th><th>".$LANG['Cost']."</th><th width=15%>".$LANG['totalfeaturethisround']."</th>";
// tech1
echo"<tr><td><b>".$LANG['tech_1']."</b></td>";
echo"<td>".($f1+$f11[4])." ".$LANG['features']."</td>";
echo"<td class=demo>";
echo"<select style='width:100%;' onchange='this.form.submit()' name='buy_t1' >";
if ($tech_1==0)
	{	
	
		$unlock=$cost_t1;
		$title=$LANG['unlocktech1'];
	}
	else
	{
	$unlock=0;
	$title="";
	}
$f=15-$f11[3]; 
 for ($x=0; $x<=$f; $x++) 
{

if ($x==$buyt1) {$s="selected";} else {$s="";}
if ($x==0)
{
echo"<option ".$s." value=".$x."></option>";
}
else
{
echo"<option ".$s." value=".$x."> ".$title." + ".$x." ".$LANG['features']."</option>";
}
}
echo"</select>";
echo"</td>";
if ($buyt1==0) {$unlock=0;}
if ($buyt1>0) {$cost1=$f11[2]*$buyt1+$unlock;} else {$cost1=$unlock;}

echo"<td>US$ ".number_format($cost1)."</td>";
echo"<td><dl class='rate'><dd class='new' style='width:".($f11[4]/15*100)."%'></dd></dl></td>";
echo"</tr>";
//end tech1
// tech2
echo"<tr><td><b>".$LANG['tech_2']."</b></td>";
echo"<td>".($f2+$f21[4])." ".$LANG['features']."</td>";
echo"<td class=demo>";
echo"<select style='width:100%;' onchange='this.form.submit()' name='buy_t2' >";
if ($tech_2==0)
	{	
		$unlock=$cost_t2;
		$title=$LANG['unlocktech2'];
	}
	else
	{
	$unlock=0;
	$title="";
	}
$f=15-$f21[3]; 
 for ($x=0; $x<=$f; $x++) 
{

if ($x==$buyt2) {$s="selected";} else {$s="";}
if ($x==0)
{
echo"<option ".$s." value=".$x."></option>";
}
else
{
echo"<option ".$s." value=".$x."> ".$title." + ".$x." ".$LANG['features']."</option>";
}
}
echo"</select>";
echo"</td>";
if ($buyt2==0) {$unlock=0;}
if ($buyt2>0) {$cost2=$f21[2]*$buyt2+$unlock;} else {$cost2=$unlock;}


echo"<td>US$ ".number_format($cost2)."</td>";
echo"<td><dl class='rate'><dd class='new' style='width:".($f21[4]/15*100)."%'></dd></dl></td>";
echo"</tr>";
//end tech2

// tech3
echo"<tr><td><b>".$LANG['tech_3']."</b></td>";
echo"<td>".($f3+$f31[4])." ".$LANG['features']."</td>";
echo"<td class=demo>";
echo"<select style='width:100%;' onchange='this.form.submit()' name='buy_t3' >";
if ($tech_3==0)
	{	
		$unlock=$cost_t3;
		$title=$LANG['unlocktech3'];
	}
	else
	{
	$unlock=0;
	$title="";
	}
$f=15-$f31[3]; 
 for ($x=0; $x<=$f; $x++) 
{

if ($x==$buyt3) {$s="selected";} else {$s="";}
if ($x==0)
{
echo"<option ".$s." value=".$x."></option>";
}
else
{
echo"<option ".$s." value=".$x."> ".$title." + ".$x." ".$LANG['features']."</option>";
}
}
echo"</select>";
echo"</td>";
if ($buyt3==0) {$unlock=0;}
if ($buyt3>0) {$cost3=$f31[2]*$buyt3+$unlock;} else {$cost3=$unlock;}


echo"<td>US$ ".number_format($cost3)."</td>";
echo"<td><dl class='rate'><dd class='new' style='width:".($f31[4]/15*100)."%'></dd></dl></td>";
echo"</tr>";
//end tech3


// tech4
echo"<tr><td><b>".$LANG['tech_4']."</b></td>";
echo"<td>".($f4+$f41[4])." ".$LANG['features']."</td>";
echo"<td class=demo>";
echo"<select style='width:100%;' onchange='this.form.submit()' name='buy_t4' >";
if ($tech_4==0)
	{	
		$unlock=$cost_t4;
		$title=$LANG['unlocktech4'];
	}
	else
	{
	$unlock=0;
	$title="";
	}
$f=15-$f41[3]; 
 for ($x=0; $x<=$f; $x++) 
{
//	echo $buyt4;
if ($x==$buyt4) {$s="selected";} else {$s="";}
if ($x==0)
{
echo"<option ".$s." value=".$x."></option>";
}
else
{
echo"<option ".$s." value=".$x."> ".$title." + ".$x." ".$LANG['features']."</option>";
}
}
echo"</select>";
echo"</td>";
if ($buyt4==0) {$unlock=0;}
if ($buyt4>0) {$cost4=$f41[2]*$buyt4+$unlock;} else {$cost4=$unlock;}


echo"<td>US$ ".number_format($cost4)."</td>";
echo"<td><dl class='rate'><dd class='new' style='width:".($f41[4]/15*100)."%'></dd></dl></td>";
echo"</tr>";
//end tech4
echo"<tr><td colspan=4><b>".$LANG['totalcost']."</b></td><td><b> US$  ".number_format($cost1+$cost2+$cost3+$cost4)."</b></td></tr>";
echo"</table>";
				echo"<input type=hidden name='round' value='".$round_for_input."'/>";
				echo"<input type=hidden name='game_id' value='".$gid."'/>";
				echo"<input type=hidden name='team_id' value='".$tid."'/>";
				echo"<input type=hidden name='buy' value='1'/>";
echo"</form>";

}




	// -------------- end RnD
	
	// --------------- start investment
	
	  if( $_GET['act']=='investment')
  {
  
 if($_SESSION['mod']==1 or $_SESSION['admin']==1 )
 {
  $gid=$_GET['gid'] ;
 $tid=$_GET['tid'] ;
 } else 
 {
  $gid=$_SESSION['game_id'] ;
 $tid=$_SESSION['team_id'] ;
 }
 //--------------------------- check time
 
 $checktime=checktime($gid,$tid);
 echo $checktime;
  
 //--------------------------- end check time
  // get round
	$res_round = mysql_query("SELECT max(round) FROM output where game_id='$gid' and team_id='$tid' and final='1' ");
	$array_round = mysql_fetch_array($res_round);
	$round=$array_round[0];
	$round_for_input=$round+1;
	// get practice round
$game = mysql_query("SELECT practice_round FROM `game` where id='$gid'");
$hpr = mysql_fetch_array($game);
$pround=$hpr['practice_round'];
if ($round==$pround) {$round=0;} 
  // get cap per plant
   $result1 = mysql_query("SELECT country1, cap_per_plant FROM round_assumption where game_id='$gid' and round=$round");
   $array = mysql_fetch_array($result1);
   $cap_per_plant=$array['cap_per_plant'];	
   $cost_per_plant=$array['country1'];	
   $cost_per_plant= preg_split("/[\s,]+/",$cost_per_plant);
   $cost_plant=$cost_per_plant[22]*1000000;
   
   // get number of factory				
   $result2 = mysql_query("SELECT factory,next_factory FROM output where game_id='$gid' and team_id='$tid' and round='$round' and final='1'");
   $array2 = mysql_fetch_array($result2);
   $no_fac2=$array2['factory'];	
   $factory2=unserialize($no_fac2);
   $fac_c1=$factory2['c1'];
   $fac_c2=$factory2['c2'];
   $no_nextfac=$array2['next_factory'];	
   $no_nextfac=preg_split("/[\s,]+/",$no_nextfac);
   $plant_next_round1=$no_nextfac[0];
   $plant_next_round2=$no_nextfac[1];
   
   $current_cap1=$fac_c1*$cap_per_plant+$fac_c2*$cap_per_plant;
   // get depreciation rate
   $result1 = mysql_query("SELECT depreciation_rate,no_of_teams FROM game where id='$gid'");
   $array = mysql_fetch_array($result1);
   $dep_rate=$array['depreciation_rate'];
   $teams=$array['no_of_teams'];
   // get current demand
   

				  // get last round demand production
				$dlr = mysql_query("SELECT demand_c1,demand_c2,demand_c3, output_c1 FROM `output` where game_id='$gid' and team_id='$tid' and round='$round' and final='1'");
				$der = mysql_fetch_array($dlr);
				// get country 1/2/3
				$dmd_c1=$der['demand_c1']; 				
				$dmd_c2=$der['demand_c2'];
				$dmd_c3=$der['demand_c3']; 	
				
				
				$total_d=$dmd_c1+$dmd_c2+$dmd_c3; 
 //	GET value of investment from last round to carry on this round	
 if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
 $res = mysql_query("SELECT investment_c2,investment_c1  FROM input WHERE game_id='$gid' and team_id='$tid' and player_id='$pid'  and round='$round_for_input' ");
 				if( mysql_num_rows($res) == 1) 
				{
 $invest = mysql_fetch_array($res);
 				$invest1=$invest['investment_c1']; 
				//echo $invest1;
				$invest1= preg_split("/[\s,]+/",$invest1);
				$invest2=$invest['investment_c2']; 
				$invest2= preg_split("/[\s,]+/",$invest2);
				//echo $invest1[0];
				//$plant_next_round1=$invest1[1];
				//$plant_next_round2=$invest2[1];
				//if ($round-$time)
				$c2_plant=$invest2[0];
				$cost2=$c2_plant*$cost_plant;
				$c1_plant=$invest1[0];
				$cost1=$c1_plant*$cost_plant;				
				}
				else
				{
$c1_plant=0;
$cost1=0;
$c2_plant=0;
$cost2=0;

				}

 
 
 // engine
 //for country1	
	  if( isset($_POST['c1_plant']))
  {
  $c1_plant=$_POST['c1_plant'];
	if ($c1_plant<0)
	{
  $cost1=-$c1_plant*$cost_plant*(1-$dep_rate/100*$round_for_input);
	}
	 if ($c1_plant>=0)
	{
  $cost1=-$c1_plant*$cost_plant;
	}
	
  // update to input
  $invest_c1=$c1_plant.",".$plant_next_round1;
  if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
			$res = mysql_query("SELECT investment_c1  FROM input WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input' ");
				if( mysql_num_rows($res) == 1) 
				{
				$date = date('Y-m-d H:i:s');
				
				$result_input=mysql_query("UPDATE `input` SET investment_c1='$invest_c1',date='$date'  WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input'  ");
				$sql=mysql_real_escape_string("UPDATE `input` SET investment_c1='$invest_c1'  WHERE game_id='$gid' and team_id='$tid' and round='$round_for_input'  ");  
					$t=logs($user_for_logs,$_SESSION['id'],$sql,$result_input);
					$server_header=$_SERVER['REQUEST_URI'];
					header ("Location:$server_header");
				//echo $result_input;
				}  
  }
  else
  {
  //$c1_plant=0;
  //$cost1=0;
  }
 // for country2
	  if( isset($_POST['c2_plant']))
  {
  $c2_plant=$_POST['c2_plant'];
	if ($c2_plant<0)
	{
  $cost2=-$c2_plant*$cost_plant*(1-$dep_rate/100*$round_for_input);
	}
	 if ($c2_plant>=0)
	{
  $cost2=-$c2_plant*$cost_plant;
	}
	
  // update to input
  $invest_c2=$c2_plant.",".$plant_next_round2;
  if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
			$res = mysql_query("SELECT investment_c2  FROM input WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input' ");
				if( mysql_num_rows($res) == 1) 
				{
				$date = date('Y-m-d H:i:s');
				
				$result_input=mysql_query("UPDATE `input` SET investment_c2='$invest_c2',date='$date'  WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input'  ");
				$sql=mysql_real_escape_string("UPDATE `input` SET investment_c2='$invest_c2'  WHERE game_id='$gid' and team_id='$tid' and round='$round_for_input'  ");  
					$t=logs($user_for_logs,$_SESSION['id'],$sql,$result_input);
					$server_header=$_SERVER['REQUEST_URI'];
					header ("Location:$server_header");
				}  
  }
  else
  {
  //$c2_plant=0;
  //$cost2=0;
  } 
 // engine for tool 
 	  if( isset($_POST['growth']))
  {
  $growth=$_POST['growth'];

  }
  else
  {
  $growth=100/$teams;
  }
  	  if( isset($_POST['marketshare']))
  {
  $marketshare=$_POST['marketshare'];

  }
  else
  {
  $marketshare=25;
  } 
  echo"<h4>".$LANG['investment']."</h4>";
 if ($overtime==0){ echo"<form action='game.php?act=investment&tid=".$tid."&id=".$gid."' method='POST'>";			}
  echo"<table>";
  echo"<th>".$LANG['country']."</th><th>".$LANG['capperplant']."</th><th>".$LANG['noofplant']."</th><th>".$LANG['plantavainext']."</th><th>".$LANG['newplant']."</th><th>".$LANG['cashinout']."</th><th>".$LANG['roundcomplete']."</th>";
//for country1  
  echo"<tr><td><b>".$LANG['1']."</b></td>";
  echo"<td>".number_format($cap_per_plant)."</td>";
  echo"<td>".number_format($fac_c1)."</td>";
    echo"<td>".number_format($plant_next_round1)."</td>";
  echo"<td class=demo><select style='width:100%;' onchange='this.form.submit()' name='c1_plant' >";

  for ($x=-$fac_c1; $x<=50; $x++) 
{

if($x==$c1_plant) {$s="selected";} else {$s="";}
if ($x<0) {$title=$LANG['divest'];} else {$title=$LANG['invest'];}

echo"<option ".$s." value=".$x."> ".$title." ".abs($x)." ".$LANG['plant']."</option>";
}
echo"</select></td>";

if ($cost1<0) {$class="neg";} else {$class="pos";}
echo"<td class='$class'>US$ ".number_format(abs($cost1))."</td>";

echo"<td>".$LANG['Round']." ". ($round_for_input+1)."</td>";
  echo"</tr>";
//for country2  
  echo"<tr><td><b>".$LANG['2']."</b></td>";
  echo"<td>".number_format($cap_per_plant)."</td>";
  echo"<td>".number_format($fac_c2)."</td>";
  echo"<td>".number_format($plant_next_round2)."</td>";
  echo"<td class=demo><select style='width:100%;' onchange='this.form.submit()' name='c2_plant' >";

  for ($x=-$fac_c2; $x<=50; $x++) 
{

if($x==$c2_plant) {$s="selected";} else {$s="";}
if ($x<0) {$title=$LANG['divest'];} else {$title=$LANG['invest'];}

echo"<option ".$s." value=".$x."> ".$title." ".abs($x)." ".$LANG['plant']."</option>";
}
echo"</select></td>";

if ($cost2<0) {$class="neg";} else {$class="pos";}
echo"<td class='$class'>US$ ".number_format(abs($cost2))."</td>";

echo"<td>".$LANG['Round']." ". ($round_for_input+1)."</td>";
  echo"</tr>";
// end   
  echo"</table></form>";
  
  echo"<br><h4>".$LANG['investmentdecisiontool']."</h4>";
 if ($overtime==0){ echo"<form action='game.php?act=investment&tid=".$tid."&id=".$gid."' method='POST'>";		}
  echo"<table>";
  echo"<th>".$LANG['currentdemand']."</th><th>".$LANG['expectedavggrowth']."</th><th>".$LANG['expectedmarketshare']."</th><th>".$LANG['currentcap']."</th><th>".$LANG['shortageofplant']."</th><th width=15%>".$LANG['currentvsexpected']."</th>";
  echo"<tr><td>".number_format($total_d)." ".$LANG['units']."</td>";
 //growth 
  echo"<td class=demo><select style='width:100%;' onchange='this.form.submit()' name='growth' >";
  for ($x=-100; $x<=100; $x++) 
{
if($x==$growth) {$s="selected";} else {$s="";}
echo"<option ".$s." value=".$x.">".$x." %</option>";
}
echo"</select></td>";
// marketshare
  echo"<td class=demo><select style='width:100%;' onchange='this.form.submit()' name='marketshare' >";
  for ($x=0; $x<=100; $x++) 
{
if($x==$marketshare) {$s="selected";} else {$s="";}
echo"<option  " .$s. " value=".$x.">".$x." %</option>";
}
echo"</select></td>";
echo"<td>".number_format($current_cap1)."</td>";
$power=pow((1+$growth/100),3);
$expected_demand=($total_d*$power)*$marketshare/100;
$ratio=($current_cap1+($c1_plant+$c2_plant)*$cap_per_plant)/$expected_demand*100;
//echo $total_d;
if ($ratio>100) {$ratio=99;}
$short=$current_cap1-$expected_demand;
if ($short<0) {$class="neg";} else {$class="pos";}
if ($short>0) {$short=0;}
echo"<td class=$class><b>".number_format(abs($short/$cap_per_plant))." ".$LANG['factory']."</b></td>";
echo"<td><dl class='rate' style='width:100%'><dd class='new' style='width:".$ratio."%'></dd></dl></td>";
  echo"</tr>";
  echo"</table></form>";
  
  
  echo"<br><table>";
  echo"<th>".$LANG['estimation']."</th>";
 for ($x=1; $x<=8; $x++) 
{ 
  echo"<th> ".$LANG['Round']." ".($round+$x)."</th>";
} 
 echo"<tr><td>".$LANG['expectdemand']."</td>";
 //echo $growth."/".$marketshare;
    for ($x=1; $x<=8; $x++) 
{
$power=pow((1+$growth/100),$x);
//echo "<".$power.">";
 $expected_demand=($total_d*$power)*$marketshare/100;
  echo"<td>".number_format($expected_demand)."</td>";
} 

 echo"</tr>";
 echo"<tr><td>".$LANG['expectcap']."</td>";
 $pnr=($plant_next_round2+$plant_next_round1)*$cap_per_plant;
 echo"<td>".number_format($current_cap1)."</td>";
 echo"<td>".number_format($current_cap1+$pnr)."</td>";
 $new_plant_cap=($c1_plant+$c2_plant)*$cap_per_plant;
 
     for ($x=3; $x<=8; $x++) 
{
 echo"<td>".number_format($current_cap1+$new_plant_cap+$pnr)."</td>";
} 
 echo"</tr></table>";

  }
	
	// ------------------end investment
 
	// --------------- start marketing
	  if( $_GET['act']=='marketing' or $_GET['act']=='finance')
  {	
 
 
 $gid=$_SESSION['game_id'];
 $tid=$_SESSION['team_id'] ;
 //--------------------------- check time
 
 $checktime=checktime($gid,$tid);
 echo $checktime;
  
 //--------------------------- end check time
 // GET value
// get round
	$res_round = mysql_query("SELECT max(round) FROM output where game_id='$gid' and team_id='$tid' and final='1' ");
	$array_round = mysql_fetch_array($res_round);
	$round=$array_round[0];
	$round_for_input=$round+1;
	// get practice round
$game = mysql_query("SELECT practice_round, no_of_rounds FROM `game` where id='$gid'");
$hpr = mysql_fetch_array($game);
$pround=$hpr['practice_round'];
$rounds=$hpr['no_of_rounds'];
if ($round==$pround) {$round=0;} 
if ($round_for_input>$rounds) {$round_for_input=$round;}
// get logistic cost
				$result1 = mysql_query("SELECT country1 FROM round_assumption where game_id='$gid' and round=$round_for_input");
				$array = mysql_fetch_array($result1);
				$logis=$array['country1'];	
				
				$lo= preg_split("/[\s,]+/",$logis);
				$l_c1_c2=$lo[17];
				$l_c2_c1=$lo[18];
				$l_c1_c3=$lo[19];
				$l_c2_c3=($l_c1_c2+$l_c2_c1+$l_c1_c3)/3;
				
				
  
  // get last round demand production
				$dlr = mysql_query("SELECT demand_c1,demand_c2,demand_c3, output_c1 FROM `output` where game_id='$gid' and team_id='$tid' and round='$round'");
				$der = mysql_fetch_array($dlr);
				// get country 1/2/3
				$dmd_c1=$der['demand_c1']; 				
				$dmd_c2=$der['demand_c2'];
				$dmd_c3=$der['demand_c3']; 	
				$total_demand0=$dmd_c1+$dmd_c2+$dmd_c3;
				//get share price/outstanding
				$sharep=$der['output_c1'];	
				$sharep= preg_split("/[\s,]+/",$sharep);
				$shareprice=$sharep[43];
				$shareout=$sharep[42];
				//$shareout=$sharep[41];
				//echo $shareout;
				//echo $shareout."/".$shareprice;
				
  // get this round production
				
  // get current production
  
if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
   				$dnp1 = mysql_query("SELECT id,country1,country2,country3, logistic_order_c1,logistic_order_c2, transfer_price, fin_dividends, fin_shareissue, fin_longterm_debt, fin_internal_loan_c1_c2, fin_internal_loan_c1_c3,fin_internal_loan_c3_c1,fin_internal_loan_c2_c1 FROM `input` where game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input'");
				$rw1 = mysql_fetch_array($dnp1);
				// get transfer price
				$tp=$rw1['transfer_price']; 
				$input_id=$rw1['id']; 
				$tp=preg_split("/[,]+/",$tp);
				$tp12=$tp[0];
				$tp13=$tp[1];
				$tp21=$tp[2];
				$tp23=$tp[3];
				// get logistic order
				$logis1=$rw1['logistic_order_c1']; 		
				$logis2=$rw1['logistic_order_c2']; 	
				$logis1=preg_split("/[,]+/",$logis1);	
				$logis2=preg_split("/[,]+/",$logis2);			
				$dividends=$rw1['fin_dividends'];
				$shareissue=$rw1['fin_shareissue'];
				$longtermdebt=$rw1['fin_longterm_debt'];
				$internalloan12=$rw1['fin_internal_loan_c1_c2'];
				$internalloan13=$rw1['fin_internal_loan_c1_c3'];
				$internalloan31=$rw1['fin_internal_loan_c3_c1'];
				$internalloan21=$rw1['fin_internal_loan_c2_c1'];
				
//echo $dividends;
// for country1/2 tech 1/2
$lo11=$logis1[0];
$lo12=$logis1[1];
$lo13=$logis1[2];
$lo14=$logis1[3];

$lo21=$logis2[0];
$lo22=$logis2[1];
$lo23=$logis2[2];
$lo24=$logis2[3];
//-------				
				// get country 1/2/3
				$c1=$rw1['country1']; 
				//echo "[".$c1."]";
				$country1=unserialize(base64_decode($c1));
				//echo $country1;
				$c2=$rw1['country2']; 
				$country2=unserialize(base64_decode($c2));
				$c3=$rw1['country3']; 
				$country3=unserialize(base64_decode($c3));
				
				$ct1=$country1;
				$ct2=$country2;
				$ct3=$country3;
				
	// ---------------------- for feature research tech
// get tech rate reduce					
$result1 = mysql_query("SELECT rate_of_tech_price_reduce, share_face_value,share_capital,min_cash FROM game where id='$gid'");
$array = mysql_fetch_array($result1);
$rate_reduce=$array['rate_of_tech_price_reduce']/100;						
$sharefv=$array['share_face_value'];
$sharecapital=$array['share_capital'];
$mincash=$array['min_cash'];
					
//get tech cost					
$result1 = mysql_query("SELECT country1 FROM round_assumption where game_id='$gid' and round=$round");
$array = mysql_fetch_array($result1);
$cost_tech=$array['country1'];	
//echo $cost_tech."<br>";
$tech = preg_split("/[\s,]+/",$cost_tech);

//$cost_t1=$tech[11]*(1-$rate_reduce*($round+1))*1000;
$cost_t2=$tech[12]*(1-$rate_reduce*($round+1))*1000;
$cost_t3=$tech[13]*(1-$rate_reduce*($round+1))*1000;
$cost_t4=$tech[14]*(1-$rate_reduce*($round+1))*1000;
					
					//$f11=$c11['feature_tech1'];
					$f21=$country1['feature_tech2'];
					$f31=$country1['feature_tech3'];
					$f41=$country1['feature_tech4'];
					
					$f21 =preg_split("/[,]+/",$f21);
					$f31 =preg_split("/[,]+/",$f31);
					$f41 =preg_split("/[,]+/",$f41);
					//$te1=round($f11[5]-$f11[4]*$f11[2]-$cost_t1);
					$te2=round($f21[5]-$f21[4]*$f21[2]-$cost_t2);
					$te3=round($f31[5]-$f31[4]*$f31[2]-$cost_t3);
					$te4=round($f41[5]-$f41[4]*$f41[2]-$cost_t4);
					//if ($te1==0) {$tech_r1=1;}
					//	echo $te3;
					if ($te2==0) {$tech_r2=1;} else {$tech_r2=0;}
					if ($te3==0) {$tech_r3=1;} else {$tech_r3=0;}
					if ($te4==0) {$tech_r4=1;} else {$tech_r4=0;}
				
	// get tech available
				$tech = mysql_query("SELECT tech FROM `output` where game_id='$gid' and team_id='$tid' and round='$round'");
				$ctech = mysql_fetch_array($tech);
				$t= preg_split("/[\s,]+/",$ctech[0]);
				$tech_1= $t[0];
				$tech_2= $t[1]+$tech_r2;
				$tech_3= $t[2]+$tech_r3;
				$tech_4= $t[3]+$tech_r4;					
					
	// ------------------- end for feature research tech							
				
				//echo $ct2;
				//echo "aaa".base64_decode($c2);
				// get price, feature and promotion  ---- price[0]: price; price[1]: number of feature; price[2]:promotion rate;
				//c1	
					$price11=$country1['price_tech1'];
					$price12=$country1['price_tech2'];
					$price13=$country1['price_tech3'];
					$price14=$country1['price_tech4'];		

					$feature11=$country1['sale_feature1'];
					$feature12=$country1['sale_feature2'];
					$feature13=$country1['sale_feature3'];
					$feature14=$country1['sale_feature4'];	
					
					$promotion11=$country1['promotion1'];
					$promotion12=$country1['promotion2'];
					$promotion13=$country1['promotion3'];
					$promotion14=$country1['promotion4'];
					
					$salemargin11=$country1['sale_margin1'];
					$salemargin12=$country1['sale_margin2'];
					$salemargin13=$country1['sale_margin3'];
					$salemargin14=$country1['sale_margin4'];
					
				//c2	
					$price21=$country2['price_tech1'];
					$price22=$country2['price_tech2'];
					$price23=$country2['price_tech3'];
					$price24=$country2['price_tech4'];	

					$feature21=$country2['sale_feature1'];
					$feature22=$country2['sale_feature2'];
					$feature23=$country2['sale_feature3'];
					$feature24=$country2['sale_feature4'];	

					$promotion21=$country2['promotion1'];
					$promotion22=$country2['promotion2'];
					$promotion23=$country2['promotion3'];
					$promotion24=$country2['promotion4'];
				
					$salemargin21=$country2['sale_margin1'];
					$salemargin22=$country2['sale_margin2'];
					$salemargin23=$country2['sale_margin3'];
					$salemargin24=$country2['sale_margin4'];
					
				//c3	
					$price31=$country3['price_tech1'];
					$price32=$country3['price_tech2'];
					$price33=$country3['price_tech3'];
					$price34=$country3['price_tech4'];	

					$feature31=$country3['sale_feature1'];
					$feature32=$country3['sale_feature2'];
					$feature33=$country3['sale_feature3'];
					$feature34=$country3['sale_feature4'];	
					
					$promotion31=$country3['promotion1'];
					$promotion32=$country3['promotion2'];
					$promotion33=$country3['promotion3'];
					$promotion34=$country3['promotion4'];
				
					$salemargin31=$country3['sale_margin1'];
					$salemargin32=$country3['sale_margin2'];
					$salemargin33=$country3['sale_margin3'];
					$salemargin34=$country3['sale_margin4'];		
					
				// feature research available
					$f11=$country1['feature_tech1'];
					$f21=$country1['feature_tech2'];
					$f31=$country1['feature_tech3'];
					$f41=$country1['feature_tech4'];
					
					$f11 =preg_split("/[,]+/",$f11);
					$f21 =preg_split("/[,]+/",$f21);
					$f31 =preg_split("/[,]+/",$f31);
					$f41 =preg_split("/[,]+/",$f41);
					
					// feature cost per unit = total feature investment cost / 10 years/ estimated sale over 10 years
					$feat_cost=$f11[2]/40/$total_demand0*50;
					//echo $f11[2];
					
	 // get current feature
 	$feature1 = mysql_query("SELECT feature FROM output where game_id='$gid' and team_id='$tid' and round='$round' ");
	$feature1 = mysql_fetch_array($feature1);
	$f0=$feature1['feature'];
		$f0 =preg_split("/[,]+/",$f0);
		$f1=$f0[0];
		$f2=$f0[1];
		$f3=$f0[2];
		$f4=$f0[3];
	//end current feature
	
					
					$f11=$f11[0]+$f11[4]+$f1;
					$f12=$f21[0]+$f21[4]+$f2;
					$f13=$f31[0]+$f31[4]+$f3;	
					$f14=$f41[0]+$f41[4]+$f4; 
					
			
				// Get total production
				$p11=$country1['production1'];
				$p12=$country1['production2'];
				$o11=$country1['outsource1'];
				$o12=$country1['outsource2'];
				
				$p21=$country2['production1'];
				$p22=$country2['production2'];
				$o21=$country2['outsource1'];
				$o22=$country2['outsource2'];
				
				
				// from string to array
				$p11 =preg_split("/[,]+/",$p11);
				$p12 =preg_split("/[,]+/",$p12);
				$o11 =preg_split("/[,]+/",$o11);
				$o12 =preg_split("/[,]+/",$o12);
				
				$p21 =preg_split("/[,]+/",$p21);
				$p22 =preg_split("/[,]+/",$p22);
				$o21 =preg_split("/[,]+/",$o21);
				$o22 =preg_split("/[,]+/",$o22);

				
// get demand for each tech
				$d1=$country1['est_demand']/100;
				$d2=$country2['est_demand']/100;
				$d3=$country3['est_demand']/100;
				
				$mt11=$country1['est_marketshare_t1'];
				$mt12=$country1['est_marketshare_t2'];
				$mt13=$country1['est_marketshare_t3'];
				$mt14=$country1['est_marketshare_t4'];

				$mt21=$country2['est_marketshare_t1'];
				$mt22=$country2['est_marketshare_t2'];
				$mt23=$country2['est_marketshare_t3'];
				$mt24=$country2['est_marketshare_t4'];
				
				$mt31=$country3['est_marketshare_t1'];
				$mt32=$country3['est_marketshare_t2'];
				$mt33=$country3['est_marketshare_t3'];
				$mt34=$country3['est_marketshare_t4'];
				
				
				// demand for each tech
			//c1	
				$dt11=$dmd_c1*(1+$d1)*$mt11/100;
				$dt12=$dmd_c1*(1+$d1)*$mt12/100;
				$dt13=$dmd_c1*(1+$d1)*$mt13/100;
				$dt14=$dmd_c1*(1+$d1)*$mt14/100;
				//get tech total production
			//c2
				$dt21=$dmd_c2*(1+$d2)*$mt21/100;
				$dt22=$dmd_c2*(1+$d2)*$mt22/100;
				$dt23=$dmd_c2*(1+$d2)*$mt23/100;
				$dt24=$dmd_c2*(1+$d2)*$mt24/100;
			//c3
				$dt31=$dmd_c3*(1+$d3)*$mt31/100;
				$dt32=$dmd_c3*(1+$d3)*$mt32/100;
				$dt33=$dmd_c3*(1+$d3)*$mt33/100;
				$dt34=$dmd_c3*(1+$d3)*$mt34/100;			
			
			
			$tech11=$tech12=$tech13=$tech14=0;
			$tech21=$tech22=$tech23=$tech24=0;
			

 
//------------------- get different tech stocks
		// for c1 tech 1: $dt11
		// demand : $dt11
		// production $pro_c1[0]
		
		//tech type
				$t1=$p11[0];
				$t2=$p12[0];
				$t3=$o11[0];
				$t4=$o12[0];
				
				$t5=$p21[0];
				$t6=$p22[0];
				$t7=$o21[0];
				$t8=$o22[0];
		// unit of produce		
				$p1=$p11[2];
				$p2=$p12[2];
				$p3=$o11[2];
				$p4=$o12[2];
				
				$p5=$p21[2];
				$p6=$p22[2];
				$p7=$o21[2];
				$p8=$o22[2];	
		// get unit cost
				//c1
				$u1=$p11[5];
				$u2=$p12[5];
				$u3=$o11[5];
				$u4=$o12[5];
				//c2
				$u5=$p21[5];
				$u6=$p22[5];
				$u7=$o21[5];
				$u8=$o22[5];		
		// get total cost
				//c1
				$v1=$p11[2]*$p11[5];
				$v2=$p12[2]*$p12[5];
				$v3=$o11[2]*$o11[5];
				$v4=$o12[2]*$o12[5];
				//c2
				$v5=$p21[2]*$p21[5];
				$v6=$p22[2]*$p22[5];
				$v7=$o21[2]*$o21[5];
				$v8=$o22[2]*$o22[5];				
			
				//echo $p1."/".$p2."/".$p3."/".$p4."<br>";
				
$tech11=$tech12=$tech13=$tech14=0;
$tech21=$tech22=$tech23=$tech24=0;
$vtech11=$vtech12=$vtech13=$vtech14=0;
$vtech21=$vtech22=$vtech23=$vtech24=0;
				for ($i=1; $i<=4; $i++) 
				{
				$t="t".$i;
				$p="p".$i;
				$v="v".$i;
				if ($$t==1) {$tech11=$tech11+$$p;$vtech11=$vtech11+$$v;}
				if ($$t==2) {$tech12=$tech12+$$p;$vtech12=$vtech12+$$v;}
				if ($$t==3) {$tech13=$tech13+$$p;$vtech13=$vtech13+$$v;}
				if ($$t==4) {$tech14=$tech14+$$p;$vtech14=$vtech14+$$v;}
				//echo "<br>".$tech."<br>=".$$tech."+".$$p;
				
				}	
				for ($i=5; $i<=8; $i++) 
				{
				$t="t".$i;
				$p="p".$i;
					$v="v".$i;
				if ($$t==1) {$tech21=$tech21+$$p;$vtech21=$vtech21+$$v;}
				if ($$t==2) {$tech22=$tech22+$$p;$vtech22=$vtech22+$$v;}
				if ($$t==3) {$tech23=$tech23+$$p;$vtech23=$vtech23+$$v;}
				if ($$t==4) {$tech24=$tech24+$$p;$vtech24=$vtech24+$$v;}
				//echo "<br>".$tech."<br>=".$$tech."+".$$p;
				}					
				
// unit cost
// c1
if ($tech11<>0){$uc11=$vtech11/$tech11;} else {$uc11=0;}
if ($tech12<>0){$uc12=$vtech12/$tech12;} else {$uc12=0;}
if ($tech13<>0){$uc13=$vtech13/$tech13;} else {$uc13=0;}
if ($tech14<>0){$uc14=$vtech14/$tech14;} else {$uc14=0;}
//c2
if ($tech21<>0){$uc21=$vtech21/$tech21;} else {$uc21=0;}
if ($tech22<>0){$uc22=$vtech22/$tech22;} else {$uc22=0;}
if ($tech23<>0){$uc23=$vtech23/$tech23;} else {$uc23=0;}
if ($tech24<>0){$uc24=$vtech24/$tech24;} else {$uc24=0;}
//echo"unit cost tech 1 country1".($uc24);
// get old inventory

   $result2 = mysql_query("SELECT inventory_c1,inventory_c2,ucost_inven1,ucost_inven2 FROM output where game_id='$gid' and team_id='$tid' and round=$round");
   $array2 = mysql_fetch_array($result2);
$uci1=$array2['ucost_inven1'];	
//echo $uci1;
$uci2=$array2['ucost_inven2'];
$uci1 = preg_split("/[,]+/",$uci1);
$uci2 = preg_split("/[,]+/",$uci2);
//get inventory holding cost

$ivc = mysql_query("SELECT inventory_cost_per_uni FROM `game` where id='$gid'");
$ivcs = mysql_fetch_array($ivc);
$ivcc=(1+$ivcs['inventory_cost_per_uni']/100); 


//c1
$uci11=$uci1[0]*$ivcc;
$uci12=$uci1[1]*$ivcc;
$uci13=$uci1[2]*$ivcc;
$uci14=$uci1[3]*$ivcc;
//c2
$uci21=$uci2[0]*$ivcc;
$uci22=$uci2[1]*$ivcc;
$uci23=$uci2[2]*$ivcc;
$uci24=$uci2[3]*$ivcc;

$inven1=$array2['inventory_c1'];	
$inven2=$array2['inventory_c2'];
$inven1 = preg_split("/[,]+/",$inven1);
$inven2 = preg_split("/[,]+/",$inven2);		

$inven11=$inven1[0];
$inven12=$inven1[1];
$inven13=$inven1[2];
$inven14=$inven1[3];

$inven21=$inven2[0];
$inven22=$inven2[1];
$inven23=$inven2[2];
$inven24=$inven2[3];				

			$t11=$tech11=$tech11+$inven11;
			$t12=$tech12=$tech12+$inven12;
			$t13=$tech13=$tech13+$inven13;
			$t14=$tech14=$tech14+$inven14;
			$t21=$tech21=$tech21+$inven21;
			$t22=$tech22=$tech22+$inven22;
			$t23=$tech23=$tech23+$inven23;
			$t24=$tech24=$tech24+$inven24;
			
			$pro11=$tech11;
			//echo $tech11;
			$pro12=$tech12;
			$pro13=$tech13;
			$pro14=$tech14;
			$pro21=$tech21;
			$pro22=$tech22;
			$pro23=$tech23;
			$pro24=$tech24;			

//------------------- END get different tech stocks		

// ---------------------- main engine for logistic stock
// pro_c1/pro_c2/pro_c3 :$pro11-$pro24
// demand_c1/demand_c2/demand_c3 :$dt11-$dt24
//logistic_c1 : 123 $logis1/$logis2
// logisctic for 4 tech  $logis1[0]; $logis1[1]; $logis1[2]; $logis1[3];
// logisctic for 4 tech  $logis2[0]; $logis2[1]; $logis2[2]; $logis2[3];
//available a11 a21
$avai11=$avai12=$avai13=$avai14=$avai21=$avai22=$avai23=$avai24=$avai31=$avai32=$avai33=$avai34=0;
// manufacture from
$m111=$m112=$m113=$m114=$m121=$m122=$m123=$m124=0;
$m211=$m212=$m213=$m214=$m221=$m222=$m223=$m224=0;
$m311=$m312=$m313=$m314=$m321=$m322=$m323=$m324=0;
// Logistic engine start
//----------------- logistic order works when total supply < total demand
	for ($c=1; $c<=3; $c++) 
	{
	
		for ($t=1; $t<=4; $t++) 
		{
		$totalp="totalp".$t;
		$totald="totald".$t;
		$pro="pro".$c.$t;
			if ($c==1 or $c==2) { if (isset($$totalp)) {$$totalp=$$totalp+$$pro;} else {$$totalp=$$pro;}}
			$dt="dt".$c.$t;
			if (isset($$totald)) {$$totald=$$totald+$$dt;} else {$$totald=$$dt;}
		}
	}	
	//echo "Total:".($dt11+$dt21+$dt31)."<br>";
	//echo "Totalc1:".($dt11)."/".$mt11."/".$d1."/".$dmd_c1."<br>";
	//echo "Totalc2:".($dt21)."/".$mt21."/".$d2."/".$dmd_c2."<br>";
	//echo "Totalc3:".($dt31)."/".$mt31."/".$d3."/".$dmd_c3."<br>";
	
	
	
	
	for ($t=1; $t<=4; $t++) 
	{
		$totalp="totalp".$t;
		$totald="totald".$t;
		if ($$totalp<$$totald)
			{
			//set priority logistic order
			// Engine start
					for ($c=1; $c<=3; $c++) 
					{
				
					
					}
			}
			else
			{
				
					for ($c=1; $c<=3; $c++) 
					{
					// set for priorty local product
					$dt="dt".$c.$t;
					$avai="avai".$c.$t;
					$pro1="pro1".$t;
					$pro2="pro2".$t;
					$m1="m1".$c.$t;
					$m2="m2".$c.$t;
			if ($c==1)
			{			
					if ($$pro1>=$$dt) 
						{
						$$avai=$$dt;
						$$pro1=$$pro1-$$dt;
						$$m1=$$dt;
					
						}
					else
						{
						$$avai=$$pro1;
						$$m1=$$pro1;

						$m="m12".$t;
						$$m=($$dt-$$pro1);
						$$pro2=$$pro2-($$dt-$$pro1);
						$$pro1=0;
						}							
			}	
			
			if ($c==2)
			{			
					if ($$pro2>=$$dt) 
						{
						$$avai=$$dt;
						$$pro2=$$pro2-$$dt;
						$$m2=$$dt;
					
						}
						
					else 
						{
						$$avai=$$pro2;
						$$m2=$$pro2;
						
						$m="m21".$t;
						$$m=($$dt-$$pro2);
						$$pro1=$$pro1-($$dt-$$pro2);
						$$pro2=0;
						}							
			}			
			
			// for country 3
					
			if ($c==3)
			{			
					if ($l_c1_c3>=$l_c2_c3) 
						{
						$proc="pro2".$t;
						$prod="pro1".$t;
						$mc="m32".$t;
						$md="m31".$t;
						if ($$proc>=$$dt)
							{
							$$avai=$$dt;
							$$proc=$$proc-$$dt;
							$$mc=$$dt;
							}
							else
							{
							$$avai=$$avai+$$proc;
							$$mc=$$mc+$$proc;
							$$proc=0;
							//for c1
							$$avai=$$avai+($$dt-$$proc);
							$$prod=$$prod-($$dt-$$proc);
							$$md=$$md+($$dt-$$proc);
							}
						
						}
					if ($l_c1_c3<$l_c2_c3) 
						{
						$proc="pro1".$t;
						$prod="pro2".$t;
						$mc="m31".$t;
						$md="m32".$t;
						if ($$proc>$$dt)
							{
							$$avai=$$dt;
							$$proc=$$proc-$$dt;
							$$mc=$$dt;
							}
							else
							{
							$$avai=$$avai+$$proc;
							$$mc=$$mc+$$proc;
							$$proc=0;
							//for c1
							$$avai=$$avai+($$dt-$$proc);
							$$prod=$$prod-($$dt-$$proc);
							$$md=$$md+($$dt-$$proc);
							}
						
						}						
						
			}					
					}			
			
			
			}
		
	}
// enable logistic

	for ($c=1; $c<=2; $c++) 
	{
	
		for ($t=1; $t<=4; $t++) 
		{	
		$totalp="totalp".$t;
		$totald="totald".$t;
		if ($$totalp<$$totald)
	{	
		$lo="lo".$c.$t;
		$a=$$lo;
		$tech="pro".$c.$t;
		$demand="dt".$c.$t;
		$av="av".$c.$t;
			for ($k=1; $k<=3; $k++) 
				{	
		
		$ship="ship".$k;
		$$ship=$a[$k-1];
		
		$dt="dt".$$ship.$t;
		$avai="avai".$$ship.$t;
		
		$m="m".$$ship.$c.$t;
		//if ($$dt<$$avai) 
		//	{
		//echo "<br>".$$dt."<".$$tech."<br>";
		//echo $demand."-".$avai."<br>";
			
			if ($$dt>$$avai) 
				{
					if ($$tech<=($$dt-$$avai))
					{
					$$avai=$$avai+$$tech;
					$$m=$$m+$$tech;
					$$tech=0;	
					}
					if ($$tech>($$dt-$$avai))
					{
					$$m=$$m+$$dt-$$avai;
					$$tech=$$tech-($$dt-$$avai);	
					$$avai=$$dt;
					
					}
				}
				else
				{

				}


			
		
				}
		}
	}	
	}

	
// ----------------------------- logistic engine stop	
	
	// for marketing
 if( $_GET['act']=='marketing')
 {
//  for marketing post

 		for ($t=1; $t<=4; $t++)
{
$market="marketing".$t;
	  if(isset($_POST[$market]))
  {	
  
      		for ($i=1; $i<=3; $i++)
		{
		$feature="feature".$i.$t;
		$sale="salemargin".$i.$t;
		$promotion="promotion".$i.$t;
		$uc="ucost_c".$i.$t;
		
		$$feature=$_POST[$feature];
		$$sale=$_POST[$sale];
		$$promotion=$_POST[$promotion]/100;
		$$uc=$_POST[$uc];	
		//echo "=".$$uc;
		// title
		$price="price".$t;
		$sale_feature="sale_feature".$t;
		$promot="promotion".$t;
		$sale_margin="sale_margin".$t;
		$unit_cost="unit_cost".$t;

		$price="price_tech".$t;
		$$price=$$uc*(1+$$sale/100);
		//set value back to variable from database for update
		
		
				if($i==1)
			{
		//echo $ct1;
		$ct1[$sale_feature]=$$feature;
		$ct1[$promot]=$$promotion;
		$ct1[$sale_margin]=$$sale;
		$ct1[$unit_cost]=$$uc;
		$ct1[$price]=$$price;
			}
			
				if($i==2)
			{
		
		$ct2[$sale_feature]=$$feature;
		$ct2[$promot]=$$promotion;
		$ct2[$sale_margin]=$$sale;
		$ct2[$unit_cost]=$$uc;
		$ct2[$price]=$$price;
			}
			
			
				if($i==3)
			{
		$ct3[$sale_feature]=$$feature;
		$ct3[$promot]=$$promotion;
		$ct3[$sale_margin]=$$sale;
		$ct3[$unit_cost]=$$uc;
		$ct3[$price]=$$price;
			}
			
		}
		
		$ct1=base64_encode(serialize($ct1));
		$ct2=base64_encode(serialize($ct2));	
		$ct3=base64_encode(serialize($ct3));
		if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
		$res = mysql_query("SELECT country1  FROM input WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input' ");
		if( mysql_num_rows($res) == 1) 
		{
		$date = date('Y-m-d H:i:s');
		
		$sql="UPDATE `input` SET country1='$ct1', country2='$ct2', country3='$ct3', date='$date'  WHERE game_id='$gid' and team_id='$tid'  and player_id='$pid' and round='$round_for_input'  ";
		//echo $sql;
		$result_input=mysql_query($sql);
		//$sql=mysql_real_escape_string($sql);  		
		//$t=logs($_SESSION['username'],$_SESSION['id'],$sql,$result_input);
		
		//$server_header=$_SERVER['REQUEST_URI'];
					header ("Location:game.php?act=marketing");
		
		}	
  				
  }  
  else
  {
   
  }
  
} 
     echo"<div class='simpleTabs'>";
		 echo"<ul class='simpleTabsNavigation'>";

  //echo"<h4>Marketing<h4>";
		
		  		 		for ($t=1; $t<=4; $t++)
		{
		 $tech="tech".$t;
		 $tech_avai="tech_".$t;
		 //if ($$tech_avai==1)
			//{
				echo"<li><a href='#'>".$LANG[$tech]."</a></li>";
			//}
		}		
		        echo"</ul>";      
		  
 // for tech 1 
 		for ($t=1; $t<=4; $t++)
		{
// for tab
 $tech="tech".$t;
			 
		 $tech_avai="tech_".$t;
		 if ($$tech_avai==1)
			{	       
	 echo"<div class='simpleTabsContent'>";			
 if ($overtime==0){echo"<form action='game.php?act=marketing&tid=".$tid."&id=".$gid."' method='POST'>";}
 //echo $l_c1_c2."c12<br>";
 //echo $l_c1_c3."c13<br>";
 //echo $l_c2_c1."c21<br>";
 //echo $l_c2_c3."c23<br>";
 
  echo"<table>";

  echo"<th width=40%>".$LANG[$tech]."</th>";
  		for ($i=1; $i<=3; $i++)
		{
		
		  echo"<th width=20%>".$LANG[$i]."</th>";
		}


  // 
  echo"<tr>";

  echo"<td>".$LANG['no_of_feature']."</td>"; 
    		for ($i=1; $i<=3; $i++)
		{
		$feature="feature".$i.$t;
		echo"<td  class=demo><select style='width:100%;' name='".$feature."' onchange='this.form.submit()'>";
		
		$f="f1".$t;
		for ($k=0; $k<=$$f; $k++)
		{
		if ($k==$$feature) {$s="selected";} else {$s="";}
		echo"<option ".$s." value=".$k.">".$k."</option>";		
	    }
		echo"</select>";
		echo"</td>";	
		}

  echo"</tr>";
  //
  echo"<tr><td >".$LANG['sale_margin']."</td>";
		
	
				    		for ($k=1; $k<=3; $k++)
		{
		$sale="salemargin".$k.$t;
  		echo"<td  class=demo><select style='width:100%;' name='".$sale."' onchange='this.form.submit()'>";

		//if ($f41[1]*$remain<$avai_hours) {$a=$f41[1]*$remain;
		for ($i=0; $i<=400; $i++)
		{
		if ($i==$$sale) {$s="selected";} else {$s="";}
		echo"<option ".$s." value=".$i.">".$i." %</option>";		
	    }
		echo"</select>";
		echo"</td>";	
		}
					

  echo"</tr>";
  //
  echo"<tr><td>".$LANG['promotion']."</td>";
  		
				    		for ($k=1; $k<=3; $k++)
		{
		$promotion="promotion".$k.$t;
		echo"<td  class=demo><select style='width:100%;' name='".$promotion."' onchange='this.form.submit()'>";
		
		//if ($f41[1]*$remain<$avai_hours) {$a=$f41[1]*$remain;
		for ($i=0; $i<=50; $i++)
		{
		if ($i==$$promotion*100) {$s="selected";} else {$s="";}
		echo"<option ".$s." value=".$i.">".($i/10)." %</option>";		
	    }
		echo"</select>";
		echo"</td>";	
		}
		
  echo"</tr>";
  
 echo"<tr>";
 echo"<td colspan=5 class=result2>".$LANG['costbreakdown']."</td>";
 echo"</tr>"; 
 
  //
  echo"<tr><td> - ".$LANG['inhouseandcontract']."</td>";
  //				    		for ($k=1; $k<=3; $k++)
	//	{
	//	$m11="m".$k."1".$t;
	//	$uc1="uc1".$t;
	//	$m12="m".$k."2".$t;
	//	$uc2="uc2".$t;
	//	$inhouse="inhouse".$k;
	//	$$inhouse=$$m11*$$uc1+$$m12*$$uc2;
  //echo"<td  class=right>".number_format($$m11*$$uc1+$$m12*$$uc2)."</td>";
	//	}
	
		  for ($k=1; $k<=3; $k++)
		{
		$m1="m".$k."1".$t;
		$m2="m".$k."2".$t;
		$uc1="uc1".$t;
		$uc2="uc2".$t;
		$inv1="inven1".$t;
		$inv2="inven2".$t;
		$uci1="uc1".$t;
		$uci2="uc2".$t;
		$inhouse="inhouse".$k.$t;
		if ($k==1)
			{
			
			if ($$inv1<=$$m1) 
				{
				$$inhouse=($$m1-$$inv1)*$$uc1+$$uci1*$$inv1;
				}
			else
				{
				$$inhouse=$$m1*$$uci1;
				}
			}
		if ($k==2)
			{
			//$$inhouse=$$m2*$$uc2;
			
			if ($$inv2<=$$m2) 
				{
				$$inhouse=($$m2-$$inv2)*$$uc2+$$uci2*$$inv2;
				}
			else 
				{
				$$inhouse=$$m2*$$uci2;
				}			
			}
		if ($k==3)
			{
			$$inhouse=0;
			}
		
	echo"<td class=right>".number_format($$inhouse)."</td>";
		}	
	
	
  echo"</tr>";  
  //
  echo"<tr><td> - ".$LANG['coi']."</td>";
	//$i_c1=$$n121*$$uc21*($tp21-1);
	//$i_c2=$$n211*$$uc11*($tp12-1);
	//$i_c3=$$n311*$$uc11*($tp13-1)+$$n321*$$uc21*($tp23-1);
	  for ($k=1; $k<=3; $k++)
		{
		$m1="m".$k."1".$t;
		$m2="m".$k."2".$t;
		$uc1="uc1".$t;
		$uc2="uc2".$t;
		$i_c="i_c".$k.$t;
		$basei_c="basei_c".$k.$t;
		if ($k==1)
			{
			$$i_c=$$m2*$$uc2*($tp21);
			$$basei_c=$$m2*$$uc2;
			}
		if ($k==2)
			{
			$$i_c=$$m1*$$uc1*($tp12);
			$$basei_c=$$m1*$$uc1;
			}
		if ($k==3)
			{
			$$i_c=$$m1*$$uc1*($tp13)+$$m2*$$uc2*($tp23);
			$$basei_c=$$m1*$$uc1+$$m2*$$uc2;
			}			
		
	echo"<td class=right>".number_format($$i_c)."</td>";
		}	
 
  echo"</tr>";    
  //
  echo"<tr><td> - ".$LANG['transportation']."</td>";
		// check if expected sale is less/more than what available
		// if smaller--> choose where cheaper
		// if higher--> all	
	  for ($k=1; $k<=3; $k++)
		{
		$m1="m".$k."1".$t;
		$m2="m".$k."2".$t;

		$t_c="t_c".$k.$t;
		if ($k==1)
			{
			$$t_c=$$m2*$l_c2_c1;
			}
		if ($k==2)
			{
			$$t_c=$$m1*$l_c1_c2;
			}
		if ($k==3)
			{
			$$t_c=$$m1*$l_c1_c3+$$m2*$l_c2_c3;
			}
		
	echo"<td class=right>".number_format($$t_c)."</td>";
		}	
		//$t_c1=$$n121*$l_c2_c1;
	//$t_c2=$$n211*$l_c1_c2;
	//$t_c3=$$n311*$l_c1_c3+$$n321*$l_c2_c3;
  //echo"<td class=right>".number_format($$n121*$l_c2_c1)."</td>";
  //echo"<td class=right>".number_format($$n211*$l_c1_c2)."</td>";
  //echo"<td class=right>".number_format($$n311*$l_c1_c3+$$n321*$l_c2_c3)."</td>";
  echo"</tr>";    
  //
  echo"<tr><td> - ".$LANG['feature_cost']."</td>";
        				    		for ($k=1; $k<=3; $k++)
		{
		$m12="m".$k."2".$t;
		$m11="m".$k."1".$t;
		$nf="feature".$k.$t;
		$fc=$feat_cost/(pow(1.1,$$nf));
		//echo $feat_cost;
		$fec="fec".$k.$t;
		$$fec=($$m12+$$m11)*$fc*$$nf;
		//echo $feat_cost;
  echo"<td class=right>".number_format($$fec)."</td>";
		}
  echo"</tr>";    
  

  
  
   echo"<tr>";
 echo"<td colspan=5 class=result2>".$LANG['finance']."</td>";
 echo"<tr>"; 
     //
  
  echo"<td> - ".$LANG['unit_cost']."</td>";
  //$ucost_c1=($inhouse1+$usa_i+$usa_t+$fec1)/($$dt1);

  //$ucost_c2=($inhouse2+$asia_i+$asia_t+$fec2)/($$dt2);
  //$ucost_c3=($inhouse3+$eu_i+$eu_t+$fec3)/($$dt3);
  
 					    		for ($k=1; $k<=3; $k++)
		{
		$n1="m".$k."1".$t;
		$n2="m".$k."2".$t;
		$fec="fec".$k.$t;
		$i_c="i_c".$k.$t;
		$basei_c="basei_c".$k.$t;
		$t_c="t_c".$k.$t;
		$inhouse="inhouse".$k.$t;
		$uc="ucost_c".$k.$t;
		$uc2="ucost_c2".$k.$t;
		$dt="dt".$k.$t;
		if (($$n1+$$n2)>0)
		{
		// check if expected sale is less/more than what available
		// if smaller--> choose where cheaper
		// if higher--> all	
				
				$$uc=($$inhouse+$$i_c+$$t_c+$$fec)/($$n1+$$n2);
				//echo "[".$$i_c."-".$$basei_c."]";
				$$uc2=($$inhouse+$$basei_c+$$t_c+$$fec)/($$n1+$$n2);

		
		}
		else
		{
		$$uc=0;
		$$uc2=0;
		}
		echo"<td class=right>US$ ".number_format($$uc)."</td>";
		echo"<input type=hidden name='".$uc."' value='".$$uc."'/>";
		} 
   
  echo"</tr>";
  // last round price
  echo"<tr><td> - <i>".$LANG['lastroundprice']."</i></td>";

		$result2 = mysql_query("SELECT price_report FROM `output` where game_id='$gid' and team_id='$tid' and round='$round' and final='1'");
		$row2 = mysql_fetch_array($result2);
		$price_report=$row2['price_report'];

		//echo $price_report."/";
		$price_report = preg_split("/[\s,]+/",$price_report);
		for ($k=1; $k<=3; $k++)
		{

		if ($k==1) {$x=-1;}
		if ($k==2) {$x=3;}
		if ($k==3) {$x=7;}
		echo"<td class=right><i> US$ ".number_format($price_report[$x+$t])."</i></td>";
		}


  echo"</tr>";

  //
  
  echo"<tr><td> - ".$LANG['price']."</td>";
	
					    		for ($k=1; $k<=3; $k++)
		{
		$sale="salemargin".$k.$t;
		$uc="ucost_c2".$k.$t;
		//echo $$uc."/";
		$price="price".$k;
		$$price=$$uc*(1+$$sale/100);
		
		if ($k==1) {$dollar="&#36;";}
		if ($k==2) {$dollar="&#8363;";}
		if ($k==3) {$dollar="&#128;";}
		echo"<td class=right> ".$dollar." ".number_format($$price)."</td>";
		}


  echo"</tr>";

  //
  echo"<tr><td> - ".$LANG['sale_revenue']."</td>";
  
					    		for ($k=1; $k<=3; $k++)
		{
		$n1="m".$k."1".$t;
		$n2="m".$k."2".$t;
		$price="price".$k;
		$rev="rev".$k.$t;
		$dt="dt".$k.$t;
		
		// check if production meets expected sales
		if ($$dt<=($$n1+$$n2)) {$$rev=$$price*$$dt;}
		if ($$dt>($$n1+$$n2)) {$$rev=$$price*($$n1+$$n2);}
		
		echo"<td class=right>".number_format($$rev)."</td>";
		}
  echo"</tr>";  
  //
      echo"<tr><td> - ".$LANG['promotion']."</td>";
        	for ($k=1; $k<=3; $k++)
		{
				$promotion="promotion".$k.$t;
				$rev="rev".$k.$t;
				$pro_cost="pro_cost".$k.$t;
				$$pro_cost=$$promotion/100*$$rev;
				echo"<td class=right>".number_format($$pro_cost)."</td>";
		}
  echo"</tr>";   
  
  //
  echo"<tr><td> - ".$LANG['gross_margin']."</td>";
        	for ($k=1; $k<=3; $k++)
		{
				
				$promotion="pro_cost".$k.$t;
				$rev="rev".$k.$t;
				$gmargin=$$rev-$$promotion;
				echo"<td class=right>".number_format($gmargin)."</td>";
		}
  echo"</tr>";     
   //
  echo"<td colspan=5 class=result2>".$LANG['product_avai']."</td>";

  echo"</tr>";     
   

	$dt1="dt1".$t;
	$dt2="dt2".$t;
	$dt3="dt3".$t;
	
  echo"<td> - ".$LANG['manu_usa']."</td>";

        	for ($k=1; $k<=3; $k++)
		{
		$m="m".$k."1".$t;
		$pro="pro1".$t;
		$im1="im1".$k.$t;
			if ($k==1) {$$im1=$$m+$$pro;} else {$$im1=$$m;}
	echo"<td class=right>".number_format($$im1)."</td>";	
		}

  
  echo"</tr>";      
    //
  echo"<tr><td> - ".$LANG['manu_asia']."</td>";
 
        	for ($k=1; $k<=3; $k++)
		{
		$m="m".$k."2".$t;
		$pro="pro2".$t;
		$im2="im2".$k.$t;
		if ($k==2) {$$im2=$$m+$$pro;} else {$$im2=$$m;}
		
	echo"<td class=right>".number_format($$im2)."</td>";	
		}
 //echo"<td class=right>".number_format($$n221)."</td>";
 //echo"<td class=right>".number_format($$n321)."</td>";
 
  echo"</tr>";   


  echo"<tr><td> - ".$LANG['ex_sale']."</td>";
  if ($$dt3==0 or $$dt1==0 or $$dt2==0)
  {
   	$message=$LANG['pleaseestimatemarket'];
	$msg=message($message,3);
	echo $msg;
  }
  echo"<td class=right>".number_format($$dt1)."</td>";
   echo"<td class=right>".number_format($$dt2)."</td>";
    echo"<td class=right>".number_format($$dt3)."</td>";
	 
  echo"</tr>";   

  echo"</table><br>"; 
  $marketing="marketing".$t;
   				echo"<input type=hidden name='round' value='".$round_for_input."'/>";
				echo"<input type=hidden name='game_id' value='".$gid."'/>";
				echo"<input type=hidden name='team_id' value='".$tid."'/>";
				echo"<input type=hidden name='".$marketing."' value='1'/>"; 
  echo"</form>";
  echo"</div>";
  }
// end tech 1 or loop
			else
			{
		 echo"<div class='simpleTabsContent'>";			
	echo"<table>";
	echo"<th>".$LANG[$tech]."</th><th>".$LANG['1']."</th><th>".$LANG['2']."</th><th>".$LANG['3']."</th>";
	echo"<tr><td colspan=4 style='width:100%;text-align: center;font-size:12px;'>";
	echo"<br><img style='width:10px;height:10px' src='imgs/icon-warning.png'> ".$LANG['technology']." ".$t." ".$LANG['unavailable']."<BR>---";
	echo"</td></tr>";
	echo"</table>";
	echo"</div>";	
			}
		
		    }


    echo"</div>	";  
	
	
	}
	// --------------- end marketing

	
	
	
	

//------------------------ finance

	  if( $_GET['act']=='finance')
  {	
 
 
 $gid=$_SESSION['game_id'];
 $tid=$_SESSION['team_id'] ;
 
 // get round
	$res_round = mysql_query("SELECT max(round) FROM output where game_id='$gid' and team_id='$tid'  and final='1' ");
	$array_round = mysql_fetch_array($res_round);
	$round=$array_round[0];
	$round_for_input=$round+1;

	// get practice round
$game = mysql_query("SELECT practice_round, no_of_rounds FROM `game` where id='$gid'");
$hpr = mysql_fetch_array($game);
$pround=$hpr['practice_round'];
$rounds=$hpr['no_of_rounds'];
if ($round==$pround) {$round=0;} 
if ($round_for_input>$rounds) {$round_for_input=$round;}
//get tax and interest				
$result1 = mysql_query("SELECT country1,country2,country3 FROM round_assumption where game_id='$gid' and round=$round_for_input");
$array = mysql_fetch_array($result1);
$c1=$array['country1'];	
$c1 = preg_split("/[\s,]+/",$c1);
$t1=$c1[8]*100;
$i1=$c1[9];
$short_interest_pre=$c1[24];

$c2=$array['country2'];
$c2 = preg_split("/[\s,]+/",$c2);
$t2=$c2[8]*100;
$i2=$c2[9];
$c3=$array['country3'];
$c3 = preg_split("/[\s,]+/",$c3);
$t3=$c3[8]*100;
$i3=$c3[9];
 
 //echo $i1;
$trev1=$trev2=$trev3=0;
  	for ($t=1; $t<=4; $t++)
	{

 				 for ($k=1; $k<=3; $k++)
		{
 // inhouse contract cost			
		$m1="m".$k."1".$t;
		$m2="m".$k."2".$t;
		$uc1="uc1".$t;
		$uc2="uc2".$t;
		$inv1="inven1".$t;
		$inv2="inven2".$t;
		$uci1="uc1".$t;
		$uci2="uc2".$t;
		$inhouse="inhouse".$k.$t;
		if ($k==1)
			{
			
			if ($$inv1<=$$m1) 
				{
				$$inhouse=($$m1-$$inv1)*$$uc1+$$uci1*$$inv1;
				}
			if ($$inv2>$$m1) 
				{
				$$inhouse=$$m1*$$uci1;
				}
			}
		if ($k==2)
			{
			//$$inhouse=$$m2*$$uc2;
			
			if ($$inv2<=$$m2) 
				{
				$$inhouse=($$m2-$$inv2)*$$uc2+$$uci2*$$inv2;
				}
			if ($$inv2>$$m2) 
				{
				$$inhouse=$$m2*$$uci2;
				}			
			}
		if ($k==3)
			{
			$$inhouse=0;
			}
// for cost of import

		$i_c="i_c".$k.$t;
		$i_c2="i_c2".$k.$t;
		$basei_c="basei_c".$k.$t;
		if ($k==1)
			{
			$$i_c=$$m2*$$uc2*($tp21);
			$$i_c2=$$i_c;
			$$basei_c=$$m2*$$uc2;
			}
		if ($k==2)
			{
			$$i_c=$$m1*$$uc1*($tp12);
			$$i_c2=$$i_c;
			$$basei_c=$$m1*$$uc1;
			}
		if ($k==3)
			{
			$$i_c=$$m1*$$uc1*($tp13)+$$m2*$$uc2*($tp23);
			$$i_c2=$$i_c;
			$$basei_c=$$m1*$$uc1+$$m2*$$uc2;
			//echo $tp13;
			}		
// get base cost of import to calculate unitcost
			
// for transportation
		$t_c="t_c".$k.$t;
		if ($k==1)
			{
			$$t_c=$$m2*$l_c2_c1;
			}
		if ($k==2)
			{
			$$t_c=$$m1*$l_c1_c2;
			}
		if ($k==3)
			{
			$$t_c=$$m1*$l_c1_c3+$$m2*$l_c2_c3;
			}
// feature cost
		$m12="m".$k."2".$t;
		$m11="m".$k."1".$t;
		$nf="feature".$k.$t;
		$fc=$feat_cost/(pow(1.1,$$nf));
		//echo $feat_cost;
		$fec="fec".$k.$t;
		$$fec=($$m12+$$m11)*$fc*$$nf;
//unitcost
		$n1="m".$k."1".$t;
		$n2="m".$k."2".$t;
		$uc="ucost_c".$k.$t;
		$dt="dt".$k.$t;
		if (!isset($$inhouse)) {$$inhouse=0;}
		if (($$n1+$$n2)>0)
		{$$uc=($$inhouse+$$basei_c+$$t_c+$$fec)/($$n1+$$n2);}else	{	$$uc=0;	}
		//echo "[".$$uc."]";
// sale price
		$sale="salemargin".$k.$t;
		$price="price".$k;
		$$price=$$uc*(1+$$sale/100);
		//echo "[".$$price."]";
// profit
		$rev="rev".$k.$t;	
		//echo $rev;
		if ($$dt<=($$n1+$$n2)) {$$rev=($$price-$$uc)*$$dt;}
		if ($$dt>($$n1+$$n2)) {$$rev=($$price-$$uc)*($$n1+$$n2);}
//salerev+cost
		$cost="cost".$k.$t;
		$salerev="salerev".$k.$t;
		//echo $salerev."=";
		if ($$dt<=($$n1+$$n2)) {$$salerev=$$price*$$dt;$$cost=$$uc*$$dt;}
		if ($$dt>($$n1+$$n2)) {$$salerev=$$price*($$n1+$$n2);$$cost=$$uc*($$n1+$$n2);}
		//echo $$salerev."/".$$cost."<br>";
		//$$rev=($$price-$$uc)*($$n1+$$n2);
// plus cost of imports
		$i_c="i_c".$k.$t;
		if ($k==1)
			{
			$mk1="m21".$t;
			$mk3="m31".$t;

			$$i_c=$$mk1*$$uc1*($tp12)+$$mk3*$$uc1*($tp13);
			//echo $$i_c;
			$revk2="revk2".$t;
			$revk3="revk3".$t;
			//echo $rev21;
			if (!isset ($$revk2)) {$$revk2=-$$mk1*$$uc1*($tp12);} else {$$revk2=$$revk2-$$mk1*$$uc1*($tp12);}
			if (!isset ($$revk3)) {$$revk3=-$$mk3*$$uc1*($tp13);} else {$$revk3=$$revk3-$$mk3*$$uc1*($tp13);}
			}
		if ($k==2)
			{
			$mk1="m12".$t;
			$mk3="m32".$t;
			$$i_c=$$mk1*$$uc2*($tp21)+$$mk3*$$uc2*($tp23);
			$revk1="rev1".$t;
			$revk3="rev3".$t;
			if (!isset ($$revk1)) {$$revk1=-$$mk1*$$uc2*($tp21);}else {$$revk1=$$revk1-$$mk1*$$uc2*($tp21);}
			if (!isset ($$revk3)) {$$revk3=-$$mk3*$$uc2*($tp23);} else {$$revk3=$$revk3-$$mk3*$$uc2*($tp23);}
			}
		if ($k==3)
			{
			$$i_c=0;
			}	
		//$$rev=$$rev+$$i_c;
		//echo $$i_c;
		//$trev="trev".$k;
		//$$trev=$$trev+$$rev;
		
		
		
 // echo"<td  class=right>".number_format($$m11*$$uc1+$$m12*$$uc2)."</td>";
		}
		
	}
 // deduct cost of import
   	for ($t=1; $t<=4; $t++)
	{

 				 for ($k=1; $k<=3; $k++)
		{
			$rev="rev".$k.$t;	
			$revk="revk".$k.$t;	
			$trev="trev".$k;
			//echo "[".$$revk."]";
			//if (isset($$revk) ) {echo "[".$$rev."]";$$rev=$$rev+$$revk; echo "-[".$$revk."]=[".$$rev;} else {}
			if (isset($$revk) ) {$$rev=$$rev+$$revk;}
			$$trev=$$trev+$$rev;
		}
	}	
 
 if (isset($_POST['transfer']))
	{
	$trans12=$_POST['trans12'];
	$trans13=$_POST['trans13'];
	$trans21=$_POST['trans21'];
	$trans23=$_POST['trans23'];
	//echo $trans12;
	$trans=$trans12.",".$trans13.",".$trans21.",".$trans23;

     $date = date('Y-m-d H:i:s');
	if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
	$sql="UPDATE `input` SET transfer_price='$trans', date='$date'  WHERE game_id='$gid' and team_id='$tid'  and player_id='$pid' and round='$round_for_input'  ";
	$result = mysql_query($sql);
	$sql=mysql_real_escape_string($sql);
	$t=logs($user_for_logs,$_SESSION['id'],$sql,$result);
	//header ("Location:game.php?act=finance");
	
	}
 
  if (isset($_POST['dividends']))
	{
	$dividends=$_POST['dividend_payment'];
//echo $dividend_payment;
	$date = date('Y-m-d H:i:s');
	if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
	$sql="UPDATE `input` SET fin_dividends='$dividends', date='$date'  WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input'  ";
	$result = mysql_query($sql);
	$sql=mysql_real_escape_string($sql);
	$t=logs($user_for_logs,$_SESSION['id'],$sql,$result);
	header ("Location:game.php?act=finance");
	}
 //echo $tp12."/".$tp13."/".$tp21."/".$tp23;
 
   if (isset($_POST['sharebuyback']))
	{
	$shareissue=$_POST['shareissue'];
//echo $shareissue;
	$date = date('Y-m-d H:i:s');
	if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
	$sql="UPDATE `input` SET fin_shareissue='$shareissue', date='$date'   WHERE game_id='$gid' and team_id='$tid' and player_id='$pid'  and round='$round_for_input'  ";
	$result = mysql_query($sql);
	$sql=mysql_real_escape_string($sql);
	$t=logs($user_for_logs,$_SESSION['id'],$sql,$result);
	header ("Location:game.php?act=finance");
	}
 

	
    if (isset($_POST['loantransfer']))
	{
	$internalloan12=$_POST['internalloan12'];
	$internalloan13=$_POST['internalloan13'];
	$internalloan21=$_POST['internalloan21'];
	$internalloan31=$_POST['internalloan31'];
	$date = date('Y-m-d H:i:s');
	if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
	$sql="UPDATE `input` SET fin_internal_loan_c1_c2='$internalloan12', fin_internal_loan_c1_c3='$internalloan13',fin_internal_loan_c2_c1='$internalloan21',fin_internal_loan_c3_c1='$internalloan31',date='$date'  WHERE game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input'  ";
	$result = mysql_query($sql);
	$sql=mysql_real_escape_string($sql);
	$t=logs($user_for_logs,$_SESSION['id'],$sql,$result);
	header ("Location:game.php?act=finance");
	} 
 // get last round loss
//echo $round;
$result1 = mysql_query("SELECT output_c1,output_c2,output_c3 FROM output where game_id='$gid' and round='$round' and team_id='$tid'");
$array = mysql_fetch_array($result1);
$co1=$array['output_c1'];	
$co1 = preg_split("/[\s,]+/",$co1);
$co2=$array['output_c2'];	
$co2 = preg_split("/[\s,]+/",$co2);
$co3=$array['output_c3'];	
$co3 = preg_split("/[\s,]+/",$co3);

$losscarry1=(float)$co1[13];
$losscarry2=(float)$co2[13];
$losscarry3=(float)$co3[13];
//echo $losscarry1;
// get long term deb/short
$longdebt1=(float)$co1[34];
$shortdebt1=(float)$co1[35];

$longdebt2=(float)$co2[34];
$shortdebt2=(float)$co2[35];

$longdebt3=(float)$co3[34];
$shortdebt3=(float)$co3[35];

//last round receivable and payable
$lastre1=(float)$co1[23];
$lastpay1=(float)$co1[36];
$lastre2=(float)$co2[23];
$lastpay2=(float)$co2[36];
$lastre3=(float)$co3[23];
$lastpay3=(float)$co3[36];
//$date = date('Y-m-d H:i:s');
	//$sql="UPDATE `input` SET fin_longterm_debt='171000', date='$date'  WHERE game_id='$gid' and team_id='$tid'  and player_id='$pid'   and round='$round_for_input'  ";
	//$result = mysql_query($sql);
   if (isset($_POST['longtermdebt']))
	{
	$longtermdebt=$_POST['longterm_debt']*1000;
	//echo $longtermdebt."/";
	//$longtermdebt2=$longtermdebt*1000+$longdebt1;
	//echo $longtermdebt2;
	$date = date('Y-m-d H:i:s');
	if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
	$sql="UPDATE `input` SET fin_longterm_debt='$longtermdebt', date='$date'  WHERE game_id='$gid' and team_id='$tid'  and player_id='$pid'   and round='$round_for_input'  ";
	$result = mysql_query($sql);
	$sql=mysql_real_escape_string($sql);
	$t=logs($user_for_logs,$_SESSION['id'],$sql,$result);
	header ("Location:game.php?act=finance");
	} 
else
	{
	//$longtermdebt=0;
	}
	



//echo $longdebt1;
$longdebt1=$longtermdebt*1000+$longdebt1;

$trev1=$trev1+$longtermdebt*1000;
 // get receivable/payable
$result1 = mysql_query("SELECT receivable,payable,share_face_value FROM game where id='$gid'");
$array = mysql_fetch_array($result1);
$receivable=$array['receivable']/100;	
$payable=$array['payable']/100;	 
$sharefv=$array['share_face_value'];
 //net finance
 $ld1=$longdebt1*$i1/100;
 $sd1=$shortdebt1*($i1/100+$short_interest_pre/100);
 //echo $i1;
 $ld2=$longdebt2*$i2/100;
 $sd2=$shortdebt2*($i2/100+$short_interest_pre/100);
 $ld3=$longdebt3*$i3/100;
 $sd3=$shortdebt3*($i3/100+$short_interest_pre/100); 
 //echo number_format($sd1)."<br>";
 //echo number_format($ld1)."<br>";
 $netfinance1=$ld1+$sd1;
 $netfinance2=$ld2+$sd2;
 $netfinance3=$ld3+$sd3;
 
 // present finance table
 
 	echo"<div class='simpleTabs'>";
	echo"<ul class='simpleTabsNavigation'>";
	
	echo"<li><a href='#'>".$LANG['liabilities']."</a></li>";
	echo"<li><a href='#'>".$LANG['equity']."</a></li>";
	echo" <li><a href='#'>".$LANG['pnl']."</a></li>";
	echo"<li><a href='#'>".$LANG['internaltransfer']."</a></li>";
	echo"</ul>";
				
echo"<div class='simpleTabsContent'>";			
	
 echo"<section class='left-col-even'>";
 
 echo"<br><table>";
 //echo"<th>Financial decision</th><th>Values</th>";
 echo"<tr><td colspan=2 class=result2>".$LANG['debt']."</td></tr>"; 
echo"<tr><td>".$LANG['longtermdebtlastround']."</td><td class=right> US$ ".number_format($longdebt1)."</td></tr>";
 echo"<tr><td>".$LANG['longtermdebt']."</td><td class=demo>";
 //echo round($longtermdebt/1000);
 if ($overtime==0){echo"<form action='game.php?act=finance' method='POST'>";}
    	echo"<select style='width:100%;' name='longterm_debt' onchange='this.form.submit()'>";
  				for ($s=-round($longdebt1/1000000); $s<=1000; $s++) 
				{
				
				echo $s."/".$longtermdebt."<br>";
				if ($s==(round($longtermdebt/1000))) {$selected="selected";} else {$selected="";}
				if ($s%10==0)
				{
				echo"<option ".$selected." value=".($s).">".number_format($s*1000000)."</option>";
				}
				}
  echo"</select>";
  echo"<input type=hidden name='longtermdebt' value='1'/>";
  echo"</form>";
 echo"</td></tr>"; 
  echo"<tr><td>".$LANG['shorttermdebtlastround']."</td><td class=right>US$ ".number_format($shortdebt1)."</td></tr>";
 //echo $trev1."/".$losscarry1."/".$netfinance1;
 //echo $mincash;
 if (($trev1+$losscarry1-$netfinance1)<$mincash)
 {
 $newshortdebt1=$mincash-($trev1+$losscarry1-$netfinance1);
 }
 else
 {
 $newshortdebt1=0;
 }
  if (($trev2+$losscarry2-$netfinance2)<$mincash)
 {
 $newshortdebt2=$mincash-($trev2+$losscarry2-$netfinance2);
 }
 else
 {
 $newshortdebt2=0;
 }
   if (($trev3+$losscarry3-$netfinance3)<$mincash)
 {
 $newshortdebt3=$mincash-($trev2+$losscarry3-$netfinance3);
 }
 else
 {
 $newshortdebt3=0;
 }
 echo"<tr><td>".$LANG['newshorttermloan']."</td><td class=right>". number_format($newshortdebt1)."</td></tr>";
 if (($trev1+$losscarry1-$netfinance1)>$shortdebt1)
 {
 $paybackshort=$shortdebt1;
 }
 else
 {
 $paybackshort=0;
 }
 echo"<tr><td>".$LANG['paybackshortterm']."</td><td class=right>".number_format($paybackshort)."</td></tr>"; 
 echo"<tr><td>".$LANG['preminumforshortterm']."</td><td class=right>".number_format($short_interest_pre)." %</td></tr>"; 
  echo"</table>";
 
 echo"</section>";
 
 echo"<aside class='sidebar-even'>";
 // table interest
 echo"<br><table>";
 
 echo"<th>Country</th><th>".$LANG['interestrate']."</th><th>".$LANG['taxrate']."</th>";
 echo"<tr><td>".$LANG['1']."</td><td class=right>".number_format($i1)."%</td><td class=right>".number_format($t1)."%</td></tr>";
 echo"<tr><td>".$LANG['2']."</td><td class=right>".number_format($i2)."%</td><td class=right>".number_format($t2)."%</td></tr>";
 echo"<tr><td>".$LANG['3']."</td><td class=right>".number_format($i3)."%</td><td class=right>".number_format($t3)."%</td></tr>"; 
 echo"</table>";
// end table interest
  
echo"</aside>";
// graph
echo"<div class='clearfix'></div>";
 echo"<div id='main-content'>";
//  echo"<br><table>";
 
 //echo"<th>Country</th><th>Interest rate</th><th>Tax rate</th>";
 //echo"<tr><td>".$LANG['1']."</td><td class=right>".number_format($i1)."%</td><td class=right>".number_format($t1)."%</td></tr>";
 //echo"<tr><td>".$LANG['2']."</td><td class=right>".number_format($i2)."%</td><td class=right>".number_format($t2)."%</td></tr>";
 //echo"<tr><td>".$LANG['3']."</td><td class=right>".number_format($i3)."%</td><td class=right>".number_format($t3)."%</td></tr>"; 
 //echo"</table>";
  echo"<div class='clearfix'></div>"; 
  echo"</div>";

 echo"</div>";
 
 
 
 echo"<div class='simpleTabsContent'>";			
	
 //echo"<section class='left-col-even'>";
 

 
 $div_payment1=$dividends/100*$sharefv*$shareout;
  $div_payment2="-";
   $div_payment3="-";

 
 //echo"</section>";
 
 //echo"<aside class='sidebar-even'>";
 

// start dividends
 echo"<br><table>";
 echo"<tr><td colspan=2 class=result2>".$LANG['dividends']."</td></tr>"; 
 if ($overtime==0){echo"<form action='game.php?act=finance' method='POST'>";}
 echo"<tr><td>".$LANG['dividendpayment']."</td><td  class=demo>";
  echo"<select style='width:100%;' name='dividend_payment' onchange='this.form.submit()'>";
  				for ($s=1; $s<=300; $s++) 
				{
				//echo $dividends;
				if(isset($dividends))
				{
				if($s==$dividends) {$selected="selected";} else {$selected="";}
				}
				else
				{
				if($s==0) {$selected="selected";} else {$selected="";}
				}
				//if ($dc1==$s) {$selected="selected";} else {$selected="";}
				echo"<option ".$selected." value=".$s.">".$s." %</option>";
				}
  echo"</select>";
 echo"<input type='hidden' name='dividends' value='1' />";
 echo"</form>";
 echo"</td></tr>";

  echo"<tr><td class=result2>".$LANG['totaldividends']."</td><td class=result2> US$ ".number_format($div_payment1)."</td></tr>"; 
  echo"</table>"; 

  
//echo"</aside>";
 // start table for share
 echo"<br><table>";
 echo"<tr><td colspan=2 class=result2>".$LANG['share']."</td></tr>"; 
  echo"<tr><td>".$LANG['shareoutstand']."</td><td class=right>".number_format($shareout)."</td></tr>";
 echo"<tr><td>".$LANG['shareissueprice']."</td><td class=right> US$  ".number_format($shareprice,2)."</td></tr>";
 echo"<tr><td>".$LANG['sharebuyback']."</td><td class=right> US$   ".number_format($shareprice,2)."</td></tr>"; 
 echo"<tr><td>".$LANG['shareissuebuyback']."</td><td class=demo>";
 if ($overtime==0){echo"<form action='game.php?act=finance' method='POST'>";}
    echo"<select style='width:100%;' name='shareissue' onchange='this.form.submit()'>";
  				$sharemin=$shareout/1000;
				
				$sharemax=$shareout/1000;
				for ($s=-$sharemin; $s<=$sharemax; $s++) 
				{
			
				if ($s==$shareissue) {$selected="selected";} else {$selected="";}
				if ($s<=10 and $s>=-10)
				{
				echo"<option ".$selected." value=".$s.">".number_format($s*1000)."</option>";
				}
				else 
				{
					if ($s%1000==0 )
					{
					echo"<option ".$selected." value=".$s.">".number_format($s*1000)."</option>";
					}
				}
				}
  echo"</select>";
  echo"<input type='hidden' name='sharebuyback' value='1' />";
  echo"</form>";
 echo"</td></tr>"; 
 $sharebb=$shareissue*$shareprice*1000;
// echo $shareissue."/".$shareprice;
   echo"<tr><td>".$LANG['totalshareissuebuyback']."</td><td class=right>".number_format($sharebb)."</td></tr>";
  echo"</table>";
 echo"</div>";
 
 
 
 
 //echo"</section>";
 
 
 //sidebar
echo"<div class='simpleTabsContent'>";		
 // pnl
 
    echo"<br><table>";
 echo"<th>".$LANG['pnl']."</th><th width=18%>".$LANG['1']."</th><th width=18%>".$LANG['2']."</th><th width=18%>".$LANG['3']."</th>";
 echo"<tr><td colspan=4 class=result2>".$LANG['salerevenue']."</td></tr>";
 
  echo"<tr><td class=result0> - ".$LANG['frommarket']."</td>";

 for ($c=1; $c<=3; $c++) 
{
	for ($t=1; $t<=4; $t++) 
	{
	$sr="pnl".$c;
	$salerev="salerev".$c.$t;
	
	if (isset($$sr)) {$$sr=$$sr+$$salerev;} else {$$sr=$$salerev;}
	
	}
	echo "<td class=right>".number_format($$sr)."</td>";
}
echo "</tr>";

   echo"<tr><td class=result0> - ".$LANG['frominternaltransfer']."</td>";
 for ($c=1; $c<=3; $c++) 
{
	for ($t=1; $t<=4; $t++) 
	{
	$sr="pnl2".$c;
	$salerev="i_c".$c.$t;
	
	if (isset($$sr)) {$$sr=$$sr+$$salerev;} else {$$sr=$$salerev;}
	}
	echo "<td class=right>".number_format($$sr)."</td>";
}
echo "</tr>";   
   echo"<tr><td class=result2>".$LANG['totalrevenue']."</td>";
 for ($c=1; $c<=3; $c++) 
{
	for ($t=1; $t<=4; $t++) 
	{
	$sr="pnl2".$c;
	$sr1="pnl".$c;
	$totalr="totalr".$c;
	$$totalr=$$sr1+$$sr;
	}
	echo "<td class=right0>".number_format($$totalr)."</td>";
}
echo "</tr>";

 echo"<tr><td colspan=4 class=result2>".$LANG['costandexpense']."</td></tr>";
 echo"<tr><td class=result0> - ".$LANG['variablecost']."</td>";
 for ($c=1; $c<=3; $c++) 
{
	for ($t=1; $t<=4; $t++) 
	{
	$sr="pnl3".$c;
	$salerev="inhouse".$c.$t;
	if (isset($$sr)) {$$sr=$$sr+$$salerev;} else {$$sr=$$salerev;}
	}
	echo "<td class=right>".number_format($$sr)."</td>";
}
echo "</tr>"; 

echo"<tr><td class=result0> - ".$LANG['featurecost']."</td>";
 for ($c=1; $c<=3; $c++) 
{
	for ($t=1; $t<=4; $t++) 
	{
	$sr="pnl4".$c;
	$salerev="fec".$c.$t;
	if (isset($$sr)) {$$sr=$$sr+$$salerev;} else {$$sr=$$salerev;}
	}
	echo "<td class=right>".number_format($$sr)."</td>";
}
echo "</tr>"; 
echo"<tr><td class=result0> - ".$LANG['transportation']."</td>";
 for ($c=1; $c<=3; $c++) 
{
	for ($t=1; $t<=4; $t++) 
	{
	$sr="pnl5".$c;
	$salerev="t_c".$c.$t;
	if (isset($$sr)) {$$sr=$$sr+$$salerev;} else {$$sr=$$salerev;}
	}
	echo "<td class=right>".number_format($$sr)."</td>";
}
echo "</tr>"; 
echo"<tr><td class=result0> - ".$LANG['researchcost']."</td>";
 

$result = mysql_query("SELECT country1 FROM `input` where game_id='$gid' and team_id='$tid'  and player_id='$pid' and round='$round_for_input'");
$row = mysql_fetch_array($result);

// layoff cost
	$manday1 = mysql_query("SELECT hr_recruitment_layoff_cost FROM game where id='$gid'");
	$manday1 = mysql_fetch_array($manday1);	
	$rela_cost=$manday1['hr_recruitment_layoff_cost'];	
	
// get RND in house cost
					$ct1=$row['country1'];
					$c1=base64_decode($ct1);
					$country1=unserialize($c1);
					
					$worker2=$country1['HR_no_of_staffs'];
					$wage2=$country1['HR_wage_pe'];
					
					$training2=$country1['HR_training_budget_pe'];
					$turnover2=$country1['HR_turnover_rate'];
					$layoff2=$country1['hr_layoff'];
					//echo $layoff2."a";
					$f11=$country1['feature_tech1'];
					$f11 =preg_split("/[,]+/",$f11);
					$rnd_buycost=$f11[5];
					//echo $rnd_buycost;
$turn=$turnover2;
$rndcost="rndcost".$tid;
$$rndcost=$worker2*$wage2*12+$worker2*$training2*12+$turn*$worker2*$rela_cost+$rela_cost*$layoff2+$rnd_buycost;
// GET RND buy cost
$pnl61=$$rndcost;
$pnl62=$pnl63=0;
echo"<td class=right>".number_format($$rndcost)."</td><td></td><td></td></tr>";
echo "</tr>"; 


//start admin cost
				$result1 = mysql_query("SELECT country1,country2,country3 FROM round_assumption where game_id='$gid' and round=$round_for_input");
				$array = mysql_fetch_array($result1);
				$logis=$array['country1'];	
				$admin2=$array['country2'];	
				$admin3=$array['country3'];	
				$lo= preg_split("/[\s,]+/",$logis);
				$admin2= preg_split("/[\s,]+/",$admin2);
				$admin3= preg_split("/[\s,]+/",$admin3);

		//RND		
				$fixadmin1=$lo[20]*1000000;
				//echo $fixadmin1;
				$variableadmin1=$lo[21]*1000000;
				$fixadmin2=$admin2[20]*1000000;
				$variableadmin2=$admin2[21]*1000000;
				$fixadmin3=$admin3[20]*1000000;
	// variable admin cost			
  // get number of factory				
   $result2 = mysql_query("SELECT factory FROM output where game_id='$gid' and team_id='$tid' and round='$round' and final='1'");
   $array2 = mysql_fetch_array($result2);
   $no_fac2=$array2['factory'];	
   $factory2=unserialize($no_fac2);
   $fac_c1=$factory2['c1'];
   $fac_c2=$factory2['c2'];

				$va1=$fac_c1*$variableadmin1;
				$va2=$fac_c2*$variableadmin2;	
$pnl71=$fixadmin1+$va1;
$pnl72=$fixadmin2+$va2;
$pnl73=$fixadmin3;
echo"<tr><td class=result0> - ".$LANG['admincost']."</td><td class=right>".number_format($fixadmin1+$va1)."</td><td class=right>".number_format($fixadmin2+$va2)."</td><td class=right>".number_format($fixadmin3)."</td></tr>";




echo"<tr><td class=result0> - ".$LANG['costofimported']."</td>";
 for ($c=1; $c<=3; $c++) 
{
	for ($t=1; $t<=4; $t++) 
	{
	$sr="pnl8".$c;
	$salerev="i_c2".$c.$t;
	if (isset($$sr)) {$$sr=$$sr+$$salerev;} else {$$sr=$$salerev;}
	}

	echo "<td class=right>".number_format($$sr)."</td>";
}
echo "</tr>"; 

   echo"<tr><td class=result2>".$LANG['totalcost']."</td>";
 for ($c=1; $c<=3; $c++) 
{

	$sr3="pnl3".$c;
	$sr4="pnl4".$c;
	$sr5="pnl5".$c;
	$sr6="pnl6".$c;
	$sr7="pnl7".$c;
	$sr8="pnl8".$c;
	$totalc="tcost".$c;
	$$totalc=$$sr3+$$sr4+$$sr5+$$sr6+$$sr7+$$sr8;
	echo "<td class=right0>".number_format($$totalc)."</td>";
}
echo "</tr>"; 

echo"<tr><td class=result2>".$LANG['ebitda']."</td>"; 
 for ($c=1; $c<=3; $c++) 
{

	$totalc="tcost".$c;
	$totalr="totalr".$c;
	$ebitda="ebitda".$c;
	$$ebitda=$$totalr-$$totalc;
 if (($$ebitda)>0) {$class1="pos0";} else {$class1="neg0";}

 
	echo "<td class=".$class1.">".number_format($$ebitda)."</td>";
}
echo "</tr>";  
   echo"<tr><td class=result0> - ".$LANG['depreciation']."</td>";
   
      // get last round fixasset
   
   $result11 = mysql_query("SELECT output_c1,output_c2 FROM output where game_id='$gid' and team_id='$tid' and round='$round' and final='1'");
   $array1 = mysql_fetch_array($result11);
   $a1=$array1['output_c1'];	
   $a2=$array1['output_c2'];	
   $a11= preg_split("/[\s,]+/",$a1);
   $a22= preg_split("/[\s,]+/",$a2);
   $fix1=$a11[21]; 
   $fix2=$a22[21]; 
   $fix3=0;
   //echo $fix1."trieuanh";
   // get depreciation rate
   $result1 = mysql_query("SELECT depreciation_rate FROM game where id='$gid'");
   $array = mysql_fetch_array($result1);
   $dep_rate=$array['depreciation_rate'];   
   //echo $dep_rate;
    for ($c=1; $c<=3; $c++) 
{
 
$totaladmin="deprecation".$c;
$fix="fix".$c;
$$totaladmin=$$fix*($dep_rate/100);
	echo "<td class=right>".number_format($$totaladmin)."</td>";
}
echo "</tr>";

   echo"<tr><td class=result2>".$LANG['ebit']."</td>";

     for ($c=1; $c<=3; $c++) 
{
 
$totaladmin="deprecation".$c;
$ebitda="ebitda".$c;
$ebit="ebit".$c;
$$ebit=$$ebitda-$$totaladmin;
 if (($$ebit)>0) {$class1="pos0";} else {$class1="neg0";}
	echo "<td class=".$class1.">".number_format($$ebit)."</td>";
}
echo "</tr>";
echo"<tr><td class=result0> - ".$LANG['netfinance']."</td><td class=right>".number_format( $netfinance1)."</td><td class=right>".number_format( $netfinance2)."</td><td class=right>".number_format( $netfinance3)."</td></tr>";
$pb4t1=$ebit1-$netfinance1;
$pb4t2=$ebit2-$netfinance2;
$pb4t3=$ebit3-$netfinance3;
 if (($pb4t1)>0) {$class1="pos0";} else {$class1="neg0";}
  if (($pb4t2)>0) {$class2="pos0";} else {$class2="neg0";}
   if (($pb4t3)>0) {$class3="pos0";} else {$class3="neg0";}
   
echo"<tr><td class=result2>".$LANG['pb4t']."</td><td class=".$class1.">".number_format( $pb4t1)."</td><td class=".$class2.">".number_format( $pb4t2)."</td><td class=".$class3.">".number_format( $pb4t3)."</td></tr>";
 if ($pb4t1<0) {$itx1=0;} else {$itx1=$pb4t1*$t1/100;}
 if ($pb4t2<0) {$itx2=0;} else {$itx2=$pb4t2*$t2/100;}
 if ($pb4t3<0) {$itx3=0;} else {$itx3=$pb4t3*$t3/100;}
 
echo"<tr><td class=result0> - ".$LANG['incometax']."</td><td class=right>".number_format( $itx1)."</td><td class=right>".number_format( $itx2)."</td><td class=right>".number_format( $itx3)."</td></tr>";
  if (($pb4t1-$itx1)>0) {$class1="pos0";} else {$class1="neg0";}
  if (($pb4t2-$itx2)>0) {$class2="pos0";} else {$class1="neg0";}
   if (($pb4t3-$itx3)>0) {$class3="pos0";} else {$class1="neg0";}
 echo"<tr><td class=result2>".$LANG['paftert']."</td><td class=".$class1.">".number_format( $pb4t1-$itx1)."</td><td class=".$class2.">".number_format( $pb4t2-$itx2)."</td><td class=".$class3.">".number_format( $pb4t3-$itx3)."</td></tr>";   
 
 echo"</table>";

// cashflow
 	
    echo"<br><table>";
 echo"<th>".$LANG['cashflow']."</th><th width=18%>".$LANG['1']."</th><th width=18%>".$LANG['2']."</th><th width=18%>".$LANG['3']."</th>";
 echo"<tr><td colspan=5 class=result2>".$LANG['cashoperating']."</td></tr>";
 
 echo"<tr><td>".$LANG['ebitda']."</td>";
 
  for ($c=1; $c<=3; $c++) 
{
$ebitda="ebitda".$c;
echo"<td class=right>".number_format($$ebitda)."</td>";
}
echo"</tr>";


 for ($c=1; $c<=3; $c++) 
{
	for ($t=1; $t<=4; $t++) 
	{
	$sr="sr".$c;
	$cst="cst".$c;
	$cost="cost".$c.$t;
	$salerev="salerev".$c.$t;
	if (isset($$sr)) {$$sr=$$sr+$$salerev;} else {$$sr=$$salerev;}
	if (isset($$cst)){$$cst=$$cst+$$cost;} else {$$cst=$$cost;}
	}
}
 //total revenue


 //$payable1=$payable*$cst1;

 
 

 
 echo"<tr><td>".$LANG['changeinrece']."</td>";
 //echo"<td class=right>".number_format($receivable1)."</td>";
  
  for ($c=1; $c<=3; $c++) 
{
$rece="receivable".$c;
$sr="sr".$c;
$lastre1="lastre".$c;
$$rece=$receivable*$$sr-$$lastre1;
echo"<td class=right>".number_format($$rece)."</td>";
}
 echo"</tr>"; 
 
 echo"<tr><td>".$LANG['changeininve']."</td>";
 //echo"<td class=right>".number_format($inven1)."</td>";
   for ($c=1; $c<=3; $c++) 
{
	   for ($t=1; $t<=4; $t++) 
	{
	if ($c==1 or $c==2)
	{
$pro="pro".$c.$t;
$uc="uc".$c.$t;
$inven="inventory".$c;
if (isset($$inven)) {$$inven=$$inven+$$pro*$$uc;} else {$$inven=$$pro*$$uc;}
	}
	if ($c==3) {$inventory3=0;}
	//$inven1=$pro11*$uc11+$pro12*$uc12+$pro13*$uc13+$pro14*$uc14;
	}
echo"<td class=right>".number_format($$inven)."</td>";
}
 echo"</tr>"; 
 
 echo"<tr><td>".$LANG['changeinpay']."</td>";
// echo"<td class=right> ".number_format($payable1)." </td>";
   for ($c=1; $c<=3; $c++) 
{
$paya="payable".$c;
$cst="cst".$c;
$lastpay1="lastpay".$c;
$$paya=$payable*$$cst-$$lastpay1;
echo"<td class=right>".number_format($$paya)."</td>";
}
 echo"</tr>"; 
 //long/short term debt
 //get long term deb/short term debt  output34/35
 //echo $short_interest_pre;

 echo"<tr><td>".$LANG['netfinance']."</td ><td class=right>".number_format( $netfinance1)."</td><td class=right>".number_format( $netfinance2)."</td><td class=right>".number_format( $netfinance3)."</td></tr>"; 
 //income tax
 if ($losscarry1<0) {$it1=$trev1+$losscarry1-$netfinance1;} else {$it1=$trev1-$netfinance1;}
 if ($losscarry2<0) {$it2=$trev2+$losscarry2-$netfinance2;} else {$it2=$trev2-$netfinance2;}
 //echo $losscarry2;
 if ($losscarry3<0) {$it3=$trev3+$losscarry3-$netfinance3;} else {$it3=$trev3-$netfinance3;}
 
 if ($it1<0) {$itx1=0;} else {$itx1=$it1*$t1/100;}
 if ($it2<0) {$itx2=0;} else {$itx2=$it2*$t2/100;}
 if ($it3<0) {$itx3=0;} else {$itx3=$it3*$t3/100;}
 echo"<tr><td>".$LANG['incometax']."</td><td class=right>".number_format($itx1)."</td><td class=right>".number_format($itx2)."</td><td class=right>".number_format($itx3)."</td></tr>"; 
$total1=$ebitda1-$receivable1-$inventory1+$payable1-$ld1-$sd1-$itx1;
$total2=$ebitda2-$receivable2-$inventory2+$payable2-$ld2-$sd2-$itx2;
$total3=$ebitda3-$receivable3-$inventory3+$payable3-$ld3-$sd3-$itx3;
 if (($total1)>0) {$class1="pos0";} else {$class1="neg0";}
 if (($total2)>0) {$class2="pos0";} else {$class2="neg0";}
 if (($total3)>0) {$class3="pos0";} else {$class3="neg0";}
 
 echo"<tr><td class=result2>".$LANG['total']."</td><td class=".$class1.">".number_format($total1)."</td><td class=".$class2.">".number_format($total2)."</td><td class=".$class3.">".number_format($total3)."</td></tr>"; 
 // get plant investment next round
 
  $res = mysql_query("SELECT investment_c2,investment_c1  FROM input WHERE game_id='$gid' and team_id='$tid' and round='$round_for_input' ");
 				if( mysql_num_rows($res) == 1) 
				{
				$invest = mysql_fetch_array($res);
 				$invest1=$invest['investment_c1']; 
				//echo $invest1;
				$invest1= preg_split("/[\s,]+/",$invest1);
				$invest2=$invest['investment_c2']; 
				$invest2= preg_split("/[\s,]+/",$invest2);
				//echo $invest1[0];
				$plant_c1=$invest1[0];
				$plant_c2=$invest2[0];
				}
				else
				{
				$plant_c1=0;
				$plant_c2=0;
				}
				//echo $plant_c1;
 // get cost per plant and depreciation rate
  
   $result1 = mysql_query("SELECT country1, country2 FROM round_assumption where game_id='$gid' and round=$round");
   $array = mysql_fetch_array($result1);
   
   $cost_per_plant1=$array['country1'];	
   $cost_per_plant1= preg_split("/[\s,]+/",$cost_per_plant1);
   $cost_plant1=$cost_per_plant1[22]*1000000;
   $cost_per_plant2=$array['country2'];	
   $cost_per_plant2= preg_split("/[\s,]+/",$cost_per_plant2);
   $cost_plant2=$cost_per_plant2[22]*1000000;  
      // get depreciation rate
   $result1 = mysql_query("SELECT depreciation_rate FROM game where id='$gid'");
   $array = mysql_fetch_array($result1);
   $dep_rate=$array['depreciation_rate']/100;
//echo $dep_rate;
//HARD INPUT hardinput
$deconstruction_rate=0.5;
   $decurrent_cost_plant1=$cost_plant1*pow((1-$dep_rate),$round_for_input)*$deconstruction_rate;
   $decurrent_cost_plant2=$cost_plant2*pow((1-$dep_rate),$round_for_input)*$deconstruction_rate;
//echo $cost_plant1;
if ($plant_c1<0) {$deconstrucion_c1=-$plant_c1*$decurrent_cost_plant1;} else {$deconstrucion_c1=-$plant_c1*$cost_plant1;}
if ($plant_c2<0) {$deconstrucion_c2=-$plant_c2*$decurrent_cost_plant2;} else {$deconstrucion_c2=-$plant_c2*$cost_plant2;}
 $deconstrucion_c3=0;
 echo"<tr><td colspan=5 class=result2>".$LANG['cashbyinvestment']."</td></tr>";
 echo"<tr><td>".$LANG['plantinvest']."</td><td class=right>".number_format($deconstrucion_c1)."</td><td class=right>".number_format($deconstrucion_c2)."</td><td class=right>".number_format($deconstrucion_c3)."</td></tr>"; 
 if (($total1+$deconstrucion_c1)>0) {$class1="pos0";} else {$class1="neg0";}
 if (($total2+$deconstrucion_c2)>0) {$class2="pos0";} else {$class2="neg0";}
 if (($total3+$deconstrucion_c3)>0) {$class3="pos0";} else {$class3="neg0";}
 echo"<tr><td class=result2>".$LANG['cashflowbeforefinance']."</td><td class=".$class1.">".number_format($total1+$deconstrucion_c1)."</td><td class=".$class2.">".number_format($total2+$deconstrucion_c2)."</td><td class=".$class3.">".number_format($total3+$deconstrucion_c3)."</td></tr>"; 
 
 echo"<tr><td colspan=5 class=result2>".$LANG['cashflowbyfinance']."</td></tr>";
 echo"<tr><td>".$LANG['dividendspayment']."</td><td class=right>".number_format(-$div_payment1)."</td><td class=right>".$div_payment2."</td><td class=right>".$div_payment3."</td></tr>"; 
 //if ($sharebb<0) {$class="neg";$b1="(";$b2=")";} else {$class="pos";$b1="";$b2="";} 
 echo"<tr><td>".$LANG['equityissue']."</td><td class=right>".number_format($sharebb)."</td><td class=right>-</td><td class=right>-</td></tr>"; 
 echo"<tr><td>".$LANG['changeinlongdebt']."</td><td class=right>".number_format($longtermdebt*1000)."</td><td class=right>-</td><td class=right>-</td></tr>"; 
 echo"<tr><td>".$LANG['changeinshortdebt']."</td><td class=right>".number_format($newshortdebt1)."</td><td class=right>".number_format($newshortdebt2)."</td><td class=right>".number_format($newshortdebt3)."</td></tr>"; 


$internalloanc1= ($internalloan31 +$internalloan21-$internalloan12+ -$internalloan13)*1000000;
$internalloanc2= ($internalloan12)*1000000;
$internalloanc3= ($internalloan13)*1000000;

 
$totalc1=-$div_payment1+$sharebb+$longtermdebt*1000+$newshortdebt1+$internalloanc1;
$totalc2=$newshortdebt2+$internalloanc2;
$totalc3=$newshortdebt3+$internalloanc3;
//echo "sd".$internalloan12."sd";
 echo"<tr><td>".$LANG['changeininternal']."</td><td class=right>".number_format($internalloanc1)."</td><td class=right>".number_format($internalloanc2)."</td><td class=right>".number_format($internalloanc3)."</td></tr>"; 
  if (($totalc1)<0) {$class1="neg0";$b1="(";$b2=")";} else {$class1="pos0";$b1="";$b2="";}
 if (($totalc2)<0) {$class2="neg0";$b3="(";$b4=")";} else {$class2="pos0";$b3="";$b4="";}
 if (($totalc3)<0) {$class3="neg0";$b5="(";$b6=")";} else {$class3="pos0";$b5="";$b6="";}
 
 echo"<tr><td class=result2>".$LANG['total']."</td><td class=".$class1.">".$b1."".number_format(abs($totalc1))."".$b2."</td><td class=".$class2.">".$b3."".number_format(abs($totalc2))."".$b4."</td><td class=".$class3.">".$b5."".number_format(abs($totalc3))."".$b6."</td></tr>"; 
 
 $cce1=$total1+$deconstrucion_c1+$totalc1;
 $cce2=$total2+$deconstrucion_c2+$totalc2;
 $cce3=$total3+$deconstrucion_c3+$totalc3;
   if (($cce1)<0) {$class1="neg";$b1="(";$b2=")";} else {$class1="pos";$b1="";$b2="";}
 if (($cce2)<0) {$class2="neg";$b3="(";$b4=")";} else {$class2="pos";$b3="";$b4="";}
 if (($cce3)<0) {$class3="neg";$b5="(";$b6=")";} else {$class3="pos";$b5="";$b6="";}
 
 echo"<tr><td>".$LANG['changeincash']."</td><td class=".$class1.">".$b1."".number_format(abs($cce1))."".$b2."</td><td class=".$class2.">".$b3."".number_format(abs($cce2))."".$b4."</td><td class=".$class3.">".$b5."".number_format(abs($cce3))."".$b6."</td></tr>"; 
 

 if (($losscarry1)<0) {$class1="neg";$b1="(";$b2=")";} else {$class1="pos";$b1="";$b2="";}
 if (($losscarry2)<0) {$class2="neg";$b3="(";$b4=")";} else {$class2="pos";$b3="";$b4="";}
 if (($losscarry3)<0) {$class3="neg";$b5="(";$b6=")";} else {$class3="pos";$b5="";$b6="";}
 
 echo"<tr><td>".$LANG['cashbegining']."</td><td  class=".$class1.">".$b1."".number_format(abs($losscarry1))."".$b2."</td><td class=".$class2.">".$b3."".number_format(abs($losscarry2))."".$b4."</td><td class=".$class3.">".$b5."".number_format(abs($losscarry3))."".$b6."</td></tr>"; 
  if (($losscarry1+$cce1)<0) {$class1="neg";$b1="(";$b2=")";} else {$class1="pos";$b1="";$b2="";}
 if (($losscarry2+$cce2)<0) {$class2="neg";$b3="(";$b4=")";} else {$class2="pos";$b3="";$b4="";}
 if (($losscarry3+$cce3)<0) {$class3="neg";$b5="(";$b6=")";} else {$class3="pos";$b5="";$b6="";}
 echo"<tr><td>".$LANG['cashattheend']."</td><td  class=".$class1.">".$b1."".number_format(abs($losscarry1+$cce1))."".$b2."</td><td class=".$class2.">".$b3."".number_format(abs($losscarry2+$cce2))."".$b4."</td><td class=".$class3.">".$b5."".number_format(abs($losscarry3+$cce3))."".$b6."</td></tr>"; 
 
 $fortrans1=$losscarry1+$cce1;
 $fortrans2=$losscarry2+$cce2;
 $fortrans3=$losscarry3+$cce3;
 echo"</table>";
 echo"</div>";			
 
 echo"<div class='simpleTabsContent'>";			
 // present sum finance table
 
echo"<div style='margin-top: 20px;'>";


// transfer and internal loan table
echo"<section class='left-col-even'>";
echo"<table>"; 
//echo"<th colspan=1><th>";
 if ($overtime==0){echo"<form action='game.php?act=finance' method='POST'>";}
  echo"<tr><td colspan=2 class=result2>".$LANG['transferprice']."</td></tr>"; 
//1
 echo"<tr>";
 echo"<td>".$LANG['1']." ".$LANG['to']." ".$LANG['2']."</td>"; 
 echo"<td class=demo>"; 
 				echo"<select style='width:100%' name='trans12' onchange='this.form.submit()'>";
		if(isset($tp12))	{$check=$tp12*100;}  
				
			for ($s=100; $s<=200; $s++) 
				{
				if($s==$check){$select="selected";}  else {$select="";}
				//if ($dc1==$s) {$selected="selected";} else {$selected="";}
				echo"<option ".$select." value=".($s/100).">".($s/100)."</option>";
				}
				echo"</select>";
 echo"</td>";
 echo"</tr>";
//2
 echo"<tr>";
 echo"<td>".$LANG['1']." ".$LANG['to']." ".$LANG['3']."</td>"; 
 echo"<td class=demo>"; 
  				echo"<select style='width:100%' name='trans13' onchange='this.form.submit()'>";
						if(isset($tp13))	{$check=$tp13*100;}  
				
				for ($s=100; $s<=200; $s++) 
				{
				if($s==$check){$select="selected";}  else {$select="";}
				//if ($dc1==$s) {$selected="selected";} else {$selected="";}
				echo"<option ".$select." value=".($s/100).">".($s/100)."</option>";
				}
				echo"</select>";
 echo"</td>";
 echo"</tr>"; 
 
//3
 echo"<tr>";
 echo"<td>".$LANG['2']."  ".$LANG['to']."  ".$LANG['1']."</td>"; 
 echo"<td class=demo>";
 				echo"<select style='width:100%' name='trans21' onchange='this.form.submit()'>";
						if(isset($tp21))	{$check=$tp21*100;}  
				
				for ($s=100; $s<=200; $s++) 
				{
				if($s==$check){$select="selected";}  else {$select="";}
				//if ($dc1==$s) {$selected="selected";} else {$selected="";}
				echo"<option ".$select." value=".($s/100).">".($s/100)."</option>";
				}
				echo"</select>"; 
 echo"</td>";
 echo"</tr>"; 
 
 //4
 echo"<tr>";
 echo"<td>".$LANG['2']."  ".$LANG['to']."  ".$LANG['3']."</td>"; 
 echo"<td class=demo>"; 
  				echo"<select style='width:100%' name='trans23' onchange='this.form.submit()'>";
						if(isset($tp23))	{$check=$tp23*100;}  
				
				for ($s=100; $s<=200; $s++) 
				{
				if($s==$check){$select="selected";}  else {$select="";}
				//if ($dc1==$s) {$selected="selected";} else {$selected="";}
				echo"<option ".$select." value=".($s/100).">".($s/100)."</option>";
				}
				echo"</select>";
 echo"</td>";
 echo"</tr>"; 
 echo"<input type='hidden' name='transfer' value='1' />";
echo"</form>";
echo"</table>";
echo"</section>";
 //-----------------end transfer
 echo"<aside class='sidebar-even'>";
echo"<table>";
 if ($overtime==0){echo"<form action='game.php?act=finance' method='POST'>";}
 echo"<tr><td colspan=2 class=result2>".$LANG['internalloan']."</td></tr>"; 

 echo"<tr><td>".$LANG['1']."  ".$LANG['to']."  ".$LANG['2']."</td>"; 
 echo"<td class=demo>";
 
    echo"<select style='width:100%;' name='internalloan12' onchange='this.form.submit()'>";
  				for ($s=5; $s<=($fortrans1/1000000); $s++) 
				{
				//if($dc1==0){$dc1=$ct1;}
				//if ($s==$internalloan12) {$selected="selected";} else {$selected="";}
				if ($s==$internalloan12) {$selected="selected";$selected2="";} else {$selected="";$selected2="selected";}
				if ($s==5) {echo"<option ".$selected2." value=0>0</option>";}
				if ($s%2==0)
				{
				echo"<option ".$selected." value=".$s.">".number_format($s).",000,000</option>";
				}
				}
  echo"</select>";
 echo"</td></tr>";

 
  echo"<tr><td>".$LANG['1']."  ".$LANG['to']."  ".$LANG['3']."</td>"; 
 echo"<td class=demo>";
    echo"<select style='width:100%;' name='internalloan13' onchange='this.form.submit()'>";
  				for ($s=2; $s<=($fortrans1/1000000); $s++) 
				{
				//if($dc1==0){$dc1=$ct1;}
				//if ($s==$internalloan13) {$selected="selected";} else {$selected="";}
				if ($s==$internalloan13) {$selected="selected";$selected2="";} else {$selected="";$selected2="selected";}
				if ($s==5) {echo"<option ".$selected2." value=0>0</option>";}
				if ($s%5==0)
				{
				echo"<option ".$selected." value=".$s.">".number_format($s).",000,000</option>";
				}
				}
  echo"</select>";
 echo"</td></tr>";
 
 
 
   echo"<tr><td>".$LANG['2']."  ".$LANG['to']."  ".$LANG['1']."</td>"; 
  echo"<td class=demo>";
    echo"<select style='width:100%;' name='internalloan21' onchange='this.form.submit()'>";
  				for ($s=5; $s<=($fortrans2/1000000); $s++) 
				{
				//if($dc1==0){$dc1=$ct1;}
				
				if ($s==$internalloan21) {$selected="selected";$selected2="";} else {$selected="";$selected2="selected";}
				if ($s==5) {echo"<option ".$selected2." value=0>0</option>";}
				if ($s%2==0)
				{
				echo"<option ".$selected." value=".$s.">".number_format($s).",000,000</option>";
				}
				}
  echo"</select>";
 echo"</td></tr>";
 
 
   echo"<tr><td>".$LANG['3']."  ".$LANG['to']."  ".$LANG['1']."</td>"; 
  echo"<td class=demo>";
    echo"<select style='width:100%;' name='internalloan31' onchange='this.form.submit()'>";
  				for ($s=5; $s<=($fortrans3/1000000); $s++) 
				{
				//if($dc1==0){$dc1=$ct1;}
				
				if ($s==$internalloan31) {$selected="selected";$selected2="";} else {$selected="";$selected2="selected";}
				if ($s==5) {echo"<option ".$selected2." value=0>0</option>";}
				if ($s%2==0)
				{
				echo"<option ".$selected." value=".$s.">".number_format($s).",000,000</option>";
				}
				}
  echo"</select>";
 echo"</td></tr>";
echo"</table>"; 
echo"<input type=hidden name='loantransfer' value='1'/>";
   echo"</form>";
echo"</aside>";
// end transfer&internal loan


 echo"<table>";
echo"<th></th><th>".$LANG['1']."</th><th>".$LANG['2']."</th><th>".$LANG['3']."</th>";

echo"<tr><td class=result2>".$LANG['pb4t']."</td>";
//deduct net finance expense
        	for ($k=1; $k<=3; $k++)
		{
		//$netfinance="netfinance".$k;
		//$trev="trev".$k;
		$pb4t="pb4t".$k;
		if (($$pb4t)>=0) {$class="pos0";} else {$class="neg0";}		
echo"<td class=".$class.">".number_format($$pb4t)."</td>";
		}
echo"</tr>";
//---------loss carry foward=
//EBITDA - receivable +payables-inventories-netfinancing-incometax
//
////---------end loss carry foward


echo"<tr><td>".$LANG['losscarry']."</td>";
        	for ($k=1; $k<=3; $k++)
		{
		$loss="loss".$k;
		$losscarry="losscarry".$k;
		//echo $$losscarry;
		if ($$losscarry<0) {$$loss=$$losscarry; $class="neg";$b1="(";$b2=")";} else {$$loss=0;$class="right";$b1="";$b2="";}
echo"<td class=".$class.">".$b1."".number_format(abs($$loss))."".$b2."</td>";
		}
echo"</tr>";

echo"<tr><td>".$LANG['taxable']."</td>";
        	for ($k=1; $k<=3; $k++)
		{
		$loss="loss".$k;
		//$trev="trev".$k;
		$tp="tp".$k;
		//$netfinance="netfinance".$k;
		$pb4t="pb4t".$k;
		if (($$pb4t+$$loss)>0) {$$tp=$$pb4t+$$loss;} else {$$tp=0;}
echo"<td class=right>".number_format($$tp)."</td>";
		}
echo"</tr>";
echo"<tr><td>".$LANG['statutax'].", %</td>";
        	for ($k=1; $k<=3; $k++)
		{
//		$tp="tp".$k;
		$t="t".$k;
echo"<td class=right>".number_format($$t)."%</td>";
		}
echo"</tr>";
echo"<tr><td>".$LANG['incometax']."</td>";
        	for ($k=1; $k<=3; $k++)
		{
		$tp="tp".$k;
		$t="t".$k;
		$it="it".$k;
		if ($$tp>0) {$$it=$$t*$$tp/100;} else {$$it=0;}
echo"<td class=right>".number_format($$it)."</td>";
		}
echo"</tr>";
echo"<tr><td class=result2>".$LANG['profitfortheyear']."</td>";
        	for ($k=1; $k<=3; $k++)
		{
		$it="it".$k;
		//$trev="trev".$k;
		$loss="loss".$k;
		//$netfinance="netfinance".$k;
			$pb4t="pb4t".$k;
		$pfty="pfty".$k;
		$$pfty=$$pb4t-$$loss-$$it;
if ($$pfty>=0) {$class="pos0";} else {$class="neg0";}		
echo"<td class=".$class.">".number_format($$pfty)."</td>";
		}
echo"</tr>";
echo"<tr><td>".$LANG['effecttax'].", %</td>";
        	for ($k=1; $k<=3; $k++)
		{
		$it="it".$k;
		$trev="trev".$k;
		$etr="etr".$k;
		
if ($$trev==0){$$etr=0;} else {$$etr=$$it/$$trev*100;}
echo"<td class=right>".number_format($$etr)."%</td>";
		}
echo"</tr>";
echo"<tr><td>".$LANG['remainloss']."</td>";
        	for ($k=1; $k<=3; $k++)
		{
		$pfty="pfty".$k;
		if (($$pfty)>=0) {$rloss=0; $class="right";}
		if ($$pfty<0) {$rloss=$$pfty; $class="neg";}
echo"<td class=".$class.">".number_format($rloss)."</td>";
		}
echo"</tr>";

 echo"</table>";
 echo"</div>";
 
 echo"</div>";
 
 
 // print to checklist
 
 $gebitda=$trev1+$trev2+$trev3;
 $grevenue=$sr1+$sr2+$sr3;
 $gcost=$cst1+$cst2+$cst3;
 $date = date('Y-m-d H:i:s');
//echo $input_id;
$result = mysql_query("SELECT revenue FROM checklist WHERE input_id ='$input_id'");
if( mysql_num_rows($result) == 1) 
{

$result_input=mysql_query("UPDATE `checklist` SET revenue='$grevenue', cost='$gcost', ebitda = '$gebitda', date = '$date'  WHERE input_id ='$input_id'");

}
else
{
$sql="INSERT INTO `checklist` (input_id,production,hr,rnd,finance,investment,marketing,logistic,date,revenue,cost,ebitda) VALUES ('$input_id',0,0,0,0,0,0,0,'$date','$grevenue','$gcost','$gebitda')";
$result = mysql_query($sql);  //order executes
}
 //end checklist
 
 }

//------------------------- end finance	
	
}
// ------------------------- end marketing and finance	

 // check overtime
    if($_SESSION['player']==1)
 {
 $gid=$_SESSION['game_id'] ;
 $tid=$_SESSION['team_id'] ;
 $overtime=overtime($gid,$tid);
 }
 else 
 {
 $overtime=0;
 }
  //echo $overtime;
 // end check overtime
	  if( $_GET['act']=='previewresult' or $overtime==1)
  {	
   if($_SESSION['mod']==1 or $_SESSION['admin']==1 )
 {
 $gid=$_GET['gid'] ;
 $tid=$_GET['tid'] ;
 } else 
 {
 $gid=$_SESSION['game_id'] ;
 $tid=$_SESSION['team_id'] ;
 }
  if ($overtime==1)
{
echo "<div id='previewresult'>";
}
 if (isset($_GET['show']))
{
 if ($_GET['show']=='hide')
 {echo "<div id='previewresult'>";
 }else 
 {echo "<div>";
 }
} 
else
{
echo "<div id='previewresult'>";
}
 // get assumption parameter rate
	//price demand
 	$para1 = mysql_query("SELECT c1,c2,c3 FROM weight_assumption where id='1'");
	$arrayp1 = mysql_fetch_array($para1);
	$pricedpara_c1=$arrayp1['c1']/100;
	$pricedpara_c2=$arrayp1['c2']/100;
	$pricedpara_c3=$arrayp1['c3']/100;
	//market cap
 	$para1 = mysql_query("SELECT c1,c2,c3 FROM weight_assumption where id='2'");
	$arrayp1 = mysql_fetch_array($para1);
	$marketpara_c1=$arrayp1['c1']/100;
	$marketpara_c2=$arrayp1['c2']/100;
	$marketpara_c3=$arrayp1['c3']/100;
	//feature cap
 	$para1 = mysql_query("SELECT c1,c2,c3 FROM weight_assumption where id='3'");
	$arrayp1 = mysql_fetch_array($para1);
	$featurepara_c1=$arrayp1['c1']/100;
	$featurepara_c2=$arrayp1['c2']/100;
	$featurepara_c3=$arrayp1['c3']/100;
 	//price expectation
 	$para1 = mysql_query("SELECT c1,c2,c3 FROM weight_assumption where id='4'");
	$arrayp1 = mysql_fetch_array($para1);
	$pricepara_c1=$arrayp1['c1']/100;
	$pricepara_c2=$arrayp1['c2']/100;
	$pricepara_c3=$arrayp1['c3']/100;
 	//promotion
 	$para1 = mysql_query("SELECT c1,c2,c3 FROM weight_assumption where id='5'");
	$arrayp1 = mysql_fetch_array($para1);
	$promotionpara_c1=$arrayp1['c1']/100;
	$promotionpara_c2=$arrayp1['c2']/100;
	$promotionpara_c3=$arrayp1['c3']/100; 
  	//CSR
 	$para1 = mysql_query("SELECT c1,c2,c3 FROM weight_assumption where id='6'");
	$arrayp1 = mysql_fetch_array($para1);
	$csrpara_c1=$arrayp1['c1']/100;
	$csrpara_c2=$arrayp1['c2']/100;
	$csrpara_c3=$arrayp1['c3']/100; 
	
	  	//hr efficiency rate
 	$para1 = mysql_query("SELECT c1 FROM weight_assumption where id='7'");
	$arrayp1 = mysql_fetch_array($para1);
	$hrwage=$arrayp1['c1'];
	
  	$para1 = mysql_query("SELECT c1 FROM weight_assumption where id='8'");
	$arrayp1 = mysql_fetch_array($para1);
	$hrtrain=$arrayp1['c1'];
	
  	$para1 = mysql_query("SELECT c1 FROM weight_assumption where id='9'");
	$arrayp1 = mysql_fetch_array($para1); 
	$hrmin=$arrayp1['c1'];
	
  	$para1 = mysql_query("SELECT c1 FROM weight_assumption where id='10'");
	$arrayp1 = mysql_fetch_array($para1);
	$hrprofit=$arrayp1['c1'];
	
  	$para1 = mysql_query("SELECT c1 FROM weight_assumption where id='11'");
	$arrayp1= mysql_fetch_array($para1);	
	$turnoverwage=$arrayp1['c1'];
	
  	$para1 = mysql_query("SELECT c1 FROM weight_assumption where id='12'");
	$arrayp1 = mysql_fetch_array($para1);	
	$turnovertrain=$arrayp1['c1'];	
	
	
 // get current round
 	// round
	$res_round = mysql_query("SELECT max(round) FROM output where game_id='$gid' and final='1' and team_id='$tid'");
	$array_round = mysql_fetch_array($res_round);
	$round=$array_round[0];
	$round_for_input=$round+1;
	
// get practice round
$game = mysql_query("SELECT practice_round, no_of_rounds FROM `game` where id='$gid'");
$hpr = mysql_fetch_array($game);
$pround=$hpr['practice_round'];
$rounds=$hpr['no_of_rounds'];
if ($round==$pround) {$round=0;} 

// get standard wage/training
  	$sw = mysql_query("SELECT hr_stan_wage,hr_standard_training_budget,hr_standard_turnover_rate FROM game where id='$gid'");
	$shr = mysql_fetch_array($sw);	
	$stanwage=$shr['hr_stan_wage'];	
	$standtrain=$shr['hr_standard_training_budget'];
	$stanturnover=$shr['hr_standard_turnover_rate'];
// check if input available 	
$result1 = mysql_query("SELECT id FROM `team` where game_id='$gid'");
while ($array = mysql_fetch_array($result1))
{
$teamid=$array['id'];
$res = mysql_query("SELECT id FROM input WHERE game_id='$gid' and team_id='$teamid' and round='$round_for_input' and team_decision='1' ");		
if( mysql_num_rows($res) == 0) 
				{

				// for i from 0 to round_for_input, get max round which input available
				for ($r=0; $r<$round_for_input; $r++) 
						{
						
						$results = mysql_query("SELECT id FROM input WHERE game_id='$gid' and team_id='$teamid' and round='$r' and team_decision='1' ");		
						if( mysql_num_rows($results) == 1) 
							{
							$maxround=$r;
							}
						
						}
						//echo $maxround;
						//exit;
				// once get max round available then auto insert same value for current round
// insert output		
//echo "trieua".$teamid;;		
				$results2 = mysql_query("insert into input (game_id,assumption_id,team_id,player_id,country1,country2,country3,logistic_order_c1,logistic_order_c2,transfer_price,fin_longterm_debt,fin_shareissue,fin_dividends,fin_internal_loan_c1_c2,fin_internal_loan_c1_c3,investment_c1,investment_c2,fin_internal_loan_c2_c1,fin_internal_loan_c3_c1,team_decision,round) select game_id,assumption_id,'$teamid','',country1,country2,country3,logistic_order_c1,logistic_order_c2,transfer_price,fin_longterm_debt,fin_shareissue,fin_dividends,fin_internal_loan_c1_c2,fin_internal_loan_c1_c3,investment_c1,investment_c2,fin_internal_loan_c2_c1,fin_internal_loan_c3_c1,team_decision,'$round_for_input' from input WHERE game_id='$gid' and team_id='$tid' and round='$maxround'");
	//			echo $results2;
				//
				}
}

 // Loop country
 $techtotalc1=$techtotalc2=$techtotalc3=0;
 for ($c=1; $c<=3; $c++) 
{
echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
echo "<table>"; 
echo "<th>Value</th>";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
echo"<th>".$tname."[".$teamid."]</th>";
}


	   for ($x=1; $x<=10; $x++) 
{


//x=1 --> price tech 1
if ($x==1)
{

   for ($i=1; $i<=4; $i++) 
	{
echo"<tr><td>Price Tech ".$i."</td>";	
$ctry="country".$c;
$result = mysql_query("SELECT id,game_id,team_id,".$ctry." FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];

				$c1=$row[$ctry]; 
				$cty=unserialize(base64_decode($c1));
				$price="price_tech".$i;
				$p="price".$teamid.$c.$i;
				$$p=$cty[$price];
$price_report="price_report".$teamid;
if ($$p=='') {$$p=0;}
if (isset($$price_report))
{

$$price_report=$$price_report.",".$$p;		

}
else
{
$$price_report=$$p;
}
//echo $$p."<br>";
//echo $$price_report."<br>";		
//-----------------				
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
//-----------------

echo"<td>[".$tname."] ".$$p."</td>";


}
echo"</tr>";
	}
	
}

// x=2 -->promotion
if ($x==2)
{

   for ($i=1; $i<=4; $i++) 
	{
echo"<tr><td>Promotion Tech ".$i."</td>";	
$ctry="country".$c;
$result = mysql_query("SELECT id,game_id,team_id,".$ctry." FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];

				$c1=$row[$ctry]; 
				$cty=unserialize(base64_decode($c1));
				$price="promotion".$i;
				$promo="promotion".$teamid.$c.$i;
				$promotion_report="promo_report".$teamid;
				
				$$promo=$cty[$price];
				if (!isset($$promo)) {$promo1=0;} else {$promo1=$$promo;}
				if (!isset($$promotion_report)) {$$promotion_report=$promo1;}
				else {
				$$promotion_report=$$promotion_report.",".$promo1;}
				
				
//-----------------				
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
//-----------------

echo"<td>[".$tname."] ".$$promo."%</td>";


}
echo"</tr>";
	}
	
}
//end

// x=3 -->feature
if ($x==3)
{

   for ($i=1; $i<=4; $i++) 
	{
echo"<tr><td>Feature Tech ".$i."</td>";	
$ctry="country".$c;
$result = mysql_query("SELECT id,game_id,team_id,".$ctry." FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];

				$c1=$row[$ctry]; 
				$cty=unserialize(base64_decode($c1));
				$price="sale_feature".$i;
				$fe="feature".$teamid.$c.$i;
				$$fe=$cty[$price];
				if (!isset($$fe)) {$fe1=0;} else {$fe1=$$fe;}
				$feature_report1="feature_report".$teamid;
				if (!isset($$feature_report1)) {$$feature_report1=$fe1;}
				else {
				$$feature_report1=$$feature_report1.",".$fe1;}
				
//-----------------				
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
//-----------------

echo"<td>[".$tname."] ".$$fe."</td>";


}
echo"</tr>";
	}
	
}
//end


// x=4 -->csr
if ($x==4)
{

  
echo"<tr><td>CSR</td>";	

$result = mysql_query("SELECT id,game_id,team_id,country1,country2 FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];

				$c1=$row['country1']; 
				$c2=$row['country2']; 
				$c11=unserialize(base64_decode($c1));
				$c22=unserialize(base64_decode($c2));
				
				
				$csr1=$c11['production1'];
				$csr2=$c22['production2'];
				$csr1 = preg_split("/[\s,]+/",$csr1);
				$csr2 = preg_split("/[\s,]+/",$csr2);
				//echo $csr2[3];
				$csrf="csr_final".$teamid;
				$$csrf=($csr1[3]+$csr2[3])/2;
				
//-----------------				
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
//-----------------

echo"<td>[".$tname."] ".$$csrf."</td>";


}
echo"</tr>";
	
}
//end

// x=5 -->marketshare
if ($x==5)
{
// get total sale last round
$ttech1=$ttech2=$ttech3=$ttech4=0;

$result5 = mysql_query("SELECT team_id FROM `output` where game_id='$gid' and round='$round' and final='1'");
while ($row5 = mysql_fetch_array($result5))
{
 $tid=$row5['team_id'];


   $result21 = mysql_query("SELECT tmarketshare_c1,tmarketshare_c2,tmarketshare_c3 FROM output where game_id='$gid' and team_id='$tid' and round='$round' and final='1'");
   $array21 = mysql_fetch_array($result21);
   $tech1=$array21['tmarketshare_c1'];	$tech1= preg_split("/[\s,]+/",$tech1);
   $tech2=$array21['tmarketshare_c2'];	$tech2= preg_split("/[\s,]+/",$tech2);
   $tech3=$array21['tmarketshare_c3'];	$tech3= preg_split("/[\s,]+/",$tech3);
   $tt11=$tech1['0'];
   $tt21=$tech1['1'];
   $tt31=$tech1['2'];
   $tt41=$tech1['3'];
   $tt12=$tech2['0'];
   $tt22=$tech2['1'];
   $tt32=$tech2['2'];
   $tt42=$tech2['3'];
   $tt13=$tech3['0'];
   $tt23=$tech3['1'];
   $tt33=$tech3['2'];
   $tt43=$tech3['3'];  
   $ttech1=$ttech1+$tt11+$tt12+$tt13;
   $ttech2=$ttech2+$tt21+$tt22+$tt23;
   $ttech3=$ttech3+$tt31+$tt32+$tt33;
   $ttech4=$ttech4+$tt41+$tt42+$tt43;
}

   for ($i=1; $i<=4; $i++) 
	{
echo"<tr><td>Marketshare Tech ".$i."</td>";	
$ctry="country".$c;
$result = mysql_query("SELECT id,game_id,team_id,".$ctry." FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
$teamnumber=0;
while ($row = mysql_fetch_array($result))
{
++$teamnumber;
$teamid=$row['team_id'];
$ttecha="ttech".$i;
			
$ctry="tmarketshare_c".$c;
  				$dlr = mysql_query("SELECT ".$ctry." FROM `output` where game_id='$gid' and team_id='$teamid' and round='$round' and final='1'");
				$der = mysql_fetch_array($dlr);
				// get country 1/2/3

				$tms1=$der[$ctry]; $tms1 = preg_split("/[\s,]+/",$tms1);
				$m_t="marketshare_tech".$teamid.$c.$i;
if($$ttecha!=0) {$$m_t=$tms1[$i-1]/$$ttecha;} else {$$m_t=0;}
				echo"<td>".$$m_t."</td>";


}
echo"</tr>";
	}
	
}
//end

// x=6 -->marketvalue
if ($x==6)
{


$mv1=$mv2=$mv3=0;
$result = mysql_query("SELECT id,game_id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];

   for ($co=1; $co<=3; $co++) 
	{
$ctry="output_c".$co;

$mv="mv".$co;
// get last market value

  				$dlr = mysql_query("SELECT ".$ctry." FROM `output` where game_id='$gid' and team_id='$teamid' and round='$round' and final='1'");
				$der = mysql_fetch_array($dlr);
				// get country 1/2/3

				$tms1=$der[$ctry]; $tms1 = preg_split("/[\s,]+/",$tms1);
				$m_t=$tms1[3];
				//echo "Country ".$co."/team".$teamid.": ".number_format($m_t)."<br>";
				
//get change in demand this round	
$ctr="country".$co;	
				$dlr = mysql_query("SELECT ".$ctr." FROM `round_assumption` where game_id='$gid' and round='$round_for_input'");
				$der = mysql_fetch_array($dlr);
				// get country 1/2/3

				$tms1=$der[$ctr]; $tms1 = preg_split("/[\s,]+/",$tms1);
				$m_t2=$tms1[0];	
				//echo $m_t2;
				
				// get this round market value
				$m_t=$m_t*$m_t2;
				$$mv=$$mv+$m_t;
	}


}

$mv="mv".$c;	
echo"<tr><td>Marketvalue last round</td><td colspan=".($teamnumber).">".number_format($$mv)."</td>";	
echo"</tr>";	
}
//end



// 

//tech share

// x=8-->tech share
if ($x==8)
{

   for ($i=1; $i<=4; $i++) 
	{
echo"<tr><td>Tech weight ".$i."</td>";	
// get tech coverage
$tech_avai_c1="tech_avai_c".$c;
$result1 = mysql_query("SELECT ".$tech_avai_c1." FROM game where id='$gid'");
$array = mysql_fetch_array($result1);
$tac1=$array[$tech_avai_c1];$tac1 = unserialize($tac1);
//echo "c".$c."-".$tac1['tech4'];
//exit();
$tech="tech".$i;
$a="c".$c."t".$i;
$$a=$tac1[$tech];
$k=$$a;
//echo $k."tech".$i;
$k = preg_split("/[,]+/",$k);

// get tech attraction
$ctr="country".$c;	
				$dlr = mysql_query("SELECT ".$ctr." FROM `round_assumption` where game_id='$gid' and round='$round_for_input'");
				$der = mysql_fetch_array($dlr);
				// get country 1/2/3

				$tms1=$der[$ctr]; $tms1 = preg_split("/[\s,]+/",$tms1);
				//25 26 27 28
				$ta=$tms1[$i+24];	
				
				//echo "<br>tech ".$i." attrac:".$ta."<br>";
				//echo "<br>tech  ".$i." coverage:".$k[$round_for_input]."<br>";
				$techshare="techatt".$c.$i;
				$$techshare=$ta*$k[$round_for_input];
				//echo $techshare;
			
$techt="techtotalc".$c;
	
$$techt=$$techt+$$techshare;			
//echo $ta."x".$k[$round_for_input]."=".$$techshare."/".$$techt;
echo"<td colspan=".$teamnumber.">".$$techshare."</td>";			

echo"</tr>";

	}

}
//end


}

echo"</table>";
}

	
	
//--------- background calculation 1 Price attraction
$pmax11=$pmax12=$pmax13=$pmax14=0;
$pmax21=$pmax22=$pmax23=$pmax24=0;
$pmax31=$pmax32=$pmax33=$pmax34=0;	
for ($c=1; $c<=3; $c++) 
{


echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
echo "<table>"; 
echo "<th>Background calculation</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
echo"<th>".$tname."[".$teamid."]</th>";
}


   for ($i=1; $i<=4; $i++) 
	{
echo"<tr><td>Price demand ".$i."</td>";	
$ctry="country".$c;
//$pde="pdemax".$c.$i;
$result = mysql_query("SELECT id,game_id,team_id,".$ctry." FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];

				$c1=$row[$ctry]; 
				$cty=unserialize(base64_decode($c1));
				$price="price_tech".$i;
				$p="price".$teamid.$c.$i;
				$$p=$cty[$price];
				
$mv="mv".$c;
$pdemand="pdemand".$teamid.$c.$i;
if ($$p!=0) {$$pdemand=($$mv/$$p);	} else {$$pdemand=0;}
// get max

//c1
if($c==1 and $i==1) 
{
if ($pmax11<$$pdemand) {$pmax11=$$pdemand;}
}

if($c==1 and $i==2) 
{
if ($pmax12<$$pdemand) {$pmax12=$$pdemand;}
}

if($c==1 and $i==3) 
{
if ($pmax13<$$pdemand) {$pmax13=$$pdemand;}
}

if($c==1 and $i==4) 
{
if ($pmax14<$$pdemand) {$pmax14=$$pdemand;}
}
//c2
if($c==2 and $i==1) 
{
if ($pmax21<$$pdemand) {$pmax21=$$pdemand;}
}

if($c==2 and $i==2) 
{
if ($pmax22<$$pdemand) {$pmax22=$$pdemand;}
}

if($c==2 and $i==3) 
{
if ($pmax23<$$pdemand) {$pmax23=$$pdemand;}
}

if($c==2 and $i==4) 
{
if ($pmax24<$$pdemand) {$pmax24=$$pdemand;}
}

//c3
if($c==3 and $i==1) 
{
if ($pmax31<$$pdemand) {$pmax31=$$pdemand;}
}

if($c==2 and $i==2) 
{
if ($pmax32<$$pdemand) {$pmax32=$$pdemand;}
}

if($c==2 and $i==3) 
{
if ($pmax33<$$pdemand) {$pmax33=$$pdemand;}
}

if($c==2 and $i==4) 
{
if ($pmax34<$$pdemand) {$pmax34=$$pdemand;}
}


echo"<td>".number_format($$pdemand)."</td>";


}
echo"</tr>";
	}

echo "</table>";
}

// get relative value for demand	
//--------- background calculation 2
echo"<br><h4>-----------------------Relative price-------------------------</h4>";
for ($c=1; $c<=3; $c++) 
{


echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
echo "<table>"; 
echo "<th>Background calculation</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
echo"<th>".$tname."[".$teamid."]</th>";
}


   for ($i=1; $i<=4; $i++) 
	{
echo"<tr><td>Price demand ".$i."</td>";	
$ctry="country".$c;
//$pde="pdemax".$c.$i;
$result = mysql_query("SELECT id,game_id,team_id,".$ctry." FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];

				$c1=$row[$ctry]; 
				$cty=unserialize(base64_decode($c1));
				$price="price_tech".$i;
				$p="price".$teamid.$c.$i;
				$$p=$cty[$price];
				
$mv="mv".$c;
$pdemand="pdemand".$teamid.$c.$i;
//$pricedpa="pricedpara_c".$c;
if ($$p!=0) {$$pdemand=($$mv/$$p);	} else {$$pdemand=0;}
// get max
$prv="pricerv".$teamid.$c.$i;
//c1
if($c==1 and $i==1) 
{
if ($pmax11!=0) {$$prv=$$pdemand/$pmax11*$pricedpara_c1;} else {$$prv=0;}
}

if($c==1 and $i==2) 
{
if ($pmax12!=0) {$$prv=$$pdemand/$pmax12*$pricedpara_c1;} else {$$prv=0;}
}

if($c==1 and $i==3) 
{
if ($pmax13!=0) {$$prv=$$pdemand/$pmax13*$pricedpara_c1;} else {$$prv=0;}
}

if($c==1 and $i==4) 
{
if ($pmax14!=0) {$$prv=$$pdemand/$pmax14*$pricedpara_c1;} else {$$prv=0;}
}
//c2
if($c==2 and $i==1) 
{
if ($pmax21!=0) {$$prv=$$pdemand/$pmax21*$pricedpara_c2;} else {$$prv=0;}
}

if($c==2 and $i==2) 
{
if ($pmax22!=0) {$$prv=$$pdemand/$pmax22*$pricedpara_c2;} else {$$prv=0;}
}

if($c==2 and $i==3) 
{
if ($pmax23!=0) {$$prv=$$pdemand/$pmax23*$pricedpara_c2;} else {$$prv=0;}
}

if($c==2 and $i==4) 
{
if ($pmax24!=0) {$$prv=$$pdemand/$pmax24*$pricedpara_c2;} else {$$prv=0;}
}

//c3
if($c==3 and $i==1) 
{
if ($pmax31!=0) {$$prv=$$pdemand/$pmax31*$pricedpara_c3;} else {$$prv=0;}
}

if($c==3 and $i==2) 
{
if ($pmax32!=0) {$$prv=$$pdemand/$pmax32*$pricedpara_c3;} else {$$prv=0;}
}

if($c==3 and $i==3) 
{
if ($pmax33!=0) {$$prv=$$pdemand/$pmax33*$pricedpara_c3;} else {$$prv=0;}
}

if($c==3 and $i==4) 
{
if ($pmax34!=0) {$$prv=$$pdemand/$pmax34*$pricedpara_c3;} else {$$prv=0;}
}


echo"<td>".$$prv."</td>";


}
echo"</tr>";
	}

echo "</table>";
}





// background calculation 3 -- get marketshare relative value
$msmax11=$msmax12=$msmax13=$msmax14=0;
$msmax21=$msmax22=$msmax23=$msmax24=0;
$msmax31=$msmax32=$msmax33=$msmax34=0;	
for ($c=1; $c<=3; $c++) 
{


//echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
//echo "<table>"; 
//echo "<th>Background calculation</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
//echo"<th>".$tname."[".$teamid."]</th>";
}
  for ($i=1; $i<=4; $i++) 
	{
//echo"<tr><td>Marketshare Tech ".$i."</td>";	

$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];
$m_t="marketshare_tech".$teamid.$c.$i;


//c1
if($c==1 and $i==1) 
{
if ($msmax11<$$m_t) {$msmax11=$$m_t;}
}

if($c==1 and $i==2) 
{
if ($msmax12<$$m_t) {$msmax12=$$m_t;}
}

if($c==1 and $i==3) 
{
if ($msmax13<$$m_t) {$msmax13=$$m_t;}
}

if($c==1 and $i==4) 
{
if ($msmax14<$$m_t) {$msmax14=$$m_t;}
}
//c2
if($c==2 and $i==1) 
{
if ($msmax21<$$m_t) {$msmax21=$$m_t;}
}

if($c==2 and $i==2) 
{
if ($msmax22<$$m_t) {$msmax22=$$m_t;}
}

if($c==2 and $i==3) 
{
if ($msmax23<$$m_t) {$msmax23=$$m_t;}
}

if($c==2 and $i==4) 
{
if ($msmax24<$$m_t) {$msmax24=$$m_t;}
}

//c3
if($c==3 and $i==1) 
{
if ($msmax31<$$m_t) {$msmax31=$$m_t;}
}

if($c==2 and $i==2) 
{
if ($msmax32<$$m_t) {$msmax32=$$m_t;}
}

if($c==2 and $i==3) 
{
if ($msmax33<$$m_t) {$msmax33=$$pdemand;}
}

if($c==2 and $i==4) 
{
if ($msmax34<$$m_t) {$msmax34=$$m_t;}
}

}
//echo"</tr>";
	}

}

echo"<br><h4>-----------------------Relative marketshare-------------------------</h4>";

for ($c=1; $c<=3; $c++) 
{


echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
echo "<table>"; 
echo "<th>Background calculation</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
echo"<th>".$tname."[".$teamid."]</th>";
}


   for ($i=1; $i<=4; $i++) 
	{
echo"<tr><td>Marketshare relative value ".$i."</td>";	

//$pde="pdemax".$c.$i;
$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];


$pdemand="marketshare_tech".$teamid.$c.$i;
//echo $$pdemand."/";

// get max
$prv="mshare".$teamid.$c.$i;
//c1
if($c==1 and $i==1) 
{
if ($msmax11!=0) {$$prv=$$pdemand/$msmax11*$marketpara_c1;} else {$$prv=0;}
}

if($c==1 and $i==2) 
{
if ($msmax12!=0) {$$prv=$$pdemand/$msmax12*$marketpara_c1;} else {$$prv=0;}
}

if($c==1 and $i==3) 
{
if ($msmax13!=0) {$$prv=$$pdemand/$msmax13*$marketpara_c1;} else {$$prv=0;}
}

if($c==1 and $i==4) 
{
if ($msmax14!=0) {$$prv=$$pdemand/$msmax14*$marketpara_c1;} else {$$prv=0;}
}
//c2
if($c==2 and $i==1) 
{
if ($msmax21!=0) {$$prv=$$pdemand/$msmax21*$marketpara_c2;} else {$$prv=0;}
}

if($c==2 and $i==2) 
{
if ($msmax22!=0) {$$prv=$$pdemand/$msmax22*$marketpara_c2;} else {$$prv=0;}
}

if($c==2 and $i==3) 
{
if ($msmax23!=0) {$$prv=$$pdemand/$msmax23*$marketpara_c2;} else {$$prv=0;}
}

if($c==2 and $i==4) 
{
if ($msmax24!=0) {$$prv=$$pdemand/$msmax24*$marketpara_c2;} else {$$prv=0;}
}

//c3
if($c==3 and $i==1) 
{
if ($msmax31!=0) {$$prv=$$pdemand/$msmax31*$marketpara_c3;} else {$$prv=0;}
}

if($c==3 and $i==2) 
{
if ($msmax32!=0) {$$prv=$$pdemand/$msmax32*$marketpara_c3;} else {$$prv=0;}
}

if($c==3 and $i==3) 
{
if ($msmax33!=0) {$$prv=$$pdemand/$msmax33*$marketpara_c3;} else {$$prv=0;}
}

if($c==3 and $i==4) 
{
if ($msmax34!=0) {$$prv=$$pdemand/$msmax34*$marketpara_c3;} else {$$prv=0;}
}


echo"<td>".$$prv."</td>";


}
echo"</tr>";
	}

echo "</table>";
}
// end









// background calculation 4 -- get feature relative value
$fmax11=$fmax12=$fmax13=$fmax14=0;
$fmax21=$fmax22=$fmax23=$fmax24=0;
$fmax31=$fmax32=$fmax33=$fmax34=0;	
for ($c=1; $c<=3; $c++) 
{


//echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
//echo "<table>"; 
//echo "<th>Background calculation</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
//echo"<th>".$tname."[".$teamid."]</th>";
}
  for ($i=1; $i<=4; $i++) 
	{
//echo"<tr><td>Marketshare Tech ".$i."</td>";	

$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];

$m_t="feature".$teamid.$c.$i;


//c1
if($c==1 and $i==1) 
{
if ($fmax11<$$m_t) {$fmax11=$$m_t;}
}

if($c==1 and $i==2) 
{
if ($fmax12<$$m_t) {$fmax12=$$m_t;}
}

if($c==1 and $i==3) 
{
if ($fmax13<$$m_t) {$fmax13=$$m_t;}
}

if($c==1 and $i==4) 
{
if ($fmax14<$$m_t) {$fmax14=$$m_t;}
}
//c2
if($c==2 and $i==1) 
{
if ($fmax21<$$m_t) {$fmax21=$$m_t;}
}

if($c==2 and $i==2) 
{
if ($fmax22<$$m_t) {$fmax22=$$m_t;}
}

if($c==2 and $i==3) 
{
if ($fmax23<$$m_t) {$fmax23=$$m_t;}
}

if($c==2 and $i==4) 
{
if ($fmax24<$$m_t) {$fmax24=$$m_t;}
}

//c3
if($c==3 and $i==1) 
{
if ($fmax31<$$m_t) {$fmax31=$$m_t;}
}

if($c==2 and $i==2) 
{
if ($fmax32<$$m_t) {$fmax32=$$m_t;}
}

if($c==2 and $i==3) 
{
if ($fmax33<$$m_t) {$fmax33=$$pdemand;}
}

if($c==2 and $i==4) 
{
if ($fmax34<$$m_t) {$fmax34=$$m_t;}
}

}
//echo"</tr>";
	}

}


echo"<br><h4>-----------------------Relative feature-------------------------</h4>";
for ($c=1; $c<=3; $c++) 
{


echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
echo "<table>"; 
echo "<th>Background feature calculation</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
echo"<th>".$tname."[".$teamid."]</th>";
}


   for ($i=1; $i<=4; $i++) 
	{
echo"<tr><td>Feature relative value ".$i."</td>";	

//$pde="pdemax".$c.$i;
$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];

$pdemand="feature".$teamid.$c.$i;
//echo $$pdemand."/";

// get max
$prv="fvalue".$teamid.$c.$i;
//c1
if($c==1 and $i==1) 
{
if ($fmax11!=0) {$$prv=$$pdemand/$fmax11*$featurepara_c1;} else {$$prv=0;}
}

if($c==1 and $i==2) 
{
if ($fmax12!=0) {$$prv=$$pdemand/$fmax12*$featurepara_c1;} else {$$prv=0;}
}

if($c==1 and $i==3) 
{
if ($fmax13!=0) {$$prv=$$pdemand/$fmax13*$featurepara_c1;} else {$$prv=0;}
}

if($c==1 and $i==4) 
{
if ($fmax14!=0) {$$prv=$$pdemand/$fmax14*$featurepara_c1;} else {$$prv=0;}
}
//c2
if($c==2 and $i==1) 
{
if ($fmax21!=0) {$$prv=$$pdemand/$fmax21*$featurepara_c2;} else {$$prv=0;}
}

if($c==2 and $i==2) 
{
if ($fmax22!=0) {$$prv=$$pdemand/$fmax22*$featurepara_c2;} else {$$prv=0;}
}

if($c==2 and $i==3) 
{
if ($fmax23!=0) {$$prv=$$pdemand/$fmax23*$featurepara_c2;} else {$$prv=0;}
}

if($c==2 and $i==4) 
{
if ($fmax24!=0) {$$prv=$$pdemand/$fmax24*$featurepara_c2;} else {$$prv=0;}
}

//c3
if($c==3 and $i==1) 
{
if ($fmax31!=0) {$$prv=$$pdemand/$fmax31*$featurepara_c3;} else {$$prv=0;}
}

if($c==3 and $i==2) 
{
if ($fmax32!=0) {$$prv=$$pdemand/$fmax32*$featurepara_c3;} else {$$prv=0;}
}

if($c==3 and $i==3) 
{
if ($fmax33!=0) {$$prv=$$pdemand/$fmax33*$featurepara_c3;} else {$$prv=0;}
}

if($c==3 and $i==4) 
{
if ($fmax34!=0) {$$prv=$$pdemand/$fmax34*$featurepara_c3;} else {$$prv=0;}
}


echo"<td>".$$prv."</td>";


}
echo"</tr>";
	}

echo "</table>";
}
// end







// background calculation 4 -- get promotion relative value
$pmax11=$pmax12=$pmax13=$pmax14=0;
$pmax21=$pmax22=$pmax23=$pmax24=0;
$pmax31=$pmax32=$pmax33=$pmax34=0;	
for ($c=1; $c<=3; $c++) 
{


//echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
//echo "<table>"; 
//echo "<th>Background calculation</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
//echo"<th>".$tname."[".$teamid."]</th>";
}
  for ($i=1; $i<=4; $i++) 
	{
//echo"<tr><td>Marketshare Tech ".$i."</td>";	

$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];

$m_t="promotion".$teamid.$c.$i;


//c1
if($c==1 and $i==1) 
{
if ($pmax11<$$m_t) {$pmax11=$$m_t;}
}

if($c==1 and $i==2) 
{
if ($pmax12<$$m_t) {$pmax12=$$m_t;}
}

if($c==1 and $i==3) 
{
if ($pmax13<$$m_t) {$pmax13=$$m_t;}
}

if($c==1 and $i==4) 
{
if ($pmax14<$$m_t) {$pmax14=$$m_t;}
}
//c2
if($c==2 and $i==1) 
{
if ($pmax21<$$m_t) {$pmax21=$$m_t;}
}

if($c==2 and $i==2) 
{
if ($pmax22<$$m_t) {$pmax22=$$m_t;}
}

if($c==2 and $i==3) 
{
if ($pmax23<$$m_t) {$pmax23=$$m_t;}
}

if($c==2 and $i==4) 
{
if ($pmax24<$$m_t) {$pmax24=$$m_t;}
}

//c3
if($c==3 and $i==1) 
{
if ($pmax31<$$m_t) {$pmax31=$$m_t;}
}

if($c==2 and $i==2) 
{
if ($pmax32<$$m_t) {$pmax32=$$m_t;}
}

if($c==2 and $i==3) 
{
if ($pmax33<$$m_t) {$pmax33=$$pdemand;}
}

if($c==2 and $i==4) 
{
if ($pmax34<$$m_t) {$pmax34=$$m_t;}
}

}
//echo"</tr>";
	}

}

echo"<br><h4>-----------------------Relative promotion-------------------------</h4>";

for ($c=1; $c<=3; $c++) 
{


echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
echo "<table>"; 
echo "<th>Background promotion calculation</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
echo"<th>".$tname."[".$teamid."]</th>";
}


   for ($i=1; $i<=4; $i++) 
	{
echo"<tr><td>Promotion relative value ".$i."</td>";	

//$pde="pdemax".$c.$i;
$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];

$pdemand="promotion".$teamid.$c.$i;
//echo $$pdemand."/";

// get max
$prv="pvalue".$teamid.$c.$i;
//c1
if($c==1 and $i==1) 
{
if ($pmax11!=0) {$$prv=$$pdemand/$pmax11*$promotionpara_c1;} else {$$prv=0;}
}

if($c==1 and $i==2) 
{
if ($pmax12!=0) {$$prv=$$pdemand/$pmax12*$promotionpara_c1;} else {$$prv=0;}
}

if($c==1 and $i==3) 
{
if ($pmax13!=0) {$$prv=$$pdemand/$pmax13*$promotionpara_c1;} else {$$prv=0;}
}

if($c==1 and $i==4) 
{
if ($pmax14!=0) {$$prv=$$pdemand/$pmax14*$promotionpara_c1;} else {$$prv=0;}
}
//c2
if($c==2 and $i==1) 
{
if ($pmax21!=0) {$$prv=$$pdemand/$pmax21*$promotionpara_c2;} else {$$prv=0;}
}

if($c==2 and $i==2) 
{
if ($pmax22!=0) {$$prv=$$pdemand/$pmax22*$promotionpara_c2;} else {$$prv=0;}
}

if($c==2 and $i==3) 
{
if ($pmax23!=0) {$$prv=$$pdemand/$pmax23*$promotionpara_c2;} else {$$prv=0;}
}

if($c==2 and $i==4) 
{
if ($pmax24!=0) {$$prv=$$pdemand/$pmax24*$promotionpara_c2;} else {$$prv=0;}
}

//c3
if($c==3 and $i==1) 
{
if ($pmax31!=0) {$$prv=$$pdemand/$pmax31*$promotionpara_c3;} else {$$prv=0;}
}

if($c==3 and $i==2) 
{
if ($pmax32!=0) {$$prv=$$pdemand/$pmax32*$promotionpara_c3;} else {$$prv=0;}
}

if($c==3 and $i==3) 
{
if ($pmax33!=0) {$$prv=$$pdemand/$pmax33*$promotionpara_c3;} else {$$prv=0;}
}

if($c==3 and $i==4) 
{
if ($pmax34!=0) {$$prv=$$pdemand/$pmax34*$promotionpara_c3;} else {$$prv=0;}
}


echo"<td>".$$prv."</td>";


}
echo"</tr>";
	}

echo "</table>";
}
// end



// background calculation 5 -- get price expectation relative value  --negative effect
$pemax11=$pemax12=$pemax13=$pemax14=0;
$pemax21=$pemax22=$pemax23=$pemax24=0;
$pemax31=$pemax32=$pemax33=$pemax34=0;	
for ($c=1; $c<=3; $c++) 
{


//echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
//echo "<table>"; 
//echo "<th>Background calculation</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
//echo"<th>".$tname."[".$teamid."]</th>";
}
  for ($i=1; $i<=4; $i++) 
	{
//echo"<tr><td>Marketshare Tech ".$i."</td>";	

$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];

$m_t="price".$teamid.$c.$i;


//c1
if($c==1 and $i==1) 
{
if ($pemax11<$$m_t) {$pemax11=$$m_t;}
}

if($c==1 and $i==2) 
{
if ($pemax12<$$m_t) {$pemax12=$$m_t;}
}

if($c==1 and $i==3) 
{
if ($pemax13<$$m_t) {$pemax13=$$m_t;}
}

if($c==1 and $i==4) 
{
if ($pemax14<$$m_t) {$pemax14=$$m_t;}
}
//c2
if($c==2 and $i==1) 
{
if ($pemax21<$$m_t) {$pemax21=$$m_t;}
}

if($c==2 and $i==2) 
{
if ($pemax22<$$m_t) {$pemax22=$$m_t;}
}

if($c==2 and $i==3) 
{
if ($pemax23<$$m_t) {$pemax23=$$m_t;}
}

if($c==2 and $i==4) 
{
if ($pemax24<$$m_t) {$pemax24=$$m_t;}
}

//c3
if($c==3 and $i==1) 
{
if ($pemax31<$$m_t) {$pemax31=$$m_t;}
}

if($c==3 and $i==2) 
{
if ($pemax32<$$m_t) {$pemax32=$$m_t;}
}

if($c==3 and $i==3) 
{
if ($pemax33<$$m_t) {$pemax33=$$pdemand;}
}

if($c==3 and $i==4) 
{
if ($pemax34<$$m_t) {$pemax34=$$m_t;}
}

}
//echo"</tr>";
	}

}

echo"<br><h4>-----------------------Relative price high-------------------------</h4>";

for ($c=1; $c<=3; $c++) 
{


echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
echo "<table>"; 
echo "<th>Background price expectation calculation</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
echo"<th>".$tname."[".$teamid."]</th>";
}


   for ($i=1; $i<=4; $i++) 
	{
echo"<tr><td>Price high relative value ".$i."</td>";	

//$pde="pdemax".$c.$i;
$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];

$pdemand="price".$teamid.$c.$i;
//echo $$pdemand."/";

// get max
$prv="pev".$teamid.$c.$i;
//c1
if($c==1 and $i==1) 
{
if ($pemax11!=0) {$$prv=$$pdemand/$pemax11*$pricepara_c1;} else {$$prv=0;}
}

if($c==1 and $i==2) 
{
if ($pemax12!=0) {$$prv=$$pdemand/$pemax12*$pricepara_c1;} else {$$prv=0;}
}

if($c==1 and $i==3) 
{
if ($pemax13!=0) {$$prv=$$pdemand/$pemax13*$pricepara_c1;} else {$$prv=0;}
}

if($c==1 and $i==4) 
{
if ($pemax14!=0) {$$prv=$$pdemand/$pemax14*$pricepara_c1;} else {$$prv=0;}
}
//c2
if($c==2 and $i==1) 
{
if ($pemax21!=0) {$$prv=$$pdemand/$pemax21*$pricepara_c2;} else {$$prv=0;}
}

if($c==2 and $i==2) 
{
if ($pemax22!=0) {$$prv=$$pdemand/$pemax22*$pricepara_c2;} else {$$prv=0;}
}

if($c==2 and $i==3) 
{
if ($pmax23!=0) {$$prv=$$pdemand/$pemax23*$pricepara_c2;} else {$$prv=0;}
}

if($c==2 and $i==4) 
{
if ($pemax24!=0) {$$prv=$$pdemand/$pemax24*$pricepara_c2;} else {$$prv=0;}
}

//c3
if($c==3 and $i==1) 
{
if ($pemax31!=0) {$$prv=$$pdemand/$pemax31*$pricepara_c3;} else {$$prv=0;}
}

if($c==3 and $i==2) 
{
if ($pemax32!=0) {$$prv=$$pdemand/$pemax32*$pricepara_c3;} else {$$prv=0;}
}

if($c==3 and $i==3) 
{
if ($pemax33!=0) {$$prv=$$pdemand/$pemax33*$pricepara_c3;} else {$$prv=0;}
}

if($c==3 and $i==4) 
{
if ($pemax34!=0) {$$prv=$$pdemand/$pemax34*$pricepara_c3;} else {$$prv=0;}
}


echo"<td>".$$prv."</td>";


}
echo"</tr>";
	}

echo "</table>";
}
// end





// background calculation 6 -- get CSR relative value  
$csrmax=0;

$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
//echo"<th>".$tname."[".$teamid."]</th>";
}


//echo"<tr><td>CSR relative value ".$i."</td>";	

//$pde="pdemax".$c.$i;
$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];

$csr="csr_final".$teamid;
//echo $$pdemand."/";

// get max
if ($csrmax<$$csr)
{
$csrmax=$$csr;
}
//echo"max csr".$csrmax;


}

// end



echo"<br><h4>-----------------------Relative CSR-------------------------</h4>";

for ($c=1; $c<=3; $c++) 
{
echo"<br><h4>$LANG[$c]</h4>";
echo"<br><table>";
echo"<th>CSR background</th>";	
//$pde="pdemax".$c.$i;
$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
echo"<th>".$teamid."</th>";
}
echo"<tr><td>CSR relative value all tech</td>";
//$pde="pdemax".$c.$i;
$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];


$csr="csr_final".$teamid;
//echo $$pdemand."/";

// get max


$csra="csralative".$teamid.$c;
if ($c==1) {$$csra=$$csr/$csrmax*$csrpara_c1;}
if ($c==2) {$$csra=$$csr/$csrmax*$csrpara_c2;}
if ($c==3) {$$csra=$$csr/$csrmax*$csrpara_c3;}

echo"<td>".$$csra."</td>";

}
echo"</tr>";
echo "</table>";
}
// end










echo"<br><h4>--------------------------------Final table-------------------------</h4>";


// background calculation final -- get demand

for ($c=1; $c<=3; $c++) 
{


//echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
//echo "<table>"; 
//echo "<th>Background calculation</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
//echo"<th>".$tname."[".$teamid."]</th>";
}
  for ($i=1; $i<=4; $i++) 
	{
//echo"<tr><td>Marketshare Tech ".$i."</td>";	

$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];

$price="pricerv".$teamid.$c.$i;
$mshare="mshare".$teamid.$c.$i;
$feature="fvalue".$teamid.$c.$i;
$promotion="pvalue".$teamid.$c.$i;
$pricehigh="pev".$teamid.$c.$i;// negative effect
$csr="csralative".$teamid.$c;

$demand="demand".$teamid.$c.$i;;
$$demand=$$price+$$mshare+$$feature+$$promotion-$$pricehigh+$$csr;
$demand_total="demand_total".$c.$i;
if (isset ($$demand_total))
{
$$demand_total=$$demand_total+$$demand;
}
else 
{
$$demand_total=$$demand;
}

}
//echo"</tr>";
	}

}
//echo $demand_total12;


for ($c=1; $c<=3; $c++) 
{


echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
echo "<table>"; 
echo "<th>Final demand</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
echo"<th>".$tname."[".$teamid."]</th>";
}
//$tmarkets="tmarketshares".$teamid.$c;

  for ($i=1; $i<=4; $i++) 
	{
echo"<tr><td>Demand % tech ".$i."</td>";	

$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];

$demand="demand".$teamid.$c.$i;
$definal="demand_final".$teamid.$c.$i;
$demand_total="demand_total".$c.$i;
$$definal=round($$demand/$$demand_total,2);


echo"<td>".$$definal."%</td>";
}
echo"</tr>";
	}
echo"</table>";
}
//echo $tmshare3911;

echo"<br><h4>--------------------------------/Final table-------------------------</h4>";



// ------------------ get last round total demand
				$dlra = mysql_query("SELECT demand_c1,demand_c2,demand_c3 FROM `output` where game_id='$gid' and team_id='$teamid' and round='$round' and final='1'");
				$der = mysql_fetch_array($dlra);
				// get country 1/2/3
				$dmd_c1=$der['demand_c1']; 				
				$dmd_c2=$der['demand_c2'];
				$dmd_c3=$der['demand_c3']; 	
				$total_demand0=$dmd_c1+$dmd_c2+$dmd_c3;
// ------------------ get change in demand
$result1 = mysql_query("SELECT country1,country2,country3 FROM round_assumption where game_id='$gid' and round=$round_for_input");
$array = mysql_fetch_array($result1);
$co1=$array['country1'];	$co1 = preg_split("/[\s,]+/",$co1);
$co2=$array['country2'];	$co2 = preg_split("/[\s,]+/",$co2);
$co3=$array['country3'];	$co3 = preg_split("/[\s,]+/",$co3);
$change1=$co1[0];
$change2=$co2[0];
$change3=$co3[0];

$newdemand_c1=$dmd_c1*$change1;
$newdemand_c2=$dmd_c2*$change2;
$newdemand_c3=$dmd_c3*$change3;
// ------------------ get demand this round


  for ($c=1; $c<=3; $c++) 
	{
	echo"<br><h4>$LANG[$c]</h4>";
echo"<br><table><th>Value</th>";	
$techt="techtotalc".$c;
$newdemand="newdemand_c".$c;
//print th
	$result = mysql_query("SELECT id,game_id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
	while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];

echo"<th width=25%>".$teamid."</th>";
}
//echo $$techt;
   for ($i=1; $i<=4; $i++) 
	{	

// end th	
	$result = mysql_query("SELECT id,game_id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
echo"<tr><td>Total sales demand tech".$i."</td>";
	while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];

$techshare="techatt".$c.$i;
$tech_att="tech_att".$teamid.$c.$i;
$definal="demand_final".$teamid.$c.$i;
$sale="sale".$teamid.$c.$i;
if ($$techt!=0) {$$tech_att=round($$techshare/$$techt,2);} else {$$tech_att=0;}
// get final sale
$$sale=round($$tech_att*$$definal*$$newdemand,0);

//echo"<td colspan=".($teamnumber-1).">".number_format($$tech_att*100)."%</td>";		
echo"<td colspan=".($teamnumber-1).">".number_format($$sale)." ".$LANG['unit']."</td>";		

}	
echo"</tr>";
	}
echo"</table>";
	}
 
 
 
 
 
 
 
 
 //--------------------------------------------------------------------  GET AVAILABLE FOR SALE
// GET VALUE to VARIABLES
// get logistic cost
				$result1 = mysql_query("SELECT country1,country2,country3 FROM round_assumption where game_id='$gid' and round=$round_for_input");
				$array = mysql_fetch_array($result1);
				$logis=$array['country1'];	
				$admin2=$array['country2'];	
				$admin3=$array['country3'];	
				$lo= preg_split("/[\s,]+/",$logis);
				$admin2= preg_split("/[\s,]+/",$admin2);
				$admin3= preg_split("/[\s,]+/",$admin3);
				$l_c1_c2=$lo[17];
				$l_c2_c1=$lo[18];
				$l_c1_c3=$lo[19];
				$l_c2_c3=($l_c1_c2+$l_c2_c1+$l_c1_c3)/3;
		//RND		
				$fixadmin1=$lo[20]*1000000;
				
				$variableadmin1=$lo[21]*1000000;
				$fixadmin2=$admin2[20]*1000000;
				$variableadmin2=$admin2[21]*1000000;
				$fixadmin3=$admin3[20]*1000000;
				$cost_plant=$lo[22]*1000000;
				//echo $fixadmin1."/////".$fixadmin2;
				//echo "s".$fixadmin2."a";
$result = mysql_query("SELECT id,game_id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
//echo"<tr><td>Total sales demand tech".$i."</td>";
	while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];
   				$dnp1 = mysql_query("SELECT id,country1,country2,country3, logistic_order_c1,logistic_order_c2, transfer_price,investment_c2,investment_c1 FROM `input` where game_id='$gid' and team_id='$teamid' and team_decision='1' and round='$round_for_input'");
				$rw1 = mysql_fetch_array($dnp1);
				//get investment
				$invest1=$rw1['investment_c1']; 
				//echo $invest1;
				$invest1= preg_split("/[\s,]+/",$invest1);
				$invest2=$rw1['investment_c2']; 
				$invest2= preg_split("/[\s,]+/",$invest2);
				//echo $invest1[0];
				$plants1=$invest1[0];
				$plants2=$invest2[0];
				  // get number of factory	
				  
   $result2 = mysql_query("SELECT factory FROM output where game_id='$gid' and team_id='$teamid' and round='$round' and final='1'");
   $array2 = mysql_fetch_array($result2);
   $no_fac2=$array2['factory'];	
   $factory2=unserialize($no_fac2);
   $fac_c1=$factory2['c1'];
   $fac_c2=$factory2['c2'];
   
	// variable admin cost
				$va1=$fac_c1*$variableadmin1;
				$va2=$fac_c2*$variableadmin2;
				


				$va1=$fac_c1*$variableadmin1;
				$va2=$fac_c2*$variableadmin2;	
				
				
				// get transfer price
				$tp=$rw1['transfer_price']; 
				$input_id=$rw1['id']; 
				$tp=preg_split("/[,]+/",$tp);
				$tp12=$tp[0];
				$tp13=$tp[1];
				$tp21=$tp[2];
				$tp23=$tp[3];				
				$c1=$rw1['country1']; 
				//echo "[".$c1."]";
				$country1=unserialize(base64_decode($c1));
				//echo $country1;
				$c2=$rw1['country2']; 
				$country2=unserialize(base64_decode($c2));
				$c3=$rw1['country3']; 
				$country3=unserialize(base64_decode($c3));
				
				$ct1=$country1;
				$ct2=$country2;
				$ct3=$country3;

					
					
				// Get total production
				$p11=$country1['production1'];
				$p12=$country1['production2'];
				$o11=$country1['outsource1'];
				$o12=$country1['outsource2'];
				
				$p21=$country2['production1'];
				$p22=$country2['production2'];
				$o21=$country2['outsource1'];
				$o22=$country2['outsource2'];
	// get feature			
				//c1	
//					$price11=$country1['price_tech1'];
//					$price12=$country1['price_tech2'];
//					$price13=$country1['price_tech3'];
//					$price14=$country1['price_tech4'];		
	$feature11="feature11".$teamid;
	$feature12="feature12".$teamid;
	$feature13="feature13".$teamid;
	$feature14="feature14".$teamid;
	
					$$feature11=$country1['sale_feature1'];
					$$feature12=$country1['sale_feature2'];
					$$feature13=$country1['sale_feature3'];
					$$feature14=$country1['sale_feature4'];	
	$promotion11="promotion11".$teamid;
	$promotion12="promotion12".$teamid;
	$promotion13="promotion13".$teamid;
	$promotion14="promotion14".$teamid;					
					$$promotion11=$country1['promotion1'];
					$$promotion12=$country1['promotion2'];
					$$promotion13=$country1['promotion3'];
					$$promotion14=$country1['promotion4'];
					
//					$salemargin11=$country1['sale_margin1'];
//					$salemargin12=$country1['sale_margin2'];
//					$salemargin13=$country1['sale_margin3'];
//					$salemargin14=$country1['sale_margin4'];
					
				//c2	
//					$price21=$country2['price_tech1'];
//					$price22=$country2['price_tech2'];
//					$price23=$country2['price_tech3'];
//					$price24=$country2['price_tech4'];	
	$feature21="feature21".$teamid;
	$feature22="feature22".$teamid;
	$feature23="feature23".$teamid;
	$feature24="feature24".$teamid;
	
					$$feature21=$country2['sale_feature1'];
					$$feature22=$country2['sale_feature2'];
					$$feature23=$country2['sale_feature3'];
					$$feature24=$country2['sale_feature4'];	
	$promotion21="promotion21".$teamid;
	$promotion22="promotion22".$teamid;
	$promotion23="promotion23".$teamid;
	$promotion24="promotion24".$teamid;
					$$promotion21=$country2['promotion1'];
					$$promotion22=$country2['promotion2'];
					$$promotion23=$country2['promotion3'];
					$$promotion24=$country2['promotion4'];
				
//					$salemargin21=$country2['sale_margin1'];
//					$salemargin22=$country2['sale_margin2'];
//					$salemargin23=$country2['sale_margin3'];
//					$salemargin24=$country2['sale_margin4'];
					
				//c3	
//					$price31=$country3['price_tech1'];
//					$price32=$country3['price_tech2'];
//					$price33=$country3['price_tech3'];
//					$price34=$country3['price_tech4'];	
	$feature31="feature31".$teamid;
	$feature32="feature32".$teamid;
	$feature33="feature33".$teamid;
	$feature34="feature34".$teamid;
					$$feature31=$country3['sale_feature1'];
					$$feature32=$country3['sale_feature2'];
					$$feature33=$country3['sale_feature3'];
					$$feature34=$country3['sale_feature4'];	
	$promotion31="promotion31".$teamid;
	$promotion32="promotion32".$teamid;
	$promotion33="promotion33".$teamid;
	$promotion34="promotion34".$teamid;
	
					$$promotion31=$country3['promotion1'];
					$$promotion32=$country3['promotion2'];
					$$promotion33=$country3['promotion3'];
					$$promotion34=$country3['promotion4'];
				
//					$salemargin31=$country3['sale_margin1'];
//					$salemargin32=$country3['sale_margin2'];
//					$salemargin33=$country3['sale_margin3'];
//					$salemargin34=$country3['sale_margin4'];	

				// feature research available
					$f11=$country1['feature_tech1'];
				//	$f21=$country1['feature_tech2'];
				//	$f31=$country1['feature_tech3'];
				//	$f41=$country1['feature_tech4'];
					
					$f11 =preg_split("/[,]+/",$f11);
				//	$f21 =preg_split("/[,]+/",$f21);
				//	$f31 =preg_split("/[,]+/",$f31);
				//	$f41 =preg_split("/[,]+/",$f41);
					
					// feature cost per unit = total feature investment cost / 10 years/ estimated sale over 10 years
					$feat_cost=$f11[2]/40/$total_demand0*50;
					$rnd_buycost=$f11[5];
					
// end get					
				// from string to array
				$p11 =preg_split("/[,]+/",$p11);
				$p12 =preg_split("/[,]+/",$p12);
				$o11 =preg_split("/[,]+/",$o11);
				$o12 =preg_split("/[,]+/",$o12);
				
				$p21 =preg_split("/[,]+/",$p21);
				$p22 =preg_split("/[,]+/",$p22);
				$o21 =preg_split("/[,]+/",$o21);
				$o22 =preg_split("/[,]+/",$o22);


				$logis1=$rw1['logistic_order_c1']; 		
				$logis2=$rw1['logistic_order_c2']; 	
				$logis1=preg_split("/[,]+/",$logis1);	
				$logis2=preg_split("/[,]+/",$logis2);	

// for country1/2 tech 1/2
$lo11=$logis1[0];
$lo12=$logis1[1];
$lo13=$logis1[2];
$lo14=$logis1[3];

$lo21=$logis2[0];
$lo22=$logis2[1];
$lo23=$logis2[2];
$lo24=$logis2[3];
//-------	

		//tech type
				$t1=$p11[0];
				$t2=$p12[0];
				$t3=$o11[0];
				$t4=$o12[0];
				
				$t5=$p21[0];
				$t6=$p22[0];
				$t7=$o21[0];
				$t8=$o22[0];
		// unit of produce		
				$p1=$p11[2];
				$p2=$p12[2];
				$p3=$o11[2];
				$p4=$o12[2];
				
				$p5=$p21[2];
				$p6=$p22[2];
				$p7=$o21[2];
				$p8=$o22[2];	
		// get unit cost
				//c1
				$u1=$p11[5];
				$u2=$p12[5];
				$u3=$o11[5];
				$u4=$o12[5];
				//c2
				$u5=$p21[5];
				$u6=$p22[5];
				$u7=$o21[5];
				$u8=$o22[5];		
		// get total cost
				//c1
				$v1=$p11[2]*$p11[5];
				$v2=$p12[2]*$p12[5];
				$v3=$o11[2]*$o11[5];
				$v4=$o12[2]*$o12[5];
				//c2
				$v5=$p21[2]*$p21[5];
				$v6=$p22[2]*$p22[5];
				$v7=$o21[2]*$o21[5];
				$v8=$o22[2]*$o22[5];	
				
$tech11=$tech12=$tech13=$tech14=0;
$tech21=$tech22=$tech23=$tech24=0;
$vtech11=$vtech12=$vtech13=$vtech14=0;
$vtech21=$vtech22=$vtech23=$vtech24=0;
				for ($i=1; $i<=4; $i++) 
				{
				$t="t".$i;
				$p="p".$i;
				$v="v".$i;
				if ($$t==1) {$tech11=$tech11+$$p;$vtech11=$vtech11+$$v;}
				if ($$t==2) {$tech12=$tech12+$$p;$vtech12=$vtech12+$$v;}
				if ($$t==3) {$tech13=$tech13+$$p;$vtech13=$vtech13+$$v;}
				if ($$t==4) {$tech14=$tech14+$$p;$vtech14=$vtech14+$$v;}
				//echo "<br>".$tech."<br>=".$$tech."+".$$p;
				
				}	
				for ($i=5; $i<=8; $i++) 
				{
				$t="t".$i;
				$p="p".$i;
				$v="v".$i;
				if ($$t==1) {$tech21=$tech21+$$p;$vtech21=$vtech21+$$v;}
				if ($$t==2) {$tech22=$tech22+$$p;$vtech22=$vtech22+$$v;}
				if ($$t==3) {$tech23=$tech23+$$p;$vtech23=$vtech23+$$v;}
				if ($$t==4) {$tech24=$tech24+$$p;$vtech24=$vtech24+$$v;}
				//echo "<br>".$tech."<br>=".$$tech."+".$$p;
				}									
		
// unit cost
// c1
$uc11="uc".$teamid."11";
$uc12="uc".$teamid."12";
$uc13="uc".$teamid."13";
$uc14="uc".$teamid."14";

$uc21="uc".$teamid."21";
$uc22="uc".$teamid."22";
$uc23="uc".$teamid."23";
$uc24="uc".$teamid."24";


// get old inventory

   $result21 = mysql_query("SELECT inventory_c1,inventory_c2,ucost_inven1,ucost_inven2 FROM output where game_id='$gid' and team_id='$teamid' and round='$round' and final='1'");
   $array21 = mysql_fetch_array($result21);
// ucost inventory
		$uci1=$array21['ucost_inven1'];	
		$uci2=$array21['ucost_inven2'];
		
		$uci1 = preg_split("/[,]+/",$uci1);
		$uci2 = preg_split("/[,]+/",$uci2);
// get carrying inventory cost		
$ivc = mysql_query("SELECT inventory_cost_per_uni FROM `game` where id='$gid'");
$ivcs = mysql_fetch_array($ivc);
$ivcc=(1+$ivcs['inventory_cost_per_uni']/100); 	
//c1
$uci11="uci".$teamid."11";
$uci12="uci".$teamid."12";
$uci13="uci".$teamid."13";
$uci14="uci".$teamid."14";
//c2
$uci21="uci".$teamid."21";
$uci22="uci".$teamid."22";
$uci23="uci".$teamid."23";
$uci24="uci".$teamid."24";
	
//c1
$$uci11=$uci1[0]*$ivcc;
$$uci12=$uci1[1]*$ivcc;
$$uci13=$uci1[2]*$ivcc;
$$uci14=$uci1[3]*$ivcc;
//c2
$$uci21=$uci2[0]*$ivcc;
$$uci22=$uci2[1]*$ivcc;
$$uci23=$uci2[2]*$ivcc;
$$uci24=$uci2[3]*$ivcc;


$inven1=$array21['inventory_c1'];	
$inven2=$array21['inventory_c2'];
$inven1 = preg_split("/[,]+/",$inven1);
$inven2 = preg_split("/[,]+/",$inven2);		


$inven11="inven".$teamid."11";
$inven12="inven".$teamid."12";
$inven13="inven".$teamid."13";
$inven14="inven".$teamid."14";

$inven21="inven".$teamid."21";
$inven22="inven".$teamid."22";
$inven23="inven".$teamid."23";
$inven24="inven".$teamid."24";	

$$inven11=$inven1[0];
$$inven12=$inven1[1];
$$inven13=$inven1[2];
$$inven14=$inven1[3];

$$inven21=$inven2[0];
$$inven22=$inven2[1];
$$inven23=$inven2[2];
$$inven24=$inven2[3];	



if ($tech11<>0){$$uc11=$vtech11/$tech11;} else {$$uc11=0;}
if ($tech12<>0){$$uc12=$vtech12/$tech12;} else {$$uc12=0;}
if ($tech13<>0){$$uc13=$vtech13/$tech13;} else {$$uc13=0;}
if ($tech14<>0){$$uc14=$vtech14/$tech14;} else {$$uc14=0;}
//c2
if ($tech21<>0){$$uc21=$vtech21/$tech21;} else {$$uc21=0;}
if ($tech22<>0){$$uc22=$vtech22/$tech22;} else {$$uc22=0;}
if ($tech23<>0){$$uc23=$vtech23/$tech23;} else {$$uc23=0;}
if ($tech24<>0){$$uc24=$vtech24/$tech24;} else {$$uc24=0;}
//echo"unit cost tech 1 country1".($uc24);

// get old inventory

   $result2 = mysql_query("SELECT inventory_c1,inventory_c2 FROM output where game_id='$gid' and team_id='$tid' and round='$round' and final='1'");
   $array2 = mysql_fetch_array($result2);

$inven1=$array2['inventory_c1'];	
$inven2=$array2['inventory_c2'];
$inven1 = preg_split("/[,]+/",$inven1);
$inven2 = preg_split("/[,]+/",$inven2);		

$inven11=$inven1[0];
$inven12=$inven1[1];
$inven13=$inven1[2];
$inven14=$inven1[3];

$inven21=$inven2[0];
$inven22=$inven2[1];
$inven23=$inven2[2];
$inven24=$inven2[3];	

	$tech11=$tech11+$inven11;
	$tech12=$tech12+$inven12;
	$tech13=$tech13+$inven13;
	$tech14=$tech14+$inven14;
	$tech21=$tech21+$inven21;
	$tech22=$tech22+$inven22;
	$tech23=$tech23+$inven23;
	$tech24=$tech24+$inven24;
			
			
			$pro11="pro".$teamid."11";
			$pro12="pro".$teamid."12";
			$pro13="pro".$teamid."13";
			$pro14="pro".$teamid."14";
			$pro21="pro".$teamid."21";
			$pro22="pro".$teamid."22";
			$pro23="pro".$teamid."23";
			$pro24="pro".$teamid."24";

			$$pro11=$tech11;
			$$pro12=$tech12;
			$$pro13=$tech13;
			$$pro14=$tech14;
			$$pro21=$tech21;
			$$pro22=$tech22;
			$$pro23=$tech23;
			$$pro24=$tech24;	
			
			
			//echo"pro11:".$pro11."<br>";
// ---------------------- main engine for logistic stock
// pro_c1/pro_c2/pro_c3 :$pro11-$pro24
// demand_c1/demand_c2/demand_c3 :$dt11-$dt24
//logistic_c1 : 123 $logis1/$logis2
// logisctic for 4 tech  $logis1[0]; $logis1[1]; $logis1[2]; $logis1[3];
// logisctic for 4 tech  $logis2[0]; $logis2[1]; $logis2[2]; $logis2[3];
//available a11 a21
$avai11=$avai12=$avai13=$avai14=$avai21=$avai22=$avai23=$avai24=$avai31=$avai32=$avai33=$avai34=0;
// manufacture from

// Logistic engine start
//----------------- logistic order works when total supply < total demand
	for ($c=1; $c<=3; $c++) 
	{
	
		for ($t=1; $t<=4; $t++) 
		{
		$totalp="totalp".$teamid.$t;
		$totald="totald".$teamid.$t;// from saledemand
		$pro="pro".$teamid.$c.$t;
			if ($c==1 or $c==2) { if (isset($$totalp)) {$$totalp=$$totalp+$$pro;} else {$$totalp=$$pro;}}
			
			$dt="sale".$teamid.$c.$t;
			
			if (isset($$totald)) {$$totald=$$totald+$$dt;} else {$$totald=$$dt;}
		}
	}	
	//echo "Total:".($dt11+$dt21+$dt31)."<br>";
	//echo "Totalc1:".($dt11)."/".$mt11."/".$d1."/".$dmd_c1."<br>";
	//echo "Totalc2:".($dt21)."/".$mt21."/".$d2."/".$dmd_c2."<br>";
	//echo "Totalc3:".($dt31)."/".$mt31."/".$d3."/".$dmd_c3."<br>";
	
	
	
	
	for ($t=1; $t<=4; $t++) 
	{
		$totalp="totalp".$teamid.$t;
		$totald="totald".$teamid.$t;
		if ($$totalp>$$totald)

			{
					for ($c=1; $c<=3; $c++) 
					{
					// set for priorty local product
					$dt="sale".$teamid.$c.$t;
					//echo $$dt;
					$avai="avai".$c.$t;
					$pro1="pro".$teamid."1".$t;
					$pro2="pro".$teamid."2".$t;
					$m1="m1".$teamid.$c.$t;
					$m2="m2".$teamid.$c.$t;
			if ($c==1)
			{			
					if ($$pro1>=$$dt) 
						{
						$$avai=$$dt;
						$$pro1=$$pro1-$$dt;
						$$m1=$$dt;
						}
						
					else
						{
						$$avai=$$pro1;
						$$m1=$$pro1;

						$m="m1".$teamid."2".$t;
						$$m=($$dt-$$pro1);
						$$pro2=$$pro2-($$dt-$$pro1);
						$$pro1=0;
						}							
			}	
			
			if ($c==2)
			{			
					if ($$pro2>=$$dt) 
						{
						$$avai=$$dt;
						$$pro2=$$pro2-$$dt;
						$$m2=$$dt;
					
						}
						
					else
						{
						$$avai=$$pro2;
						$$m2=$$pro2;
						
						$m="m2".$teamid."1".$t;
						$$m=($$dt-$$pro2);
						$$pro1=$$pro1-($$dt-$$pro2);
						$$pro2=0;
						}							
			}			
			
			// for country 3
					
			if ($c==3)
			{			
					if ($l_c1_c3>=$l_c2_c3) 
						{
						$proc="pro".$teamid."2".$t;
						$prod="pro".$teamid."1".$t;
						$mc="m3".$teamid."2".$t;
						$md="m3".$teamid."1".$t;
						if ($$proc>$$dt)
							{
							$$avai=$$dt;
							$$proc=$$proc-$$dt;
							$$mc=$$dt;
							}
							else
							{
							$$avai=$$avai+$$proc;
							$$mc=$$mc+$$proc;
							$$proc=0;
							//for c1
							$$avai=$$avai+($$dt-$$proc);
							$$prod=$$prod-($$dt-$$proc);
							$$md=$$md+($$dt-$$proc);
							}
						
						}
					if ($l_c1_c3<$l_c2_c3) 
						{
						$proc="pro".$teamid."1".$t;
						$prod="pro".$teamid."2".$t;
						$mc="m3".$teamid."1".$t;
						$md="m3".$teamid."2".$t;
						if ($$proc>$$dt)
							{
							$$avai=$$dt;
							$$proc=$$proc-$$dt;
							$$mc=$$dt;
							}
							else
							{
							$$avai=$$avai+$$proc;
							if (isset($$mc)) {$$mc=$$mc+$$proc;} else {$$mc=$$proc;}
							$$proc=0;
							//for c1
							$$avai=$$avai+($$dt-$$proc);
							$$prod=$$prod-($$dt-$$proc);
							if (isset($$md)) {$$md=$$md+($$dt-$$proc);} else  {$$md=($$dt-$$proc);}
							}
						
						}						
						
			}					
					}			
			
			
			}
		
	}
// enable logistic

	for ($c=1; $c<=2; $c++) 
	{
	
		for ($t=1; $t<=4; $t++) 
		{	
		$totalp="totalp".$teamid.$t;
		$totald="totald".$teamid.$t;
		if ($$totalp<=$$totald)
	{	
		$lo="lo".$c.$t;
		$a=$$lo;
		$tech="pro".$teamid.$c.$t;
		$demand="dt".$c.$t;
		$av="av".$c.$t;
			for ($k=1; $k<=3; $k++) 
				{	
		
		$ship="ship".$k;
		$$ship=$a[$k-1];
		$dt="sale".$teamid.$$ship.$t;

		$avai="avai".$$ship.$t;
		
		$m="m".$$ship.$teamid.$c.$t;
		//if ($$dt<$$avai) 
		//	{
		//echo "<br>".$$dt."<".$$tech."<br>";
		//echo $demand."-".$avai."<br>";
			
			if ($$dt>=$$avai) 
				{
					if ($$tech<=($$dt-$$avai))
					{
					$$avai=$$avai+$$tech;
					if (isset($$m)) {$$m=$$m+$$tech;} else {$$m=$$tech;}
					$$tech=0;	
					}
					if ($$tech>($$dt-$$avai))
					{
					if (isset($$m)) {$$m=$$m+$$dt-$$avai;} else {$$m=$$dt-$$avai;}
					$$tech=$$tech-($$dt-$$avai);	
					$$avai=$$dt;
					
					}
				}
				else
				{

				}


			
		
				}
		}
	}	
	}

	
// ----------------------------- logistic engine stop	

}
// end loop team



echo"<br><h4>-----------------------HR-------------------------</h4>";


echo"<br><h4>HR turnover rate</h4>";
echo"<br><table>";
echo"<th>HR background</th>";	
//$pde="pdemax".$c.$i;
$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
echo"<th>".$teamid."</th>";
}
echo"<tr><td>HR turnover rate</td>";
//$pde="pdemax".$c.$i;
$result = mysql_query("SELECT team_id,country1 FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];

				$c1=$row['country1']; 
				//echo "[".$c1."]";
				$country1=unserialize(base64_decode($c1));
// RND inhouse cost
				   // $worker2=$country1['HR_no_of_staffs'];
					$wage2=$country1['HR_wage_pe'];
					$training2=$country1['HR_training_budget_pe'];
					//$turnover2=$country1['HR_turnover_rate'];
					//$layoff2=$country1['hr_layoff'];
					//echo $wage2."a";
					
// get profit last round

$result3 = mysql_query("SELECT output_c1,output_c2,output_c3 FROM `output` where game_id='$gid' and round='$round' and team_id='$teamid' and final='1'");
$row3 = mysql_fetch_array($result3);

 $output_c1=$row3['output_c1'];
 $output_c2=$row3['output_c2'];
 $output_c3=$row3['output_c3'];
 $output_c13 = preg_split("/[\s,]+/",$output_c1);
 $output_c23 = preg_split("/[\s,]+/",$output_c2);
 $output_c33 = preg_split("/[\s,]+/",$output_c3);
 

 $profit=(int)$output_c13[19]+(int)$output_c23[19]+(int)$output_c33[19];
	if ($profit>0) {$profit=1;} else {$profit=-1;}

// get efficiency
//$eff="eff".$teamid;
//$$eff=$wage2/$stanwage*$hrwage/100+$training2/$standtrain*$hrtrain/100;

//get turnover rate
$turn="turnover".$teamid;
$$turn=$stanturnover/($wage2/$stanwage*$turnoverwage/100+$training2/$standtrain*$turnovertrain/100+$profit*$hrprofit/100)/100;

echo"<td>".$$turn."</td>";

}
echo"</tr>";
echo "</table>";

// end


echo"<br><h4>HR efficiency rate</h4>";
echo"<br><table>";
echo"<th>HR background</th>";	
//$pde="pdemax".$c.$i;
$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
echo"<th>".$teamid."</th>";
}
echo"<tr><td>HR efficiency rate</td>";
//$pde="pdemax".$c.$i;
$result = mysql_query("SELECT team_id,country1 FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];

				$c1=$row['country1']; 
				//echo "[".$c1."]";
				$country1=unserialize(base64_decode($c1));
// RND inhouse cost
				   // $worker2=$country1['HR_no_of_staffs'];
					$wage2=$country1['HR_wage_pe'];
					$training2=$country1['HR_training_budget_pe'];
					//$turnover2=$country1['HR_turnover_rate'];
					//$layoff2=$country1['hr_layoff'];
					//echo $wage2."a";
					
// get profit last round
$result3 = mysql_query("SELECT * FROM `output` where game_id='$gid' and round='$round' and team_id='$teamid' and final='1'");
$row3 = mysql_fetch_array($result3);

 $output_c1=$row3['output_c1'];
 $output_c2=$row3['output_c2'];
 $output_c3=$row3['output_c3'];
 $output_c13 = preg_split("/[\s,]+/",$output_c1);
 $output_c23 = preg_split("/[\s,]+/",$output_c2);
 $output_c33 = preg_split("/[\s,]+/",$output_c3);
 

 $profit=(int)$output_c13[19]+(int)$output_c23[19]+(int)$output_c33[19];
	if ($profit>0) {$profit=1;} else {$profit=-1;}

// get efficiency
$eff="eff".$teamid;
$$eff=$wage2/$stanwage*$hrwage/100+$training2/$standtrain*$hrtrain/100+1*(1-$hrtrain/100-$hrwage/100);

//get turnover rate
//$turn="turnover".$teamid;
//$$turn=$stanturnover/($wage2/$stanwage*$turnoverwage/100+$training2/$standtrain*$turnovertrain/100+$profit*$hrprofit/100)/100;

echo"<td>".$$eff."</td>";

}
echo"</tr>";
echo "</table>";

// end


echo"<br><h4>--------------------------------GET AVAILABLE FOR SALE-------------------------</h4>";

echo"<br><h3>Available from c1</h3>";
for ($c=1; $c<=3; $c++) 
{


echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
echo "<table>"; 
echo "<th>Available from c1</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
echo"<th>".$tname."[".$teamid."]</th>";
}



  for ($i=1; $i<=4; $i++) 
	{
echo"<tr><td>Manufacture c1 tech ".$i."</td>";	

$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];
$mc="m".$c.$teamid."1".$i;




echo"<td>".number_format($$mc)."</td>";
}
echo"</tr>";
	}
echo"</table>";
}




echo"<br><h3>Available from c2</h3>";
for ($c=1; $c<=3; $c++) 
{


echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
echo "<table>"; 
echo "<th>Available from c2</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
echo"<th>".$tname."[".$teamid."]</th>";
}



  for ($i=1; $i<=4; $i++) 
	{
echo"<tr><td>Manufacture c2 tech ".$i."</td>";	

$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];
$mc="m".$c.$teamid."2".$i;



if (!isset($$mc)) {$$mc=0;}
echo"<td>".number_format($$mc)."</td>";
}
echo"</tr>";
	}
echo"</table>";
}


//----------------------------------- INVENTORY

echo"<br><h3>Inventory</h3>";
for ($c=1; $c<=3; $c++) 
{


echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
echo "<table>"; 
echo "<th>".$LANG[$c]."</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
echo"<th>".$tname."[".$teamid."]</th>";
}



  for ($i=1; $i<=4; $i++) 
	{
echo"<tr><td>Inventory tech ".$i."</td>";	

$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];

		$invtr="pro".$teamid.$c.$i;
		
if (!isset($$invtr)) {$$invtr=0;}
echo"<td>".number_format($$invtr)."</td>";
	
}


echo"</tr>";
	}
echo"</table>";
}


echo"<br><h4>--------------------------------END GET AVAILABLE FOR SALE-------------------------</h4>";




echo"<br><h4>--------------------------------GET OUPUT PNL-------------------------</h4>";


//---------------- REVENUE
echo"<br><h3>Revenue</h3>";
for ($c=1; $c<=3; $c++) 
{


echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
echo "<table>"; 
echo "<th>".$LANG[$c]."</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
echo"<th>".$tname."[".$teamid."]</th>";
}



  for ($i=1; $i<=4; $i++) 
	{
echo"<tr><td>Revenue tech ".$i."</td>";	

$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];
$sale="sale".$teamid.$c.$i;
$pdemand="price".$teamid.$c.$i;
$rev="rev".$teamid.$c.$i;
$$rev=$$sale*$$pdemand;


echo"<td>".number_format($$rev)."</td>";
}
echo"</tr>";
	}
echo"</table>";
}
//---------------- internal transfer

echo"<br><h3>Internal transfer Revenue</h3>";
for ($c=1; $c<=3; $c++) 
{


echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
echo "<table>"; 
echo "<th>".$LANG[$c]."</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
echo"<th>".$tname."[".$teamid."]</th>";
}



  for ($i=1; $i<=4; $i++) 
	{
echo"<tr><td>Revenue from transfer tech ".$i."</td>";	

$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];

		$uc1="uc".$teamid."1".$i;
		$uc2="uc".$teamid."2".$i;

$i_c="transfer".$teamid.$c.$i;
		if ($c==1)
			{
		$mk1="m2".$teamid."1".$i;
		$mk3="m3".$teamid."1".$i;

			$$i_c=$$mk1*$$uc1*($tp12-1)+$$mk3*$$uc1*($tp13-1);


			}
		if ($c==2)
			{
			$mk1="m1".$teamid."2".$i;
			$mk3="m3".$teamid."2".$i;
			$$i_c=$$mk1*$$uc2*($tp21-1)+$$mk3*$$uc2*($tp23-1);

			}
		if ($c==3)
			{
			$$i_c=0;
			}	

echo"<td>".number_format($$i_c)."</td>";
}
echo"</tr>";
	}
echo"</table>";
}
//---------------- Total revenue

//echo"<br><h3>Total Revenue</h3>";
for ($c=1; $c<=3; $c++) 
{


//echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
//echo "<table>"; 
//echo "<th>".$LANG[$c]."</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
//echo"<th>".$tname."[".$teamid."]</th>";
}

  for ($i=1; $i<=4; $i++) 
	{
//echo"<tr><td>total Revenue".$i."</td>";	

$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];

$total1="totalrev".$c.$teamid;

$i_c="transfer".$teamid.$c.$i;
$rev="rev".$teamid.$c.$i;


if (isset($$total1)) {$$total1=$$total1+$$rev+$$i_c;} 
else
{$$total1=$$rev+$$i_c;} 


//echo"<td>".number_format($$total)."</td>";
}
//echo"</tr>";
	}

//echo"</table>";
}

//----------------// receivable
 // get receivable/payable
$result1 = mysql_query("SELECT receivable,payable FROM game where id='$gid'");
$array = mysql_fetch_array($result1);
$receivabler=$array['receivable']/100;	
$payabler=$array['payable']/100;	 

echo"<br><h3>Receivables</h3>";
for ($c=1; $c<=3; $c++) 
{


echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
echo "<table>"; 
echo "<th>".$LANG[$c]."</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
echo"<th>".$tname."[".$teamid."]</th>";
}




echo"<tr><td>Receivables</td>";	

$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];
//get receivable last round
//$result1 = mysql_query("SELECT output_c1,output_c2,output_c3 FROM output where game_id='$gid' and round='$round' and team_id='$tid'");
//$array = mysql_fetch_array($result1);
//$co1=$array['output_c1'];	
//$co1 = preg_split("/[\s,]+/",$co1);
//$co2=$array['output_c2'];	
//$co2 = preg_split("/[\s,]+/",$co2);
//$co3=$array['output_c3'];	
//$co3 = preg_split("/[\s,]+/",$co3);


//last round receivable and payable
//$lastre1=(float)$co1[23];
//$lastpay1=(float)$co1[36];
//$lastre2=(float)$co2[23];
//$lastpay2=(float)$co2[36];
//$lastre3=(float)$co3[23];
//$lastpay3=(float)$co3[36];
//$totalre=$lastre1+$lastre2+$lastre3;
//$totalpa=$lastpay3+$lastpay2+$lastpay1;


//$ltr="lastre".$c;

$rece="receivable".$teamid.$c;
$total="totalrev".$c.$teamid;
$$rece=$$total*$receivabler;


echo"<td>".number_format($$rece)."</td>";


}
echo"</tr>";

echo"</table>";

}

//----------------PROMOTION COST
echo"<br><h3>Promotion cost</h3>";
for ($c=1; $c<=3; $c++) 
{


echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
echo "<table>"; 
echo "<th>".$LANG[$c]."</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
echo"<th>".$tname."[".$teamid."]</th>";
}



  for ($i=1; $i<=4; $i++) 
	{
echo"<tr><td>Promotion cost tech ".$i."</td>";	

$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];
$pmcost="promotioncost".$teamid.$c.$i;
$pm="promotion".$c.$i.$teamid;
$rev="rev".$teamid.$c.$i;
$$pmcost=$$rev*$$pm/100;


echo"<td>".number_format($$pmcost)."</td>";
}
echo"</tr>";
	}
echo"</table>";
}

//---------------- PRODUCTION COST
echo"<br><h3>Inhouse production cost</h3>";
for ($c=1; $c<=3; $c++) 
{


echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
echo "<table>"; 
echo "<th>".$LANG[$c]."</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
echo"<th>".$tname."[".$teamid."]</th>";
}



  for ($i=1; $i<=4; $i++) 
	{
echo"<tr><td>In-house Production tech ".$i."</td>";	

$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];

		$m1="m".$c.$teamid."1".$i;
		$m2="m".$c.$teamid."2".$i;
		$uc1="uc".$teamid."1".$i;
		$uc2="uc".$teamid."2".$i;
// get ucost report string
$ucost_report1="ucost_report1".$teamid;
$ucost_report2="ucost_report2".$teamid;	
if ($c==1) {if (isset($$ucost_report1)) {$$ucost_report1=$$ucost_report1.",".$$uc1;} else {$$ucost_report1=$$uc1;}}
if ($c==2) {if (isset($$ucost_report2)) {$$ucost_report2=$$ucost_report2.",".$$uc2;} else {$$ucost_report2=$$uc2;}}

		$inv1="inven".$teamid."1".$i;
		$inv2="inven".$teamid."2".$i;
		$uci1="uci".$teamid."1".$i;
		$uci2="uci".$teamid."2".$i;

$inhouse="procost".$teamid.$c.$i;

		if ($c==1)
			{
			
			if ($$inv1<=$$m1) 
				{
				$$inhouse=($$m1-$$inv1)*$$uc1+$$uci1*$$inv1;
				}
			if ($$inv2>$$m1) 
				{
				$$inhouse=$$m1*$$uci1;
				}
			}
		if ($c==2)
			{
			//$$inhouse=$$m2*$$uc2;
			
			if ($$inv2<=$$m2) 
				{
				$$inhouse=($$m2-$$inv2)*$$uc2+$$uci2*$$inv2;
				}
			if ($$inv2>$$m2) 
				{
				$$inhouse=$$m2*$$uci2;
				}			
			}
		if ($c==3)
			{
			$$inhouse=0;
			}		


	
echo"<td>".number_format($$inhouse)."</td>";
}
echo"</tr>";
	}
echo"</table>";
}


//---------------- transport COST
echo"<br><h3>Transportation cost</h3>";
for ($c=1; $c<=3; $c++) 
{


echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
echo "<table>"; 
echo "<th>".$LANG[$c]."</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
echo"<th>".$tname."[".$teamid."]</th>";
}



  for ($i=1; $i<=4; $i++) 
	{
echo"<tr><td>Transportation tech ".$i."</td>";	

$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];

		$m1="m".$c.$teamid."1".$i;
		$m2="m".$c.$teamid."2".$i;
		$uc1="uc".$teamid."1".$i;
		$uc2="uc".$teamid."2".$i;
		

$production="transport".$teamid.$c.$i;
if ($c==1)
	{
	$$production=$$m2*$l_c2_c1;
	
	}
if ($c==2)
	{
	$$production=$$m1*$l_c1_c2;	
	}
if ($c==3)
	{
	$$production=$$m1*$l_c1_c3+$$m2*$l_c2_c3;
	}	
	
echo"<td>".number_format($$production)."</td>";
}
echo"</tr>";
	}
echo"</table>";
}




//---------------- cost of import COST
echo"<br><h3>Imported cost</h3>";
for ($c=1; $c<=3; $c++) 
{


echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
echo "<table>"; 
echo "<th>".$LANG[$c]."</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
echo"<th>".$tname."[".$teamid."]</th>";
}



  for ($i=1; $i<=4; $i++) 
	{
echo"<tr><td>Imported cost tech ".$i."</td>";	

$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];

		$m1="m".$c.$teamid."1".$i;
		$m2="m".$c.$teamid."2".$i;
		$uc1="uc".$teamid."1".$i;
		$uc2="uc".$teamid."2".$i;
		

$production="importcost".$teamid.$c.$i;
if ($c==1)
	{
	$$production=($$m2*$$uc2)*($tp21);
	
	}
if ($c==2)
	{
	$$production=($$m1*$$uc1)*($tp12);	
	}
if ($c==3)
	{
	$$production=($$m1*$$uc1)*($tp13)+($$m2*$$uc2)*($tp23);
	}	
	
echo"<td>".number_format($$production)."</td>";
}
echo"</tr>";
	}
echo"</table>";
}


//---------------- feature COST
echo"<br><h3>Feature cost</h3>";
for ($c=1; $c<=3; $c++) 
{


echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
echo "<table>"; 
echo "<th>".$LANG[$c]."</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
echo"<th>".$tname."[".$teamid."]</th>";
}



  for ($i=1; $i<=4; $i++) 
	{
echo"<tr><td>Feature cost tech ".$i."</td>";	

$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];

		$m1="m".$c.$teamid."1".$i;
		$m2="m".$c.$teamid."2".$i;
		$uc1="uc".$teamid."1".$i;
		$uc2="uc".$teamid."2".$i;

		$nf="feature".$c.$i.$teamid;
		$fc=$feat_cost/(pow(1.1,$$nf));
		//echo $feat_cost;
		$fec="fec".$k.$i;
		//$$fec=($$m2+$$m1)*$fc*$$nf;

$production="featurecost".$teamid.$c.$i;
$$production=$$fec=($$m2+$$m1)*$fc*$$nf;
echo"<td>".number_format($$production)."</td>";
}
echo"</tr>";
	}
echo"</table>";
}











//---------------- Admin COST
echo"<br><h3>Admin cost</h3>";
for ($c=1; $c<=3; $c++) 
{


echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
echo "<table>"; 
echo "<th>".$LANG[$c]."</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
echo"<th>".$tname."[".$teamid."]</th>";
}


//echo $fixadmin1."////".$fixadmin2;
echo"<tr><td>Admin cost</td>";	

$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];


$totaladmin="admincost".$teamid.$c;
if ($c==1) 
{
$$totaladmin=$fixadmin1+$va1;
}
if ($c==2) 
{
$$totaladmin=$fixadmin2+$va2;
}
if ($c==3) 
{
$$totaladmin=$fixadmin3;
}
echo"<td>".number_format($$totaladmin)."</td>";
}
echo"</tr>";

echo"</table>";
}













echo"<br><h3>Rnd inhouse cost</h3>";

$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
echo "<table>"; 
echo "<th>Rnd</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
echo"<th>".$tname."[".$teamid."]</th>";
}



echo"<tr><td>Inhouse cost</td>";	

$result = mysql_query("SELECT team_id,country1 FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
// layoff cost
	$manday1 = mysql_query("SELECT hr_recruitment_layoff_cost FROM game where id='$gid'");
	$manday1 = mysql_fetch_array($manday1);	
	$rela_cost=$manday1['hr_recruitment_layoff_cost'];	
	
// get RND in house cost
					$ct1=$row['country1'];
					$c1=base64_decode($ct1);
					$country1=unserialize($c1);
					
					$worker2=$country1['HR_no_of_staffs'];
					$wage2=$country1['HR_wage_pe'];
					
					$training2=$country1['HR_training_budget_pe'];
					//$turnover2=$country1['HR_turnover_rate'];
					$layoff2=$country1['hr_layoff'];
					//echo $layoff2."a";
					$f11=$country1['feature_tech1'];
					$f11 =preg_split("/[,]+/",$f11);
					$rnd_buycost=$f11[5];
					//echo $rnd_buycost;
$turn="turnover".$teamid;
$rndcost="rndcost".$teamid;
$$rndcost=$worker2*$wage2*12+$worker2*$training2*12+$$turn*$worker2*$rela_cost+$rela_cost*$layoff2+$rnd_buycost;
// GET RND buy cost

echo"<td>".number_format($$rndcost)."</td>";
}
echo"</tr>";

echo"</table>";




//---------------- Total revenue

echo"<br><h3>Total Cost and expense</h3>";
//echo "<table>"; 
for ($c=1; $c<=3; $c++) 
{


//echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

//echo "<th></th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
//echo"<th>".$tname."[".$teamid."]</th>";
}


  for ($i=1; $i<=4; $i++) 
	{
//echo"<tr><td>Total cost and expense country".$i." </td>";		
$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];

$trans="transport".$teamid.$c.$i;
$inhouse="procost".$teamid.$c.$i;
$pmcost="promotioncost".$teamid.$c.$i;
$coi="importcost".$teamid.$c.$i;
$tfeature="featurecost".$teamid.$c.$i;
$totaladmin="admincost".$teamid.$c;
$rndcost="rndcost".$teamid;

//echo number_format($$rndcost)."////";


$total1="totalcost".$teamid."1";
$total2="totalcost".$teamid."2";
$total3="totalcost".$teamid."3";
if ($c==1) 
{
if (isset($$total1)) 
{
if ($i==1) {$rndcost1=$$rndcost;$totaladmin1=$$totaladmin;} else {$rndcost1=0;$totaladmin1=0;}

$$total1=$$total1+$$inhouse+$$pmcost+$$coi+$$tfeature+$totaladmin1+$rndcost1+$$trans;
}
 else
  {
  if ($i==1) {$rndcost1=$$rndcost;$totaladmin1=$$totaladmin;} else {$rndcost1=0;$totaladmin1=0;}
  $$total1=$$inhouse+$$pmcost+$$coi+$$tfeature+$totaladmin1+$rndcost1+$$trans;
  }
}
if ($c==2) 
{
if ($i==1) {$totaladmin2=$$totaladmin;} else {$totaladmin2=0;}
if (isset($$total2)) {$$total2=$$total2+$$inhouse+$$pmcost+$$coi+$$tfeature+$totaladmin2+$$trans;}
 else
  {$$total2=$$inhouse+$$pmcost+$$coi+$$tfeature+$totaladmin2+$$trans;}
}
if ($c==3) 
{
if ($i==1) {$totaladmin3=$$totaladmin;} else {$totaladmin3=0;}
if (isset($$total3)) {$$total3=$$total3+$$inhouse+$$pmcost+$$coi+$$tfeature+$totaladmin3+$$trans;}
 else
  {$$total3=$$inhouse+$$pmcost+$$coi+$$tfeature+$totaladmin3+$$trans;}
}
	//echo"<td>".number_format($$total1)."</td>";
}
//echo"</tr>";
	}
}
//echo"</table>";
echo"TOTAL COST C1: ".number_format($$total1)."/<br>";
echo"TOTAL COST C2: ".number_format($$total2)."/<br>";
echo"TOTAL COST C3: ".number_format($$total3)."/<br>";

//---------------- payable COST
echo"<br><h3>payable</h3>";
for ($c=1; $c<=3; $c++) 
{


echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
echo "<table>"; 
echo "<th>".$LANG[$c]."</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
echo"<th>".$tname."[".$teamid."]</th>";
}



echo"<tr><td>Payables</td>";	

$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];
//get payable last round

$result1 = mysql_query("SELECT output_c1,output_c2,output_c3 FROM output where game_id='$gid' and round='$round' and team_id='$tid' and final='1'");
$array = mysql_fetch_array($result1);
$co1=$array['output_c1'];	
$co1 = preg_split("/[\s,]+/",$co1);
$co2=$array['output_c2'];	
$co2 = preg_split("/[\s,]+/",$co2);
$co3=$array['output_c3'];	
$co3 = preg_split("/[\s,]+/",$co3);


//last round receivable and payable
//$lastre1=(float)$co1[23];
$lastpay1=(float)$co1[37];
//$lastre2=(float)$co2[23];
$lastpay2=(float)$co2[37];
//$lastre3=(float)$co3[23];
$lastpay3=(float)$co3[37];
//$totalre=$lastre1+$lastre2+$lastre3;
$totalpa=$lastpay3+$lastpay2+$lastpay1;


$ltp="lastpay".$c;

$rece="payable".$teamid.$c;
$total3="totalcost".$teamid.$c;
$$rece=$$total3*$payabler-$$ltp;




echo"<td>".number_format($$rece)."</td>";
}
echo"</tr>";

echo"</table>";
}



//---------------- EBITDA COST
echo"<br><h3>EBITDA</h3>";
for ($c=1; $c<=3; $c++) 
{


echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
echo "<table>"; 
echo "<th>".$LANG[$c]."</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
echo"<th>".$tname."[".$teamid."]</th>";
}



echo"<tr><td>EBITDA</td>";	

$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];

$total1="totalrev1".$teamid;
$total2="totalrev2".$teamid;
$total3="totalrev3".$teamid;
$totalc1="totalcost".$teamid."1";
$totalc2="totalcost".$teamid."2";
$totalc3="totalcost".$teamid."3";

$totaladmin="ebitda".$teamid.$c;
if ($c==1) 
{
$$totaladmin=$$total1-$$totalc1;
}
if ($c==2) 
{
$$totaladmin=$$total2-$$totalc2;
}
if ($c==3) 
{
$$totaladmin=$$total3-$$totalc3;
}
echo"<td>".number_format($$totaladmin)."</td>";
}
echo"</tr>";

echo"</table>";
}



//---------------- Depreciation COST
echo"<br><h3>Depreciation</h3>";
for ($c=1; $c<=3; $c++) 
{


echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
echo "<table>"; 
echo "<th>".$LANG[$c]."</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
echo"<th>".$tname."[".$teamid."]</th>";
}



echo"<tr><td>deprecation</td>";	

$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];
//get cost
   $result1 = mysql_query("SELECT country1 FROM round_assumption where game_id='$gid' and round=$round");
   $array = mysql_fetch_array($result1);
   $cost_per_plant=$array['country1'];	
   $cost_per_plant= preg_split("/[\s,]+/",$cost_per_plant);
   $cost_plant=$cost_per_plant[22]*1000000;
   
  // get number of factory		
  
   $result2 = mysql_query("SELECT factory FROM output where game_id='$gid' and team_id='$teamid' and round='$round' and final='1'");
   $array2 = mysql_fetch_array($result2);
   $no_fac2=$array2['factory'];	
   $factory2=unserialize($no_fac2);
   $fac_c1=$factory2['c1'];
   $fac_c2=$factory2['c2'];
   
   // get number of factory available next round
  // $result23 = mysql_query("SELECT next_factory FROM output where game_id='$gid' and team_id='$teamid' and round='$round' and final='1'");
  // $array23 = mysql_fetch_array($result23);
  // $no_fac23=$array23['next_factory'];	
   //$factory23= preg_split("/[\s,]+/",$no_fac23);
   //$fac_c12=$factory23[0];
   //$fac_c22=$factory23[1];  
   
   // get last round fixasset
  
   $result11 = mysql_query("SELECT output_c1,output_c2 FROM output where game_id='$gid' and team_id='$teamid' and round='$round' and final='1'");
   $array1 = mysql_fetch_array($result11);
   $a1=$array1['output_c1'];	
   $a2=$array1['output_c2'];	
   $a11= preg_split("/[\s,]+/",$a1);
   $a22= preg_split("/[\s,]+/",$a2);
   $fix1=$a11[21]; 
   $fix2=$a22[21]; 
   //echo $fix1."trieuanh";
   // get depreciation rate
   $result1 = mysql_query("SELECT depreciation_rate FROM game where id='$gid'");
   $array = mysql_fetch_array($result1);
   $dep_rate=$array['depreciation_rate'];   
   //echo $dep_rate;
$totaladmin="deprecation".$teamid.$c;
if ($c==1) 
{

$$totaladmin=$fix1*($dep_rate/100);
$fixa1="fixasset1".$teamid;
$$fixa1=$fix1-$$totaladmin;

}
if ($c==2) 
{
$$totaladmin=$fix2*($dep_rate/100);
$fixa2="fixasset2".$teamid;
$$fixa2=$fix2-$$totaladmin;
}
if ($c==3) 
{
$$totaladmin=0;
$fixa3="fixasset3".$teamid;
$$fixa3=0;
}
echo"<td>".number_format($$totaladmin)."</td>";
}
echo"</tr>";

echo"</table>";
}



//---------------- EBIT COST
echo"<br><h3>EBIT</h3>";
for ($c=1; $c<=3; $c++) 
{


echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
echo "<table>"; 
echo "<th>".$LANG[$c]."</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
echo"<th>".$tname."[".$teamid."]</th>";
}


echo"<tr><td>EBIT</td>";	

$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];
$ebitda="ebitda".$teamid.$c;
$deprecation="deprecation".$teamid.$c;
$totaladmin="ebit".$teamid.$c;

$$totaladmin=$$ebitda-$$deprecation;

echo"<td>".number_format($$totaladmin)."</td>";
}
echo"</tr>";

echo"</table>";
}


//---------------- NET FINANCE COST
//echo"<br><h3>NET FINANCE</h3>";
//for ($c=1; $c<=3; $c++) 
//{


//echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
//echo "<table>"; 
//echo "<th>".$LANG[$c]."</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
//echo"<th>".$tname."[".$teamid."]</th>";
}


//echo"<tr><td>NET FINANCE</td>";	

// get min cash			
$result1 = mysql_query("SELECT min_cash,share_face_value FROM game where id='$gid'");
$array = mysql_fetch_array($result1);
$mincash=$array['min_cash'];
$sharefv=$array['share_face_value'];

$result = mysql_query("SELECT investment_c2,investment_c1,team_id,fin_longterm_debt,fin_internal_loan_c1_c2,fin_internal_loan_c1_c3,fin_internal_loan_c3_c1,fin_internal_loan_c2_c1 FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];
				$internalloan12=$row['fin_internal_loan_c1_c2']*1000000;
				$internalloan13=$row['fin_internal_loan_c1_c3']*1000000;
				$internalloan31=$row['fin_internal_loan_c3_c1']*1000000;
				$internalloan21=$row['fin_internal_loan_c2_c1']*1000000;
				
				//echo "[".$internalloan12."abcde12]";
				//echo "[".$internalloan13."abcde13";
				//echo "[".$internalloan31."abcde31";
				//echo "[".$internalloan21."abcde21";
//get tax and interest				
$result1 = mysql_query("SELECT country1,country2,country3 FROM round_assumption where game_id='$gid' and round=$round_for_input");
$array = mysql_fetch_array($result1);
$c1=$array['country1'];	
$c1 = preg_split("/[\s,]+/",$c1);
$t1=$c1[8]*100;
$i1=$c1[9];
$short_interest_pre=$c1[24];

$c2=$array['country2'];
$c2 = preg_split("/[\s,]+/",$c2);
$t2=$c2[8]*100;
$i2=$c2[9];
$c3=$array['country3'];
$c3 = preg_split("/[\s,]+/",$c3);
$t3=$c3[8]*100;
$i3=$c3[9];



// get last round long short term debt

$result1 = mysql_query("SELECT output_c1,output_c2,output_c3,factory,next_factory FROM output where game_id='$gid' and round='$round' and team_id='$teamid' and final='1'");
$array = mysql_fetch_array($result1);
//get current factory
   $no_fac2=$array['factory'];	
    $nextfact=$array['next_factory'];	
	$nextfact = preg_split("/[\s,]+/",$nextfact);
	$nextfact1=$nextfact[0];
	$nextfact2=$nextfact[1];
   $factory2=unserialize($no_fac2);
   $fac_c1=$factory2['c1'];
   $fac_c2=$factory2['c2'];
   $currentfact1="currentfact1".$teamid;
   $currentfact2="currentfact2".$teamid;
   $$currentfact1=$fac_c1+$nextfact1;
   $$currentfact2=$fac_c2+$nextfact2;  
$co1=$array['output_c1'];	
$co1 = preg_split("/[\s,]+/",$co1);
$co2=$array['output_c2'];	
$co2 = preg_split("/[\s,]+/",$co2);
$co3=$array['output_c3'];	
$co3 = preg_split("/[\s,]+/",$co3);

$losscarry1=(float)$co1[24];
$losscarry2=(float)$co2[24];
$losscarry3=(float)$co3[24];
//echo $losscarry1;
//exit();
// get long term deb/short
$longdebt1=(float)$co1[34];
$shortdebt1=(float)$co1[35];

$longdebt2=(float)$co2[34];
$shortdebt2=(float)$co2[35];

$longdebt3=(float)$co3[34];
$shortdebt3=(float)$co3[35];

 //net finance
 $ld1=$longdebt1*$i1/100;
 $sd1=$shortdebt1*($i1/100+$short_interest_pre/100);
 //echo $i1;
 $ld2=$longdebt2*$i2/100;
 $sd2=$shortdebt2*($i2/100+$short_interest_pre/100);
 $ld3=$longdebt3*$i3/100;
 $sd3=0;
// current net finance
 $netfinance1=$ld1+$sd1;
 $netfinance2=$ld2+$sd2;
 $netfinance3=$ld3+$sd3;

 $shortd1="shortd1".$teamid;
 $shortd2="shortd2".$teamid;
 $shortd3="shortd3".$teamid;
 
 $$shortd1=$shortdebt1;
 $$shortd2=$shortdebt2;
 $$shortd3=$shortdebt3;
 
//c1 long +short
$longtermdebt=$row['fin_longterm_debt']*1000;

$restriclr=(float)$co1[29];

$ebitda1="ebitda_cf".$teamid."1";
$ebitda2="ebitda_cf".$teamid."2";
$ebitda3="ebitda_cf".$teamid."3";

$tebit1="ebitda".$teamid."1";
$tebit2="ebitda".$teamid."2";
$tebit3="ebitda".$teamid."3";
//echo $$tebit3."iiii";
$toebit=$$tebit1+$$tebit2+$$tebit3;
//$Cash=$Retained_earnings+$profit_b4_tax-$Inventory-$income_tax+$Payables-$Receivables+$depreciation;
$$ebitda1=($$tebit1)+$losscarry1-$netfinance1;
//$$ebitda1=$$tebit1;
//echo "[".$netfinance1."]loss".$losscarry1."==";
$$ebitda2=$$tebit2+$losscarry2-$netfinance2;
//echo $netfinance2."oooo";
$$ebitda3=$$tebit3+$losscarry3-$netfinance3;
//echo $netfinance1;exit();
// minus recevable payable inventory



//   1 ---ADD transfer loans----


$internalloan1="internall".$teamid."1";
$internalloan2="internall".$teamid."2";
$internalloan3="internall".$teamid."3";
$$internalloan1=$$internalloan2=$$internalloan3=0;
//if ($$ebitda1>$internalloan12)
//{
$$ebitda1=$$ebitda1-$internalloan12;
$$ebitda2=$$ebitda2+$internalloan12;
$$internalloan1=$$internalloan1-$internalloan12;
$$internalloan2=$$internalloan2+$internalloan12;
//}
//if ($$ebitda1>$internalloan13)
//{
$$ebitda1=$$ebitda1-$internalloan13;
$$ebitda3=$$ebitda3+$internalloan13;
$$internalloan1=$$internalloan1-$internalloan13;
$$internalloan3=$$internalloan3+$internalloan13;
//}
//if ($$ebitda2>$internalloan21)
//{
$$ebitda1=$$ebitda1+$internalloan21;
$$ebitda2=$$ebitda2-$internalloan21;
$$internalloan2=$$internalloan2-$internalloan21;
$$internalloan1=$$internalloan1+$internalloan21;
//}
//if ($$ebitda3>$internalloan31)
//{
$$ebitda1=$$ebitda1+$internalloan31;
$$ebitda3=$$ebitda3-$internalloan31;
$$internalloan3=$$internalloan3-$internalloan31;
$$internalloan1=$$internalloan1+$internalloan31;

//}

//echo $internalloan12."trieuanh";




// for investment cashflow

 
   $result1 = mysql_query("SELECT country1 FROM round_assumption where game_id='$gid' and round=$round");
   $array = mysql_fetch_array($result1);
   $cost_per_plant=$array['country1'];	
   $cost_per_plant= preg_split("/[\s,]+/",$cost_per_plant);
   $cost_plant=$cost_per_plant[22]*1000000;
 
 				$invest1=$row['investment_c1']; 
				//echo $invest1;
				$invest1= preg_split("/[\s,]+/",$invest1);
				$invest2=$row['investment_c2']; 
				$invest2= preg_split("/[\s,]+/",$invest2);
				//echo $invest1[0];
				//$plant_next_round1=$invest1[1];
				//$plant_next_round2=$invest2[1];
				//if ($round-$time)
				$c2_plant=$invest2[0];
				$cost2=$c2_plant*$cost_plant;
				//echo $cost2."bacs";
				$c1_plant=$invest1[0];
				$cost1=$c1_plant*$cost_plant;				
				
//echo $cost_plant."sd";
$$ebitda1=$$ebitda1-$cost1;
//echo $cost1."trieu";
$$ebitda2=$$ebitda2-$cost2;
//echo $cost2."trieu";
$fact1="newfact1".$teamid;
$factcost1="newfactcost1".$teamid;
$$factcost1=$cost1;
$$fact1=$c1_plant;

$fact2="newfact2".$teamid;
$$fact2=$c2_plant;
$factcost2="newfactcost2".$teamid;
$$factcost2=$cost2;

// 1. add new long loan for country 1
//new longdebt
//echo $longtermdebt."sushi";
if ($longtermdebt<0)
{
// check if enough cash
if ((-$longtermdebt)<$$ebitda1)
	{
	$$ebitda1=$$ebitda1+$longtermdebt;
	$newlongloan=$longdebt1+$longtermdebt;
	}
if ((-$longtermdebt)>$$ebitda1)
	{
	$newlongloan=$longdebt1-$$ebitda1;
	$$ebitda1=0;
	}
}
if ($longtermdebt>=0)
{
$$ebitda1=$$ebitda1+$longtermdebt;
$newlongloan=$longdebt1+$longtermdebt;
}
//echo "[".$longtermdebt."]longd";
$ltl1="flongloan1".$teamid;
$ltl2="flongloan2".$teamid;
$ltl3="flongloan3".$teamid;

//new long loan

$$ltl1=$newlongloan;
//echo $newlongloan."abc";


$$ltl2=0;
$$ltl3=0;
//  3. minus netfinance

$ls1=$$ltl1*$i1/100;
$ls3=$ls2=0;
//$$ltl2
//$$ltl3
 $netfinance11="netfinance1".$teamid;
 $netfinance21="netfinance2".$teamid;
 $netfinance31="netfinance3".$teamid;
  
 $$netfinance11=$ls1+$netfinance1;
 $$netfinance21=$ls2+$netfinance2;
 $$netfinance31=$ls3+$netfinance3;
//echo $$netfinance11."12345";
 $$ebitda1=$$ebitda1-($ls1);
 $$ebitda2=$$ebitda2-($ls2);
 //echo $ls2."abcs";
 $$ebitda3=$$ebitda3-($ls3);
 
// 4. minus payable/receivable
$rece1="receivable".$teamid."1";
$paya1="payable".$teamid."1";

 $$ebitda1= $$ebitda1-$$rece1;
  $$ebitda1= $$ebitda1+$$paya1;
  
  $rece2="receivable".$teamid."2";
$paya2="payable".$teamid."2";
//echo "newreveivable: ".$$rece2."<br>";
//echo "newpayable: ".$$paya2."<br>";
 $$ebitda2= $$ebitda2-$$rece2;
  $$ebitda2= $$ebitda2+$$paya2;
  
  $rece3="receivable".$teamid."3";
$paya3="payable".$teamid."3";

 $$ebitda3= $$ebitda3-$$rece3;
  $$ebitda3= $$ebitda3+$$paya3;
// minus dividends payment

//for DIVIDENd PAYMENT
 				$dlr = mysql_query("SELECT output_c1,output_c2,output_c3 FROM `output` where game_id='$gid' and team_id='$teamid' and round='$round' and final='1'");
				$der = mysql_fetch_array($dlr);

				//get share price/outstanding
				$sharep=$der['output_c1'];	
				$sharep= preg_split("/[\s,]+/",$sharep);
				$sharep2=$der['output_c2'];	
				$sharep2= preg_split("/[\s,]+/",$sharep2);
				$sharep3=$der['output_c3'];	
				$sharep3= preg_split("/[\s,]+/",$sharep3);
				
				$shareprice=$sharep[43];
				$shareout=$sharep[42];
				$sharecap=$sharep[28];
				
				$retaine1=$sharep[30]+$sharep[31];
				$retaine2=$sharep2[30]+$sharep2[31];
				$retaine3=$sharep3[30]+$sharep3[31];
				//echo $shareout."0987";
  				$dnp1 = mysql_query("SELECT fin_dividends, fin_shareissue FROM `input` where game_id='$gid' and team_id='$teamid' and team_decision='1' and round='$round_for_input'");
				$rw1 = mysql_fetch_array($dnp1);				
 				$dividends=$rw1['fin_dividends'];
			

				$shareissue=$rw1['fin_shareissue']*1000;
					//echo $shareissue."*&^";	
 $sharebb=$shareissue*$shareprice;
 
  $restricte="restricted".$teamid;
 $$restricte=$restriclr;
 $fsharecap="fsharecap".$teamid;
  $$fsharecap=$sharecap;
  
 $retain1="retain1".$teamid;
 $$retain1=$retaine1;
  $retain2="retain2".$teamid;
 $$retain2=$retaine2;
  $retain3="retain3".$teamid;
 $$retain3=$retaine3;
 $sissue="shareissues".$teamid;
 $$sissue=0;
 $divp="divpay".$teamid;
 $$divp=0;
 
 //check if enough money for buyback
 //if ( $sharebb<0)
 //{
// if (-$sharebb<=$$ebitda1)
//	{
	$shareout=$shareout+$shareissue;
	$$ebitda1=$$ebitda1+$sharebb;
	$$fsharecap=$sharecap+$sharebb;
	$$sissue=$shareissue;
//	}
// if (-$sharebb>$$ebitda1)
//	{
//	$shareout=$shareout+$$ebitda1/$shareprice;
//	$$sissue=$$ebitda1/$shareprice;
//	$$ebitda1=0;
//	$$fsharecap=$$ebitda1;
//	}
	
 //}
 
//  if ( $sharebb>0)
 //{
//	$$restricte=$shareissue*$shareprice-$shareissue*$sharefv;

//	$shareout=$shareout+$shareissue;
//	$$ebitda1=$$ebitda1+$sharebb;
//	$$fsharecap=$sharecap+$shareissue*$sharefv;
		//echo $$fsharecap."333333333";
//	$$sissue=$shareissue;
 //}
 
// echo $$restricte."123455";
  $div_payment1=$dividends/100*$sharefv*$shareout;
  
 // if ($div_payment1<=$$ebitda1)
 //{
 $$ebitda1=$$ebitda1-$div_payment1;
 $$retain1=$$retain1-$div_payment1;
 $$divp=$div_payment1;
 //}
 

 
 //echo  $$divp."div";
	
 // check if enought money for paying dividends



//echo $$netfinance1."<br>";

//echo"<td>".number_format($$totaladmin)."</td>";
}
//echo"</tr>";

//echo"</table>";
//}



//---------------- PBT and TAX COST
echo"<br><h3>profit b4 tax</h3>";
for ($c=1; $c<=3; $c++) 
{


echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
echo "<table>"; 
echo "<th>".$LANG[$c]."</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
echo"<th>".$tname."[".$teamid."]</th>";
}


echo"<tr><td>PBT</td>";	

$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];

//get tax and interest				
$result1 = mysql_query("SELECT country1,country2,country3 FROM round_assumption where game_id='$gid' and round=$round_for_input");
$array = mysql_fetch_array($result1);
$c1=$array['country1'];	
$c1 = preg_split("/[\s,]+/",$c1);
$t1=$c1[8]*100;
$i1=$c1[9];
$short_interest_pre=$c1[24];

$c2=$array['country2'];
$c2 = preg_split("/[\s,]+/",$c2);
$t2=$c2[8]*100;
$i2=$c2[9];
$c3=$array['country3'];
$c3 = preg_split("/[\s,]+/",$c3);
$t3=$c3[8]*100;
$i3=$c3[9];

//echo $t3."/";
$netfinance="netfinance".$c.$teamid;
$ebit="ebit".$teamid.$c;
$totaladmin="pbt".$teamid.$c;
$$totaladmin=$$ebit-$$netfinance;
$ft="finaltax".$teamid.$c;
$t="t".$c;
if ($$totaladmin>0)
{
$$ft=$$totaladmin*$$t/100;
}
else
{
$$ft=0;
}
echo"<td>".number_format($$totaladmin)."| Tax:".number_format($$ft)."</td>";
}
echo"</tr>";

echo"</table>";
}

//---------------- Net finance
echo"<br><h3>net finance expense</h3>";
for ($c=1; $c<=3; $c++) 
{


echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
echo "<table>"; 
echo "<th>".$LANG[$c]."</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
echo"<th>".$tname."[".$teamid."]</th>";
}


echo"<tr><td>net finance</td>";	

$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];
 $netfinance1="netfinance".$c.$teamid;
 
echo"<td>".number_format($$netfinance1)."</td>";
}
echo"</tr>";

echo"</table>";
}


//---------------- PAT
echo"<br><h3>profit after tax</h3>";
for ($c=1; $c<=3; $c++) 
{


echo"<br><h4>$LANG[$c]</h4>";
$result = mysql_query("SELECT id,team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
echo "<table>"; 
echo "<th>".$LANG[$c]."</th>	";

while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
echo"<th>".$tname."[".$teamid."]</th>";
}


echo"<tr><td>PAT</td>";	

$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];
$pat="pat".$teamid.$c;
$totaladmin="pbt".$teamid.$c;

$ft="finaltax".$teamid.$c;
$$pat=$$totaladmin-$$ft;
echo"<td>".number_format($$totaladmin)."| Tax:".number_format($$ft)."</td>";
}
echo"</tr>";

echo"</table>";
}



echo"<br><h4>--------------------------------END GET OUPUT PNL-------------------------</h4>";


// WRITE OUTPUT

// -----------unlock tech/feature

$result = mysql_query("SELECT team_id,country1 FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];

					$ct1=$row['country1'];
					$c1=base64_decode($ct1);
					$c11=unserialize($c1);
					$f11=$c11['feature_tech1'];
					$f21=$c11['feature_tech2'];
					$f31=$c11['feature_tech3'];
					$f41=$c11['feature_tech4'];
					
					$f11 =preg_split("/[,]+/",$f11);
					$f21 =preg_split("/[,]+/",$f21);
					$f31 =preg_split("/[,]+/",$f31);
					$f41 =preg_split("/[,]+/",$f41);
					//$te1=round($f11[5]-$f11[4]*$f11[2]-$cost_t1);
// get current feature	
				
 	$feature1 = mysql_query("SELECT feature FROM output where game_id='$gid' and team_id='$tid' and round='$round' and final='1'");
	$feature1 = mysql_fetch_array($feature1);
	$f0=$feature1['feature'];
		$f0 =preg_split("/[,]+/",$f0);
		$f1=$f0[0];
		$f2=$f0[1];
		$f3=$f0[2];
		$f4=$f0[3];
//new feature
		$nf1=$f11[3]+$f11[3]+$f1;
		$nf2=$f21[3]+$f21[3]+$f2;
		$nf3=$f31[3]+$f31[3]+$f3;
		$nf4=$f41[3]+$f41[3]+$f4;
$newf="newfeature".$teamid;	
$$newf=$nf1.",".$nf2.",".$nf3.",".$nf4;	

// get tech rate reduce					
$result1 = mysql_query("SELECT rate_of_tech_price_reduce FROM game where id='$gid'");
$array = mysql_fetch_array($result1);
$rate_reduce=$array['rate_of_tech_price_reduce']/100;	
//get tech cost					
$result1 = mysql_query("SELECT country1 FROM round_assumption where game_id='$gid' and round=$round");
$array = mysql_fetch_array($result1);
$cost_tech=$array['country1'];	
//echo $cost_tech."<br>";
$tech = preg_split("/[\s,]+/",$cost_tech);
$cost_t2=$tech[12]*(1-$rate_reduce*($round+1))*1000;
$cost_t3=$tech[13]*(1-$rate_reduce*($round+1))*1000;
$cost_t4=$tech[14]*(1-$rate_reduce*($round+1))*1000;
					$te2=round($f21[5]-$f21[4]*$f21[2]-$cost_t2);
					$te3=round($f31[5]-$f31[4]*$f31[2]-$cost_t3);
					$te4=round($f41[5]-$f41[4]*$f41[2]-$cost_t4);
					//if ($te1==0) {$tech_r1=1;}
					//	echo $te3;
					if ($te2==0) {$tech_r2=1;} else {$tech_r2=0;}
					if ($te3==0) {$tech_r3=1;} else {$tech_r3=0;}
					if ($te4==0) {$tech_r4=1;} else {$tech_r4=0;}
					
					// get current tech available
				$tech = mysql_query("SELECT tech FROM `output` where game_id='$gid' and team_id='$teamid' and round='$round' and final='1'");
				$ctech = mysql_fetch_array($tech);
				$t= preg_split("/[\s,]+/",$ctech[0]);
				$tch1="tech1".$teamid;
				$tch2="tech2".$teamid;
				$tch3="tech3".$teamid;
				$tch4="tech4".$teamid;
				
				$$tch1= $t[0];
				$$tch2= $t[1]+$tech_r2;
				$$tch3= $t[2]+$tech_r3;
				$$tch4= $t[3]+$tech_r4;
				
				$techav="techavai".$teamid;
				$$techav=$$tch1.",".$$tch2.",".$$tch3.",".$$tch4;
}
// output sales unit for tech marketshare

$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
while ($row = mysql_fetch_array($result))
{
for ($c=1; $c<=3; $c++) 
{
 for ($i=1; $i<=4; $i++) 
	{
$tt="tech".$i.$teamid;
//echo "[".$teamid."-".$$tt."]";
$teamid=$row['team_id'];
$def="sale".$teamid.$c.$i;
$def1=$$def*$$tt;

$tmarketshare="techmarketshare".$c.$teamid;
if ($i==1)
	{
$$tmarketshare=$def1;	
	} else 
		{
$$tmarketshare=$$tmarketshare.",".$def1;
		}
	}
}	
}


// unlock feature

//----------------
//echo"<br><h3>profit after tax</h3>";


for ($c=1; $c<=3; $c++) 
{


//echo"<tr><td>PAT</td>";	

$result = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");

while ($row = mysql_fetch_array($result))
{

$teamid=$row['team_id'];
$frev="frev".$teamid.$c;
$fic="fic".$teamid.$c;
$ff="ff".$teamid.$c;
$fin="fin".$teamid.$c;
$ftran="ftran".$teamid.$c;
$frnd="frnd".$teamid.$c;
$fpm="fpm".$teamid.$c;
$fcoi="fcoi".$teamid.$c;
$ftocost="ftocost".$teamid.$c;

$output="output".$c.$teamid;
$$frev=$$fic=$$ff=$$fin=$$ftran=$$frnd=$$fpm=$$fcoi=$$ftocost=0;
$totaliv=0;
for ($i=1; $i<=4; $i++) 
{
 $rev="rev".$teamid.$c.$i;
 $i_c="transfer".$teamid.$c.$i;
 $ffeature="featurecost".$teamid.$c.$i;
 $inhouse="procost".$teamid.$c.$i;
 $trans="transport".$teamid.$c.$i;
 $rndcost="rndcost".$teamid;
 $pmcost="promotioncost".$teamid.$c.$i;
 $coi="importcost".$teamid.$c.$i;
 $total1="totalcost".$teamid.$c;
 
 $$frev=$$frev+$$rev;
 $$fic=$$fic+$$i_c;
 $$ff=$$ff+$$ffeature;
 $$fin=$$fin+$$inhouse;
 $$ftran=$$ftran+$$trans;
 if ($i==1 and $c==1)
 {
 $$frnd=$$rndcost;
 }

 $$fpm=$$fpm+$$pmcost;
 
 $$fcoi=$$fcoi+$$coi;
 $$ftocost=$$total1;
//echo $$rndcost."---------";

 // for inventory value
 $totaliv="totaliv".$teamid.$c;
 $invtr="pro".$teamid.$c.$i;
 		$uc1="uc".$teamid."1".$i;
		$uc2="uc".$teamid."2".$i;
	if ($c==1) 
	{
	if (isset($$totaliv)) {$$totaliv=$$totaliv+$$invtr*$$uc1;} else  {$$totaliv=$$invtr*$$uc1;}
	}	
	
	if ($c==2) 
	{
	if (isset($$totaliv)) {$$totaliv=$$totaliv+$$invtr*$$uc2;} else  {$$totaliv=$$invtr*$$uc2;} 
	}	
	if ($c==3) {{$$totaliv=0;} }
}

// plus get old inventory
				$r=$round;
				$ou="output_c".$c;
				//if ($c==1 or $c==2)
				//{
				$result21 = mysql_query("SELECT ".$ou." FROM `output` where game_id='$gid' and team_id='$teamid' and round='$r' and final='1'");
				$row21 = mysql_fetch_array($result21);
				$sharep2=$row21[$ou];	
				$sharep2= preg_split("/[\s,]+/",$sharep2);
				$invent1=$sharep2[22];
			
				//}
				//else
				//{
				//$invent1=0;
				//}

 
 
//-----------------minus inventory
 $shortd="shortd".$c.$teamid;
$ebitda1="ebitda_cf".$teamid.$c;
$$ebitda1=$$ebitda1-$$totaliv+$invent1;
//echo "<br>".$invent1."sds".$c;
//echo "/".$$ebitda1."/abs";
$stl1="fshortloan".$c.$teamid;
 // minus income tax
 $ft="finaltax".$teamid.$c;
 //echo "[".$$ft."/trieu<br>";
 $$ebitda1=$$ebitda1-$$ft;
 
//------------------get old receivable/payable


$result1 = mysql_query("SELECT output_c1,output_c2,output_c3 FROM output where game_id='$gid' and round='$r' and team_id='$teamid' and final='1'");
$array = mysql_fetch_array($result1);
$co1=$array['output_c1'];	
$co1 = preg_split("/[\s,]+/",$co1);
$co2=$array['output_c2'];	
$co2 = preg_split("/[\s,]+/",$co2);
$co3=$array['output_c3'];	
$co3 = preg_split("/[\s,]+/",$co3);

//---------------last round receivable and payable
$lastre1=(float)$co1[23];
$lastpay1=(float)$co1[37];
$lastre2=(float)$co2[23];
$lastpay2=(float)$co2[37];
$lastre3=(float)$co3[23];
$lastpay3=(float)$co3[37];


$lastre="lastre".$c;
$lastpay="lastpay".$c;
//echo "<br>".$teamid."oldpayable".$$lastpay."/".$c."<br>";
//echo "oldrece".$$lastre."/".$c."<br>";

 $$ebitda1=$$ebitda1+$$lastre-$$lastpay;
//echo $$lastre."retrieuanh";
//echo $$lastpay."paytrieuanh";
//echo $mincash."si";
//   1--------pay of short term loan 1st  shortdebt
//echo "<br>[".$$ebitda1."for country".$c."trieu";
//echo "[".$$ebitda1."&&&&".$c.$teamid."]<br>";
//echo "<br>Country ".$c."team: ".$teamid."Value ".number_format($$ebitda1)."Shortdebt ".number_format($$shortd);
if ($mincash>$$ebitda1) {
$newshortloan1=$mincash-round($$ebitda1);
$$ebitda1=$mincash;
//echo "short: ".$newshortloan1."sushi ".$teamid."<br>";
//echo "ebitda minus op and fin ex".$c.": ".$$ebitda1."sushi ".$teamid. "<br>";
$$stl1=$newshortloan1+$$shortd;
} else 
{
//echo "<br>[".$$shortd."trieu/".$$ebitda1."/".$teamid."-".$c."]<br>";
if (($$ebitda1-$mincash)>=$$shortd)
	{
	//echo "<br>Country ".$c."team: ".$teamid."Value ".number_format($$ebitda1)."Shortdebt ".number_format($$shortd);
//echo $$shortd."trieu/".$teamid."-".$c."]";
$$ebitda1=($$ebitda1)-($$shortd);
//$$ebitda1=$mincash;
//echo $$ebitda1."+++++";
//exit;
//$$shortd=-$$shortd;
$$stl1=0;
$newshortloan1=-$$shortd;
	}
	else
	{
	$$stl1=$$shortd-($$ebitda1-$mincash);
	$$ebitda1=$mincash;
	$newshortloan1=-($$ebitda1-$mincash);
	}
}
//echo "CF: ".$$ebitda1."/".$teamid."<br>";

//$$ebitda1=$$ebitda1+$newshortloan1;


$total1="totalrev".$c.$teamid;
$totaladmin="admincost".$teamid.$c;
//echo $$totaladmin."/".$c."]trieuanh<br>";
$totalc1="totalcost".$teamid.$c;
$totaled="ebitda".$teamid.$c;
$totaldep="deprecation".$teamid.$c;
$totaleb="ebit".$teamid.$c;
$netfinance1="netfinance".$c.$teamid;
//echo "/".$$netfinance1."abcs";
$totalpb="pbt".$teamid.$c;
$ft="finaltax".$teamid.$c;
$pat="pat".$teamid.$c;


//Sales revenue""
 //from markets $rev="rev".$teamid.$c."1";
 //from internal transfer $i_c="transfer".$teamid.$c.$i;
//Total revenue $total1="totalrev1".$teamid;
//Costs and expenses=""
 //- Variable production costs $inhouse="procost".$teamid.$c.$i;
//Feature costs $ffeature="featurecost".$teamid.$c.$i;
//Transportation and tariffs $trans="transport".$teamid.$c.$i;
//Research and development$rndcost="rndcost".$teamid;
//Promotion $pmcost="promotioncost".$teamid.$c.$i;
//Administration $totaladmin="admincost".$teamid.$c;
//Cost of imported products $coi="importcost".$teamid.$c.$i;
//Total costs and expenses $total1="totalcost".$teamid."1";
//EBITDA 
//$totaladmin="ebitda".$teamid.$c;
//Depreciation from fixed assets $totaladmin="deprecation".$teamid.$c;
//EBIT $totaladmin="ebit".$teamid.$c;
//Net financing expenses  $netfinance1="netfinance1".$teamid;
//PROFIT BEFORE TAX $totaladmin="pbt".$teamid.$c;
// - Income Taxes $ft="finaltax".$teamid.$c;
//PROFIT AFTER TAX $pat="pat".$teamid.$c;

//----------- fro balance sheet

//ASSETS ""
//Fixed assets 
//Inventory
//Receivables
//Cash and cash equivalent
//Total assets
//SHAREHOLDERS' EQUITY AND LIABILITIES ""
//Equity ""
//Share capital
//Other restricted equity
//Profit for the round
//Retained earnings
//Total equity

//LIABILITIES""

//Long-term loans
//Short term loans - unplanned
//Payables
//Total liabilities
//Total shareholder's equity and liabilities
if ($c==1 or $c==2) {$factcost="newfactcost".$c.$teamid;} else {$factcost="newfactcost".$c.$teamid;$$factcost=0;}

$fixa="fixasset".$c.$teamid;
$$fixa=$$fixa+$$factcost;
//$tiv="tiv".$c.$teamid;
//$$tivd=$$totaliv;
$rece="receivable".$teamid.$c;

$totalasset="totalasset".$teamid.$c;

// equity
$restricte="restricted".$teamid;
//echo $$restricte."end1234";
$fsharecap="fsharecap".$teamid;
$retain="retain".$c.$teamid;
//echo "<br>Retain: ".$$retain."abcs";
$pat="pat".$teamid.$c;  //profit for the round
//if (isset($$retain)) {$$retain=$$retain+$$pat;} else  {$$retain=$$pat;}
$totale="totale".$teamid.$c;



//$totale=

//liablity
$ltl1="flongloan".$c.$teamid;
$stl1="fshortloan".$c.$teamid;
//$$stl1=100000000;
$paya="payable".$teamid.$c;
$totalia="totalia".$teamid.$c;




// get output final string

//$totalivn=$$totaliv;

//$ebit1="pat".$teamid."1";
//$ebit2="pat".$teamid."2";
//$ebit3="pat".$teamid."3";
//$tpat=$$ebit1+$$ebit2+$$ebit3;

//$Cash=$Retained_earnings+$profit_b4_tax-$Inventory-$income_tax+$Payables-$Receivables+$depreciation;
//echo number_format($$ebitda1)."]]]]]";
//if (isset($$ebitda1)) {$$ebitda1=$$ebitda1+$tpat-$totalivn;} else {$$ebitda1=$tpat-$totalivn;}
//if (isset($$ebitda2)) {$$ebitda2=$$ebitda2+$tpat-$totalivn;} else {$$ebitda2=$tpat-$totalivn;}
//if (isset($$ebitda3)) {$$ebitda3=$$ebitda3+$tpat-$totalivn;} else {$$ebitda3=$tpat-$totalivn;}
if ($c==1)
{
$$totale=$$fsharecap+$$restricte+$$pat+$$retain;
}
else 
{
$$totale=$$pat+$$retain;
}

$$totalasset=$$fixa+$$totaliv+$$rece+$$ebitda1;
$internalloan="internall".$teamid.$c;
$$totalia=$$ltl1+$$stl1+$$paya+$$internalloan;
$totalel=$$totalia+$$totale;
//echo $$fsharecap."trieu";
if ($c==2 or $c==3)
{
$$fsharecap=0;
$$restricte=0;
}

$$output="0,".$$frev.",".$$fic.",".$$total1.",0,".$$fin.",".$$ff.",".$$ftran.",".$$frnd.",".$$fpm.",".$$totaladmin.",".$$fcoi.",".$$totalc1.",".$$totaled.",".$$totaldep.",".$$totaleb.",".$$netfinance1.",".$$totalpb.",".$$ft.",".$$pat.",0,".$$fixa.",".$$totaliv.",".$$rece.",".$$ebitda1.",".$$totalasset.",0,0,".$$fsharecap.",".$$restricte.",".$$pat.",".$$retain.",".$$totale.",0,".$$ltl1.",".$$stl1.",".$$internalloan.",".$$paya.",".$$totalia.",".$totalel;
//echo $$output;

	
// insert to database



// insert to output


//echo"<td>".number_format($$totaladmin)."| Tax:".number_format($$ft)."</td>";
}
//echo"</tr>";

//echo"</table>";
}
//hardinput hard input for shareprice increase limits
$rand=rand(101,199);

$result0 = mysql_query("SELECT team_id FROM `input` where game_id='$gid' and round='$round_for_input' and team_decision='1' order by id desc");
while ($row = mysql_fetch_array($result0))
{
$teamid=$row['team_id'];
//echo "/".$teamid."/";
// -------------------------------------------------- generate share price
//get tax and interest				
$result1 = mysql_query("SELECT country1,country2,country3 FROM round_assumption where game_id='$gid' and round=$round_for_input");
$array = mysql_fetch_array($result1);
$c1=$array['country1'];	
$c1 = preg_split("/[\s,]+/",$c1);
$t12=$c1[8]*100;
$i12=$c1[9];


$c2=$array['country2'];
$c2 = preg_split("/[\s,]+/",$c2);
$t22=$c2[8]*100;
$i22=$c2[9];
$c3=$array['country3'];
$c3 = preg_split("/[\s,]+/",$c3);
$t32=$c3[8]*100;
$i32=$c3[9];
// next round
$nextround=$round_for_input+1;
if ($nextround>$rounds) {$nextround=$round;}
$result1 = mysql_query("SELECT country1,country2,country3 FROM round_assumption where game_id='$gid' and round=$nextround");
$array = mysql_fetch_array($result1);
$c1=$array['country1'];	
$c1 = preg_split("/[\s,]+/",$c1);
$t13=$c1[8]*100;
$i13=$c1[9];


$c2=$array['country2'];
$c2 = preg_split("/[\s,]+/",$c2);
$t23=$c2[8]*100;
$i23=$c2[9];
$c3=$array['country3'];
$c3 = preg_split("/[\s,]+/",$c3);
$t33=$c3[8]*100;
$i33=$c3[9];


// get share price weight assumption
 	$para1 = mysql_query("SELECT c1 FROM weight_assumption where id='13'");
	$arrayp1 = mysql_fetch_array($para1);
	$cagrowth=$arrayp1['c1']/100;
	
 	$para1 = mysql_query("SELECT c1 FROM weight_assumption where id='14'");
	$arrayp1 = mysql_fetch_array($para1);
	$iterst=-$arrayp1['c1']/100;           // NEGATIVE IMPACT
	
 	$para1 = mysql_query("SELECT c1 FROM weight_assumption where id='15'");
	$arrayp1 = mysql_fetch_array($para1);
	$ca_cb=$arrayp1['c1']/100;

 	$para1 = mysql_query("SELECT c1 FROM weight_assumption where id='16'");
	$arrayp1 = mysql_fetch_array($para1);
	$debt_equity=-$arrayp1['c1']/100;     // NEGATIVE IMPACT

 	$para1 = mysql_query("SELECT c1 FROM weight_assumption where id='17'");
	$arrayp1 = mysql_fetch_array($para1);
	$pbt_interest=$arrayp1['c1']/100;

 	$para1 = mysql_query("SELECT c1 FROM weight_assumption where id='18'");
	$arrayp1 = mysql_fetch_array($para1);
	$profit_shareout=$arrayp1['c1']/100;

 	$para1 = mysql_query("SELECT c1 FROM weight_assumption where id='19'");
	$arrayp1 = mysql_fetch_array($para1);
	$dividend=$arrayp1['c1']/100;

 	$para1 = mysql_query("SELECT c1 FROM weight_assumption where id='20'");
	$arrayp1 = mysql_fetch_array($para1);
	$shareiss=$arrayp1['c1']/100;
	
	$para1 = mysql_query("SELECT c1 FROM weight_assumption where id='21'");
	$arrayp1 = mysql_fetch_array($para1);
	$profitrate=$arrayp1['c1']/100;

	$para1 = mysql_query("SELECT c1 FROM weight_assumption where id='22'");
	$arrayp1 = mysql_fetch_array($para1);
	$ebitda_cl=$arrayp1['c1']/100;	

	



// ----------- calculation share price change

 				$dlr = mysql_query("SELECT output_c1 FROM `output` where game_id='$gid' and team_id='$teamid' and round='$round' and final='1'");
				$der = mysql_fetch_array($dlr);

				//get share price/outstanding
				$sharep=$der['output_c1'];	
				$sharep= preg_split("/[\s,]+/",$sharep);
				$shareprice=$sharep[43];
				
// GET LAST ROUND RESULT TO COMPARE

$result3 = mysql_query("SELECT output_c1,output_c2,output_c3 FROM `output` where game_id='$gid' and round='$round' and team_id='$teamid' and final='1'");
$row3 = mysql_fetch_array($result3);

 $output_c1=$row3['output_c1'];
 $output_c2=$row3['output_c2'];
 $output_c3=$row3['output_c3'];
 
 $output_c13 = preg_split("/[\s,]+/",$output_c1);
 $output_c23 = preg_split("/[\s,]+/",$output_c2);
 $output_c33 = preg_split("/[\s,]+/",$output_c3);
 

 $profit1=(int)$output_c13[19]+(int)$output_c23[19]+(int)$output_c33[19];
 

 
// =CA growth
$rev1=(int)$output_c13[3]+(int)$output_c23[3]+(int)$output_c33[3];

$total1="totalrev1".$teamid;
$total2="totalrev2".$teamid;
$total3="totalrev3".$teamid;
$rev2=$$total1+$$total2+$$total3;

if ($rev1!=0)
{
$change_rev=($rev2-$rev1)/$rev1;
}
else 
{
$change_rev=0;
}
// =interest rate  **********NEGATIVE IMPACT
$ichange=(($i33+$t33+$i23+$t23+$i13+$t13)-($i32+$t32+$i22+$t22+$i12+$t12))/($i32+$t32+$i22+$t22+$i12+$t12);

// =CA_CB
$ta1=(int)$output_c13[25]+(int)$output_c23[25]+(int)$output_c33[25];
$cl1=(int)$output_c13[37]+(int)$output_c23[37]+(int)$output_c33[37];
$totalasset1="totalasset".$teamid."1";
$totalasset2="totalasset".$teamid."2";
$totalasset3="totalasset".$teamid."3";
$totalasset=$$totalasset1+$$totalasset2+$$totalasset3;
$totalia1="totalia".$teamid."1";
$totalia2="totalia".$teamid."2";
$totalia3="totalia".$teamid."3";
$totalia=$$totalia1+$$totalia2+$$totalia3;
$cacb2=$totalasset/$totalia;

$totale1="totale".$teamid."1";
$totale2="totale".$teamid."2";
$totale3="totale".$teamid."3";
$totale=$$totale1+$$totale2+$$totale3;
if ($cl1!=0)
{
$cacb1=$ta1/$cl1;
}
else 
{
$cacb1=$ta1;
}

if ($totalia!=0)
{
$cacb2=$totalasset/$totalia;
}
else
{
$cacb2=$totalasset;
}

if ($cacb1=!0)
{
$change_cacb=($cacb2-$cacb1)/$cacb1;
}
else 
{
$change_cacb=0;
}


// =DEBT/EQUITY   **********NEGATIVE IMPACT
$te1=(int)$output_c13[32]+(int)$output_c23[32]+(int)$output_c33[32];
$cl1=(int)$output_c13[38]+(int)$output_c23[38]+(int)$output_c33[38];	
if ($te1!=0)
{
$de1=$cl1/$te1;
}
else
{
$de1=$cl1;
}

if ($totale!=0)
{
$de2=$totalia/$totale;
}
else
{
$de2=$totalia;
}
if ($de1!=0)
{
$change_de=($de2-$de1)/$de1;
}
else
{
$change_de=0;
}

// =PBT/INTEREST
$pbt1=(int)$output_c13[17]+(int)$output_c23[17]+(int)$output_c33[17];
$ipbt1=($i32+$i22+$i12)/3;
$totalpb1="pbt".$teamid."1";
$totalpb2="pbt".$teamid."2";
$totalpb3="pbt".$teamid."3";
$pbt2=$$totalpb1+$$totalpb2+$$totalpb3;
$ipbt2=($i33+$i23+$i13)/3;

if ($ipbt2!=0 and $ipbt1!=0)
{
$change_pbt=(($pbt2/$ipbt2)-($pbt1/$ipbt1))/($pbt1/$ipbt1);
}
else
{
$change_pbt=0;
}

 
// =profit/shareout
$profit1=(int)$output_c13[19]+(int)$output_c23[19]+(int)$output_c33[19];
$so1=(int)$output_c13[42]+(int)$output_c23[42]+(int)$output_c33[42];	
if ($so1!=0)
{
$pso1=$profit1/$so1;
}
else
{
$pso1=$profit1;
}
$totalpb1="pbt".$teamid."1";
$totalpb2="pbt".$teamid."2";
$totalpb3="pbt".$teamid."3";
$pbt2=$$totalpb1+$$totalpb2+$$totalpb3;

$sissue="shareissues".$teamid;
if (($so1+$$sissue)!=0)
{
$pso2=$pbt2/($so1+$$sissue);
}
else 
{
$pso2=$pbt2;
}

if ($pso1!=0)
{
$change_ps=($pso2-$pso1)/$pso1;
}
else 
{
$change_ps=0;
}

// =dividend_payment
 $divp="divpay".$teamid;

 if ($$divp>0)
 {
 $change_div=1;
 }
  if ($$divp==0)
 {
 $change_div=0;
 }
//$$divp

// = share issue
if ($$sissue<0)
{
$change_iss=1;
}
if ($$sissue>0)
{
$change_iss=-1;
}
if ($$sissue==0)
{
$change_iss=0;
}

//;

// =profit PAT
$profitat1=(int)$output_c13[19]+(int)$output_c23[19]+(int)$output_c33[19];
$pat1="pat".$teamid."1";
$pat2="pat".$teamid."2";
$pat3="pat".$teamid."3";
$profitat2=$$pat1+$$pat2+$$pat3;
//echo $$pat3."/".number_format($$pat1);
if ($profitat1!=0)
{
$change_pat=($profitat2-$profitat1)/$profitat1;
}
else
{
$change_pat=0;
}
// =EBITDA_CL
$ebda1=(int)$output_c13[13]+(int)$output_c23[13]+(int)$output_c33[13];
$cl1=(int)$output_c13[38]+(int)$output_c23[38]+(int)$output_c33[38];	
if ($cl1!=0)
{
$ebcl1=$ebda1/$cl1;
}
else 
{
$ebcl1=$ebda1;
}
$totaled1="ebitda".$teamid."1";
$totaled2="ebitda".$teamid."2";
$totaled3="ebitda".$teamid."3";
if ($totalia!=0)
{
$ebcl2=($$totaled1+$$totaled2+$$totaled3)/$totalia;
}
else 
{
$ebcl2=($$totaled1+$$totaled2+$$totaled3);
}
	
if ($ebcl1!=0)
{
$change_ebcl=($ebcl2-$ebcl1)/$ebcl1;
}
else
{
$change_ebcl=0;
}	
	
// GET NEW SHARE Price


//echo $changeinprice;
if($change_rev>1) { $change_rev=1;} if($change_rev<-1)	{ $change_rev=-1;} 
if($ichange>1){ $ichange=1;}   if($ichange<-1)	{ $ichange=-1;} 
if($change_cacb>1)	{ $change_cacb=1;}  if($change_cacb<-1)	{ $change_cacb=-1;} 
if($change_de>1){ $change_de=1;}  if($change_de<-1)	{ $change_de=-1;} 
if($change_pbt>1){ $change_pbt=1;} if($change_pbt<-1)	{ $change_pbt=-1;} 
if($change_ps>1){ $change_ps=1;} if($change_ps<-1)	{ $change_ps=-1;} 
//if($change_div>1){ $$divp=1;} if($change_de<-1)	{ $change_de=-1;} 
if($change_iss>1){ $change_iss=1;} if($change_iss<-1)	{ $change_iss=-1;} 
if($change_pat>1){ $change_pat=1;} if($change_pat<-1)	{ $change_pat=-1;} 
if($change_ebcl>1){$change_ebcl =1;} if($change_ebcl<-1)	{ $change_ebcl=-1;} 
$changeinprice=$change_rev*$cagrowth+$ichange*$iterst+$change_cacb*$ca_cb+$change_de*$debt_equity+$change_pbt*$pbt_interest+$change_ps*$profit_shareout+$change_div*$dividend+$change_iss*$shareiss+$change_pat*$profitrate+$change_ebcl*$ebitda_cl;
if ($changeinprice>1)
{
$changeinprice=1;
}

if ($changeinprice<-1)
{
$changeinprice=-0.5;
}

$changeinprice=$changeinprice*$rand/10/100;
$newshareprice=round($shareprice*(1+$changeinprice),3);
//echo $teamid."-old price: ".$shareprice." New price: ".$newshareprice;

	echo "<table>";
	echo "<th>weight</th><th>value</th><th>change</th>";
	echo "<tr><td>CA growth</td><td>".$cagrowth."</td><td>".$change_rev."</td></tr>";
	echo "<tr><td>I change</td><td>".$iterst."</td><td>".$ichange."</td></tr>";
	echo "<tr><td>CA CB change</td><td>".$ca_cb."</td><td>".$change_cacb."</td></tr>";
	echo "<tr><td>Change debt equity</td><td>".$debt_equity."</td><td>".$change_de."</td></tr>";
	echo "<tr><td>PBT/interest</td><td>".$pbt_interest."</td><td>".$change_pbt."</td></tr>";
	
		echo "<tr><td>Change in profit shareout</td><td>".$profit_shareout."</td><td>".$change_ps."</td></tr>";
		echo "<tr><td>Dividends</td><td>".$dividend."</td><td>".$change_div."</td></tr>";
		echo "<tr><td>shareissue</td><td>".$shareiss."</td><td>".$change_iss."</td></tr>";
		echo "<tr><td>PAT</td><td>".$profitrate."</td><td>".$change_pat."</td></tr>";
		echo "<tr><td>EBI/Cliablity</td><td>".$ebitda_cl."</td><td>".$change_ebcl."</td></tr>";
	echo "</table>";
	
	

// get output financial ratio
$totaleb1="ebit".$teamid."1";
$totaleb2="ebit".$teamid."2";
$totaleb3="ebit".$teamid."3";

$shareout1=$so1+$$sissue;

$marketcap1=$shareout*$newshareprice;
$sharepriceran1=rand($shareprice,$newshareprice);
$divy1=$$divp/$shareout/$newshareprice;
$pe1=$profitat2-($$divp/$shareout)/$shareout;
$cum1=($newshareprice-$shareprice+$$divp)/$shareprice;
if ($rev2!=0)
{
$ebitdaratio1=$totaled1/$rev2;
$rosratio1=$profitat2/$rev2;
$ebitratio1=($$totaled1+$$totaled2+$$totaled3)/$rev2;
}
else 
{
$ebitdaratio1=0;
$rosratio1=0;
$ebitratio1=0;
}
$equityratio1=$totale/$totalasset;  //total equty/asset
$debequity1=$totalia/$totale;  // total liabli/equity
$roce1=($$totaleb1+$$totaleb2+$$totaleb3)/($totalasset-$totalia);
$roe1=$profitat2/$totale;
$eps1=($profitat2-$$divp)/$shareout;


$shareout2=$shareout3=0;
$marketcap2=$marketcap3=0;
$sharepriceran2=$sharepriceran3=0;
$divy2=$divy3=0;
$pe3=$pe2=0;
$cum2=$cum3=0;
$ebitdaratio2=$ebitdaratio3=0;
$ebitratio2=$ebitratio3=0;
$rosratio2=$rosratio3=0;
$equityratio2=$equityratio3=0;
$debequity2=$debequity3=0;
$roce2=$roce3=0;
$roe2=$roe3=0;
$eps2=$eps3=0;


$o1="output1".$teamid;
$o2="output2".$teamid;
$o3="output3".$teamid;
//echo "-------[".$$o."]------";
$output1=",0,".$marketcap1.",".$shareout1.",".$newshareprice.",".$sharepriceran1.",".$divy1.",".$pe1.",".$cum1.",0,".$ebitdaratio1.",".$ebitratio1.",".$rosratio1.",".$equityratio1.",".$debequity1.",".$roce1.",".$roe1.",".$eps1;
$output2=",0,".$marketcap2.",".$shareout2.","."0".",".$sharepriceran2.",".$divy2.",".$pe2.",".$cum2.",0,".$ebitdaratio2.",".$ebitratio2.",".$rosratio2.",".$equityratio2.",".$debequity2.",".$roce2.",".$roe2.",".$eps2;
$output3=",0,".$marketcap3.",".$shareout3.","."0".",".$sharepriceran3.",".$divy3.",".$pe3.",".$cum3.",0,".$ebitdaratio3.",".$ebitratio3.",".$rosratio3.",".$equityratio3.",".$debequity3.",".$roce3.",".$roe3.",".$eps3;
//echo "/".$$o1."/";

$$o1=$$o1.$output1;
//echo "[".$$o1."]";

$$o2=$$o2.$output2;
$$o3=$$o3.$output3;
$comma=explode(",",$$o1);
$no=count($comma);
//echo $no."sushi";
//echo "-------[".$$o1."]------";


//Ratio ""
//Market capitalization 

//Shares outstanding at the end of round
//Share price at the end 
//Average trading price 
//Dividend yield
//P/E ratio ""

//Cumulative total shareholder return

//Financial indicators""
//Operating profit before depreciation (EBITDA)
//Operating profit (EBIT)
//Return on sales (ROS)
//Equity ratio
//Net debt to equity (gearing)
//Return on capital employed (ROCE)
//Return on equity (ROE)
//Earnings per share (EPS) USD	
//echo ;
//--------------- insert output

$eff="eff".$teamid;
$turn="turnover".$teamid;
$c1=$$o1;
$c2=$$o2;
$c3=$$o3;
$hre=$$eff;
$hrt=$$turn;
$invtr11="pro".$teamid."11";
$invtr12="pro".$teamid."12";
$invtr13="pro".$teamid."13";
$invtr14="pro".$teamid."14";

$inventory_c1=$$invtr11.",".$$invtr12.",".$$invtr13.",".$$invtr14;

$invtr21="pro".$teamid."21";
$invtr22="pro".$teamid."22";
$invtr23="pro".$teamid."23";
$invtr24="pro".$teamid."24";

$inventory_c2=$$invtr21.",".$$invtr22.",".$$invtr23.",".$$invtr24;
//echo $inventory_c1."trieuanh";
//echo $inventory_c2."trieuanh";
//$comma=explode(",",$c1);
//$no=count($comma);
//echo $no."ssssssssss";
//echo $c1;
$eff="eff".$teamid;
$turn="turnover".$teamid;
$hrt=$$turn;
$hre=$$eff;
$techav="techavai".$teamid;
$tav=$$techav;
$fact1="newfact1".$teamid;
$fact2="newfact2".$teamid;

   $currentfact1="currentfact1".$teamid;
   $currentfact2="currentfact2".$teamid;
   $factorycur['c1']=$$currentfact1;
   $factorycur['c2']=$$currentfact2;
   $factory2=serialize($factorycur);
$nextfact=$$fact1.",".$$fact2;

$tmarketshare1="techmarketshare1".$teamid;
$tmarketshare2="techmarketshare2".$teamid;
$tmarketshare3="techmarketshare3".$teamid;
$tm1=$$tmarketshare1;
$tm2=$$tmarketshare2;
$tm3=$$tmarketshare3;
$newf="newfeature".$teamid;	
$price_report="price_report".$teamid;
$promotion_report1="promo_report".$teamid;
$promotion_report=$$promotion_report1;
$feature_report1="feature_report".$teamid;
$feature_report=$$feature_report1;

$p_report=$$price_report;
//echo "[".$$price_report."trieuanh<br>";
$newfeature=$$newf;
// get invent cost report
$ucost_report1="ucost_report1".$teamid;
$ucost_report2="ucost_report2".$teamid;	
$u_cost1=$$ucost_report1;
$u_cost2=$$ucost_report2;
//echo "[".$u_cost1."]<br>"."[".$u_cost2."]";
// get overtime
if ($overtime==1) 
{
$final=1;
}
else
{
$final=0;
}

$result = mysql_query("SELECT id FROM output where game_id='$gid' and round='$round_for_input' and team_id='$teamid'");
if( mysql_num_rows($result) == 1) 
{
//update
				$sql2="UPDATE `output` SET promotion_report='$promotion_report',feature_report='$feature_report',inventory_c1='$inventory_c1',inventory_c2='$inventory_c2',final='$final',ucost_inven1='$u_cost1',ucost_inven2='$u_cost2',price_report='$p_report',feature='$newfeature',tmarketshare_c3='$tm3',tmarketshare_c2='$tm2',tmarketshare_c1='$tm1',factory='$factory2',next_factory='$nextfact', tech='$tav',output_c1='$c1',output_c2='$c2',output_c3='$c3', hr_turnover='$hrt', hr_efficiency_rate='$hre'  where game_id='$gid' and round='$round_for_input' and team_id='$teamid'";
				$result2 = mysql_query($sql2);  //order executes
}
else
{

$sql="INSERT INTO `output` (game_id,team_id,round,date,output_c1,output_c2,output_c3,hr_efficiency_rate,demand_c1,demand_c2,demand_c3,hr_turnover,final,tech,next_factory,factory,tmarketshare_c3,tmarketshare_c2,tmarketshare_c1,feature,price_report,ucost_inven1,ucost_inven2,inventory_c1,inventory_c2,promotion_report,feature_report) VALUES ('$gid','$teamid','$round_for_input',NOW(),'$c1','$c2','$c3','$hre','$newdemand_c1','$newdemand_c2','$newdemand_c3','$hrt','$final','$tav','$nextfact','$factory2','$tm3','$tm2','$tm1','$newfeature','$p_report','$u_cost1','$u_cost2','$inventory_c1','$inventory_c2','$promotion_report','$feature_report')";
$result = mysql_query($sql);  //order executes
$sql=mysql_real_escape_string($sql);
$t=logs($user_for_logs,$_SESSION['id'],$sql,$result);
}


//--------------------------------------------------------------------  END GET AVAILABLE
 
 }
 
 echo"</div>";
 //header ("Location:?act=result");
//echo" <meta http-equiv='refresh' content='0; URL=?act=result'>";

   if ($_SESSION['mod']==1 or $_SESSION['admin']==1 and $_GET['act']='previewresult')
 {


	
// END GET

$x=1;

  
 //end  
 if (isset($_POST['rid']))
 {
 $rid=$_POST['rid'];
 }
 else
 {
	if (isset($_GET['rid']))
	{
	$rid=$_GET['rid'];
	} 
	else 
	{
	$rid=$round_for_input;
	}
 }
 
 //echo $_POST['rid'];
 //$tid=$_GET['tid'];
 //$id=$_GET['gid'];
 $country=4;

$result = mysql_query("SELECT team_id,output_c1,output_c2,output_c3 FROM `output` where game_id='$gid' and round='$rid'");
if($result === FALSE) {
    die(mysql_error()); // TODO: better error handling
}
echo "<h4> ".$LANG[$country]." | ".$LANG['Round']." ".$rid." </h4>";
echo "<center><h1> ".$LANG['pnl']."</h1></center>";
while ($row = mysql_fetch_array($result))
{
$array="";
$ratio_array="";
 $tid=$row['team_id'];
 $result2 = mysql_query("SELECT name FROM `team` where id='$tid'");
 $row2 = mysql_fetch_array($result2);
 $name=$row2['name']; 
 
 $o1=$row['output_c1'];
 
 // for ratio
 $ratio_data=$row['output_c1'];
 //
 $o2=$row['output_c2'];
 $o3=$row['output_c3'];
 $output_c1 = preg_split("/[\s,]+/",$o1);
 $output_c2 = preg_split("/[\s,]+/",$o2);
 $output_c3 = preg_split("/[\s,]+/",$o3);
 
$comma=explode(",",$o1);
$no=count($comma)-1;
//echo $o1; 
  for ($y=0; $y<$no; $y++) 
{
$op1=$output_c1[$y];
$op2=$output_c2[$y];
$op3=$output_c3[$y];

$out1=(int)$op1;
$out2=(int)$op2;
$out3=(int)$op3;
$glob=$out1+$out2+$out3;
//echo $out1."/".$out2."/".$out3."=".$glob."<br>";
//echo $glob."<br>";
//if ($out1=""){$array=$glob;} else {$array=$array.",".$glob;}


// SET IF PRINT COUNTRY



if ($country=='1') {$array=$array.",".$out1;}
if ($country=='2') {$array=$array.",".$out2;}
if ($country=='3') {$array=$array.",".$out3;}
if ($country=='4') {$array=$array.",".$glob;}

// End set country
}

// add team id on top
$array1=$tid.",".$array;
$present[$x] = $array1;
// for ratio data
$ratio_data=$tid.",".$ratio_data;
$present_ratio[$x] = $ratio_data;

//$present = array(
//    $x => $array,);
//echo "Array".$x.$present[$x]."<br>";
//echo "<br>Team ".$x." :".$array."<br>";
++$x;
 }

// start print table
echo "<table class=result>"; 
echo "<th>".$LANG['pnl']."</th>";
//echo "(".$x.")";
for ($y=1; $y<$x; $y++) 
{
//echo "Array".$y.$present[$y]."<br>";
// print TH
$team_id=$present[$y];
//echo $team_id."<br>";
$team_id= preg_split("/[\s,]+/",$team_id);
//echo"Team ID ".$team_id[0];
// PRINT TEAM ID

 $tid=$team_id[0];
 $result2 = mysql_query("SELECT name FROM `team` where id='$tid'");
 $row2 = mysql_fetch_array($result2);
 $name=$row2['name'];
echo"<th>".$name." [".$team_id[0]."]</th>";
//
}
// ---------------------------------------------------------START LOOP

$comma=explode(",",$title_pnl);
$no_titles=count($comma);
$no_titles=$no_titles-1;
//echo $no_titles;
$title = preg_split("/[,]+/",$title_pnl);

for ($t=0; $t<=$no_titles; $t++) 
{

//------------------------format number
// -----------------------end format
$k=$t+1;
if ($k==1 or $k==4  or $k==5 or $k==13 or $k==14 or $k==16 or $k==20)
{$class_t="result";$u1="";$u2="";}else{$class_t="";$u1="";$u2="";}
echo"<tr><td class=".$class_t.">".$u1.$title[$t].$u2."</td>";
for ($y=1; $y<$x; $y++) 
{

 $d=$present[$y];
 $print = preg_split("/[\s,]+/",$d);

if ($k==1)
{
 echo"<td class=result></td>";
}else 
{
$p=$print[$k];
if ($k==5) {$p="";}
if ($k==1 or $k==4 or $k==13 or $k==14 or $k==16 or $k==20)
{
if($p<0){$class="neg0";$p="(".number_format(abs($p)).")";} else{$class="pos0";$p=number_format($p);}
}
else
{
if ($k!=5){
if($p<0){$class="neg";$p="(".number_format(abs($p)).")";} else{$class="pos";$p=number_format($p);}
	}
}

 echo"<td class=".$class.">".$p."</td>";
 }
}
echo "</tr>";
}



// ----------------------------------------------------------END LOOP
// end print
  echo "</table>";
  
  
  }
 // ----------------------------------------------------End team comparision table pnl



  }
  
//--------------------------- checklist
	  if( $_GET['act']=='checklist')
  {	
  
   if ($_SESSION['player']==1)
 {
 $gid=$_SESSION['game_id'] ;
 $tid=$_SESSION['team_id'] ;
 //-----checktime
 $checktime=checktime($gid,$tid);
 echo $checktime;

 }
 else
 {
 if(isset($_GET['id']))
{
$gid=$_GET['gid'];
}
}
  
  //save as team decision
   if(isset($_POST['teamdecision']))
{

$x=$_POST['players'];
	for ($s=1; $s<=$x; $s++) 
				{
				 if(isset($_POST[$s]))
				 {
				
				 if ($_POST[$s]!=0)
				 {
				 $id=$_POST[$s];
				$sql2="UPDATE `input` SET team_decision='1' where id='$id'";
				$result2 = mysql_query($sql2);  //order executes
					// get user name
						$decision = mysql_query("SELECT player_id FROM input WHERE id='$id'");
						$de = mysql_fetch_array($decision);
						$pl_id=$de['player_id'];
						
						$decision = mysql_query("SELECT name FROM player WHERE id='$pl_id'");
						$de = mysql_fetch_array($decision);
						$p_name=$de['name'];
						$ppid=$_SESSION['id'];
						$decision = mysql_query("SELECT name FROM player WHERE id='$ppid'");
						$de = mysql_fetch_array($decision);
						$pw_name=$de['name'];
						
						$date = date('Y-m-d H:i:s');
						
					$m=mysql_real_escape_string("At:".$date." ".$pw_name." ".$LANG['save']." ".$LANG['successfully']." ".$p_name." ".$LANG['decision_as_team_decision']);  
					$t=logs($user_for_logs,$_SESSION['id'],$m,$result2);
					
// rewrite past decision
	$result = mysql_query("SELECT id,name FROM `player` where game_id='$gid' and team_id='$tid'");
	if($result === FALSE) { die(mysql_error()); }
	
	$res_round = mysql_query("SELECT max(round) FROM output where game_id='$gid' and final='1'");
	$array_round = mysql_fetch_array($res_round);
	$round=$array_round[0];
	$round_for_input=$round+1;
	
	while ($row = mysql_fetch_array($result))
	{

	$pid=$row['id'];

	$decision = mysql_query("SELECT id FROM input WHERE game_id='$gid' and player_id='$pid' and round='$round_for_input' ");
	$de = mysql_fetch_array($decision);
	if( mysql_num_rows($decision) == 1) 
	{
	
	$input_id=$de['id'];
	if ($input_id!=$id)
	{
				$sql2="UPDATE `input` SET team_decision='0' where id='$input_id'";
				$result2 = mysql_query($sql2);  //order executes
	}
	}
	
	$decision = mysql_query("SELECT id FROM input WHERE game_id='$gid' and player_id='' and round='$round_for_input' ");
	$de = mysql_fetch_array($decision);
	if( mysql_num_rows($decision) == 1) 
	{
	
	$input_id=$de['id'];
	if ($input_id!=$id)
	{
				$sql2="UPDATE `input` SET team_decision='0' where id='$input_id'";
				$result2 = mysql_query($sql2);  //order executes
	}
	}	
	
	}
	
				 }
				 //else
				 //{
				//$id=$_POST[$s];
				//$sql2="UPDATE `input` SET team_decision='0' where id='$id'";
				//$result2 = mysql_query($sql2);  //order executes
				//echo $result2;
				// }
				 }
				}
				header ("Location:?act=checklist");
}
  
    
  	echo"<h4>".$LANG['teamdecision']."</h4>";

	if ($overtime==0) {echo"<form action='game.php?act=checklist' method='POST'>";} 
	echo"<table>";
	echo"<TH>".$LANG['teamdecision']."</th><th width=15%>".$LANG['PLAYERS']."</th><th width=15%>".$LANG['loddeci']."</th><th>".$LANG['date']."</th><th>".$LANG['revenue']."</th><th>".$LANG['costs']."</th><th>".$LANG['ebitda']."</th><th>".$LANG['saveas']."</th>";
	
	$res_round = mysql_query("SELECT max(round) FROM output where game_id='$gid' and final='1'");
	$array_round = mysql_fetch_array($res_round);
	$round=$array_round[0];
	$round_for_input=$round+1;
	
	$result = mysql_query("SELECT id,name FROM `player` where game_id='$gid' and team_id='$tid'");
	if($result === FALSE) { die(mysql_error()); }
	$x=0;
	while ($row = mysql_fetch_array($result))
	{
	++$x;
	$name=$row['name'];
	$pid=$row['id'];
	if ($pid==$_SESSION['id']) {$b="<b>";$c="</b>";} else {$b="";$c="";}
	//echo $gid;
	$decision = mysql_query("SELECT id,team_decision FROM input WHERE game_id='$gid' and player_id='$pid' and round='$round_for_input' ");
	$de = mysql_fetch_array($decision);
	if( mysql_num_rows($decision) == 1) 
	{
	
	$input_id=$de['id'];
	$td=$de['team_decision'];
	//echo $td;
	//echo $input_id."sdds";
	$result2 = mysql_query("SELECT date,revenue,cost,ebitda FROM `checklist` where input_id='$input_id'");
	$row2 = mysql_fetch_array($result2);
	$grev=$row2['revenue'];
	$gcost=$row2['cost'];
	$gebitda=$row2['ebitda'];
	$pdate=$row2['date'];
	
	$lod=$LANG['yes'];
	$class="pos";
	
		if ($td==1) {$img="imgs/icon-tick.png";} else {$img="imgs/icon-cross.png";}
	echo"<tr><td><img style='width:10px;height:10px' src='".$img."'></td><td>".$b."".$name."".$c."</td><td class=".$class.">".$lod."</td><td class=right>".$pdate."</td><td class=right>".number_format($grev)."</td><td class=right>".number_format($gcost)."</td><td class=right>".number_format($gebitda)."</td><td class=demo>";

	}
	else
	{
	$lod=$LANG['no'];
	$pdate="-";
	$class="neg";
	$grev="-";
	$gcost="-";
	$gebitda="-";
	$td=0;
		if ($td==1) {$img="imgs/icon-tick.png";} else {$img="imgs/icon-cross.png";}
	echo"<tr><td><img style='width:10px;height:10px' src='".$img."'></td><td>".$b."".$name."".$c."</td><td class=".$class.">".$lod."</td><td class=right>".$pdate."</td><td class=right>".($grev)."</td><td class=right>".($gcost)."</td><td class=right>".($gebitda)."</td><td class=demo>";

	}
	
    echo"<select style='width:100%;' name='".$x."' onchange='this.form.submit()'>";
	echo"<option selected value='0'></option>";
	echo"<option  value='".$input_id."'>".$LANG['saveas']." ".$LANG['teamdecision']."</option>";
	echo"</select>";
	
	echo"</td></tr>";
	}
	echo"<input type=hidden name='teamdecision' value='1'/>";
	echo"<input type=hidden name='players' value='".$x."'/>";
	echo"</table></form>";
	
  
  }
// end teamdecision






	// --------------- start logistics
	
	  if( $_GET['act']=='logistic')
  {	
 
 if($_SESSION['mod']==1 or $_SESSION['admin']==1 )
 {
  $gid=$_GET['gid'] ;
 $tid=$_GET['tid'] ;
 } else 
 {
  $gid=$_SESSION['game_id'] ;
 $tid=$_SESSION['team_id'] ;
 }
 
 //--------------------------- check time
 
 $checktime=checktime($gid,$tid);
 echo $checktime;
  
 //--------------------------- end check time
  // get round
	$res_round = mysql_query("SELECT max(round) FROM output where game_id='$gid' and team_id='$tid' and final='1' ");
	$array_round = mysql_fetch_array($res_round);
	$round=$array_round[0];
	$round_for_input=$round+1;
	
	// get practice round
$game = mysql_query("SELECT practice_round, no_of_rounds FROM `game` where id='$gid'");
$hpr = mysql_fetch_array($game);
$pround=$hpr['practice_round'];
$rounds=$hpr['no_of_rounds'];
if ($round==$pround) {$round=0;} 
if ($round_for_input>$rounds) {$round_for_input=$round;}
// get logistic cost
				$result1 = mysql_query("SELECT country1 FROM round_assumption where game_id='$gid' and round=$round_for_input");
				$array = mysql_fetch_array($result1);
				$logis=$array['country1'];	
				
				$lo= preg_split("/[\s,]+/",$logis);
				$l_c1_c2=$lo[17];
				$l_c2_c1=$lo[18];
				$l_c1_c3=$lo[19];
				$l_c2_c3=($l_c1_c2+$l_c2_c1+$l_c1_c3)/3;
				
				$lo_gra=max($l_c1_c2,$l_c2_c1,$l_c1_c3,$l_c2_c3);
  
  // get last round demand production
				$dlr = mysql_query("SELECT demand_c1,demand_c2,demand_c3 FROM `output` where game_id='$gid' and team_id='$tid' and round='$round' and final='1'");
				$der = mysql_fetch_array($dlr);
				// get country 1/2/3
				$dmd_c1=$der['demand_c1']; 				
				$dmd_c2=$der['demand_c2'];
				$dmd_c3=$der['demand_c3']; 	
  // get this round production
				
  // get current production
  
if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
   				$dnp1 = mysql_query("SELECT country1,country2,country3, logistic_order_c1,logistic_order_c2 FROM `input` where game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input'");
				$rw1 = mysql_fetch_array($dnp1);
				// get logistic order
				$logis1=$rw1['logistic_order_c1']; 		
				$logis2=$rw1['logistic_order_c2']; 	
				//echo $logis1;
				$logis1=preg_split("/[,]+/",$logis1);	
				$logis2=preg_split("/[,]+/",$logis2);			


// for country1/2 tech 1/2
$lo11=$logis1[0];
$lo12=$logis1[1];
$lo13=$logis1[2];
$lo14=$logis1[3];

$order11=$lo11;
$order12=$lo12;
$order13=$lo13;
$order14=$lo14;
//echo $order11;
$lo21=$logis2[0];
$lo22=$logis2[1];
$lo23=$logis2[2];
$lo24=$logis2[3];

$order21=$lo21;
$order22=$lo22;
$order23=$lo23;
$order24=$lo24;
//-------				
				// get country 1/2/3
				$c1=$rw1['country1']; 
				$country1=unserialize(base64_decode($c1));
				$c2=$rw1['country2']; 
				$country2=unserialize(base64_decode($c2));
				$c3=$rw1['country3']; 
				$country3=unserialize(base64_decode($c3));
				// Get total production
				$p11=$country1['production1'];
				$p12=$country1['production2'];
				$o11=$country1['outsource1'];
				$o12=$country1['outsource2'];
				
				$p21=$country2['production1'];
				$p22=$country2['production2'];
				$o21=$country2['outsource1'];
				$o22=$country2['outsource2'];
			
				// from string to array
				$p11 =preg_split("/[,]+/",$p11);
				$p12 =preg_split("/[,]+/",$p12);
				$o11 =preg_split("/[,]+/",$o11);
				$o12 =preg_split("/[,]+/",$o12);
				
				$p21 =preg_split("/[,]+/",$p21);
				$p22 =preg_split("/[,]+/",$p22);
				$o21 =preg_split("/[,]+/",$o21);
				$o22 =preg_split("/[,]+/",$o22);
				
// get demand for each tech
				$d1=$country1['est_demand']/100;
				$d2=$country2['est_demand']/100;
				$d3=$country3['est_demand']/100;
				//echo $d1."asd";
				$mt11=$country1['est_marketshare_t1'];
				$mt12=$country1['est_marketshare_t2'];
				$mt13=$country1['est_marketshare_t3'];
				$mt14=$country1['est_marketshare_t4'];

				$mt21=$country2['est_marketshare_t1'];
				$mt22=$country2['est_marketshare_t2'];
				$mt23=$country2['est_marketshare_t3'];
				$mt24=$country2['est_marketshare_t4'];
				
				$mt31=$country3['est_marketshare_t1'];
				$mt32=$country3['est_marketshare_t2'];
				$mt33=$country3['est_marketshare_t3'];
				$mt34=$country3['est_marketshare_t4'];
				
				
				// demand for each tech
			//c1	
				$d11=$dt11=$dmd_c1*(1+$d1)*$mt11/100;
				$d12=$dt12=$dmd_c1*(1+$d1)*$mt12/100;
				$d13=$dt13=$dmd_c1*(1+$d1)*$mt13/100;
				$d14=$dt14=$dmd_c1*(1+$d1)*$mt14/100;
				//echo $d11;
				//get tech total production
			//c2
				$d21=$dt21=$dmd_c2*(1+$d2)*$mt21/100;
				$d22=$dt22=$dmd_c2*(1+$d2)*$mt22/100;
				$d23=$dt23=$dmd_c2*(1+$d2)*$mt23/100;
				$d24=$dt24=$dmd_c2*(1+$d2)*$mt24/100;
			//c3
				$d31=$dt31=$dmd_c3*(1+$d3)*$mt31/100;
				$d32=$dt32=$dmd_c3*(1+$d3)*$mt32/100;
				$d33=$dt33=$dmd_c3*(1+$d3)*$mt33/100;
				$d34=$dt34=$dmd_c3*(1+$d3)*$mt34/100;			
			
			// from c1
				$t1=$p11[0];
				$u1=$p11[2];
				$t2=$p12[0];
				$u2=$p12[2];
				
				$t3=$o11[0];
				$u3=$o11[2];
				$t4=$o12[0];
				$u4=$o12[2];
			// from c2
				$t5=$p21[0];
				$u5=$p21[2];
				$t6=$p22[0];
				$u6=$p22[2];
				
				$t7=$o21[0];
				$u7=$o21[2];
				$t8=$o22[0];
				$u8=$o22[2];
			//echo $t1;
			$tech11=$tech12=$tech13=$tech14=0;
			$tech21=$tech22=$tech23=$tech24=0;
			
			for ($i=1; $i<=4; $i++) 
			{
			$t="t".$i;
			$u="u".$i;

			if ($$t==1) {$tech11=$tech11+$$u;}
			if ($$t==2) {$tech12=$tech12+$$u;}
			if ($$t==3) {$tech13=$tech13+$$u;}
			if ($$t==4) {$tech14=$tech14+$$u;}
			}
				
			for ($i=5; $i<=8; $i++) 
			{
			$t="t".$i;
			$u="u".$i;
			if ($$t[0]==1) {$tech21=$tech21+$$u[2];}
			if ($$t[0]==2) {$tech22=$tech22+$$u[2];}
			if ($$t[0]==3) {$tech23=$tech23+$$u[2];}
			if ($$t[0]==4) {$tech24=$tech24+$$u[2];}
			}
// engine for logistic
	  if(isset($_POST['logistic']))
  {	
   $round_input=$_POST['round'];
 
  for ($i=1; $i<=2; $i++) 
		{
		
		for ($t=1; $t<=4; $t++)
			{
				$order="order".$i.$t;
				$lo="lo".$i.$t;
				if(isset($_POST[$order])) 
				{
				$$order=$_POST[$order];
				$$lo=$_POST[$order];
				$logistic="logistic_order_c".$i;
				//echo "c".$i."t".$t.":".$$order."<br>";
				$array[$t]=$$order;
				if ($t==1) {$write=$array[$t];}
				else 	 {$write=$write.",".$array[$t];}

				} 
				else 
				{
				//if ($i==1){$$order=123;}
				//if ($i==2){$$order=231;}
				}

			}
				// update to database
				$date = date('Y-m-d H:i:s');
				//echo $write."<br>";
				if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
				$sql2="UPDATE `input` SET $logistic='$write', date='$date' where game_id='$gid' and team_id='$tid' and player_id='$pid' and round='$round_for_input'";
				//echo $sql2."<br>";
				$result2 = mysql_query($sql2);  //order executes
//echo "[".$result2."asd";						
				$sql=mysql_real_escape_string($sql2);  
					$t=logs($user_for_logs,$_SESSION['id'],$sql,$result2);
					header ("Location:?act=logistic");
		}
  }
  else
  {
   
  }
// engine stop			
				//$l_c1_c2
				//$l_c2_c1
				//$l_c1_c3
				//$l_c2_c3
				
// engine for logistic available stocks

//------------------- get different tech stocks
		// for c1 tech 1: $dt11
		// demand : $dt11
		// production $pro_c1[0]
		

				$t1=$p11[0];
				$t2=$p12[0];
				$t3=$o11[0];
				$t4=$o12[0];
				
				$t5=$p21[0];
				$t6=$p22[0];
				$t7=$o21[0];
				$t8=$o22[0];
				
				$p1=$p11[2];
				$p2=$p12[2];
				$p3=$o11[2];
				$p4=$o12[2];
				
				$p5=$p21[2];
				$p6=$p22[2];
				$p7=$o21[2];
				$p8=$o22[2];	
	//echo $p1."/".$p2."/".$p3."/".$p4."<br>";
	//echo $t1."/".$t2."/".$t3."/".$t4."<br>";
	//echo $t4;			
$tech11=$tech12=$tech13=$tech14=0;
$tech21=$tech22=$tech23=$tech24=0;

				for ($i=1; $i<=4; $i++) 
				{
				$t="t".$i;
				$p="p".$i;
				if ($$t==1) {$tech11=$tech11+$$p;}
				if ($$t==2) {$tech12=$tech12+$$p;}
				if ($$t==3) {$tech13=$tech13+$$p;}
				if ($$t==4) {$tech14=$tech14+$$p;}
				//echo "<br>".$tech."<br>=".$$tech."+".$$p;
				}	
				for ($i=5; $i<=8; $i++) 
				{
				$t="t".$i;
				$p="p".$i;
				if ($$t==1) {$tech21=$tech21+$$p;}
				if ($$t==2) {$tech22=$tech22+$$p;}
				if ($$t==3) {$tech23=$tech23+$$p;}
				if ($$t==4) {$tech24=$tech24+$$p;}
				//echo "<br>".$tech."<br>=".$$tech."+".$$p;
				}					
// get old inventory

   $result2 = mysql_query("SELECT inventory_c1,inventory_c2 FROM output where game_id='$gid' and team_id='$tid' and round='$round' and final='1'");
   $array2 = mysql_fetch_array($result2);

$inven1=$array2['inventory_c1'];	
$inven2=$array2['inventory_c2'];
$inven1 = preg_split("/[,]+/",$inven1);
$inven2 = preg_split("/[,]+/",$inven2);		

$inven11=$inven1[0];
$inven12=$inven1[1];
$inven13=$inven1[2];
$inven14=$inven1[3];

$inven21=$inven2[0];
$inven22=$inven2[1];
$inven23=$inven2[2];
$inven24=$inven2[3];		
		
$tech11=$tech11+$inven11;
$tech12=$tech12+$inven12;
$tech13=$tech13+$inven13;
$tech14=$tech14+$inven14;
$tech21=$tech21+$inven21;
$tech22=$tech22+$inven22;
$tech23=$tech23+$inven23;
$tech24=$tech24+$inven24;

			$t11=$tech11;
			$t12=$tech12;
			$t13=$tech13;
			$t14=$tech14;
			$t21=$tech21;
			$t22=$tech22;
			$t23=$tech23;
			$t24=$tech24;
			
			$pro11=$tech11;
			$pro12=$tech12;
			$pro13=$tech13;
			$pro14=$tech14;
			$pro21=$tech21;
			$pro22=$tech22;
			$pro23=$tech23;
			$pro24=$tech24;		
			$pro31=0;
			$pro32=0;
			$pro33=0;
			$pro34=0;				

//------------------- END get different tech stocks		

// ---------------------- main engine for logistic stock
// pro_c1/pro_c2/pro_c3 :$pro11-$pro24
// demand_c1/demand_c2/demand_c3 :$dt11-$dt24
//logistic_c1 : 123 $logis1/$logis2
// logisctic for 4 tech  $logis1[0]; $logis1[1]; $logis1[2]; $logis1[3];
// logisctic for 4 tech  $logis2[0]; $logis2[1]; $logis2[2]; $logis2[3];
//available a11 a21
$avai11=$avai12=$avai13=$avai14=$avai21=$avai22=$avai23=$avai24=$avai31=$avai32=$avai33=$avai34=0;
// manufacture from
$m111=$m112=$m113=$m114=$m121=$m122=$m123=$m124=0;
$m211=$m212=$m213=$m214=$m221=$m222=$m223=$m224=0;
$m311=$m312=$m313=$m314=$m321=$m322=$m323=$m324=0;



// Logistic engine start
//----------------- logistic order works when total supply < total demand
	for ($c=1; $c<=3; $c++) 
	{
	
		for ($t=1; $t<=4; $t++) 
		{
		$totalp="totalp".$t;
		$totald="totald".$t;
		$pro="pro".$c.$t;
			if ($c==1 or $c==2) { if (isset($$totalp)) {$$totalp=$$totalp+$$pro;} else {$$totalp=$$pro;}}
			$dt="dt".$c.$t;
			if (isset($$totald)) {$$totald=$$totald+$$dt;} else {$$totald=$$dt;}
		}
	}	
	//echo "Total:".($dt11+$dt21+$dt31)."<br>";
	//echo "Totalc1:".($dt11)."/".$mt11."/".$d1."/".$dmd_c1."<br>";
	//echo "Totalc2:".($dt21)."/".$mt21."/".$d2."/".$dmd_c2."<br>";
	//echo "Totalc3:".($dt31)."/".$mt31."/".$d3."/".$dmd_c3."<br>";
	
	
	
	
	for ($t=1; $t<=4; $t++) 
	{
		$totalp="totalp".$t;
		$totald="totald".$t;
		if ($$totalp<$$totald)
			{
			//set priority logistic order
			// Engine start
					for ($c=1; $c<=3; $c++) 
					{
					
					
					}
			}
			else
			{
			//echo "excess";
					for ($c=1; $c<=3; $c++) 
					{
					// set for priorty local product
					$dt="dt".$c.$t;
					$avai="avai".$c.$t;
					$pro1="pro1".$t;
					$pro2="pro2".$t;
					$m1="m1".$c.$t;
					$m2="m2".$c.$t;
			if ($c==1)
			{			
					if ($$pro1>=$$dt) 
						{
						$$avai=$$dt;
						$$pro1=$$pro1-$$dt;
						$$m1=$$dt;
					
						}
					else
						{
						$$avai=$$pro1;
						$$m1=$$pro1;

						$m="m12".$t;
						$$m=($$dt-$$pro1);
						$$pro2=$$pro2-($$dt-$$pro1);
						$$pro1=0;
						}							
			}	
			
			if ($c==2)
			{			
					if ($$pro2>=$$dt) 
						{
						$$avai=$$dt;
						$$pro2=$$pro2-$$dt;
						$$m2=$$dt;
					
						}
						
					else
						{
						$$avai=$$pro2;
						$$m2=$$pro2;
						
						$m="m21".$t;
						$$m=($$dt-$$pro2);
						$$pro1=$$pro1-($$dt-$$pro2);
						$$pro2=0;
						}							
			}			
			
			// for country 3
					
			if ($c==3)
			{			
					if ($l_c1_c3>=$l_c2_c3) 
						{
						$proc="pro2".$t;
						$prod="pro1".$t;
						$mc="m32".$t;
						$md="m31".$t;
						if ($$proc>=$$dt)
							{
							$$avai=$$dt;
							$$proc=$$proc-$$dt;
							$$mc=$$dt;
							}
							else
							{
							$$avai=$$avai+$$proc;
							$$mc=$$mc+$$proc;
							$$proc=0;
							//for c1
							$$avai=$$avai+($$dt-$$proc);
							$$prod=$$prod-($$dt-$$proc);
							$$md=$$md+($$dt-$$proc);
							}
						
						}
					if ($l_c1_c3<$l_c2_c3) 
						{
						$proc="pro1".$t;
						$prod="pro2".$t;
						$mc="m31".$t;
						$md="m32".$t;
						if ($$proc>$$dt)
							{
							$$avai=$$dt;
							$$proc=$$proc-$$dt;
							$$mc=$$dt;
							}
							else
							{
							$$avai=$$avai+$$proc;
							$$mc=$$mc+$$proc;
							$$proc=0;
							//for c1
							$$avai=$$avai+($$dt-$$proc);
							$$prod=$$prod-($$dt-$$proc);
							$$md=$$md+($$dt-$$proc);
							}
						
						}						
						
			}					
					}			
			
			
			}
		
	}
// enable logistic

	for ($c=1; $c<=2; $c++) 
	{
	
		for ($t=1; $t<=4; $t++) 
		{	
		$totalp="totalp".$t;
		$totald="totald".$t;
		if ($$totalp<$$totald)
	{	
		$lo="lo".$c.$t;
		$a=$$lo;
		$tech="pro".$c.$t;
		$demand="dt".$c.$t;
		$av="av".$c.$t;
			for ($k=1; $k<=3; $k++) 
				{	
		
		$ship="ship".$k;
		$$ship=$a[$k-1];
		
		$dt="dt".$$ship.$t;
		$avai="avai".$$ship.$t;
		
		$m="m".$$ship.$c.$t;
		//if ($$dt<$$avai) 
		//	{
		//echo "<br>".$$dt."<".$$tech."<br>";
		//echo $demand."-".$avai."<br>";
			
			if ($$dt>$$avai) 
				{
					if ($$tech<=($$dt-$$avai))
					{
					$$avai=$$avai+$$tech;
					$$m=$$m+$$tech;
					$$tech=0;	
					}
					if ($$tech>($$dt-$$avai))
					{
					$$m=$$m+$$dt-$$avai;
					$$tech=$$tech-($$dt-$$avai);	
					$$avai=$$dt;
					
					}
				}
				else
				{

				}


			
		
				}
		}
	}	
	}

	
// ----------------------------- logistic engine stop	

//var total production each teach/ each country
//pro11-pro12-pro13-pro14-pro21
//

	
// engine stop	
// CHECK RESULT
//echo "<br><BR>c1:".$avai11."<br>c2:".$avai21."<br>c3:".$avai31."<BR><BR>Total distrition t1:".($avai11+$avai21+$avai31);
//echo "<br>Total production t1:".($tech14+$tech24)."<br>total production c1t1:".$tech14;
//echo "<br>total production c2t1:".$tech21;
//echo "<br>total manufacture from m111:".$m111;
//echo "<br>total manufacture from m121:".$m121;
//echo "<br>total manufacture from m211:".$m211;
//echo "<br>total manufacture from m221:".$m221;
//echo "<br>total manufacture from m311:".$m311;
//echo "<br>total manufacture from m321:".$m321;
// END CHECK RESULT
// ---------------------- END main engine for logistic stock	

	echo"<section class='left-col'>";
  echo"<h4>".$LANG['logisticpriorityorder']."</h4>";
  	if ($overtime==0){echo"<form action='game.php?act=logistic&tid=".$tid."&id=".$gid."' method='POST'>";}
  echo"<table style='width:100%;'>";
  echo"<th>".$LANG['from']."</th><th>".$LANG['technology']."</th><th>".$LANG['avaistock']."</th><th>".$LANG['logisticpriority']."</th><th width=30%>".$LANG['logisticorder']."</th>";
  
 // c1 
 echo"<tr><td rowspan='4'><b>".$LANG['1']."</b></td>"; 
 
for ($i=1; $i<=4; $i++) 
{
$tech="tech_".$i;
$tech2="tech1".$i;
$order="order1".$i;

 echo"<td><b>".$LANG[$tech]."</b></td>";
 echo"<td>".number_format($$tech2)."</td>";
 echo"<td class=demo>";
echo"<select style='width:100%;' onchange='this.form.submit()'  name=".$order." >";


if ($$order==123) {$s="selected";} else {$s="";}
echo"<option ".$s." value=123>".$LANG['1']." - ".$LANG['2']." - ".$LANG['3']."</option>";
if ($$order==132) {$s="selected";} else {$s="";}
echo"<option ".$s." value=132>".$LANG['1']." - ".$LANG['3']." - ".$LANG['2']."</option>";
if ($$order==213) {$s="selected";} else {$s="";}
echo"<option ".$s." value=213>".$LANG['2']." - ".$LANG['1']." - ".$LANG['3']."</option>";
if ($$order==231) {$s="selected";} else {$s="";}
echo"<option ".$s." value=231>".$LANG['2']." - ".$LANG['3']." - ".$LANG['1']."</option>";
if ($$order==321) {$s="selected";} else {$s="";}
echo"<option ".$s." value=321>".$LANG['3']." - ".$LANG['2']." - ".$LANG['1']."</option>";
if ($$order==312) {$s="selected";} else {$s="";}
echo"<option ".$s." value=312>".$LANG['3']." - ".$LANG['1']." - ".$LANG['2']."</option>";
echo"</select>";
  echo"<td>";
//get cost
if($$order==123) {$lc=0+$l_c1_c2+$l_c2_c3;}
if($$order==132) {$lc=0+$l_c1_c3+$l_c2_c3;}
if($$order==213) {$lc=0+$l_c2_c1+$l_c1_c3;}
if($$order==231) {$lc=0+$l_c2_c3+$l_c1_c3;}
if($$order==321) {$lc=$l_c2_c3+$l_c2_c3+$l_c2_c1;}
if($$order==312) {$lc=$l_c2_c3+$l_c1_c3+$l_c1_c2;}

  
  echo"<dl class='rate' style='width:95%'><dd class='new' style='width:".($lc/($lo_gra*3)*100)."%'></dd></dl>";
  echo"</td>";
  echo"</td>";
  echo"</tr>";
}  

 // c2 
 echo"<tr><td rowspan='4'><b>".$LANG['2']."</b</td>";
for ($i=1; $i<=4; $i++) 
{
$tech="tech_".$i;
$tech2="tech2".$i;
$order="order2".$i;

 echo"<td><b>".$LANG[$tech]."</b></td>";
 echo"<td>".number_format($$tech2)."</td>";
 echo"<td class=demo>";
echo"<select style='width:100%;' onchange='this.form.submit()'  name=".$order." >";
if ($$order==123) {$s="selected";} else {$s="";}
echo"<option ".$s." value=123>".$LANG['1']." - ".$LANG['2']." - ".$LANG['3']."</option>";
if ($$order==132) {$s="selected";} else {$s="";}
echo"<option ".$s." value=132>".$LANG['1']." - ".$LANG['3']." - ".$LANG['2']."</option>";
if ($$order==213) {$s="selected";} else {$s="";}
echo"<option ".$s." value=213>".$LANG['2']." - ".$LANG['1']." - ".$LANG['3']."</option>";
if ($$order==231) {$s="selected";} else {$s="";}
echo"<option ".$s." value=231>".$LANG['2']." - ".$LANG['3']." - ".$LANG['1']."</option>";
if ($$order==321) {$s="selected";} else {$s="";}
echo"<option ".$s." value=321>".$LANG['3']." - ".$LANG['2']." - ".$LANG['1']."</option>";
if ($$order==312) {$s="selected";} else {$s="";}
echo"<option ".$s." value=312>".$LANG['3']." - ".$LANG['1']." - ".$LANG['2']."</option>";
echo"</select>";
  echo"</td>";
  
  echo"<td>";
//get cost
if($$order==123) {$lc=$l_c1_c2;}
if($$order==132) {$lc=$l_c1_c3;}
if($$order==213) {$lc=$l_c2_c1;}
if($$order==231) {$lc=$l_c2_c3;}
if($$order==321) {$lc=$l_c2_c3;}
if($$order==312) {$lc=$l_c1_c3;}

  
  echo"<dl class='rate' style='width:95%'><dd class='new' style='width:".($lc/$lo_gra*100)."%'></dd></dl>";
  echo"</td>";
  echo"</tr>";
}  
  echo"</table>";  
 				echo"<input type=hidden name='round' value='".$round_for_input."'/>";
				echo"<input type=hidden name='game_id' value='".$gid."'/>";
				echo"<input type=hidden name='team_id' value='".$tid."'/>";
				echo"<input type=hidden name='logistic' value='1'/>"; 
  echo"</form>";

 
  echo"<br><h4>".$LANG['productavai']."</h4>";
  echo"<table>";
  echo"<th>".$LANG['country']."</th><th>".$LANG['tech_1']."</th><th>".$LANG['tech_2']."</th><th>".$LANG['tech_3']."</th><th>".$LANG['tech_4']."</th>";
// c1 
 echo"<tr><td colspan=6 class=los><b>".$LANG['1']."</b></td>";
 echo"</tr>";
 echo"<tr><td> ".$LANG['manuin']." ".$LANG['1']."</td>";
 echo"<td class=right>".number_format($m111+$pro11)."</td>";
 echo"<td class=right>".number_format($m112+$pro12)."</td>";
 echo"<td class=right>".number_format($m113+$pro13)."</td>";
 echo"<td class=right>".number_format($m114+$pro14)."</td>";
 echo"</tr>";
 echo"<tr><td>".$LANG['manuin']." ".$LANG['2']."</td>";
  echo"<td class=right>".number_format($m121)."</td>";
 echo"<td class=right>".number_format($m122)."</td>";
 echo"<td class=right>".number_format($m123)."</td>";
 echo"<td class=right>".number_format($m124)."</td>";
 echo"</tr>";
 echo"<tr><td>".$LANG['total_avai']."</td>";
   echo"<td class=right>".number_format($m121+$m111+$pro11)."</td>";
 echo"<td class=right>".number_format($m112+$m122+$pro12)."</td>";
 echo"<td class=right>".number_format($m123+$m113+$pro13)."</td>";
 echo"<td class=right>".number_format($m124+$m114+$pro14)."</td>";
 echo"</tr>";
 echo"<tr><td>".$LANG['demand']."</td>";
   echo"<td class=right>".number_format($dt11)."</td>";
 echo"<td class=right>".number_format($dt12)."</td>";
 echo"<td class=right>".number_format($dt13)."</td>";
 echo"<td class=right>".number_format($dt14)."</td>";
 echo"</tr class=right>";
// c2
 echo"<tr><td colspan=6  class=los><b>".$LANG['2']."</b></td>";
 echo"</tr>";  
 echo"<tr><td>".$LANG['manuin']." ".$LANG['1']."</td>";
 echo"<td class=right>".number_format($m211)."</td>";
 echo"<td class=right>".number_format($m212)."</td>";
 echo"<td class=right>".number_format($m213)."</td>";
 echo"<td class=right>".number_format($m214)."</td>";
 echo"</tr>";
 echo"<tr><td>".$LANG['manuin']." ".$LANG['2']."</td>";
  echo"<td class=right>".number_format($m221+$pro21)."</td>";
 echo"<td class=right>".number_format($m222+$pro22)."</td>";
 echo"<td class=right>".number_format($m223+$pro23)."</td>";
 echo"<td class=right>".number_format($m224+$pro24)."</td>";
 echo"</tr>";
 echo"<tr><td>".$LANG['total_avai']."</td>";
   echo"<td class=right>".number_format($m221+$m211+$pro21)."</td>";
 echo"<td class=right>".number_format($m222+$m212+$pro22)."</td>";
 echo"<td class=right>".number_format($m223+$m213+$pro23)."</td>";
 echo"<td class=right>".number_format($m224+$m214+$pro24)."</td>";
 echo"</tr>";
 echo"<tr><td>".$LANG['demand']."</td>";
   echo"<td class=right>".number_format($dt21)."</td>";
 echo"<td class=right>".number_format($dt22)."</td>";
 echo"<td class=right>".number_format($dt23)."</td>";
 echo"<td class=right>".number_format($dt24)."</td>";
 echo"</tr>";
// c3
 echo"<tr><td colspan=6  class=los><b>".$LANG['3']."</b></td>";
 echo"</tr>"; 
 echo"<tr><td>".$LANG['manuin']." ".$LANG['1']."</td>";
 echo"<td class=right>".number_format($m311)."</td>";
 echo"<td class=right>".number_format($m312)."</td>";
 echo"<td class=right>".number_format($m313)."</td>";
 echo"<td class=right>".number_format($m314)."</td>";
 echo"</tr>";
 echo"<tr><td>".$LANG['manuin']." ".$LANG['2']."</td>";
 echo"<td class=right>".number_format($m321)."</td>";
 echo"<td class=right>".number_format($m322)."</td>";
 echo"<td class=right>".number_format($m323)."</td>";
 echo"<td class=right>".number_format($m324)."</td>";
 echo"</tr>";
 echo"<tr><td>".$LANG['total_avai']."</td>";
   echo"<td class=right>".number_format($m311+$m321)."</td>";
 echo"<td class=right>".number_format($m312+$m322)."</td>";
 echo"<td class=right>".number_format($m313+$m323)."</td>";
 echo"<td class=right>".number_format($m314+$m324)."</td>";
 echo"</tr>";
 echo"<tr><td>".$LANG['demand']."</td>";
   echo"<td class=right>".number_format($dt31)."</td>";
 echo"<td class=right>".number_format($dt32)."</td>";
 echo"<td class=right>".number_format($dt33)."</td>";
 echo"<td class=right>".number_format($dt34)."</td>";
 echo"</tr>";
 echo"</table>";



  echo"</section>";
 echo"<aside class='sidebar'>";
   echo"<h4>".$LANG['transportcost']."</h4>";	
	echo"<table style='width:100%;'>";
	echo"<th>".$LANG['from']."</th><th>".$LANG['to']."</th><th>".$LANG['Cost']."</th>";
	echo"<tr><td>".$LANG['1']."</td><td>".$LANG['2']."</td><td>US$ <b>".number_format($l_c1_c2)."</b></td></tr>";
	echo"<tr><td>".$LANG['1']."</td><td>".$LANG['3']."</td><td>US$ <b>".number_format($l_c1_c3)."</b></td></tr>";
	echo"<tr><td>".$LANG['2']."</td><td>".$LANG['1']."</td><td>US$ <b>".number_format($l_c2_c1)."</b></td></tr>";
	echo"<tr><td>".$LANG['2']."</td><td>".$LANG['3']."</td><td>US$ <b>".number_format($l_c2_c3)."</b></td></tr>";
	echo"</table>";
	   echo"<br><h4>".$LANG['inventory']."</h4>";	
	for ($t=1; $t<=4; $t++) 
	{

	if ($t!=1) {echo"<br>";}
	echo"<table style='width:100%;'>";
	echo"<th width=70%>".$LANG['technology']." ".$t."</th><th>".$LANG['units']."</th>";
	$tech11="t1".$t;
	$tech21="t2".$t;
	$dt11="d1".$t;
	$dt21="d2".$t;
	$dt31="d3".$t;
	$inven=($$tech11+$$tech21-$$dt21-$$dt11-$$dt31);
	if ($inven<0) {$inven=0;}
	echo"<tr><td>".$LANG['totalproduction']."</td><td>".number_format($$tech11+$$tech21)."</td></tr>";
	echo"<tr><td>".$LANG['totaldemand']."</td><td>".number_format($$dt21+$$dt11+$$dt31)."</td></tr>";
	echo"<tr><td>".$LANG['inventory']."</td><td>".number_format($inven)."</td></tr>";
	echo"</table>";	
	
	}
 echo"</aside>";

  
  }
 //-------------------Present input check
 
 if( $_GET['act']=='schedule')
  {
  if (isset($_GET['time']))
  {
	$m="Not eligible to play this round, your game is expired!<br> Time remaining: 0 hours";
	$msg=message($m,0);
	echo $msg;
	//exit();
  }	
  if($_SESSION['player']==1)
{
 $id=$_SESSION['game_id'];
}
  if($_SESSION['admin']==1 or $_SESSION['mod']==1)
{
 $id=$_GET['gid'];
}
 $result2 = mysql_query("SELECT COUNT(id) FROM `team` where game_id='$id'");
 $row2 = mysql_fetch_array($result2);
 $no_of_teams=$row2[0]; 
 //echo $no_of_teams;
$result = mysql_query("SELECT name,id FROM `team` where game_id='$id'");
echo "<table>"; 
echo "<th>".$LANG['Round']."</th><th>".$LANG['deadline']."</th><th>".$LANG['hoursleft']."</th>";
$y=0;
// print TH
while ($row = mysql_fetch_array($result))
{
++$y;
echo"<th>".$row['name']."<br><a href=game.php?act=production&tid=".$row['id']."&id=".$id.">".$LANG['loddeci']."</a></th>";
}

// get round
$round = mysql_query("SELECT no_of_rounds,hours_per_round FROM `game` where id='$id'");
$no_rounds = mysql_fetch_array($round);
$rounds=$no_rounds['no_of_rounds']; 
$hpr=$no_rounds['hours_per_round']; 

for ($r=0; $r<=$rounds; $r++) 
{
 
// PRINT TD
// get deadlines

$q = "SELECT deadline FROM `round_assumption` where game_id='$id' and round='$r'";
$result_d = mysql_query($q) or die(mysql_error());
$deadline = mysql_fetch_array($result_d);
$dline=$deadline['deadline'];
// hours left
  $date = date('Y-m-d H:i:s');
  $now = strtotime($date);
  $deadline = strtotime($dline);
  $time_dif=round(($deadline - $now)/60/60,2);
  if ($time_dif<=0) 
  {
  $time_dif="&#8709 ".$LANG['end'];

  }
  if ($time_dif>0 and $time_dif<$hpr ) 
  {
  $lod="";
  
  }
  else
  {
  $lod="-";
  }
  
echo"<tr><td>".$LANG['Round']." ".$r."</td><td>".$dline."</td><td>".$time_dif."</td>";
$result = mysql_query("SELECT id FROM `team` where game_id='$id'");
while ($row = mysql_fetch_array($result))
{
$tid=$row['id'];
$check_input = mysql_query("SELECT COUNT(id) FROM `input` where game_id='$id' and team_id='$tid' and round='$r'");
$ci = mysql_fetch_array($check_input);
$input=$ci[0]; 
if ($input==0) 
{
$ms=$LANG['nodecision'];
}
else
{
$ms=$LANG['lodged'];
} 
echo "<td>".$ms." | ".$lod."</td>";
}
echo "</tr>";
}

// present lodge table

$result = mysql_query("SELECT id FROM `team` where game_id='$id'");
// print TH
echo "<tr><td colspan='3'><b>".$LANG['DECISIONS']."</b></td>";
while ($row = mysql_fetch_array($result))
{

	echo"<td><a href=game.php?act=production&tid=".$row['id']."&id=".$id.">".$LANG['lodge']."</a></td>";
	//}
}
echo"</tr>";
echo "</table><br>";
 }
 
 //------------------ end input check
 
 
 
 //-------------------Present result SUM table
 
 
 
 // Present dropdown list game
  // if( $_GET['act']=='result')
   //{
  // echo"<form action='game.php?act=result' class=demo method='POST'>";
  // echo"<noscript><input class=submit type=submit value='Pick game' /></noscript><b>Please pick game: </b><select class=black onchange='this.form.submit()' name=id>";
//	$result = mysql_query("SELECT DISTINCT game_id FROM `output`");
	
//	if($result === FALSE) {   die(mysql_error()); }
	
//	while ($row = mysql_fetch_array($result))
//	{
//	$g_id=$row['game_id'];
//	$result1 = mysql_query("SELECT name FROM game where id='$g_id'");
//	$array = mysql_fetch_array($result1);
//	$namegame=$array['name'];	
	
//	echo"<option value=".$g_id.">".$namegame."</option>";

//	}	
//	echo"</select></form>";
 //  }
 //end 

 
 // present result page
  if( $_GET['act']=='result')
  {
  
      echo"<div class='simpleTabs'>";
		 echo"<ul class='simpleTabsNavigation'>";	
		  if ($_SESSION['player']!=1)
			{
			echo"<li><a href='#'>".$LANG['preview']."</a></li>";
			}
					echo"<li><a href='#'>".$LANG['sum']."</a></li>";
					echo"<li><a href='#'>".$LANG['market']."</a></li>";	
					echo"<li><a href='#'>".$LANG['finance']."</a></li>";
					echo"<li><a href='#'>".$LANG['other']."</a></li>";
		 echo"</ul>";
		 
		  if ($_SESSION['player']!=1)
			{		 
 // for preview result
 
 if(isset($_GET['id']))
{
$gid=$_GET['id'];
//check if game is mod game
 if(isset($_SESSION['mod']))
{
$mid=$_SESSION['id'];
$query = "SELECT mod_id FROM `game` WHERE id='$gid'";
$result = mysql_query($query) or die(mysql_error());
$row = mysql_fetch_array($result);
$mod_id=$row['mod_id'];
if ($mid!=$mod_id) { header ("Location:game.php?act=game"); exit();} 
}
}
else 
{
 header ("Location:game.php?act=game");
}
 
 
	echo"<div class='simpleTabsContent'>";
	
	echo"<BR><h4>".$LANG['preview']."</h4>";
	
	
	$result2 = mysql_query("SELECT no_of_rounds FROM `game` where id='$gid'");
	$row2 = mysql_fetch_array($result2);
	$rounds=$row2['no_of_rounds']; 	
echo"<table>";

// get random teamid

	$result2 = mysql_query("SELECT max(id) FROM `team` where game_id='$gid'");

	$row2 = mysql_fetch_array($result2);
	$randid=$row2[0];
	
//end 	

echo"<th>".$LANG['Round']."</th><th>".$LANG['deadline']."</th><th>".$LANG['hoursleft']."</th><th>".$LANG['preview']."</th>";
//if($_SESSION['admin']==1) {echo"<th>".$LANG['end']."</th>";}
  // get round
	$res_round = mysql_query("SELECT max(round) FROM output where game_id='$gid' and final='1' ");
	$array_round = mysql_fetch_array($res_round);
	$round=$array_round[0];
	$round_for_input=$round+1;
	
	// get practice round
	$game = mysql_query("SELECT practice_round FROM `game` where id='$gid'");
	$hpr = mysql_fetch_array($game);
	$pround=$hpr['practice_round'];
for ($r=0; $r<=$rounds; $r++) 
{

$q = "SELECT deadline FROM `round_assumption` where game_id='$gid' and round='$r'";
$result_d = mysql_query($q) or die(mysql_error());
$deadline = mysql_fetch_array($result_d);
$dline=$deadline['deadline'];
// hours left
  $date = date('Y-m-d H:i:s');
  $now = strtotime($date);
  $deadline = strtotime($dline);
  $time_dif=round(($deadline - $now)/60/60,2);
if ($time_dif<0) {$time_dif=$LANG['end'];}
//echo $r;


if ($r<=$pround) {$pra=$LANG['practice'];} else {$pra="";}	
	
echo"<form action='?act=previewresult&gid=$gid&tid=$randid' class=demo method='POST'>";
echo"<tr><td>".$pra." ".$LANG['Round']." ".$r."</td><td>".$dline."</td><td>".$time_dif." ".$LANG['hour']."</td>";
echo"<td class=demo>";
if ($r==$round_for_input)
{
echo"<select style='width:100%' name='rid' onchange='this.form.submit()'>";
echo"<option value=''> </option>";
echo"<option value='".$r."'>".$LANG['preview']."</option>";
echo"</select>";
}
if ($r<$round_for_input)
{
echo "<a href=game.php?act=result>Result</a>";
}
echo"</td>";
echo"</form>";
//if($_SESSION['admin']==1)
//{
//echo"<td class=demo>";
//echo"<select style='width:100%' name='endround' onchange='this.form.submit()'>";
//echo"<option value='0'></option>";
//echo"<option value='".$r."'>".$LANG['endround']."</option>";
//echo"</select>";
//echo"</td>";
//}

echo"</tr>";
}

echo"</table>";
	
	
	
	
	echo"<br><h4>".$LANG['teamdecision']."</h4>";
	echo"<table>";
	echo"<th width=10%>".$LANG['lodged']."</th><th>".$LANG['TEAM']."</th><th width=15%>".$LANG['PLAYERS']."</th><th width=10%>".$LANG['date']."</th><th width=12%>".$LANG['revenue']."</th><th width=12%>".$LANG['costs']."</th><th width=12%>".$LANG['ebitda']."</th><th width=7%>".$LANG['action']."</th>";
	
	$res_round = mysql_query("SELECT max(round) FROM output where game_id='$gid' and final='1'");
	$array_round = mysql_fetch_array($res_round);
	$round=$array_round[0];
	//echo $round;
	$round_for_input=$round+1;
	
	$result = mysql_query("SELECT id,name FROM `team` where game_id='$gid'");
	if($result === FALSE) { die(mysql_error()); }
	while ($row = mysql_fetch_array($result))
	{
	$name=$row['name'];
	$tid=$row['id'];
	//echo $round_for_input;
	$decision = mysql_query("SELECT id,player_id FROM input WHERE game_id='$gid' and team_id='$tid' and team_decision='1' and round='$round_for_input' ");
	$de = mysql_fetch_array($decision);
	if( mysql_num_rows($decision) == 1) 
	{
	//echo "trieuanh";
	$input_id=$de['id'];
	$pid=$de['player_id'];
	//get player name
	$query2 = "SELECT name FROM `player` WHERE id='$pid'";
	$result2 = mysql_query($query2) or die(mysql_error());
	$row2 = mysql_fetch_array($result2);
	$pname=$row2['name'];

	//echo $input_id."sdds";
	$result2 = mysql_query("SELECT date,revenue,cost,ebitda FROM `checklist` where input_id='$input_id'");
	$row2 = mysql_fetch_array($result2);
	$grev=$row2['revenue'];
	$gcost=$row2['cost'];
	$gebitda=$row2['ebitda'];
	$pdate=$row2['date'];
	
	$lod="imgs/icon-tick.png";
	$class="pos";
	
	echo"<tr><td><img style='width:10px;height:10px' src='".$lod."'></td><td>".$name."</td><td>".$pname."</td><td class=right>".$pdate."</td><td class=right>".number_format($grev)."</td><td class=right>".number_format($gcost)."</td><td class=right>".number_format($gebitda)."</td><td><a href=game.php?act=production&gid=".$gid."&tid=".$tid."&pid=".$pid.">Detail</a></td></tr>";
	}
	else
	{
	$lod="imgs/icon-cross.png";
	$pdate="-";
	$class="neg";
	$grev="-";
	$gcost="-";
	$gebitda="-";
	echo"<tr><td><img style='width:10px;height:10px' src='".$lod."'></td><td>".$name."</td><td></td><td class=right>".$pdate."</td><td class=right>".$grev."</td><td class=right>".$gcost."</td><td class=right>".$gebitda."</td><td>Detail</td></tr>";
	}
	
	
	}
	echo"</table>";
	
	echo"<br><h4>".$LANG['studentdecision']."</h4>";
	echo"<table>";
	echo"<th width=10%>".$LANG['lodged']."</th><th >".$LANG['PLAYERS']."</th><th width=15%>".$LANG['TEAM']."</th><th width=10%>".$LANG['date']."</th><th width=12%>".$LANG['revenue']."</th><th width=12%>".$LANG['costs']."</th><th width=12%>".$LANG['ebitda']."</th><th width=7%>".$LANG['action']."</th>";
	
	$res_round = mysql_query("SELECT max(round) FROM output where game_id='$gid' and final='1'");
	$array_round = mysql_fetch_array($res_round);
	$round=$array_round[0];
	$round_for_input=$round+1;
	
	$result = mysql_query("SELECT id,name,team_id FROM `player` where game_id='$gid'");
	if($result === FALSE) { die(mysql_error()); }
	while ($row = mysql_fetch_array($result))
	{
	$name=$row['name'];
	$pid=$row['id'];
	$tid=$row['team_id'];
	// get team name
$tid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$tid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
	//echo $gid;
	$decision = mysql_query("SELECT id FROM input WHERE game_id='$gid' and player_id='$pid' and round='$round_for_input' ");
	$de = mysql_fetch_array($decision);
	if( mysql_num_rows($decision) == 1) 
	{
	
	$input_id=$de['id'];
	//echo $input_id."sdds";
	$result2 = mysql_query("SELECT date,revenue,cost,ebitda FROM `checklist` where input_id='$input_id'");
	$row2 = mysql_fetch_array($result2);
	$grev=$row2['revenue'];
	$gcost=$row2['cost'];
	$gebitda=$row2['ebitda'];
	$pdate=$row2['date'];
	
	$lod="imgs/icon-tick.png";
	$class="pos";
	
	echo"<tr><td><img style='width:10px;height:10px' src='".$lod."'></td><td>".$name."</td><td>".$tname."</td><td class=right>".$pdate."</td><td class=right>".number_format($grev)."</td><td class=right>".number_format($gcost)."</td><td class=right>".number_format($gebitda)."</td><td><a href=game.php?act=production&gid=".$gid."&tid=".$tid."&pid=".$pid.">".$LANG['detail']."</a></td></tr>";
	}
	else
	{
	$lod="imgs/icon-cross.png";
	$pdate="-";
	$class="neg";
	$grev="-";
	$gcost="-";
	$gebitda="-";
	echo"<tr><td><img style='width:10px;height:10px' src='".$lod."'></td><td>".$tname."</td><td>".$name."</td><td class=right>".$pdate."</td><td class=right>".$grev."</td><td class=right>".$gcost."</td><td class=right>".$gebitda."</td><td>".$LANG['detail']."</td></tr>";
	}
	
	
	}
	
	echo"</table>";
	echo "<br><h4>".$LANG['actlevel']."</h4>";
		echo"<table>";
	echo"<th width=25%>".$LANG['PLAYERS']."</th><th width=15%>".$LANG['TEAM']."</th><th>".$LANG['actlevel']."</th><th width=35%>".$LANG['graph']."</th>";
	
		
	$result = mysql_query("SELECT id FROM `player` where game_id='$gid'");
	if($result === FALSE) { die(mysql_error()); }
	$maxact=0;
	while ($row = mysql_fetch_array($result))
	{
	$pid=$row['id'];

	$decision = mysql_query("SELECT count(id) FROM logs WHERE user_id='$pid' and user_name='2'");
	$de = mysql_fetch_array($decision);
	$actlevel=$de[0];
	if ($maxact<$actlevel) {$maxact=$actlevel;}
	

	}	
	$result = mysql_query("SELECT id,name,team_id FROM `player` where game_id='$gid'");
	if($result === FALSE) { die(mysql_error()); }
	while ($row = mysql_fetch_array($result))
	{
	$name=$row['name'];
	$pid=$row['id'];
	$tid=$row['team_id'];
	// get team name
$tid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$tid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
	//echo $gid;
	$decision = mysql_query("SELECT count(id) FROM logs WHERE user_id='$pid' and user_name='2'");
	$de = mysql_fetch_array($decision);
	$actlevel=$de[0];
	
	if ($maxact!=0) {$rateact=$actlevel/$maxact*100;} else {$rateact=0;}
	//echo $rateact;
	echo"<tr><td>".$name."</td><td>".$tname."</td><td class=right>".$actlevel."</td><td><dl class='rate' style='width:99%'><dd class='new' style='width:".$rateact."%'></dd></dl></td></tr>";
	}	
	
	echo"</table>";
	
	echo"</div>";
			}
			
 // for summary result
 	echo"<div class='simpleTabsContent'>";

 
 
 
   // Present dropdown list round
   if( $_GET['act']=='result')
   {
 //---------------- check who is
 if ($_SESSION['player']==1)
 {
 $id=$_SESSION['game_id'] ;
 $tid=$_SESSION['team_id'] ;
 }
 else
 {
 if(isset($_GET['id']))
{
$id=$_GET['id'];

}
else 
{
 header ("Location:game.php?act=game");
}
 }
 //----------- end check who is 

	echo"<table cellpadding='0' cellspacing='0' class=clear>";
	echo"<tr class=clear>";
	
	echo"<td class=clear>";
//round

	if(!isset($_POST['rid'])){$rid=0;}else{$rid=$_POST['rid'];}  
	if(isset($_POST['draw'])) { $draw=$_POST['draw'];} else { $draw=3; }  
// get practice round
	$game = mysql_query("SELECT practice_round FROM `game` where id='$id'");
	$hpr = mysql_fetch_array($game);
	$pround=$hpr['practice_round'];

if($_SESSION['mod']==1 or $_SESSION['admin']==1 )
{
	$result1 = mysql_query("SELECT distinct(round) as round FROM `output`  where game_id='$id'");
	$final="";
}
else
{
$result1 = mysql_query("SELECT distinct(round) as round FROM `output`  where game_id=$id and final='1'");
$final="and final='1'";
}	
	echo"<form action='game.php?act=result&id=".$id."' class=demo method='POST'>";
	echo"<input type='hidden' name='rid' value='".$rid."' />";
	echo"<input type='hidden' name='draw' value='".$draw."' />";
    echo"<select class=black  name=rid onchange='this.form.submit()'>";

	while ($row1 = mysql_fetch_array($result1))
{
	$row1=$row1['round'];
    //echo $row1;
	if ($pround>=$row1) {$pt=$LANG['practice'];} else {$pt="";}
	if ($row1==$rid) {$s="selected";} else {$s="";}
	echo"<option ".$s." value=".$row1."> ".$pt." ".$LANG['Round']." ".$row1."</option>";
}
	echo"</select></form>";
  
 //end  
 
	echo"</td>";
	echo"<td class=clear>";
	echo"<form action='game.php?act=result&id=".$id."' class=demo method='POST'>";
	echo"<input type='hidden' name='rid' value='".$rid."' />";
	echo"<input type='hidden' name='draw' value='1' />";
	echo"<input class=submit type=submit value='".$LANG['graph1']."' />";
	echo"</form>";
	echo"</td>";
	
	echo"<td class=clear>";
	echo"<form action='game.php?act=result&id=".$id."' class=demo method='POST'>";
	echo"<input type='hidden' name='rid' value='".$rid."' />";
	echo"<input type='hidden' name='draw' value='2' />";
	echo"<input class=submit type=submit value='".$LANG['graph2']."' />";
	echo"</form>";
	echo"</td>";
	
	echo"<td class=clear>";
	echo"<form action='game.php?act=result&id=".$id."' class=demo method='POST'>";
	echo"<input type='hidden' name='rid' value='".$rid."' />";
	echo"<input type='hidden' name='draw' value='3' />";
	echo"<input class=submit type=submit value='".$LANG['graph3']."' />";
	echo"</form>";
	echo"</td>";
	
	echo"<td class=clear>";
	echo"<form action='game.php?act=result&id=".$id."' class=demo method='POST'>";
	echo"<input type='hidden' name='rid' value='".$rid."' />";
	echo"<input type='hidden' name='draw' value='4' />";
	echo"<input class=submit type=submit value='".$LANG['graph4']."' />";
	echo"</td></form>";
	
	
	echo"</tr>";
	echo"</table>";
	
 // for graph

 $graph="graph".$draw;
echo"<table>";	
 
echo"<th>".$LANG[$graph]."</th>";
echo"<tr><td>";
echo"<img src='graph.php?gid=$id&draw=$draw&graph=1'>";
echo"</td></tr>";
echo"</table>";	 

$x=1;
$array="";
$ratio_array="";
$result = mysql_query("SELECT team_id,output_c1,output_c2,output_c3 FROM `output` where game_id='$id' and round='$rid' ".$final." order by team_id desc");
if($result === FALSE) {
    die(mysql_error()); // TODO: better error handling
}

while ($row = mysql_fetch_array($result))
{
 $tid=$row['team_id'];
 $result2 = mysql_query("SELECT name FROM `team` where id='$tid'");
 $row2 = mysql_fetch_array($result2);
 $name=$row2['name']; 
 
 $o1=$row['output_c1'];
 // for ratio
 $ratio_data=$row['output_c1'];
 //
 $o2=$row['output_c2'];
 $o3=$row['output_c3'];
 $output_c1 = preg_split("/[\s,]+/",$o1);
 $output_c2 = preg_split("/[\s,]+/",$o2);
 $output_c3 = preg_split("/[\s,]+/",$o3);
 
$comma=explode(",",$o1);
$no=count($comma);
//echo $o1; 
  for ($y=0; $y<$no; $y++) 
{
$op1=$output_c1[$y];
$op2=$output_c2[$y];
$op3=$output_c3[$y];

$out1=(int)$op1;
$out2=(int)$op2;
$out3=(int)$op3;
$glob=$out1+$out2+$out3;
//echo $out1."/".$out2."/".$out3."=".$glob."<br>";
//echo $glob."<br>";
//if ($out1=""){$array=$glob;} else {$array=$array.",".$glob;}


// SET IF PRINT COUNTRY


if(isset($_POST['country'])){$country=$_POST['country']; } else {$country=4;}	
if ($country=='1') {$array=$array.",".$out1;}
if ($country=='2') {$array=$array.",".$out2;}
if ($country=='3') {$array=$array.",".$out3;}
if ($country=='4') {$array=$array.",".$glob;}

// End set country
}

// add team id on top
$array1=$tid.",".$array;
$present[$x] = $array1;
// for ratio data
$ratio_data=$tid.",".$ratio_data;
$present_ratio[$x] = $ratio_data;

//$present = array(
//    $x => $array,);
//echo "Array".$x.$present[$x]."<br>";
//echo "<br>Team ".$x." :".$array."<br>";
++$x;
 } 
   
   
   

   } 
 //end  
 
 //present team sum
 
 if( $_GET['act']=='result')
  {
 //---------------- check who is
 if ($_SESSION['player']==1)
 {
 $id=$_SESSION['game_id'] ;
 $tid=$_SESSION['team_id'] ;
 }
 else
 {
 if(isset($_GET['id']))
{$id=$_GET['id'];}
else 
{
 header ("Location:game.php?act=game");
}
 }
 //----------- end check who is

 // result table2



$result = mysql_query("SELECT team_id,output_c1,output_c2,output_c3,round FROM `output` where game_id='$id' and round='$rid' ".$final." order by team_id desc");
echo "<br><table>"; 
echo "<th>ID</th><th>".$LANG['TEAM'].$LANG['name']."</th><th>".$LANG['Round']."</th><th>".$LANG['revenue']."</th><th>".$LANG['costs']."</th><th>".$LANG['paftert']."</th><th>".$LANG['action']."</th>";
if($result === FALSE) {
    die(mysql_error()); // TODO: better error handling
}
while ($row = mysql_fetch_array($result))
{
 $tid=$row['team_id'];
 $result2 = mysql_query("SELECT name FROM `team` where id='$tid'");
 $row2 = mysql_fetch_array($result2);
 $name=$row2['name'];
 // Get date from string
 $output_c1=$row['output_c1'];
 $output_c2=$row['output_c2'];
 $output_c3=$row['output_c3'];
 $output_c1 = preg_split("/[\s,]+/",$output_c1);
 $output_c2 = preg_split("/[\s,]+/",$output_c2);
 $output_c3 = preg_split("/[\s,]+/",$output_c3);
 
 $cost=(int)$output_c1[12]+(int)$output_c2[12]+(int)$output_c3[12];
 $revenue=(int)$output_c1[3]+(int)$output_c2[3]+(int)$output_c3[3];
 $profit=(int)$output_c1[19]+(int)$output_c2[19]+(int)$output_c3[19];
 $cost=number_format($cost);
 $revenue=number_format($revenue);
 //$profit=number_format($profit);
 if($profit<0){$class="neg";$profit="(".number_format(abs($profit)).")";} else{$class="pos";$profit=number_format($profit);}
 
 echo"<tr><td>".$tid."</td><td>".$name."</td><td>".$row['round']."</td><td class=pos>".$revenue."</td><td class=pos>".$cost."</td><td class=".$class.">".$profit."</td><td><a href=game.php?act=resultr&rid=".$row['round']."&tid=".$tid."> ".$LANG['RESULTS']." </a></td></tr>";
}
echo "</table><br>";
 } 
 // end
 
 
 
 //------------------------------------------Present team 1->n comparison table Ratio


 if( $_GET['act']=='result')
  {
// GET COUNTRY
 //---------------- check who is
 if ($_SESSION['player']==1)
 {
 $id=$_SESSION['game_id'] ;
 $tid=$_SESSION['team_id'] ;
 }
 else
 {
 if(isset($_GET['id']))
{$id=$_GET['id'];}
else 
{
 header ("Location:game.php?act=game");
}
 }
 //----------- end check who is


	
// END GET


// start print table
echo "<table class=result>"; 
echo "<th>".$LANG['ratio']."</th>";

for ($y=1; $y<$x; $y++) 
{
//echo "Array".$y.$present[$y]."<br>";
// print TH
$team_id=$present[$y];
$team_id= preg_split("/[\s,]+/",$team_id);
//echo"Team ID ".$team_id[0];
// PRINT TEAM ID

 $tid=$team_id[0];
 $result2 = mysql_query("SELECT name FROM `team` where id='$tid'");
 $row2 = mysql_fetch_array($result2);
 $name=$row2['name'];
echo"<th>".$name." [".$team_id[0]."]</th>";
//
}
// ---------------------------------------------------------START LOOP

$comma=explode(",",$title_ratio);
$no_titles=count($comma);
$no_titles=$no_titles+38;
//echo $no_titles;
$title = preg_split("/[,]+/",$title_ratio);

for ($t=39; $t<=$no_titles; $t++) 
{

//------------------------format number
// -----------------------end format
$k=$t+2;
$t2=$t-39;
if ($k==41 or $k==48 or $k==49 or $k==57)
{$class_t="result";}else{$class_t="";}
echo"<tr><td class=".$class_t.">".$title[$t2]."</td>";
for ($y=1; $y<$x; $y++) 
{
//echo "x=".$x."/".$y;
 
 $d=$present_ratio[$y];
 $print = preg_split("/[\s,]+/",$d);

if ($k==41 or $k==49)
{
 echo"<td class=result></td>";
}else 
{
$p=$print[$k];
//echo $p."/";
$p=(float)$p;
//echo $p."/";
$p=round($p,2);
if($p<0) {$class="neg";} else{$class="pos";}
if ($k<45){$p=number_format($p);}
if ($k==48 or $k==57)
{
if($p<0){$class="neg0";} else{$class="pos0";}
}
else{
if($p<0){$class="neg";} else{$class="pos";}
	}

 echo"<td class=".$class.">".($p)."</td>";
 }
}
echo "</tr>";
}



// ----------------------------------------------------------END LOOP
// end print
 } echo "</table>";
 // ----------------------------------------------------End team comparision table Ratio
 
 
 
 
 // end
 
	echo"</div>";
 //for market result
 	echo"<div class='simpleTabsContent'>";
if(isset($_POST['country'])){$country=$_POST['country']; $name=$LANG[$country];} else {$country=4;$name=$LANG[$country];}	
//echo $country;	
	echo"<table cellpadding='0' cellspacing='0' class=clear>";
	echo"<tr class=clear>";
	
	echo"<td class=clear>";
//round
	if(!isset($_POST['rid']))
{$rid=0;}else{$rid=$_POST['rid'];}  
// get practice round
	$game = mysql_query("SELECT practice_round FROM `game` where id='$id'");
	$hpr = mysql_fetch_array($game);
	$pround=$hpr['practice_round'];


	if($_SESSION['mod']==1 or $_SESSION['admin']==1 )
{
	$result1 = mysql_query("SELECT distinct(round) as round FROM `output`  where game_id='$id'");
}
else
{
$result1 = mysql_query("SELECT distinct(round) as round FROM `output`  where game_id=$id and final='1'");
}
	
	echo"<form action='game.php?act=result&id=".$id."' class=demo method='POST'>";
	echo"<input type='hidden' name='rid' value='".$rid."' />";
		echo"<input type='hidden' name='country' value='".$country."' />";
	echo"<select class=black  name=rid onchange='this.form.submit()'>";

	while ($row1 = mysql_fetch_array($result1))
{
	$row1=$row1['round'];
    //echo $row1;
	if ($pround>=$row1) {$pt=$LANG['practice'];} else {$pt="";}
	if ($row1==$rid) {$s="selected";} else {$s="";}
	echo"<option ".$s." value=".$row1."> ".$pt." ".$LANG['Round']." ".$row1."</option>";
}
	echo"</select></form>";
  
 //end  
 
	echo"</td>";
	echo"<td class=clear>";
	echo"<form action='game.php?act=result&id=".$id."' class=demo method='POST'>";
	echo"<input type='hidden' name='rid' value='".$rid."' />";
	echo"<input type='hidden' name='country' value='4' />";
	echo"<input class=submit type=submit value='".$LANG['4']."' />";
	echo"</form>";
	echo"</td>";
	
	echo"<td class=clear>";
	echo"<form action='game.php?act=result&id=".$id."' class=demo method='POST'>";
	echo"<input type='hidden' name='rid' value='".$rid."' />";
	echo"<input type='hidden' name='country' value='1' />";
	echo"<input class=submit type=submit value='".$LANG['1']."' />";
	echo"</form>";
	echo"</td>";
	
	echo"<td class=clear>";
	echo"<form action='game.php?act=result&id=".$id."' class=demo method='POST'>";
	echo"<input type='hidden' name='rid' value='".$rid."' />";
	echo"<input type='hidden' name='country' value='2' />";
	echo"<input class=submit type=submit value='".$LANG['2']."'/>";
	echo"</form>";
	echo"</td>";
	
	echo"<td class=clear>";
	echo"<form action='game.php?act=result&id=".$id."' class=demo method='POST'>";
	echo"<input type='hidden' name='rid' value='".$rid."' />";
	echo"<input type='hidden' name='country' value='3' />";
	echo"<input class=submit type=submit value='".$LANG['3']."'/>";
	echo"</form>";
	echo"</td>";
	
	
	echo"</tr>";
	echo"</table>";
	
	
	//check if tech available for print
echo"<h4>".$LANG[$country]."</h4>";	
$tech1=$tech2=$tech3=$tech4=0;
$result = mysql_query("SELECT team_id FROM `output` where game_id='$id' and round='$rid' ".$final." order by team_id desc");
while ($row = mysql_fetch_array($result))
{
 $tid=$row['team_id'];


   $result2 = mysql_query("SELECT tech FROM output where game_id='$id' and team_id='$tid' and round='$rid' ".$final."");
   $array2 = mysql_fetch_array($result2);
   $tech=$array2['tech'];	
   //echo $tech;
   $tech= preg_split("/[,]+/", $tech);
   $tech1=$tech1+$tech[0];
   $tech2=$tech2+$tech[1];
   $tech3=$tech3+$tech[2];
   $tech4=$tech4+$tech[3];
	
}

	
	for ($t=1; $t<=4; $t++) 
	{
	$techno="tech".$t;
	if ($$techno>0)
		{
	$tech="tech".$t;
	echo "<center><h4>".$LANG[$tech]."</h4></center>";
	echo"<table>";
	echo"<th>".$LANG['marketshare']."</th>";
	
	echo"<tr><td>";
	echo"<img src='graph.php?gid=$id&round=$rid&result=1&country=$country&tech=$t'>";
	echo"</td></tr>";
	echo"</table>";	
if ($country==1 or $country==2 or $country==3 or $country==4)	
{
	echo "<center><h4>".$LANG['price']."</h4></center>";
	echo "<table>";
	echo"<th>Team</th><th>".$LANG['price']."</th><th>".$LANG['procost']."</th><th>".$LANG['Features']."</th><th>".$LANG['promotion']."</th>";
	$result2 = mysql_query("SELECT team_id,price_report,ucost_inven1,ucost_inven2,feature_report,promotion_report FROM `output` where game_id='$id' and round='$rid' ".$final."order by team_id desc");

while ($row2 = mysql_fetch_array($result2))
{
$tid=$row2['team_id'];
$price_report=$row2['price_report'];
$ucost1=$row2['ucost_inven1'];
$ucost2=$row2['ucost_inven2'];
$ucost1 = preg_split("/[\s,]+/",$ucost1);
$ucost2 = preg_split("/[\s,]+/",$ucost2);
$price_report = preg_split("/[\s,]+/",$price_report);
$feature_report=$row2['feature_report'];
$promotion_report=$row2['promotion_report'];
$promotion_report = preg_split("/[\s,]+/",$promotion_report);
$feature_report = preg_split("/[\s,]+/",$feature_report);
//echo $price_report;


if ($country==1) {$x=-1;$ucost=$ucost1;}
if ($country==2) {$x=3;$ucost=$ucost2;}
if ($country==3) {$x=7;$ucost=0;}
//if ($country==3) {$x=3;$ucost="";}
// get team name
$query2 = "SELECT name FROM `team` WHERE id='$tid'";
$result3 = mysql_query($query2) or die(mysql_error());
$row3 = mysql_fetch_array($result3);
$tname=$row3['name'];
$y=$x+$t;

	echo"<tr><td><b>".$tname."</b></td>";
	
if ($country==1 or $country==2 or $country==3)	{	
$uc=round($ucost[$t-1]);
if ($uc==0) {$uc="-";}
echo"<td>US$ ".round($price_report[$y])."</td><td>US$ ".$uc."</td><td>".round($feature_report[$y])."</td><td>".round($promotion_report[$y]/10,2)."%</td></tr>"; }

if ($country==4)	{	
    if ($ucost2[$t-1]!=0) {$uc21=round(($ucost1[$t-1]+$ucost2[$t-1])/2);} else {$uc21=round($ucost1[$t-1]);}
    echo"<td>US$ ".round(($price_report[-1+$t]+$price_report[3+$t])/2)."</td><td>US$ ".$uc21."</td><td>".round(($feature_report[-1+$t]+$feature_report[$t+3]+$feature_report[$t+7])/3)."</td><td>".round(($promotion_report[-1+$t]+$promotion_report[$t+3]+$promotion_report[$t+7])/30,2)."%</td></tr>"; }	
}


	echo "</table>";
	}
		}
	}
	
	
	
	
	
	
	echo"</div>";
	
	
	
	
 // for finance result
 	echo"<div class='simpleTabsContent'>";

 
  
  //------------------------------------------Present team 1->n comparison table pnl


 if( $_GET['act']=='result')
  {
// GET COUNTRY
 //---------------- check who is
 if ($_SESSION['player']==1)
 {
 $id=$_SESSION['game_id'] ;
 $tid=$_SESSION['team_id'] ;
 }
 else
 {
 if(isset($_GET['id']))
{$id=$_GET['id'];}
else 
{
 header ("Location:game.php?act=game");
}
 }
 //----------- end check who is
if(isset($_POST['country'])){$country=$_POST['country']; $name=$LANG[$country];} else {$country=4;$name=$LANG[$country];}	
//echo $country;	
	echo"<table cellpadding='0' cellspacing='0' class=clear>";
	echo"<tr class=clear>";
	
	echo"<td class=clear>";
//round
	if(!isset($_POST['rid'])) {$rid=0;}else{$rid=$_POST['rid'];}  
// get practice round
	$game = mysql_query("SELECT practice_round FROM `game` where id='$id'");
	$hpr = mysql_fetch_array($game);
	$pround=$hpr['practice_round'];


	if($_SESSION['mod']==1 or $_SESSION['admin']==1 )
{
	$result1 = mysql_query("SELECT distinct(round) as round FROM `output`  where game_id='$id'");
}
else
{
$result1 = mysql_query("SELECT distinct(round) as round FROM `output`  where game_id=$id and final='1'");
}
	
	echo"<form action='game.php?act=result&id=".$id."' class=demo method='POST'>";
	echo"<input type='hidden' name='rid' value='".$rid."' />";
	echo"<input type='hidden' name='country' value='".$country."' />";
    echo"<select class=black  name=rid onchange='this.form.submit()'>";

	while ($row1 = mysql_fetch_array($result1))
{
	$row1=$row1['round'];
    //echo $row1;
	if ($pround>=$row1) {$pt=$LANG['practice'];} else {$pt="";}
	if ($row1==$rid) {$s="selected";} else {$s="";}
	echo"<option ".$s." value=".$row1."> ".$pt." ".$LANG['Round']." ".$row1."</option>";
}
	echo"</select></form>";
  
 //end  
 
	echo"</td>";
	echo"<td class=clear>";
	echo"<form action='game.php?act=result&id=".$id."' class=demo method='POST'>";
	echo"<input type='hidden' name='rid' value='".$rid."' />";
	echo"<input type='hidden' name='country' value='4' />";
	echo"<input class=submit type=submit value='".$LANG['4']."' />";
	echo"</form>";
	echo"</td>";
	
	echo"<td class=clear>";
	echo"<form action='game.php?act=result&id=".$id."' class=demo method='POST'>";
	echo"<input type='hidden' name='rid' value='".$rid."' />";
	echo"<input type='hidden' name='country' value='1' />";
	echo"<input class=submit type=submit value='".$LANG['1']."' />";
	echo"</form>";
	echo"</td>";
	
	echo"<td class=clear>";
	echo"<form action='game.php?act=result&id=".$id."' class=demo method='POST'>";
	echo"<input type='hidden' name='rid' value='".$rid."' />";
	echo"<input type='hidden' name='country' value='2' />";
	echo"<input class=submit type=submit value='".$LANG['2']."'/>";
	echo"</form>";
	echo"</td>";
	
	echo"<td class=clear>";
	echo"<form action='game.php?act=result&id=".$id."' class=demo method='POST'>";
	echo"<input type='hidden' name='rid' value='".$rid."' />";
	echo"<input type='hidden' name='country' value='3' />";
	echo"<input class=submit type=submit value='".$LANG['3']."'/>";
	echo"</form>";
	echo"</td>";
	
	
	echo"</tr>";
	echo"</table>";
	



	
// END GET

$x=1;

$result = mysql_query("SELECT team_id,output_c1,output_c2,output_c3 FROM `output` where game_id='$id' and round='$rid' ".$final." order by team_id desc");
if($result === FALSE) {
    die(mysql_error()); // TODO: better error handling
}
echo "<h4> ".$name."</h4>";
echo "<center><h1> ".$LANG['pnl']."</h1></center>";
while ($row = mysql_fetch_array($result))
{
$array="";
$ratio_array="";
 $tid=$row['team_id'];
 $result2 = mysql_query("SELECT name FROM `team` where id='$tid'");
 $row2 = mysql_fetch_array($result2);
 $name=$row2['name']; 
 
 $o1=$row['output_c1'];
 
 // for ratio
 $ratio_data=$row['output_c1'];
 //
 $o2=$row['output_c2'];
 $o3=$row['output_c3'];
 $output_c1 = preg_split("/[\s,]+/",$o1);
 $output_c2 = preg_split("/[\s,]+/",$o2);
 $output_c3 = preg_split("/[\s,]+/",$o3);
 
$comma=explode(",",$o1);
$no=count($comma)-1;
//echo $o1; 
  for ($y=0; $y<$no; $y++) 
{
$op1=$output_c1[$y];
$op2=$output_c2[$y];
$op3=$output_c3[$y];

$out1=(int)$op1;
$out2=(int)$op2;
$out3=(int)$op3;
$glob=$out1+$out2+$out3;
//echo $out1."/".$out2."/".$out3."=".$glob."<br>";
//echo $glob."<br>";
//if ($out1=""){$array=$glob;} else {$array=$array.",".$glob;}


// SET IF PRINT COUNTRY



if ($country=='1') {$array=$array.",".$out1;}
if ($country=='2') {$array=$array.",".$out2;}
if ($country=='3') {$array=$array.",".$out3;}
if ($country=='4') {$array=$array.",".$glob;}

// End set country
}

// add team id on top
$array1=$tid.",".$array;
$present[$x] = $array1;
// for ratio data
$ratio_data=$tid.",".$ratio_data;
$present_ratio[$x] = $ratio_data;

//$present = array(
//    $x => $array,);
//echo "Array".$x.$present[$x]."<br>";
//echo "<br>Team ".$x." :".$array."<br>";
++$x;
 }

// start print table
echo "<table class=result>"; 
echo "<th>".$LANG['pnl']."</th>";
//echo "(".$x.")";
for ($y=1; $y<$x; $y++) 
{
//echo "Array".$y.$present[$y]."<br>";
// print TH
$team_id=$present[$y];
//echo $team_id."<br>";
$team_id= preg_split("/[\s,]+/",$team_id);
//echo"Team ID ".$team_id[0];
// PRINT TEAM ID

 $tid=$team_id[0];
 $result2 = mysql_query("SELECT name FROM `team` where id='$tid'");
 $row2 = mysql_fetch_array($result2);
 $name=$row2['name'];
echo"<th>".$name." [".$team_id[0]."]</th>";
//
}
// ---------------------------------------------------------START LOOP

$comma=explode(",",$title_pnl);
$no_titles=count($comma);
$no_titles=$no_titles-1;
//echo $no_titles;
$title = preg_split("/[,]+/",$title_pnl);

for ($t=0; $t<=$no_titles; $t++) 
{

//------------------------format number
// -----------------------end format
$k=$t+1;
if ($k==1 or $k==4  or $k==5 or $k==13 or $k==14 or $k==16 or $k==20 or $k==18)
{$class_t="result";$u1="";$u2="";}else{$class_t="";$u1="";$u2="";}
echo"<tr><td class=".$class_t.">".$u1.$title[$t].$u2."</td>";
for ($y=1; $y<$x; $y++) 
{

 $d=$present[$y];
 $print = preg_split("/[\s,]+/",$d);

if ($k==1)
{
 echo"<td class=result></td>";
}else 
{
$p=$print[$k];
if ($k==5) {$p="";}
if ($k==1 or $k==4 or $k==13 or $k==14 or $k==16 or $k==20 or $k==18)
{
if($p<0){$class="neg0";$p="(".number_format(abs($p)).")";} else{$class="pos0";$p=number_format($p);}
}
else
{
if ($k!=5){
if($p<0){$class="neg";$p="(".number_format(abs($p)).")";} else{$class="pos";$p=number_format($p);}
	}
}

 echo"<td class=".$class.">".$p."</td>";
 }
}
echo "</tr>";
}



// ----------------------------------------------------------END LOOP
// end print
 } echo "</table>";
 // ----------------------------------------------------End team comparision table pnl
 
 echo "<br><hr class=home><center><h1> ".$LANG['bs']."</h1></center>";
  //------------------------------------------Present team 1->n comparison table BS


 if( $_GET['act']=='result')
  {
// GET COUNTRY
 //---------------- check who is
 if ($_SESSION['player']==1)
 {
 $id=$_SESSION['game_id'] ;
 $tid=$_SESSION['team_id'] ;
 }
 else
 {
 if(isset($_GET['id']))
{$id=$_GET['id'];}
else 
{
 header ("Location:game.php?act=game");
}
 }
 //----------- end check who is
if(isset($_POST['country'])){$country=$_POST['country']; } else {$country=4;}	

	
// END GET


// start print table
echo "<br><table class=result>"; 
echo "<th>".$LANG['bs']."</th>";

for ($y=1; $y<$x; $y++) 
{
//echo "Array".$y.$present[$y]."<br>";
// print TH
$team_id=$present[$y];
$team_id= preg_split("/[\s,]+/",$team_id);
//echo"Team ID ".$team_id[0];
// PRINT TEAM ID

 $tid=$team_id[0];
 $result2 = mysql_query("SELECT name FROM `team` where id='$tid'");
 $row2 = mysql_fetch_array($result2);
 $name=$row2['name'];
echo"<th>".$name." [".$team_id[0]."]</th>";
//
}
// ---------------------------------------------------------START LOOP

$comma=explode(",",$title_bs);
$no_titles=count($comma);
$no_titles=$no_titles+19;
//echo $no_titles;
$title = preg_split("/[,]+/",$title_bs);

for ($t=20; $t<=$no_titles; $t++) 
{

//------------------------format number
// -----------------------end format
$k=$t+1;
$t2=$t-20;
if ($k==21 or $k==27 or $k==28 or $k==26 or $k==33 or $k==34 or $k==39 or $k==40)
{$class_t="result";}else{$class_t="";}
echo"<tr><td class=".$class_t.">".$title[$t2]."</td>";
for ($y=1; $y<$x; $y++) 
{
//echo "x=".$x."/".$y;
 $d=$present[$y];
 $print = preg_split("/[\s,]+/",$d);

if ($k==21 or $k==27 or $k==28 or $k==34)
{
 echo"<td class=result></td>";
}else 
{
$p=$print[$k];

if ($k==26 or $k==33 or $k==39 or $k==40)
{
if($p<0){$class="neg0";$p="(".number_format(abs($p)).")";} else{$class="pos0";$p=number_format($p);}
}
else{
if($p<0){$class="neg";$p="(".number_format(abs($p)).")";} else{$class="pos";$p=number_format($p);}
	}

 echo"<td class=".$class.">".$p."</td>";
 }
}
echo "</tr>";
}



// ----------------------------------------------------------END LOOP
// end print
 } echo "</table>";
 
 
  echo "<br><hr class=home><center><h1> ".$LANG['cashflow']."</h1></center>";
  //------------------------------------------Present team 1->n comparison table BS


 if( $_GET['act']=='result')
  {
// GET COUNTRY
 //---------------- check who is
 if ($_SESSION['player']==1)
 {
 $id=$_SESSION['game_id'] ;
 $tid=$_SESSION['team_id'] ;
 }
 else
 {
 if(isset($_GET['id']))
{$id=$_GET['id'];}
else 
{
 header ("Location:game.php?act=game");
}
 }
 //----------- end check who is
if(isset($_POST['country'])){$country=$_POST['country']; } else {$country=4;}	

	
// END GET

// get game assumption
$result1 = mysql_query("SELECT share_face_value FROM game where id='$id'");
$array = mysql_fetch_array($result1);
//$receivabler=$array['receivable']/100;	
//$payabler=$array['payable']/100;
$sharefv=$array['share_face_value'];
// start print table
	

echo "<br><table class=result>"; 
echo "<th>".$LANG['cashflow']."</th>";
// get value for each team
$result = mysql_query("SELECT id,team_id FROM `output` where game_id='$id' and round='$rid' ".$final." order by team_id desc");
while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$query2 = "SELECT name FROM `team` WHERE id='$teamid'";
$result2 = mysql_query($query2) or die(mysql_error());
$row2 = mysql_fetch_array($result2);
$tname=$row2['name'];
echo"<th>".$tname." [".$teamid."]</th>";
}
// end get value
echo"<tr><td colspan=5 class=result2>".$LANG['cashoperating']."</td></tr>";
echo"<tr><td> - EBITDA</td>";
// get value for each team
$result = mysql_query("SELECT id,team_id,output_c1,output_c2,output_c3 FROM `output` where game_id='$id' and round='$rid' ".$final." order by team_id desc");
while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
 $output_c1=$row['output_c1'];
 $output_c2=$row['output_c2'];
 $output_c3=$row['output_c3'];
 $outputc1="output_c1".$teamid;
 $outputc2="output_c2".$teamid;
 $outputc3="output_c3".$teamid;
 $output_c1 = preg_split("/[\s,]+/",$output_c1);
 $output_c2 = preg_split("/[\s,]+/",$output_c2);
 $output_c3 = preg_split("/[\s,]+/",$output_c3);
 $$outputc3=$output_c3;
 $$outputc2=$output_c2;
 $$outputc1=$output_c1;
 if ($country!=4)
 {
 $output="output_c".$country;
 $c=$$output;
 $ebitda=((int)$c[13]);
 }
 
if ($country==4) 
	{
	 $ebitda=((int)$output_c1[13]+(int)$output_c2[13]+(int)$output_c3[13]);
	}
	 //$ebitda=round($ebitda);
	if ($ebitda<0){$class="neg";$p1="(";$p2=")";$ebitda=abs($ebitda);} else {$class="pos";$p1="";$p2="";}
echo"<td class=".$class.">".$p1.number_format($ebitda).$p2."</td>";
}
// end get value


echo"</tr>";
echo"<tr><td> - ".$LANG['changeinrece']."</td>";
// get value for each team
$result = mysql_query("SELECT id,team_id FROM `output` where game_id='$id' and round='$rid' ".$final." order by team_id desc");
while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
// deduct last round value
//get receivable last round
$r=$rid-1;
if ($r>=0)
{
$result1 = mysql_query("SELECT output_c1,output_c2,output_c3 FROM output where game_id='$id' and round='$r' and team_id='$teamid' ".$final."");
$array = mysql_fetch_array($result1);
$co1=$array['output_c1'];	
$co1 = preg_split("/[\s,]+/",$co1);
$co2=$array['output_c2'];	
$co2 = preg_split("/[\s,]+/",$co2);
$co3=$array['output_c3'];	
$co3 = preg_split("/[\s,]+/",$co3);


//last round receivable and payable
$lastre1=(float)$co1[23];
//$lastpay1=(float)$co1[36];
$lastre2=(float)$co2[23];
//$lastpay2=(float)$co2[36];
$lastre3=(float)$co3[23];
//$lastpay3=(float)$co3[36];
$lastre4=$lastre1+$lastre2+$lastre3;
}
else
{
$lastre1=$lastre2=$lastre3=$lastre4=0;
}
//$totalpa=$lastpay3+$lastpay2+$lastpay1;
//echo $lastre1."/";
$lastre="lastre".$country;
$outputc1="output_c1".$teamid;
$outputc2="output_c2".$teamid;
$outputc3="output_c3".$teamid;
 $c1=$$outputc1;
 $c2=$$outputc2;
 $c3=$$outputc3;
 if ($country!=4)
 {
 $output="output_c".$country.$teamid;
 $c=$$output;
 $ebitda=(int)$c[23];
 //echo $c[3]."/".$receivabler."<br>";
 }

if ($country==4) 
	{
	 $ebitda=((int)$c1[23]+(int)$c2[23]+(int)$c3[23]);
	}
	//echo "newreveivable: ".$ebitda."oldpnewreveivable: ".$$lastre."<br>";
	$ebitda=$ebitda-$$lastre;
		//$ebitda=round($ebitda);
	//echo $$lastre."re";
	$rece="rece".$teamid;
	$$rece=$ebitda;
	if ($ebitda<0){$class="neg";$p1="(";$p2=")";$ebitda=abs($ebitda);} else {$class="pos";$p1="";$p2="";}
echo"<td class=".$class.">".$p1.number_format($ebitda).$p2."</td>";
}
// end get value
echo"</tr>"; 
echo"<tr><td> - ".$LANG['changeininve']."</td>";
// get value for each team
$result = mysql_query("SELECT id,team_id FROM `output` where game_id='$id' and round='$rid' ".$final." order by team_id desc");
while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$outputc1="output_c1".$teamid;
$outputc2="output_c2".$teamid;
$outputc3="output_c3".$teamid;
 $c1=$$outputc1;
 $c2=$$outputc2;
 $c3=$$outputc3;
 if ($country!=4)
 {
 $output="output_c".$country.$teamid;
 $c=$$output;
 $ebitda=(int)$c[22];
 
 }
 
$short="shortd".$country;
	// minus value of old inventory

				$r=$rid-1;
				if ($r>=0)
				{
				$result2 = mysql_query("SELECT output_c1,output_c2,output_c3 FROM `output` where game_id='$id' and team_id='$teamid' and round='$r' ".$final." ");
				$row2 = mysql_fetch_array($result2);
				$sharep2=$row2['output_c1'];	
				$sharep2= preg_split("/[\s,]+/",$sharep2);
				$shortd1=$sharep2[22];
				$sharep3=$row2['output_c2'];	
				$sharep2= preg_split("/[\s,]+/",$sharep3);
				$shortd2=$sharep3[22];
				$sharep4=$row2['output_c3'];	
				$sharep4= preg_split("/[\s,]+/",$sharep4);
				$shortd3=$sharep4[22];
				
				}
				else 
				{
				$shortd1=0;
				$shortd2=0;
				$shortd3=0;
				
				}
				
	if ($country==4) 
	{
	 $ebitda=(int)$c1[22]+(int)$c2[22]+(int)$c3[22];
	 $$short=$shortd1+$shortd2+$shortd3;
	}
	
	
	$ebitda=$ebitda-$$short;
		//$ebitda=round($ebitda);
	$inve="inve".$teamid;
	$$inve=$ebitda;

	if ($ebitda<0){$class="neg";$p1="(";$p2=")";$ebitda=abs($ebitda);} else {$class="pos";$p1="";$p2="";}
echo"<td class=".$class.">".$p1.number_format($ebitda).$p2."</td>";
}
// end get value
echo"</tr>"; 
echo"<tr><td> - ".$LANG['changeinpay']."</td>";
// get value for each team
$result = mysql_query("SELECT id,team_id FROM `output` where game_id='$id' and round='$rid' ".$final." order by team_id desc");
while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];

// deduct last round value
//get receivable last round
$r=$rid-1;
if ($r>=0)
{
$result1 = mysql_query("SELECT output_c1,output_c2,output_c3 FROM output where game_id='$id' and round='$r' and team_id='$teamid' ".$final."");
$array = mysql_fetch_array($result1);
$co1=$array['output_c1'];	
$co1 = preg_split("/[\s,]+/",$co1);
$co2=$array['output_c2'];	
$co2 = preg_split("/[\s,]+/",$co2);
$co3=$array['output_c3'];	
$co3 = preg_split("/[\s,]+/",$co3);


//last round receivable and payable
$lastre1=(float)$co1[37];
//$lastpay1=(float)$co1[37];
$lastre2=(float)$co2[37];
//$lastpay2=(float)$co2[37];
$lastre3=(float)$co3[37];
//$lastpay3=(float)$co3[37];
$lastre4=$lastre1+$lastre2+$lastre3;
}
else
{
$lastre1=$lastre2=$lastre3=$lastre4=0;
}
$lastre="lastre".$country;
$outputc1="output_c1".$teamid;
$outputc2="output_c2".$teamid;
$outputc3="output_c3".$teamid;
 $c1=$$outputc1;
 $c2=$$outputc2;
 $c3=$$outputc3;
 if ($country!=4)
 {
 $output="output_c".$country.$teamid;
 $c=$$output;
 $ebitda=(int)$c[37];
 }
 
if ($country==4) 
	{
	 $ebitda=((int)$c1[37]+(int)$c2[37]+(int)$c3[37]);
	}
	//echo "newpayalbe: ".$ebitda."oldpayable: ".$$lastre."<br>";
	$ebitda=$ebitda-$$lastre;
	
	//echo $$lastre."payu";
	$pay="payable".$teamid;
		//$ebitda=round($ebitda);
	$$pay=$ebitda;
	
	if ($ebitda<0){$class="neg";$p1="(";$p2=")";$ebitda=abs($ebitda);} else {$class="pos";$p1="";$p2="";}
echo"<td class=".$class.">".$p1.number_format($ebitda).$p2."</td>";
}
// end get value
echo"</tr>"; 
echo"<tr><td> - ".$LANG['netfinance']."</td >"; 
// get value for each team
$result = mysql_query("SELECT id,team_id FROM `output` where game_id='$id' and round='$rid' ".$final." order by team_id desc");
while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$outputc1="output_c1".$teamid;
$outputc2="output_c2".$teamid;
$outputc3="output_c3".$teamid;
 $c1=$$outputc1;
 $c2=$$outputc2;
 $c3=$$outputc3;
 if ($country!=4)
 {
 $output="output_c".$country.$teamid;
 $c=$$output;
 $ebitda=(int)$c[16];
 }
 
if ($country==4) 
	{
	 $ebitda=(int)$c1[16]+(int)$c2[16]+(int)$c3[16];
	}
	//$ebitda=round($ebitda);
	if ($ebitda<0){$class="neg";$p1="(";$p2=")";$ebitda=abs($ebitda);} else {$class="pos";$p1="";$p2="";}
echo"<td class=".$class.">".$p1.number_format($ebitda).$p2."</td>";
}
// end get value
echo"</tr>"; 
echo"<tr><td> - ".$LANG['incometax']."</td>"; 
// get value for each team
$result = mysql_query("SELECT id,team_id FROM `output` where game_id='$id' and round='$rid' ".$final." order by team_id desc");
while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$outputc1="output_c1".$teamid;
$outputc2="output_c2".$teamid;
$outputc3="output_c3".$teamid;
 $c1=$$outputc1;
 $c2=$$outputc2;
 $c3=$$outputc3;
 if ($country!=4)
 {
 $output="output_c".$country.$teamid;
 $c=$$output;
 $ebitda=(int)$c[18];
 }
 
if ($country==4) 
	{
	 $ebitda=(int)$c1[18]+(int)$c2[18]+(int)$c3[18];
	}
	//$ebitda=round($ebitda);
	if ($ebitda<0){$class="neg";$p1="(";$p2=")";$ebitda=abs($ebitda);} else {$class="pos";$p1="";$p2="";}
echo"<td class=".$class.">".$p1.number_format($ebitda).$p2."</td>";
}
// end get value
echo"</tr>";
echo"<tr><td class=result2>".$LANG['total']."</td>"; 
// get value for each team
$result = mysql_query("SELECT id,team_id FROM `output` where game_id='$id' and round='$rid' ".$final." order by team_id desc");
while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$outputc1="output_c1".$teamid;
$outputc2="output_c2".$teamid;
$outputc3="output_c3".$teamid;
 $c1=$$outputc1;
 $c2=$$outputc2;
 $c3=$$outputc3;
 $rece="rece".$teamid;
$pay="payable".$teamid;
$inve="inve".$teamid;
 if ($country!=4)
 {
 $output="output_c".$country.$teamid;
 $c=$$output;
 //$ebitda=(int)$c[13]-$$rece+$$pay-(int)$c[16]-(int)$c[18]-$$inve;
 $ebitda=((int)$c[13]-(int)$c[16]-(int)$c[18]-$$inve-$$rece+$$pay);
 //echo $c[13]."/-".$$rece."/-".$c[22]."/+"."[".$$pay."]"."/-".$c[16]."/-".$c[18]."/-".$$inve;
 }
 
if ($country==4) 
	{
	 $ebitda1=(int)$c1[13]-(int)$c1[16]-(int)$c1[18];
	  $ebitda2=(int)$c2[13]-(int)$c2[16]-(int)$c2[18];
	   $ebitda3=(int)$c3[13]-(int)$c3[16]-(int)$c3[18];
	$ebitda=($ebitda1+$ebitda2+$ebitda3-$$inve-$$rece+$$pay);
	}
	//$ebitda=(int)$ebitda;
	$ebitda=round($ebitda);
$total1="total1".$teamid;
$$total1=$ebitda;	
	if ($ebitda<0){$class="neg0";$p1="(";$p2=")";$ebitda=abs($ebitda);} else {$class="pos0";$p1="";$p2="";}
echo"<td class=".$class.">".$p1.number_format(($ebitda)).$p2."</td>";
}
// end get value
echo"</tr>";
echo"<tr><td colspan=5 class=result2>".$LANG['cashbyinvestment']."</td></tr>";
echo"<tr><td> - ".$LANG['plantinvest']."</td>";
// get value for each team
$result = mysql_query("SELECT id,team_id FROM `output` where game_id='$id' and round='$rid'  ".$final." order by team_id desc");
while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$result2 = mysql_query("SELECT investment_c2,investment_c1 FROM `input` where game_id='$id' and round='$rid' and team_decision='1' and team_id='$teamid'");
$row2 = mysql_fetch_array($result2);
	$r=$rid-1;
	if ($r<0) {$r=0;}
   $result1 = mysql_query("SELECT country1 FROM round_assumption where game_id='$id' and round=$r");
   $array = mysql_fetch_array($result1);
   $cost_per_plant=$array['country1'];	
   $cost_per_plant= preg_split("/[\s,]+/",$cost_per_plant);
   $cost_plant=$cost_per_plant[22]*1000000;
 
 				$invest1=$row2['investment_c1']; 
				//echo $invest1;
				$invest1= preg_split("/[\s,]+/",$invest1);
				$invest2=$row2['investment_c2']; 
				$invest2= preg_split("/[\s,]+/",$invest2);
				//echo $invest1[0];
				//$plant_next_round1=$invest1[1];
				//$plant_next_round2=$invest2[1];
				//if ($round-$time)
				$c2_plant=$invest2[0];
				$cost2=$c2_plant*$cost_plant;
				$c1_plant=$invest1[0];
				$cost1=$c1_plant*$cost_plant;
				//echo $cost_plant;
if ($country==1) {$value=$cost1;}
if ($country==2) {$value=$cost2;}
if ($country==3) {$value=0;}
if ($country==4) {$value=$cost1+$cost2;}
$value2="value".$teamid;
$$value2=$value;
	if ($value<0){$class="neg";} else {$class="pos";}			
echo"<td class=".$class.">".number_format($value)."</td>";
}
// end get value
echo"</tr>";
echo"<tr><td class=result2>".$LANG['cashflowbeforefinance']."</td>";
 // get value for each team
$result = mysql_query("SELECT id,team_id FROM `output` where game_id='$id' and round='$rid'  ".$final." order by team_id desc");
while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];

 $value2="value".$teamid;
 $total1="total1".$teamid;
	$ebitda=$$total1-$$value2;
	$total2="total2".$teamid;
	$$total2=$ebitda;
	if ($ebitda<0){$class="neg0";$p1="(";$p2=")";$ebitda=abs($ebitda);} else {$class="pos0";$p1="";$p2="";}
echo"<td class=".$class.">".$p1.number_format($ebitda).$p2."</td>";
}
// end get value
echo"</tr>";
echo"<tr><td colspan=5 class=result2>".$LANG['cashflowbyfinance']."</td></tr>";
echo"<tr><td> - ".$LANG['dividendspayment']."</td>"; 
// get value for each team
$result = mysql_query("SELECT id,team_id,output_c1 FROM `output` where game_id='$id' and round='$rid'  ".$final." order by team_id desc");
while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];

				//get share price/outstanding
				$sharep=$row['output_c1'];	
				
				$sharep= preg_split("/[\s,]+/",$sharep);
				//$shareprice=$sharep[42];
				
				$shareout=$sharep[42];
				//echo $shareout.$teamid."/<br>";
				//$sharecap=$sharep[28];
				//$retaine1=$sharep[32];
						//echo $shareout."/";
  				$dnp1 = mysql_query("SELECT fin_dividends, fin_shareissue FROM `input` where game_id='$id' and team_id='$teamid' and team_decision='1' and round='$rid'");
				$rw1 = mysql_fetch_array($dnp1);				
 				$dividends=$rw1['fin_dividends'];
				//$shareissue=$rw1['fin_shareissue']*1000;
					
							
 //$sharebb=$shareissue*$shareprice;
 $div_payment1=-$dividends/100*$sharefv*$shareout;
 if ($country==1)
 {
 $ebitda=$div_payment1;
 }
 else
 {
 $ebitda=0;
 }
 $div="div".$teamid;
 $$div=$ebitda;
	if ($ebitda<0){$class="neg";$p1="(";$p2=")";$ebitda=abs($ebitda);} else {$class="pos";$p1="";$p2="";}
echo"<td class=".$class.">".$p1.number_format($ebitda).$p2."</td>";
}
// end get value
echo"</tr>";
echo"<tr><td> - ".$LANG['equityissue']."</td>"; 
// get value for each team

$result = mysql_query("SELECT id,team_id,output_c1 FROM `output` where game_id='$id' and round='$rid' ".$final." order by team_id desc");
while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];

				//get share price/outstanding
				$sharep=$row['output_c1'];	
				$sharep= preg_split("/[\s,]+/",$sharep);
				//$shareprice=$sharep[42];
				//$shareout=$sharep[41];
				//$sharecap=$sharep[28];
				//$retaine1=$sharep[32];
				
				$r=$rid-1;
				if ($r<0) {$r=0;};
				
				$result2 = mysql_query("SELECT output_c1 FROM `output` where game_id='$id' and team_id='$teamid' and round='$r' ".$final."");
				$row2 = mysql_fetch_array($result2);
				$sharep2=$row2['output_c1'];	
				$sharep2= preg_split("/[\s,]+/",$sharep2);
				$shareprice=$sharep2[43];
				//echo $shareprice;
				
  				$dnp1 = mysql_query("SELECT fin_dividends, fin_shareissue FROM `input` where game_id='$id' and team_id='$teamid' and team_decision='1' and round='$rid'");
				$rw1 = mysql_fetch_array($dnp1);				
 				//$dividends=$rw1['fin_dividends'];
				$shareissue=$rw1['fin_shareissue']*1000;
					//echo $shareissue."*&^";
							
 $sharebb=$shareissue*$shareprice;
 //$div_payment1=$dividends/100*$shareprice*$shareout;
 
	
	$equity="equity".$teamid;
	if ($country==1)
	{
	$ebitda=$sharebb;
	}
	else 
	{
	$ebitda=0;
	}
	$$equity=$ebitda;
	if ($ebitda<0){$class="neg";$p1="(";$p2=")";$ebitda=abs($ebitda);} else {$class="pos";$p1="";$p2="";}
echo"<td class=".$class.">".$p1.number_format($ebitda).$p2."</td>";
}
// end get value
echo"</tr>";
echo"<tr><td> - ".$LANG['changeinlongdebt']."</td>"; 
// get value for each team
$result1 = mysql_query("SELECT id,team_id,output_c1 FROM `output` where game_id='$id' and round='$rid' ".$final." order by team_id desc");
while ($row1 = mysql_fetch_array($result1))
{
$teamid=$row1['team_id'];

$result = mysql_query("SELECT team_id,fin_longterm_debt FROM `input` where game_id='$id' and round='$rid' and team_decision='1' and team_id='$teamid'");
while ($row = mysql_fetch_array($result))
{
//$teamid=$row['team_id'];
if ($country==1)
{
$ebitda=$row['fin_longterm_debt']*1000;
}
else 
{
$ebitda=0;
}
	$long="longdebt".$teamid;
	$$long=$ebitda;
echo"<td class=".$class.">".number_format($ebitda)."</td>";
}
// end get value
}
echo"</tr>";
echo"<tr><td> - ".$LANG['changeinshortdebt']."</td>";
// get value for each team
$result = mysql_query("SELECT id,team_id FROM `output` where game_id='$id' and round='$rid' ".$final." order by team_id desc");
while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$outputc1="output_c1".$teamid;
$outputc2="output_c2".$teamid;
$outputc3="output_c3".$teamid;
 $c1=$$outputc1;
 $c2=$$outputc2;
 $c3=$$outputc3;
 if ($country!=4)
 {
 $output="output_c".$country.$teamid;
 $c=$$output;
 $ebitda=(int)$c[35];
 }
 
if ($country==4) 
	{
	 $ebitda=(int)$c1[35]+(int)$c2[35]+(int)$c3[35];
	}
// minus value of old shortdebt

				$r=$rid-1;
				if ($r>=0)
				{
				$result2 = mysql_query("SELECT output_c1,output_c2,output_c3 FROM `output` where game_id='$id' and team_id='$teamid' and round='$r' ".$final."");
				$row2 = mysql_fetch_array($result2);
				$sharep2=$row2['output_c1'];	
				$sharep2= preg_split("/[\s,]+/",$sharep2);
				$shortd1=$sharep2[35];
				$sharep3=$row2['output_c2'];	
				$sharep3= preg_split("/[\s,]+/",$sharep3);
				$shortd2=$sharep3[35];
				$sharep4=$row2['output_c3'];	
				$sharep4= preg_split("/[\s,]+/",$sharep4);
				$shortd3=$sharep4[35];
				$shortd4=$shortd1+$shortd2+$shortd3;
				}
				else 
				{
				$shortd1=$shortd2=$shortd3=$shortd4=0;
				}
	$shortd="shortd".$country;			
	$ebitda=$ebitda-$$shortd;
	$short="shortdebt".$teamid;
	$$short=$ebitda;
	if ($ebitda<0){$class="neg";$p1="(";$p2=")";$ebitda=abs($ebitda);} else {$class="pos";$p1="";$p2="";}
echo"<td class=".$class.">".$p1.number_format($ebitda).$p2."</td>";
}
// end get value
echo"</tr>"; 
echo"<tr><td> - ".$LANG['changeininternal']."</td>"; 
// get value for each team
$result = mysql_query("SELECT id,team_id FROM `output` where game_id='$id' and round='$rid' ".$final." order by team_id desc");
while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
//$dnp1 = mysql_query("SELECT fin_internal_loan_c1_c2,fin_internal_loan_c1_c3,fin_internal_loan_c3_c1,fin_internal_loan_c2_c1 FROM `input` where game_id='$id' and team_id='$teamid' and team_decision='1' and round='$rid'");
//				$rw = mysql_fetch_array($dnp1);				
//				$internalloan12=$rw['fin_internal_loan_c1_c2']*1000000;
//				$internalloan13=$rw['fin_internal_loan_c1_c3']*1000000;
//				$internalloan31=$rw['fin_internal_loan_c3_c1']*1000000;
//				$internalloan21=$rw['fin_internal_loan_c2_c1']*1000000;
//	if ($country==1) {$ebitda1=$internalloan31+$internalloan21;}		
//	if ($country==2) {$ebitda1=$internalloan12;}	
//	if ($country==3) {$ebitda1=$internalloan13;}	
//	if ($country==4) {$ebitda1=$internalloan13+$internalloan12+$internalloan31+$internalloan21;}
//	if ($ebitda1<0){$class="neg";} else {$class="pos";}
$outputc1="output_c1".$teamid;
$outputc2="output_c2".$teamid;
$outputc3="output_c3".$teamid;
 $c1=$$outputc1;
 $c2=$$outputc2;
 $c3=$$outputc3;
 if ($country!=4)
 {
 $output="output_c".$country.$teamid;
 $c=$$output;
 $ebitda=(int)$c[36];
 }
 
if ($country==4) 
	{
	 $ebitda=(int)$c1[36]+(int)$c2[36]+(int)$c3[36];
	}
	$internal="inloan".$teamid;
	$$internal=$ebitda;
	if ($ebitda<0){$class="neg";$p1="(";$p2=")";$ebitda=abs($ebitda);} else {$class="pos";$p1="";$p2="";}
echo"<td class=".$class.">".$p1.number_format($ebitda).$p2."</td>";
}
// end get value
echo"</tr>";
echo"<tr><td class=result2>".$LANG['total']."</td>"; 
// get value for each team
$result = mysql_query("SELECT id,team_id FROM `output` where game_id='$id' and round='$rid' ".$final." order by team_id desc");
while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$internal="inloan".$teamid;
$short="shortdebt".$teamid;
$long="longdebt".$teamid;
$equity="equity".$teamid;
 $div="div".$teamid;
 
 $ebitda=$$internal+$$short+$$long+$$equity+$$div;
 $total3="total3".$teamid;
 $$total3=$ebitda;
	if ($ebitda<0){$class="neg0";$p1="(";$p2=")";$ebitda=abs($ebitda);} else {$class="pos0";$p1="";$p2="";}
echo"<td class=".$class.">".$p1.number_format($ebitda).$p2."</td>";
}
// end get value
echo"</tr>";
echo"<tr><td> - ".$LANG['changeincash']."</td>"; 
// get value for each team
$result = mysql_query("SELECT id,team_id FROM `output` where game_id='$id' and round='$rid' ".$final." order by team_id desc");
while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$total2="total2".$teamid;
$total3="total3".$teamid;
$ebitda=$$total2+$$total3;
$change="changecash".$teamid;
$ebitda=($ebitda);
$$change=$ebitda;
	if ($ebitda<0){$class="neg";} else {$class="pos";}
echo"<td class=".$class.">".number_format($ebitda)."</td>";
}
// end get value
echo"</tr>";
echo"<tr><td> - ".$LANG['cashbegining']."</td>"; 
// get value for each team
$r=$rid-1;
// get practice round
$game = mysql_query("SELECT practice_round FROM `game` where id='$gid'");
$hpr = mysql_fetch_array($game);
$pround=$hpr['practice_round'];
//echo $rid;

if ($r==$pround) {$r=0;} 
if ($r>=0)
{
$result = mysql_query("SELECT id,team_id,output_c1,output_c2,output_c3 FROM `output` where game_id='$id' and round='$r' ".$final." order by team_id desc");
while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
 $output_c1=$row['output_c1'];
 $output_c2=$row['output_c2'];
 $output_c3=$row['output_c3'];
 $outputc1="output_c1".$teamid;
 $outputc2="output_c2".$teamid;
 $outputc3="output_c3".$teamid;
 $output_c1 = preg_split("/[\s,]+/",$output_c1);
 $output_c2 = preg_split("/[\s,]+/",$output_c2);
 $output_c3 = preg_split("/[\s,]+/",$output_c3);
 
 if ($country!=4)
 {
 $output="output_c".$country;
 $c=$$output;
 $ebitda=(int)$c[24];

 }
 
if ($country==4) 
	{
	 $ebitda=(int)$output_c1[24]+(int)$output_c2[24]+(int)$output_c3[24];
	}
	if ($ebitda<0){$class="neg";} else {$class="pos";}
$cash="cash1".$teamid;
$ebitda=$ebitda;
$$cash=$ebitda;
	if ($ebitda<0){$class="neg";$p1="(";$p2=")";$ebitda=abs($ebitda);} else {$class="pos";$p1="";$p2="";}
echo"<td class=".$class.">".$p1.number_format($ebitda).$p2."</td>";
}
}
else
{
$result = mysql_query("SELECT id,team_id,output_c1,output_c2,output_c3 FROM `output` where game_id='$id' and round='0' ".$final." order by team_id desc");
while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$ebitda=0;
$cash="cash1".$teamid;
$$cash=$ebitda;
	if ($ebitda<0){$class="neg";$p1="(";$p2=")";$ebitda=abs($ebitda);} else {$class="pos";$p1="";$p2="";}
echo"<td class=".$class.">".$p1.number_format($ebitda).$p2."</td>";}
}
// end get value
echo"</tr>";
echo"<tr><td> - ".$LANG['cashattheend']."</td>"; 
// get value for each team
$result = mysql_query("SELECT id,team_id,output_c1,output_c2,output_c3 FROM `output` where game_id='$id' and round='$rid' ".$final." order by team_id desc");
while ($row = mysql_fetch_array($result))
{
$teamid=$row['team_id'];
$cash="cash1".$teamid;
$change="changecash".$teamid;
$ebitda=$$cash+$$change;
	if ($ebitda<0){$class="neg";$p1="(";$p2=")";$ebitda=abs($ebitda);} else {$class="pos";$p1="";$p2="";}
echo"<td class=".$class.">".$p1.number_format($ebitda).$p2."</td>";
}
// end get value
echo"</tr>";
// end print
 } echo "</table>";
 // ----------------------------------------------------End team comparision table BS
 
 
 
	echo"</div>";
 // for other result
 //get sustainability
 
  	echo"<div class='simpleTabsContent'>";
// for round	   

	echo"<table cellpadding='0' cellspacing='0' class=clear>";
	echo"<tr class=clear>";
	
	echo"<td class=clear>";
//round
	if(!isset($_POST['rid']))
{$rid=0;}else{$rid=$_POST['rid'];}  
// get practice round
	$game = mysql_query("SELECT practice_round FROM `game` where id='$id'");
	$hpr = mysql_fetch_array($game);
	$pround=$hpr['practice_round'];

	if($_SESSION['mod']==1 or $_SESSION['admin']==1 )
{
	$result1 = mysql_query("SELECT distinct(round) as round FROM `output`  where game_id='$id'");
}
else
{
$result1 = mysql_query("SELECT distinct(round) as round FROM `output`  where game_id=$id and final='1'");
}
	
	echo"<form action='game.php?act=result&id=".$id."' class=demo method='POST'>";
    echo"<select class=black  name=rid onchange='this.form.submit()'>";

	while ($row1 = mysql_fetch_array($result1))
{
	$row1=$row1['round'];
    //echo $row1;
	if ($pround>=$row1) {$pt=$LANG['practice'];} else {$pt="";}
	if ($row1==$rid) {$s="selected";} else {$s="";}
	echo"<option ".$s." value=".$row1."> ".$pt." ".$LANG['Round']." ".$row1."</option>";
}
	echo"</select></form>";
  
 //end  
 
	echo"</td>";
	echo"<td class=clear>";

	echo"</td>";
	
	echo"<td class=clear>";

	echo"</td>";
	
	echo"<td class=clear>";

	echo"</td>";
	
	echo"<td class=clear>";

	echo"</td>";
	
	
	echo"</tr>";
	echo"</table>";
	

echo"<h4>".$LANG['ethicsandsus']."</h4>";	

$result = mysql_query("SELECT team_id,output_c1,output_c2,output_c3,round FROM `output` where game_id='$id' and round='$rid' ".$final." order by team_id desc");
//echo "<br><table>"; 
//echo "<th>ID</th><th>Team Name</th><th>Round</th><th>Revenue</th><th>Cost</th><th>Profit after tax</th><th>Action</th>";
$maxsus=0;
$sumsus=0;
$sumcapp=0;
$sumcapo=0;
$x=0;
while ($row2 = mysql_fetch_array($result))
{
++$x;
 $tid=$row2['team_id'];
				$res = mysql_query("SELECT country1, country2 FROM input WHERE game_id='$id' and team_id='$tid' and round='$rid' and team_decision='1' ");
					$row = mysql_fetch_array($res);
					$ct1=$row['country1'];
					$c1=base64_decode($ct1);
					$c11=unserialize($c1);

					$ct2=$row['country2'];
					$c2=base64_decode($ct2);
					$c22=unserialize($c2);
					
 					$p_11=$c11['production1'];
					
					//echo $p_11."<br>";
					$p_12=$c11['production2'];
					$o_11=$c11['outsource1'];
					$o_12=$c11['outsource2'];
					$p_11 = preg_split("/[\s,]+/",$p_11);
					$p_12 = preg_split("/[\s,]+/",$p_12);
					$o_11 = preg_split("/[\s,]+/",$o_11);
					$o_12 = preg_split("/[\s,]+/",$o_12);
					
					$p_21=$c22['production1'];
					$p_22=$c22['production2'];
					$o_21=$c22['outsource1'];
					$o_22=$c22['outsource2'];
					//echo $o_22;
					$p_21 = preg_split("/[\s,]+/",$p_21);
					$p_22 = preg_split("/[\s,]+/",$p_22);
					$o_21 = preg_split("/[\s,]+/",$o_21);
					$o_22 = preg_split("/[\s,]+/",$o_22);
					$supp1=$p_11[3];
					$supp2=$p_21[3];
					
					$capp11=$p_11[1];
					$capp12=$p_12[1];
					$capp21=$p_21[1];
					$capp22=$p_22[1];
					
					$capo="capo".$tid;
					$capp="capp".$tid;
					$x=4;
					if ($capp11==0) {$x=$x-1;}
					if ($capp12==0) {$x=$x-1;}
					if ($capp21==0) {$x=$x-1;}
					if ($capp22==0) {$x=$x-1;}
					$$capp=($capp11+$capp12+$capp21+$capp22)/$x;
					//echo $$capp."/";
					$y=4;
					$capo11=$o_11[1];
					$capo12=$o_12[1];
					$capo21=$o_21[1];
					$capo22=$o_22[1];
					if ($capo11==0) {$y=$y-1;}
					if ($capo12==0) {$y=$y-1;}
					if ($capo21==0) {$y=$y-1;}
					if ($capo22==0) {$y=$y-1;}
				if ($y!=0) {	$$capo=($capo11+$capo12+$capo21+$capo22)/$y; } else {$$capo=0;}
					
$sumcapp=$sumcapp+$$capp;
$sumcapo=$sumcapo+$$capo;

					$sustain="sustain".$tid;
					$$sustain=($supp1+$supp2)/2;
					//echo $supp1."/".$supp2;
					if ($maxsus<$$sustain) {$maxsus=$$sustain;}
					$sumsus=$sumsus+$$sustain;
					
}

	echo "<table>";
	echo"<th width=35%>".$LANG['TEAM']."</th><th width=10%>".$LANG['rating']."</th><th>".$LANG['marketavg']."</th><th width=40%>".$LANG['sustainability']."</th>";
//$result = mysql_query("SELECT count(id) as x FROM `output` where game_id='$id' and round='$rid' and final='1'");
//$row = mysql_fetch_array($result);
//$x=$row['x'];
//echo $x;
	
$result = mysql_query("SELECT team_id,output_c1,output_c2,output_c3,round FROM `output` where game_id='$id' and round='$rid' ".$final." order by team_id desc");
while ($row = mysql_fetch_array($result))
{
 $tid=$row['team_id'];
  $result2 = mysql_query("SELECT name FROM `team` where id='$tid'");
 $row2 = mysql_fetch_array($result2);
 $name=$row2['name'];
 $sustain="sustain".$tid;

 if ($x==0) {$k=0;} else {$k=$sumsus/$x;}
 echo"<tr><td>".$name."</td><td class=result>".number_format($$sustain,2)."</td><td class=right>".number_format($k,2)."</td>";
 if ($$sustain!=0) {$point=$$sustain/$maxsus*100;} else {$point=0;}
 echo"<td><dl class='rate' style='width:99%'><dd class='new' style='width:".$point."%'></dd></dl></td>";
 echo"</tr>";
}
	echo "</table>";
	
	
	
	
	echo"<br><h4>".$LANG['hrturn']."</h4>";

	echo "<table>";
	echo"<th width=35%>".$LANG['TEAM']."</th><th width=10%>".$LANG['rating']."</th><th>".$LANG['marketavg']."</th><th width=40%>".$LANG['turnoverrate']."</th>";
$result = mysql_query("SELECT avg(hr_turnover) as avgt, max(hr_turnover) as maxt FROM `output` where game_id='$id' and round='$rid' ".$final."");
$row = mysql_fetch_array($result);
$avgt=$row['avgt'];
$maxt=$row['maxt'];
$result = mysql_query("SELECT team_id,hr_turnover FROM `output` where game_id='$id' and round='$rid' ".$final." order by team_id desc");
while ($row = mysql_fetch_array($result))
{

 $tid=$row['team_id'];
 $result2 = mysql_query("SELECT name FROM `team` where id='$tid'");
 $row2 = mysql_fetch_array($result2);
 $name=$row2['name'];
 $turnover=$row['hr_turnover'];
 
 echo"<tr><td>".$name."</td><td class=result>".number_format($turnover,2)."%</td><td class=right>".number_format($avgt,2)."%</td>";
 if ($turnover>100) {$turnover=100;}
 echo"<td><dl class='rate' style='width:99%'><dd class='new' style='width:".($turnover/$maxt*100)."%'></dd></dl></td>";
 echo"</tr>";
}
	echo "</table>";	
	
	
	
	echo"<br><h4>".$LANG['hreff']."</h4>";
	echo "<table>";
	echo"<th width=35%>".$LANG['TEAM']."</th><th width=10%>".$LANG['rating']."</th><th>".$LANG['marketavg']."</th><th width=40%>".$LANG['effrate']."</th>";
$result = mysql_query("SELECT max(hr_efficiency_rate) as maxeff, avg(hr_efficiency_rate) as avgeff FROM `output` where game_id='$id' and round='$rid' ".$final."");
$row = mysql_fetch_array($result);
$maxeff=$row['maxeff'];
  $avgeff=$row['avgeff'];
  $x=0;
$result = mysql_query("SELECT team_id,hr_efficiency_rate FROM `output` where game_id='$id' and round='$rid' ".$final." order by team_id desc");
while ($row = mysql_fetch_array($result))
{

 $tid=$row['team_id'];
 $result2 = mysql_query("SELECT name FROM `team` where id='$tid'");
 $row2 = mysql_fetch_array($result2);
 $name=$row2['name'];
 $turnover=$row['hr_efficiency_rate'];

 
 echo"<tr><td>".$name."</td><td class=result>".number_format($turnover,2)."</td><td class=right>".number_format($avgeff,2)."</td>";
if ($maxeff!=0) {$point=$turnover/$maxeff*100;} else {$point=0;}
 echo"<td><dl class='rate' style='width:99%'><dd class='new' style='width:".($point)."%'></dd></dl></td>";
 echo"</tr>";
 ++$x;
}
	echo "</table>";	

	
	
	
		echo"<br><h4>".$LANG['inhouseallocate']."</h4>";
		echo "<table>";
	echo"<th width=35%>".$LANG['TEAM']."</th><th width=10%>".$LANG['rating']."</th><th>".$LANG['marketavg']."</th><th width=40%>".$LANG['cap']."</th>";

$result = mysql_query("SELECT team_id,output_c1,output_c2,output_c3,round FROM `output` where game_id='$id' and round='$rid' ".$final." order by team_id desc");
while ($row = mysql_fetch_array($result))
{
 $tid=$row['team_id'];
  $result2 = mysql_query("SELECT name FROM `team` where id='$tid'");
 $row2 = mysql_fetch_array($result2);
 $name=$row2['name'];

 					//$capo="capo".$tid;
					$capp="capp".$tid;
					

// if ($x==0) {$k=0;} else {$k=$sumsus/$x;}

 echo"<tr><td>".$name."</td><td  class=result> ".number_format($$capp,2)." %</td><td class=right> ".number_format($sumcapp/$x,2)."%</td>";
 
 echo"<td><dl class='rate' style='width:99%'><dd class='new' style='width:".$$capp."%'></dd></dl></td>";
 echo"</tr>";
}
	echo "</table>";
	

		echo"<br><h4>".$LANG['outsourceallocate']."</h4>";
		echo "<table>";
	echo"<th width=35%>".$LANG['TEAM']."</th><th width=10%>".$LANG['rating']."</th><th>".$LANG['marketavg']."</th><th width=40%>".$LANG['cap']."</th>";

$result = mysql_query("SELECT team_id,output_c1,output_c2,output_c3,round FROM `output` where game_id='$id' and round='$rid' ".$final." order by team_id desc");
while ($row = mysql_fetch_array($result))
{
 $tid=$row['team_id'];
  $result2 = mysql_query("SELECT name FROM `team` where id='$tid'");
 $row2 = mysql_fetch_array($result2);
 $name=$row2['name'];

 					//$capo="capo".$tid;
					$capp="capo".$tid;
					

// if ($x==0) {$k=0;} else {$k=$sumsus/$x;}
 echo"<tr><td>".$name."</td><td class=result> ".number_format($$capp,2)." %</td><td class=right> ".number_format($sumcapo/$x,2)."%</td>";
 
 echo"<td><dl class='rate' style='width:99%'><dd class='new' style='width:".$$capp."%'></dd></dl></td>";
 echo"</tr>";
}
	echo "</table>";

	
	echo"</div>";
 
 // end tab div
 echo"</div>";
 
 }
 
 

 
 // result table2
 
 
 
 
 
  
 
 
 
 
 
 

// Present dropdown list round
   if( $_GET['act']=='resultr' and isset($_GET['rid']) )
   {
   
 //---------------- check who is
 if ($_SESSION['player']==1)
 {
  $tid=$_SESSION['team_id'] ;
 }
 else
 {
 if(isset($_GET['tid']))
{
$tid=$_GET['tid'];
//check if this game is belong to mod
}
else 
{
 header ("Location:game.php?act=game");
}
 }
 //----------- end check who is
   $rid=$_GET['rid'];
   $result1 = mysql_query("SELECT game_id FROM team where id='$tid'");
   $array = mysql_fetch_array($result1);
   $gid=$array['game_id'];	
   
    echo"<form action='game.php?act=result&tid=".$tid."' class=demo method='POST'>";
    echo"<nosrcipt><input class=submit type=submit value='Result' /></noscript><select class=black  name=rid onchange='this.form.submit()'>";
	$result = mysql_query("SELECT DISTINCT round FROM `output` where team_id=$tid and game_id='$gid' and final='1'");
	
	if($result === FALSE) {   die(mysql_error()); }
	
	while ($row = mysql_fetch_array($result))
	{
	$round=$row['round'];	

	echo"<option value=".$round.">Round ".$round."</option>";

	}	
	echo"</select></form>";
   }
 //end   
 
 //Present round result
   if( $_GET['act']=='resultr' and  isset($_GET['rid']))
  {


//---------------- check who is
 if ($_SESSION['player']==1)
 {
  $id=$_SESSION['team_id'] ;
 }
 else
 {
 if(isset($_GET['tid']))
{
$id=$_GET['tid'];
//check if this game is belong to mod
}
else 
{
 header ("Location:game.php?act=game");
}
 }
 //----------- end check who is
 

if(isset($_POST['round'])){$round=($_POST['round']);} else {$round=$_GET['rid']; }

// start PNL

$result = mysql_query("SELECT * FROM `output` where team_id='$id' and round='$round' and final='1'");
if($result === FALSE) {
    die(mysql_error()); // TODO: better error handling
}
echo "<br><table class=result>"; 
echo "<th>".$LANG['pnl']."</th><th>".$LANG['4']."</th><th>".$LANG['1']."</th><th>".$LANG['2']."</th><th>".$LANG['3']."</th>";

$comma=explode(",",$title_pnl);
$no_titles=count($comma);
$no_titles=$no_titles-1;
//echo $no_titles;
$title = preg_split("/[,]+/",$title_pnl);

while ($row = mysql_fetch_array($result))
{
 // Get date from string
 $output_c1=$row['output_c1'];
 $output_c2=$row['output_c2'];
 $output_c3=$row['output_c3'];
 $output_c1 = preg_split("/[\s,]+/",$output_c1);
 $output_c2 = preg_split("/[\s,]+/",$output_c2);
 $output_c3 = preg_split("/[\s,]+/",$output_c3);
$y=0;
 for ($x=0; $x<=$no_titles; $x++) 
{

$o1=$output_c1[$x];
$o1=(int)$o1;
$o2=$output_c2[$x];
$o2=(int)$o2;
$o3=$output_c3[$x];
$o3=(int)$o3;
$global=$o1+$o2+$o3;

if($o1<0){$class1="neg";} else{$class1="pos";$o1=number_format($o1);}
if($o2<0){$class2="neg";} else{$class2="pos";$o2=number_format($o2);}
if($o3<0){$class3="neg";} else{$class3="pos";$o3=number_format($o3);}
if($global<0){$class0="neg";} else{$class0="pos";$global=number_format($global);}

if ($x==0 or $x==4)
{
echo "<tr><td class='result'>".$title[$y]."</td><td class='result' colspan=4></td></tr>";		
}
else
{
if($x==3 or $x==12 or $x==13 or $x==15 or $x==17 or $x==19)
{
if($o1<0){$class1="neg0";$o1="(".number_format(abs($o1)).")";} else{$class1="pos0";}
if($o2<0){$class2="neg0";$o2="(".number_format(abs($o2)).")";} else{$class2="pos0";}
if($o3<0){$class3="neg0";$o3="(".number_format(abs($o3)).")";} else{$class3="pos0";}
if($global<0){$class0="neg0";$global="(".number_format(abs($global)).")";} else{$class0="pos0";}
$class_title="result2";
} else {
if($o1<0){$class1="neg";$o1="(".number_format(abs($o1)).")";} else{$class1="pos";}
if($o2<0){$class2="neg";$o2="(".number_format(abs($o2)).")";} else{$class2="pos";}
if($o3<0){$class3="neg";$o3="(".number_format(abs($o3)).")";} else{$class3="pos";}
if($global<0){$class0="neg";$global="(".number_format(abs($global)).")";} else{$class0="pos";}
$class="";
$class_title="";
}
echo "<tr class=".$class."><td class=".$class_title.">".$title[$y]."</td><td class=".$class0.">".$global."</td><td class=".$class1.">".$o1."</td><td class=".$class2.">".$o2."</td><td class=".$class3.">".$o3."</td></tr>";		
}
++$y;
$global="";
$o1="";
$o2="";
$o3="";
 }
 }

echo "</table>";
// end pnl
// start BS


$result = mysql_query("SELECT * FROM `output` where team_id='$id' and round='$round' and final='1'");
if($result === FALSE) {
    die(mysql_error()); // TODO: better error handling
}
echo "<br><table class=result>"; 
echo "<th>".$LANG['bs']."</th><th>".$LANG['4']."</th><th>".$LANG['1']."</th><th>".$LANG['2']."</th><th>".$LANG['3']."</th>";

$comma=explode(",",$title_bs);
$no_titles=count($comma);
$no_titles=$no_titles+19;
//echo $no_titles;
$title = preg_split("/[,]+/",$title_bs);

while ($row = mysql_fetch_array($result))
{
 // Get date from string
 $output_c1=$row['output_c1'];
 $output_c2=$row['output_c2'];
 $output_c3=$row['output_c3'];
 $output_c1 = preg_split("/[\s,]+/",$output_c1);
 $output_c2 = preg_split("/[\s,]+/",$output_c2);
 $output_c3 = preg_split("/[\s,]+/",$output_c3);
$y=0;
 for ($x=20; $x<=$no_titles; $x++) 
{
$o1=$output_c1[$x];
$o1=(int)$o1;
$o2=$output_c2[$x];
$o2=(int)$o2;
$o3=$output_c3[$x];
$o3=(int)$o3;
$global=$o1+$o2+$o3;

if($o1<0){$class1="neg";} else{$class1="pos";$o1=number_format($o1);}
if($o2<0){$class2="neg";} else{$class2="pos";$o2=number_format($o2);}
if($o3<0){$class3="neg";} else{$class3="pos";$o3=number_format($o3);}
if($global<0){$class0="neg";} else{$class0="pos";$global=number_format($global);}

if ($x==20 or $x==26 or $x==27 or $x==33 )
{
echo "<tr><td class='result'>".$title[$y]."</td><td class='result' colspan=4></td></tr>";		
}
else
{
if($x==25 or $x==32 or $x==38 or $x==37)
{
if($o1<0){$class1="neg0";$o1="(".number_format(abs($o1)).")";} else{$class1="pos0";}
if($o2<0){$class2="neg0";$o2="(".number_format(abs($o2)).")";} else{$class2="pos0";}
if($o3<0){$class3="neg0";$o3="(".number_format(abs($o3)).")";} else{$class3="pos0";}
if($global<0){$class0="neg0";$global="(".number_format(abs($global)).")";} else{$class0="pos0";}
$class_title="result2";
} else {
if($o1<0){$class1="neg";$o1="(".number_format(abs($o1)).")";} else{$class1="pos";}
if($o2<0){$class2="neg";$o2="(".number_format(abs($o2)).")";} else{$class2="pos";}
if($o3<0){$class3="neg";$o3="(".number_format(abs($o3)).")";} else{$class3="pos";}
if($global<0){$class0="neg";$global="(".number_format(abs($global)).")";} else{$class0="pos";}
$class="";
$class_title="";
}
echo "<tr class=".$class."><td class=".$class_title.">".$title[$y]."</td><td class=".$class0.">".$global."</td><td class=".$class1.">".$o1."</td><td class=".$class2.">".$o2."</td><td class=".$class3.">".$o3."</td></tr>";		
}
++$y;
$global="";
$o1="";
$o2="";
$o3="";
 }
 }
echo "</table>";
// end BS

// start ratio


$result = mysql_query("SELECT * FROM `output` where team_id='$id' and round='$round' and final='1'");
if($result === FALSE) {
    die(mysql_error()); // TODO: better error handling
}
echo "<br><table class=result>"; 
echo "<th>".$LANG['finratio']."</th><th>".$LANG['4']."</th>";

$comma=explode(",",$title_ratio);
$no_titles=count($comma);
$no_titles=$no_titles+19+19;
//echo $no_titles;
$title = preg_split("/[,]+/",$title_ratio);

while ($row = mysql_fetch_array($result))
{
 // Get date from string
 $output_c1=$row['output_c1'];
 
 $output_c1 = preg_split("/[\s,]+/",$output_c1);
 
$y=0;
 for ($x=39; $x<=$no_titles; $x++) 
{

$o1=$output_c1[$x];
//$o1=(int)$o1;

$o1=(float)$o1;
$o1=round($o1,2);
if($o1<0) {$class="neg";} else{$class="pos";}
if ($x<45){$o1=number_format($o1);}

if ($x==39 or $x==47 )
{
echo "<tr><td class='result'>".$title[$y]."</td><td class='result' colspan=4></td></tr>";		
}
else
{
if($x==46 or $x==55)
{
if($o1<0) {$class="neg0";} else{$class="pos0";}
$class_title="result2";
} 
else 
{
if($o1<0) {$class="neg";} else{$class="pos";}
$class_title="";
}
echo "<tr class=result2><td class=".$class_title.">".$title[$y]."</td><td class=".$class.">".$o1."</td></tr>";		
}
++$y;
$o1="";
 }
 }
echo "</table>";
// end ratio


 } 
 // end





 ?> 
<?php

// PRESENT MOD TABLE
  if( $_GET['act']=='2' and isset($_GET['id']) and $_GET['id']<>"" )
  {
  $id=$_GET['id'];

// ---------------GET GROUP NAME


$result = mysql_query("SELECT * FROM `group` where id=$id");
$array = mysql_fetch_array($result);

$name=$array['name'];
$ins=$array['no_of_instructors'];
//echo $ins;
echo "<h3>".$LANG['Mod']." | ".$name."</h3><br>";
//echo $name;
// ---------------END GET GROUP NAME
$result = mysql_query("SELECT * FROM `mod` where group_id=$id");
echo "<table>"; 
echo "<th>ID</th><th>".$LANG['Customer']."</th><th>".$LANG['name']."</th><th>Email/IP</th><th>Phone</th><th>".$LANG['students']."</th><th>".$LANG['Games']."</th><th>".$LANG['action']."</th>";
if($result === FALSE) {
    die(mysql_error()); // TODO: better error handling
}
while ($row = mysql_fetch_array($result))
{ 
 $mid=$row['id'];
 $result1 = mysql_query("SELECT id FROM game where mod_id=$mid");
 $num_game_played = mysql_num_rows($result1);
 echo"<tr><td>".$mid."</td><td>".$row['group_id']."</td><td><a href=game.php?act=3&&id=".$row['id'].">".$row['name']."</a><br></td><td>".$row['email']."<br>".$row['ip']."</td><td>".$row['phone']."</td><td>".$row['no_students']."</td><td>".$row['no_games']." | ".$num_game_played ."</td><td><a href=game.php?id=".$row['id']."&act=2&edit=2&gid=".$id.">Edit </a>| Delete</td></tr>";

}
echo "</table>";
echo "<table>";
echo"<form action='game.php?act=addmod&id=$id' method='POST'>";
echo "<th>ID</th><th>".$LANG['Customer']."</th><th>".$LANG['name']."</th><th>Email</th><th>Password</th><th>Phone</th><th>".$LANG['noofgames']."</th>";
echo"<tr><td>+<input type='hidden' name='id' value='$id' /><input type='hidden' name='ins' value='$ins' /></td><td>  <input class=submit type=submit value='Add' /></td><td><input type='text' name='mod_name' /></td><td><input type='text' name='mod_email' /></td><td><input type='text' name='mod_password' /></td><td><input type='text' name='mod_contact' /></td><td><input type='text' name='no_games' /></td><tr>";
echo "</form>";
echo "</table>";
 }
// Get instructor page 
 
  if( $_GET['act']=='mod' and !isset($_GET['id'])and !isset($_GET['edit']))
  {
echo "<h3>".$LANG['Mod']."</h3><br>";  
$result = mysql_query("SELECT * FROM `mod` ");
echo "<table>"; 
echo "<th>ID</th><th>".$LANG['Customer']."</th><th>".$LANG['name']."</th><th>Email/IP</th><th>Phone</th><th>".$LANG['students']."</th><th>".$LANG['Games']."</th><th>".$LANG['action']."</th>";
if($result === FALSE) {
    die(mysql_error()); // TODO: better error handling
}
while ($row = mysql_fetch_array($result))
{
 $gid=$row['group_id'];
 $result1 = mysql_query("SELECT * FROM `group` where id='$gid'");
 $row1 = mysql_fetch_array($result1);
 // get number of game registered
 $mid=$row['id'];
 $result2 = mysql_query("SELECT id FROM game where mod_id=$mid");
 $num_game_played = mysql_num_rows($result2);
 echo"<tr><td>".$row['id']."</td><td><a href=game.php?act=2&id=$gid>".$row1['name']."</a></td><td><a href=game.php?act=3&id=".$row['id'].">".$row['name']."</a><br></td><td>".$row['email']."<br>".$row['ip']."</td><td>".$row['phone']."</td><td>".$row['no_students']."</td><td>".$row['no_games']." | ".$num_game_played."</td><td><a href=game.php?id=".$row['id']."&act=2&edit=2>Edit </a></td></tr>";

}
echo "</table>";

  }
 
?> 
<?php

//--------------------------- PRESENT GAMES TABLE
  if( $_GET['act']=='newgame' )
  {
  
  // -----------------------------------check who is 
 //echo $_SESSION['mid'];
  if (isset($_SESSION['mid']) or isset($_SESSION['aid'])) 
  {
  
	 if (isset($_SESSION['aid'])) {$id=$_SESSION['aid'];}
	  if (isset($_SESSION['mid'])) { $id=$_SESSION['mid'];}
  }
	else
{
//header ("Location:game.php");
exit();
	
}	
// ----------------------------------------end check

 
if (!isset($_GET['edit']))
{
// ---------------GET GAMES NAME

$result = mysql_query("SELECT * FROM `game` where mod_id=$id");
$array = mysql_fetch_array($result);

//$game_id=$array['id'];

$mod_id=$id;
//$assumption_id=$array['assumption_id'];
$edition_id=$array['edition_id'];
$complete=$array['complete'];
$no_of_teams=$array['no_of_teams'];
$no_of_rounds=$array['no_of_rounds'];
$hours_per_round=$array['hours_per_round'];
$start_time=$array['start_time'];
// Get group name and mod name
 $result1 = mysql_query("SELECT group_id, email FROM `mod` where id='$mod_id'");
 $row1 = mysql_fetch_array($result1);
 $group_id=$row1['group_id'];
 $email=$row1['email'];
 $result1 = mysql_query("SELECT name FROM `group` where id='$group_id'");
 $row1 = mysql_fetch_array($result1);
 $group_name=$row1['name'];
 if ($_SESSION['admin']==1) {$group_name="Simul";}
 $prefix_g = substr($group_name, 0, 5);
 $prefix_e = substr($email, 0, 5);
 $date = date('Ymd');
 $prefix=$prefix_g."_".$prefix_e."_".$date."_";
 //echo $prefix;
// End Get group name and mod name
 // ---------------END GET GAME

 //echo "<h3>".$LANG['Games']." | ".$group_name."</h3><br>"; 
//$result = mysql_query("SELECT * FROM `game` where mod_id=$id");
//echo "<table>"; 
//echo "<th>ID</th><th>Name</th><th>Mod ID</th><th>Edition</th><th>Complete</th><th>Teams</th><th>Rounds</th><th>Hours per round</th><th>Start_time</th><th>Action</th>";
//if($result === FALSE) {
 //   die(mysql_error()); // TODO: better error handling
//}
//while ($row = mysql_fetch_array($result))
//{
 
 //echo"<tr><td>".$row['id']."</td><td><a href=game.php?act=5&m_id=".$id."&gid=".$row['id'].">".$row['name']."</a></td><td>".$row['mod_id']."</td><td>".$row['edition_id']."</td><td>".$row['complete']."</td><td>".$row['no_of_teams']."</td><td>".$row['no_of_rounds']."</td><td>".$row['hours_per_round']."</td><td>".$row['start_time']."</td><td><a href=game.php?act=3&m_id=".$id."&edit=1&id=".$row['id'].">Edit</a> | <a href=game.php?act=result&rid=0&id=".$row['id']."> Result</a></td></tr>";

//}
//echo "</table>";
}
//------------------------------EDIT GAME
  if(isset($_POST["edit"]))
  {	
  if($_GET["edit"]=='1')
  {

  $id_g=$_GET["id"];
  $result = mysql_query("SELECT * FROM `game` where id=$id_g");
  $array = mysql_fetch_array($result);
  $name=$array['name'];
  $no_of_teams=$array['no_of_teams'];
  $no_of_rounds=$array['no_of_rounds'];
  $hours_per_round=$array['hours_per_round'];
//  $no_of_factory_c1=$array['no_of_factory_c1'];
  $start_time=$array['start_time'];
  $date = date('Y-m-d H:i:s'); 
  //$now->now();
  //echo $date."date";
  //echo $start_time."starttime";
  $to_time = strtotime($date);
  $from_time = strtotime($start_time);
  $time_diff=round(abs($to_time - $from_time)/60/60,1);
    if ($time_diff>$hours_per_round) { echo $LANG['overtime'];}
  }
  $title=$LANG['editgame'];
  $readonly="readonly";
  $disable="disabled";
  $button=$LANG['edit'];
  $create_game='0';
  $edit='1';
  $m_id=$_GET['m_id'];
  }
  else
  {
  $title=$LANG['newgame'];
  $name="";
  $no_of_teams="";
  $no_of_rounds="";
  $hours_per_round=12;
  $no_of_factory_c1="";
  $readonly="";
  $disable="";
  $button=$LANG['c8newgame'];
  $create_game='1';
  $edit='0';
  $id_g='';
  $m_id="";
  }
//------------------------------END EDIT GAME


//----------------------------- Create new games GENERAL PARAMETER


echo"<form action='game.php?act=5' method='POST'>";
// Get mod_id
//echo $id;
//echo $_SESSION['mid'];

echo"<input type='hidden' name='mod_id' value='$id' />";


echo "<h3>".$title."</h3><br>"; 
echo "<table>"; 
echo "<th>".$LANG['parameter']."</th><th>".$LANG['value']."</th><th>".$LANG['note']."</th>";

echo"<tr><td>".$LANG['name_game']."</td><td>".$prefix."<input type='hidden' value='".$prefix."' name='prefix' /><input style='width:98%;' type='text' value='".$name."' name='name_game' /></td><td>".$LANG['n_g']."</td></tr>";
echo"<tr><td>".$LANG['no_of_teams']."</td><td  class=demo>";

// for number of team
echo"<select style='width:100%;'  ".$readonly." name='no_of_teams' >";
  for ($x=2; $x<=10; $x++) 
{
echo"<option value=".$x.">".$x."</option>";
}
echo"</select>";
// end

echo"</td><td>".$LANG['n_o_t']."</td></tr>";
echo"<tr><td>".$LANG['no_of_rounds']."</td><td  class=demo>";

// for number of round
echo"<select style='width:100%;border:1' name='no_of_rounds'>";
  for ($x=2; $x<=20; $x++) 
{
echo"<option value=".$x.">".$x."</option>";
}
echo"</select>";
//end

echo"</td><td>".$LANG['n_o_r']."</td></tr>";

echo"<tr><td>".$LANG['no_of_practice']."</td><td  class=demo>";

// for number of practice round
echo"<select style='width:100%;border:1' name='no_of_practice'>";
  for ($x=1; $x<=3; $x++) 
{
echo"<option value=".$x.">".$x."</option>";
}
echo"</select>";
//end

echo"</td><td>".$LANG['n_o_p']."</td></tr>";

echo"<tr><td>".$LANG['hours_per_round']."</td><td class=demo>";
//<input type='text' value='".$hours_per_round."' name='hours_per_round' />
echo"<select style='width:100%;'  name='hours_per_round'>";
  for ($x=1; $x<=672; $x++) 
{
if ($x==$hours_per_round) {$s="selected";} else {$s="";}
if ($x<=24) {$title="hours";$x_title=$x; echo"<option ".$s." value=".$x.">".$x_title." ".$title."</option>";}
if ($x>24 and $x<168 and $x % 24==0) {$title="days"; $x_title=$x/24; echo"<option ".$s." value=".$x.">".$x_title." ".$title."</option>";}
if ($x>168 and $x % 168==0) {$title="weeks"; $x_title=$x/168;echo"<option ".$s." value=".$x.">".$x_title." ".$title."</option>";}


}
echo"</select>";

echo"</td><td>".$LANG['h_p_r']."</td></tr>";

echo"<tr><td>".$LANG['no_of_factory_c1']."</td><td  class=demo>";
// for number of startup factory
echo"<select style='width:100%;'  name='no_of_factory_c1'>";
  for ($x=8; $x<=20; $x++) 
{
echo"<option value=".$x.">".$x."</option>";
}
echo"</select>";
//end

echo"</td><td>".$LANG['n_o_f1']."</td></tr>";

echo"<tr><td>".$LANG['tech1']."</td><td><input type='checkbox' checked name='tech1' value='1'".$disable."/></td><td>".$LANG['t1']."</td></tr>";
echo"<tr><td>".$LANG['tech2']."</td><td><input type='checkbox' name='tech2' value='1'".$disable."/></td><td>".$LANG['t2']."</td></tr>";
echo"<tr><td>".$LANG['tech3']."</td><td><input type='checkbox' name='tech3' value='1'".$disable."/></td><td>".$LANG['t3']."</td></tr>";
echo"<tr><td>".$LANG['tech4']."</td><td><input type='checkbox' name='tech4' value='1'".$disable."/></td><td>".$LANG['t4']."</td></tr>";

echo"<tr><td>".$LANG['mark_up_price']."</td><td class=demo>";

//<input type='text' name='mark_up_price' ".$readonly."/>

echo"<select style='width:100%;'  name='mark_up_price'>";
  for ($x=0; $x<=200; $x++) 
{
if ($x==100) {$s="selected";} else {$s="";}
echo"<option ".$s." value=".$x.">".$x." %</option>";
}
echo"</select>";

echo"</td><td>".$LANG['m_u_p']."</td></tr>";
echo"<input type='hidden' name='id_game' value='".$id_g."' />";
echo"<input type='hidden' name='edit' value='".$edit."' />";
echo"<input type='hidden' name='mid' value='".$m_id."' />";
echo"<input type='hidden' name='create_game' value='".$create_game."' />";
echo "<tr><td></td><td class=result><input class=submit type=submit value='".$button."' /></td><td ></td></tr></table>";
//--------------------------------- END GENERAL PARAMETER


//------------------------------- BEGIN AUTO GENERATE GAME PARAMETER
  if(!isset($_GET["edit"]))
  {	


echo "<h3>".$LANG['autopara']."</h3><br>"; 
$result = mysql_query("SELECT * FROM `parameters_assumption`");
echo "<table>"; 
echo "<th>ID</th><th>".$LANG['name']."</th><th>".$LANG['randomvalue']."</th><th>".$LANG['units']."</th>";
if($result === FALSE) {
    die(mysql_error()); // TODO: better error handling
}
while ($row = mysql_fetch_array($result))
{
if ($row['id']<14)
{
$rand=$row['string'];
}
else
{
 $min=$row['min'];
 $max=$row['max'];
// FOR ROUND UP, BUT INTEREST RATE
//$rand=round(rand($min,$max),-1);
$rand=rand($min,$max);
 }
 echo"<tr><td>".$row['id']."</td><td>".$row['name']."</td><td><input type='text' value=".$rand." name=".$row['name']." /></td><td></td>";
}
echo "</table>";

//---------------------------------------END AUTO PARAMETER

echo"</form>";
 }

}
?>
<?php
// UPDATE TEAM
if($_SESSION['admin']==1 or $_SESSION['mod']==1)
{
  if( isset($_POST["name"]) and isset($_POST["tid"]) and $_GET["act"]=='5' and isset($_POST["tid"])  )
  {
 //echo "<h3>".$LANG['Updategroup']."</h3><br>"; 
$name=$_POST['name'];
$id=$_POST['tid'];
$gid=$_GET['gid'];
$sql="UPDATE `team` SET name='$name' where id='$id'";
$result = mysql_query($sql); 
$sql=mysql_real_escape_string($sql);  
					$t=logs($user_for_logs,$_SESSION['id'],$sql,$result);
 //order executes
if($result){
    //echo("<br>Input data is succeed");
	header ("Location:game.php?act=5&gid=$gid");
} else{
    //echo("<br>Input data is fail");
	header ("Location:game.php?act=5&gid=$gid");
}
  }
// UPDATE player  
 if( isset($_POST["name"]) and isset($_POST["pid"]) and $_GET["act"]=='6' and isset($_POST["email"]) and $_POST["edit"]=='1'  )
  {
 //echo "<h3>".$LANG['Updategroup']."</h3><br>"; 
$name=$_POST['name'];
$id=$_POST['pid'];
$email=$_POST['email'];
$password=$_POST['password'];

$result = mysql_query("SELECT id FROM player WHERE email ='$email' ");

if( mysql_num_rows($result) == 1) 

{
echo "Already exist email!";
}
else
{

$sql="UPDATE `player` SET name='$name', email='$email', password='$password' where id='$id'";
$result = mysql_query($sql);  //order executes
$sql=mysql_real_escape_string($sql);  
$t=logs($user_for_logs,$_SESSION['id'],$sql,$result);
					
$query = "SELECT team_id,game_id FROM `player` WHERE id='$id'";
$result1 = mysql_query($query) or die(mysql_error());
$row = mysql_fetch_array($result1);
$tid=$row['team_id'];
$gid=$row['game_id'];
if($result){
    //echo("<br>Input data is succeed");
	header ("Location:game.php?act=6&gid=$gid&tid=$tid");
} else{
    //echo("<br>Input data is fail");
	header ("Location:game.php?act=6&gid=$gid&tid=$tid");
}
  }
  }
}  
?> 
<?php
// EDIT Player
if($_SESSION['admin']==1 or $_SESSION['mod']==1)
{
  if( $_GET['act']=='6' and isset($_GET["pid"]) and $_GET['edit']=='1')
  {
$id=$_GET['pid'];
// check if player blongs to mod
echo "<h3>".$LANG['editplayer']."</h3><br>";
 
$query = "SELECT * FROM `player` WHERE id='$id'";
$result = mysql_query($query) or die(mysql_error());
$row = mysql_fetch_array($result);
$name=$row['name'];
$email=$row['email'];
$password=$row['password'];
$tid=$row['team_id'];
$gid=$row['game_id'];
echo"<table>";
echo"<form action='game.php?act=6&gid=$gid&tid=$tid' method='POST'>";
echo "<th>ID</th><th>".$LANG['name']."</th><th>Email</th><th>Password</th><th>".$LANG['action']."</th>";
echo"<tr><td>$id<input type='hidden' name='pid' value='$id' /><input type='hidden' name='edit' value='1' /></td><td><input type='text' name='name' value='$name' /></td><td><input type='email' name='email' value='$email' /></td><td><input type='text' name='password' value='$password' /></td><td><input class=submit type=submit value='Edit' /></td><tr>";
echo "</form>";
echo "</table>";
include('footer.php');
exit();
  }
 } 
?>
<?php
// EDIT TEAM
  if( $_GET['act']=='5' and isset($_GET["tid"]) and $_GET['edit']=='1')
  {
$gid=$_GET['gid'];
echo "<h3>".$LANG['Editteam']."</h3><br>";
$id=$_GET["tid"];  
$query = "SELECT * FROM `team` WHERE id='$id'";
$result = mysql_query($query) or die(mysql_error());
$row = mysql_fetch_array($result);
$name=$row['name'];
echo"<table>";
echo"<form action='game.php?act=5&gid=$gid&tid=$id&edit=1' method='POST'>";
echo "<th>ID</th><th>".$LANG['name']."</th><th>".$LANG['action']."</th>";
echo"<tr><td>$id<input type='hidden' name='tid' value='$id' /><input type='hidden' name='edit' value='1' /></td><td><input type='text' name='name' value='$name' /></td><td><input class=submit type=submit value='Edit' /></td><tr>";
echo "</form>";
echo "</table>";
include('footer.php');
exit();
  }
?>
<?php

// PRESENT TEAM TABLE
  if( $_GET['act']=='5' and isset($_GET["gid"]) )
  {
 
$gid=$_GET['gid'];
// Get game name 

$query1 = "SELECT name FROM `game` WHERE id='$gid'";
$result1 = mysql_query($query1) or die(mysql_error());
$row1 = mysql_fetch_array($result1);
$ganame=$row1['name'];

echo "<h3>".$ganame." | ".$LANG['TEAMS']."</h3><br>";
$result = mysql_query("SELECT * FROM `team` where game_id='$gid'");
echo "<table>"; 
echo "<th>ID</th><th>".$LANG['TEAM'].$LANG['name']."</th><th>".$LANG['game']." ID</th><th>".$LANG['totalplayer']."</th><th>".$LANG['action']."</th>";
if($result === FALSE) {
    die(mysql_error()); // TODO: better error handling
}
while ($row = mysql_fetch_array($result))
{
 $t_id=$row['id'];
 if ($t_id==$id) {$tea_name=$row['name'];}
 //echo $t_id;
 $result3 = mysql_query("SELECT COUNT(id) FROM `player` where team_id='$t_id'");
 $row22 = mysql_fetch_array($result3);
 $no_of_players=$row22[0]; 

 echo"<tr><td>".$row['id']."</td><td><a href=game.php?act=6&gid=$gid&tid=".$row['id'].">".$row['name']."</a></td><td>".$row['game_id']."</td><td>".$no_of_players."</td><td><a href=game.php?act=5&gid=$gid&edit=1&tid=".$row['id'].">Edit name</a> | <a href=game.php?act=6&gid=$gid&tid=".$row['id'].">Add player</a> | <a href=game.php?act=result&id=$gid>Result</a></td></tr>";

}
echo "</table>";
 }
?> 
<?php

// PRESENT PLAYERS TABLE
  if( $_GET['act']=='6' and isset($_GET["tid"]) )
  {
$id=$_GET["tid"];
$gid=$_GET["gid"];
//present team table
echo "<h4>".$LANG['TEAM']."</h4><br>";
$result = mysql_query("SELECT * FROM `team` where game_id='$gid'");
echo "<table>"; 
echo "<th>ID</th><th>".$LANG['TEAM']."</th><th>".$LANG['no_of_player']."</th><th>".$LANG['action']."</th>";
if($result === FALSE) {
    die(mysql_error()); // TODO: better error handling
}
while ($row = mysql_fetch_array($result))
{
 $t_id=$row['id'];
 if ($t_id==$id) {$tea_name=$row['name'];}
 //echo $t_id;
 $result3 = mysql_query("SELECT COUNT(id) FROM `player` where team_id='$t_id'");
 $row22 = mysql_fetch_array($result3);
 $no_of_players=$row22[0]; 
 
 echo"<tr><td>".$row['id']."</td><td>".$row['name']."</td><td>".$no_of_players."</td><td><a href=game.php?act=6&gid=$gid&tid=".$row['id'].">Add players </a></td></tr>";
}
echo"</table><br>";
// end team table


echo "<h4> Team ".$tea_name." | ".$LANG['PLAYERS']."</h4><br>";
$result = mysql_query("SELECT * FROM `player` where team_id='$id'");

echo "<table>"; 
echo "<th>ID</th><th>".$LANG['PLAYERS'].$LANG['name']."</th><th>".$LANG['game']." ID</th><th>".$LANG['TEAM']." ID</th><th>Email</th><th>".$LANG['action']."</th>";
if($result === FALSE) {
    die(mysql_error()); // TODO: better error handling
}
while ($row = mysql_fetch_array($result))
{
 echo"<tr><td>".$row['id']."</td><td>".$row['name']."</td><td>".$row['game_id']."</td><td>".$row['team_id']."</td><td>".$row['email']."</td><td><a href=game.php?act=6&edit=1&pid=".$row['id'].">Edit </a></td></tr>";
}
echo"</table><br>";
echo "<h4> ".$LANG['TEAM']." ".$tea_name." | ".$LANG['addPLAYERS']."</h4><br>";
echo"<table>";
echo"<th>".$LANG['PLAYERS'].$LANG['name']."</th><th>Email</th><th>Password</th>";
echo"<form action='game.php?act=6' method='POST'>";

echo"<tr><td><input type='text' name='name' /><input type='hidden' value= '1' name='new' /></td><td><input type='hidden' value= '".$gid."' name='gid' /><input type='hidden' value='".$id."' name='tid' /><input type=\"email\" name='email' id=\"email\" value=\"mail@address.com\" onBlur=\"if(this.value=='')this.value='mail@address.com'\" onFocus=\"if(this.value=='mail@address.com')this.value=''\"></td><td><input type='text' name='password' /> </td><tr>";
echo"<tr><td colspan=3><input class=submit type=submit value='Add' /></td></tr>";
echo "</form>";
echo "</table>";
 }
?> 
<?php
// INSERT Player
if($_SESSION['admin']==1 or $_SESSION['mod']==1)
{
  if( isset($_POST["name"]) and isset($_POST["email"]) and isset($_POST["password"]) and $_GET['act']=='6' and $_POST['new']=='1')
  {
$name=$_POST['name'];
$email=$_POST['email'];
$game_id=$_POST['gid'];
$team_id=$_POST['tid'];
$pw=$_POST['password'];
// check if email already exit
$result = mysql_query("SELECT id FROM player WHERE email ='$email' ");

if( mysql_num_rows($result) == 1) 

{
echo $LANG['exitemail']."!";
}
else

{

$sql="INSERT INTO `player` (name,email,game_id,team_id,date,password)VALUES ('$name','$email','$game_id','$team_id',NOW(),'$pw')";
$result = mysql_query($sql);  //order executes
$sql=mysql_real_escape_string($sql);
$t=logs($user_for_logs,$_SESSION['id'],$sql,$result);
if($result){
    //echo("<br>Input data is succeed");
header ("Location:game.php?act=6&gid=$game_id&tid=$team_id");
} else{
    //echo("<br>Input data is fail");
header ("Location:game.php?act=6&gid=$game_id&tid=$team_id");	
}
  }
  }
 } 
?>
<?php
// EDIT SCENARIO
  if( isset($_POST["des_en"]) and $_GET['edit']=='1' and isset($_POST["value"]) and isset($_GET["id"]))
  {
$des_en=$_POST['des_en'];
$des_vn=$_POST['des_vn'];
$value=$_POST['value'];
$id=$_GET['id'];
$sql="UPDATE `scenario` SET description_en='$des_en',description_vn='$des_vn', value='$value' WHERE id='$id'";
$result = mysql_query($sql); 
$sql=mysql_real_escape_string($sql);
$t=logs($user_for_logs,$_SESSION['id'],$sql,$result);
if($result){
   //echo("<br>Input data is succeed");
	header ("Location:game.php?act=scenario");
} else{
  //echo("<br>Input data is fail");
	header ("Location:game.php?act=scenario");
}
  }
?>
<?php
// INSERT NEW SCENARIOS
if($_SESSION['admin']==1 or $_SESSION['mod']==1)
{
  if( isset($_POST["des_en"]) and isset($_POST["add"]) and $_GET['edit']=='0' )
  {
$x=0;
$result = mysql_query("SELECT * FROM `round_assumption_title`");
while ($row = mysql_fetch_array($result))
{
++$x;
$t=$row['title'];

$titl=$_POST[$t];
if ($x==1){$title=$titl;}
else
{$title=$title.",".$titl;}

}  
//echo $title;
$des_en=$_POST['des_en'];
$des_vn=$_POST['des_vn'];
$sql="INSERT INTO `scenario` (value,description_en,description_vn)VALUES ('$title','$des_en','$des_vn')";
$result = mysql_query($sql);  //order executes
$sql=mysql_real_escape_string($sql);
$t=logs($user_for_logs,$_SESSION['id'],$sql,$result);

if($result){
   //echo("<br>Input data is succeed");
	header ("Location:game.php?act=scenario");
} else{
  echo("<br>Input data is fail");
	header ("Location:game.php?act=scenario");
}
  }
  }
?>
<?php

//--------------------------- PRESENT scenario TABLE
if($_SESSION['admin']==1 or $_SESSION['mod']==1)
{
  if( $_GET['act']=='scenario' )
  {

echo "<h3>".$LANG['SCENARIOS']."</h3><br>"; 
$result = mysql_query("SELECT * FROM `scenario`");

echo "<table>"; 

echo "<th>ID</th><th>".$LANG['descript']." EN</th><th>".$LANG['descript']." VN</th><th>".$LANG['value']."</th><th>".$LANG['action']."</th>";
if($result === FALSE) {
    die(mysql_error()); // TODO: better error handling
}
while ($row = mysql_fetch_array($result))
{
 echo"<form action='game.php?act=scenario&edit=1&id=".$row['id']."' method='POST'>";
 echo"<tr><td>".$row['id']."</td><td><textarea name='des_en' />".$row['description_en']."</textarea></td><td><textarea name='des_vn' />".$row['description_vn']."</textarea></td><td><input type='text' value=".$row['value']." name='value' /></td><td><input class=submit type=submit value='Edit' /></td></tr>";
 echo "</form>";
}

echo "</table>";

 }

 //------------------------------ PRESENT scenario title TABLE
  if( $_GET['act']=='scenario' )
  {
echo" <h3>".$LANG['SCENARIOS_pa']."</h3><br>";


$result = mysql_query("SELECT * FROM `round_assumption_title`");

echo "<table>"; 
echo"<form action='game.php?act=scenario&edit=0' method='POST'>";
echo "<th>ID</th><th>".$LANG['title']."</th><th>".$LANG['value']."</th><th>".$LANG['note']."</th>";
if($result === FALSE) {
    die(mysql_error()); // TODO: better error handling
}
while ($row = mysql_fetch_array($result))
{
 
 echo"<tr><td>".$row['id']."</td><td>".$row['title']."</td><td><input type='text' value='' name=".$row['title']." /></td><td>If increase 30% type 30, reduce 15% type -15</td></tr>";
}
 echo"<tr><td colspan=5><b>".$LANG['desscenario']."</b><br>".$LANG['desscenarionote']."</td></tr>";
 echo"<tr><td colspan=5><b>FOR English</b><textarea name='des_en' rows='20'/></textarea></td></tr>";
 echo"<tr><td colspan=5><b>FOR Vietnamese</b><textarea name='des_vn' rows='20'/></textarea><input type='hidden' name='add' value='1' /></td></tr>";
echo"<tr><td colspan=5><input class=submit type=submit value='Add' /></tr>";
 echo "</form></table>";

 }
 }
//----------------------------------- END Scenarios 
?> 

<?php

//--------------------------- PRESENT weights ASSUMPTIONS TABLE
if($_SESSION['admin']==1)
{
  if( $_GET['act']=='assumption' )
  {

echo "<h3>".$LANG['weight_assumption']."</h3><br>"; 
$result = mysql_query("SELECT * FROM `weight_assumption`");

echo "<table>"; 
echo"<form action='game.php?act=4' method='POST'>";
echo "<th>ID</th><th>".$LANG['name']."</th><th>".$LANG['1']."</th><th>".$LANG['2']."</th><th>".$LANG['3']."</th><th>".$LANG['note']."</th>";
if($result === FALSE) {
    die(mysql_error()); // TODO: better error handling
}
while ($row = mysql_fetch_array($result))
{
 
 echo"<tr><td>".$row['id']."</td><td>".$row['name']."</td><td><input type='text' value=".$row['c1']." name='".$row['name']."_c1' /></td><td><input type='text' value=".$row['c2']." name='".$row['name']."_c2' /></td><td><input type='text' value=".$row['c3']." name='".$row['name']."_c3' /></td><td></td></tr>";
}

echo "<tr><td><input type='hidden' name='edit' value='1' /></td><td  colspan=5><input class=submit type=submit value='Edit' /></td></tr></form></table>";

 }

 //------------------------------ PRESENT ASSUMPTION parameter TABLE
  if( $_GET['act']=='assumption' )
  {
echo" <h3>".$LANG['parameter_assumption']."</h3><br>";


$result = mysql_query("SELECT * FROM `parameters_assumption`");

echo "<table>"; 
echo"<form action='game.php?act=4' method='POST'>";
echo "<th>ID</th><th>".$LANG['name']."</th><th>".$LANG['min']."</th><th>".$LANG['max']."</th><th>".$LANG['array']."</th><th>".$LANG['name']."</th>";
if($result === FALSE) {
    die(mysql_error()); // TODO: better error handling
}
while ($row = mysql_fetch_array($result))
{
 
 $check_id=$row['id'];
 if ($check_id<14) 
 {
 echo"<tr><td>".$row['id']."</td><td>".$row['name']."</td><td></td><td></td><td><input type='text' value='".$row['string']."' name='".$row['id']."_string' /></td><td>note... to be determined</td></tr>";
 }
 else
 {
 echo"<tr><td>".$row['id']."</td><td>".$row['name']."</td><td><input type='text' value='".$row['min']."' name='".$row['id']."_min' /></td><td><input type='text' value='".$row['max']."' name='".$row['id']."_max' /></td><td></td><td>note... to be determined</td></tr>";
 }
 
}

echo "<tr><td colspan='5'><input type='hidden' name='edit' value='2' /></td><td><input class=submit type=submit value='Edit' /></td></tr></form></table>";

 }
 }
//----------------------------------- END ASSUMPTION PRESENTATION 
?> 
<?php
// ----------------------------------UPDATE GAME INFO
  if( isset($_POST["id_game"]) and  $_GET['act']=='5' and isset($_POST["name_game"]) and $_POST["edit"]=='1' and isset($_POST["mid"]))
  {
$idg=$_POST["id_game"]  ;
$mid=$_POST["mid"]  ;
$name_game=$_POST['name_game'];
$no_of_teams=$_POST['no_of_teams'];
$no_of_rounds=$_POST['no_of_rounds'];
$hours_per_round=$_POST['hours_per_round'];
$no_of_factory_c1=$_POST['no_of_factory_c1'];
$sql="UPDATE `game` SET name='$name_game', no_of_teams='$no_of_teams', no_of_rounds='$no_of_rounds',hours_per_round='$hours_per_round' WHERE id='$idg'";
$result1 = mysql_query($sql);  
$sql=mysql_real_escape_string($sql);
$t=logs($user_for_logs,$_SESSION['id'],$sql,$result1);
if($result1)
{
//echo("<br>Input data is succeed");
header ("Location:game.php?act=3&id=$mid");
} 
else
{
//echo("<br>Input data is fail");
header ("Location:game.php?act=3&id=$mid");
}

  }
  
  
// ----------------------------------END UPDATE GAME INFO  
?>




<?php
// INSERT MOD
if($_SESSION['admin']==1)
{

  if( isset($_POST["mod_name"]) and isset($_POST["mod_contact"]) and isset($_POST["mod_email"]) and  $_GET['act']=='addmod' )
  {
$name=$_POST['mod_name'];
$contact=$_POST['mod_contact'];
$email=$_POST['mod_email'];
$ins=$_POST['ins'];
$games=$_POST['no_games'];
$id=$_POST['id'];
$mpass=$_POST['mod_password'];
$ip=$_SERVER['REMOTE_ADDR'];

$sql="INSERT INTO `mod` (name,group_id,email,phone,ip,logs,no_games,password)VALUES ('$name',$id,'$email','$contact','$ip',NOW(),'$games','$mpass')";
$result = mysql_query($sql);  //order executes
$sql=mysql_real_escape_string($sql);
$t=logs($user_for_logs,$_SESSION['id'],$sql,$result);
if($result){
    echo("<br>Input data is succeed");
	++$ins;
	//echo $id;

	$sql="UPDATE `group` SET no_of_instructors='$ins'where id='$id'";
	$result = mysql_query($sql);  //order executes
	$sql=mysql_real_escape_string($sql);
	$t=logs($user_for_logs,$_SESSION['id'],$sql,$result);
	header ("Location:game.php?act=2&id=$id");
} else{
    echo("<br>Input data is fail");
	header ("Location:game.php?act=2&id=$id");
}
  }
  }
?>
<?php
// INSERT NEW GROUP
if($_SESSION['admin']==1)
{
  if( isset($_POST["name"]) and isset($_POST["game_avail"]) and  $_GET['act']=='1' )
  {
$name=$_POST['name'];
$contact=$_POST['contact'];
$email=$_POST['email'];
$game_avail=$_POST['game_avail'];

$sql="INSERT INTO `group` (name,contact,email,games_available,date)VALUES ('$name','$contact','$email','$game_avail',NOW())";
$result = mysql_query($sql);  //order executes
$sql=mysql_real_escape_string($sql);
$t=logs($user_for_logs,$_SESSION['id'],$sql,$result);
if($result){
//    echo("<br>Input data is succeed");
header ("Location:game.php?act=group");
} else{
   // echo("<br>Input data is fail");
   header ("Location:game.php?act=group");
}
  }
  }
?>

<?php
if($_GET['act']=='home')
{
// homepage for admin
if($_SESSION['admin']==1)
{
$id=$_SESSION['aid'];
//competed games
echo"<br><h4>Request demo</h4>"; 
echo"<section class='left-col'>";
$result1 = mysql_query("SELECT email,ip,date FROM `request` ORDER BY id desc LIMIT 10");
echo"<table>";
echo"<th width=40%>Email</th><th>IP</th><th>Date</th><th>Invite</th>";
while ($array = mysql_fetch_array($result1))
{
//$id=$array['id'];
$email=$array['email'];
$res = mysql_query("SELECT id FROM player WHERE email ='$email'");
if( mysql_num_rows($res) == 0) 
	{
	$img="imgs/icon-cross.png";
	}
	else
	{
	$img="imgs/icon-tick.png";
	}
echo"<tr><td>".$array['email']."</td><td>".$array['ip']."</td><td>".$array['date']."</td><td><img style='width:10px;height:10px' src='".$img."'></td></tr>";
}
echo"</table>";

echo"<br><h4>Ongoing games</h4>";


// ongoing games
$result1 = mysql_query("SELECT id,name,no_of_rounds,start_time FROM `game` where complete='0' ORDER BY  id DESC  LIMIT 10 ");
echo"<table>";
echo"<th width=40%>Course name</th><th>Number of rounds</th><th>Start time</th><th>Result</th>";
while ($array = mysql_fetch_array($result1))
{
//$id=$array['id'];
echo"<tr><td>".$array['name']."</td><td>".$array['no_of_rounds']."</td><td>".$array['start_time']."</td><td><a href=game.php?act=result&id=".$array['id'].">Result</a></td></tr>";
}
echo"</table>";

// Logs
echo"<br><h4>Last activity</h4>";
$result1 = mysql_query("SELECT message,result FROM `logs` ORDER BY id desc LIMIT 10");
echo"<table>";
echo"<th>ID</th><th>Logs</th><th>Result</th>";
$x=0;
while ($array = mysql_fetch_array($result1))
{
++$x;
if ($array['result']==1) {$lod="imgs/icon-tick.png";} else {$lod="imgs/icon-cross.png";}
 $msg= substr($array['message'],0,100); 
 			$email=str_replace('"', "", $msg);
			$email=str_replace('>', "", $msg);
			$email=str_replace('<', "", $msg);
			$email=str_replace("'", "", $email);
			$email=mysql_real_escape_string($email);
echo"<tr><td>".$x."</td><td>".$email."</td><td><img style='width:10px;height:10px' src='".$lod."'></td></tr>";
}
echo"</table>";

echo"</section>";
echo"<aside class='sidebar'>";



	$stat1 = mysql_query("SELECT count(id),avg(hours_per_round),avg(no_of_rounds) FROM `game`");
	$st1 = mysql_fetch_array($stat1);
	$st=$st1[0];
	$sh=$st1[1];
	$sr=$st1[2];
	
	$stat1 = mysql_query("SELECT count(id) FROM `game` where complete='1'");
	$st1 = mysql_fetch_array($stat1);
	$sc1=$st1[0];
	
	// get group name mod name
	 $result2 = mysql_query("SELECT group_id,name,phone,email,ip FROM `mod`");
	$row2 = mysql_fetch_array($result2);
	$name=$row2['name']; 
	$phone=$row2['phone']; 
	$email=$row2['email'];
	$ip=$row2['ip'];		
	$gid=$row2['group_id'];		
	$result2 = mysql_query("SELECT name FROM `group` where id='$gid'");
	$row2 = mysql_fetch_array($result2);
	$gname=$row2['name']; 

$result1 = mysql_query("SELECT count(id) FROM `player`");
	$row2 = mysql_fetch_array($result1);
	$x=$row2[0]; 
echo"<table>";
echo"<th  colspan=2>Personal information</th>";
echo"<tr><td ><b>Group name</b></td><td>Administration</td></tr>";
echo"<tr><td><b>Name</b></td><td>".$name."</td></tr>";
echo"<tr><td><b>Email</b></td><td>".$email."</td></tr>";
echo"<tr><td><b>Phone number</b></td><td>".$phone."</td></tr>";
echo"<tr><td><b>IP</b></td><td>".$ip."</td></tr>";

echo"<tr><td><b>Password</b></td><td><a href=game.php?act=account>Change</a></td></tr>";


echo"</table><br>";

	
echo"<table>";
echo"<th colspan=2>Most searched terms</th>";
$result1 = mysql_query("SELECT title,search FROM `library` order by search desc limit 5");
				
			while ($array = mysql_fetch_array($result1))
			{
			$s=$array['search'];
			$title=$array['title'];

			echo"<tr><td  width=80%>".$title."</td><td>".$s."</td></tr>";
						
			}
echo"</table>";
	
echo"<br><table>";
echo"<th colspan=2>Most unknown terms</th>";
$result1 = mysql_query("SELECT term,count(term) as mode FROM `unknownterm` group by term order by mode desc limit 5");
				
			while ($array = mysql_fetch_array($result1))
			{
			$m=$array['mode'];
			$title=$array['term'];

			echo"<tr><td  width=80%>".$title."</td><td>".$m."</td></tr>";
						
			}
echo"</table>";	


echo"<br><table>";
echo"<th colspan=2>Game statistics</th>";
echo"<tr><td><b>Total games</b></td><td>".$st."</td></tr>";
echo"<tr><td><b>Completed games</b></td><td>".$sc1."</td></tr>";
echo"<tr><td><b>On going games</b></td><td>".($st-$sc1)."</td></tr>";
echo"<tr><td><b>Avg hours per round</b></td><td>".number_format($sh)."</td></tr>";
echo"<tr><td><b>Avg number of rounds</b></td><td>".number_format($sr)."</td></tr>";
echo"<tr><td><b>Total players</b></td><td>".$x."</td></tr>";


echo"</table>";
echo"</aside>";

}
// homepage for mods
if($_SESSION['mod']==1)
{
$id=$_SESSION['mid'];

echo"<h4>".$LANG['ongame']."</h4>";
echo"<section class='left-col'>";

// ongoing games
$result1 = mysql_query("SELECT id,name,no_of_rounds,start_time FROM `game` where mod_id='$id' and complete='0' ORDER BY id desc LIMIT 10");
echo"<table>";
echo"<th width=40%>".$LANG['name_game']."</th><th>".$LANG['no_of_rounds']."</th><th>".$LANG['Starttime']."</th><th>".$LANG['RESULTS']."</th>";
while ($array = mysql_fetch_array($result1))
{
//$id=$array['id'];
echo"<tr><td>".$array['name']."</td><td>".$array['no_of_rounds']."</td><td>".$array['start_time']."</td><td><a href=game.php?act=result&id=".$array['id'].">".$LANG['RESULTS']."</a></td></tr>";
}
echo"</table>";
//competed games
echo"<br><h4>".$LANG['comgame']."</h4>";
$result1 = mysql_query("SELECT id,name,no_of_rounds,start_time FROM `game` where mod_id='$id' and complete='1' ORDER BY id desc LIMIT 10");
echo"<table>";
echo"<th width=40%>".$LANG['name_game']."</th><th>".$LANG['no_of_rounds']."</th><th>".$array['start_time']."</th>";
while ($array = mysql_fetch_array($result1))
{
//$id=$array['id'];
echo"<tr><td>".$array['name']."</td><td>".$array['no_of_rounds']."</td><td>".$array['start_time']."</td><td><a href=game.php?act=result&id=".$array['id'].">".$LANG['RESULTS']."</a></td></tr>";
}
echo"</table>";
// Logs
echo"<br><h4>".$LANG['lastact']."</h4>";
$result1 = mysql_query("SELECT result,date FROM `logs` where user_id='$id' and user_name='$user_for_logs' ORDER BY id desc LIMIT 5");
echo"<table>";
echo"<th>ID</th><th>".$LANG['logs']."</th><th>".$LANG['date']."</th>";
$x=0;
while ($array = mysql_fetch_array($result1))
{
++$x;
//if ($array['result']==1) {$r="Successfully";} else {$r="Failed";}
 //$msg= substr($array['message'],0,6); 
echo"<tr><td>".$x."</td><td>".$LANG['logsmsg']." </td><td>".$array['date']."</td></tr>";
}
echo"</table>";

echo"</section>";
echo"<aside class='sidebar'>";



	$stat1 = mysql_query("SELECT count(id),avg(hours_per_round),avg(no_of_rounds) FROM `game` where mod_id='$id'");
	$st1 = mysql_fetch_array($stat1);
	$st=$st1[0];
	$sh=$st1[1];
	$sr=$st1[2];
	
	$stat1 = mysql_query("SELECT count(id) FROM `game` where mod_id='$id' and complete='1'");
	$st1 = mysql_fetch_array($stat1);
	$sc1=$st1[0];
	
	// get group name mod name
	 $result2 = mysql_query("SELECT group_id,name,phone,email,ip FROM `mod` where id='$id'");
	$row2 = mysql_fetch_array($result2);
	$name=$row2['name']; 
	$phone=$row2['phone']; 
	$email=$row2['email'];
	$ip=$row2['ip'];		
	$gid=$row2['group_id'];		
	$result2 = mysql_query("SELECT name FROM `group` where id='$gid'");
	$row2 = mysql_fetch_array($result2);
	$gname=$row2['name']; 

$result1 = mysql_query("SELECT game_id FROM `player`");
$x=0;
while ($array = mysql_fetch_array($result1))
{
//$id=$array['id'];
$gid=$array['game_id'];
	$stat1 = mysql_query("SELECT mod_id FROM `game` where id='$gid'");
	$st1 = mysql_fetch_array($stat1);
	$mid=$st1['mod_id'];
	if($mid==$id) {++$x;}
}



echo"<table>";
echo"<th colspan=2 >".$LANG['perinfo']."</th>";
echo"<tr><td ><b>".$LANG['groupname']."</b></td><td>".$gname."</td></tr>";
echo"<tr><td><b>".$LANG['name']."</b></td><td>".$name."</td></tr>";
echo"<tr><td><b>".$LANG['instructor']." ID</b></td><td>00".$id."</td></tr>";
echo"<tr><td><b>Email</td><td>".$email."</b></td></tr>";
echo"<tr><td><b>".$LANG['phoneno']."</b></td><td>".$phone."</td></tr>";
echo"<tr><td><b>IP</b></td><td>".$ip."</td></tr>";
echo"<tr><td><b>".$LANG['pass']."</b></td><td><a href=game.php?act=account>Change</a></td></tr>";


echo"</table><br>";

echo"<table>";
echo"<th colspan=2>".$LANG['mostsearched']."</th>";
$result1 = mysql_query("SELECT title,search FROM `library` order by search desc limit 5");
				
			while ($array = mysql_fetch_array($result1))
			{
			$s=$array['search'];
			$title=$array['title'];

			echo"<tr><td width=80%>".$title."</td><td>".$s."</td></tr>";
						
			}
echo"</table>";
	
echo"<br><table>";
echo"<th colspan=2>".$LANG['mostunknown']."</th>";
$result1 = mysql_query("SELECT term,count(term) as mode FROM `unknownterm` group by term order by mode desc limit 5");
				
			while ($array = mysql_fetch_array($result1))
			{
			$m=$array['mode'];
			$title=$array['term'];

			echo"<tr><td width=80%>".$title."</td><td>".$m."</td></tr>";
						
			}
echo"</table>";	
	
echo"<br><table>";
echo"<th colspan=2>".$LANG['gamestatistics']."</th>";
echo"<tr><td><b>".$LANG['totalgames']."</b></td><td>".$st."</td></tr>";
echo"<tr><td><b>".$LANG['comgame']."</b></td><td>".$sc1."</td></tr>";
echo"<tr><td><b>".$LANG['ongame']."</b></td><td>".($st-$sc1)."</td></tr>";
echo"<tr><td><b>".$LANG['avghours']."</b></td><td>".number_format($sh)."</td></tr>";
echo"<tr><td><b>".$LANG['avgnorounds']."</b></td><td>".number_format($sr)."</td></tr>";
echo"<tr><td><b>".$LANG['totalplayer']."</b></td><td>".$x."</td></tr>";


echo"</table>";
echo"</aside>";

}
// homepage for player
if($_SESSION['player']==1)
{
$id=$_SESSION['user_id'];
$gid=$_SESSION['game_id'];
$tid=$_SESSION['team_id'];

//------------------ get input theme for all inputs when blank
	// round
	$res_round = mysql_query("SELECT max(round) FROM output where game_id='$gid' and final='1' and team_id='$tid'");
 	if($res_round === FALSE) {
    die(mysql_error()); // TODO: better error handling
}
	$array_round = mysql_fetch_array($res_round);
	$round=$array_round[0];
	$round_for_input=$round+1;	
	
// get practice round
$game = mysql_query("SELECT practice_round FROM `game` where id='$gid'");
$hpr = mysql_fetch_array($game);
$pround=$hpr['practice_round'];
if ($round==$pround) {$round=0;} 
	
	$d= "SELECT deadline,id FROM `round_assumption` where game_id='$gid' and round='$round_for_input'";
	$result_d = mysql_query($d) or die(mysql_error());
	$deadline = mysql_fetch_array($result_d);
	
	$assumption_id=$deadline['id'];
	
if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
$res = mysql_query("SELECT country1, country2, country3 FROM input WHERE assumption_id ='$assumption_id' and game_id='$gid'  and player_id='$pid' and team_id='$tid' and round='$round_for_input' ");
				
if( mysql_num_rows($res) == 0) 
				{
					$result = mysql_query("SELECT * FROM `input_title`");

while ($row = mysql_fetch_array($result))
{	
					if ($row['title']=='production1' or $row['title']=='production2' or $row['title']=='outsource1' or $row['title']=='outsource2' or $row['title']=='feature_tech1' or $row['title']=='feature_tech2' or $row['title']=='feature_tech3' or $row['title']=='feature_tech4')
					{
				    $c11[$row['title']]="0,0,0,0,0,0";
					$c22[$row['title']]="0,0,0,0,0,0";
					$c33[$row['title']]="0,0,0,0,0,0";
					
					}

					else
					{
					$c11[$row['title']]=0;
					$c22[$row['title']]=0;
					$c33[$row['title']]=0;
					}
}
$transfer="1,1,1,1";
$logistic_order_c1="132,132,132,132";
$logistic_order_c2="231,231,231,231";
$investment_c1="0,0,0";
$investment_c2="0,0,0";
$c11=base64_encode(serialize($c11));
$c22=base64_encode(serialize($c22));
$c33=base64_encode(serialize($c33));
$date = date('Y-m-d H:i:s');
if($_SESSION['mod']==1 or $_SESSION['admin']==1 ){$pid=$_GET['pid'];} else {$pid=$_SESSION['id'];}
$result_input=mysql_query("INSERT INTO `input` (assumption_id,game_id,team_id,player_id,round,date,country1,country2,country3,transfer_price,logistic_order_c1,logistic_order_c2,investment_c1,investment_c2) VALUES ('$assumption_id','$gid','$tid','$pid','$round_for_input','$date','$c11','$c22','$c33','$transfer','$logistic_order_c1','$logistic_order_c2','$investment_c1','$investment_c2')  ");
$sql="INSERT INTO `input` (assumption_id,game_id,team_id,player_id,round,date,country1,country2,country3,transfer_price,logistic_order_c1,logistic_order_c2,investment_c1,investment_c2) VALUES ('$assumption_id','$gid','$tid','$pid','$round_for_input','$date','$c11','$c22','$c33','$transfer','$logistic_order_c1','$logistic_order_c2','$investment_c1','$investment_c2')  ";
$sql=mysql_real_escape_string($sql);
$t=logs($user_for_logs,$_SESSION['id'],$sql,$result_input);
//$server_header=$_SERVER['REQUEST_URI'];
 header ("Location:?act=home");
				}
//------------------  end written input theme for all inputs when blank				

// personal info
	// get username
	 $result2 = mysql_query("SELECT name,email FROM `player` where id='$id'");
	$row2 = mysql_fetch_array($result2);
	$username=$row2['name']; 
	$email=$row2['email'];		
	//team name
	$result2 = mysql_query("SELECT name FROM `team` where id='$tid'");
	$row2 = mysql_fetch_array($result2);
	$team_name=$row2['name'];


	
// current game info
	$result2 = mysql_query("SELECT name,mod_id,no_of_teams,no_of_rounds,hours_per_round,start_time FROM `game` where id='$gid'");
	$row2 = mysql_fetch_array($result2);
	$game_name=$row2['name']; 
	$mid=$row2['mod_id']; 
	
	$rounds=$row2['no_of_rounds']; 
	$hpr=$row2['hours_per_round']; 

	//mod name
	$result2 = mysql_query("SELECT name FROM `mod` where id='$mid'");
	$row2 = mysql_fetch_array($result2);
	$mname=$row2['name'];	

	//echo"<h4>Schedule</h4>";
//for remind deadline

// get current round
 	// round
	$res_round = mysql_query("SELECT max(round) FROM output where game_id='$gid' and final='1' and team_id='$tid'");
	$array_round = mysql_fetch_array($res_round);
	$round=$array_round[0];
	
	$round_for_input=$round+1;
// get practice round
$game = mysql_query("SELECT practice_round FROM `game` where id='$gid'");
$hpr = mysql_fetch_array($game);
$pround=$hpr['practice_round'];
if ($round==$pround) {$round=0;} 	
//echo $round;
	// get deadline
	$d= "SELECT deadline,id FROM `round_assumption` where game_id='$gid' and round='$round_for_input'";
	$result_d = mysql_query($d) or die(mysql_error());
	$deadline = mysql_fetch_array($result_d);
	$dline=$deadline['deadline'];
	
	// time	
	$game2 = mysql_query("SELECT hours_per_round FROM `game` where id='$gid'");
	$hpr = mysql_fetch_array($game2);
	$hours_per_round2=$hpr['hours_per_round']; 
	
	// hours left
	$date = date('Y-m-d H:i:s');
	$now = strtotime($date);
	$deadline = strtotime($dline);
	$time_diff=round(($deadline - $now)/60/60,2);
	
	if ($time_diff<0.5 and $time_diff>0)
	{	
	$m="Please submit your team decision<br> Time remaining: ".$time_diff." hours";
	$msg=message($m,0);
	echo $msg;
	}
	
	// get practice round
	$game = mysql_query("SELECT practice_round FROM `game` where id='$gid'");
	$hpr = mysql_fetch_array($game);
	$pround=$hpr['practice_round'];


	
echo"<h4>".$game_name." | ".$team_name."</h4>";
echo"<section class='left-col'>";
//round schedule

echo"<table>";
echo"<th>".$LANG['Round']."</th><th>".$LANG['deadline']."</th><th>".$LANG['hoursleft']."</th>";
for ($r=0; $r<=$rounds; $r++) 
{
if ($pround>=$r) {$pt=$LANG['practice'];} else {$pt="";}
$q = "SELECT deadline FROM `round_assumption` where game_id='$gid' and round='$r'";
$result_d = mysql_query($q) or die(mysql_error());
$deadline = mysql_fetch_array($result_d);
$dline=$deadline['deadline'];
// hours left
  $date = date('Y-m-d H:i:s');
  $now = strtotime($date);
  $deadline = strtotime($dline);
  $time_dif=round(($deadline - $now)/60/60,2);
if ($time_dif<0) {$time_dif=$LANG['end'];}
echo"<tr><td> ".$pt." ".$LANG['Round']." ".$r."</td><td>".$dline."</td><td>".$time_dif."</td></tr>";
}
echo"</table>";

// last round result

echo"<br><h4>".$LANG['lastroundresult']."</h4>";


$result = mysql_query("SELECT * FROM `output` where game_id='$gid' and round='$round' and final='1'");
echo "<table>"; 
echo "<th>ID</th><th>".$LANG['TEAM'].$LANG['name']."</th><th>".$LANG['revenue']."</th><th>".$LANG['costs']."</th><th>".$LANG['pb4t']."</th><th>".$LANG['cumreturn']."</th>";

while ($row = mysql_fetch_array($result))
{
 $teid=$row['team_id'];
 $result2 = mysql_query("SELECT name FROM `team` where id='$teid'");
 $row2 = mysql_fetch_array($result2);
 $name=$row2['name'];
 // Get date from string
 $output_c1=$row['output_c1'];
 $output_c2=$row['output_c2'];
 $output_c3=$row['output_c3'];
 $output_c1 = preg_split("/[\s,]+/",$output_c1);
 $output_c2 = preg_split("/[\s,]+/",$output_c2);
 $output_c3 = preg_split("/[\s,]+/",$output_c3);
 
 $cost=(int)$output_c1[12]+(int)$output_c2[12]+(int)$output_c3[12];
 $revenue=(int)$output_c1[3]+(int)$output_c2[3]+(int)$output_c3[3];
 $profit=(int)$output_c1[17]+(int)$output_c2[17]+(int)$output_c3[17];
 $cumreturn=(int)$output_c1[46]+(int)$output_c2[46]+(int)$output_c3[46];
 $cost=number_format($cost);
 $revenue=number_format($revenue);
 //$profit=number_format($profit);
 if($profit<0){$class="neg";$profit="(".number_format(abs($profit)).")";} else{$class="pos";$profit=number_format($profit);}
 
 echo"<tr><td>".$tid."</td><td>".$name."</td><td class=pos>".$revenue."</td><td class=pos>".$cost."</td><td class=".$class.">".$profit."</td><td class=reight>".$cumreturn."</td></tr>";
}
echo "</table>";
  

// end last round result

//logs

echo"<br><h4>".$LANG['lastact']."</h4>";
echo"<table>";
echo"<th>ID</th><th>".$LANG['logs']."</th><th>".$LANG['date']."</th>";


$result1 = mysql_query("SELECT result,date FROM `logs` where user_id='$id' and user_name='$user_for_logs' ORDER BY id desc LIMIT 5 ");
$x=0;
while ($array = mysql_fetch_array($result1))
{
++$x;
//if ($array['result']==1) {$r="Successfully";} else {$r="Failed";}
 //$msg= substr($array['message'],0,6); 
echo"<tr><td>".$x."</td><td>".$LANG['logsmsg']."</td><td> ".$array['date']."</td></tr>";
}
echo"</table>";

echo"<br><h4>".$LANG['teamdecision']."</h4>";

	echo"<table>";
	echo"<TH>".$LANG['teamdecision']."</th><th width=15%>".$LANG['PLAYERS']."</th><th>".$LANG['date']."</th><th>".$LANG['revenue']."</th><th>".$LANG['costs']."</th><th>".$LANG['ebitda']."</th>";
	
	$res_round = mysql_query("SELECT max(round) FROM output where game_id='$gid' and final='1'");
	$array_round = mysql_fetch_array($res_round);
	$round=$array_round[0];
	$round_for_input=$round+1;
	//echo $round_for_input;
	$result = mysql_query("SELECT id,name FROM `player` where game_id='$gid' and team_id='$tid'");
	if($result === FALSE) { die(mysql_error()); }
	$x=0;
	while ($row = mysql_fetch_array($result))
	{
	
	++$x;
	$name=$row['name'];
	$pid=$row['id'];
	if ($pid==$_SESSION['id']) {$b="<b>";$c="</b>";} else {$b="";$c="";}
	//echo $pid;
	$decision = mysql_query("SELECT id,team_decision FROM input WHERE game_id='$gid' and player_id='$pid' and round='$round_for_input' and team_decision='1'");
	$de = mysql_fetch_array($decision);
	//echo $decision;
	if( mysql_num_rows($decision) == 1) 
	{
	//echo "hello";
	$input_id=$de['id'];
	$td=$de['team_decision'];
	//echo $td;
	//echo $input_id."sdds";
	$result2 = mysql_query("SELECT date,revenue,cost,ebitda FROM `checklist` where input_id='$input_id'");
	$row2 = mysql_fetch_array($result2);
	$grev=number_format($row2['revenue']);
	$gcost=number_format($row2['cost']);
	$gebitda=number_format($row2['ebitda']);
	$pdate=$row2['date'];
	
	//$lod="Yes";
	$class="pos";
	
	
	}
	else
	{
	//$lod="No";
	$pdate="-";
	$class="neg";
	$grev="-";
	$gcost="-";
	$gebitda="-";
	$td=0;
	}
	if ($td==1) {$img="imgs/icon-tick.png";} else {$img="imgs/icon-cross.png";}
	echo"<tr><td><img style='width:10px;height:10px' src='".$img."'></td><td>".$b."".$name."".$c."</td><td class=right>".$pdate."</td><td class=right>".($grev)."</td><td class=right>".($gcost)."</td><td class=right>".($gebitda)."</td></tr>";
	}

	echo"</table>";
echo"<br>";
echo"</section>";
echo"<aside class='sidebar'>";

	
// team info/players info
$date = date('Y-m-d H:i:s');
echo"<table>";
echo"<th colspan=2>".$LANG['perinfo']."</th>";
echo"<tr><td><b>".$LANG['name']."</b></td><td>".$username."</td></tr>";
echo"<tr><td><b>".$LANG['student']." ID</b></td><td>00".$id."</td></tr>";
echo"<tr><td><b>Email</b></td><td>".$email."</td></tr>";
echo"<tr><td><b>".$LANG['pass']."</b></td><td><a href=game.php?act=account>".$LANG['change']."</a></td></tr>";
echo"<tr><td><b>".$LANG['currenttime']."</b></td><td>".$date."</td></tr>";
echo"</table>";

//game name
echo"<br><table>";
echo"<th colspan=2>".$LANG['courseinfo']."</th>";
echo"<tr><td><b>".$LANG['course']."</b></td><td>".$game_name."</td></tr>";
echo"<tr><td><b>".$LANG['course']." ID</b></td><td>".$gid."</td></tr>";
echo"<tr><td><b>".$LANG['instructor']."</b></td><td>".$mname."</td></tr>";
echo"<tr><td><b>".$LANG['TEAM']."</b></td><td>".$team_name."</td></tr>";
echo"</table>";
//player info

//team info
$result1 = mysql_query("SELECT name FROM `player` where team_id='$tid'");
$x=0;
echo"<br><table>";
echo"<th colspan=2>".$LANG['PLAYERS']."</th>";
while ($array = mysql_fetch_array($result1))
{
++$x;
$nt=$array['name'];
echo"<tr><td width=20%>".$x."</td><td>".$nt."</td></tr>";
}
echo"</table>";

//team info
$result1 = mysql_query("SELECT name,id FROM `team` where game_id='$gid'");
$x=0;
echo"<br><table>";
echo"<th colspan=3>".$game_name."</th>";
while ($array = mysql_fetch_array($result1))
{
++$x;
$nt=$array['name'];
if ($array['id']==$_SESSION['team_id'])
{
$change="<a href=game.php?act=account>".$LANG['edit']."</a>";
}
else
{
$change="";
}
echo"<tr><td> ".$LANG['TEAM']." ".$x."</td><td>".$nt."</td><td>".$change."</td></tr>";
}
echo"</table>";


echo"</aside>";


}

}
?>				
		

<?php
if($_GET['act']=='account')
{
// print mismatch pass
if(isset($_GET['mis']))
{
	$m=$LANG['passmiss'];
	$msg=message($m,0);
	echo $msg;
}	

// change password
if(isset($_POST['change']) and isset($_POST['id'])  and !isset($_POST['team_name']))
{

if($_POST['change']=='1')
{
$id=$_POST['id'];
$pw1=$_POST['password1'];
$pw2=$_POST['password2'];
if ($pw1==$pw2 and $pw1!="")
{

// check session

		if($_SESSION['mod']==1 and $_SESSION['mid']==$id)
		{
		$sql="UPDATE `mod` SET password='$pw1' where id='$id'";
		$result = mysql_query($sql); 
		$sql=mysql_real_escape_string($sql);  
		$t=logs($user_for_logs,$_SESSION['id'],$sql,$result);
	//$m="Password changed successfully!";
	//$msg=message($m,1);
	//echo $msg;
		header ("Location:?act=account");
		}
		if($_SESSION['player']==1 and $_SESSION['user_id']==$id)
		{
		$sql="UPDATE `player` SET password='$pw1' where id='$id'";
		$result = mysql_query($sql); 
		$sql=mysql_real_escape_string($sql);  
		$t=logs($user_for_logs,$_SESSION['id'],$sql,$result);	
		//$m="Password changed successfully!";
		//$msg=message($m,1);
		//echo $msg;	
		header ("Location:?act=account");		
		}
		
		
}
else
{
header ("Location:?act=account&mis=");
}
}
//change team name for player


}
if(isset($_POST['teamname']) and isset($_POST['team_name']))
{
$tname=$_POST['team_name'];
$tname=mysql_real_escape_string($tname); 

		if($_SESSION['player']==1)
		{
		 $uid=$_SESSION['user_id'];
		$q = "SELECT team_id FROM `player` where id='$uid'";
		$result_d = mysql_query($q) or die(mysql_error());
		$acc = mysql_fetch_array($result_d);
		$teamid=$acc['team_id'];
		
		$sql="UPDATE `team` SET name='$tname' where id='$teamid'";
		$result = mysql_query($sql); 
		$date = date('Y-m-d H:i:s');
		$sql=mysql_real_escape_string("At"."".$date.",".$LANG['successfully']." changed name to ".$tname);  
		$t=logs($user_for_logs,$_SESSION['id'],$sql,$result);	
		//$m="Password changed successfully!";
		//$msg=message($m,1);
		//echo $msg;	
		header ("Location:?act=account");		
		}
		
}
// for admin
if($_SESSION['admin']==1)
{
$id=$_SESSION['aid'];
$q = "SELECT name,email FROM `mod` where id='$id'";
$result_d = mysql_query($q) or die(mysql_error());
$acc = mysql_fetch_array($result_d);
$name=$acc['name'];
$email=$acc['email'];
}
// for mod
if($_SESSION['mod']==1)
{

$id=$_SESSION['mid'];
$q = "SELECT name,email FROM `mod` where id='$id'";
$result_d = mysql_query($q) or die(mysql_error());
$acc = mysql_fetch_array($result_d);
$name=$acc['name'];
$email=$acc['email'];
}
// for player
if($_SESSION['player']==1)
{

$id=$_SESSION['user_id'];
$q = "SELECT name,email,team_id FROM `player` where id='$id'";
$result_d = mysql_query($q) or die(mysql_error());
$acc = mysql_fetch_array($result_d);
$name=$acc['name'];
$email=$acc['email'];
$tid=$acc['team_id'];
//team name
$q = "SELECT name FROM `team` where id='$tid'";
$result_d = mysql_query($q) or die(mysql_error());
$acc = mysql_fetch_array($result_d);
$tname=$acc['name'];

}
echo"<form action='?act=account' method='POST'>";
echo"<table>";
echo"<th width=50%>".$LANG['perinfo']."</th><th></th>";
echo"<tr><td>".$LANG['name']."</td><td>".$name."</td></tr>";
echo"<tr><td>Email</td><td>".$email."</td></tr>";
echo"<tr><td>".$LANG['pass']."</td><td><input type=\"password\" name='password1' id=\"password\" value=\"password\" onBlur=\"if(this.value=='')this.value='password'\" onFocus=\"if(this.value=='password')this.value=''\"></td></tr>";
echo"<tr><td>".$LANG['repass']."</td><td><input type=\"password\" name='password2' id=\"password\" value=\"password\" onBlur=\"if(this.value=='')this.value='password'\" onFocus=\"if(this.value=='password')this.value=''\"></td></tr>";
echo"<tr ><td colspan=2><input class=submit type=\"submit\" value=".$LANG['change']."></td></tr>";
echo"<input type='hidden' name='change' value='1' />";
echo"<input type='hidden' name='id' value='$id' />";
echo"</table></form>";
if($_SESSION['player']==1)
{
echo"<form action='?act=account' method='POST'>";
echo"<br><table>";
echo"<th width=50%>".$LANG['teaminfo']."</th><th></th>";
echo"<tr><td>".$LANG['name']."</td><td>".$tname."</td></tr>";
echo"<tr><td>".$LANG['rename']."</td><td><input type=\"text\" name='team_name' value=''></td></tr>";
echo"<tr><td colspan=2><input class=submit type=\"submit\" value=".$LANG['change']."></td></tr>";
echo"<input type='hidden' name='teamname' value='1' />";
echo"</table></form>";
}
}
?>
<?php
	if ($_GET['act']=='content')	
{
		if ($_SESSION['admin']==1)
		{
		//present table content
		if (!isset($_POST['post']))
		{
		$result1 = mysql_query("SELECT * FROM `content`");
			echo"<h4>Content management</h4>";
			echo"<table>";
			echo"<th>Id</th><th>Title</th><th>Page</th><th>Content EN</th><th>Content VN</th><th>View</th><th>Date</th><th>Action</th>";			
			while ($array = mysql_fetch_array($result1))
			{
			$id=$array['id'];
			$title=$array['title'];
			$content_en=$array['content_en'];
			$content_vn=$array['content_vn'];
			$content_en=str_replace('<', "", $content_en);
			$content_en=str_replace('>', "", $content_en);
			$content_vn=str_replace('<', "", $content_vn);
			$content_vn=str_replace('>', "", $content_vn);
			$content_en= substr($content_en,0,20);
			$content_vn= substr($content_vn,0,20);			
			$page=$array['page'];
			$date=$array['date'];
			$view=$array['view'];
			
			echo"<tr><td>".$id."</td><td>".$title."</td><td>".$page."</td><td>".$content_en."</td><td>".$content_vn."</td><td>".$view."</td><td>".$date."</td><td><a href=game.php?act=content&cid=".$id.">Edit</a></td></tr>";
						
			}
			echo"</table>";
		//present form
			if ($_GET['act']=='content')	
			{
			if(!isset($_GET['cid'])) {echo"<br><h4>Post new content</h4>";echo " &nbsp;&nbsp; <a href='?act=content'>[ Add new ]</a>";}
			else {echo"<br><h4>Edit Post</h4>";}
			// get data to edit
			if(isset($_GET['cid'])){
			$idf=$_GET['cid'];
			$result0 = mysql_query("SELECT title,page,content_en,content_vn FROM `content` where id=$idf");
			$edit = mysql_fetch_array($result0);
			$tt=$edit['title'];
			$pp=$edit['page'];
			$cc_en=$edit['content_en'];
			$cc_vn=$edit['content_vn'];
			$post=2;
			$sub="Edit";
			} else 
			{
			$tt="";
			$pp="";
			$cc_en="";
			$cc_vn="";
			$post=1;
			$idf="";
			$sub="Add";
			}
			
			echo"<form action='game.php?act=content' method='POST'>";
			echo"<table>";
			echo"<th>Post management</th><th></th>";
			echo"<tr><td>Title</td><td><input type='text' value='".$tt."' name='title' /></td></tr>";
			echo"<tr><td>Page</td><td><input type='text' value='".$pp."' name='page' /></td></tr>";
			echo"<tr><td colspan=2>For EN<textarea width=100% rows=50 name='content_en' />".$cc_en."</textarea></td></tr>";
			echo"<tr><td colspan=2>For VN<textarea width=100% rows=50 name='content_vn' />".$cc_vn."</textarea></td></tr>";
			echo"<tr><td colspan=2><input class=submit type=submit value='".$sub."' /></td></tr>";
			echo"<input type='hidden' value='".$post."' name='post' />";
			echo"<input type='hidden' value='".$idf."' name='idf' />";
			echo"</table>";
			echo"</form>";
			}
			}
		//insert form	
			if ($_GET['act']=='content' and isset($_POST['post']))	
			{
			if (($_POST['post'])==1 and isset($_POST['content_en']) and isset($_POST['title']) and isset($_POST['page']) )
		{			
			$title=$_POST['title'];
			$page=$_POST['page'];
			$content_en=$_POST['content_en'];
			$content_vn=$_POST['content_vn'];
			//$content=str_replace('"', "", $content);
			//$content=str_replace("'", "", $content);
			$content=mysql_real_escape_string($content);
			$date = date('Y-m-d H:i:s');
			//echo $date;
			$sql="INSERT INTO `content` (title,page,content_en,content_vn,date,view) VALUES ('$title','$page','$content_en','$content_vn','$date',0)";
			$result = mysql_query($sql);  //order executes 
			$sql=mysql_real_escape_string($sql);  
			//echo $result;
			$t=logs($user_for_logs,$_SESSION['id'],$sql,$result);
			header ("Location:game.php?act=content");	
		}
			}			
		// update form
			if ($_GET['act']=='content' and isset($_POST['post']))	
			{
			if (($_POST['post'])==2 and isset($_POST['content_en']) and isset($_POST['title']) and isset($_POST['page']))
		{						
			$id=$_POST['idf'];
			$title=$_POST['title'];
			$page=$_POST['page'];
			$content_en=$_POST['content_en'];
			$content_vn=$_POST['content_vn'];
			//$content=str_replace('"', "", $content);
			//$content=str_replace("'", "", $content);
			//$content=str_replace("\n", "<br>", $content);
			$content_en=mysql_real_escape_string($content_en);
			$content_vn=mysql_real_escape_string($content_vn);
			//$date = date('Y-m-d H:i:s');
			//echo $date;
			$sql="UPDATE `content` SET title='$title',page='$page',content_en='$content_en',content_vn='$content_vn' where id='$id'";
			$result = mysql_query($sql); 
			$sql=mysql_real_escape_string($sql);  
			//$sql="INSERT INTO `content` (title,page,content,date,view) VALUES ('$title','$page','$content','$date',0)";
			//$result = mysql_query($sql);  //order executes 
			//echo $result;
			$t=logs($user_for_logs,$_SESSION['id'],$sql,$result);
			//echo $t;
			header ("Location:game.php?act=content&cid=$id");	
		}			
			}		
			
			
		}
}		
?>		


<?php
if ($_GET['act']=='lib')	
{
		if ($_SESSION['admin']==1 or $_SESSION['mod']==1)
		{
		//present table of libs
		if (!isset($_POST['post']))
		{
		$result1 = mysql_query("SELECT * FROM `library`");
			echo"<h4>".$LANG['termmanage']."</h4>";
			echo"<table>";
			echo"<th>Id</th><th>".$LANG['term']."</th><th>".$LANG['descript']."</th><th".$LANG['search']."</th><th>".$LANG['date']."</th><th>".$LANG['action']."</th>";			
			while ($array = mysql_fetch_array($result1))
			{
			$id=$array['id'];
			$title=$array['title'];
			$content=$array['description'];
			$content= substr($content,0,25); 
			
			$date=$array['date'];
			$search=$array['search'];
			
			echo"<tr><td>".$id."</td><td>".$title."</td><td>".$content."</td><td>".$search."</td><td>".$date."</td><td><a href=game.php?act=lib&lid=".$id.">Edit</a></td></tr>";
						
			}
			echo"</table>";
		}	
		//present form
			if ($_GET['act']=='lib')	
			{
			if(!isset($_GET['lid'])) {echo"<br><h4>".$LANG['newterm']."</h4>";}
			else {echo"<br><h4>".$LANG['editterm']."</h4>";}
			// get data to edit
			if(isset($_GET['lid'])){
			$idf=$_GET['lid'];
			$result0 = mysql_query("SELECT title,description FROM `library` where id=$idf");
			$edit = mysql_fetch_array($result0);
			$tt=$edit['title'];
			$cc=$edit['description'];
			$post=2;
			$sub=$LANG['edit'];
			} else 
			{
			$tt="";
			$cc="";
			$post=1;
			$idf="";
			$sub=$LANG['add'];
			}
			
			echo"<form action='game.php?act=lib' method='POST'>";
			echo"<table>";
			echo"<th>".$LANG['termmanage']."</th><th></th>";
			echo"<tr><td>".$LANG['term']."</td><td><input type='text' value='".$tt."' name='title' /></td></tr>";
			echo"<tr><td>".$LANG['descript']."</td><td><textarea rows=20 name='content' />".$cc."</textarea></td></tr>";
			echo"<tr><td colspan=2><input class=submit type=submit value='".$sub."' /></td></tr>";
			echo"<input type='hidden' value='".$post."' name='post' />";
			echo"<input type='hidden' value='".$idf."' name='idf' />";
			echo"</table>";
			echo"</form>";
			}
		//insert form	
			if ($_GET['act']=='lib' and isset($_POST['post']))	
			{
			if (($_POST['post'])==1 and isset($_POST['content']) and isset($_POST['title']))
		{			
			$title=$_POST['title'];
			$content=$_POST['content'];
			$content=str_replace('"', "", $content);
			$content=str_replace("'", "", $content);
			$content=mysql_real_escape_string($content);
			$date = date('Y-m-d H:i:s');
			//echo $date;
			$sql="INSERT INTO `library` (title,description,date,search) VALUES ('$title','$content','$date',0)";
			$result = mysql_query($sql);  //order executes 
			$sql=mysql_real_escape_string($sql);  
			//echo $result;
			$t=logs($user_for_logs,$_SESSION['id'],$sql,$result);
			header ("Location:game.php?act=lib");	
		}
			}			
		// update form
			if ($_GET['act']=='lib' and isset($_POST['post']))	
			{
			if (($_POST['post'])==2 and isset($_POST['content']) and isset($_POST['title']))
		{						
			$id=$_POST['idf'];
			$title=$_POST['title'];
			$content=$_POST['content'];
			$content=str_replace('"', "", $content);
			$content=str_replace("'", "", $content);
			$content=mysql_real_escape_string($content);
			//$date = date('Y-m-d H:i:s');
			//echo $date;
			$sql="UPDATE `library` SET title='$title',description='$content' where id='$id'";
			$result = mysql_query($sql); 
			$sql="Update date content".$id;  
			$t=logs($user_for_logs,$_SESSION['id'],$sql,$result);
			//$sql="INSERT INTO `content` (title,page,content,date,view) VALUES ('$title','$page','$content','$date',0)";
			//$result = mysql_query($sql);  //order executes 
			//echo $result;
			
			header ("Location:game.php?act=lib");	
		}			
			}		
			
			
		}
}
?>		
      		</div> <!-- END Featured !!!!!!!!!KEEP THIS-->
	


<?php
// for content 			
			 if(isset($_GET['act']))
  {
  $page=$_GET['act'];
  $lang=$_SESSION['lang'];
  $contentdb="content_".$lang;
  $result1 = mysql_query("SELECT title,".$contentdb." FROM `content` where page='$page'");
  $array = mysql_fetch_array($result1);
  $title=$array['title'];

  
  $content=$array[$contentdb];
  $content=str_replace("\n", "<br>", $content);
  if ($page!='case' and $page!='logs' and $page!='guide') {echo"<div class='clearfix'></div>";
  echo"<hr class=normal><div id='about'>";}
   if ($page=='case')  { echo"<div id='about'>";}
   //if (!isset($LANG[$title])) {$LANG[$title]="";}
 if ($page!='guide' and $page!='case' ){  echo "<h6>".$LANG['hint']."</h6>";} 
 if ($page=='guide' ) { echo "<h6>".$LANG['Guide']."</h6>";}
  if ($page=='case' ) { echo "<h6>".$LANG['Case']."</h6>";}
   if ($page!='case' and $page!='logs' and $page!='guide') {echo "<div class='note2 grey'>".$content."</div>";}
   else {echo $content;}
  }
?>	
<?php
if($_SESSION['admin']==1 and $_GET['act']=='logs')
{
echo "<div id='featured'>";
echo"<br><h4>Last activity</h4>";
$result1 = mysql_query("SELECT message,result FROM `logs` ORDER BY id desc");
echo"<table>";
echo"<th>ID</th><th>Logs</th><th>Result</th>";
$x=0;
while ($array = mysql_fetch_array($result1))
{
++$x;
if ($array['result']==1) {$lod="imgs/icon-tick.png";} else {$lod="imgs/icon-cross.png";}

$email=$array['message'];
			$email=str_replace('"', "", $email);
			$email=str_replace('<', "", $email);
			$email=str_replace('>', "", $email);
			$email=str_replace("'", "", $email);
			$email=mysql_real_escape_string($email);
 $msg= substr($email,0,100); 
echo"<tr><td>".$x."</td><td>".$msg."</td><td><img style='width:10px;height:10px' src='".$lod."'></td></tr>";
}
echo"</table>";
echo"</div>";
}
?>		
			</div>		


			
			</section>	
	<br>
	<div class="clearfix"></div>
	

		
	</div> <!-- END Wrapper -->
<?php include('footer.php');?>		
</body>

</html>
</html>