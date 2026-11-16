package si.ceyo.app.assistant;
import android.content.Context;
import android.graphics.*;
import android.view.View;
import si.ceyo.app.R;

/** Transparent overlay: only a restrained coloured stroke at the screen perimeter. */
public final class CeyoEdgeLight extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    public CeyoEdgeLight(Context c) { super(c); setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO); }
    @Override protected void onDraw(Canvas canvas) {
        float d = getResources().getDisplayMetrics().density;
        paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(2 * d);
        paint.setShader(new SweepGradient(getWidth()/2f, getHeight()/2f, new int[]{
            getContext().getColor(R.color.ceyo_edge_cyan), getContext().getColor(R.color.ceyo_edge_pink),
            getContext().getColor(R.color.ceyo_edge_gold), getContext().getColor(R.color.ceyo_edge_green),
            getContext().getColor(R.color.ceyo_edge_cyan)}, null));
        paint.setAlpha(115 + (int)(20 * Math.sin(android.os.SystemClock.uptimeMillis()/1600.0)));
        canvas.drawRoundRect(d, d, getWidth()-d, getHeight()-d, 28*d, 28*d, paint);
        if (isAttachedToWindow() && android.provider.Settings.Global.getFloat(getContext().getContentResolver(), "animator_duration_scale", 1) != 0) postInvalidateDelayed(80);
    }
}