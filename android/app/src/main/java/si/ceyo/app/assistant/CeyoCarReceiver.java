package si.ceyo.app.assistant;

import android.bluetooth.BluetoothClass;
import android.bluetooth.BluetoothDevice;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.app.NotificationCompat;
import si.ceyo.app.R;

/** Driving mode: when the phone joins a car's Bluetooth, greet the driver and offer hands-free talk. Off until the user enables it. */
public class CeyoCarReceiver extends BroadcastReceiver {
    public static boolean isCar(int deviceClass) {
        return deviceClass == BluetoothClass.Device.AUDIO_VIDEO_CAR_AUDIO || deviceClass == BluetoothClass.Device.AUDIO_VIDEO_HANDSFREE;
    }

    @Override public void onReceive(Context c, Intent in) {
        if (!Routines.prefs(c).getBoolean("car_on", false)) return;
        BluetoothDevice d = in.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
        int cls;
        try { cls = d == null || d.getBluetoothClass() == null ? -1 : d.getBluetoothClass().getDeviceClass(); } catch (SecurityException e) { return; }
        if (!isCar(cls)) return;
        CeyoChannels.ensure(c);
        CeyoSpeech.speak(c, "أهلاً بيك، شغّلت وضع القيادة. رايح فين النهارده؟", "ar");
        CeyoAlarmReceiver.post(c, 501, new NotificationCompat.Builder(c, CeyoChannels.UPDATES).setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Ceyo · وضع القيادة").setContentText("اضغط واتكلم من غير ما تكتب")
            .setContentIntent(CeyoIntents.listen(c, 502)).addAction(0, "اتكلم", CeyoIntents.listen(c, 503)).setAutoCancel(true));
    }
}
