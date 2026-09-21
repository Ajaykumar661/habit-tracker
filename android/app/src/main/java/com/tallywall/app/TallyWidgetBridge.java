package com.tallywall.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.os.Build;

import com.getcapacitor.JSObject;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The app's half of the widget: src/lib/widget.js calls update() with a
 * fresh snapshot, which is stored for TallyWidget to draw from, and every
 * placed widget is redrawn at once.
 */
@CapacitorPlugin(name = "TallyWidget")
public class TallyWidgetBridge extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        String snapshot = call.getString("snapshot");
        if (snapshot == null) {
            call.reject("no snapshot");
            return;
        }
        Context context = getContext();
        context.getSharedPreferences(TallyWidget.PREFS, Context.MODE_PRIVATE)
            .edit().putString(TallyWidget.KEY_SNAPSHOT, snapshot).apply();
        TallyWidget.refreshAll(context);
        call.resolve();
    }

    /** Can this launcher place the widget for us when asked? */
    @PluginMethod
    public void canPin(PluginCall call) {
        JSObject out = new JSObject();
        out.put("value", pinSupported());
        call.resolve(out);
    }

    /**
     * Ask the launcher to place the widget. The launcher shows its own
     * confirmation; nothing is added without the user saying yes.
     */
    @PluginMethod
    public void pin(PluginCall call) {
        if (!pinSupported()) {
            call.reject("unsupported");
            return;
        }
        AppWidgetManager manager = getContext().getSystemService(AppWidgetManager.class);
        manager.requestPinAppWidget(new ComponentName(getContext(), TallyWidget.class), null, null);
        call.resolve();
    }

    private boolean pinSupported() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false;
        AppWidgetManager manager = getContext().getSystemService(AppWidgetManager.class);
        return manager != null && manager.isRequestPinAppWidgetSupported();
    }
}
