package com.tallywall.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own plugin (not from npm) has to be registered by hand,
        // before the bridge starts.
        registerPlugin(TallyWidgetBridge.class);
        super.onCreate(savedInstanceState);
    }
}
