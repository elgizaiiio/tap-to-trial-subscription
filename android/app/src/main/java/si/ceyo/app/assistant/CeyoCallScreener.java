package si.ceyo.app.assistant;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.telecom.Call;
import android.telecom.CallScreeningService;
import androidx.core.app.NotificationCompat;
import si.ceyo.app.R;

/** Guards calls from numbers that are NOT in the user's contacts (Android only sends those to screening apps).
 *  Modes: "off", "notify" (ring normally, Ceyo explains), "silence" (no ring, Ceyo offers a text reply), "block_spoofed".
 *  Android does not let ordinary apps speak into a phone call, so Ceyo answers by text message, not by voice. */
public class CeyoCallScreener extends CallScreeningService {
    public static String decide(String mode, boolean incoming, boolean spoofed) {
        if (!incoming || mode == null || "off".equals(mode)) return "allow";
        if (spoofed) return "reject";
        if ("silence".equals(mode)) return "silence";
        return "allow";
    }

    @Override public void onScreenCall(Call.Details d) {
        String mode = Routines.prefs(this).getString("screen_mode", "notify");
        boolean incoming = Build.VERSION.SDK_INT < 29 || d.getCallDirection() == Call.Details.DIRECTION_INCOMING;
        boolean spoofed = Build.VERSION.SDK_INT >= 30 && d.getCallerNumberVerificationStatus() == android.telecom.Connection.VERIFICATION_STATUS_FAILED;
        String action = decide(mode, incoming, spoofed);
        CallResponse.Builder r = new CallResponse.Builder();
        if ("reject".equals(action)) r.setDisallowCall(true).setRejectCall(true).setSkipNotification(false);
        else if ("silence".equals(action) && Build.VERSION.SDK_INT >= 29) r.setSilenceCall(true);
        respondToCall(d, r.build());
        if (!incoming || "off".equals(mode)) return;

        Uri handle = d.getHandle();
        String number = handle == null ? "" : handle.getSchemeSpecificPart();
        CeyoChannels.ensure(this);
        String msg = "reject".equals(action) ? "Ceyo رفض مكالمة من رقم مزيّف " + number
            : "silence".equals(action) ? "رقم غريب بيتصل (" + number + "). سكّتّه ليك، تحب أبعتله رسالة؟"
            : "رقم مش متسجل بيتصل: " + number;
        String reply = "أهلاً، أنا Ceyo المساعد الذكي. صاحب الرقم مش متاح دلوقتي، ممكن تكتبلي سبب الاتصال وهوصّله الرسالة؟";
        Intent sms = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + Uri.encode(number))).putExtra("sms_body", reply).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        android.app.PendingIntent smsPi = android.app.PendingIntent.getActivity(this, ("sms" + number).hashCode(), sms, android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CeyoChannels.GUARD).setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("📞 Ceyo · حارس المكالمات").setContentText(msg).setStyle(new NotificationCompat.BigTextStyle().bigText(msg))
            .setContentIntent(CeyoIntents.open(this, "/?ceyoSend=0&ceyoPrompt=" + Uri.encode("اتصل بيا رقم غريب " + number + "، ساعدني أعرف ممكن يكون مين أو أتعامل معاه إزاي."), 1001))
            .setAutoCancel(true);
        if (!number.isEmpty() && !"reject".equals(action)) b.addAction(0, "رد برسالة من Ceyo", smsPi);
        CeyoAlarmReceiver.post(this, ("screen" + number).hashCode(), b);
    }
}
