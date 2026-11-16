package si.ceyo.app.assistant;

import android.content.Context;
import android.speech.tts.TextToSpeech;
import java.util.Locale;

/** Phone's own speech engine: works offline with the voices already on the device, no download from Ceyo. */
public final class CeyoSpeech {
    private static TextToSpeech tts;
    private static boolean ready;
    private static String pending, pendingLang;
    private CeyoSpeech() {}

    /** Arabic uses Ceyo's bundled voice; other languages (or a missing model) use the phone's own voices. */
    public static void speak(Context c, String text, String lang) {
        if (text == null || text.isEmpty()) return;
        boolean arabic = lang != null ? lang.startsWith("ar") : text.matches("(?s).*[\\u0600-\\u06FF].*");
        if (arabic && CeyoVoiceEngine.speak(c, text)) return;
        speakSystem(c, text, lang);
    }

    public static synchronized void speakSystem(Context c, String text, String lang) {
        if (text == null || text.isEmpty()) return;
        if (tts == null) {
            pending = text; pendingLang = lang;
            tts = new TextToSpeech(c.getApplicationContext(), status -> {
                synchronized (CeyoSpeech.class) {
                    ready = status == TextToSpeech.SUCCESS;
                    if (ready && pending != null) { say(pending, pendingLang); pending = null; }
                }
            });
            return;
        }
        if (ready) say(text, lang); else { pending = text; pendingLang = lang; }
    }

    private static void say(String text, String lang) {
        boolean arabic = lang != null ? lang.startsWith("ar") : text.matches("(?s).*[\\u0600-\\u06FF].*");
        tts.setLanguage(arabic ? new Locale("ar") : Locale.getDefault());
        tts.setSpeechRate(0.98f);
        tts.speak(text.length() > 3500 ? text.substring(0, 3500) : text, TextToSpeech.QUEUE_FLUSH, null, "ceyo");
    }

    public static synchronized void stop() { CeyoVoiceEngine.stop(); if (tts != null) tts.stop(); }
}
