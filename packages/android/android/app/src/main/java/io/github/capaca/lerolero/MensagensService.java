package io.github.capaca.lerolero;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.util.Base64;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;
import org.json.JSONObject;

/**
 * Aviso de mensagem nova pelo FCM (RF-82, ADR-0011): chega com prioridade alta e acorda o celular parado. Vem cifrado
 * pelo remetente para a chave deste app (Cifra); dentro, só quem mandou e, em grupo, qual. Nunca o conteúdo (T6).
 */
public class MensagensService extends FirebaseMessagingService {
    static final String CANAL = "mensagens";
    static final String CAMINHO = "caminho";
    private static final int NOME_MAX = 60;
    private static final Pattern CHAVE = Pattern.compile("^[0-9a-f]{64}$");
    private static final Pattern GRUPO = Pattern.compile("^[\\w-]{1,128}$");

    @Override
    public void onMessageReceived(RemoteMessage mensagem) {
        String cifrado = mensagem.getData().get("c");
        Avisos.Chaves chaves = Avisos.chaves(this);
        // sem chaves, a pessoa desativou: um aviso atrasado não aparece
        if (cifrado == null || chaves == null || Avisos.visivel) return;
        String de, nome, grupo;
        try {
            byte[] corpo = Base64.decode(cifrado, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
            JSONObject aviso = new JSONObject(new String(Cifra.decifrar(corpo, chaves.privada, chaves.publica, chaves.auth), StandardCharsets.UTF_8));
            de = aviso.optString("de", "");
            if (aviso.optInt("v") != 1 || !CHAVE.matcher(de).matches()) return;
            nome = aviso.optString("nome", "").trim();
            if (nome.length() > NOME_MAX) nome = nome.substring(0, NOME_MAX);
            grupo = aviso.optString("grupo", "");
            if (!GRUPO.matcher(grupo).matches()) grupo = "";
        } catch (Exception e) {
            // aviso de outra chave (de antes de bloquear alguém) ou estragado: nada a mostrar
            return;
        }
        mostrar(de, nome.isEmpty() ? Avisos.texto(this, "anonimo", "Lero-lero") : nome, grupo);
    }

    private void mostrar(String de, String nome, String grupo) {
        NotificationManagerCompat avisos = NotificationManagerCompat.from(this);
        if (!avisos.areNotificationsEnabled()) return;
        criarCanal(this);
        String caminho = grupo.isEmpty() ? "conversa/" + de : "grupo/" + Uri.encode(grupo);
        Intent abrir = new Intent(this, MainActivity.class).putExtra(CAMINHO, caminho).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent toque = PendingIntent.getActivity(this, caminho.hashCode(), abrir, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder n = new NotificationCompat.Builder(this, CANAL)
            .setSmallIcon(R.drawable.ic_aviso)
            .setContentTitle(Avisos.texto(this, "titulo", "{nome}").replace("{nome}", nome))
            .setContentText(Avisos.texto(this, "toque", ""))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setContentIntent(toque);
        try {
            // uma por conversa: a mais nova substitui a anterior e toca de novo
            avisos.notify(caminho, 1, n.build());
        } catch (SecurityException e) {
            // a permissão foi tirada nas configurações: o app desativa na próxima abertura
        }
    }

    static void criarCanal(android.content.Context c) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel canal = new NotificationChannel(CANAL, Avisos.texto(c, "canal", "Mensagens"), NotificationManager.IMPORTANCE_HIGH);
        c.getSystemService(NotificationManager.class).createNotificationChannel(canal);
    }

    @Override
    public void onNewToken(String token) {
        // o app confere o token ao abrir (AvisosPlugin.estado) e manda o cartão novo aos contatos
    }
}
