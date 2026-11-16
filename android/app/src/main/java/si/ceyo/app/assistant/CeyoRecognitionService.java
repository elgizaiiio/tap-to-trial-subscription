package si.ceyo.app.assistant;

import android.content.Intent;
import android.speech.RecognitionService;
import android.speech.SpeechRecognizer;

/** Required by Android for assistant apps; Ceyo uses the phone's own recogniser, so direct requests are declined. */
public class CeyoRecognitionService extends RecognitionService {
    @Override protected void onStartListening(Intent i, Callback cb) { try { cb.error(SpeechRecognizer.ERROR_RECOGNIZER_BUSY); } catch (Exception ignored) { } }
    @Override protected void onCancel(Callback cb) { }
    @Override protected void onStopListening(Callback cb) { }
}
