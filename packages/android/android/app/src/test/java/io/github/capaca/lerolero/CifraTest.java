package io.github.capaca.lerolero;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.Base64;
import org.junit.Test;

/** A cifra do aviso no app nativo (ADR-0011), conferida com o exemplo do apêndice A do RFC 8291. */
public class CifraTest {
    private static byte[] b64(String s) {
        return Base64.getUrlDecoder().decode(s);
    }

    private static final byte[] PUBLICA = b64("BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4");
    private static final byte[] PRIVADA = b64("q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94");
    private static final byte[] AUTH = b64("BTBZMqHH6r4Tts7J_aSIgg");
    private static final byte[] CORPO = b64(
            "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN");

    @Test
    public void decifraOExemploDoRfc() throws Exception {
        byte[] texto = Cifra.decifrar(CORPO, PRIVADA, PUBLICA, AUTH);
        assertEquals("When I grow up, I want to be a watermelon", new String(texto, StandardCharsets.UTF_8));
    }

    @Test
    public void outraChaveOuAvisoAdulteradoNaoAbre() throws Exception {
        Cifra.Par outro = Cifra.novoPar();
        assertThrows(GeneralSecurityException.class, () -> Cifra.decifrar(CORPO, outro.privada, outro.publica, AUTH));
        byte[] adulterado = CORPO.clone();
        adulterado[adulterado.length - 1] ^= 1;
        assertThrows(GeneralSecurityException.class, () -> Cifra.decifrar(adulterado, PRIVADA, PUBLICA, AUTH));
        assertThrows(GeneralSecurityException.class, () -> Cifra.decifrar(new byte[10], PRIVADA, PUBLICA, AUTH));
    }

    @Test
    public void parNovoTemOFormatoDoCartao() throws Exception {
        Cifra.Par par = Cifra.novoPar();
        assertEquals(65, par.publica.length);
        assertEquals(4, par.publica[0]);
        assertEquals(32, par.privada.length);
    }
}
