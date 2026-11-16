package si.ceyo.app;

import com.android.billingclient.api.*;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.List;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "CeyoPlayBilling")
public class CeyoPlayBillingPlugin extends Plugin implements PurchasesUpdatedListener {
    private BillingClient client;
    private PluginCall pending;
    private String expectedProduct;

    @Override public void load() {
        client = BillingClient.newBuilder(getContext()).setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection().build();
    }

    @PluginMethod public synchronized void purchase(PluginCall call) {
        if (pending != null) { call.reject("A purchase is already open"); return; }
        String product = call.getString("productId");
        String account = call.getString("accountId");
        if (product == null || !List.of("ceyo_plus_monthly", "ceyo_plus_yearly", "ceyo_pro_monthly", "ceyo_ultra_monthly").contains(product)
            || account == null || account.isBlank()) { call.reject("Invalid subscription request"); return; }
        pending = call;
        expectedProduct = product;
        if (client.isReady()) { query(product, account); return; }
        client.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult result) {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) { fail("Google Play is unavailable"); return; }
                query(product, account);
            }
            @Override public void onBillingServiceDisconnected() { fail("Google Play disconnected; retry"); }
        });
    }

    private void query(String product, String account) {
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder().setProductList(List.of(
            QueryProductDetailsParams.Product.newBuilder().setProductId(product).setProductType(BillingClient.ProductType.SUBS).build())).build();
        client.queryProductDetailsAsync(params, (result, response) -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || response.getProductDetailsList().isEmpty()) {
                fail("This subscription is not available in Google Play"); return;
            }
            ProductDetails details = response.getProductDetailsList().get(0);
            String base = product.endsWith("yearly") ? "yearly" : "monthly";
            ProductDetails.SubscriptionOfferDetails selected = null;
            List<ProductDetails.SubscriptionOfferDetails> offers = details.getSubscriptionOfferDetails();
            if (offers == null) { fail("No eligible subscription plan"); return; }
            for (ProductDetails.SubscriptionOfferDetails offer : offers) {
                if (!base.equals(offer.getBasePlanId())) continue;
                if (offer.getOfferId() == null) selected = offer;
            }
            for (ProductDetails.SubscriptionOfferDetails offer : offers) {
                if (base.equals(offer.getBasePlanId()) && "free-trial-3d".equals(offer.getOfferId()) && validTrial(offer, base)) {
                    selected = offer; break;
                }
            }
            if (selected == null) { fail("No eligible subscription plan"); return; }
            BillingFlowParams flow = BillingFlowParams.newBuilder().setObfuscatedAccountId(accountHash(account))
                .setProductDetailsParamsList(List.of(BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(details).setOfferToken(selected.getOfferToken()).build())).build();
            getActivity().runOnUiThread(() -> {
                if (pending == null) return;
                BillingResult launch = client.launchBillingFlow(getActivity(), flow);
                if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) fail("Could not open Google Play checkout");
            });
        });
    }

    static boolean validTrial(ProductDetails.SubscriptionOfferDetails offer, String base) {
        List<ProductDetails.PricingPhase> phases = offer.getPricingPhases().getPricingPhaseList();
        if (phases.size() != 2) return false;
        ProductDetails.PricingPhase free = phases.get(0), renewal = phases.get(1);
        return "P3D".equals(free.getBillingPeriod()) && free.getPriceAmountMicros() == 0 && free.getBillingCycleCount() == 1
            && free.getRecurrenceMode() == ProductDetails.RecurrenceMode.FINITE_RECURRING
            && renewal.getPriceAmountMicros() > 0
            && renewal.getRecurrenceMode() == ProductDetails.RecurrenceMode.INFINITE_RECURRING
            && ("yearly".equals(base) ? "P1Y" : "P1M").equals(renewal.getBillingPeriod());
    }

    private String accountHash(String account) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(account.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder();
            for (byte b : digest) result.append(String.format("%02x", b));
            return result.toString();
        } catch (Exception e) { throw new IllegalStateException("Account binding unavailable"); }
    }

    @Override public synchronized void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        if (pending == null) return;
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || purchases == null) {
            fail(result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED ? "Purchase cancelled" : "Purchase unavailable; retry"); return;
        }
        for (Purchase purchase : purchases) {
            if (!purchase.getProducts().contains(expectedProduct)) continue;
            if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) { fail("Payment pending in Google Play"); return; }
            JSObject data = new JSObject();
            data.put("purchaseToken", purchase.getPurchaseToken());
            pending.resolve(data); pending = null; expectedProduct = null; return;
        }
        fail("No matching purchase returned");
    }

    private synchronized void fail(String message) {
        if (pending != null) pending.reject(message);
        pending = null; expectedProduct = null;
    }
    @Override protected void handleOnDestroy() {
        fail("Checkout closed");
        if (client != null) client.endConnection();
    }
}