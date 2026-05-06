## 2026-04-22 - [Python CSV parsing loop unpacking performance]
**Learning:** Exact tuple unpacking `_, ticker, _, tx_type, _, val_str = line.split(',')` introduces regressions if a CSV structure changes slightly or lines have extra columns. Moreover, combining simple list lookup (`parts = line.split(',')`, `parts[3]`, etc.) is comparable in speed and avoids data-loss regressions.
**Action:** Be extremely careful to not alter exact validation behavior (like checking `len(parts) < 6`) when migrating from index lookups to strict unpacking to avoid silent drops of edge cases or future formatting adjustments.

## 2024-05-06 - [C strtok_r Performance Overhead in Tight Loops]
**Learning:** `strtok_r` introduces measurable internal setup and state management overhead when used in tight loops (e.g., parsing 5M+ CSV rows). Replacing `strtok_r` with manual pointer advancement loops (`while (*p && *p != ',') p++;`) improved the processing speed by roughly 2x for the parallel C engine.
**Action:** When parsing well-formatted text data in extremely tight loops in C, favor simple, manual pointer operations over standard library multi-purpose parsing functions like `strtok_r` or `sscanf`.
