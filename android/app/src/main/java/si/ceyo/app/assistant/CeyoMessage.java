package si.ceyo.app.assistant;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.app.RemoteInput;
import androidx.core.graphics.drawable.IconCompat;
import si.ceyo.app.MainActivity;
import si.ceyo.app.R;

/** WhatsApp-style message from the user's robot: its picture and name, inline Reply and Like. */
public final class CeyoMessage {
    public static final String REPLY_KEY = "ceyo_reply";
    private CeyoMessage() {}

    public static void post(Context c, int nid, String botName, String text, String path) {
        CeyoChannels.ensure(c);
        String name = botName == null || botName.isEmpty() ? CeyoRobot.name(c) : botName;
        Person bot = new Person.Builder().setName(name).setKey("ceyo-bot").setImportant(true)
            .setIcon(IconCompat.createWithBitmap(CeyoRobot.bitmap(c, "done", 128))).build();
        String safe = CeyoIntents.safePath(path);
        Intent replyIntent = new Intent(c, MainActivity.class).setAction("si.ceyo.app.REPLY." + nid).putExtra(CeyoIntents.EXTRA_PATH, safe)
            .putExtra("reply_nid", nid).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int mutable = Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0;
        PendingIntent replyPi = PendingIntent.getActivity(c, ("reply" + nid).hashCode(), replyIntent, PendingIntent.FLAG_UPDATE_CURRENT | mutable);
        NotificationCompat.Action reply = new NotificationCompat.Action.Builder(0, "رد", replyPi)
            .addRemoteInput(new RemoteInput.Builder(REPLY_KEY).setLabel("اكتب ردك…").build())
            .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_REPLY).setAllowGeneratedReplies(true).build();
        Intent like = new Intent(c, CeyoCallActionReceiver.class).setAction("si.ceyo.app.LIKE").putExtra("nid", nid);
        PendingIntent likePi = PendingIntent.getBroadcast(c, ("like" + nid).hashCode(), like, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        CeyoAlarmReceiver.post(c, nid, new NotificationCompat.Builder(c, CeyoChannels.UPDATES).setSmallIcon(R.drawable.ceyo_notification_icon)
            .setLargeIcon(CeyoRobot.bitmap(c, "done", 128))
            .setStyle(new NotificationCompat.MessagingStyle(new Person.Builder().setName("أنت").build()).addMessage(text, System.currentTimeMillis(), bot))
            .setCategory(NotificationCompat.CATEGORY_MESSAGE).setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(CeyoIntents.open(c, safe, ("open" + nid).hashCode()))
            .addAction(reply).addAction(0, "👍 أعجبني", likePi).setAutoCancel(true));
    }
}
