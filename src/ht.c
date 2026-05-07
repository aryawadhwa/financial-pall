/* ─────────────────────────────────────────────────────────────
 * ht.c  —  Open-Addressing Hash Table implementation
 *
 * Only ht_to_sorted_array() is out-of-line (requires qsort).
 * All other operations are static inline in ht.h.
 * ───────────────────────────────────────────────────────────── */

#define _POSIX_C_SOURCE 200809L

#include "ht.h"
#include <stdlib.h>
#include <string.h>

/* Comparator for qsort: lexicographic by ticker symbol */
static int ticker_cmp(const void *a, const void *b) {
    const TickerEntry *ea = (const TickerEntry *)a;
    const TickerEntry *eb = (const TickerEntry *)b;
    return strncmp(ea->ticker, eb->ticker, TICKER_LEN);
}

/*
 * ht_to_sorted_array
 *
 * Iterates every slot in the hash table, copies non-empty entries
 * into out[], computes net_flow = buy - sell for each entry, then
 * sorts the array by ticker name using qsort().
 *
 * Complexity: O(TABLE_SIZE) scan + O(K log K) sort
 *   where K = number of distinct tickers (typically 8-20).
 *   Since K is bounded by a small constant, this is effectively O(1)
 *   from the perspective of the per-row N work.
 */
void ht_to_sorted_array(const HashTable *ht, TickerEntry *out, int *count) {
    int n = 0;
    for (int i = 0; i < TABLE_SIZE; i++) {
        if (ht->slots[i].key[0] != '\0') {
            strncpy(out[n].ticker, ht->slots[i].key, TICKER_LEN - 1);
            out[n].ticker[TICKER_LEN - 1] = '\0';
            out[n].buy      = ht->slots[i].buy;
            out[n].sell     = ht->slots[i].sell;
            out[n].net_flow = ht->slots[i].buy - ht->slots[i].sell;
            n++;
        }
    }
    qsort(out, (size_t)n, sizeof(TickerEntry), ticker_cmp);
    *count = n;
}
