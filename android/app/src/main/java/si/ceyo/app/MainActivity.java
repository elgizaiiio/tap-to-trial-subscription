package si.ceyo.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import si.ceyo.app.assistant.CeyoChannels;
import si.ceyo.app.assistant.CeyoIntents;
import si.ceyo.app.assistant.MegsyBridge;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CeyoPlayBillingPlugin.class);
        super.onCreate(savedInstanceState);
        CeyoChannels.ensure(this);
        WebView web = getBridge().getWebView();
        web.addJavascriptInterface(new MegsyBridge(this, web), "MegsyAndroid");
        web.getSettings().setMediaPlaybackRequiresUserGesture(false);
        handleLaunch(getIntent());
    }

    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); handleLaunch(intent); }

    /** Opens a notification/widget/assistant path, or a shared text/link from another app, inside the trusted origin only. */
    private void handleLaunch(Intent in) {
        if (in == null) return;
        String path = null;
        if (in.hasExtra(CeyoIntents.EXTRA_PATH)) path = CeyoIntents.safePath(in.getStringExtra(CeyoIntents.EXTRA_PATH));
        else if (Intent.ACTION_SEND.equals(in.getAction())) {
            CharSequence shared = in.getCharSequenceExtra(Intent.EXTRA_TEXT);
            String subject = in.getStringExtra(Intent.EXTRA_SUBJECT);
            if (shared != null && shared.length() > 0) {
                String t = shared.toString(); if (t.length() > 1200) t = t.substring(0, 1200);
                path = "/?ceyoSend=0&ceyoPrompt=" + Uri.encode((subject != null ? subject + "\n" : "") + t + "\n\nلخّصلي ده أو قولي رأيك:");
            } else path = "/?ceyoSend=0&ceyoPrompt=" + Uri.encode("بعتلك صورة/ملف من تطبيق تاني، ارفعه هنا من زر +");
        }
        in.removeExtra(CeyoIntents.EXTRA_PATH);
        if (path == null || "/".equals(path) && getBridge().getWebView().getUrl() != null) return;
        final String target = "https://" + MegsyBridge.TRUSTED_HOST + path;
        getBridge().getWebView().post(() -> getBridge().getWebView().loadUrl(target));
    }
}
