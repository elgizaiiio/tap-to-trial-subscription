package si.ceyo.app.assistant;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.Calendar;

/** Daily morning briefing and night reflection times chosen by the user (stored on the phone only). */
public final class Routines {
    private Routines() {}
    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("ceyo_assistant", Context.MODE_PRIVATE); }

    public static long nextAt(int hour, int minute, long now) {
        Calendar cal = Calendar.getInstance();
        cal.setTimeInMillis(now);
        cal.set(Calendar.HOUR_OF_DAY, hour); cal.set(Calendar.MINUTE, minute); cal.set(Calendar.SECOND, 0); cal.set(Calendar.MILLISECOND, 0);
        if (cal.getTimeInMillis() <= now) cal.add(Calendar.DAY_OF_YEAR, 1);
        return cal.getTimeInMillis();
    }

    public static void set(Context c, String kind, int hour, int minute, boolean on) {
        prefs(c).edit().putBoolean(kind + "_on", on).putInt(kind + "_h", hour).putInt(kind + "_m", minute).apply();
        if (on) rescheduleNext(c, kind); else CeyoAlarmReceiver.cancel(c, kind, kind);
    }

    public static void rescheduleNext(Context c, String kind) {
        SharedPreferences p = prefs(c);
        if (!p.getBoolean(kind + "_on", false)) return;
        long at = nextAt(p.getInt(kind + "_h", 7), p.getInt(kind + "_m", 0), System.currentTimeMillis() + 60000);
        CeyoAlarmReceiver.schedule(c, kind, kind, kind, "", "/", at);
    }

    public static void restoreAll(Context c) { rescheduleNext(c, CeyoAlarmReceiver.KIND_MORNING); rescheduleNext(c, CeyoAlarmReceiver.KIND_NIGHT); }
}
