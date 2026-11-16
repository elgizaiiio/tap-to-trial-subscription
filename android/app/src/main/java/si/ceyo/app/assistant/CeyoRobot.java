package si.ceyo.app.assistant;

import android.content.Context;
import android.graphics.*;
import android.view.View;
import org.json.JSONObject;
import si.ceyo.app.R;

/** Native counterpart of the primary AgentOrb: no launcher/ghost icon or remote image. */
public final class CeyoRobot {
    public static String name(Context c) { return Routines.prefs(c).getString("bot_name", "Ceyo"); }
    public static String path(Context c) { return CeyoIntents.safePath(Routines.prefs(c).getString("bot_path", "/")); }
    public static void sync(Context c, JSONObject o) {
        Routines.prefs(c).edit().putString("bot_name", o.optString("name", "Ceyo").substring(0, Math.min(60, o.optString("name", "Ceyo").length())))
            .putString("bot_path", CeyoIntents.safePath(o.optString("path", "/")))
            .putString("bot_state", "idle").apply();
        CeyoWidget.refresh(c);
    }
    public static Bitmap bitmap(Context c, String state, int size) {
        Bitmap b = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        draw(c, new Canvas(b), state, size, 0);
        return b;
    }
    private static void draw(Context c, Canvas canvas, String state, int size, float phase) {
        float s = size, cx = s / 2, cy = s / 2;
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setShader(new RadialGradient(s * .35f, s * .28f, s * .7f,
            new int[]{c.getColor(R.color.ceyo_robot_light), c.getColor(R.color.ceyo_robot_shade)}, null, Shader.TileMode.CLAMP));
        float pulse = state.equals("idle") ? 0 : (float)Math.sin(phase) * s * .015f;
        canvas.drawCircle(cx, cy, s * .39f + pulse, p);
        p.setShader(null); p.setColor(c.getColor(R.color.ceyo_robot_eyes));
        if (state.equals("talking")) {
            for (int i = 0; i < 5; i++) {
                float h = s * (.08f + .09f * (float)Math.abs(Math.sin(phase + i * .8)));
                float x = s * (.32f + .075f * i);
                canvas.drawRoundRect(x, cy - h / 2, x + s * .034f, cy + h / 2, s * .02f, s * .02f, p);
            }
        } else {
            float h = state.equals("done") ? s * .075f : state.equals("thinking") ? s * .12f : s * .18f;
            for (float x : new float[]{s * .37f, s * .56f}) canvas.drawRoundRect(x, cy - h / 2, x + s * .07f, cy + h / 2, s * .04f, s * .04f, p);
            if (state.equals("thinking") || state.equals("tool")) {
                p.setStyle(Paint.Style.STROKE); p.setStrokeWidth(s * .018f);
                canvas.drawArc(s * .06f, s * .06f, s * .94f, s * .94f, phase * 45, state.equals("tool") ? 140 : 65, false, p);
            }
        }
    }
    public static class Animated extends View {
        private String state = "idle";
        public Animated(Context c) { super(c); setContentDescription(name(c)); }
        public void state(String value) { state = value; invalidate(); }
        @Override protected void onDraw(Canvas canvas) {
            int size = Math.min(getWidth(), getHeight());
            CeyoRobot.draw(getContext(), canvas, state, size, android.os.SystemClock.uptimeMillis() / 220f);
            if (isAttachedToWindow() && !state.equals("idle")) postInvalidateDelayed(50);
        }
    }
}