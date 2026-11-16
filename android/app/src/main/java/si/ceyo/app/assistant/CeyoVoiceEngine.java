package si.ceyo.app.assistant;

import android.content.Context;
import android.content.res.AssetManager;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import com.k2fsa.sherpa.onnx.GeneratedAudio;
import com.k2fsa.sherpa.onnx.OfflineTts;
import com.k2fsa.sherpa.onnx.OfflineTtsConfig;
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig;
import com.k2fsa.sherpa.onnx.OfflineTtsVitsModelConfig;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Ceyo's own Arabic neural voice, bundled in the app (Piper VITS via sherpa-onnx). Runs fully offline. */
public final class CeyoVoiceEngine {
    private static OfflineTts tts;
    private static AudioTrack track;
    private static final ExecutorService worker = Executors.newSingleThreadExecutor();
    private static volatile int generation;
    private CeyoVoiceEngine() {}

    public static boolean available(Context c) {
        if (new File(c.getFilesDir(), "tts_broken").exists()) return false;
        File g = new File(c.getFilesDir(), "tts_init");
        if (g.exists()) { g.delete(); try { new File(c.getFilesDir(), "tts_broken").createNewFile(); } catch (Exception ignored) { } return false; }
        try { c.getAssets().open("ceyo-voice/tts/model.onnx").close(); return true; } catch (Exception e) { return false; }
    }

    private static synchronized OfflineTts engine(Context c) throws Exception {
        if (tts != null) return tts;
        File data = new File(c.getFilesDir(), "espeak-ng-data");
        if (!new File(data, ".ok").exists()) { copyDir(c.getAssets(), "ceyo-voice/tts/espeak-ng-data", data); new File(data, ".ok").createNewFile(); }
        OfflineTtsVitsModelConfig vits = new OfflineTtsVitsModelConfig();
        vits.setModel("ceyo-voice/tts/model.onnx");
        vits.setTokens("ceyo-voice/tts/tokens.txt");
        vits.setDataDir(data.getAbsolutePath());
        vits.setLengthScale(1.0f);
        OfflineTtsModelConfig model = new OfflineTtsModelConfig();
        model.setVits(vits);
        model.setNumThreads(2);
        OfflineTtsConfig cfg = new OfflineTtsConfig();
        cfg.setModel(model);
        File g = new File(c.getFilesDir(), "tts_init"); g.createNewFile();
        tts = new OfflineTts(c.getAssets(), cfg);
        g.delete();
        return tts;
    }

    private static void copyDir(AssetManager am, String from, File to) throws Exception {
        String[] list = am.list(from);
        if (list == null || list.length == 0) {
            to.getParentFile().mkdirs();
            try (InputStream in = am.open(from); OutputStream out = new FileOutputStream(to)) {
                byte[] buf = new byte[16384]; int n; while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            }
            return;
        }
        to.mkdirs();
        for (String name : list) copyDir(am, from + "/" + name, new File(to, name));
    }

    /** Speaks in the bundled voice; returns false so the caller can fall back to the phone's voice. */
    public static boolean speak(Context c, String text) {
        if (text == null || text.trim().isEmpty() || !available(c)) return false;
        final Context app = c.getApplicationContext();
        final int mine = ++generation;
        final String say = text.length() > 1200 ? text.substring(0, 1200) : text;
        worker.execute(() -> {
            try {
                OfflineTts e = engine(app);
                for (String part : say.split("(?<=[.!؟?،\\n])")) {
                    if (mine != generation) return;
                    if (part.trim().isEmpty()) continue;
                    GeneratedAudio a = e.generate(part.trim(), 0, 1.0f);
                    play(a.getSamples(), a.getSampleRate(), mine);
                }
            } catch (Throwable t) { CeyoSpeech.speakSystem(app, say, "ar"); }
        });
        return true;
    }

    private static void play(float[] samples, int rate, int mine) {
        if (samples == null || samples.length == 0 || mine != generation) return;
        AudioTrack t = new AudioTrack.Builder()
            .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANT).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
            .setAudioFormat(new AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_FLOAT).setSampleRate(rate).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
            .setTransferMode(AudioTrack.MODE_STATIC).setBufferSizeInBytes(samples.length * 4).build();
        synchronized (CeyoVoiceEngine.class) { track = t; }
        t.write(samples, 0, samples.length, AudioTrack.WRITE_BLOCKING);
        t.play();
        long ms = samples.length * 1000L / rate;
        try { Thread.sleep(ms + 60); } catch (InterruptedException ignored) { }
        t.release();
    }

    public static void stop() {
        generation++;
        synchronized (CeyoVoiceEngine.class) { if (track != null) try { track.stop(); } catch (Exception ignored) { } }
    }
}
