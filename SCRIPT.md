# PALL-FIN: DAA (Design & Analysis of Algorithms) Presentation Script

## 1. Introduction: The Algorithmic Problem
**Speaker:**
"Good morning everyone, and thank you for being here. Today we are presenting **PALL-FIN**, our Parallel Financial Data Aggregation System.

From a **Design and Analysis of Algorithms (DAA)** perspective, high-frequency financial platforms face a massive challenge: parsing and tallying millions of string characters and integers in real-time. If we process a dataset of size *N* sequentially, our time complexity is strictly **O(N)**. For massive values of *N*, this becomes a severe bottleneck.

Our project redesigns this process using **Parallel Algorithms**. Today, we will walk you through the three core DAA paradigms we implemented to break computing bottlenecks: **Divide and Conquer**, **Optimized Hashing**, and **Logarithmic Reduction Trees**, and demonstrate how we analyzed the performance using Amdahl's Law."

---

## 2. DAA Concept 1: Divide & Conquer (Data Partitioning)
*(Action: Go to the 'Thread Memory' tab and point to the 'Thread Boundaries' on the left)*

**Speaker:**
"The first algorithmic paradigm we used is **Divide and Conquer**. 

To process the data in parallel, we must divide the file among *K* threads. A naive approach would be to read the file sequentially to count the lines, and then split it evenly. However, counting lines takes **O(N)** time, destroying our speed before we even begin parallelization.

**Our Chosen Algorithm:** 
We slice the file mathematically based purely on exact byte-size offsets. Finding a file's size and dividing it by *K* takes **O(1)** time. 
However, an exact byte split might slice a word right in half! To handle this edge case safely, each thread executes a local alignment: it scans forward from its exact start byte until it finds the next 'New Line' character. 

**Time Complexity Achieved:** 
The splitting arithmetic is **O(1)**. The boundary condition adjustment is strictly bound to the length of a single text line, making it a constant **O(C)**. This gives us a perfect, data-safe partitioning phase in roughly **O(1)** time."

---

## 3. DAA Concept 2: Hashing (State Tracking & Concurrency)
*(Action: Point to the interactive Memory Key-Value Slots in the center of the 'Thread Memory' tab)*

**Speaker:**
"Once divided, we enter the mapping phase. Each thread must take a stock ticker, like 'AAPL', search for it, and update its total volume. 

If we used a standard Array or Linked List, searching for the stock would take **O(M)** time per line, making the overall algorithm a slow **O(N × M)**. 
Furthermore, if we used a *shared global scoreboard*, threads would require 'Mutex Locks', forcing them to wait in a queue to write data. This turns a parallel algorithm back into an **O(N)** sequential one!

**Our Chosen Algorithm:** Private Thread-Local Hash Maps.
We give each thread its own isolated memory matrix. We map stock symbols to memory slots using the **djb2 Hashing Algorithm**. 

**Why djb2?** It's famous in computer science for generating excellent bit distribution for short strings, using minimal CPU bit-shifting operations. 
**Collision Resolution Strategy:** We used **Linear Probing**. If a hash slot is taken by another stock, we smoothly offset to the next available address locally.

**Time Complexity Achieved:** 
By eliminating locks and using optimized hashing, we achieve an average **O(1) time complexity** for insertion and lookup. This allows threads to process their sub-arrays blindingly fast in pure **O(N/K)** time."

---

## 4. DAA Concept 3: Decrease & Conquer (Merge Phase)
*(Action: Scroll down to the 'Pairwise Reduction Merge' tree at the bottom)*

**Speaker:**
"After the **O(N/K)** processing phase, we are left with *K* separate private hash maps that need to be merged into one main array.

If the main thread merged them one by one, the merging phase would take **O(K × M)** sequentially.

**Our Chosen Algorithm:** Binary Pairwise Reduction Tree.
This utilizes the **Decrease and Conquer** algorithmic strategy. Instead of a single funnel, Thread 1 merges with Thread 2, while Thread 3 concurrently merges with Thread 4. They form a binary tournament tree of merges until 1 final matrix is left.

**Time Complexity Achieved:** 
By merging in a balanced binary tree structure, what was linear **O(K)** time becomes logarithmic **O(log K)** time. This ensures the merge phase remains lightning-fast, even if we scale up the cluster to hundreds of threads."

---

## 5. Algorithmic Analysis: Amdahl’s Law
*(Action: Switch back to the 'Investment Analytics' Dashboard and point to the Speedup Chart)*

**Speaker:**
"Finally, no DAA presentation is complete without analyzing theoretical limits. 
Our overall time complexity dropped brilliantly from sequential **O(N)** to parallel **O(N/K + log K)**. 

But can we achieve infinite speedup by adding infinite CPU cores (*K → ∞*)?
The math behind this lies in **Amdahl’s Law**. Amdahl's Law states that theoretical speedup is strictly constrained by the *sequential fraction* of an algorithm—the parts that physically cannot be parallelized, such as file loading, process initialization, and final array cleanup.

Our dashboard visualizes this mathematical proof dynamically. The dashed line maps the theoretical asymptotic ceiling (Amdahl's boundary), and the solid dark curve plots the actual observed algorithmic speedup. It visually confirms exactly when the algorithmic benefit of adding threads starts to experience diminishing returns."

---

## 6. Conclusion
**Speaker:**
"In conclusion, our visual simulator is an applied thesis in algorithmic design and optimization. By utilizing **O(1)** Divide and Conquer partitioning, **O(1)** djb2 private hashing, and **O(log K)** Pairwise Reduction Trees, we systematically dismantled the **O(N)** bottleneck of high-frequency data processing.

Thank you, and we welcome any questions your panel may have regarding our Big-O time complexities or algorithm choices."
