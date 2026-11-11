package io.github.capaca.lerolero;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * O que o app nativo guarda para os avisos (ADR-0011), fora do WebView, porque o serviço do FCM roda com o app
 * fechado: o par de cifra (a privada nunca sai daqui), o segredo `auth` e os textos da notificação, que vêm do app
 * já traduzidos (ADR-0008: nenhum texto fixo aqui). Sem par guardado, as notificações estão desativadas.
 */
final class Avisos {
    private Avisos() {}

    private static final String ARQUIVO = "avisos";
    private static final int B64 = Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING;

    /** O app está na tela: a mensagem já aparece nele, como o service worker faz no PWA. */
    static volatile boolean visivel;

    static final class Chaves {
        final byte[] publica;
        final byte[] privada;
        final byte[] auth;

        Chaves(byte[] publica, byte[] privada, byte[] auth) {
            this.publica = publica;
            this.privada = privada;
            this.auth = auth;
        }

        String publicaB64() {
            return Base64.encodeToString(publica, B64);
        }

        String authB64() {
            return Base64.encodeToString(auth, B64);
        }
    }

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(ARQUIVO, Context.MODE_PRIVATE);
    }

    static Chaves chaves(Context c) {
        SharedPreferences p = prefs(c);
        String pub = p.getString("publica", null), priv = p.getString("privada", null), auth = p.getString("auth", null);
        if (pub == null || priv == null || auth == null) return null;
        try {
            return new Chaves(Base64.decode(pub, B64), Base64.decode(priv, B64), Base64.decode(auth, B64));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** Par e segredo novos (ao ativar e ao bloquear alguém): o que o bloqueado tinha deixa de abrir os avisos. */
    static Chaves novasChaves(Context c) throws GeneralSecurityException {
        Cifra.Par par = Cifra.novoPar();
        byte[] auth = new byte[16];
        new SecureRandom().nextBytes(auth);
        prefs(c)
            .edit()
            .putString("publica", Base64.encodeToString(par.publica, B64))
            .putString("privada", Base64.encodeToString(par.privada, B64))
            .putString("auth", Base64.encodeToString(auth, B64))
            .apply();
        return new Chaves(par.publica, par.privada, auth);
    }

    static void apagarChaves(Context c) {
        prefs(c).edit().remove("publica").remove("privada").remove("auth").apply();
    }

    static void guardarTextos(Context c, JSONObject textos) {
        if (textos != null) prefs(c).edit().putString("textos", textos.toString()).apply();
    }

    /** Um texto da notificação; sem ele (o app ainda não mandou), o reserva. */
    static String texto(Context c, String chave, String reserva) {
        try {
            String t = new JSONObject(prefs(c).getString("textos", "{}")).optString(chave, "");
            return t.isEmpty() ? reserva : t;
        } catch (JSONException e) {
            return reserva;
        }
    }
}
