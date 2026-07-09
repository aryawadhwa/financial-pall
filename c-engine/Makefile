# ─────────────────────────────────────────────────────────────
# Makefile — Parallel Financial Data Aggregation System (C)
# Cross-platform: macOS / Linux / Windows (MinGW-w64)
#
# Targets:
#   make           → compile the binary
#   make run       → compile + run with auto-detected cores
#   make run W=4   → compile + run with 4 worker threads
#   make gen       → (re)generate 5M row synthetic dataset
#   make bench     → run W=1,2,4,8,16, write scaling JSON
#   make serve     → start static HTTP server for dashboard
#   make clean     → remove build artifacts
#
# Windows (MinGW-w64):
#   Install MSYS2 → pacman -S mingw-w64-x86_64-gcc
#   Run from the MSYS2 MinGW64 shell.
# ─────────────────────────────────────────────────────────────

# ── OS detection ──────────────────────────────────────────────
ifeq ($(OS),Windows_NT)
    CC      = gcc
    CFLAGS  = -O2 -Wall -Wextra -std=c11
    LDFLAGS = -lpthread -lm
    BIN     = financial_agg.exe
    RM      = del /Q
else
    CC      = cc
    CFLAGS  = -O2 -Wall -Wextra -std=c11 -D_POSIX_C_SOURCE=200809L -D_DARWIN_C_SOURCE
    LDFLAGS = -lpthread -lm
    BIN     = financial_agg
    RM      = rm -f
endif

# ── Sources ───────────────────────────────────────────────────
SRCS  = benchmark.c \
        src/ht.c \
        src/aggregator_core.c \
        src/parallel_engine.c

OBJS  = $(SRCS:.c=.o)
DATA  = data/stocks.csv
W    ?= 8

# ── Default ───────────────────────────────────────────────────
all: $(BIN)

$(BIN): $(OBJS)
	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)
	@echo "Build complete -> ./$(BIN)"

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

# ── Run ───────────────────────────────────────────────────────
run: $(BIN)
	./$(BIN) $(W) $(DATA)

# ── Generate dataset ──────────────────────────────────────────
gen:
	python3 src/data_generator.py

# ── Scaling benchmark ─────────────────────────────────────────
bench: $(BIN)
	python3 scaling_analysis.py $(DATA)

# ── Static HTTP server for dashboard ──────────────────────────
serve:
	@echo "Dashboard -> http://localhost:8080"
	python3 -m http.server 8080 --directory dashboard

# ── Clean ─────────────────────────────────────────────────────
clean:
	$(RM) $(OBJS) $(BIN)

.PHONY: all run gen bench serve clean
