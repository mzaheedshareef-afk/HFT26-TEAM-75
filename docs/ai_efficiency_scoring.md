# VERITY — AI Efficiency Scoring Engine (Formula Version v1.0)

**Team:** Gate code (`HFT26-TEAM-75`)  
**Project:** Portfolio-Driven Adaptive Coding & Technical Assessment Platform

---

## 1. Core Philosophy of AI Efficiency Scoring

In traditional coding assessments, using AI is treated as cheating. In VERITY, AI usage is tracked transparently and calibrated into an objective, versioned metric:
1. **Never penalize candidates purely for asking for help:** Proactive, calibrated inquiry is a valid engineering skill.
2. **Reward Effective Utilization:** If a candidate uses an AI hint to unblock themselves and subsequently achieves an `Accepted` (AC) verdict, they receive an **Effective Utilization Bonus**.
3. **Calibrate by Difficulty:** Requesting hints on Hard problems carries a smaller deduction than requesting hints on Easy problems.
4. **Deterministic & Version-Stamped:** Calculations are 100% mathematical without LLM subjectivity, version-stamped as `v1.0`.

---

## 2. Mathematical Scoring Formula (v1.0)

For standard Adept/Medium and Master/Hard tiers:

$$\text{Final Score} = (0.80 \times \text{Coding Score}) + (0.20 \times \text{AI Efficiency Score})$$

### 2.1 Base Hint Deductions

$$\text{Hint Deduction} = \sum_{q \in Q} \frac{\text{Base Penalty}(\text{MaxLevel}_q) \times \text{Difficulty Multiplier}_q}{|Q|}$$

| Hint Level Requested | Base Penalty ($\text{pts}$) | Description |
|---|---|---|
| **Level 1** | $3.0$ | Conceptual guidance |
| **Level 2** | $6.0$ | Algorithmic strategy & data structures |
| **Level 3** | $9.0$ | Implementation nudge |

### 2.2 Difficulty Multipliers

| Question Difficulty | Multiplier | Rationale |
|---|---|---|
| **Easy** | $1.2\times$ | High penalty: Foundational problems should be solved independently. |
| **Medium** | $1.0\times$ | Baseline parity. |
| **Hard** | $0.7\times$ | Low penalty: Complex systems problems naturally benefit from AI collaboration. |

### 2.3 Effective Utilization Bonus

If a candidate achieves an Accepted verdict (`AC` or score $\ge 80$) on a question after requesting AI assistance:

$$\text{Effective Bonus} = \sum_{q \in \text{AC After Hint}} \frac{4.0 \times \text{Difficulty Multiplier}_q}{|Q|}$$

### 2.4 Independent Problem-Solving Bonus

For every question solved without requesting any AI hints:

$$\text{Independent Bonus} = 4.0 \times \frac{\text{Questions Solved Independently}}{|Q|}$$

### 2.5 Compilation Error Deduction

Frequent compilation errors reflect trial-and-error pasting rather than thoughtful engineering:

$$\text{CE Deduction} = \min(6.0, \max(0, \text{CE Count} - 1) \times 1.5)$$

### 2.6 Raw AI Efficiency Score Calculation

$$\text{Raw Efficiency} = 100.0 - \text{Hint Deduction} + \text{Effective Bonus} + \text{Independent Bonus} - \text{CE Deduction}$$
$$\text{AI Efficiency Score} = \max(0.0, \min(100.0, \text{Raw Efficiency}))$$

---

## 3. Novice Tier Normalization (AI Assistant Disabled)

For Novice/Easy tier assessments, the AI assistant is strictly disabled. Therefore:
- The candidate cannot request AI hints.
- Deductions and bonuses are zero.
- The technical coding score is normalized to the full 100-point scale:

$$\text{Final Score}_{\text{Novice}} = 1.00 \times \text{Coding Score}$$
$$\text{AI Efficiency Score}_{\text{Novice}} = 100.0\quad (\text{Zero Penalty})$$

This ensures that early-career candidates are evaluated solely on core programming fundamentals without synthetic AI score distortion.
