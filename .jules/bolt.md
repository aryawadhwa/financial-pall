## 2024-05-08 - [Avoid strtok_r for CSV parsing in C tight loops]
**Learning:** `strtok_r` introduces measurable internal setup and state management overhead when parsing CSV strings in tight loops. In this C codebase, manually advancing a char pointer (`while (*p && *p != ',') p++;`) provided a significant measurable performance improvement.
**Action:** Prefer writing manual pointer advance loops instead of the standard library `strtok_r` for highly iterative tokenisation tasks when optimizing performance-critical parsing functions.
