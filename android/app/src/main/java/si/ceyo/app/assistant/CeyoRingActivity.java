package si.ceyo.app.assistant;

import android.app.Activity;
import android.app.NotificationManager;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import si.ceyo.app.R;

/** Full-screen ring over the lock screen: gentle alarm, morning briefing, night reflection or a bot call. */
public class CeyoRingActivity extends Activity {
    private Ringtone tone;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private String kind, id, path;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true); }
        else getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        kind = getIntent().getStringExtra("kind");
        id = String.valueOf(getIntent().getStringExtra("id"));
        path = CeyoIntents.safePath(getIntent().getStringExtra("path"));
        String title = getIntent().getStringExtra("title");
        boolean call = CeyoAlarmReceiver.KIND_CALL.equals(kind);
        boolean morning = CeyoAlarmReceiver.KIND_MORNING.equals(kind);
        boolean night = CeyoAlarmReceiver.KIND_NIGHT.equals(kind);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(Color.BLACK);
        root.setPadding(64, 64, 64, 64);
        ImageView robot = new ImageView(this);
        robot.setImageResource(R.mipmap.ic_launcher_round);
        root.addView(robot, new LinearLayout.LayoutParams(320, 320));
        TextView head = text(call ? (title == null ? "Ceyo" : title) : morning ? "صباح الخير ☀️" : night ? "قبل ما تنام 🌙" : "منبه Ceyo", 30);
        root.addView(head);
        TextView sub = text(call ? "بيتصل بيك…" : morning ? "اضغط عشان أقولك ملخص يومك" : night ? "قولي اللي في بالك وأنا أرتبه لبكرة" : String.valueOf(title), 17);
        sub.setAlpha(0.7f);
        root.addView(sub);
        LinearLayout row = new LinearLayout(this);
        row.setGravity(Gravity.CENTER);
        row.setPadding(0, 96, 0, 0);
        Button no = button(call ? "رفض" : "إيقاف", Color.parseColor("#2A2A2A"));
        Button yes = button(call ? "رد" : morning ? "يلا" : night ? "اتكلم" : "تمام", Color.WHITE);
        yes.setTextColor(Color.BLACK);
        row.addView(no); row.addView(yes);
        root.addView(row);
        setContentView(root);

        no.setOnClickListener(v -> { if (call) MegsyBridge.dispatchCallAction(id, "decline"); finishRing(); });
        yes.setOnClickListener(v -> {
            stopTone();
            if (call) { startActivity(CeyoIntents.openIntent(this, path)); finishRing(); return; }
            if (morning) {
                String now = new SimpleDateFormat("h:mm", new Locale("ar")).format(new Date());
                CeyoSpeech.speak(this, "صباح الخير! الساعة دلوقتي " + now + ". هجهزلك ملخص يومك حالاً.", "ar");
                startActivity(CeyoIntents.openIntent(this, "/?ceyoSend=1&ceyoPrompt=" + Uri.encode("صباح الخير، اديني ملخص يومي: الجو، مواعيدي ومهامي النهارده، وأهم الأخبار في مجالي.")));
            } else if (night) {
                startActivity(new android.content.Intent(this, CeyoAssistantActivity.class).putExtra("prompt_prefix", "رتّب الأفكار دي كمهام لبكرة: "));
            }
            finishRing();
        });
        Uri uri = RingtoneManager.getDefaultUri(call ? RingtoneManager.TYPE_RINGTONE : RingtoneManager.TYPE_ALARM);
        if (!night) { tone = RingtoneManager.getRingtone(this, uri); if (tone != null) { if (Build.VERSION.SDK_INT >= 28) tone.setLooping(true); tone.play(); } }
        handler.postDelayed(() -> { if (call) MegsyBridge.dispatchCallAction(id, "missed"); finishRing(); }, call ? 45000 : 120000);
    }

    private TextView text(String s, int sp) {
        TextView t = new TextView(this); t.setText(s); t.setTextColor(Color.WHITE); t.setTextSize(sp); t.setGravity(Gravity.CENTER); t.setPadding(0, 24, 0, 0); return t;
    }
    private Button button(String s, int bg) {
        Button btn = new Button(this); btn.setText(s); btn.setTextColor(Color.WHITE); btn.setTextSize(18); btn.setAllCaps(false);
        GradientDrawable d = new GradientDrawable(); d.setColor(bg); d.setCornerRadius(120); btn.setBackground(d);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, 170, 1f); lp.setMargins(24, 0, 24, 0); btn.setLayoutParams(lp); return btn;
    }
    private void stopTone() { if (tone != null && tone.isPlaying()) tone.stop(); }
    private void finishRing() {
        stopTone(); handler.removeCallbacksAndMessages(null);
        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.cancel(("call" + id).hashCode()); nm.cancel(id.hashCode()); nm.cancel(("routine" + kind).hashCode());
        finish();
    }
    @Override protected void onDestroy() { stopTone(); handler.removeCallbacksAndMessages(null); super.onDestroy(); }
}
