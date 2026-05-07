#ifndef PLATFORM_H
#define PLATFORM_H

/* ─────────────────────────────────────────────────────────────
 * platform.h  —  Cross-platform shims
 *
 * Targets:
 *   macOS / Linux : native pthreads, sysconf, clock_gettime
 *   Windows       : MinGW-w64 (ships winpthreads)
 *                   pthreads API works unchanged.
 *                   Only timing, CPU count, and mkdir differ.
 *
 * Usage: include this instead of <unistd.h>, <sys/stat.h>,
 *        and <time.h> in translation units that need timing
 *        or CPU count.
 * ───────────────────────────────────────────────────────────── */

#ifdef _WIN32
/* ── Windows (MinGW-w64) ─────────────────────────────────── */

#  include <windows.h>
#  include <direct.h>    /* _mkdir */

/* CPU core count */
static inline int platform_cpu_count(void) {
    SYSTEM_INFO si;
    GetSystemInfo(&si);
    return (int)si.dwNumberOfProcessors;
}

/* High-resolution wall-clock time in seconds */
static inline double platform_time_s(void) {
    LARGE_INTEGER freq, count;
    QueryPerformanceFrequency(&freq);
    QueryPerformanceCounter(&count);
    return (double)count.QuadPart / (double)freq.QuadPart;
}

/* mkdir wrapper — Windows takes only one argument */
static inline void platform_mkdir(const char *path) {
    _mkdir(path);
}

#else
/* ── macOS / Linux ───────────────────────────────────────── */

#  include <unistd.h>
#  include <time.h>
#  include <sys/stat.h>

static inline int platform_cpu_count(void) {
    long n = sysconf(_SC_NPROCESSORS_ONLN);
    return (n > 0) ? (int)n : 1;
}

static inline double platform_time_s(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (double)ts.tv_sec + (double)ts.tv_nsec * 1e-9;
}

static inline void platform_mkdir(const char *path) {
    mkdir(path, 0755);
}

#endif /* _WIN32 */
#endif /* PLATFORM_H */
