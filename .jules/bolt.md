## 2026-04-22 - [Python CSV parsing loop unpacking performance]
**Learning:** Exact tuple unpacking `_, ticker, _, tx_type, _, val_str = line.split(',')` introduces regressions if a CSV structure changes slightly or lines have extra columns. Moreover, combining simple list lookup (`parts = line.split(',')`, `parts[3]`, etc.) is comparable in speed and avoids data-loss regressions.
**Action:** Be extremely careful to not alter exact validation behavior (like checking `len(parts) < 6`) when migrating from index lookups to strict unpacking to avoid silent drops of edge cases or future formatting adjustments.

## 2024-05-18 - [C strtok_r vs manual pointer iteration]
**Learning:** In C tight loops parsing structured data like CSV, `strtok_r` introduces measurable internal setup and state management overhead. A simple manual pointer advance loop (`while (*p && *p != ',') p++;`) provides a large measurable performance improvement (over ~2.4x speedup on sequential ingestion). `atof()` also safely ignores `\r` and spaces, allowing parsing the final field without needing a special terminator.
**Action:** When working on C loops processing millions of structured records, replace `strtok` functions with inline manual parsing for a safe, large performance gain.
