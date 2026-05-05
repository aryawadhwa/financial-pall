## 2026-04-22 - [Python CSV parsing loop unpacking performance]
**Learning:** Exact tuple unpacking `_, ticker, _, tx_type, _, val_str = line.split(',')` introduces regressions if a CSV structure changes slightly or lines have extra columns. Moreover, combining simple list lookup (`parts = line.split(',')`, `parts[3]`, etc.) is comparable in speed and avoids data-loss regressions.
**Action:** Be extremely careful to not alter exact validation behavior (like checking `len(parts) < 6`) when migrating from index lookups to strict unpacking to avoid silent drops of edge cases or future formatting adjustments.

## 2026-04-22 - [C CSV Parsing: strtok_r Overhead in Tight Loops]
**Learning:** Using `strtok_r` for parsing CSV lines in performance-critical C loops introduces measurable internal setup and state management overhead. A manual pointer advance loop (`while (*p && *p != ',') p++;`) skips this overhead and avoids the need to maintain external state (`sp`).
**Action:** When implementing or optimizing parsers processing millions of records in C, prefer writing manual pointer loops for delimiters over the standard `strtok_r` function if logic permits and readability isn't significantly sacrificed.
