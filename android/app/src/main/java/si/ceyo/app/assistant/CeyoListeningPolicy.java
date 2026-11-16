package si.ceyo.app.assistant;

/** Pure retry policy: silence is normal; hard failures cannot spin forever. */
public final class CeyoListeningPolicy {
    private CeyoListeningPolicy() {}
    public static long retryDelay(int error, int failures) {
        if (error == 6 || error == 7) return 500; // speech timeout / no match
        if (error == 9 || failures >= 4) return -1; // denied / unavailable
        return Math.min(8000, 1000L << Math.max(0, failures));
    }
}