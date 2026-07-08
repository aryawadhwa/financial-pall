#ifndef HT_H
#define HT_H

/* ─────────────────────────────────────────────────────────────
 * ht.h  —  Open-Addressing Hash Table (Map phase data structure)
 *
 * Purpose:
 *   Each worker thread owns one HashTable. During the Map phase,
 *   every CSV row calls ht_update() to accumulate buy/sell totals
 *   by ticker in O(1) average time.
 *
 * Design decisions:
 *   - Fixed-size table (TABLE_SIZE = 64 slots): tickers are a
 *     bounded, small set (typically 8–20). A power-of-two size
 *     lets us use bitwise AND instead of modulo.
 *   - Linear probing: cache-friendly, simple to implement, zero
 *     dynamic allocation.
 *   - Separate buy/sell accumulators per slot: avoids a branch
 *     in ht_to_sorted_array when computing net flow.
 *
 * After the Map phase, ht_to_sorted_array() dumps the live entries
 * into a flat TickerEntry[] sorted by ticker name. The Reduce phase
 * then uses a sorted merge (O(K)) at each tree level.
 * ───────────────────────────────────────────────────────────── */

#include <string.h>

#define TABLE_SIZE  64          /* must be power of two          */
#define TICKER_LEN  16          /* max ticker symbol length + NUL */

/* One slot in the hash table */
typedef struct {
    char   key[TICKER_LEN];    /* ticker symbol; empty if slot unused */
    double buy;                /* accumulated buy  total_value        */
    double sell;               /* accumulated sell total_value        */
} HtSlot;

/* Per-worker hash table — stack-allocated, zero-init before use */
typedef struct {
    HtSlot slots[TABLE_SIZE];
    int    count;              /* number of distinct tickers inserted */
} HashTable;

/* ── API ─────────────────────────────────────────────────────── */

/* Zero-initialise the table (call once per worker before Map) */
static inline void ht_init(HashTable *ht) {
    memset(ht, 0, sizeof(HashTable));
}

/*
 * ht_update — insert or accumulate a trade row.
 *   key    : ticker symbol (NUL-terminated)
 *   val    : total_value from the CSV row
 *   is_buy : 1 if BUY, 0 if SELL
 *
 * Hash function: djb2 variant, masked to table index.
 * Collision resolution: linear probing.
 * Returns 0 on success, -1 if table is full (should never happen).
 */
static inline int ht_update(HashTable *ht,
                             const char *key, double val, int is_buy)
{
    /* djb2 hash */
    unsigned long h = 5381;
    for (const char *p = key; *p; p++)
        h = ((h << 5) + h) ^ (unsigned char)*p;
    int idx = (int)(h & (TABLE_SIZE - 1));

    /* Linear probe */
    for (int i = 0; i < TABLE_SIZE; i++) {
        HtSlot *s = &ht->slots[idx];

        if (s->key[0] == '\0') {
            /* Empty slot — insert new ticker */
            strncpy(s->key, key, TICKER_LEN - 1);
            s->key[TICKER_LEN - 1] = '\0';
            if (is_buy) s->buy  += val;
            else        s->sell += val;
            ht->count++;
            return 0;
        }

        if (strncmp(s->key, key, TICKER_LEN) == 0) {
            /* Existing slot — accumulate */
            if (is_buy) s->buy  += val;
            else        s->sell += val;
            return 0;
        }

        idx = (idx + 1) & (TABLE_SIZE - 1);
    }
    return -1; /* table full — unreachable for K <= 64 */
}

/* TickerEntry: used for sorted array output from each worker */
typedef struct {
    char   ticker[TICKER_LEN];
    double buy;
    double sell;
    double net_flow;
} TickerEntry;

/*
 * ht_to_sorted_array — dump live hash table entries into `out[]`
 * sorted by ticker name (ascending). Sets *count to number of entries.
 * `out` must have capacity >= TABLE_SIZE.
 */
void ht_to_sorted_array(const HashTable *ht, TickerEntry *out, int *count);

#endif /* HT_H */
