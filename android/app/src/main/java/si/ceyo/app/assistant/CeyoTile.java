package si.ceyo.app.assistant;

import android.content.Intent;
import android.os.Build;
import android.service.quicksettings.TileService;

/** Quick Settings tile: one tap from the notification shade opens the listening sheet. */
public class CeyoTile extends TileService {
    @Override public void onClick() {
        Intent i = new Intent(this, CeyoAssistantActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (Build.VERSION.SDK_INT >= 34) startActivityAndCollapse(CeyoIntents.listen(this, 401));
        else startActivityAndCollapse(i);
    }
}
