## 2026-04-22 - [Python CSV parsing loop unpacking performance]
**Learning:** Exact tuple unpacking `_, ticker, _, tx_type, _, val_str = line.split(',')` introduces regressions if a CSV structure changes slightly or lines have extra columns. Moreover, combining simple list lookup (`parts = line.split(',')`, `parts[3]`, etc.) is comparable in speed and avoids data-loss regressions.
**Action:** Be extremely careful to not alter exact validation behavior (like checking `len(parts) < 6`) when migrating from index lookups to strict unpacking to avoid silent drops of edge cases or future formatting adjustments.

## 2024-05-18 - [Python Universal Newlines parsing overhead]
**Learning:** `chunk_data.decode('utf-8').splitlines()` carries the overhead of Universal Newlines checking. Using `.split('\n')` on large blobs of text is measurably faster.
**Action:** When working with massive text chunk partitioning, prefer `.split('\n')` if the newlines are strictly known, and ensure trailing empty strings are handled like `if lines and not lines[-1]: lines.pop()`
