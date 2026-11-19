package io.github.capaca.lerolero;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.core.content.ContextCompat;
import androidx.credentials.CreateCredentialResponse;
import androidx.credentials.CreatePasswordRequest;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.GetPasswordOption;
import androidx.credentials.PasswordCredential;
import androidx.credentials.exceptions.CreateCredentialCancellationException;
import androidx.credentials.exceptions.CreateCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * O que o WebView do APK não tem e o Chrome tem (ADR-0011, packages/app/src/lib/native.ts): o gerenciador de senhas,
 * pelo Credential Manager do Android (RF-09 b: o código de recuperação guardado e lido na restauração), a impressão
 * do cartão e o aviso curto de "salvo". Visto pelo Pedro no APK da v0.18.1: NotSupportedError ao guardar a senha.
 */
@CapacitorPlugin(name = "Aparelho")
public class AparelhoPlugin extends Plugin {
    /** Guarda o código no Gerenciador de senhas do Google; a pessoa confirma numa folha do sistema. */
    @PluginMethod
    public void guardarSenha(PluginCall call) {
        String conta = call.getString("conta");
        String senha = call.getString("senha");
        if (conta == null || senha == null) {
            call.reject("conta e senha são obrigatórias");
            return;
        }
        CredentialManager.create(getContext()).createCredentialAsync(
            getActivity(),
            new CreatePasswordRequest(conta, senha),
            null,
            ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<CreateCredentialResponse, CreateCredentialException>() {
                @Override
                public void onResult(CreateCredentialResponse resposta) {
                    call.resolve();
                }

                @Override
                public void onError(CreateCredentialException erro) {
                    // o nome do erro vai no código: a interface mostra "AbortError" como cancelado, sem erro
                    if (erro instanceof CreateCredentialCancellationException) call.reject("cancelado", "AbortError");
                    else call.reject(String.valueOf(erro.getMessage()), erro.getType());
                }
            }
        );
    }

    /** O código guardado, para a restauração; sem nada guardado ou cancelado, volta vazio. */
    @PluginMethod
    public void lerSenha(PluginCall call) {
        GetCredentialRequest pedido = new GetCredentialRequest.Builder().addCredentialOption(new GetPasswordOption()).build();
        CredentialManager.create(getContext()).getCredentialAsync(
            getActivity(),
            pedido,
            null,
            ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse resposta) {
                    JSObject ret = new JSObject();
                    Credential credencial = resposta.getCredential();
                    if (credencial instanceof PasswordCredential) ret.put("senha", ((PasswordCredential) credencial).getPassword());
                    call.resolve(ret);
                }

                @Override
                public void onError(GetCredentialException erro) {
                    if (erro instanceof NoCredentialException || erro instanceof GetCredentialCancellationException) call.resolve(new JSObject());
                    else call.reject(String.valueOf(erro.getMessage()), erro.getType());
                }
            }
        );
    }

    /** Imprime a página como ela está, com o CSS de impressão (só o cartão sai no papel). */
    @PluginMethod
    public void imprimir(PluginCall call) {
        String titulo = call.getString("titulo", "Lero-lero");
        getActivity().runOnUiThread(() -> {
            PrintManager impressao = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
            WebView pagina = getBridge().getWebView();
            impressao.print(titulo, pagina.createPrintDocumentAdapter(titulo), new PrintAttributes.Builder().build());
            call.resolve();
        });
    }

    /** Aviso curto do sistema (ex.: onde o arquivo foi salvo), com o texto já traduzido pela interface. */
    @PluginMethod
    public void avisar(PluginCall call) {
        String texto = call.getString("texto", "");
        getActivity().runOnUiThread(() -> {
            Toast.makeText(getContext(), texto, Toast.LENGTH_LONG).show();
            call.resolve();
        });
    }
}
