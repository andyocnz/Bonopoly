# Complete Game Parameters Analysis

## Educator Inputs When Creating Game

Based on game.php lines 720-869, here are ALL parameters an educator must provide:

---

### 1. BASIC GAME INFO (4 parameters)
```
- name_game: Game name (e.g., "MBA Fall 2024")
- no_of_rounds: Number of rounds (1-5, typically 3)
- no_of_teamsname: Number of teams (1-5)
- no_of_practice: Number of practice rounds (0-2, typically 1)
- hours_per_round: Hours per round (deadline setting)
```

---

### 2. COST EQUATION (4 parameters - a,b,c,d)
```
Cost_equation: "a,b,c,d" format
Example: "0.9,6,-0.85,1.5"

Used in formula: Cost = (1 + Promotion) × [a × capacity^b + c × capacity + d]
```

---

### 3. HR PARAMETERS (6 parameters)
```
- Hr_standard_wage: Standard monthly wage per worker
- Hr_standard_training_budget: Standard training budget
- HR_turnover_rate: Expected turnover rate (%)
- Hr_Manday_per_worker: Man-days per worker per month
- Hr_recruitment_layoff_cost: Cost to hire/fire one worker
- Hr_min_wage: Minimum wage requirement
```

---

### 4. R&D PARAMETERS (5 parameters)
```
- RnD_rate_of_reducing: Rate of tech price reduction over time (%)
- Rnd_cost_per_feature: Base cost per feature development
- RnD_tech1_cost: Cost to develop Tech 1
- RnD_tech2_cost: Cost to develop Tech 2
- RnD_tech3_cost: Cost to develop Tech 3
- RnD_tech4_cost: Cost to develop Tech 4
```

---

### 5. TECHNOLOGY ATTRACTIVENESS (4 parameters)
```
- tech1_att: Tech 1 attractiveness multiplier (affects demand)
- tech2_att: Tech 2 attractiveness multiplier
- tech3_att: Tech 3 attractiveness multiplier
- tech4_att: Tech 4 attractiveness multiplier
```

---

### 6. TECHNOLOGY AVAILABILITY BY MARKET (12 parameters)
```
For each market (c1=US, c2=Asia, c3=Europe), for each tech (tech1-4):
Arrays per round showing % network coverage

- Tech1_avai_c1: US Tech1 availability (e.g., "70,80,90,100,100" for 5 rounds)
- Tech2_avai_c1: US Tech2 availability (e.g., "20,35,50,65,80")
- Tech3_avai_c1: US Tech3 availability (e.g., "0,0,10,25,40")
- Tech4_avai_c1: US Tech4 availability (e.g., "0,0,0,5,15")

- Tech1_avai_c2: Asia Tech1 availability
- Tech2_avai_c2: Asia Tech2 availability
- Tech3_avai_c2: Asia Tech3 availability
- Tech4_avai_c2: Asia Tech4 availability

- Tech1_avai_c3: Europe Tech1 availability
- Tech2_avai_c3: Europe Tech2 availability
- Tech3_avai_c3: Europe Tech3 availability
- Tech4_avai_c3: Europe Tech4 availability
```

**Important**: Can't sell products without network coverage!
If Tech2 coverage in US is only 20%, max 20% of market can buy Tech2 products.

---

### 7. INVENTORY & DEPRECIATION (2 parameters)
```
- Inventory_cost_per_unit: Cost to hold 1 unit of inventory per round
- Depreciation_rate: Annual depreciation rate (e.g., 0.1 = 10%)
```

---

### 8. FINANCE PARAMETERS (3 parameters)
```
- Share_capital: Initial share capital ($millions)
- Share_face_value: Face value per share
- Minimum_cash: Minimum cash balance required ($millions)
```

**Note**:
- receivable_rate and payable_rate are also stored (receivable days, payable days)
- These affect cash flow

---

### 9. MARKET-SPECIFIC PARAMETERS (PER ROUND)

#### These 29 parameters are stored as CSV string "country1", "country2", "country3"

**Order in CSV (lines 862-867):**

1. **change_in_demand**: Demand multiplier (e.g., 1.0 = normal, 1.2 = +20% growth)
2. **unitcost_direct_material**: Direct material cost per unit
3. **unitcost_supplier1**: Supplier 1 unit cost
4. **unitcost_supplier2**: Supplier 2 unit cost
5. **unitcost_supplier3**: Supplier 3 unit cost (CSR-friendly, lower demand impact)
6. **unitcost_supplier4**: Supplier 4 unit cost
7. **unitcost_direct_labour**: Direct labour cost per unit
8. **production_max_outsource**: Max outsource capacity (units)
9. **tax**: Corporate tax rate (e.g., 0.30 = 30%)
10. **interest**: Long-term interest rate (e.g., 0.08 = 8%)
11. **min_wage**: Minimum wage requirement
12. **cost_tech1**: R&D cost for Tech 1 development
13. **cost_tech2**: R&D cost for Tech 2 development
14. **cost_tech3**: R&D cost for Tech 3 development
15. **cost_tech4**: R&D cost for Tech 4 development
16. **Exchange_rate21**: Exchange rate Asia to US (e.g., 0.85)
17. **Exchange_rate31**: Exchange rate Europe to US (e.g., 1.1)
18. **Logistic_tariffs_c1_c2**: Tariff US → Asia (%)
19. **Logistic_tariffs_c2_c1**: Tariff Asia → US (%)
20. **Logistic_tariffs_c1_c3**: Tariff US → Europe (%)
21. **fix_admin_cost**: Fixed admin cost per round
22. **variable_admin_cost**: Variable admin cost per unit sold
23. **cost_per_plant**: Cost to build new plant
24. **cost_outsource**: Cost per unit for outsourcing
25. **short_interest**: Short-term interest premium (added to base rate)
26. **tech1_att**: Tech 1 attractiveness (duplicate - already in global params)
27. **tech2_att**: Tech 2 attractiveness
28. **tech3_att**: Tech 3 attractiveness
29. **tech4_att**: Tech 4 attractiveness

---

### 10. MARKET DIFFERENCES

**Line 804-810 shows market variations:**

```php
$diff = $_POST['diff_unitcost_c12']; // % difference between US and Asia costs

// US (country1) uses base values
$unitcost_direct_material1 = $_POST['Unitcost_direct_material'];
$unitcost_direct_labour1 = $Unitcost_direct_labour;

// Asia (country2) is calculated based on diff%
$unitcost_direct_material2 = $unitcost_direct_material1 × (1 + $diff/100);
$unitcost_direct_labour2 = $unitcost_direct_labour1 × (1 + $diff/100);

// Europe (country3)
$unitcost_direct_material3 = 0; // Not used?
$unitcost_direct_labour3 = 0;   // Not used?
```

**Additional market-specific inputs:**
```
- Unitcost_direct_material: US base material cost
- Unitcost_direct_labour: US base labour cost
- diff_unitcost_c12: % difference between US and Asia (-10% = Asia cheaper)
- Unitcost_supplier1: Supplier 1 cost (same for all markets)
- Unitcost_supplier2: Supplier 2 cost
- Unitcost_supplier3: Supplier 3 cost (CSR-friendly)
- Unitcost_supplier4: Supplier 4 cost
- Production_max_outsource_c1: US max outsource capacity
- Production_max_outsource_c2: Asia max outsource capacity
- cost_outsource: Cost per outsourced unit (same all markets)
- Fin_tax_c1: US tax rate
- Fin_tax_c2: Asia tax rate
- Fin_tax_c3: Europe tax rate
- Interest_c1: US interest rate
- Interest_c2: Asia interest rate
- Interest_c3: Europe interest rate
- premium_short_interest_rate: Premium for short-term loans
- Exchange_rate_c2_c1: Asia to US exchange rate
- Exchange_rate_c3_c1: Europe to US exchange rate
- Logistic_tariffs_c1_c2: Tariff US → Asia
- Logistic_tariffs_c2_c1: Tariff Asia → US
- Logistic_tariffs_c1_c3: Tariff US → Europe
- Logistic_tariffs_c2_c3: Tariff Asia → Europe
- Fix_admin_cost_c1: US fixed admin cost
- Fix_admin_cost_c2: Asia fixed admin cost (Europe = Asia)
- Variable_admin_cost_c1: US variable admin cost
- Variable_admin_cost_c2: Asia variable admin cost
- Cost_per_Plant_c1: US plant construction cost
- Cost_per_Plant_c2: Asia plant construction cost
```

---

## TOTAL EDUCATOR INPUTS

**Summary count:**

1. Basic game info: 5 parameters
2. Cost equation: 4 parameters (a,b,c,d)
3. HR: 6 parameters
4. R&D: 5 parameters
5. Tech attractiveness: 4 parameters
6. Tech availability: 12 parameters (arrays)
7. Inventory/depreciation: 2 parameters
8. Finance: 3 parameters
9. Market-specific: ~35 parameters (with diff calculations)

**GRAND TOTAL: ~76 input fields**

---

## QUESTIONS FOR YOU:

### 1. **Europe (country3) material/labour costs:**
Lines 807, 811 show:
```php
$unitcost_direct_materia3 = 0;
$unitcost_direct_labour3 = 0;
```
Is Europe market disabled? Or should Europe have its own costs?

### 2. **Auto-generated vs Manual:**
Which parameters should be:
- **Auto-generated** (random realistic values)?
- **Manually input** by educator?
- **Pre-set defaults** with option to customize?

My guess:
- ✅ Auto-generate: All market params (country1/2/3 CSV values)
- ✅ Defaults with customization: HR, R&D, Finance params
- ❓ Manual: Game name, rounds, teams, deadlines

### 3. **Simplified educator UX:**
Do you want to simplify this? 76 inputs is A LOT!

Options:
- **Option A**: Educator picks "Scenario Template" (Easy/Medium/Hard), system fills all 76 parameters
- **Option B**: Educator only sets: name, rounds, teams, deadlines → System randomizes rest
- **Option C**: Advanced mode: Let educator customize everything

What was your original educator experience? Did they manually fill 76 fields?

### 4. **Round-by-round variations:**
Do market parameters change per round? Or same for all rounds?

Looking at line 862-867, it seems ONE set of country1/2/3 values for ALL rounds.
But tech availability changes per round (that's why it's an array).

Should demand, costs, tax rates vary by round?
- Round 1: Normal economy
- Round 2: Recession (lower demand, higher costs)
- Round 3: Boom (higher demand, lower costs)

### 5. **Feature costs:**
Lines 836 shows only 4 techs, but what about features?
Are there pre-defined features? How many?
- Feature 1, 2, 3, 4, ...?
- What do features do? (Increase product attractiveness?)

Please help me understand:
1. Which parameters educators MUST manually input vs can auto-generate?
2. Should we simplify the 76 inputs somehow?
3. Do parameters vary per round or fixed for entire game?
4. What are "features" exactly?

Once I understand this, I can design the proper game creation form and Google Sheets structure!
