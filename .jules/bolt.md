## 2026-04-22 - [Python CSV parsing loop unpacking performance]
**Learning:** Exact tuple unpacking `_, ticker, _, tx_type, _, val_str = line.split(',')` introduces regressions if a CSV structure changes slightly or lines have extra columns. Moreover, combining simple list lookup (`parts = line.split(',')`, `parts[3]`, etc.) is comparable in speed and avoids data-loss regressions.
**Action:** Be extremely careful to not alter exact validation behavior (like checking `len(parts) < 6`) when migrating from index lookups to strict unpacking to avoid silent drops of edge cases or future formatting adjustments.

## 2026-05-01 - [C strtok_r parsing overhead]
**Learning:** Using strtok_r for CSV parsing in C tight loops can introduce measurable overhead compared to manual pointer scanning, likely due to internal setup and delimiter searching logic. A simple forward scan tracking pointers avoids modifying the original string where not needed and skips unnecessary function calls.
**Action:** When optimizing CSV parsers in C, prefer writing manual pointer advance loops instead of standard library strtok_r for critical inner loop paths. Avoid strtok_r in the hot path.
