# ADR-0004: Armazenamento e envio de mídia

- **Status:** aceito
- **Data:** 2026-10-16

## Contexto

Relays Nostr aceitam eventos pequenos (64–128 KB), insuficientes para fotos e áudios. Os requisitos pedem mídia cifrada (RF-42), download sob demanda (RF-71), mídia salva uma única vez (RF-70), expiração (RF-72) e baixo consumo de dados (RNF-22..24, RNF-27).

## Opções consideradas

- **Blossom:** padrão do ecossistema Nostr para guardar arquivos endereçados pelo hash, em servidores HTTP simples. Existem servidores públicos e é fácil de operar.
- **IPFS:** rede P2P de arquivos; pesada para celular e sem garantia de disponibilidade sem "pinning" pago.
- **Mídia dentro dos eventos:** inviável pelo limite de tamanho.

## Decisão

- Mídia é **comprimida e cifrada no aparelho** (AES-GCM com chave aleatória por arquivo) e enviada para **servidores Blossom**.
- A mensagem leva: endereço do arquivo, chave, **hash do original** e uma **prévia leve** (≤ 5 KB).
- **Deduplicação:** o cache local é indexado pelo hash do original. A mesma mídia recebida em várias conversas é baixada e guardada uma vez. Encaminhar reaproveita o arquivo já enviado (sem novo envio).
- **Expiração:** apaga do cache local a mídia com mais de 30 dias (configurável), exceto a marcada como "guardar" ou salva na galeria. A mensagem permanece, com a prévia.
- Enviar para **2 servidores Blossom** diferentes, para redundância.

## Consequências

- Mídia nunca é visível para o operador do Blossom.
- Servidores Blossom públicos têm limites e políticas de retenção próprias: mídia antiga pode sumir do servidor. Aceitável, pois o destinatário baixa em até 7 dias (mesma meta dos relays).
- Mais uma peça para voluntários brasileiros operarem.
- Encaminhar reaproveitando a mesma chave permite que quem conhece o arquivo original saiba que é o mesmo arquivo; aceitável no nível de proteção escolhido ([02](../02-modelo-de-ameacas.md)).
