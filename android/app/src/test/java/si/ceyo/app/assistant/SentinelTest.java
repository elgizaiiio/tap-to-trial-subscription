package si.ceyo.app.assistant;

import static org.junit.Assert.*;
import org.junit.Test;

public class SentinelTest {
    @Test public void flagsBankLookalikeButNotOfficialSite() {
        assertEquals("brand:banquemisr", Sentinel.suspiciousReason("https://banquemisr-login.xyz/verify"));
        assertNull(Sentinel.suspiciousReason("https://www.banquemisr.com/ar"));
    }
    @Test public void flagsPunycodeAndIpLinks() {
        assertEquals("punycode", Sentinel.suspiciousReason("https://xn--pple-43d.com"));
        assertEquals("ip", Sentinel.suspiciousReason("http://192.168.1.5/pay"));
    }
    @Test public void detectsBillWithAmountAndDueDate() {
        Sentinel.Bill b = Sentinel.detectBill("فاتورة الإنترنت بمبلغ 250 جنيه مستحقة 20/11");
        assertNotNull(b);
        assertEquals("250", b.amount);
        assertEquals("20/11", b.due);
    }
    @Test public void ignoresMessagesWithoutBillWords() {
        assertNull(Sentinel.detectBill("تعالى نتغدى ب 250 جنيه"));
    }
    @Test public void carModeOnlyForCarAudio() {
        assertTrue(CeyoCarReceiver.isCar(android.bluetooth.BluetoothClass.Device.AUDIO_VIDEO_CAR_AUDIO));
        assertFalse(CeyoCarReceiver.isCar(android.bluetooth.BluetoothClass.Device.AUDIO_VIDEO_HEADPHONES));
    }
}
