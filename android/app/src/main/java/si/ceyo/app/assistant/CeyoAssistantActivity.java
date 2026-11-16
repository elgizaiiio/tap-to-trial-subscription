package si.ceyo.app.assistant;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.ComponentName;
import android.content.pm.PackageManager;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.*;
import android.view.Gravity;
import android.view.Window;
import android.widget.*;
import java.util.ArrayList;
import si.ceyo.app.R;

/** Primary robot assistant sheet; external ASR selection avoids recursive recognition on Honor. */
public class CeyoAssistantActivity extends Activity {
    private SpeechRecognizer recognizer;
    private TextView live;
    private CeyoRobot.Animated orb;
    private EditText input;
    private String prefix = "";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private int retries;
    private boolean leaving;
    private int handoverChecks;
    private int dp(int n) { return Math.round(n * getResources().getDisplayMetrics().density); }
    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        String p = getIntent().getStringExtra("prompt_prefix");
        if (p != null && p.length() < 200) prefix = p;
        if (!getIntent().getBooleanExtra("no_island", false) && CeyoIslandService.show(this, prefix)) { finish(); return; }
        getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_DIM_BEHIND);
        getWindow().getDecorView().setSystemUiVisibility(android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE | android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        FrameLayout root = new FrameLayout(this);
        root.addView(new CeyoEdgeLight(this), new FrameLayout.LayoutParams(-1, -1));
        orb = new CeyoRobot.Animated(this);
        FrameLayout.LayoutParams pos = new FrameLayout.LayoutParams(dp(128), dp(128), Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL); pos.bottomMargin = dp(76);
        root.addView(orb, pos);
        live = new TextView(this); // Not rendered: accessibility status is mirrored to the robot.
        live.addTextChangedListener(new android.text.TextWatcher() {
            public void beforeTextChanged(CharSequence s, int st, int count, int after) {}
            public void onTextChanged(CharSequence s, int st, int before, int count) { orb.setContentDescription(CeyoRobot.name(CeyoAssistantActivity.this) + ": " + s); }
            public void afterTextChanged(android.text.Editable e) {}
        });
        root.setOnClickListener(v -> finish());
        orb.setOnClickListener(v -> { retries = 0; start(); });
        setContentView(root);
        CeyoWakeService.stop(this);
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 41);
        else handler.postDelayed(this::start, 700);
    }
    @Override public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        super.onRequestPermissionsResult(code, perms, res);
        if (code == 41 && res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED) handler.postDelayed(this::start, 700);
        else unavailable("اسمح باستخدام الميكروفون من إعدادات الهاتف");
    }
    private void destroyRecognizer() { if (recognizer != null) { try { recognizer.cancel(); recognizer.destroy(); } catch (Exception ignored) {} recognizer = null; } }
    private ImageButton icon(int resource, String label) {
        ImageButton b = new ImageButton(this); b.setImageResource(resource); b.setContentDescription(label);
        b.setImageTintList(android.content.res.ColorStateList.valueOf(getColor(R.color.ceyo_sheet_text)));
        android.util.TypedValue value = new android.util.TypedValue(); getTheme().resolveAttribute(android.R.attr.selectableItemBackgroundBorderless, value, true);
        b.setBackgroundResource(value.resourceId); b.setPadding(dp(12), dp(12), dp(12), dp(12)); return b;
    }
    private void start() {
        if (leaving || isFinishing()) return;
        // stopService is asynchronous in :wake. Wait until its AudioRecord is released.
        if (CeyoWakeService.micBusy(this) && handoverChecks++ < 15) { live.setText("بجهز الميكروفون…"); handler.postDelayed(this::start, 100); return; }
        handoverChecks = 0;
        destroyRecognizer();
        ComponentName service = CeyoRecognizer.find(this);
        if (service == null) { unavailable("خدمة التعرف على الكلام غير متاحة على الهاتف"); return; }
        try {
            recognizer = SpeechRecognizer.createSpeechRecognizer(this, service);
            live.setText("بسمعك…"); orb.state("talking");
            recognizer.setRecognitionListener(new RecognitionListener() {
                public void onReadyForSpeech(Bundle p) { live.setText("بسمعك…"); }
                public void onBeginningOfSpeech() { retries = 0; }
                public void onRmsChanged(float v) { float scale = 1f + Math.max(0, Math.min(v, 10)) / 100f; orb.setScaleX(scale); orb.setScaleY(scale); }
                public void onBufferReceived(byte[] b) {}
                public void onEndOfSpeech() { live.setText("يفكر…"); orb.state("thinking"); }
                public void onError(int e) {
                    long delay = CeyoListeningPolicy.retryDelay(e, retries);
                    if (e != SpeechRecognizer.ERROR_NO_MATCH && e != SpeechRecognizer.ERROR_SPEECH_TIMEOUT) retries++;
                    if (delay >= 0) { live.setText("بسمعك…"); orb.state("talking"); handler.postDelayed(CeyoAssistantActivity.this::start, delay); }
                    else unavailable(CeyoListeningPolicy.describe(e) + " (" + e + ")");
                }
                public void onResults(Bundle r) { ArrayList<String> w = r.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION); if (w != null && !w.isEmpty() && !w.get(0).trim().isEmpty()) openApp(w.get(0), true); else handler.postDelayed(CeyoAssistantActivity.this::start, 500); }
                public void onPartialResults(Bundle r) { ArrayList<String> w = r.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION); if (w != null && !w.isEmpty()) live.setText(w.get(0)); }
                public void onEvent(int t, Bundle p) {}
            });
            recognizer.startListening(new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ar-EG")
                .putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName())
                .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true));
        } catch (Exception e) { unavailable("خدمة الصوت غير متاحة حاليًا"); }
    }
    private void unavailable(String text) { orb.state("idle"); live.setText(text); Toast.makeText(this, text, Toast.LENGTH_LONG).show(); }
    private void openApp(String words, boolean send) {
        leaving = true; destroyRecognizer();
        String text = (prefix + words).trim(); String path = CeyoRobot.path(this);
        if (!text.isEmpty()) path += (path.contains("?") ? "&" : "?") + "ceyoVoice=1&ceyoSend=" + (send ? "1" : "0") + "&ceyoPrompt=" + Uri.encode(text);
        startActivity(CeyoIntents.openIntent(this, path)); finish();
    }
    @Override protected void onPause() { handler.removeCallbacksAndMessages(null); destroyRecognizer(); super.onPause(); }
    @Override protected void onDestroy() { handler.removeCallbacksAndMessages(null); destroyRecognizer(); super.onDestroy(); }
}
