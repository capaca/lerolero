package io.github.capaca.lerolero;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // plugins do próprio app registram antes de a ponte subir
        registerPlugin(AvisosPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
