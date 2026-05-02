## 2026-04-22 - [Python CSV parsing loop unpacking performance]
**Learning:** Exact tuple unpacking `_, ticker, _, tx_type, _, val_str = line.split(',')` introduces regressions if a CSV structure changes slightly or lines have extra columns. Moreover, combining simple list lookup (`parts = line.split(',')`, `parts[3]`, etc.) is comparable in speed and avoids data-loss regressions.
**Action:** Be extremely careful to not alter exact validation behavior (like checking `len(parts) < 6`) when migrating from index lookups to strict unpacking to avoid silent drops of edge cases or future formatting adjustments.

## 2026-05-02 - [C CSV parsing loop `strtok_r` vs manual pointer advance]
**Learning:** `strtok_r` introduces measurable internal setup and state management overhead in tight C loops parsing simple structured records like CSV. Replacing it with a manual pointer advance loop (e.g. `while (*p && *p != ',') p++;`) provided a significant performance speedup for parallel aggregation.
**Action:** When writing C programs that parse large CSV files or perform tight loops on structured string data, prefer manual pointer loops over standard library functions like `strtok_r` for string splitting.
