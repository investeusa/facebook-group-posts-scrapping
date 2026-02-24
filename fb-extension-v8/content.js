// =============================================
// FB Group Scraper v10
// Modo híbrido: auto-scan + botão manual
// =============================================

let isEnabled = true;
let sessionSaved = 0;
let panelVisible = false;
let isMinimized = false;
let lastHoveredPost = null;
const processedPosts = new Set();

function cleanText(t) { return t ? t.trim().replace(/\s+/g, ' ') : ''; }

// ── Encontra container do post pelo profile_name ──
function findPostContainer(profileEl) {
  let el = profileEl.parentElement;
  let msgCandidate = null;
  for (let i = 0; i < 30; i++) {
    if (!el || el === document.body) break;
    const hasMsg = !!el.querySelector('[data-ad-preview="message"], [data-ad-comet-preview="message"]');
    if (hasMsg) {
      const profileCount = el.querySelectorAll('[data-ad-rendering-role="profile_name"]').length;
      if (profileCount > 1) break; // container grande demais
      msgCandidate = el;
      if (el.querySelector('[role="article"][aria-label*="Comment by"]')) return el;
    }
    el = el.parentElement;
  }
  return msgCandidate;
}

// ── Extrai comentários ────────────────────────
function extractComments(container) {
  const comments = [], seen = new Set();
  container.querySelectorAll('[role="article"][aria-label*="Comment by"]').forEach(c => {
    try {
      const authorLink = c.querySelector('a[href*="/user/"][role="link"]:not([aria-hidden])');
      const author = cleanText(authorLink?.querySelector('span[dir="auto"]')?.innerText);
      const langSpan = c.querySelector('span[dir="auto"][lang]');
      let text = '';
      if (langSpan) {
        const divs = langSpan.querySelectorAll('div[dir="auto"]');
        text = divs.length
          ? [...divs].map(d => cleanText(d.innerText)).filter(Boolean).join(' ')
          : cleanText(langSpan.innerText);
      }
      text = text.replace(/See more\s*$/i, '').replace(/Ver mais\s*$/i, '').trim();
      const key = (author + text).substring(0, 100);
      if (author && text && text !== author && !seen.has(key)) {
        seen.add(key);
        const timeEl = c.querySelector('a[href*="comment_id"]');
        comments.push({ author, text, time: cleanText(timeEl?.innerText) || null });
      }
    } catch(e) {}
  });
  return comments;
}

// ── Extrai dados de um container de post ─────
function extractFromContainer(container) {
  const profileDiv = container.querySelector('[data-ad-rendering-role="profile_name"]');
  if (!profileDiv) return null;
  const h2 = profileDiv.querySelector('h2');
  if (!h2) return null;
  let author = cleanText(h2.innerText)
    .split('\n')[0]
    .replace(/\s*·\s*(Follow|Member|Admin|Moderator|Seguir).*/i, '')
    .trim();
  if (!author) return null;

  const msgEl = container.querySelector('[data-ad-preview="message"], [data-ad-comet-preview="message"]');
  if (!msgEl) return null;

  // Concatena todos os parágrafos
  const paragraphs = [];
  msgEl.querySelectorAll('div[dir="auto"]').forEach(div => {
    if (div.closest('ul')) return;
    if (div.querySelector('div[dir="auto"]')) return;
    const t = cleanText(div.innerText);
    if (t && t.length > 1) paragraphs.push(t);
  });
  let text = paragraphs.join('\n').trim();
  if (!text) text = cleanText(msgEl.innerText);
  text = text.replace(/See more\s*$/i, '').replace(/Ver mais\s*$/i, '').trim();
  if (!text || text.length < 3) return null;

  return { author, text, comments: extractComments(container) };
}

// ── Salva post ────────────────────────────────
function savePost(author, text, comments, source) {
  const postId = (author + '_' + text).substring(0, 120);
  chrome.storage.local.get({ posts: [] }, data => {
    const existing = data.posts.findIndex(p => p.id === postId);
    if (existing >= 0) {
      // Atualiza comentários se tiver mais
      if (comments.length > data.posts[existing].commentCount) {
        data.posts[existing].comments = comments;
        data.posts[existing].commentCount = comments.length;
        data.posts[existing].updatedAt = new Date().toISOString();
        chrome.storage.local.set({ posts: data.posts });
        refreshStats();
        showToast(`🔄 Atualizado: ${comments.length} comentários`);
      } else {
        showToast('⚠️ Post já capturado');
      }
      return;
    }
    const postData = { id: postId, author, text, comments, commentCount: comments.length,
      capturedAt: new Date().toISOString(), url: window.location.href, source };
    data.posts.push(postData);
    processedPosts.add(postId);
    sessionSaved++;
    chrome.storage.local.set({ posts: data.posts });
    refreshStats();
    console.log(`[FB Scraper] ✅ ${source} "${author}" | ${comments.length} coment. | ${text.length} chars`);
    showToast(`✅ Capturado! ${comments.length} comentários`);
  });
}

// ── AUTO-SCAN (passivo) ───────────────────────
function autoScan() {
  if (!isEnabled) return;
  document.querySelectorAll('[data-ad-rendering-role="profile_name"]').forEach(profileDiv => {
    try {
      const container = findPostContainer(profileDiv);
      if (!container) return;
      const data = extractFromContainer(container);
      if (!data) return;
      const postId = (data.author + '_' + data.text).substring(0, 120);
      if (processedPosts.has(postId)) return;
      savePost(data.author, data.text, data.comments, 'auto');
    } catch(e) {}
  });
}

const observer = new MutationObserver(() => {
  clearTimeout(window._fbScraperTimeout);
  window._fbScraperTimeout = setTimeout(autoScan, 1000);
});
observer.observe(document.body, { childList: true, subtree: true });
setTimeout(autoScan, 1500);

// ── CAPTURE BUTTON (manual) ───────────────────
// Rastreia qual post o mouse está em cima
function trackHover() {
  document.addEventListener('mouseover', e => {
    const profileDiv = e.target.closest('[data-ad-rendering-role="profile_name"]');
    if (profileDiv) {
      const container = findPostContainer(profileDiv);
      if (container) {
        lastHoveredPost = container;
        highlightPost(container);
      }
    }
  }, true);
}

let highlightedEl = null;
function highlightPost(el) {
  if (highlightedEl && highlightedEl !== el) {
    highlightedEl.style.outline = '';
    highlightedEl.style.outlineOffset = '';
  }
  if (el) {
    el.style.outline = '2px dashed #1877f2';
    el.style.outlineOffset = '4px';
    highlightedEl = el;
    setTimeout(() => {
      if (highlightedEl === el) {
        el.style.outline = '';
        el.style.outlineOffset = '';
      }
    }, 2000);
  }
}

function captureManual() {
  // Tenta capturar o post em foco ou qualquer post visível com See more expandido
  const containers = [];
  document.querySelectorAll('[data-ad-rendering-role="profile_name"]').forEach(p => {
    const c = findPostContainer(p);
    if (c) containers.push(c);
  });

  if (!containers.length) {
    showToast('❌ Nenhum post encontrado na página');
    return;
  }

  // Captura TODOS os posts visíveis (texto completo como está agora no DOM)
  let count = 0;
  containers.forEach(container => {
    const data = extractFromContainer(container);
    if (!data) return;
    const postId = (data.author + '_' + data.text).substring(0, 120);
    // Força re-captura mesmo se já processado (texto pode ter mudado com See more)
    processedPosts.delete(postId);
    savePost(data.author, data.text, data.comments, 'manual');
    count++;
  });
  showToast(`📸 Capturando ${count} posts visíveis...`);
}

// ══════════════════════════════════════════════
// OVERLAY UI
// ══════════════════════════════════════════════
function createPanel() {
  if (document.getElementById('fb-scraper-panel')) return;
  trackHover();

  const style = document.createElement('style');
  style.id = 'fb-scraper-styles';
  style.textContent = `
    #fb-scraper-panel {
      position:fixed;top:16px;left:50%;transform:translateX(-50%);
      z-index:2147483647;width:340px;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      border-radius:14px;
      box-shadow:0 8px 32px rgba(0,0,0,.25),0 2px 8px rgba(0,0,0,.12);
      overflow:hidden;user-select:none;
    }
    #fb-scraper-panel.minimized{width:240px}
    #fbs-header{
      background:linear-gradient(135deg,#1877f2,#0d5cba);
      padding:11px 14px;display:flex;align-items:center;gap:8px;cursor:move;
    }
    #fbs-header .fbs-title{flex:1;color:white;font-size:13px;font-weight:700}
    #fbs-header .fbs-sub{color:rgba(255,255,255,.75);font-size:10px;display:block;margin-top:1px}
    .fbs-icon-btn{
      background:rgba(255,255,255,.18);border:none;color:white;
      width:26px;height:26px;border-radius:50%;cursor:pointer;
      display:flex;align-items:center;justify-content:center;
      font-size:15px;line-height:1;transition:background .15s;flex-shrink:0;padding:0;
    }
    .fbs-icon-btn:hover{background:rgba(255,255,255,.3)}
    #fbs-dot{
      width:8px;height:8px;border-radius:50%;background:#4ade80;flex-shrink:0;
      box-shadow:0 0 0 0 rgba(74,222,128,.4);animation:fbsPulse 1.8s infinite;
    }
    #fbs-dot.off{background:#9ca3af;animation:none;box-shadow:none}
    @keyframes fbsPulse{
      0%{box-shadow:0 0 0 0 rgba(74,222,128,.5)}
      70%{box-shadow:0 0 0 6px rgba(74,222,128,0)}
      100%{box-shadow:0 0 0 0 rgba(74,222,128,0)}
    }
    #fbs-body{background:white}
    #fb-scraper-panel.minimized #fbs-body{display:none}
    #fbs-bar{
      background:#f7f8fa;padding:8px 14px;
      display:flex;align-items:center;justify-content:space-between;
      border-bottom:1px solid #e4e6eb;
    }
    #fbs-bar-label{font-size:12px;font-weight:600;color:#1c1e21}
    .fbs-sw{position:relative;width:38px;height:22px}
    .fbs-sw input{opacity:0;width:0;height:0}
    .fbs-sw-slider{
      position:absolute;inset:0;background:#d1d5db;
      border-radius:22px;cursor:pointer;transition:.2s;
    }
    .fbs-sw-slider:before{
      content:'';position:absolute;height:16px;width:16px;
      left:3px;bottom:3px;background:white;border-radius:50%;transition:.2s;
      box-shadow:0 1px 3px rgba(0,0,0,.2);
    }
    .fbs-sw input:checked + .fbs-sw-slider{background:#1877f2}
    .fbs-sw input:checked + .fbs-sw-slider:before{transform:translateX(16px)}
    #fbs-capture-btn{
      margin:10px 14px 0;width:calc(100% - 28px);
      padding:12px;border:none;border-radius:10px;
      background:linear-gradient(135deg,#1877f2,#0d5cba);
      color:white;font-size:13px;font-weight:700;cursor:pointer;
      display:flex;align-items:center;justify-content:center;gap:8px;
      transition:opacity .15s,transform .1s;box-shadow:0 2px 8px rgba(24,119,242,.3);
    }
    #fbs-capture-btn:hover{opacity:.9}
    #fbs-capture-btn:active{transform:scale(.97)}
    #fbs-hint{
      margin:6px 14px 10px;font-size:11px;color:#9ca3af;text-align:center;line-height:1.4;
    }
    #fbs-stats{display:flex;border-top:1px solid #e4e6eb;border-bottom:1px solid #e4e6eb;margin-top:10px}
    .fbs-stat{flex:1;padding:12px 6px;text-align:center;border-right:1px solid #e4e6eb}
    .fbs-stat:last-child{border-right:none}
    .fbs-stat-n{font-size:24px;font-weight:800;color:#1877f2;line-height:1}
    .fbs-stat-l{font-size:10px;color:#6b7280;margin-top:3px;text-transform:uppercase;letter-spacing:.4px}
    #fbs-last{padding:10px 14px;border-bottom:1px solid #e4e6eb;min-height:46px}
    #fbs-last-lbl{font-size:9px;text-transform:uppercase;letter-spacing:.6px;color:#9ca3af;margin-bottom:4px}
    #fbs-last-val{font-size:12px;color:#374151;line-height:1.45}
    #fbs-actions{padding:10px 14px;display:flex;flex-wrap:wrap;gap:7px}
    .fbs-btn{
      flex:1;min-width:calc(50% - 4px);padding:8px 6px;border:none;border-radius:8px;
      font-size:11px;font-weight:600;cursor:pointer;transition:opacity .15s,transform .1s;
      display:flex;align-items:center;justify-content:center;gap:4px;
    }
    .fbs-btn:hover{opacity:.86}
    .fbs-btn:active{transform:scale(.97)}
    .fbs-btn-json{background:#1877f2;color:white}
    .fbs-btn-csv{background:#10b981;color:white}
    .fbs-btn-view{background:#e5e7eb;color:#1c1e21}
    .fbs-btn-clear{background:#fff1f2;color:#e11d48;border:1px solid #fecdd3;min-width:100%}
    #fbs-toast{
      position:fixed;top:80px;left:50%;transform:translateX(-50%);
      background:rgba(30,30,30,.92);color:white;padding:7px 18px;border-radius:20px;
      font-size:12px;font-weight:600;z-index:2147483647;opacity:0;transition:opacity .2s;
      pointer-events:none;white-space:nowrap;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    }
    #fbs-toast.show{opacity:1}
  `;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.id = 'fb-scraper-panel';
  panel.innerHTML = `
    <div id="fbs-header">
      <span style="font-size:17px">📥</span>
      <div class="fbs-title">FB Group Scraper<span class="fbs-sub">Posts &amp; Comentários</span></div>
      <div id="fbs-dot"></div>
      <button class="fbs-icon-btn" id="fbs-min-btn">−</button>
      <button class="fbs-icon-btn" id="fbs-close-btn">✕</button>
    </div>
    <div id="fbs-body">
      <div id="fbs-bar">
        <span id="fbs-bar-label">🟢 Auto-capturando...</span>
        <label class="fbs-sw"><input type="checkbox" id="fbs-toggle" checked><span class="fbs-sw-slider"></span></label>
      </div>
      <button id="fbs-capture-btn">📸 Capturar posts visíveis agora</button>
      <div id="fbs-hint">
        Expanda o "See more" e abra os comentários,<br>depois clique no botão acima para capturar tudo.
      </div>
      <div id="fbs-stats">
        <div class="fbs-stat"><div class="fbs-stat-n" id="fbs-n-posts">0</div><div class="fbs-stat-l">Posts</div></div>
        <div class="fbs-stat"><div class="fbs-stat-n" id="fbs-n-comments">0</div><div class="fbs-stat-l">Comentários</div></div>
        <div class="fbs-stat"><div class="fbs-stat-n" id="fbs-n-session">0</div><div class="fbs-stat-l">Sessão</div></div>
      </div>
      <div id="fbs-last">
        <div id="fbs-last-lbl">Último capturado</div>
        <div id="fbs-last-val" style="color:#9ca3af">Aguardando...</div>
      </div>
      <div id="fbs-actions">
        <button class="fbs-btn fbs-btn-json" id="fbs-json">⬇️ JSON</button>
        <button class="fbs-btn fbs-btn-csv"  id="fbs-csv">📊 CSV</button>
        <button class="fbs-btn fbs-btn-view" id="fbs-view">👁️ Visualizar</button>
        <button class="fbs-btn fbs-btn-clear" id="fbs-clear">🗑️ Limpar tudo</button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  const toast = document.createElement('div');
  toast.id = 'fbs-toast';
  document.body.appendChild(toast);

  bindEvents(panel);
  refreshStats();
}

function bindEvents(panel) {
  const $ = id => document.getElementById(id);

  $('fbs-min-btn').addEventListener('click', e => {
    e.stopPropagation();
    isMinimized = !isMinimized;
    panel.classList.toggle('minimized', isMinimized);
    $('fbs-min-btn').textContent = isMinimized ? '+' : '−';
  });

  $('fbs-close-btn').addEventListener('click', e => { e.stopPropagation(); hidePanel(); });

  $('fbs-toggle').addEventListener('change', e => {
    isEnabled = e.target.checked;
    $('fbs-dot').classList.toggle('off', !isEnabled);
    $('fbs-bar-label').textContent = isEnabled ? '🟢 Auto-capturando...' : '⏸️ Pausado';
    showToast(isEnabled ? '✅ Auto-captura ativada' : '⏸️ Pausado');
  });

  $('fbs-capture-btn').addEventListener('click', () => captureManual());

  $('fbs-json').addEventListener('click', () => {
    chrome.storage.local.get({ posts: [] }, data => {
      if (!data.posts.length) { showToast('❌ Nenhum post salvo'); return; }
      dlFile(new Blob([JSON.stringify(data.posts, null, 2)], { type:'application/json' }), `fb_posts_${stamp()}.json`);
      showToast(`✅ ${data.posts.length} posts exportados!`);
    });
  });

  $('fbs-csv').addEventListener('click', () => {
    chrome.storage.local.get({ posts: [] }, data => {
      if (!data.posts.length) { showToast('❌ Nenhum post salvo'); return; }
      const rows = [['autor','texto_post','data','url','total_comentarios','autor_comentario','texto_comentario'].join(',')];
      data.posts.forEach(p => {
        if (p.comments?.length) {
          p.comments.forEach(c => rows.push([csv(p.author),csv(p.text),csv(p.capturedAt),csv(p.url),p.commentCount,csv(c.author),csv(c.text)].join(',')));
        } else {
          rows.push([csv(p.author),csv(p.text),csv(p.capturedAt),csv(p.url),0,'',''].join(','));
        }
      });
      dlFile(new Blob(['\uFEFF'+rows.join('\n')], { type:'text/csv;charset=utf-8' }), `fb_posts_${stamp()}.csv`);
      showToast('✅ CSV exportado!');
    });
  });

  $('fbs-view').addEventListener('click', () => {
    chrome.storage.local.get({ posts: [] }, data => {
      if (!data.posts.length) { showToast('❌ Nenhum dado ainda'); return; }
      window.open(URL.createObjectURL(new Blob([viewerHTML(data.posts)], {type:'text/html'})), '_blank');
    });
  });

  $('fbs-clear').addEventListener('click', () => {
    if (!confirm('Apagar todos os dados?')) return;
    chrome.storage.local.set({ posts: [] }, () => {
      sessionSaved = 0; processedPosts.clear(); refreshStats(); showToast('🗑️ Apagado');
    });
  });

  makeDraggable(panel, $('fbs-header'));
}

function refreshStats() {
  const $ = id => document.getElementById(id);
  if (!$('fbs-n-posts')) return;
  chrome.storage.local.get({ posts: [] }, data => {
    const posts = data.posts || [];
    const totalC = posts.reduce((a,p) => a+(p.commentCount||0), 0);
    $('fbs-n-posts').textContent = posts.length;
    $('fbs-n-comments').textContent = totalC;
    $('fbs-n-session').textContent = sessionSaved;
    if (posts.length > 0) {
      const last = posts[posts.length-1];
      const preview = last.text.substring(0,60).replace(/\n/g,' ');
      $('fbs-last-val').innerHTML =
        `<strong style="color:#1877f2">${esc(last.author)}</strong> · ${last.commentCount} coment.<br>
         <span style="color:#6b7280;font-size:11px">${esc(preview)}${last.text.length>60?'…':''}</span>`;
    }
  });
}

function hidePanel() {
  ['fb-scraper-panel','fb-scraper-styles','fbs-toast'].forEach(id => document.getElementById(id)?.remove());
  panelVisible = false;
}

function showToast(msg, ms=2500) {
  const t = document.getElementById('fbs-toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(window._fbsToast);
  window._fbsToast = setTimeout(() => t.classList.remove('show'), ms);
}

function makeDraggable(panel, handle) {
  let ox,oy,sx,sy,drag=false;
  handle.addEventListener('mousedown', e => {
    if (e.target.closest('button')) return;
    drag=true; const r=panel.getBoundingClientRect();
    ox=r.left;oy=r.top;sx=e.clientX;sy=e.clientY; e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!drag) return;
    panel.style.left=(ox+e.clientX-sx)+'px'; panel.style.top=(oy+e.clientY-sy)+'px';
    panel.style.transform='none';
  });
  document.addEventListener('mouseup', () => { drag=false; });
}

function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function csv(v){return '"'+String(v||'').replace(/"/g,'""').replace(/\n/g,' ')+'"'}
function stamp(){return new Date().toISOString().replace(/[:.]/g,'-').substring(0,19)}
function dlFile(blob,name){
  const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:name});
  a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

function viewerHTML(posts) {
  const total = posts.reduce((a,p)=>a+(p.commentCount||0),0);
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>FB Scraper</title>
<style>*{box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#f0f2f5;margin:0;padding:20px}
h1{color:#1877f2;font-size:20px}p{color:#6b7280;font-size:13px;margin:4px 0 20px}
.post{background:#fff;border-radius:10px;padding:16px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.ph{display:flex;justify-content:space-between;margin-bottom:8px}
.pa{font-weight:700;color:#1877f2}.pm{font-size:11px;color:#9ca3af}
.pt{font-size:14px;line-height:1.6;white-space:pre-wrap;word-break:break-word;color:#111}
.cs{margin-top:12px;padding-top:12px;border-top:1px solid #f0f2f5}
.ct{font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
.c{padding:7px 12px;margin-bottom:5px;background:#f7f8fa;border-radius:12px;font-size:13px;line-height:1.4}
.c strong{color:#1877f2;margin-right:5px}</style></head><body>
<h1>📥 FB Group Scraper</h1>
<p>${posts.length} posts · ${total} comentários · ${new Date().toLocaleString('pt-BR')}</p>
${posts.map(p=>`<div class="post">
<div class="ph"><span class="pa">👤 ${esc(p.author)}</span><span class="pm">${esc((p.capturedAt||'').substring(0,19).replace('T',' '))} · ${p.commentCount} coment.</span></div>
<div class="pt">${esc(p.text)}</div>
${p.comments?.length?`<div class="cs"><div class="ct">💬 ${p.comments.length} comentário(s)</div>
${p.comments.map(c=>`<div class="c"><strong>${esc(c.author)}</strong>${esc(c.text)}</div>`).join('')}</div>`:''}</div>`).join('')}
</body></html>`;
}

chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'TOGGLE_PANEL') {
    if (panelVisible) hidePanel();
    else { panelVisible = true; createPanel(); }
  }
});

console.log('[FB Scraper v10] Ativo');
