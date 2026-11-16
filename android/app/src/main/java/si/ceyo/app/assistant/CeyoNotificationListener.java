package si.ceyo.app.assistant;

import android.app.Notification;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import androidx.core.app.NotificationCompat;
import si.ceyo.app.R;

/** Optional (user enables it in Android settings). Checks incoming notifications ON THE PHONE for bills and scam links,
 *  and keeps a running count for the Ceyo digest. Nothing is uploaded from here. */
public class CeyoNotificationListener extends NotificationListenerService {
    @Override public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || getPackageName().equals(sbn.getPackageName()) || sbn.isOngoing()) return;
        Bundle ex = sbn.getNotification().extras;
        String title = String.valueOf(ex.getCharSequence(Notification.EXTRA_TITLE, ""));
        CharSequence big = ex.getCharSequence(Notification.EXTRA_BIG_TEXT);
        String text = String.valueOf(big != null ? big : ex.getCharSequence(Notification.EXTRA_TEXT, ""));
        if (text.isEmpty() || "null".equals(text)) return;
        SharedPreferences p = Routines.prefs(this);
        p.edit().putInt("digest_count", p.getInt("digest_count", 0) + 1).apply();
        CeyoChannels.ensure(this);
        if (p.getBoolean("guard_links", true)) {
            for (String link : Sentinel.links(text)) {
                String why = Sentinel.suspiciousReason(link);
                if (why == null) continue;
                String msg = why.startsWith("brand:") ? "الرابط ده بيقلّد اسم " + why.substring(6) + " ومش من موقعهم الرسمي. متدخلش بياناتك." : "الرابط ده شكله مريب. اتأكد قبل ما تفتحه.";
                CeyoAlarmReceiver.post(this, ("scam" + link).hashCode(), new NotificationCompat.Builder(this, CeyoChannels.GUARD)
                    .setSmallIcon(R.mipmap.ic_launcher).setContentTitle("⚠️ Ceyo · تحذير من رابط").setContentText(msg)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(msg + "\n" + link)).setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setContentIntent(CeyoIntents.open(this, "/?ceyoSend=1&ceyoPrompt=" + Uri.encode("افحص الرابط ده وقولي هو آمن ولا احتيال: " + link), 601)).setAutoCancel(true));
                break;
            }
        }
        double spent = Sentinel.detectSpend(title + " " + text);
        if (spent > 0) {
            String today = new java.text.SimpleDateFormat("yyyyMMdd", java.util.Locale.ROOT).format(new java.util.Date());
            float total = (today.equals(p.getString("spent_day", "")) ? p.getFloat("spent_total", 0f) : 0f) + (float) spent;
            int count = (today.equals(p.getString("spent_day", "")) ? p.getInt("spent_count", 0) : 0) + 1;
            p.edit().putString("spent_day", today).putFloat("spent_total", total).putInt("spent_count", count).apply();
            String sum = String.format(java.util.Locale.ROOT, "%.0f", total);
            String msg = total >= p.getFloat("spend_limit", 1000f)
                ? "خلي بالك 👀 صرفت النهارده " + sum + " في " + count + " عمليات، ده كتير عن العادي. تحب أراجعهم معاك؟"
                : "اتسجل مصروف " + String.format(java.util.Locale.ROOT, "%.0f", spent) + " — إجمالي النهارده " + sum + ".";
            CeyoMessage.post(this, 820, null, msg, "/?ceyoSend=0&ceyoPrompt=" + Uri.encode("صرفت النهارده " + sum + " في " + count + " عمليات. راجع معايا مصاريفي:"));
        }
        if (p.getBoolean("guard_bills", true)) {
            Sentinel.Bill bill = Sentinel.detectBill(title + " " + text);
            if (bill != null) {
                String msg = "وصلت فاتورة بمبلغ " + bill.amount + " " + bill.currency + (bill.due != null ? " تستحق " + bill.due : "") + ". أفكرك قبلها بيوم؟";
                CeyoAlarmReceiver.post(this, ("bill" + sbn.getKey()).hashCode(), new NotificationCompat.Builder(this, CeyoChannels.GUARD)
                    .setSmallIcon(R.mipmap.ic_launcher).setContentTitle("🧾 Ceyo · فاتورة").setContentText(msg)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(msg))
                    .setContentIntent(CeyoIntents.open(this, "/?ceyoSend=1&ceyoPrompt=" + Uri.encode("سجّل الفاتورة دي وفكرني قبل ميعادها بيوم: " + bill.amount + " " + bill.currency + (bill.due != null ? " بتاريخ " + bill.due : "") + " — " + title), 602)).setAutoCancel(true));
            }
        }
    }
}
