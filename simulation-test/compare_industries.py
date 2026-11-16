#!/usr/bin/env python3
"""Compare key metrics across industries."""
import json
import os

def format_money(val):
    if abs(val) >= 1e9:
        return f"${val/1e9:.1f}B"
    elif abs(val) >= 1e6:
        return f"${val/1e6:.1f}M"
    else:
        return f"${val:,.0f}"

def analyze_industry(json_path, industry_label):
    with open(json_path) as f:
        data = json.load(f)

    print(f"\n{'='*60}")
    print(f"{industry_label}")
    print(f"{'='*60}")

    # Get Round 1 Alpha Corp for baseline comparison
    for result in data['results']:
        if result['round'] == 1:
            team = result['teams'][0]  # Alpha Corp
            bs = team['balanceSheet']
            pnl = team['pnl']
            ratios = team['ratios']

            print(f"\nRound 1 - {team['teamName']}:")
            print(f"  Scale:")
            print(f"    Total Assets:      {format_money(bs['totalAssets'])}")
            print(f"    Revenue:           {format_money(pnl['revenue'])}")
            print(f"    Net Profit:        {format_money(pnl['netProfit'])}")
            print(f"    Long-term Debt:    {format_money(bs['longTermDebt'])}")
            print(f"    Share Capital:     {format_money(bs['shareCapital'])}")
            print(f"  Ratios:")
            print(f"    ROE:               {ratios['roe']:.1f}%")
            print(f"    ROS (Net Margin):  {ratios['ros']:.1f}%")
            print(f"    Debt/Equity:       {ratios['debtToEquity']:.2f}")
            print(f"    Current Ratio:     {ratios['currentRatio']:.2f}")

            # Gross margin calculation check
            cogs = pnl['cogs']
            gross_profit = pnl['grossProfit']
            revenue = pnl['revenue']

            # Two ways to calc gross margin
            gm_from_revenue = (gross_profit / revenue) * 100 if revenue else 0
            gm_from_cogs = (gross_profit / cogs) * 100 if cogs else 0

            print(f"  Gross Margin Analysis:")
            print(f"    Revenue:           {format_money(revenue)}")
            print(f"    COGS:              {format_money(cogs)}")
            print(f"    Gross Profit:      {format_money(gross_profit)}")
            print(f"    GM (profit/rev):   {gm_from_revenue:.1f}%  <- CORRECT")
            print(f"    GM (profit/cogs):  {gm_from_cogs:.1f}%  <- WRONG (what simulation flags)")

            break

    return data

if __name__ == "__main__":
    output_dir = "d:/Bonopoly/bonopoly-react2/simulation-test/output"
    files = sorted([f for f in os.listdir(output_dir) if f.startswith('results_') and f.endswith('.json')])
    industries = ['Electronics', 'Automotive', 'Oil & Energy']

    for i, filename in enumerate(files):
        if i < len(industries):
            analyze_industry(os.path.join(output_dir, filename), industries[i])
