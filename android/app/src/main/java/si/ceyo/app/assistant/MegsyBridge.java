package si.ceyo.app.assistant;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import java.lang.ref.WeakReference;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;
import si.ceyo.app.R;

/** `window.MegsyAndroid` — only answers pages from the trusted Ceyo origin. See docs/android-bridge.md. */
public class MegsyBridge {
    public static final String TRUSTED_HOST = "tap-to-trial-subscription.lovable.app";
    private static WeakReference<WebView> current = new WeakReference<>(null);
    private final Activity activity;
    private final WebView web;

    public MegsyBridge(Activity activity, WebView web) { this.activity = activity; this.web = web; current = new WeakReference<>(web); }

    public static boolean trustedUrl(String url) {
        if (url == null) return false;
        Uri u = Uri.parse(url);
        return "https".equals(u.getScheme()) && TRUSTED_HOST.equals(u.getHost());
    }

    private boolean trusted() {
        final String[] url = new String[1];
        CountDownLatch l = new CountDownLatch(1);
        web.post(() -> { url[0] = web.getUrl(); l.countDown(); });
        try { l.await(800, TimeUnit.MILLISECONDS); } catch (InterruptedException ignored) { }
        return trustedUrl(url[0]);
    }

    private Context ctx() { return activity.getApplicationContext(); }
    private static JSONObject parse(String json) { try { return new JSONObject(json); } catch (Exception e) { return new JSONObject(); } }

    public static void dispatchCallAction(String id, String action) {
        WebView w = current.get();
        if (w == null) return;
        String safeId = id.replaceAll("[^A-Za-z0-9_\\-]", "");
        w.post(() -> w.evaluateJavascript("window.megsyNativeCallAction&&window.megsyNativeCallAction('" + safeId + "','" + action + "')", null));
    }

    @JavascriptInterface public void scheduleAlarm(String json) { if (!trusted()) return; JSONObject o = parse(json);
        CeyoAlarmReceiver.schedule(ctx(), CeyoAlarmReceiver.KIND_ALARM, o.optString("id"), o.optString("title"), "", o.optString("path", "/"), o.optLong("at")); }
    @JavascriptInterface public void scheduleReminder(String json) { if (!trusted()) return; JSONObject o = parse(json);
        CeyoAlarmReceiver.schedule(ctx(), CeyoAlarmReceiver.KIND_REMINDER, o.optString("id"), o.optString("title"), "", o.optString("path", "/"), o.optLong("at")); }
    @JavascriptInterface public void cancel(String id) { if (!trusted()) return;
        CeyoAlarmReceiver.cancel(ctx(), CeyoAlarmReceiver.KIND_ALARM, id); CeyoAlarmReceiver.cancel(ctx(), CeyoAlarmReceiver.KIND_REMINDER, id); }
    @JavascriptInterface public void requestPushToken() { if (!trusted()) return;
        try {
            if (com.google.firebase.FirebaseApp.getApps(ctx()).isEmpty() && com.google.firebase.FirebaseApp.initializeApp(ctx()) == null) return;
            com.google.firebase.messaging.FirebaseMessaging.getInstance().getToken().addOnSuccessListener(MegsyBridge::dispatchPushToken);
        } catch (Throwable ignored) { /* push not configured in this build */ } }

    public static void dispatchPushToken(String token) {
        WebView w = current.get();
        if (w == null || token == null) return;
        String safe = token.replaceAll("[^A-Za-z0-9_:\\-]", "");
        w.post(() -> w.evaluateJavascript("window.megsyNativePushToken&&window.megsyNativePushToken('" + safe + "')", null));
    }

    @JavascriptInterface public void scheduleCall(String json) { if (!trusted()) return; JSONObject o = parse(json);
        CeyoAlarmReceiver.schedule(ctx(), CeyoAlarmReceiver.KIND_CALL, o.optString("id"), o.optString("botName"), o.optString("kind"), o.optString("path", "/"), o.optLong("at")); }
    @JavascriptInterface public void showIncomingCall(String json) { if (!trusted()) return; JSONObject o = parse(json);
        CeyoAlarmReceiver.showIncomingCall(ctx(), o.optString("id"), o.optString("botName"), o.optString("kind"), CeyoIntents.safePath(o.optString("path", "/"))); }
    @JavascriptInterface public void cancelCall(String id) { if (!trusted()) return;
        CeyoAlarmReceiver.cancel(ctx(), CeyoAlarmReceiver.KIND_CALL, id); ctx().getSystemService(NotificationManager.class).cancel(("call" + id).hashCode()); }
    @JavascriptInterface public void callStarted(String json) { if (!trusted()) return; JSONObject o = parse(json);
        Intent i = new Intent(ctx(), CeyoCallService.class).putExtra("id", o.optString("id")).putExtra("botName", o.optString("botName", "Ceyo"));
        try { if (Build.VERSION.SDK_INT >= 26) ctx().startForegroundService(i); else ctx().startService(i); } catch (Exception ignored) { } }
    @JavascriptInterface public void callEnded(String id) { if (!trusted()) return; ctx().stopService(new Intent(ctx(), CeyoCallService.class)); }

    /** Ongoing "bot is working" notification (status-bar chip on phones that show live updates). */
    @JavascriptInterface public void liveUpdate(String json) { if (!trusted()) return; JSONObject o = parse(json);
        CeyoChannels.ensure(ctx());
        String title = o.optString("title", "Ceyo شغال"), text = o.optString("text", "");
        int progress = o.optInt("progress", -1);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx(), CeyoChannels.LIVE).setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title).setContentText(text).setOngoing(true).setOnlyAlertOnce(true).setRequestPromotedOngoing(true)
            .setShortCriticalText("Ceyo").setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setContentIntent(CeyoIntents.open(ctx(), "/", 801))
            .setProgress(100, Math.max(progress, 0), progress < 0);
        CeyoAlarmReceiver.post(ctx(), 800, b);
        CeyoWidget.setStatus(ctx(), title, text); }
    @JavascriptInterface public void liveEnd(String json) { if (!trusted()) return; JSONObject o = parse(json);
        ctx().getSystemService(NotificationManager.class).cancel(800);
        String text = o.optString("text", "");
        if (!text.isEmpty()) {
            CeyoChannels.ensure(ctx());
            CeyoAlarmReceiver.post(ctx(), 802, new NotificationCompat.Builder(ctx(), CeyoChannels.UPDATES).setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(o.optString("title", "Ceyo خلص")).setContentText(text).setStyle(new NotificationCompat.BigTextStyle().bigText(text))
                .setContentIntent(CeyoIntents.open(ctx(), "/", 803)).addAction(0, "🎙 رد بصوتك", CeyoIntents.listen(ctx(), 804)).setAutoCancel(true));
        }
        CeyoWidget.setStatus(ctx(), o.optString("title", ""), text); }
    @JavascriptInterface public void widgetStatus(String json) { if (!trusted()) return; JSONObject o = parse(json); CeyoWidget.setStatus(ctx(), o.optString("title"), o.optString("text")); }
    @JavascriptInterface public void speak(String json) { if (!trusted()) return; JSONObject o = parse(json); CeyoSpeech.speak(ctx(), o.optString("text"), o.optString("lang", null)); }
    @JavascriptInterface public void stopSpeaking() { if (trusted()) CeyoSpeech.stop(); }
    @JavascriptInterface public void setRoutine(String json) { if (!trusted()) return; JSONObject o = parse(json);
        String kind = o.optString("kind");
        if (!CeyoAlarmReceiver.KIND_MORNING.equals(kind) && !CeyoAlarmReceiver.KIND_NIGHT.equals(kind)) return;
        Routines.set(ctx(), kind, Math.max(0, Math.min(23, o.optInt("hour", 7))), Math.max(0, Math.min(59, o.optInt("minute", 0))), o.optBoolean("on")); }
    @JavascriptInterface public void setOption(String json) { if (!trusted()) return; JSONObject o = parse(json);
        String key = o.optString("key");
        if (key.equals("screen_mode")) {
            String mode = o.optString("value", "notify");
            if (!mode.matches("off|notify|silence")) return;
            Routines.prefs(ctx()).edit().putString("screen_mode", mode).apply();
            if (!"off".equals(mode)) activity.runOnUiThread(this::requestScreeningRole);
            return;
        }
        if (!key.equals("car_on") && !key.equals("guard_links") && !key.equals("guard_bills") && !key.equals("wake_on")) return;
        Routines.prefs(ctx()).edit().putBoolean(key, o.optBoolean("on")).apply();
        if (key.equals("wake_on")) {
            if (!o.optBoolean("on")) { CeyoWakeService.stop(ctx()); return; }
            if (activity.checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != android.content.pm.PackageManager.PERMISSION_GRANTED)
                activity.runOnUiThread(() -> activity.requestPermissions(new String[]{android.Manifest.permission.RECORD_AUDIO}, 53));
            else activity.runOnUiThread(() -> CeyoWakeService.start(activity));
            return;
        }
        if (key.equals("car_on") && o.optBoolean("on") && Build.VERSION.SDK_INT >= 31)
            activity.runOnUiThread(() -> activity.requestPermissions(new String[]{"android.permission.BLUETOOTH_CONNECT"}, 52)); }
    private void requestScreeningRole() {
        if (Build.VERSION.SDK_INT < 29) return;
        android.app.role.RoleManager rm = activity.getSystemService(android.app.role.RoleManager.class);
        if (rm != null && rm.isRoleAvailable(android.app.role.RoleManager.ROLE_CALL_SCREENING) && !rm.isRoleHeld(android.app.role.RoleManager.ROLE_CALL_SCREENING))
            activity.startActivityForResult(rm.createRequestRoleIntent(android.app.role.RoleManager.ROLE_CALL_SCREENING), 54);
    }

    @JavascriptInterface public String status() { if (!trusted()) return "{}";
        try {
            JSONObject s = new JSONObject();
            android.content.SharedPreferences p = Routines.prefs(ctx());
            s.put("notifications", NotificationManagerCompat.from(ctx()).areNotificationsEnabled());
            s.put("listener", NotificationManagerCompat.getEnabledListenerPackages(ctx()).contains(ctx().getPackageName()));
            String assistant = Settings.Secure.getString(ctx().getContentResolver(), "voice_interaction_service");
            s.put("assistant", assistant != null && assistant.startsWith(ctx().getPackageName()));
            s.put("screen_mode", p.getString("screen_mode", "notify"));
            s.put("bundled_voice", CeyoVoiceEngine.available(ctx()));
            if (Build.VERSION.SDK_INT >= 29) { android.app.role.RoleManager rm = activity.getSystemService(android.app.role.RoleManager.class);
                s.put("screening", rm != null && rm.isRoleHeld(android.app.role.RoleManager.ROLE_CALL_SCREENING)); }
            for (String k : new String[]{"car_on", "guard_links", "guard_bills", "morning_on", "night_on", "wake_on"}) s.put(k, p.getBoolean(k, k.startsWith("guard")));
            s.put("morning_h", p.getInt("morning_h", 7)); s.put("morning_m", p.getInt("morning_m", 0));
            s.put("night_h", p.getInt("night_h", 23)); s.put("night_m", p.getInt("night_m", 0));
            s.put("digest_count", p.getInt("digest_count", 0));
            return s.toString();
        } catch (Exception e) { return "{}"; } }
    @JavascriptInterface public void openSettings(String which) { if (!trusted()) return;
        Intent i;
        switch (which) {
            case "assistant": i = new Intent(Settings.ACTION_VOICE_INPUT_SETTINGS); break;
            case "listener": i = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS); break;
            case "notifications":
                if (Build.VERSION.SDK_INT >= 33) { activity.runOnUiThread(() -> activity.requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 51)); return; }
                i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx().getPackageName()); break;
            case "alarms": i = Build.VERSION.SDK_INT >= 31 ? new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + ctx().getPackageName())) : null; break;
            default: return;
        }
        if (i == null) return;
        Intent fi = i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        activity.runOnUiThread(() -> { try { activity.startActivity(fi); } catch (Exception e) { activity.startActivity(new Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } }); }
}
