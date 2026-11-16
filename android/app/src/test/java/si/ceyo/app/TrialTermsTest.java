package si.ceyo.app;

import com.android.billingclient.api.ProductDetails;
import org.junit.Test;
import static org.junit.Assert.*;

public class TrialTermsTest {
    private ProductDetails.SubscriptionOfferDetails offer(String period, int cycles, long renewal) throws Exception {
        String json = "{\"productId\":\"ceyo_plus_monthly\",\"type\":\"subs\",\"title\":\"Ceyo\",\"name\":\"Ceyo\","
            + "\"subscriptionOfferDetails\":[{\"basePlanId\":\"monthly\",\"offerId\":\"free-trial-3d\",\"offerIdToken\":\"test\","
            + "\"pricingPhases\":[{\"billingPeriod\":\"" + period + "\",\"priceAmountMicros\":0,\"billingCycleCount\":" + cycles
            + ",\"recurrenceMode\":2},{\"billingPeriod\":\"P1M\",\"priceAmountMicros\":" + renewal
            + ",\"billingCycleCount\":0,\"recurrenceMode\":1}]}]}";
        java.lang.reflect.Constructor<ProductDetails> ctor = ProductDetails.class.getDeclaredConstructor(String.class);
        ctor.setAccessible(true);
        return ctor.newInstance(json).getSubscriptionOfferDetails().get(0);
    }
    @Test public void acceptsExactlyThreeFreeDaysBeforePaidRenewal() throws Exception {
        assertTrue(CeyoPlayBillingPlugin.validTrial(offer("P3D", 1, 20000000), "monthly"));
        assertFalse(CeyoPlayBillingPlugin.validTrial(offer("P7D", 1, 20000000), "monthly"));
        assertFalse(CeyoPlayBillingPlugin.validTrial(offer("P3D", 2, 20000000), "monthly"));
        assertFalse(CeyoPlayBillingPlugin.validTrial(offer("P3D", 1, 0), "monthly"));
    }
}