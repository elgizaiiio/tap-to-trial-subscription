package si.ceyo.app.assistant;

import android.app.Service;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.speech.*;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import java.util.ArrayList;
import si.ceyo.app.R;

/** Top "dynamic island" assistant: a small non-focusable overlay, so the user keeps using the phone while Ceyo listens. */
public class CeyoIslandService extends Service {
    private WindowManager wm; private LinearLayout pill; private TextView label; private CeyoRobot.Animated orb;
    private SpeechRecognizer recognizer; private final Handler handler = new Handler(Looper.getMainLooper());
    private int retries, micWaits; private boolean done; private String prefix = "";

    public static boolean canShow(Context c) { return Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(c); }
    /** Returns false when the overlay permission is missing so the caller can fall back to the full-screen assistant. */
    public static boolean show(Context c, String prefix) {
        if (!canShow(c)) return false;
        Intent i = new Intent(c, CeyoIslandService.class); if (prefix != null) i.putExtra("prompt_prefix", prefix);
        try { if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i); return true; } catch (Exception e) { return false; }
    }
    private int dp(int n) { return Math.round(n * getResources().getDisplayMetrics().density); }

    @Override public int onStartCommand(Intent in, int flags, int id) {
        String p = in == null ? null : in.getStringExtra("prompt_prefix"); if (p != null && p.length() < 200) prefix = p;
        CeyoChannels.ensure(this);
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CeyoChannels.LIVE).setSmallIcon(R.drawable.ceyo_notification_icon)
            .setLargeIcon(CeyoRobot.bitmap(this, "talking", 128)).setContentTitle(CeyoRobot.name(this)).setContentText("بسمعك…").setOngoing(true).setPriority(NotificationCompat.PRIORITY_LOW);
        try { ServiceCompat.startForeground(this, 910, b.build(), Build.VERSION.SDK_INT >= 30 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE : 0); } catch (Exception ignored) { }
        CeyoWakeService.stop(this);
        if (pill == null) attach(); else { retries = 0; listen(); }
        return START_NOT_STICKY;
    }

    private void attach() {
        wm = getSystemService(WindowManager.class);
        pill = new LinearLayout(this); pill.setOrientation(LinearLayout.HORIZONTAL); pill.setGravity(Gravity.CENTER_VERTICAL);
        pill.setPadding(dp(6), dp(6), dp(16), dp(6));
        GradientDrawable bg = new GradientDrawable(); bg.setColor(getColor(R.color.ceyo_island_surface)); bg.setCornerRadius(dp(26)); pill.setBackground(bg);
        orb = new CeyoRobot.Animated(this); pill.addView(orb, new LinearLayout.LayoutParams(dp(40), dp(40)));
        label = new TextView(this); label.setTextColor(getColor(R.color.ceyo_sheet_text)); label.setTextSize(14); label.setMaxLines(2);
        label.setMaxWidth(dp(230)); LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2); lp.setMarginStart(dp(10)); pill.addView(label, lp);
        pill.setOnClickListener(v -> { retries = 0; listen(); });
        pill.setOnLongClickListener(v -> { finishIsland(); return true; });
        WindowManager.LayoutParams w = new WindowManager.LayoutParams(-2, -2,
            Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN, PixelFormat.TRANSLUCENT);
        w.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL; w.y = dp(8);
        try { wm.addView(pill, w); } catch (Exception e) { fallback(); return; }
        status("بجهز الميكروفون…", "thinking");
        handler.postDelayed(this::listen, 300);
    }
    private void status(String text, String state) { if (label != null) label.setText(text); if (orb != null) { orb.state(state); orb.setContentDescription(CeyoRobot.name(this) + ": " + text); } }
    private void cue(int tone) { try { ToneGenerator t = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 60); t.startTone(tone, 120); handler.postDelayed(t::release, 300); } catch (Exception ignored) { }
        Vibrator v = getSystemService(Vibrator.class); if (v != null && Build.VERSION.SDK_INT >= 26) try { v.vibrate(VibrationEffect.createOneShot(25, 120)); } catch (Exception ignored) { } }

    private void listen() {
        if (done) return;
        // The wake engine marks the microphone while it owns it; wait briefly, then try anyway instead of blaming another app.
        if (CeyoWakeService.micBusy(this) && micWaits++ < 15) { status("بجهز الميكروفون…", "thinking"); handler.postDelayed(this::listen, 100); return; }
        micWaits = 0; destroyRecognizer();
        ComponentName svc = CeyoRecognizer.find(this);
        if (svc == null) { fail("مفيش خدمة تعرف على الكلام — ثبّت تطبيق Google"); return; }
        try {
            recognizer = SpeechRecognizer.createSpeechRecognizer(this, svc);
            recognizer.setRecognitionListener(new RecognitionListener() {
                public void onReadyForSpeech(Bundle p) { status("بسمعك… اتكلم", "talking"); cue(ToneGenerator.TONE_PROP_BEEP); }
                public void onBeginningOfSpeech() { retries = 0; }
                public void onRmsChanged(float v) { float s = 1f + Math.max(0, Math.min(v, 10)) / 60f; orb.setScaleX(s); orb.setScaleY(s); }
                public void onBufferReceived(byte[] b) {}
                public void onEndOfSpeech() { status("بفكر…", "thinking"); }
                public void onError(int e) {
                    long delay = CeyoListeningPolicy.retryDelay(e, retries);
                    if (e != SpeechRecognizer.ERROR_NO_MATCH && e != SpeechRecognizer.ERROR_SPEECH_TIMEOUT) retries++;
                    if (delay >= 0) { status(CeyoListeningPolicy.describe(e) + " — بحاول تاني", "talking"); handler.postDelayed(CeyoIslandService.this::listen, delay); }
                    else fail(CeyoListeningPolicy.describe(e) + " (" + e + ")");
                }
                public void onResults(Bundle r) { ArrayList<String> w = r.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (w != null && !w.isEmpty() && !w.get(0).trim().isEmpty()) send(w.get(0)); else handler.postDelayed(CeyoIslandService.this::listen, 400); }
                public void onPartialResults(Bundle r) { ArrayList<String> w = r.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION); if (w != null && !w.isEmpty() && !w.get(0).isEmpty()) status(w.get(0), "talking"); }
                public void onEvent(int t, Bundle p) {}
            });
            recognizer.startListening(new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ar-EG").putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName())
                .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true));
        } catch (Exception e) { fail("خدمة الصوت مش متاحة: " + e.getClass().getSimpleName()); }
    }
    private void fail(String text) { status(text, "idle"); cue(ToneGenerator.TONE_PROP_NACK); handler.postDelayed(this::finishIsland, 6000); }
    private void send(String words) {
        done = true; destroyRecognizer(); cue(ToneGenerator.TONE_PROP_ACK); status("بفكر في: " + words, "thinking");
        String text = (prefix + words).trim(); String path = CeyoRobot.path(this);
        path += (path.contains("?") ? "&" : "?") + "ceyoVoice=1&ceyoSend=1&ceyoPrompt=" + Uri.encode(text);
        try { startActivity(CeyoIntents.openIntent(this, path).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) { }
        handler.postDelayed(this::finishIsland, 2500);
    }
    private void fallback() { try { startActivity(new Intent(this, CeyoAssistantActivity.class).putExtra("no_island", true).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) { } finishIsland(); }
    private void destroyRecognizer() { if (recognizer != null) { try { recognizer.cancel(); recognizer.destroy(); } catch (Exception ignored) { } recognizer = null; } }
    private void finishIsland() { done = true; handler.removeCallbacksAndMessages(null); destroyRecognizer();
        if (pill != null && wm != null) try { wm.removeView(pill); } catch (Exception ignored) { } pill = null;
        CeyoWakeService.start(this); stopSelf(); }
    @Override public void onDestroy() { if (!done) finishIsland(); super.onDestroy(); }
    @Override public IBinder onBind(Intent i) { return null; }
}
