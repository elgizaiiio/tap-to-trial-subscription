package si.ceyo.app.assistant;

import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.app.ServiceCompat;
import si.ceyo.app.R;

/** Keeps a live bot call (and its microphone) running while the user leaves the app. */
public class CeyoCallService extends Service {
    @Override public int onStartCommand(Intent in, int flags, int startId) {
        CeyoChannels.ensure(this);
        String name = in == null ? "Ceyo" : String.valueOf(in.getStringExtra("botName"));
        Intent hang = new Intent(this, CeyoCallActionReceiver.class).setAction("si.ceyo.app.HANGUP").putExtra("id", in == null ? "" : in.getStringExtra("id"));
        android.app.PendingIntent hangPi = android.app.PendingIntent.getBroadcast(this, 701, hang, android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CeyoChannels.LIVE).setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(name).setContentText("مكالمة شغالة").setOngoing(true).setContentIntent(CeyoIntents.open(this, "/", 702))
            .setStyle(NotificationCompat.CallStyle.forOngoingCall(new Person.Builder().setName(name).build(), hangPi))
            .setCategory(NotificationCompat.CATEGORY_CALL);
        int type = Build.VERSION.SDK_INT >= 30 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE : 0;
        try { ServiceCompat.startForeground(this, 700, b.build(), type); } catch (Exception e) { stopSelf(); }
        return START_NOT_STICKY;
    }
    @Override public IBinder onBind(Intent i) { return null; }
}
