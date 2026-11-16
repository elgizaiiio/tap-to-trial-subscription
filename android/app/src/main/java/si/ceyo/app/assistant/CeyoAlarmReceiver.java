package si.ceyo.app.assistant;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import si.ceyo.app.R;

/** Fires scheduled alarms, reminders, bot calls and daily routines (morning briefing / night reflection). */
public class CeyoAlarmReceiver extends BroadcastReceiver {
    public static final String KIND_ALARM = "alarm", KIND_REMINDER = "reminder", KIND_CALL = "call", KIND_MORNING = "morning", KIND_NIGHT = "night";

    static PendingIntent pi(Context c, String kind, String id, String title, String extra, String path) {
        Intent i = new Intent(c, CeyoAlarmReceiver.class).setAction("si.ceyo.app.FIRE." + kind)
            .putExtra("kind", kind).putExtra("id", id).putExtra("title", title).putExtra("extra", extra).putExtra("path", path);
        return PendingIntent.getBroadcast(c, (kind + id).hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void schedule(Context c, String kind, String id, String title, String extra, String path, long at) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        PendingIntent p = pi(c, kind, id, title, extra, path);
        boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
        if (exact && !KIND_REMINDER.equals(kind)) am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, CeyoIntents.open(c, path, 7)), p);
        else if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, p);
        else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, p);
    }

    static void cancel(Context c, String kind, String id) {
        c.getSystemService(AlarmManager.class).cancel(pi(c, kind, id, "", "", "/"));
    }

    @Override public void onReceive(Context c, Intent in) {
        CeyoChannels.ensure(c);
        String kind = in.getStringExtra("kind");
        String id = String.valueOf(in.getStringExtra("id"));
        String title = in.getStringExtra("title");
        String path = CeyoIntents.safePath(in.getStringExtra("path"));
        if (KIND_REMINDER.equals(kind)) {
            notify(c, id.hashCode(), CeyoChannels.UPDATES, "Ceyo", title, path);
        } else if (KIND_CALL.equals(kind)) {
            showIncomingCall(c, id, title, in.getStringExtra("extra"), path);
        } else if (KIND_MORNING.equals(kind) || KIND_NIGHT.equals(kind)) {
            Routines.rescheduleNext(c, kind);
            Intent ring = new Intent(c, CeyoRingActivity.class).putExtra("kind", kind).putExtra("id", id).putExtra("title", title).putExtra("path", path)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            PendingIntent full = PendingIntent.getActivity(c, id.hashCode(), ring, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            boolean night = KIND_NIGHT.equals(kind);
            NotificationCompat.Builder b = new NotificationCompat.Builder(c, night ? CeyoChannels.UPDATES : CeyoChannels.ALARMS)
                .setSmallIcon(R.mipmap.ic_launcher).setContentTitle(night ? "Ceyo · قبل النوم" : "Ceyo · صباح الخير")
                .setContentText(night ? "في أفكار عايز تفضّيها قبل ما تنام؟" : "اضغط عشان أقولك ملخص يومك")
                .setContentIntent(full).setAutoCancel(true).setPriority(NotificationCompat.PRIORITY_HIGH);
            if (!night) b.setFullScreenIntent(full, true).setCategory(NotificationCompat.CATEGORY_ALARM);
            post(c, ("routine" + kind).hashCode(), b);
        } else {
            Intent ring = new Intent(c, CeyoRingActivity.class).putExtra("kind", KIND_ALARM).putExtra("id", id).putExtra("title", title).putExtra("path", path)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            PendingIntent full = PendingIntent.getActivity(c, id.hashCode(), ring, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            post(c, id.hashCode(), new NotificationCompat.Builder(c, CeyoChannels.ALARMS).setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("Ceyo · منبه").setContentText(title).setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(NotificationCompat.PRIORITY_MAX).setFullScreenIntent(full, true).setContentIntent(full).setAutoCancel(true));
        }
    }

    static void showIncomingCall(Context c, String id, String botName, String callKind, String path) {
        CeyoChannels.ensure(c);
        String name = botName == null || botName.isEmpty() ? "Ceyo" : botName;
        Intent ring = new Intent(c, CeyoRingActivity.class).putExtra("kind", KIND_CALL).putExtra("id", id).putExtra("title", name).putExtra("path", path)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent full = PendingIntent.getActivity(c, ("call" + id).hashCode(), ring, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent answer = CeyoIntents.open(c, path, ("ans" + id).hashCode());
        Intent dec = new Intent(c, CeyoCallActionReceiver.class).setAction("si.ceyo.app.DECLINE").putExtra("id", id);
        PendingIntent decline = PendingIntent.getBroadcast(c, ("dec" + id).hashCode(), dec, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Person caller = new Person.Builder().setName(name).setImportant(true).build();
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CeyoChannels.CALLS).setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(name).setContentText("video".equals(callKind) ? "مكالمة فيديو من Ceyo" : "مكالمة صوتية من Ceyo")
            .setStyle(NotificationCompat.CallStyle.forIncomingCall(caller, decline, answer))
            .setCategory(NotificationCompat.CATEGORY_CALL).setPriority(NotificationCompat.PRIORITY_MAX)
            .setFullScreenIntent(full, true).setOngoing(true).setTimeoutAfter(45000);
        post(c, ("call" + id).hashCode(), b);
    }

    static void notify(Context c, int nid, String channel, String title, String text, String path) {
        post(c, nid, new NotificationCompat.Builder(c, channel).setSmallIcon(R.mipmap.ic_launcher).setContentTitle(title)
            .setContentText(text).setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setContentIntent(CeyoIntents.open(c, path, nid)).setAutoCancel(true));
    }

    static void post(Context c, int nid, NotificationCompat.Builder b) {
        try { c.getSystemService(NotificationManager.class).notify(nid, b.build()); } catch (SecurityException ignored) { }
    }
}
