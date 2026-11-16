package si.ceyo.app.assistant;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;

public final class CeyoChannels {
    public static final String LIVE = "ceyo_live";
    public static final String UPDATES = "ceyo_updates";
    public static final String CALLS = "ceyo_calls";
    public static final String ALARMS = "ceyo_alarms";
    public static final String GUARD = "ceyo_guard";
    private CeyoChannels() {}

    public static void ensure(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel(LIVE, "Ceyo · مهام شغالة", NotificationManager.IMPORTANCE_LOW));
        nm.createNotificationChannel(new NotificationChannel(UPDATES, "Ceyo · تحديثات", NotificationManager.IMPORTANCE_DEFAULT));
        nm.createNotificationChannel(new NotificationChannel(GUARD, "Ceyo · حماية وفواتير", NotificationManager.IMPORTANCE_HIGH));
        AudioAttributes ring = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
        NotificationChannel calls = new NotificationChannel(CALLS, "Ceyo · مكالمات", NotificationManager.IMPORTANCE_HIGH);
        calls.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE), ring);
        calls.enableVibration(true);
        nm.createNotificationChannel(calls);
        AudioAttributes alarm = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
        NotificationChannel alarms = new NotificationChannel(ALARMS, "Ceyo · منبه هادئ", NotificationManager.IMPORTANCE_HIGH);
        alarms.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM), alarm);
        nm.createNotificationChannel(alarms);
    }
}
