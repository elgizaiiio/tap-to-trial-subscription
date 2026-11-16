package si.ceyo.app.assistant;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class CeyoBootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent in) { Routines.restoreAll(c); CeyoWidget.refresh(c); }
}
