/**
 * Exporta a conversa COMPLETA aberta no WhatsApp Web para Markdown e HTML.
 *
 * COMO USAR
 * 1. Abra web.whatsapp.com e clique na conversa desejada.
 * 2. Abra o console (F12 -> aba Console), cole este script inteiro e tecle Enter.
 *    (Se o Chrome bloquear a colagem, digite "allow pasting" antes.)
 * 3. Pode executar com a conversa em QUALQUER posição. Deixe a aba aberta e visível:
 *    o script sobe até o início carregando o histórico, depois desce até o fim
 *    (pode levar vários minutos em conversas longas).
 *    O progresso aparece no console e em uma faixa no topo da página.
 * 4. Ao terminar, baixa <contato>.md e <contato>.html.
 *
 * Para parar antes e exportar o que já foi coletado, digite no console:
 *    window.__stopExport = true
 *
 * Tudo roda localmente no seu navegador; nada é enviado para fora.
 */
(async () => {
  const CONFIG = {
    autoScroll: true,   // percorre a conversa inteira (de qualquer posição inicial)
    maxScrolls: 20000,  // limite de segurança de passos
    stepRatio: 0.6,     // cada passo rola 60% da altura visível (garante sobreposição)
    stepMs: 400,        // espera após cada passo (aumente se faltarem mensagens)
    waitMs: 1500,       // espera no topo, aguardando o WhatsApp carregar mensagens antigas
    stableLimit: 4      // nº de tentativas no topo sem novidade => chegou no início
  };

  window.__stopExport = false;

  const main =
    document.querySelector('#main') ||
    document.querySelector('[data-testid="conversation-panel-body"]') ||
    document.querySelector('[data-testid="conversation-panel-messages"]') ||
    (document.querySelector('[data-pre-plain-text]') ? document.body : null);
  if (!main) {
    alert('Abra uma conversa no WhatsApp Web primeiro.');
    return;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rowsSel = 'div[data-id]';

  // ---------- Detecção de mensagens ----------
  const isMessageRow = (el) =>
    el.matches('.message-in, .message-out') ||
    !!el.querySelector('.message-in, .message-out, [data-pre-plain-text]') ||
    /^(true|false)_/.test(el.getAttribute('data-id') || '');

  const dedupe = (rows) => rows.filter((r) => !rows.some((o) => o !== r && r.contains(o)));

  const getRows = () => {
    let rows = dedupe([...main.querySelectorAll(rowsSel)].filter(isMessageRow));
    if (rows.length) return rows;
    const set = new Set();
    main.querySelectorAll('[data-pre-plain-text]').forEach((el) => {
      set.add(
        el.closest('[data-id], [role="row"], [role="listitem"]') ||
          el.parentElement?.parentElement ||
          el
      );
    });
    return dedupe([...set]);
  };

  const findScroller = () => {
    let el = main.querySelector(rowsSel) || main.querySelector('[data-pre-plain-text]');
    while (el && el !== document.documentElement) {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 10) return el;
      el = el.parentElement;
    }
    return null;
  };

  // ---------- Utilitários ----------
  const nodeText = (node) => {
    let out = '';
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) out += n.textContent;
      else if (n.nodeType === 1) {
        if (n.tagName === 'BR') out += '\n';
        else if (n.tagName === 'IMG') out += n.alt || '';
        else out += nodeText(n);
      }
    });
    return out;
  };

  const esc = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const chatTitle = (
    main.querySelector('header span[dir="auto"]')?.innerText ||
    main.querySelector('header [title]')?.getAttribute('title') ||
    'conversa'
  ).trim();

  // ---------- Extração de uma mensagem ----------
  const extractRow = (row) => {
    const id = row.getAttribute('data-id') || '';

    let out;
    if (/^(true|false)_/.test(id)) out = id.startsWith('true_');
    else if (row.matches('.message-out') || row.querySelector('.message-out')) out = true;
    else if (row.matches('.message-in') || row.querySelector('.message-in')) out = false;
    else {
      const anchor = row.querySelector('[data-pre-plain-text]') || row;
      const r = anchor.getBoundingClientRect();
      const mr = main.getBoundingClientRect();
      out = r.left + r.width / 2 > mr.left + mr.width / 2;
    }

    const pre = row.querySelector('[data-pre-plain-text]')?.getAttribute('data-pre-plain-text') || '';
    let time = '', date = '', sender = '';
    const m = pre.match(/^\[(.*?)\]\s*(.*?):\s*$/);
    if (m) {
      const parts = m[1].split(/,\s*/);
      time = parts[0] || '';
      date = parts.slice(1).join(', ');
      sender = m[2];
    } else {
      const meta = [...row.querySelectorAll('span')]
        .map((s) => s.innerText?.trim())
        .filter((t) => /^\d{1,2}:\d{2}(\s?[AP]M)?$/i.test(t || ''));
      time = meta[meta.length - 1] || '';
      sender = out ? 'Eu' : '';
    }

    const quoteEl = row.querySelector('[aria-label*="citada" i], [aria-label*="quoted" i]');
    const quote = quoteEl ? quoteEl.innerText.replace(/\n+/g, ' — ').trim() : '';

    let spans = [...row.querySelectorAll('span.selectable-text, span[data-testid="selectable-text"]')]
      .filter((s) => !(quoteEl && quoteEl.contains(s)));
    spans = spans.filter((s) => !spans.some((o) => o !== s && o.contains(s)));
    let text = spans.map((s) => nodeText(s)).join('\n').trim();
    if (!text) {
      const c = row.querySelector('[data-pre-plain-text]');
      if (c) text = nodeText(c).trim().replace(/\s*\d{1,2}:\d{2}(\s?[AP]M)?\s*$/i, '');
    }

    const media = [];
    if (row.querySelector('[data-icon="audio-play"], [data-icon="ptt-status"], audio')) media.push('🎤 [Áudio]');
    if (row.querySelector('[data-icon="media-play"], video')) media.push('🎬 [Vídeo]');
    if (row.querySelector('[data-icon^="document"]')) media.push('📄 [Documento]');
    if (row.querySelector('img[src^="blob:"]:not(.emoji)') && !media.length) media.push('🖼️ [Imagem/Figurinha]');

    if (!text && !media.length && !quote) return null;
    return { date, time, sender, out, text, media, quote, pre };
  };

  const keyOf = (row) => {
    const id = row.getAttribute('data-id');
    if (id) return id;
    const pre = row.querySelector('[data-pre-plain-text]')?.getAttribute('data-pre-plain-text') || '';
    return pre + '|' + (row.innerText || '').slice(0, 80);
  };

  // ---------- Coleta incremental (preserva a ordem cronológica) ----------
  const store = new Map(); // key -> mensagem
  const order = [];        // keys em ordem cronológica

  const collect = () => {
    const snap = getRows().map((r) => ({ r, key: keyOf(r) }));
    for (const { r, key } of snap) {
      if (!store.has(key)) {
        const msg = extractRow(r);
        if (msg) store.set(key, msg);
      }
    }
    const ids = snap.map((s) => s.key).filter((k) => store.has(k));
    if (!order.length) {
      order.push(...ids);
      return;
    }
    const known = new Set(order);
    ids.forEach((k, i) => {
      if (known.has(k)) return;
      let j = i + 1;
      while (j < ids.length && !known.has(ids[j])) j++;
      if (j < ids.length) {
        order.splice(order.indexOf(ids[j]), 0, k);
      } else {
        let p = i - 1;
        while (p >= 0 && !known.has(ids[p])) p--;
        if (p >= 0) order.splice(order.indexOf(ids[p]) + 1, 0, k);
        else order.push(k);
      }
      known.add(k);
    });
  };

  // ---------- Faixa de progresso ----------
  const banner = document.createElement('div');
  banner.style.cssText =
    'position:fixed;top:0;left:0;right:0;z-index:99999;background:#111b21;color:#fff;' +
    'font:14px system-ui;padding:8px 12px;text-align:center';
  document.body.appendChild(banner);
  const say = (t) => { banner.textContent = t; console.log(t); };

  // ---------- Percurso completo da conversa ----------
  // O WhatsApp só desenha as mensagens próximas da área visível. Por isso o script
  // NÃO pula direto para o topo: ele sobe em passos curtos (com sobreposição),
  // lendo a cada passo; ao chegar no topo espera carregar mais histórico; e por
  // fim desce em passos até o fim, para pegar também o que estava abaixo do ponto
  // onde você começou.
  collect();
  const scroller = findScroller();

  if (CONFIG.autoScroll && scroller) {
    const stepPx = () => Math.max(200, Math.floor(scroller.clientHeight * CONFIG.stepRatio));
    const status = (fase) => {
      const oldest = store.get(order[0]);
      say(`${fase} ${store.size} mensagens (mais antiga: ${oldest?.date || '?'}). ` +
          `Para parar: window.__stopExport = true`);
    };

    // Fase 1: subir até o início
    let stable = 0;
    let lastCount = store.size;
    let lastOldest = order[0];
    for (let i = 0; i < CONFIG.maxScrolls && stable < CONFIG.stableLimit; i++) {
      if (window.__stopExport) break;
      if (scroller.scrollTop > 1) {
        scroller.scrollTop = Math.max(0, scroller.scrollTop - stepPx());
        await sleep(CONFIG.stepMs);
        collect();
        stable = 0;
      } else {
        // no topo: aguarda o WhatsApp carregar mensagens mais antigas
        await sleep(CONFIG.waitMs);
        collect();
        if (store.size === lastCount && order[0] === lastOldest) {
          stable++;
          scroller.scrollTop = 80; // "cutuca" para disparar novo carregamento
          await sleep(250);
          scroller.scrollTop = 0;
        } else {
          stable = 0;
        }
      }
      lastCount = store.size;
      lastOldest = order[0];
      status('Subindo no histórico...');
    }

    // Fase 2: descer até o fim, coletando o que ficou para trás
    let guard = 0;
    while (
      !window.__stopExport &&
      guard++ < CONFIG.maxScrolls &&
      scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 5
    ) {
      scroller.scrollTop += stepPx();
      await sleep(CONFIG.stepMs);
      collect();
      status('Descendo e conferindo...');
    }
    await sleep(CONFIG.stepMs);
    collect();
    scroller.scrollTop = scroller.scrollHeight;
  } else if (CONFIG.autoScroll) {
    console.warn('Não encontrei o container de rolagem; exportando apenas o que está na tela.');
  }

  banner.remove();

  // ---------- Montagem final ----------
  const messages = order.map((k) => store.get(k));
  if (!messages.length) {
    console.log('DIAGNÓSTICO', {
      '#main': !!document.querySelector('#main'),
      'div[data-id]': document.querySelectorAll('div[data-id]').length,
      '[data-pre-plain-text]': document.querySelectorAll('[data-pre-plain-text]').length,
      '.message-in': document.querySelectorAll('.message-in').length,
      '.message-out': document.querySelectorAll('.message-out').length,
      'span.selectable-text': document.querySelectorAll('span.selectable-text').length,
      '[role=row]': document.querySelectorAll('[role="row"]').length
    });
    alert('Nenhuma mensagem encontrada. O WhatsApp pode ter mudado a estrutura da página.');
    return;
  }

  // Preenche datas/remetentes ausentes usando as mensagens vizinhas
  let lastDate = '';
  for (const msg of messages) {
    if (msg.date) lastDate = msg.date; else msg.date = lastDate;
  }
  let nextDate = '';
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].date) nextDate = messages[i].date; else messages[i].date = nextDate;
  }
  for (const msg of messages) if (!msg.sender) msg.sender = msg.out ? 'Eu' : chatTitle;

  const exportedAt = new Date().toLocaleString('pt-BR');
  const first = messages[0].date, last = messages[messages.length - 1].date;

  // ---------- Markdown ----------
  let md = `# Conversa com ${chatTitle}\n\n_Exportado em ${exportedAt} — ${messages.length} mensagens (${first} a ${last})_\n`;
  let curDate = null;
  for (const msg of messages) {
    if (msg.date !== curDate) {
      curDate = msg.date;
      md += `\n## ${curDate || 'Sem data'}\n\n`;
    }
    md += `**${msg.time} — ${msg.sender}:**\n`;
    if (msg.quote) md += `> ${msg.quote}\n\n`;
    const body = [...msg.media, msg.text].filter(Boolean).join('\n');
    if (body) md += body.split('\n').join('  \n') + '\n';
    md += '\n';
  }

  // ---------- HTML ----------
  let html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Conversa com ${esc(chatTitle)}</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#efeae2;margin:0;padding:16px;color:#111}
  .wrap{max-width:760px;margin:0 auto}
  h1{font-size:1.3rem;margin:0 0 4px} .sub{color:#667;font-size:.85rem;margin-bottom:12px}
  .day{text-align:center;margin:16px 0 8px}
  .day span{background:#fff;border-radius:8px;padding:4px 12px;font-size:.8rem;color:#555;box-shadow:0 1px 1px #0002}
  .msg{max-width:80%;margin:4px 0;padding:6px 10px;border-radius:8px;box-shadow:0 1px 1px #0002;background:#fff;clear:both;overflow-wrap:anywhere}
  .msg.out{background:#d9fdd3;margin-left:auto}
  .who{font-size:.78rem;font-weight:600;color:#06796b;margin-bottom:2px}
  .quote{border-left:3px solid #06cf9c;background:#0000000d;padding:3px 8px;border-radius:4px;font-size:.85rem;color:#555;margin-bottom:4px}
  .media{color:#555;font-style:italic}
  .text{white-space:pre-wrap}
  .time{font-size:.7rem;color:#667;text-align:right;margin-top:2px}
</style></head><body><div class="wrap">
<h1>Conversa com ${esc(chatTitle)}</h1>
<div class="sub">Exportado em ${esc(exportedAt)} — ${messages.length} mensagens (${esc(first)} a ${esc(last)})</div>
`;
  curDate = null;
  for (const msg of messages) {
    if (msg.date !== curDate) {
      curDate = msg.date;
      html += `<div class="day"><span>${esc(curDate || 'Sem data')}</span></div>\n`;
    }
    html += `<div class="msg ${msg.out ? 'out' : 'in'}">`;
    if (!msg.out) html += `<div class="who">${esc(msg.sender)}</div>`;
    if (msg.quote) html += `<div class="quote">${esc(msg.quote)}</div>`;
    if (msg.media.length) html += `<div class="media">${esc(msg.media.join(' '))}</div>`;
    if (msg.text) html += `<div class="text">${esc(msg.text)}</div>`;
    html += `<div class="time">${esc(msg.time)}</div></div>\n`;
  }
  html += `</div></body></html>`;

  // ---------- Download ----------
  const safeName = chatTitle.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80) || 'conversa';
  const download = (content, filename, type) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  download(md, `${safeName}.md`, 'text/markdown;charset=utf-8');
  await sleep(500);
  download(html, `${safeName}.html`, 'text/html;charset=utf-8');

  console.log(`✅ ${messages.length} mensagens exportadas de "${chatTitle}" (${first} a ${last}).`);
})();
