package si.ceyo.app.assistant;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.Build;
import android.speech.RecognitionService;
import android.speech.SpeechRecognizer;
import java.util.ArrayList;
import java.util.List;

/** Picks a working speech engine: an external service (Google first), else the phone's on-device engine, else the system default. */
public final class CeyoRecognizer {
    public static boolean external(String ownPackage, String servicePackage) { return !ownPackage.equals(servicePackage); }
    private static List<ResolveInfo> services(Context c) {
        List<ResolveInfo> out = new ArrayList<>();
        for (ResolveInfo r : c.getPackageManager().queryIntentServices(new Intent(RecognitionService.SERVICE_INTERFACE), 0)) {
            if (r.serviceInfo == null || !external(c.getPackageName(), r.serviceInfo.packageName) || !r.serviceInfo.enabled || !r.serviceInfo.exported || r.serviceInfo.name.endsWith("CeyoRecognitionService")) continue;
            out.add(r);
        }
        return out;
    }
    public static ComponentName find(Context c) {
        ComponentName fallback = null;
        for (ResolveInfo r : services(c)) {
            ComponentName service = new ComponentName(r.serviceInfo.packageName, r.serviceInfo.name);
            if (r.serviceInfo.packageName.contains("google")) return service;
            if (fallback == null) fallback = service;
        }
        return fallback;
    }
    public static boolean onDevice(Context c) { return Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(c); }
    public static boolean any(Context c) { return find(c) != null || onDevice(c) || SpeechRecognizer.isRecognitionAvailable(c); }
    /** Creates the first engine that exists, so phones without Google still listen. */
    public static SpeechRecognizer create(Context c) {
        ComponentName s = find(c);
        if (s != null) return SpeechRecognizer.createSpeechRecognizer(c, s);
        if (onDevice(c)) return SpeechRecognizer.createOnDeviceSpeechRecognizer(c);
        if (SpeechRecognizer.isRecognitionAvailable(c)) return SpeechRecognizer.createSpeechRecognizer(c);
        return null;
    }
    private static String label(Context c, String pkg) {
        try { PackageManager pm = c.getPackageManager(); return pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)) + " (" + pkg + ")"; } catch (Exception e) { return pkg; }
    }
    /** Human-readable name of the engine in use, shown in Phone settings so the user can report it. */
    public static String name(Context c) {
        ComponentName s = find(c);
        if (s != null) return label(c, s.getPackageName());
        if (onDevice(c)) return "On-device engine (Android)";
        if (SpeechRecognizer.isRecognitionAvailable(c)) return "System default";
        return "";
    }
    public static String all(Context c) {
        StringBuilder b = new StringBuilder();
        for (ResolveInfo r : services(c)) { if (b.length() > 0) b.append(", "); b.append(label(c, r.serviceInfo.packageName)); }
        if (onDevice(c)) b.append(b.length() > 0 ? ", " : "").append("On-device");
        return b.toString();
    }
}
