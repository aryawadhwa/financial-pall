import os
import sys
import subprocess
import json

def run_scaling_analysis():
    sizes = [100_000, 500_000, 1_000_000, 5_000_000, 10_000_000]
    results = []

    print("==================================================")
    print("      Starting Scaling & Amdahl's Law Analysis    ")
    print("==================================================")

    # Ensure C binary is built
    subprocess.run(["make"], check=True)

    for size in sizes:
        print(f"\n[+] Analyzing dataset size: {size:,} records")
        csv_file = f"data/scaling_{size}.csv"
        
        # 1. Generate Data
        if not os.path.exists(csv_file):
            print(f"    -> Generating data...")
            subprocess.run([sys.executable, "src/data_generator.py", str(size), csv_file], check=True)
        else:
            print(f"    -> Using existing {csv_file}")

        # 2. Run C benchmark
        print(f"    -> Running C benchmark...")
        # Redirect stdout so it doesn't clutter the analysis output
        subprocess.run(["./financial_agg", csv_file], stdout=subprocess.DEVNULL, check=True)

        # 3. Read results from dashboard/results.json
        with open("dashboard/results.json", "r") as f:
            run_data = json.load(f)

        metrics = run_data["metrics"]
        t_seq = metrics["sequential_time"]
        t_par = metrics["parallel_time"]
        speedup = metrics["speedup"]
        N = metrics["cpu_count"]

        # 4. Calculate Amdahl's Law Parallel Fraction (p)
        # S = 1 / ((1 - p) + p/N)
        # 1/S = 1 - p + p/N = 1 - p(1 - 1/N)
        # p(1 - 1/N) = 1 - 1/S
        # p = (1 - 1/S) / (1 - 1/N)
        
        if speedup > 0 and N > 1:
            p = (1.0 - (1.0 / speedup)) / (1.0 - (1.0 / N))
            # Clamp p between 0 and 1 for edge cases where overhead is high
            p = max(0.0, min(1.0, p))
        else:
            p = 0.0

        print(f"       Seq Time : {t_seq:.4f} s")
        print(f"       Par Time : {t_par:.4f} s")
        print(f"       Speedup  : {speedup:.2f}x")
        print(f"       Par Frac : {p*100:.2f}% (Amdahl's p)")

        results.append({
            "records": size,
            "sequential_time": t_seq,
            "parallel_time": t_par,
            "speedup": speedup,
            "cpu_count": N,
            "parallel_fraction": p
        })

    # Find crossover point (where speedup > 1.0)
    crossover = None
    for r in results:
        if r["speedup"] > 1.0:
            crossover = r["records"]
            break

    print("\n==================================================")
    print("                 Analysis Complete                ")
    print("==================================================")
    if crossover:
        print(f"Crossover Point   : ~{crossover:,} records (parallel becomes faster)")
    else:
        print("Crossover Point   : Not found (sequential always faster?)")
    
    avg_p = sum(r["parallel_fraction"] for r in results if r["speedup"] > 1.0) / len([r for r in results if r["speedup"] > 1.0]) if any(r["speedup"] > 1.0 for r in results) else 0
    print(f"Avg Parallel Frac : {avg_p*100:.2f}%\n")

    # 5. Export for Dashboard
    out_file = "dashboard/scaling_results.json"
    with open(out_file, "w") as f:
        json.dump({
            "crossover_records": crossover,
            "average_parallel_fraction": avg_p,
            "scaling_data": results
        }, f, indent=4)
    print(f"Saved scaling data to {out_file}")


if __name__ == "__main__":
    run_scaling_analysis()
