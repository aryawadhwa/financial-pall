#!/usr/bin/env python3
"""
scaling_analysis.py — Amdahl's Law Scaling Analysis

Runs ./financial_agg with W = 1, 2, 4, 8, 16 workers against
the same dataset and measures wall-clock time for each.

Outputs dashboard/scaling_results.json with:
  - speedup curve  (W → speedup)
  - Amdahl's theoretical ceiling (estimated serial fraction p)
  - parallel crossover point

Usage:
  python3 scaling_analysis.py                    # default data/stocks.csv
  python3 scaling_analysis.py path/to/data.csv   # custom file
"""

import subprocess
import json
import sys
import os
import re

DATA_FILE = sys.argv[1] if len(sys.argv) > 1 else "data/stocks.csv"
BINARY = "./financial_agg"
WORKER_COUNTS = [1, 2, 4, 8, 16]
OUTPUT_JSON = "dashboard/scaling_results.json"


def run_benchmark(workers: int, data_file: str) -> dict:
    """Run the C binary and parse timing from stdout."""
    result = subprocess.run(
        [BINARY, str(workers), data_file],
        capture_output=True, text=True
    )
    out = result.stdout

    seq_match = re.search(r"Sequential Time\s*:\s*([\d.]+)", out)
    par_match = re.search(r"Parallel Time\s*:\s*([\d.]+)", out)
    spd_match = re.search(r"Speedup Factor\s*:\s*([\d.]+)", out)
    acc_match = re.search(r"Accuracy Check\s*:\s*(PASS|FAIL)", out)

    return {
        "workers": workers,
        "seq_time": float(seq_match.group(1)) if seq_match else None,
        "par_time": float(par_match.group(1)) if par_match else None,
        "speedup": float(spd_match.group(1)) if spd_match else None,
        "accuracy": acc_match.group(1) if acc_match else "UNKNOWN",
    }


def estimate_amdahl_p(results: list) -> float:
    """
    Estimate the serial fraction p from Amdahl's Law using the W=1 and
    the highest-W measurement:
        S(W) = 1 / ( (1-p) + p/W )
      → p = (1/S - 1) / (1/W - 1)
    Returns p in [0, 1].
    """
    w1 = next((r for r in results if r["workers"] == 1), None)
    wmax = max(results, key=lambda r: r["workers"])
    if not w1 or not wmax or wmax["speedup"] is None:
        return 0.0

    W = wmax["workers"]
    S = wmax["speedup"]
    if S <= 1 or W <= 1:
        return 0.0
    try:
        p = (1.0 / S - 1.0) / (1.0 / W - 1.0)
        return max(0.0, min(1.0, p))
    except ZeroDivisionError:
        return 0.0


def amdahl_theoretical(p: float, workers: list) -> list:
    """Compute Amdahl's theoretical speedup for each worker count."""
    out = []
    for W in workers:
        s = 1.0 / ((1.0 - p) + p / W) if p > 0 else float(W)
        out.append({"workers": W, "speedup": round(s, 4)})
    return out


def find_crossover(results: list) -> int | None:
    """
    Find the smallest dataset size (rows) at which parallel beats
    sequential. Since we run a single dataset size here, we return
    the worker count where speedup first exceeds 1.0 instead.
    """
    for r in sorted(results, key=lambda x: x["workers"]):
        if r["speedup"] and r["speedup"] > 1.0:
            return r["workers"]
    return None


def main():
    if not os.path.exists(BINARY):
        print(f"ERROR: {BINARY} not found. Run 'make' first.")
        sys.exit(1)
    if not os.path.exists(DATA_FILE):
        print(f"ERROR: {DATA_FILE} not found. Run 'make gen' first.")
        sys.exit(1)

    print(f"Scaling analysis: {DATA_FILE}")
    print(f"Workers: {WORKER_COUNTS}\n")

    results = []
    for W in WORKER_COUNTS:
        print(f"  Running W={W}...", end=" ", flush=True)
        r = run_benchmark(W, DATA_FILE)
        results.append(r)
        print(f"speedup={r['speedup']:.3f}x  [{r['accuracy']}]")

    p = estimate_amdahl_p(results)
    theoretical = amdahl_theoretical(p, WORKER_COUNTS)
    crossover = find_crossover(results)

    output = {
        "data_file": DATA_FILE,
        "amdahl_p": round(p, 4),
        "parallel_fraction": round(p * 100, 2),
        "crossover_workers": crossover,
        "measured": [
            {
                "workers": r["workers"],
                "seq_time": r["seq_time"],
                "par_time": r["par_time"],
                "speedup": r["speedup"],
                "accuracy": r["accuracy"],
            }
            for r in results
        ],
        "theoretical_amdahl": theoretical,
    }

    os.makedirs("dashboard", exist_ok=True)
    with open(OUTPUT_JSON, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nAmdahl serial fraction p = {p * 100:.1f}%")
    print(f"Results written → {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
