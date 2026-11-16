package si.ceyo.app.assistant;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

/** High-priority data pushes from the Ceyo server: rings a bot call or shows an update even when the app is fully closed. */
public class CeyoPushService extends FirebaseMessagingService {
    @Override public void onMessageReceived(RemoteMessage m) {
        Map<String, String> d = m.getData();
        String kind = d.get("kind");
        if ("call".equals(kind)) {
            String id = String.valueOf(d.get("id")).replaceAll("[^A-Za-z0-9_\\-]", "");
            CeyoAlarmReceiver.showIncomingCall(this, id, d.get("botName"), d.get("callKind"), "/?answerCall=" + id);
        } else if ("update".equals(kind)) {
            CeyoChannels.ensure(this);
            CeyoAlarmReceiver.notify(this, String.valueOf(d.get("id")).hashCode(), CeyoChannels.UPDATES,
                d.getOrDefault("title", "Ceyo"), d.getOrDefault("text", ""), CeyoIntents.safePath(d.get("path")));
            CeyoWidget.setStatus(this, d.get("title"), d.get("text"));
        }
    }
    @Override public void onNewToken(String token) { MegsyBridge.dispatchPushToken(token); }
}
