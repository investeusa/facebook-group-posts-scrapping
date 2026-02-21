// =============================================
// FB Group Scraper v3 - content.js
// Overlay flutuante + captura de posts/comentários
// =============================================

let isEnabled = true;
let panelVisible = false;
let isMinimized = false;
const processedPosts = new Set();

// ══════════════════════════════════════════════
// OVERLAY UI
// ══════════════════════════════════════════════

function createPanel() {
  if (document.getElementById('fb-scraper-panel')) return;

  // Inject styles
  const style = document.createElement('style');
  style.id = 'fb-scraper-styles';
  style.textContent = `
    #fb-scraper-panel {
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483647;
      width: 340px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      border-radius: 14px;
      box-shadow: 0 8px 32px rgba(0,0,0,.22), 0 2px 8px rgba(0,0,0,.12);
      overflow: hidden;
      transition: all .25s cubic-bezier(.4,0,.2,1);
      user-select: none;
    }
    #fb-scraper-panel.minimized {
      width: 220px;
    }
    #fb-scraper-header {
      background: #1877f2;
      padding: 11px 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: move;
    }
    #fb-scraper-header .title {
      flex: 1;
      color: white;
      font-size: 13px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #fb-scraper-header .subtitle {
      color: rgba(255,255,255,.75);
      font-size: 10px;
      display: block;
      margin-top: 1px;
    }
    .fb-scraper-btn-icon {
      background: rgba(255,255,255,.18);
      border: none;
      color: white;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      transition: background .15s;
      flex-shrink: 0;
      padding: 0;
    }
    .fb-scraper-btn-icon:hover { background: rgba(255,255,255,.32); }

    #fb-scraper-body {
      background: white;
    }

    /* Status bar */
    #fb-scraper-status-bar {
      background: #f0f2f5;
      padding: 8px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #e4e6eb;
    }
    #fb-scraper-toggle-wrap {
      display: flex;
      align-items: center;
      gap: 7px;
    }
    .fbs-toggle-label {
      font-size: 12px;
      font-weight: 600;
      color: #1c1e21;
    }
    .fbs-toggle {
      position: relative; width: 36px; height: 20px;
    }
    .fbs-toggle input { opacity: 0; width: 0; height: 0; }
    .fbs-slider {
      position: absolute; inset: 0;
      background: #ccc; border-radius: 20px; cursor: pointer; transition: .2s;
    }
    .fbs-slider:before {
      content: ''; position: absolute;
      height: 14px; width: 14px; left: 3px; bottom: 3px;
      background: white; border-radius: 50%; transition: .2s;
    }
    .fbs-toggle input:checked + .fbs-slider { background: #1877f2; }
    .fbs-toggle input:checked + .fbs-slider:before { transform: translateX(16px); }
    #fbs-live-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #42b883; flex-shrink: 0;
      animation: fbsPulse 1.5s infinite;
    }
    #fbs-live-dot.paused { background: #ccc; animation: none; }
    @keyframes fbsPulse {
      0%,100% { opacity: 1; } 50% { opacity: .3; }
    }

    /* Stats */
    #fb-scraper-stats {
      display: flex;
      gap: 0;
      border-bottom: 1px solid #e4e6eb;
    }
    .fbs-stat {
      flex: 1;
      padding: 12px 8px;
      text-align: center;
      border-right: 1px solid #e4e6eb;
    }
    .fbs-stat:last-child { border-right: none; }
    .fbs-stat-n {
      font-size: 22px;
      font-weight: 800;
      color: #1877f2;
      line-height: 1;
    }
    .fbs-stat-l {
      font-size: 10px;
      color: #65676b;
      margin-top: 3px;
      text-transform: uppercase;
      letter-spacing: .4px;
    }

    /* Last post */
    #fbs-last {
      padding: 10px 14px;
      border-bottom: 1px solid #e4e6eb;
      min-height: 46px;
    }
    #fbs-last-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: .6px;
      color: #65676b;
      margin-bottom: 3px;
    }
    #fbs-last-content {
      font-size: 12px;
      color: #1c1e21;
      line-height: 1.4;
    }

    /* Actions */
    #fb-scraper-actions {
      padding: 10px 14px;
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
    }
    .fbs-btn {
      flex: 1;
      min-width: calc(50% - 4px);
      padding: 8px 6px;
      border: none;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity .15s, transform .1s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
    .fbs-btn:hover { opacity: .85; }
    .fbs-btn:active { transform: scale(.97); }
    .fbs-btn-json { background: #1877f2; color: white; }
    .fbs-btn-csv  { background: #42b883; color: white; }
    .fbs-btn-view { background: #e4e6eb; color: #1c1e21; }
    .fbs-btn-clear { background: #fff0f0; color: #e74c3c; border: 1px solid #ffd0d0; min-width: 100%; }

    /* Minimized state */
    #fb-scraper-panel.minimized #fb-scraper-body { display: none; }

    /* Toast */
    #fbs-toast {
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: #333;
      color: white;
      padding: 7px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      z-index: 2147483647;
      opacity: 0;
      transition: opacity .2s;
      pointer-events: none;
      white-space: nowrap;
    }
    #fbs-toast.show { opacity: 1; }
  `;
  document.head.appendChild(style);

  // Panel HTML
  const panel = document.createElement('div');
  panel.id = 'fb-scraper-panel';
  panel.innerHTML = `
    <div id="fb-scraper-header">
      <span style="font-size:16px">📥</span>
      <div class="title">
        FB Group Scraper
        <span class="subtitle">Posts &amp; Comentários</span>
      </div>
      <div id="fbs-live-dot"></div>
      <button class="fb-scraper-btn-icon" id="fbs-minimize-btn" title="Minimizar">−</button>
      <button class="fb-scraper-btn-icon" id="fbs-close-btn" title="Fechar">✕</button>
    </div>

    <div id="fb-scraper-body">
      <div id="fb-scraper-status-bar">
        <div id="fb-scraper-toggle-wrap">
          <div id="fbs-live-dot-inner" style="width:7px;height:7px;border-radius:50%;background:#42b883;animation:fbsPulse 1.5s infinite"></div>
          <span class="fbs-toggle-label" id="fbs-capture-label">Capturando...</span>
        </div>
        <label class="fbs-toggle">
          <input type="checkbox" id="fbs-toggle-input" checked>
          <span class="fbs-slider"></span>
        </label>
      </div>

      <div id="fb-scraper-stats">
        <div class="fbs-stat">
          <div class="fbs-stat-n" id="fbs-posts-n">0</div>
          <div class="fbs-stat-l">Posts</div>
        </div>
        <div class="fbs-stat">
          <div class="fbs-stat-n" id="fbs-comments-n">0</div>
          <div class="fbs-stat-l">Comentários</div>
        </div>
        <div class="fbs-stat">
          <div class="fbs-stat-n" id="fbs-session-n">0</div>
          <div class="fbs-stat-l">Sessão</div>
        </div>
      </div>

      <div id="fbs-last">
        <div id="fbs-last-label">Último capturado</div>
        <div id="fbs-last-content" style="color:#65676b">Aguardando posts...</div>
      </div>

      <div id="fb-scraper-actions">
        <button class="fbs-btn fbs-btn-json" id="fbs-btn-json">⬇️ JSON</button>
        <button class="fbs-btn fbs-btn-csv"  id="fbs-btn-csv">📊 CSV</button>
        <button class="fbs-btn fbs-btn-view" id="fbs-btn-view">👁️ Visualizar</button>
        <button class="fbs-btn fbs-btn-clear" id="fbs-btn-clear">🗑️ Limpar tudo</button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  // Toast
  const toast = document.createElement('div');
  toast.id = 'fbs-toast';
  document.body.appendChild(toast);

  bindPanelEvents(panel);
  refreshStats();
}

function showToast(msg, duration = 2500) {
  const t = document.getElementById('fbs-toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window._fbsToastTimeout);
  window._fbsToastTimeout = setTimeout(() => t.classList.remove('show'), duration);
}

function refreshStats() {
  chrome.storage.local.get({ posts: [], sessionCount: 0 }, (data) => {
    const posts = data.posts || [];
    const totalComments = posts.reduce((a, p) => a + (p.commentCount || 0), 0);
    const el = (id) => document.getElementById(id);

    if (el('fbs-posts-n'))    el('fbs-posts-n').textContent = posts.length;
    if (el('fbs-comments-n')) el('fbs-comments-n').textContent = totalComments;
    if (el('fbs-session-n'))  el('fbs-session-n').textContent = sessionSaved;

    if (posts.length > 0) {
      const last = posts[posts.length - 1];
      if (el('fbs-last-content')) {
        el('fbs-last-content').innerHTML =
          `<strong style="color:#1877f2">${esc(last.author)}</strong> · ${last.commentCount} comentário(s)<br>
           <span style="color:#65676b;font-size:11px">${esc(last.text.substring(0, 55))}${last.text.length > 55 ? '…' : ''}</span>`;
      }
    }
  });
}

function bindPanelEvents(panel) {
  // Minimize
  document.getElementById('fbs-minimize-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    isMinimized = !isMinimized;
    panel.classList.toggle('minimized', isMinimized);
    document.getElementById('fbs-minimize-btn').textContent = isMinimized ? '+' : '−';
  });

  // Close
  document.getElementById('fbs-close-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    hidePanel();
  });

  // Toggle capture
  document.getElementById('fbs-toggle-input').addEventListener('change', (e) => {
    isEnabled = e.target.checked;
    const dot = document.getElementById('fbs-live-dot');
    const label = document.getElementById('fbs-capture-label');
    const innerDot = document.getElementById('fbs-live-dot-inner');
    if (isEnabled) {
      if (dot) { dot.style.background = '#42b883'; dot.style.animation = 'fbsPulse 1.5s infinite'; }
      if (innerDot) { innerDot.style.background = '#42b883'; innerDot.style.animation = 'fbsPulse 1.5s infinite'; }
      if (label) label.textContent = 'Capturando...';
      showToast('✅ Captura ativada');
    } else {
      if (dot) { dot.style.background = '#ccc'; dot.style.animation = 'none'; }
      if (innerDot) { innerDot.style.background = '#ccc'; innerDot.style.animation = 'none'; }
      if (label) label.textContent = 'Pausado';
      showToast('⏸️ Captura pausada');
    }
  });

  // Export JSON
  document.getElementById('fbs-btn-json').addEventListener('click', () => {
    chrome.storage.local.get({ posts: [] }, (data) => {
      if (!data.posts.length) { showToast('❌ Nenhum post para exportar'); return; }
      downloadFile(
        new Blob([JSON.stringify(data.posts, null, 2)], { type: 'application/json' }),
        `fb_posts_${dateStamp()}.json`
      );
      showToast(`✅ ${data.posts.length} posts exportados!`);
    });
  });

  // Export CSV
  document.getElementById('fbs-btn-csv').addEventListener('click', () => {
    chrome.storage.local.get({ posts: [] }, (data) => {
      if (!data.posts.length) { showToast('❌ Nenhum post para exportar'); return; }
      const rows = [['post_autor','post_texto','data_captura','total_comentarios','autor_comentario','texto_comentario'].join(',')];
      data.posts.forEach(post => {
        if (post.comments?.length) {
          post.comments.forEach(c => rows.push([
            csvEsc(post.author), csvEsc(post.text), csvEsc(post.capturedAt),
            post.commentCount, csvEsc(c.author), csvEsc(c.text)
          ].join(',')));
        } else {
          rows.push([csvEsc(post.author), csvEsc(post.text), csvEsc(post.capturedAt), 0, '', ''].join(','));
        }
      });
      downloadFile(
        new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8' }),
        `fb_posts_${dateStamp()}.csv`
      );
      showToast('✅ CSV exportado!');
    });
  });

  // View
  document.getElementById('fbs-btn-view').addEventListener('click', () => {
    chrome.storage.local.get({ posts: [] }, (data) => {
      if (!data.posts.length) { showToast('❌ Nenhum dado ainda'); return; }
      const blob = new Blob([generateViewerHTML(data.posts)], { type: 'text/html' });
      window.open(URL.createObjectURL(blob), '_blank');
    });
  });

  // Clear
  document.getElementById('fbs-btn-clear').addEventListener('click', () => {
    if (!confirm('Apagar todos os dados coletados?')) return;
    chrome.storage.local.set({ posts: [], totalSaved: 0 }, () => {
      sessionSaved = 0;
      processedPosts.clear();
      refreshStats();
      showToast('🗑️ Dados apagados');
    });
  });

  // Drag to move
  makeDraggable(panel, document.getElementById('fb-scraper-header'));

  // Painel só fecha pelo botão ✕ ou pelo ícone da extensão
}

function hidePanel() {
  const panel = document.getElementById('fb-scraper-panel');
  if (panel) panel.remove();
  const style = document.getElementById('fb-scraper-styles');
  if (style) style.remove();
  const toast = document.getElementById('fbs-toast');
  if (toast) toast.remove();
  panelVisible = false;
}

function showPanel() {
  panelVisible = true;
  createPanel();
}

// Drag
function makeDraggable(panel, handle) {
  let ox, oy, startX, startY, dragging = false;
  handle.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    dragging = true;
    const rect = panel.getBoundingClientRect();
    ox = rect.left; oy = rect.top;
    startX = e.clientX; startY = e.clientY;
    panel.style.transition = 'none';
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const nx = ox + (e.clientX - startX);
    const ny = oy + (e.clientY - startY);
    panel.style.left = nx + 'px';
    panel.style.top = ny + 'px';
    panel.style.transform = 'none';
  });
  document.addEventListener('mouseup', () => {
    dragging = false;
    panel.style.transition = 'all .25s cubic-bezier(.4,0,.2,1)';
  });
}

// ══════════════════════════════════════════════
// SCRAPING
// ══════════════════════════════════════════════

let sessionSaved = 0;

function cleanText(text) {
  return text ? text.trim().replace(/\s+/g, ' ') : '';
}

function extractComments(postEl) {
  const comments = [];
  const seen = new Set();

  const commentArticles = postEl.querySelectorAll('[role="article"][aria-label*="Comment by"]');

  commentArticles.forEach(commentEl => {
    try {
      const authorSpan = commentEl.querySelector('a[href*="/user/"] span[dir="auto"]')
                      || commentEl.querySelector('a[role="link"] span[dir="auto"]');
      const author = cleanText(authorSpan?.innerText);

      let commentText = '';
      const contentSpan = commentEl.querySelector('span[dir="auto"][lang]')
                        || commentEl.querySelector('.xmjcpbm span[dir="auto"]');
      if (contentSpan) {
        const textDiv = contentSpan.querySelector('div[dir="auto"]');
        commentText = cleanText(textDiv?.innerText || contentSpan.innerText)
          .replace(/\s*See more\s*$/, '').trim();
      }

      const timeLink = commentEl.querySelector('a[href*="comment_id"]');
      const time = cleanText(timeLink?.innerText) || null;

      if (author && commentText && commentText !== author && !seen.has(author + commentText)) {
        seen.add(author + commentText);
        comments.push({ author, text: commentText, time });
      }
    } catch (e) {}
  });

  return comments;
}

function extractPosts() {
  if (!isEnabled) return;

  document.querySelectorAll('[role="article"]').forEach(article => {
    try {
      const ariaLabel = (article.getAttribute('aria-label') || '').toLowerCase();
      if (ariaLabel.includes('comment')) return;
      if (article.parentElement?.closest('[role="article"]')) return;

      const profileDiv = article.querySelector('[data-ad-rendering-role="profile_name"]');
      const authorEl = profileDiv?.querySelector('[role="button"]')
                    || article.querySelector('h2 [role="button"]');
      const author = cleanText(authorEl?.innerText) || 'Desconhecido';

      const messageEl = article.querySelector('[data-ad-preview="message"]')
                     || article.querySelector('[data-ad-comet-preview="message"]');
      if (!messageEl) return;

      let postText = '';
      messageEl.querySelectorAll('div[dir="auto"]').forEach(div => {
        if (div.querySelector('[role="button"]') || div.closest('ul')) return;
        const t = cleanText(div.innerText);
        if (t && t.length > postText.length) postText = t;
      });

      if (!postText || postText.length < 5) return;

      const postId = `${author}_${postText.substring(0, 100)}`;

      if (processedPosts.has(postId)) {
        updateComments(postId, article);
        return;
      }

      const comments = extractComments(article);
      const postData = {
        id: postId, author, text: postText,
        comments, commentCount: comments.length,
        capturedAt: new Date().toISOString(),
        url: window.location.href
      };

      processedPosts.add(postId);
      sessionSaved++;

      chrome.storage.local.get({ posts: [] }, (data) => {
        if (!data.posts.some(p => p.id === postId)) {
          data.posts.push(postData);
          chrome.storage.local.set({ posts: data.posts });
          refreshStats();
        }
      });

    } catch (e) {}
  });
}

function updateComments(postId, article) {
  const newComments = extractComments(article);
  if (!newComments.length) return;
  chrome.storage.local.get({ posts: [] }, (data) => {
    const idx = data.posts.findIndex(p => p.id === postId);
    if (idx !== -1 && newComments.length > data.posts[idx].commentCount) {
      data.posts[idx].comments = newComments;
      data.posts[idx].commentCount = newComments.length;
      data.posts[idx].updatedAt = new Date().toISOString();
      chrome.storage.local.set({ posts: data.posts });
      refreshStats();
    }
  });
}

const observer = new MutationObserver(() => {
  clearTimeout(window._fbScraperTimeout);
  window._fbScraperTimeout = setTimeout(extractPosts, 800);
});
observer.observe(document.body, { childList: true, subtree: true });
setTimeout(extractPosts, 1500);

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function csvEsc(v) {
  return '"' + String(v || '').replace(/"/g,'""').replace(/\n/g,' ') + '"';
}
function dateStamp() {
  return new Date().toISOString().replace(/[:.]/g,'-').substring(0,19);
}
function downloadFile(blob, filename) {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob), download: filename
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function generateViewerHTML(posts) {
  const total = posts.reduce((a, p) => a + (p.commentCount || 0), 0);
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>FB Scraper – ${posts.length} Posts</title>
<style>*{box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#f0f2f5;margin:0;padding:20px}
h1{color:#1877f2;font-size:20px;margin-bottom:4px}.summary{color:#65676b;font-size:13px;margin-bottom:20px}
.post{background:white;border-radius:10px;padding:16px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,.1)}
.ph{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.pa{font-weight:700;color:#1877f2}.pm{font-size:11px;color:#65676b}
.pt{font-size:14px;line-height:1.5;white-space:pre-wrap;word-break:break-word}
.cs{margin-top:12px;padding-top:12px;border-top:1px solid #e4e6eb}
.ct{font-size:12px;font-weight:700;color:#65676b;margin-bottom:8px}
.c{padding:6px 10px;margin-bottom:6px;background:#f0f2f5;border-radius:16px;font-size:13px}
.c strong{margin-right:6px}</style></head><body>
<h1>📥 FB Group Scraper</h1>
<div class="summary">${posts.length} posts · ${total} comentários · ${new Date().toLocaleString('pt-BR')}</div>
${posts.map(p => `<div class="post">
  <div class="ph"><span class="pa">👤 ${esc(p.author)}</span>
  <span class="pm">${esc(p.capturedAt?.substring(0,19).replace('T',' '))} · ${p.commentCount} comentário(s)</span></div>
  <div class="pt">${esc(p.text)}</div>
  ${p.comments?.length ? `<div class="cs"><div class="ct">💬 Comentários (${p.comments.length})</div>
  ${p.comments.map(c => `<div class="c"><strong>${esc(c.author)}</strong>${esc(c.text)}</div>`).join('')}
  </div>` : ''}
</div>`).join('')}
</body></html>`;
}

// ══════════════════════════════════════════════
// MESSAGES from background
// ══════════════════════════════════════════════

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'TOGGLE_PANEL') {
    if (panelVisible) hidePanel();
    else showPanel();
  }
  if (msg.type === 'GET_COUNT') {
    chrome.storage.local.get({ posts: [] }, (data) => {
      sendResponse({ count: data.posts.length });
    });
    return true;
  }
});
