package si.ceyo.app.assistant;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import si.ceyo.app.MainActivity;

public final class CeyoIntents {
    public static final String EXTRA_PATH = "ceyo_path";
    private CeyoIntents() {}

    /** Only same-app relative paths are allowed, so a notification can never open another site. */
    public static String safePath(String path) {
        if (path == null || !path.startsWith("/") || path.startsWith("//") || path.contains("\\")) return "/";
        return path.length() > 1500 ? "/" : path;
    }

    public static Intent openIntent(Context c, String path) {
        return new Intent(c, MainActivity.class).putExtra(EXTRA_PATH, safePath(path))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    }

    public static PendingIntent open(Context c, String path, int code) {
        return PendingIntent.getActivity(c, code, openIntent(c, path), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    public static PendingIntent listen(Context c, int code) {
        Intent i = new Intent(c, CeyoAssistantActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(c, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
