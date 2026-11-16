#!/usr/bin/env python3
"""Analyze debt ratios from simulation results."""
import json
import sys
import os

def analyze_debt_ratios(json_path, industry_label):
    print(f"\n{'='*60}")
    print(f"DEBT RATIO ANALYSIS: {industry_label}")
    print(f"{'='*60}")

    with open(json_path) as f:
        data = json.load(f)

    for result in data['results']:
        round_num = result['round']
        print(f"\n--- Round {round_num} ---")

        for team in result['teams']:
            team_name = team['teamName']
            bs = team['balanceSheet']
            ratios = team['ratios']

            total_assets = bs['totalAssets']
            total_liabilities = bs['totalLiabilities']
            total_equity = bs['totalEquity']
            long_term_debt = bs['longTermDebt']
            short_term_loans = bs['shortTermLoans']

            # Calculate debt ratio (total debt / total assets)
            total_debt = long_term_debt + short_term_loans
            debt_ratio = total_debt / total_assets if total_assets > 0 else 0

            # Debt to equity from ratios
            d_to_e = ratios['debtToEquity']

            # Calculate expected debt-to-equity
            expected_d_to_e = total_liabilities / total_equity if total_equity > 0 else 0

            print(f"\n{team_name}:")
            print(f"  Total Assets:      ${total_assets:,.0f}")
            print(f"  Total Liabilities: ${total_liabilities:,.0f}")
            print(f"  Total Equity:      ${total_equity:,.0f}")
            print(f"  Long-term Debt:    ${long_term_debt:,.0f}")
            print(f"  Short-term Loans:  ${short_term_loans:,.0f}")
            print(f"  ---")
            print(f"  Debt Ratio (debt/assets):     {debt_ratio*100:.2f}%")
            print(f"  Debt-to-Equity (reported):    {d_to_e:.4f}")
            print(f"  Debt-to-Equity (calculated):  {expected_d_to_e:.4f}")

            # Check for issues
            if abs(d_to_e - expected_d_to_e) > 0.01:
                print(f"  ⚠️  D/E MISMATCH: reported vs calculated")

            # Check if balance sheet balances
            assets_minus_le = total_assets - (total_liabilities + total_equity)
            if abs(assets_minus_le) > 1:
                print(f"  ⚠️  BALANCE SHEET MISMATCH: {assets_minus_le:,.0f}")

if __name__ == "__main__":
    output_dir = "d:/Bonopoly/bonopoly-react2/simulation-test/output"

    # Find the automotive file (middle timestamp based on earlier run)
    files = sorted([f for f in os.listdir(output_dir) if f.startswith('results_') and f.endswith('.json')])

    # Map to industries based on run order
    industries = ['Electronics', 'Automotive', 'Oil & Energy']

    for i, filename in enumerate(files):
        if i < len(industries):
            analyze_debt_ratios(os.path.join(output_dir, filename), industries[i])
