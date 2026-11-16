package android.text;

/** Minimal JVM substitute for the Android check used by Billing's JSON constructor. */
public final class TextUtils {
    private TextUtils() {}
    public static boolean isEmpty(CharSequence value) { return value == null || value.length() == 0; }
}