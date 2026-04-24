## 2026-04-22 - [Python CSV parsing loop unpacking performance]
**Learning:** Exact tuple unpacking `_, ticker, _, tx_type, _, val_str = line.split(',')` introduces regressions if a CSV structure changes slightly or lines have extra columns. Moreover, combining simple list lookup (`parts = line.split(',')`, `parts[3]`, etc.) is comparable in speed and avoids data-loss regressions.
**Action:** Be extremely careful to not alter exact validation behavior (like checking `len(parts) < 6`) when migrating from index lookups to strict unpacking to avoid silent drops of edge cases or future formatting adjustments.

## 2024-04-22 - [Python CSV parsing line ending optimization]
**Learning:** When parsing large chunked text files with known line delimiters, using `.decode('utf-8').split('\n')` is measurably faster than `.decode('utf-8').splitlines()` as it bypasses Universal Newlines overhead. Python's `float()` function safely ignores whitespace, including trailing carriage returns (`\r`), so stripping is not required.
**Action:** Use `.split('\n')` instead of `.splitlines()` for text chunks where the delimiter is known.
