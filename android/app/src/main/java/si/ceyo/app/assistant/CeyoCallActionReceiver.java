package si.ceyo.app.assistant;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class CeyoCallActionReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent in) {
        if ("si.ceyo.app.LIKE".equals(in.getAction())) { c.getSystemService(NotificationManager.class).cancel(in.getIntExtra("nid", 0)); return; }
        String id = String.valueOf(in.getStringExtra("id"));
        c.getSystemService(NotificationManager.class).cancel(("call" + id).hashCode());
        MegsyBridge.dispatchCallAction(id, "decline");
    }
}
