package si.ceyo.app.assistant;

import static org.junit.Assert.assertEquals;
import org.junit.Test;

public class CallScreenerTest {
    @Test public void rejectsSpoofedUnknownCallers() { assertEquals("reject", CeyoCallScreener.decide("notify", true, true)); }
    @Test public void silenceModeSilencesUnknownCallers() { assertEquals("silence", CeyoCallScreener.decide("silence", true, false)); }
    @Test public void notifyModeLetsTheCallRing() { assertEquals("allow", CeyoCallScreener.decide("notify", true, false)); }
    @Test public void offAndOutgoingAreNeverTouched() {
        assertEquals("allow", CeyoCallScreener.decide("off", true, true));
        assertEquals("allow", CeyoCallScreener.decide("silence", false, false));
    }
}
