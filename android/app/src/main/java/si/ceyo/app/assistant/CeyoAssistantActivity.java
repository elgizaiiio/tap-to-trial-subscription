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
        LinearLayout sheet = new LinearLayout(this);
        sheet.setOrientation(LinearLayout.VERTICAL); sheet.setGravity(Gravity.CENTER_HORIZONTAL);
        sheet.setPadding(dp(24), dp(20), dp(24), dp(28));
        GradientDrawable bg = new GradientDrawable(); bg.setColor(getColor(R.color.ceyo_sheet_surface)); bg.setCornerRadii(new float[]{dp(24),dp(24),dp(24),dp(24),0,0,0,0}); sheet.setBackground(bg);
        orb = new CeyoRobot.Animated(this); sheet.addView(orb, new LinearLayout.LayoutParams(dp(128), dp(128)));
        TextView name = new TextView(this); name.setText(CeyoRobot.name(this)); name.setTextSize(18); name.setTextColor(getColor(R.color.ceyo_sheet_text)); sheet.addView(name);
        live = new TextView(this); live.setTextColor(getColor(R.color.ceyo_sheet_muted)); live.setTextSize(16); live.setGravity(Gravity.CENTER); live.setPadding(0, dp(12), 0, dp(16)); sheet.addView(live);
        LinearLayout controls = new LinearLayout(this); controls.setGravity(Gravity.CENTER);
        ImageButton retry = icon(android.R.drawable.ic_btn_speak_now, "اتكلم"); retry.setOnClickListener(v -> { retries = 0; start(); }); controls.addView(retry, new LinearLayout.LayoutParams(dp(56), dp(56)));
        ImageButton chat = icon(android.R.drawable.ic_menu_view, "افتح المحادثة"); chat.setOnClickListener(v -> openApp("", false)); controls.addView(chat, new LinearLayout.LayoutParams(dp(56), dp(56))); sheet.addView(controls);
        LinearLayout textRow = new LinearLayout(this);
        input = new EditText(this); input.setHint("اكتب رسالتك"); input.setTextColor(getColor(R.color.ceyo_sheet_text)); input.setHintTextColor(getColor(R.color.ceyo_sheet_muted)); input.setMaxLines(3); textRow.addView(input, new LinearLayout.LayoutParams(0, -2, 1));
        ImageButton send = icon(android.R.drawable.ic_menu_send, "إرسال"); send.setOnClickListener(v -> { String words = input.getText().toString().trim(); if (!words.isEmpty()) openApp(words, true); }); textRow.addView(send, new LinearLayout.LayoutParams(dp(48), dp(48))); sheet.addView(textRow);
        LinearLayout root = new LinearLayout(this); root.setGravity(Gravity.BOTTOM); root.setOnClickListener(v -> finish()); root.addView(sheet, new LinearLayout.LayoutParams(-1, -2)); sheet.setOnClickListener(v -> {}); setContentView(root);
        CeyoWakeService.stop(this);
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 41);
        else handler.postDelayed(this::start, 700);
    }
    @Override public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        super.onRequestPermissionsResult(code, perms, res);
        if (code == 41 && res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED) handler.postDelayed(this::start, 700);
        else live.setText("الميكروفون غير متاح — تقدر تكتب");
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
        if (new java.io.File(getFilesDir(), "wake_init").exists()) {
            if (handoverChecks++ < 20) { live.setText("بجهز الميكروفون…"); handler.postDelayed(this::start, 100); return; }
            live.setText("الميكروفون مشغول — تقدر تكتب أو تحاول تاني"); return;
        }
        handoverChecks = 0;
        destroyRecognizer();
        ComponentName service = CeyoRecognizer.find(this);
        if (service == null) { live.setText("التعرف على الكلام غير متاح على الهاتف — تقدر تكتب"); orb.state("idle"); return; }
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
                    orb.state("idle");
                    if ((e == SpeechRecognizer.ERROR_RECOGNIZER_BUSY || e == SpeechRecognizer.ERROR_AUDIO) && retries++ < 1) { handler.postDelayed(CeyoAssistantActivity.this::start, 900); return; }
                    live.setText(e == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS ? "اسمح باستخدام الميكروفون من الإعدادات" : e == SpeechRecognizer.ERROR_NETWORK || e == SpeechRecognizer.ERROR_NETWORK_TIMEOUT ? "اتصال خدمة الصوت غير متاح — تقدر تكتب" : "مسمعتكش — اضغط الميكروفون أو اكتب");
                }
                public void onResults(Bundle r) { ArrayList<String> w = r.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION); if (w != null && !w.isEmpty()) openApp(w.get(0), true); }
                public void onPartialResults(Bundle r) { ArrayList<String> w = r.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION); if (w != null && !w.isEmpty()) live.setText(w.get(0)); }
                public void onEvent(int t, Bundle p) {}
            });
            recognizer.startListening(new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ar-EG")
                .putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName())
                .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true));
        } catch (Exception e) { orb.state("idle"); live.setText("خدمة الصوت غير متاحة — تقدر تكتب"); }
    }
    private void openApp(String words, boolean send) {
        leaving = true; destroyRecognizer();
        String text = (prefix + words).trim(); String path = CeyoRobot.path(this);
        if (!text.isEmpty()) path += (path.contains("?") ? "&" : "?") + "ceyoSend=" + (send ? "1" : "0") + "&ceyoPrompt=" + Uri.encode(text);
        startActivity(CeyoIntents.openIntent(this, path)); finish();
    }
    @Override protected void onPause() { handler.removeCallbacksAndMessages(null); destroyRecognizer(); super.onPause(); }
    @Override protected void onDestroy() { handler.removeCallbacksAndMessages(null); destroyRecognizer(); super.onDestroy(); }
}
