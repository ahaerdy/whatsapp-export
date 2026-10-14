# whatsapp-export

Exporte a conversa aberta no **WhatsApp Web** para **Markdown** e **HTML**, direto do navegador, com um script de console ou um bookmarklet de um clique.

Tudo roda localmente na sua máquina: nenhum dado é enviado para servidores externos e não há dependências nem instalação de software.

## Para que serve

O WhatsApp oferece a exportação de conversas apenas pelo aplicativo do celular, em texto simples e com limitações. Este projeto permite arquivar, pesquisar ou compartilhar uma conversa em formatos mais convenientes:

- **Markdown (`.md`)**: ótimo para notas, versionamento, buscas e ferramentas como Obsidian ou Notion.
- **HTML (`.html`)**: um único arquivo autocontido, com balões parecidos com os do WhatsApp, fácil de abrir em qualquer navegador ou imprimir como PDF.

## Recursos

- Exporta a conversa **completa**, desde a mensagem mais antiga que o WhatsApp Web consegue carregar até a mais recente.
- Funciona com a conversa em **qualquer posição**: não é preciso rolar manualmente.
- Preserva data, hora, remetente, quebras de linha e emojis.
- Agrupa as mensagens por dia.
- Identifica respostas (mensagens citadas).
- Mídias aparecem como marcadores (`[Áudio]`, `[Vídeo]`, `[Documento]`, `[Imagem/Figurinha]`); legendas são mantidas. Os arquivos de mídia em si **não** são baixados.
- Mostra o progresso em uma faixa no topo da página e permite interromper a qualquer momento.

## Arquivos

| Arquivo | Descrição |
|---|---|
| `whatsapp_export.js` | Script legível e comentado. Cole no console do navegador. |
| `instalar_bookmarklet.html` | Página com o bookmarklet pronto (versão minificada do script) para arrastar para a barra de favoritos. |

## Como usar

### Opção 1: Bookmarklet (recomendado)

1. Abra o `instalar_bookmarklet.html` no navegador.
2. Mostre a barra de favoritos (`Ctrl+Shift+B`) e arraste o botão **Exportar WhatsApp** para ela.
   Se o arrastar não funcionar, crie um favorito manualmente e cole no campo URL o texto da caixa que aparece na página.
3. Acesse [web.whatsapp.com](https://web.whatsapp.com), abra a conversa desejada e clique no favorito.

### Opção 2: Console do navegador

1. Abra [web.whatsapp.com](https://web.whatsapp.com) e entre na conversa desejada.
2. Abra o console (`F12` → aba **Console**).
3. Cole o conteúdo de `whatsapp_export.js` e tecle Enter.
   Se o Chrome bloquear a colagem, digite `allow pasting` e tente de novo.

### Durante a execução

- Deixe a aba **aberta e visível**. Abas em segundo plano têm rolagem e temporizadores reduzidos pelo navegador.
- Em conversas longas, o processo pode levar vários minutos.
- Para parar antes e exportar o que já foi coletado, digite no console:

  ```js
  window.__stopExport = true
  ```

Ao final, dois arquivos são baixados: `<nome do contato>.md` e `<nome do contato>.html`.

## Como funciona

O WhatsApp Web só desenha na página as mensagens próximas da área visível. Por isso o script não pula direto para o topo:

1. **Sobe** em passos curtos (cerca de 60% da altura visível), com sobreposição entre os passos, lendo as mensagens a cada passo.
2. **Espera no topo** o WhatsApp carregar mais histórico e só considera que chegou ao início depois de algumas tentativas sem novidade.
3. **Desce** até o fim da conversa, coletando o que ficou abaixo do ponto inicial.
4. Mescla tudo em ordem cronológica, sem duplicatas, e gera os arquivos.

## Configuração

No início do `whatsapp_export.js` há um objeto `CONFIG`:

| Opção | Padrão | Descrição |
|---|---|---|
| `autoScroll` | `true` | Percorre a conversa inteira. Com `false`, exporta só o que já está carregado. |
| `maxScrolls` | `20000` | Limite de segurança de passos de rolagem. |
| `stepRatio` | `0.6` | Fração da altura visível rolada a cada passo. Reduza (ex.: `0.4`) para mais sobreposição. |
| `stepMs` | `400` | Espera após cada passo (ms). Aumente em conexões ou computadores lentos. |
| `waitMs` | `1500` | Espera no topo para o carregamento de mensagens antigas (ms). |
| `stableLimit` | `4` | Tentativas sem novidade no topo para concluir que chegou ao início. |

## Gerando o bookmarklet novamente

O bookmarklet é a versão minificada e codificada do `whatsapp_export.js`. Para regenerá-lo após editar o script:

```bash
npx terser whatsapp_export.js -c -m --comments false -o min.js
```

Depois, use o conteúdo de `min.js` precedido de `javascript:void ` e codificado como URL (por exemplo, com `encodeURIComponent`) como endereço do favorito.

## Limitações

- O script depende da estrutura interna do WhatsApp Web, que muda com frequência. Se uma atualização do site quebrar a exportação, os seletores no início do código precisarão de ajuste. O console exibe uma linha `DIAGNÓSTICO` quando nenhuma mensagem é encontrada, útil para investigar.
- Só é possível exportar o que o WhatsApp Web consegue carregar. Mensagens muito antigas podem exigir sincronização com o celular.
- Mídias não são baixadas, apenas indicadas por marcadores.
- Formato de data e hora segue o idioma configurado no seu WhatsApp.
- Alguns navegadores ou políticas de segurança podem bloquear bookmarklets; nesse caso, use o console.

## Privacidade e uso responsável

- O código roda inteiramente no seu navegador e não faz nenhuma requisição de rede.
- Use apenas para arquivar **suas próprias conversas** e trate os arquivos gerados com o cuidado devido, pois contêm dados pessoais seus e de outras pessoas.
- Este projeto não é afiliado, associado, autorizado ou endossado pelo WhatsApp ou pela Meta. "WhatsApp" é marca registrada dos seus respectivos titulares. Verifique se o uso está de acordo com os termos do serviço aplicáveis a você.

## Licença

Distribuído sob a licença [MIT](LICENSE).