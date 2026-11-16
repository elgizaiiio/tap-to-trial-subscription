package si.ceyo.app.assistant;
import org.junit.Test;
import static org.junit.Assert.*;
public class CeyoRecognizerTest {
    @Test public void assistantMustNotRecognizeItsOwnSpeechRequests() {
        assertFalse(CeyoRecognizer.external("si.ceyo.app.trial", "si.ceyo.app.trial"));
        assertTrue(CeyoRecognizer.external("si.ceyo.app.trial", "com.google.android.googlequicksearchbox"));
    }
}