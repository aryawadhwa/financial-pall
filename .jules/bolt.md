## 2026-04-22 - [Python CSV parsing loop unpacking performance]
**Learning:** Exact tuple unpacking `_, ticker, _, tx_type, _, val_str = line.split(',')` introduces regressions if a CSV structure changes slightly or lines have extra columns. Moreover, combining simple list lookup (`parts = line.split(',')`, `parts[3]`, etc.) is comparable in speed and avoids data-loss regressions.
**Action:** Be extremely careful to not alter exact validation behavior (like checking `len(parts) < 6`) when migrating from index lookups to strict unpacking to avoid silent drops of edge cases or future formatting adjustments.

## 2026-04-22 - [Python Line Parsing Optimization]
**Learning:** Using `splitlines()` on large text chunks in Python is measurably slower than `split('\n')` due to the overhead of Universal Newlines support (checking for `\r`, `\n`, `\r\n` etc.). When the line delimiter is known, `split('\n')` provides a free speedup.
**Action:** Replace `.splitlines()` with `.split('\n')` on large data chunks, and handle the trailing empty string (e.g., `if lines and not lines[-1]: lines.pop()`) to match `splitlines()` behavior. Note that trailing `\r`s (from `\r\n` line endings) will be ignored safely by Python's `float()` parser if the final column is a number.
