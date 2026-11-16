package si.ceyo.app.assistant;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.ArrayList;
import si.ceyo.app.R;

/** Siri-style listening sheet: opened from the power-button assistant, widget, quick tile, car mode or night routine.
 *  Speech is recognised by the phone; the final words are sent into the user's Ceyo chat. */
public class CeyoAssistantActivity extends Activity {
    private SpeechRecognizer recognizer;
    private TextView live;
    private ImageView orb;
    private String prefix = "";

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        String p = getIntent().getStringExtra("prompt_prefix");
        if (p != null && p.length() < 200) prefix = p;
        LinearLayout sheet = new LinearLayout(this);
        sheet.setOrientation(LinearLayout.VERTICAL);
        sheet.setGravity(Gravity.CENTER_HORIZONTAL);
        sheet.setPadding(48, 48, 48, 64);
        GradientDrawable bg = new GradientDrawable(); bg.setColor(Color.parseColor("#F0101010")); bg.setCornerRadii(new float[]{64,64,64,64,0,0,0,0});
        sheet.setBackground(bg);
        orb = new ImageView(this); orb.setImageResource(R.mipmap.ic_launcher_round);
        sheet.addView(orb, new LinearLayout.LayoutParams(220, 220));
        live = new TextView(this); live.setTextColor(Color.WHITE); live.setTextSize(20); live.setGravity(Gravity.CENTER); live.setPadding(0, 32, 0, 0);
        live.setText("بسمعك…");
        sheet.addView(live);
        LinearLayout root = new LinearLayout(this);
        root.setGravity(Gravity.BOTTOM);
        root.setOnClickListener(v -> finish());
        root.addView(sheet, new LinearLayout.LayoutParams(-1, -2));
        sheet.setOnClickListener(v -> { });
        setContentView(root);
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 41);
        else start();
    }

    @Override public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        if (res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED) start(); else { live.setText("محتاج إذن الميكروفون"); }
    }

    private void start() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) { openApp("", false); return; }
        recognizer = SpeechRecognizer.createSpeechRecognizer(this);
        recognizer.setRecognitionListener(new RecognitionListener() {
            public void onReadyForSpeech(Bundle p) { orb.animate().scaleX(1.12f).scaleY(1.12f).setDuration(400).start(); }
            public void onBeginningOfSpeech() { }
            public void onRmsChanged(float v) { float s = 1f + Math.max(0, Math.min(v, 10)) / 40f; orb.setScaleX(s); orb.setScaleY(s); }
            public void onBufferReceived(byte[] buf) { }
            public void onEndOfSpeech() { live.setText("ثانية…"); }
            public void onError(int e) { live.setText("مسمعتكش، اضغط الشاشة وحاول تاني"); live.setOnClickListener(v -> { live.setText("بسمعك…"); recognizer.cancel(); start(); }); }
            public void onResults(Bundle r) { ArrayList<String> w = r.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION); if (w != null && !w.isEmpty()) openApp(w.get(0), true); }
            public void onPartialResults(Bundle r) { ArrayList<String> w = r.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION); if (w != null && !w.isEmpty()) live.setText(w.get(0)); }
            public void onEvent(int t, Bundle p) { }
        });
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        recognizer.startListening(i);
    }

    private void openApp(String words, boolean send) {
        String text = (prefix + words).trim();
        String path = text.isEmpty() ? "/" : "/?ceyoSend=" + (send ? "1" : "0") + "&ceyoPrompt=" + Uri.encode(text);
        startActivity(CeyoIntents.openIntent(this, path));
        finish();
    }

    @Override protected void onDestroy() { if (recognizer != null) recognizer.destroy(); super.onDestroy(); }
}
