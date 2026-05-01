# ─────────────────────────────────────────────────────────────
# Makefile — Parallel Financial Data Aggregation System (C)
#
# Targets:
#   make           → compile ./financial_agg
#   make run       → compile + run benchmark on data/stocks.csv
#   make clean     → remove build artifacts
#   make gen       → (re)generate stock data via Python generator
# ─────────────────────────────────────────────────────────────

CC      = cc
# -O2            : optimise for speed
# -Wall -Wextra  : strict warnings
# -std=c11       : use C11 standard
# -D_POSIX_C_SOURCE=200809L : expose strtok_r, clock_gettime etc.
CFLAGS  = -O2 -Wall -Wextra -std=c11

# Link: pthreads + libm (for fabs)
LDFLAGS = -lpthread -lm

SRCS    = benchmark.c \
          src/aggregator_core.c \
          src/parallel_engine.c

OBJS    = $(SRCS:.c=.o)
BIN     = financial_agg

# ── Default target ────────────────────────────────────────────
all: $(BIN)

$(BIN): $(OBJS)
	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)
	@echo "Build complete → ./$(BIN)"

# Pattern rule: compile each .c to .o
%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

# ── Run ───────────────────────────────────────────────────────
run: $(BIN)
	./$(BIN) data/stocks.csv

# ── Regenerate data ───────────────────────────────────────────
gen:
	python3 src/data_generator.py

# ── Clean ─────────────────────────────────────────────────────
clean:
	rm -f $(OBJS) $(BIN)

.PHONY: all run gen clean
