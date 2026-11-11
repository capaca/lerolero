package io.github.capaca.lerolero;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPrivateKeySpec;
import java.security.spec.ECPublicKeySpec;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * O lado de quem recebe o aviso (RFC 8291 com aes128gcm, RFC 8188), o mesmo que o navegador faz no Web Push: o
 * remetente cifra para a chave pública deste app (packages/core/src/push/webpush.ts) e só este aparelho abre
 * (ADR-0011). Java puro, sem nada do Android, para o teste rodar na JVM.
 */
final class Cifra {
    private Cifra() {}

    /** Par ECDH P-256: a pública em 65 bytes (0x04 || x || y) e a privada como o escalar de 32 bytes. */
    static final class Par {
        final byte[] publica;
        final byte[] privada;

        Par(byte[] publica, byte[] privada) {
            this.publica = publica;
            this.privada = privada;
        }
    }

    private static ECParameterSpec curva;

    private static synchronized ECParameterSpec curva() throws GeneralSecurityException {
        if (curva == null) curva = ((ECPublicKey) gerar().getPublic()).getParams();
        return curva;
    }

    private static KeyPair gerar() throws GeneralSecurityException {
        KeyPairGenerator kpg = KeyPairGenerator.getInstance("EC");
        kpg.initialize(new ECGenParameterSpec("secp256r1"));
        return kpg.generateKeyPair();
    }

    static Par novoPar() throws GeneralSecurityException {
        KeyPair par = gerar();
        ECPoint w = ((ECPublicKey) par.getPublic()).getW();
        return new Par(ponto(w), fixo(((ECPrivateKey) par.getPrivate()).getS(), 32));
    }

    /** Decifra o corpo de um registro só; erro se não for para esta chave ou se veio adulterado. */
    static byte[] decifrar(byte[] corpo, byte[] privada, byte[] publica, byte[] auth) throws GeneralSecurityException {
        if (corpo.length < 21) throw new GeneralSecurityException("aviso curto demais");
        byte[] sal = Arrays.copyOfRange(corpo, 0, 16);
        int tamanhoChave = corpo[20] & 0xff;
        if (tamanhoChave != 65 || corpo.length < 21 + 65 + 17) throw new GeneralSecurityException("aviso fora do formato");
        byte[] remetente = Arrays.copyOfRange(corpo, 21, 21 + 65);
        byte[] cifrado = Arrays.copyOfRange(corpo, 21 + 65, corpo.length);

        KeyAgreement ecdh = KeyAgreement.getInstance("ECDH");
        ecdh.init(chavePrivada(privada));
        ecdh.doPhase(chavePublica(remetente), true);
        byte[] segredo = ecdh.generateSecret();

        byte[] ikm = hkdf(auth, segredo, juntar(ascii("WebPush: info\0"), publica, remetente), 32);
        byte[] cek = hkdf(sal, ikm, ascii("Content-Encoding: aes128gcm\0"), 16);
        byte[] nonce = hkdf(sal, ikm, ascii("Content-Encoding: nonce\0"), 12);

        Cipher aes = Cipher.getInstance("AES/GCM/NoPadding");
        aes.init(Cipher.DECRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
        byte[] comPreenchimento = aes.doFinal(cifrado);
        // o preenchimento é a marca 0x02 (último registro) seguida de zeros
        int fim = comPreenchimento.length - 1;
        while (fim >= 0 && comPreenchimento[fim] == 0) fim--;
        if (fim < 0 || comPreenchimento[fim] != 2) throw new GeneralSecurityException("falta a marca de último registro");
        return Arrays.copyOf(comPreenchimento, fim);
    }

    private static PrivateKey chavePrivada(byte[] escalar) throws GeneralSecurityException {
        return KeyFactory.getInstance("EC").generatePrivate(new ECPrivateKeySpec(new BigInteger(1, escalar), curva()));
    }

    private static PublicKey chavePublica(byte[] ponto) throws GeneralSecurityException {
        if (ponto.length != 65 || ponto[0] != 4) throw new GeneralSecurityException("chave do remetente fora do formato");
        ECPoint w = new ECPoint(new BigInteger(1, Arrays.copyOfRange(ponto, 1, 33)), new BigInteger(1, Arrays.copyOfRange(ponto, 33, 65)));
        return KeyFactory.getInstance("EC").generatePublic(new ECPublicKeySpec(w, curva()));
    }

    /** HKDF-SHA256 (RFC 5869) de um bloco só, que basta até 32 bytes. */
    private static byte[] hkdf(byte[] sal, byte[] ikm, byte[] info, int tamanho) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(sal, "HmacSHA256"));
        byte[] prk = mac.doFinal(ikm);
        mac.init(new SecretKeySpec(prk, "HmacSHA256"));
        mac.update(info);
        mac.update((byte) 1);
        return Arrays.copyOf(mac.doFinal(), tamanho);
    }

    static byte[] ponto(ECPoint w) {
        return juntar(new byte[] {4}, fixo(w.getAffineX(), 32), fixo(w.getAffineY(), 32));
    }

    /** O número em exatamente `tamanho` bytes (o BigInteger às vezes sai com um zero a mais ou bytes a menos). */
    private static byte[] fixo(BigInteger n, int tamanho) {
        byte[] b = n.toByteArray();
        byte[] out = new byte[tamanho];
        int copiar = Math.min(b.length, tamanho);
        System.arraycopy(b, b.length - copiar, out, tamanho - copiar, copiar);
        return out;
    }

    private static byte[] ascii(String s) {
        return s.getBytes(StandardCharsets.US_ASCII);
    }

    private static byte[] juntar(byte[]... partes) {
        int n = 0;
        for (byte[] p : partes) n += p.length;
        byte[] out = new byte[n];
        int i = 0;
        for (byte[] p : partes) {
            System.arraycopy(p, 0, out, i, p.length);
            i += p.length;
        }
        return out;
    }
}
