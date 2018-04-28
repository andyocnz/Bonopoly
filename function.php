<?php
function output_round0($c,$price,$sale,$var_cost,$los_cost,$promotion,$depreciation,$asset_value,$admin_cost,$receivable,$payble,$tax,$inventory,$share_cap,$longterm_loan,$interest)
{

$output_Pnl_sales_revenue=$price*$sale;

$output_Pnl_variable_production_cost=$var_cost*$sale;
$output_PnL_feature_cost=0;
$output_Pnl_transportation=$sale*$los_cost;
$output_Pnl_promotion=$promotion*($var_cost+$los_cost)*$sale;
$output_Pnl_admin=$admin_cost;
$output_Pnl_rnd=0;
$output_Pnl_depreciation=$depreciation*$asset_value;
$output_Pnl_netfinancing=$receivable-$payable-$interest;

//total cost
$total_cost=$output_Pnl_variable_production_cost+$output_PnL_feature_cost+$output_Pnl_transportation+$output_Pnl_promotion+$output_Pnl_admin+$output_Pnl_rnd;
// ebitda
$editda=$output_Pnl_sales_revenue-$total_cost;
// ebit
$ebit=$ebitda-$output_Pnl_depreciation;
//profit_b4_tax
$profit_bfor_tax=$ebit-$output_Pnl_netfinancing;
$income_tax=$profit_bfor_tax*$tax;
$profit_after_tax=$profit_bfor_tax-$tax;

echo "TCost".$total_cost."<br>";
echo "EBITDA".$ebitda."<br>";
echo "EBIT".$ebit."<br>";
echo "P4tax".$profit_bfor_tax."<br>";
echo "tax".$income_tax."<br>";
echo "profit_after_tax".$profit_after_tax."<br>";


$output_Bs_fixedasset=$asset_value;
$output_Bs_inventory=$inventory;
$output_Bs_receviable=$receviable;
$output_Bs_cash=$output_Pnl_sales_revenue-$receviable;
$output_Bs_sharecapital=$share_cap;
$output_Bs_others_restricted_cap=0;
$output_Bs_longtermloan=$longterm_loan;
$output_Bs_shorttermloan=0;
$output_Bs_payable=$payable;


}

?>