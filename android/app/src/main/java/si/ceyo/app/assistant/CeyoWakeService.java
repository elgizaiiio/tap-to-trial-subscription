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

    public static boolean enabled(Context c) { return Routines.prefs(c).getBoolean("wake_on", false); }

    /** Must be called while the app is on screen (Android blocks starting the microphone from the background). */
    public static void start(Context c) {
        java.io.File guard = new java.io.File(c.getFilesDir(), "wake_init");
        if (guard.exists()) { // previous start crashed inside the voice engine: switch the feature off instead of crashing again
            guard.delete(); Routines.prefs(c).edit().putBoolean("wake_on", false).apply(); return;
        }
        if (!enabled(c) || c.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return;
        Intent i = new Intent(c, CeyoWakeService.class);
        try { if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i); } catch (Exception ignored) { }
    }
    public static void stop(Context c) { c.stopService(new Intent(c, CeyoWakeService.class)); }

    @Override public int onStartCommand(Intent in, int flags, int id) {
        CeyoChannels.ensure(this);
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CeyoChannels.LIVE).setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Ceyo مستنيك").setContentText("قول \"يا سيو\" أو \"Hey Ceyo\"").setOngoing(true)
            .setContentIntent(CeyoIntents.listen(this, 901)).setPriority(NotificationCompat.PRIORITY_MIN);
        try { ServiceCompat.startForeground(this, 900, b.build(), Build.VERSION.SDK_INT >= 30 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE : 0); }
        catch (Exception e) { stopSelf(); return START_NOT_STICKY; }
        if (!running && (Build.VERSION.SDK_INT < 23 || checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED)) { running = true; loop = new Thread(this::listen, "ceyo-wake"); loop.start(); }
        return START_NOT_STICKY;
    }

    private void listen() {
        KeywordSpotter kws = null; OnlineStream stream = null; AudioRecord rec = null;
        try {
            OnlineTransducerModelConfig t = new OnlineTransducerModelConfig();
            t.setEncoder("ceyo-voice/kws/encoder.onnx"); t.setDecoder("ceyo-voice/kws/decoder.onnx"); t.setJoiner("ceyo-voice/kws/joiner.onnx");
            OnlineModelConfig m = new OnlineModelConfig();
            m.setTransducer(t); m.setTokens("ceyo-voice/kws/tokens.txt"); m.setNumThreads(1); m.setModelType("zipformer2");
            KeywordSpotterConfig cfg = new KeywordSpotterConfig();
            FeatureConfig f = new FeatureConfig(); f.setSampleRate(16000); f.setFeatureDim(80);
            cfg.setFeatConfig(f); cfg.setModelConfig(m); cfg.setKeywordsFile("ceyo-voice/kws/keywords.txt");
            cfg.setKeywordsThreshold(0.2f); cfg.setKeywordsScore(1.5f);
            java.io.File guard = new java.io.File(getFilesDir(), "wake_init");
            try { guard.createNewFile(); } catch (Exception ignored) { }
            kws = new KeywordSpotter(getAssets(), cfg);
            stream = kws.createStream("");
            guard.delete();
            int size = Math.max(AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT), 3200);
            rec = new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, 16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, size * 2);
            if (rec.getState() != AudioRecord.STATE_INITIALIZED) return;
            rec.startRecording();
            short[] buf = new short[1600];
            float[] samples = new float[1600];
            while (running) {
                int n = rec.read(buf, 0, buf.length);
                if (n <= 0) continue;
                for (int i = 0; i < n; i++) samples[i] = buf[i] / 32768f;
                stream.acceptWaveform(n == samples.length ? samples : java.util.Arrays.copyOf(samples, n), 16000);
                while (kws.isReady(stream)) kws.decode(stream);
                String hit = kws.getResult(stream).getKeyword();
                if (hit != null && !hit.isEmpty()) { kws.reset(stream); woke(); break; }
            }
        } catch (Throwable ignored) {
        } finally {
            if (rec != null) try { rec.stop(); rec.release(); } catch (Exception ignored) { }
            if (stream != null) try { stream.release(); } catch (Throwable ignored) { }
            if (kws != null) try { kws.release(); } catch (Throwable ignored) { }
            running = false;
        }
    }

    private void woke() {
        Vibrator v = getSystemService(Vibrator.class);
        if (v != null && Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(60, VibrationEffect.DEFAULT_AMPLITUDE));
        try { CeyoIntents.listen(this, 902).send(); } catch (Exception ignored) { }
        stopSelf();
    }

    @Override public void onDestroy() { running = false; super.onDestroy(); }
    @Override public IBinder onBind(Intent i) { return null; }
}
