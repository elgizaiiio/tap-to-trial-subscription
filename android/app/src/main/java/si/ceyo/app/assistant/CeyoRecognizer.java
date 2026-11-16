package si.ceyo.app.assistant;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.speech.RecognitionService;
import java.util.List;

/** Never choose our assistant's declaration as the phone recognizer: it is not an ASR engine. */
public final class CeyoRecognizer {
    public static boolean external(String ownPackage, String servicePackage) { return !ownPackage.equals(servicePackage); }
    public static ComponentName find(Context c) {
        List<ResolveInfo> services = c.getPackageManager().queryIntentServices(new Intent(RecognitionService.SERVICE_INTERFACE), 0);
        ComponentName fallback = null;
        for (ResolveInfo r : services) {
            if (r.serviceInfo == null || !external(c.getPackageName(), r.serviceInfo.packageName) || !r.serviceInfo.enabled || !r.serviceInfo.exported) continue;
            ComponentName service = new ComponentName(r.serviceInfo.packageName, r.serviceInfo.name);
            if (r.serviceInfo.packageName.contains("google")) return service;
            if (fallback == null) fallback = service;
        }
        return fallback;
    }
}