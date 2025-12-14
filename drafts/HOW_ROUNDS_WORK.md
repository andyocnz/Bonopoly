# How Market Conditions Change Per Round - THE KEY MECHANISM!

## Discovery from game.php lines 891-1020

###

 BRILLIANT SYSTEM: Scenario-Based Market Evolution

**How it works:**

1. **Educator creates game** → System generates base market conditions (29 parameters × 3 markets)

2. **For each round** (0, 1, 2, 3...):
   - System picks **random scenario** for each market (US, Asia, Europe)
   - Each scenario has 29 percentage changes (e.g., "+10%", "-10%", "0%")
   - **Applies changes** to previous round's values
   - Creates new market conditions for that round

### The 8 Predefined Scenarios (from scenario table):

**Scenario 1: Moderate Growth (+10% all parameters)**
```
Value: "10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10"
Description: "Future growth... double-digit economic expansion... Target: 10%"
```

**Scenario 2: Recession (-10% all parameters)**
```
Value: "-10,-10,-10,-10,-10,-10,-10,-10,-10,-10,-10,-10,-10,-10,-10,-10,-10,-10,-10,-10,-10,-10,-10,-10,-10,-10,-10,-10,-10"
Description: "Ebola outbreak... drop of 10% demand... higher prices, lower incomes"
```

**Scenario 3: Stagnation (0% all parameters)**
```
Value: "0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0"
Description: "Protests barricade shopping areas... GDP slowed to mere 1%... recession"
```

**Scenario 4: Strong Boom (+15% all parameters)**
```
Value: "15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15"
Description: "Growth even stronger... GDP 14.6%... demand jump 15%-20%"
```

**Scenario 5: Modest Growth (+5% all parameters)**
```
Value: "5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5"
Description: "Sustainable growth... target 5%"
```

**Scenario 6: Major Boom (+20% all parameters)**
```
Value: "20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20"
Description: "Strongest growth since 2011... demand jump 15%-20%"
```

**Scenario 7: Major Recession (-10% all, duplicate of Scenario 2)**

**Scenario 8: MIXED Changes (realistic complexity)**
```
Value: "15,7,7,7,7,5,5,10,0,0,1,0,0,0,0,0,0,0,0,0,0,0,10,0,30,0,30,0,0"
Description: "Demand +15%, unit cost +5-7%, outsource +10%, short-term loan premium +30%, minimum wage +1%, investment cost +10%, Tech 2 extremely attractive"
```

---

## The Algorithm (game.php lines 891-1020):

```php
for ($x=0; $x<=$no_of_rounds; $x++)  // For each round
{
    // Pick random scenario for each market
    $scenario_id1 = rand(1, $max_id);  // US scenario (1-8)
    $scenario_id2 = rand(1, $max_id);  // Asia scenario (1-8)
    $scenario_id3 = rand(1, $max_id);  // Europe scenario (1-8)

    // Get percentage changes from scenario table
    $change1 = "10,10,10,10,10,10..." // e.g., all +10%
    $change2 = "-10,-10,-10,-10,..."  // e.g., all -10%
    $change3 = "0,0,0,0,0,0,0,0,..."  // e.g., all 0%

    if ($x == 0) {
        // Round 0 (practice): Use base values
        $final1 = $country1;  // Base US values
        $final2 = $country2;  // Base Asia values
        $final3 = $country3;  // Base Europe values
    }
    else {
        // Round 1+: Apply percentage changes to previous round
        for ($v=0; $v<=$no_value; $v++)  // For each of 29 parameters
        {
            $c1 = $change1[$v];  // e.g., 10 (means +10%)
            $v1 = $previous_round_value[$v];  // e.g., 100

            $new_value = $v1 × (1 + $c1/100);  // 100 × 1.10 = 110

            $final1 .= $new_value . ",";  // Build CSV string
        }
    }

    // Store in round_assumption table
    INSERT INTO round_assumption (
        game_id, round, scenario_id,
        country1, country2, country3
    ) VALUES (
        $id_max, $x, "$scenario_id1,$scenario_id2,$scenario_id3",
        $final1, $final2, $final3
    );
}
```

---

## Example: How a 3-Round Game Evolves

### Base Values (Educator Input):
```
US material cost: $450
Asia material cost: $400
Europe material cost: $420
```

### Round 0 (Practice):
- Scenario: N/A (uses base values)
- US: $450, Asia: $400, Europe: $420

### Round 1:
- Random scenarios: US=Scenario4(+15%), Asia=Scenario2(-10%), Europe=Scenario3(0%)
- **US**: $450 × 1.15 = **$517.50** (boom!)
- **Asia**: $400 × 0.90 = **$360** (recession!)
- **Europe**: $420 × 1.00 = **$420** (stagnant)

### Round 2:
- Random scenarios: US=Scenario3(0%), Asia=Scenario1(+10%), Europe=Scenario4(+15%)
- **US**: $517.50 × 1.00 = **$517.50** (stable)
- **Asia**: $360 × 1.10 = **$396** (recovering!)
- **Europe**: $420 × 1.15 = **$483** (boom!)

### Round 3:
- Random scenarios: US=Scenario2(-10%), Asia=Scenario4(+15%), Europe=Scenario2(-10%)
- **US**: $517.50 × 0.90 = **$465.75** (recession!)
- **Asia**: $396 × 1.15 = **$455.40** (strong growth!)
- **Europe**: $483 × 0.90 = **$434.70** (recession!)

---

## Why This is BRILLIANT for Education:

1. **Realistic Market Dynamics**: Each market can be in different economic phases
2. **Strategic Challenge**: Teams must adapt to changing conditions each round
3. **Unpredictable**: Can't plan entire game strategy upfront
4. **Compounding Effects**: +15% then +15% = 1.3225× (not 1.30×)
5. **Different Scenarios**: US booming while Asia in recession = realistic global economy

---

## What Features Really Are:

From your answer:
> "Features really just investment on the phone, more features → higher demand but then cost to invest.... so not all market willing pay more for features, some low income market they not willing to pay for new feature some market willing..."

**So Features = Product Features (not separate products)**
- Example: Phone with 5 features vs 7 features
- More features = Higher demand (especially in wealthy markets)
- But costs money to develop
- Low-income markets may not value extra features

This explains the "tech attractiveness" parameters!
- **Tech 1**: Basic phone, low attractiveness
- **Tech 2**: Mid-range, medium attractiveness
- **Tech 3**: High-end, high attractiveness (if market can afford it)
- **Tech 4**: Premium, very high attractiveness (wealthy markets only)

**AND it varies by market!**
- US market: Willing to pay for Tech 3/4 with many features
- Asia market: May prefer Tech 1/2 with fewer features (lower cost)
- Europe market: Mix of preferences

---

## Answers to Your Questions:

**Q1: Europe (country3) costs = 0?**
A: Looking at the code, Europe IS used! The 0 values are just initial (line 807, 811). They get calculated based on scenarios each round.

**Q2: Auto-generate vs Manual?**
A: **OPTION B** - You confirmed:
- Educator sets: name, rounds, teams, deadlines
- System auto-randomizes ALL market parameters
- System picks random scenarios each round

**Q3: Per-round variation?**
A: **YES!** - Confirmed. Market conditions change EVERY round based on random scenarios.

**Q4: Features?**
A: **Product features** - Teams invest in R&D to add features (makes product more attractive, increases demand, costs money)

---

## For the React System:

We need:
1. **8 predefined scenarios** (or let educators create custom ones)
2. **Scenario selection algorithm**: Randomly pick scenario per market per round
3. **Compound calculation**: Apply % changes to previous round values
4. **Store scenario_id** with each round (for reproducibility/debugging)

This is MUCH simpler than I thought! We don't need 76 manual inputs per round.
We just need:
- Base values (one-time input)
- 8 scenario templates (pre-defined)
- Random scenario selection per round

Perfect for automation! 🎯
