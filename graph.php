<?php
$connection = mysql_connect('localhost', 'root', 'root');
if (!$connection){
    die("Database Connection Failed" . mysql_error());
}
$select_db = mysql_select_db('simulation');
if (!$select_db){
    die("Database Selection Failed" . mysql_error());
}


if (isset($_GET['id']) and $_GET['c'] and !isset($_GET['cost']))
{
require_once 'phplot.php';


$id=$_GET['id'];
$c=$_GET['c'];
// get tech avai
$tvai = mysql_query("SELECT tech_avai_c1,tech_avai_c2,tech_avai_c3 FROM game where id='$id'");
$techavai = mysql_fetch_array($tvai);
$tvai1=$techavai['tech_avai_c1'];				
$tvai2=$techavai['tech_avai_c2'];				
$tvai3=$techavai['tech_avai_c3'];		
$tvai1=unserialize($tvai1);
$tvai2=unserialize($tvai2);
$tvai3=unserialize($tvai3);
if ($c==1)
{
//c1
$t1c1=$tvai1['tech1'];
$t1c1 = preg_split("/[,]+/",$t1c1);
$t2c1=$tvai1['tech2'];
$t2c1 = preg_split("/[,]+/",$t2c1);
$t3c1=$tvai1['tech3'];
$t3c1 = preg_split("/[,]+/",$t3c1);
$t4c1=$tvai1['tech4'];
$t4c1 = preg_split("/[,]+/",$t4c1);
//$name="US";
}
if ($c==2)
{
//c1
$t1c1=$tvai2['tech1'];
$t1c1 = preg_split("/[,]+/",$t1c1);
$t2c1=$tvai2['tech2'];
$t2c1 = preg_split("/[,]+/",$t2c1);
$t3c1=$tvai2['tech3'];
$t3c1 = preg_split("/[,]+/",$t3c1);
$t4c1=$tvai2['tech4'];
$t4c1 = preg_split("/[,]+/",$t4c1);
//$name="ASIA";
}
if ($c==3)
{
//c1
$t1c1=$tvai3['tech1'];
$t1c1 = preg_split("/[,]+/",$t1c1);
$t2c1=$tvai3['tech2'];
$t2c1 = preg_split("/[,]+/",$t2c1);
$t3c1=$tvai3['tech3'];
$t3c1 = preg_split("/[,]+/",$t3c1);
$t4c1=$tvai3['tech4'];
$t4c1 = preg_split("/[,]+/",$t4c1);
//$name="EU";
}

$comma=explode(",",$tvai1['tech1']);
$no_value=count($comma)-1;

$plot = new PHPlot(240,200);


//plot->SetTitle($name);
$plot->SetXTitle('Round');
$plot->SetYTitle('Percentage');
$data=array();
for ($x=0; $x<=$no_value; $x++) 
{
$t=$x+1;

$data[]=array($t,$t1c1[$x],$t2c1[$x],$t3c1[$x],$t4c1[$x]);

}
$plot->SetLegendPixels(150,100);
$plot->SetTransparentColor('white');
$plot->SetDataColors(array('DimGrey', 'maroon', 'orange','YellowGreen'));
//$plot->SetLegendPosition(0,1,'image',0,1,-5,5);
//$legend = array("Tech 1","Tech 2","Tech 3","Tech 4");
//$plot->SetLegend($legend);
//$plot->SetLegend('Tech 2');
//$plot->SetLegend('Tech 3');
//$plot->SetLegend('Tech 4');
$plot->SetXTickLabelPos('none');
$plot->SetXTickPos('none');
$plot->SetDataValues($data);
//$plot->SetDataType('data-data');
$plot->DrawGraph();
}
if (isset($_GET['a1']) and $_GET['a2'] and $_GET['a3']  and $_GET['a4']and isset($_GET['cost']))
{
$a1=$_GET['a1'];
$a2=$_GET['a2'];
$a3=$_GET['a3'];
$a4=$_GET['a4'];
require_once 'phplot.php';
$plot = new PHPlot(700,300);
//$plot->SetTitle("Capacity Utilisation");
$plot->SetXTitle('Capacity in percentage');
$plot->SetYTitle('Cost multiplier');
$data=array();
for ($x=0; $x<=100; $x++) 
{

$p=pow($x/100*$a1,$a2)+$x/100*$a3+$a4;
if ($x%10==0)
{
$data[]=array($x,$p);
}
else
{
$data[]=array('',$p);
}
}
$plot->SetTransparentColor('white');
$plot->SetXTickLabelPos('none');
$plot->SetXTickPos('none');
$plot->SetDataValues($data);
//$plot->SetDataType('data-data');
$plot->DrawGraph();
}
if (isset($_GET['result']) and isset($_GET['gid']) and isset($_GET['round']) and isset($_GET['country']) and isset($_GET['tech']))
{
$gid=$_GET['gid'];
$rid=$_GET['round'];
$c=$_GET['country'];
$t=$_GET['tech']-1;




$result = mysql_query("SELECT team_id FROM `output` where game_id='$gid' and round='$rid'");
while ($row = mysql_fetch_array($result))
{
 $tid=$row['team_id'];
 $result2 = mysql_query("SELECT name FROM `team` where id='$tid'");
 $row2 = mysql_fetch_array($result2);
 $name=$row2['name'];
if ($c!=4)

	{
$tmarket="tmarketshare_c".$c;
   $result2 = mysql_query("SELECT ".$tmarket." FROM output where game_id='$gid' and team_id='$tid' and round=$rid");
   $array2 = mysql_fetch_array($result2);
   $tshare=$array2[$tmarket];	
   $tshare= preg_split("/[,]+/", $tshare);
   $share=$tshare[$t];
   //echo $share;
   $data[]=array($name,$share);
   $tshare=number_format($share);   
$datalegend[]=array($name,$tshare); 
   }
else 
   {

   $result2 = mysql_query("SELECT tmarketshare_c1,tmarketshare_c2,tmarketshare_c3 FROM output where game_id='$gid' and team_id='$tid' and round=$rid");
   $array2 = mysql_fetch_array($result2);
   $tshare1=$array2['tmarketshare_c1'];	
   $tshare1= preg_split("/[,]+/", $tshare1);
   $share1=$tshare1[$t];
   
   $tshare2=$array2['tmarketshare_c2'];	
   $tshare2= preg_split("/[,]+/", $tshare2);
   $share2=$tshare2[$t];
   
   $tshare3=$array2['tmarketshare_c3'];	
   $tshare3= preg_split("/[,]+/", $tshare3);
   $share3=$tshare3[$t];
   
   $tshare=$share3+$share2+$share1;
   
   //echo $share;
   $data[]=array($name,$tshare); 

$tshare=number_format($tshare);   
$datalegend[]=array($name,$tshare); 
   }
}




require_once 'phplot.php';


$plot = new PHPlot(800,600);
//$plot->SetImageBorderType('plain');

$plot->SetPlotType('pie');
$plot->SetDataType('text-data-single');
$plot->SetDataValues($data);
$plot->SetTransparentColor('white');
# Set enough different colors;
$plot->SetDataColors(array('YellowGreen', 'maroon', 'orange','DimGrey','red', 'green', 'blue', 'yellow', 'cyan',
                        'magenta', 'brown', 'lavender', 'pink',
                        'gray', 'orange'));
$plot->SetNumberFormat('.', ',');
# Main plot title:
//$plot->SetTitle("World Gold Production, 1990\n(1000s of Troy Ounces)");

# Build a legend from our data array.
# Each call to SetLegend makes one line as "label: value".
foreach ($datalegend as $row)
  $plot->SetLegend(implode(': ',$row));
# Place the legend in the upper left corner:
$plot->SetLegendPixels(5, 5);

$plot->DrawGraph();

}
if (isset($_GET['graph']) and isset($_GET['gid']) and isset($_GET['draw']))
{
$gid=$_GET['gid'];
$draw=$_GET['draw'];
if ($draw==1) {$x=3;}	//revenue
if ($draw==2) {$x=12;}	//cost
if ($draw==3) {$x=19;} 	//profit
if ($draw==4) {$x=43;}  //share price


	$result1 = mysql_query("SELECT distinct(round) as round FROM `output`  where game_id=$gid");
// get practice round
$game = mysql_query("SELECT practice_round FROM `game` where id='$gid'");
$hpr = mysql_fetch_array($game);
$pround=$hpr['practice_round'];


$y=0;
$team=0;
	while ($row1 = mysql_fetch_array($result1))
{

$round=$row1['round'];
$round1="array".$round;
$result = mysql_query("SELECT team_id,output_c1,output_c2,output_c3,round FROM `output`  where game_id='$gid' and round='$round' order by team_id asc");
if ($pround>$round) {$pt="Trial ";} else {$pt="";}
$$round1=$pt.$round;


//$datar="data".$round;
//$$datar=array();

while ($row = mysql_fetch_array($result))
{

 $tid=$row['team_id'];
 $result2 = mysql_query("SELECT name FROM `team` where id='$tid'");
 $row2 = mysql_fetch_array($result2);
 $name=$row2['name'];
if ($y==0)
{
++$team;
//echo $team;
 if (!isset($legend)) {$legend=$name;} else  {$legend=$legend.",".$name;}
}
 // Get date from string
 $output_c1=$row['output_c1'];
 $output_c2=$row['output_c2'];
 $output_c3=$row['output_c3'];
 $output_c1 = preg_split("/[\s,]+/",$output_c1);
 $output_c2 = preg_split("/[\s,]+/",$output_c2);
 $output_c3 = preg_split("/[\s,]+/",$output_c3);
 if ($draw!=4)
 { $cost=(int)$output_c1[$x]+(int)$output_c2[$x]+(int)$output_c3[$x];}
 else {$cost=(int)$output_c1[$x];}
 
 //$cost=number_format($cost);
 $$round1=$$round1.",".$cost;
 //$$datar=array($cost);

}
++$y;
}
$y=$y-1;
$data=array();
	for ($t=0; $t<=$y; $t++) 
	{
	$round1="array".$t;
	//echo $$round1."<br>";
	$$round1= preg_split("/[,]+/", $$round1);
	//if ($t==0)
	//	{$data[]=array($$round1);}
	//else 
		array_push($data,$$round1);
	}
//echo $r;
//echo $legend;
 $legend= preg_split("/[,]+/", $legend);
//foreach ($r as $ro =>$r):
//$datar="data".$ro;
//	foreach ($$datar as $k =>$$datar):
//	$dataarray[$r][]=$$datar;
//	endforeach;
//endforeach;	
//echo $team;
//echo '<pre>'.print_r ($data,1).'</pre>';
//echo $drawdata;
//Include the code
require_once 'phplot.php';
//function pre_plot($img)
//{
//    imageantialias($img, True);
//}
//Define the object
$plot = new PHPlot_truecolor(800,400);

//Set titles
//$plot->SetTitle("A 3-Line Plot\nMade with PHPlot");
$plot->SetXTitle('Round');
$plot->SetYTitle('US dollar');
$plot->SetTransparentColor('white');
$plot->SetYLabelType('data', 0);
$plot->SetNumberFormat('.', ',');
$plot->SetDataValues($data);
//$plot->SetLegendPixels(150,100);
//Turn off X axis ticks and labels because they get in the way:
$plot->SetXTickLabelPos('none');
$plot->SetXTickPos('none');
//$plot->SetXLabelType($data, 2);
//$legend = array("Tech 1","Tech 2","Tech 3","Tech 4");
//$team=$team-1;
$plot->SetDataColors(array('YellowGreen', 'maroon', 'orange','DimGrey','red', 'green', 'blue', 'yellow', 'cyan',
                        'magenta', 'brown', 'lavender', 'pink',
                        'gray', 'orange'));
//$plot->SetFontTTF('x_title', 'VERDANA', 14);
//$plot->SetFontTTF('title', 'ARIALBI.TTF', 14);
$plot->SetFont('x_title', 5, 5); 
$plot->SetFont('y_title', 5, 5); 
$plot->SetFont('x_label', 4, 4);
$plot->SetFont('y_label', 4, 4);
$plot->SetPlotBorderType('none');
//	$plot->SetLegend($legend);
//	for ($t=0; $t<=$team; $t++) 
//	{
//	$name=$legend[$t];
//	$plot->SetLegend($name);
//	}
$plot->SetLegend($legend);
//$plot->SetLegend('Tech 2');
//$plot->SetLegend('Tech 3');
//$plot->SetLegend('Tech 4');

//Draw it
$plot->DrawGraph();
	

}
?>