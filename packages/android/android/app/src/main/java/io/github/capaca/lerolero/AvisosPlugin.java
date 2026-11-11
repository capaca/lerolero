package io.github.capaca.lerolero;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.Tasks;
import com.google.firebase.messaging.FirebaseMessaging;
import java.util.concurrent.Executors;

/**
 * As notificações do app nativo para a interface (ADR-0011, packages/app/src/lib/push-native.ts): ativar devolve o
 * token do FCM e a chave pública de cifra, que vão no cartão de perfil como mais um aparelho de aviso.
 */
@CapacitorPlugin(name = "Avisos", permissions = { @Permission(alias = "notificacoes", strings = { Manifest.permission.POST_NOTIFICATIONS }) })
public class AvisosPlugin extends Plugin {
    @Override
    public void load() {
        abrirPeloAviso(getActivity().getIntent(), false);
    }

    /** `renovar`: token e chaves novos (ao bloquear alguém). `textos`: os da notificação, já traduzidos. */
    @PluginMethod
    public void ativar(PluginCall call) {
        Avisos.guardarTextos(getContext(), call.getObject("textos"));
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notificacoes") != PermissionState.GRANTED) {
            requestPermissionForAlias("notificacoes", call, "depoisDaPermissao");
            return;
        }
        continuar(call);
    }

    @PermissionCallback
    private void depoisDaPermissao(PluginCall call) {
        if (getPermissionState("notificacoes") == PermissionState.GRANTED) continuar(call);
        else call.reject("notificações recusadas", "negada");
    }

    private void continuar(PluginCall call) {
        if (!NotificationManagerCompat.from(getContext()).areNotificationsEnabled()) {
            call.reject("notificações bloqueadas", "bloqueada");
            return;
        }
        boolean renovar = Boolean.TRUE.equals(call.getBoolean("renovar", false));
        Executors.newSingleThreadExecutor().execute(() -> {
            try {
                FirebaseMessaging fcm = FirebaseMessaging.getInstance();
                if (renovar) Tasks.await(fcm.deleteToken());
                Avisos.Chaves chaves = renovar ? null : Avisos.chaves(getContext());
                if (chaves == null) chaves = Avisos.novasChaves(getContext());
                String token = Tasks.await(fcm.getToken());
                MensagensService.criarCanal(getContext());
                JSObject r = new JSObject();
                r.put("fcm", token);
                r.put("p256dh", chaves.publicaB64());
                r.put("auth", chaves.authB64());
                call.resolve(r);
            } catch (IllegalStateException e) {
                // APK montado sem o google-services.json
                call.reject("sem Firebase neste APK", "sem-suporte");
            } catch (Exception e) {
                call.reject("o FCM não respondeu", "erro", e);
            }
        });
    }

    /** Desativa: o token deixa de valer (o FCM responde 404 a quem ainda mandar) e as chaves somem. */
    @PluginMethod
    public void desativar(PluginCall call) {
        Avisos.apagarChaves(getContext());
        Executors.newSingleThreadExecutor().execute(() -> {
            try {
                Tasks.await(FirebaseMessaging.getInstance().deleteToken());
            } catch (Exception e) {
                // sem rede: as chaves já sumiram, e o aviso que chegar não abre
            }
            call.resolve();
        });
    }

    /** A permissão e o token de agora: mudam sem o app saber (configurações do Android, token renovado pelo FCM). */
    @PluginMethod
    public void estado(PluginCall call) {
        JSObject r = new JSObject();
        boolean permitido = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        PermissionState estado = Build.VERSION.SDK_INT >= 33 ? getPermissionState("notificacoes") : PermissionState.GRANTED;
        r.put("permissao", permitido ? "granted" : estado == PermissionState.PROMPT || estado == PermissionState.PROMPT_WITH_RATIONALE ? "prompt" : "denied");
        if (!permitido || Avisos.chaves(getContext()) == null) {
            call.resolve(r);
            return;
        }
        Executors.newSingleThreadExecutor().execute(() -> {
            try {
                Task<String> token = FirebaseMessaging.getInstance().getToken();
                r.put("fcm", Tasks.await(token));
            } catch (Exception e) {
                // sem rede ou sem Firebase: sem token, o app não mexe em nada
            }
            call.resolve(r);
        });
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        abrirPeloAviso(intent, true);
    }

    @Override
    protected void handleOnResume() {
        Avisos.visivel = true;
    }

    @Override
    protected void handleOnPause() {
        Avisos.visivel = false;
    }

    private String pendente;

    /** O caminho da conversa do aviso tocado com o app fechado: a interface pede ao terminar de abrir. */
    @PluginMethod
    public void caminhoPendente(PluginCall call) {
        JSObject r = new JSObject();
        if (pendente != null) r.put("caminho", pendente);
        pendente = null;
        call.resolve(r);
    }

    private void abrirPeloAviso(Intent intent, boolean aberto) {
        String caminho = intent == null ? null : intent.getStringExtra(MensagensService.CAMINHO);
        if (caminho == null) return;
        intent.removeExtra(MensagensService.CAMINHO);
        if (!aberto) {
            pendente = caminho;
            return;
        }
        JSObject r = new JSObject();
        r.put("caminho", caminho);
        notifyListeners("abrir", r, true);
    }
}
