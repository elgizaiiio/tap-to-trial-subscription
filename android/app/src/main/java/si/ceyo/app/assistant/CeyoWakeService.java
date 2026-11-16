package si.ceyo.app.assistant;

import android.Manifest;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.IBinder;
import android.os.VibrationEffect;
import android.os.Vibrator;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import com.k2fsa.sherpa.onnx.FeatureConfig;
import com.k2fsa.sherpa.onnx.KeywordSpotter;
import com.k2fsa.sherpa.onnx.KeywordSpotterConfig;
import com.k2fsa.sherpa.onnx.OnlineModelConfig;
import com.k2fsa.sherpa.onnx.OnlineStream;
import com.k2fsa.sherpa.onnx.OnlineTransducerModelConfig;
import si.ceyo.app.R;

/** "Hey Ceyo / يا سيو": listens on the phone only, nothing is recorded or uploaded while waiting.
 *  Turned on by the user; shows a permanent notification as Android requires; pauses while Ceyo listens. */
public class CeyoWakeService extends Service {
    private volatile boolean running;
    private Thread loop;
    private volatile AudioRecord recorder;
    private static final String[] ASSETS = {"encoder.onnx", "decoder.onnx", "joiner.onnx", "tokens.txt", "keywords.txt"};

    public static String health(Context c) {
        java.io.File guard = new java.io.File(c.getFilesDir(), "wake_init");
        try {
            String status = new String(java.nio.file.Files.readAllBytes(new java.io.File(c.getFilesDir(), "wake_status").toPath()), java.nio.charset.StandardCharsets.UTF_8);
            if (guard.exists() && System.currentTimeMillis() - guard.lastModified() > 30000 && !"listening".equals(status)) return "failed";
            return status;
        } catch (Exception e) { return "off"; }
    }
    private void health(String value) {
        try { java.nio.file.Files.write(new java.io.File(getFilesDir(), "wake_status").toPath(), value.getBytes(java.nio.charset.StandardCharsets.UTF_8)); } catch (Exception ignored) {}
    }

    public static boolean enabled(Context c) { return Routines.prefs(c).getBoolean("wake_on", false); }

    /** Must be called while the app is on screen (Android blocks starting the microphone from the background). */
    public static void start(Context c) {
        java.io.File guard = new java.io.File(c.getFilesDir(), "wake_init");
        // A marker is an in-flight or crashed JNI start. Never retry it automatically.
        // Only an explicit user toggle clears it; after 30 seconds status reports the failure.
        if (guard.exists()) return;
        if ("failed".equals(health(c))) return;
        if (!enabled(c) || c.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return;
        // SharedPreferences is not coherent across :wake and the main process.
        Intent i = new Intent(c, CeyoWakeService.class).putExtra("enabled", true);
        try { if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i); } catch (Exception ignored) { }
    }
    public static void stop(Context c) { c.stopService(new Intent(c, CeyoWakeService.class)); }

    @Override public int onStartCommand(Intent in, int flags, int id) {
        if (running) return START_NOT_STICKY;
        if (in == null || !in.getBooleanExtra("enabled", false)) { stopSelf(); return START_NOT_STICKY; }
        health("starting");
        CeyoChannels.ensure(this);
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CeyoChannels.LIVE).setSmallIcon(R.drawable.ceyo_notification_icon)
            .setLargeIcon(CeyoRobot.bitmap(this, "idle", 128))
            .setContentTitle(CeyoRobot.name(this) + " مستنيك").setContentText("قول \"يا سيو\" أو \"Hey Ceyo\"").setOngoing(true)
            .setContentIntent(CeyoIntents.listen(this, 901)).setPriority(NotificationCompat.PRIORITY_MIN);
        try { ServiceCompat.startForeground(this, 900, b.build(), Build.VERSION.SDK_INT >= 30 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE : 0); }
        catch (Exception e) { health("failed"); stopSelf(); return START_NOT_STICKY; }
        if (!running && (Build.VERSION.SDK_INT < 23 || checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED)) { running = true; loop = new Thread(this::listen, "ceyo-wake"); loop.start(); }
        return START_NOT_STICKY;
    }

    private void listen() {
        KeywordSpotter kws = null; OnlineStream stream = null; AudioRecord rec = null;
        try {
            // Reject missing/truncated assets before entering JNI, which can abort the process.
            for (String name : ASSETS) {
                try (java.io.InputStream asset = getAssets().open("ceyo-voice/kws/" + name)) {
                    if (asset.available() < (name.endsWith("onnx") ? 10000 : 10)) throw new IllegalStateException("Missing voice asset");
                }
            }
            String tokens, keywords;
            try (java.io.InputStream a = getAssets().open("ceyo-voice/kws/tokens.txt"); java.io.InputStream b = getAssets().open("ceyo-voice/kws/keywords.txt")) {
                tokens = readText(a);
                keywords = readText(b);
            }
            if (!CeyoKeywords.valid(tokens, keywords)) throw new IllegalStateException("Keyword vocabulary mismatch");
            OnlineTransducerModelConfig t = new OnlineTransducerModelConfig();
            t.setEncoder("ceyo-voice/kws/encoder.onnx"); t.setDecoder("ceyo-voice/kws/decoder.onnx"); t.setJoiner("ceyo-voice/kws/joiner.onnx");
            OnlineModelConfig m = new OnlineModelConfig();
            m.setTransducer(t); m.setTokens("ceyo-voice/kws/tokens.txt"); m.setNumThreads(1); m.setModelType("zipformer2"); m.setProvider("cpu");
            KeywordSpotterConfig cfg = new KeywordSpotterConfig();
            FeatureConfig f = new FeatureConfig(); f.setSampleRate(16000); f.setFeatureDim(80);
            cfg.setFeatConfig(f); cfg.setModelConfig(m); cfg.setKeywordsFile("ceyo-voice/kws/keywords.txt");
            cfg.setKeywordsThreshold(0.12f); cfg.setKeywordsScore(2.0f);
            java.io.File guard = new java.io.File(getFilesDir(), "wake_init");
            try { guard.createNewFile(); } catch (Exception ignored) { }
            kws = new KeywordSpotter(getAssets(), cfg);
            stream = kws.createStream("");
            // Keep the marker for the entire native lifetime, not just initialization.
            int size = Math.max(AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT), 3200);
            rec = new AudioRecord(MediaRecorder.AudioSource.MIC, 16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, size * 2);
            recorder = rec;
            if (rec.getState() != AudioRecord.STATE_INITIALIZED) throw new IllegalStateException("Microphone unavailable");
            rec.startRecording();
            health("listening");
            short[] buf = new short[1600];
            float[] samples = new float[1600];
            while (running) {
                int n = rec.read(buf, 0, buf.length);
                if (n < 0) throw new IllegalStateException("Microphone read failed");
                if (n == 0) continue;
                for (int i = 0; i < n; i++) samples[i] = buf[i] / 32768f;
                stream.acceptWaveform(n == samples.length ? samples : java.util.Arrays.copyOf(samples, n), 16000);
                while (kws.isReady(stream)) kws.decode(stream);
                String hit = kws.getResult(stream).getKeyword();
                if (hit != null && !hit.isEmpty()) {
                    rec.stop(); rec.release(); rec = null; recorder = null;
                    woke(); break;
                }
            }
        } catch (Throwable error) {
            if (running) health("failed");
            android.util.Log.e("CeyoWake", "Wake engine unavailable: " + error.getClass().getSimpleName());
        } finally {
            if (rec != null) try { rec.stop(); rec.release(); } catch (Exception ignored) { }
            if (stream != null) try { stream.release(); } catch (Throwable ignored) { }
            if (kws != null) try { kws.release(); } catch (Throwable ignored) { }
            recorder = null; running = false;
            new java.io.File(getFilesDir(), "wake_init").delete();
            stopSelf();
        }
    }

    private void woke() {
        Vibrator v = getSystemService(Vibrator.class);
        if (v != null && Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(60, VibrationEffect.DEFAULT_AMPLITUDE));
        health("detected");
        // The notification remains a reliable fallback when Android blocks background activity launches.
        CeyoAlarmReceiver.post(this, 902, new NotificationCompat.Builder(this, CeyoChannels.UPDATES)
            .setSmallIcon(R.drawable.ceyo_notification_icon).setContentTitle(CeyoRobot.name(this)).setContentText("أنا معاك — اتكلم")
            .setLargeIcon(CeyoRobot.bitmap(this, "talking", 128)).setContentIntent(CeyoIntents.listen(this, 902)).setAutoCancel(true));
        try { CeyoIntents.listen(this, 902).send(); } catch (Exception ignored) { }
        stopSelf();
    }
    private static String readText(java.io.InputStream in) throws java.io.IOException {
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream(); byte[] bytes = new byte[4096]; int n;
        while ((n = in.read(bytes)) != -1) out.write(bytes, 0, n);
        return out.toString("UTF-8");
    }

    @Override public void onDestroy() { running = false; if ("listening".equals(health(this))) health("off"); AudioRecord r = recorder; if (r != null) try { r.stop(); } catch (Exception ignored) {} super.onDestroy(); }
    @Override public IBinder onBind(Intent i) { return null; }
}
