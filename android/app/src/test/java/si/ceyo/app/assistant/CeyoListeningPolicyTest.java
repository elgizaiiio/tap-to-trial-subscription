package si.ceyo.app.assistant;
import org.junit.Test;
import static org.junit.Assert.*;
public class CeyoListeningPolicyTest {
    @Test public void silenceAlwaysListensAgainWithoutTap() {
        assertEquals(500, CeyoListeningPolicy.retryDelay(6, 30));
        assertEquals(500, CeyoListeningPolicy.retryDelay(7, 30));
    }
    @Test public void deniedMicrophoneNeverRetries() { assertEquals(-1, CeyoListeningPolicy.retryDelay(9, 0)); }
    @Test public void hardFailureRetriesAreBounded() {
        assertEquals(1000, CeyoListeningPolicy.retryDelay(8, 0));
        assertEquals(8000, CeyoListeningPolicy.retryDelay(8, 3));
        assertEquals(-1, CeyoListeningPolicy.retryDelay(8, 4));
    }
}