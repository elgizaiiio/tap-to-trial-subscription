package si.ceyo.app.assistant;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import java.util.Calendar;
import si.ceyo.app.R;

/** Home-screen / lock-screen robot widget. Mood follows the time of day; the app can push the latest bot update. */
public class CeyoWidget extends AppWidgetProvider {
    public static String mood(int hour) {
        if (hour >= 5 && hour < 11) return "☕ صباح الخير — جاهز ليومك؟";
        if (hour >= 11 && hour < 18) return "🎯 وضع التركيز — اسألني أي حاجة";
        if (hour >= 18 && hour < 23) return "🌆 مساء الخير — نراجع يومك؟";
        return "🌙 وقت الراحة — فضّي أفكارك";
    }

    public static void setStatus(Context c, String title, String text) {
        SharedPreferences p = Routines.prefs(c);
        p.edit().putString("w_title", title == null ? "" : title.substring(0, Math.min(title.length(), 60)))
            .putString("w_text", text == null ? "" : text.substring(0, Math.min(text.length(), 160)))
            .putLong("w_at", System.currentTimeMillis()).apply();
        refresh(c);
    }

    public static void refresh(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, CeyoWidget.class));
        if (ids.length > 0) new CeyoWidget().onUpdate(c, m, ids);
    }

    @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        SharedPreferences p = Routines.prefs(c);
        boolean fresh = System.currentTimeMillis() - p.getLong("w_at", 0) < 6 * 3600_000L;
        String title = fresh ? p.getString("w_title", "") : "";
        String text = fresh ? p.getString("w_text", "") : "";
        for (int id : ids) {
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.ceyo_widget);
            v.setImageViewBitmap(R.id.w_robot, CeyoRobot.bitmap(c, p.getString("bot_state", "idle"), 128));
            v.setTextViewText(R.id.w_mood, title.isEmpty() ? mood(Calendar.getInstance().get(Calendar.HOUR_OF_DAY)) : title);
            v.setTextViewText(R.id.w_text, text.isEmpty() ? "اضغط على الروبوت واتكلم" : text);
            v.setOnClickPendingIntent(R.id.w_robot, CeyoIntents.listen(c, 301));
            v.setOnClickPendingIntent(R.id.w_talk, CeyoIntents.listen(c, 302));
            v.setOnClickPendingIntent(R.id.w_memo, CeyoIntents.open(c, "/?ceyoSend=0&ceyoPrompt=" + android.net.Uri.encode("فكرة سريعة: "), 303));
            v.setOnClickPendingIntent(R.id.w_text, CeyoIntents.open(c, "/", 304));
            m.updateAppWidget(id, v);
        }
    }
}
