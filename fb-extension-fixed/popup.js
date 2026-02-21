// =============================================
// FB Group Scraper - popup.js
// =============================================

const statusEl     = document.getElementById('status');
const postCountEl  = document.getElementById('postCount');
const commentCountEl = document.getElementById('commentCount');
const lastPostEl   = document.getElementById('lastPostInfo');
const toggleEl     = document.getElementById('toggleCapture');

function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className = 'status ' + type;
  if (type === 'success') setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'status'; }, 3000);
}

function updateStats() {
  chrome.storage.local.get({ posts: [] }, (data) => {
    const posts = data.posts;
    const totalComments = posts.reduce((acc, p) => acc + (p.commentCount || 0), 0);

    postCountEl.textContent  = posts.length;
    commentCountEl.textContent = totalComments;

    if (posts.length > 0) {
      const last = posts[posts.length - 1];
      lastPostEl.innerHTML = `<strong>${last.author}</strong> — ${last.commentCount} comentário(s)<br>
        <span style="color:#65676b;font-size:11px">${last.text.substring(0, 60)}${last.text.length > 60 ? '...' : ''}</span>`;
    }
  });
}

// Atualiza stats ao abrir
updateStats();

// Escuta mensagens do content.js
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'POST_SAVED') {
    postCountEl.textContent = msg.count;
    if (msg.lastPost) {
      lastPostEl.innerHTML = `<strong>${msg.lastPost.author}</strong> — ${msg.lastPost.commentCount} comentário(s)`;
    }
    updateStats();
  }
});

// Toggle captura
toggleEl.addEventListener('change', () => {
  const enabled = toggleEl.checked;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE', enabled });
  });
  setStatus(enabled ? '✅ Captura ativada' : '⏸️ Captura pausada', 'success');
});

// ── Exportar JSON ─────────────────────────────
document.getElementById('exportJson').addEventListener('click', () => {
  chrome.storage.local.get({ posts: [] }, (data) => {
    if (data.posts.length === 0) { setStatus('Nenhum post para exportar.', 'error'); return; }

    const blob = new Blob([JSON.stringify(data.posts, null, 2)], { type: 'application/json' });
    downloadFile(blob, `fb_posts_${dateStamp()}.json`);
    setStatus(`✅ ${data.posts.length} posts exportados!`, 'success');
  });
});

// ── Exportar CSV ──────────────────────────────
document.getElementById('exportCsv').addEventListener('click', () => {
  chrome.storage.local.get({ posts: [] }, (data) => {
    if (data.posts.length === 0) { setStatus('Nenhum post para exportar.', 'error'); return; }

    const rows = [];
    // Cabeçalho
    rows.push(['post_id', 'autor_post', 'texto_post', 'data_captura', 'url', 'total_comentarios', 'autor_comentario', 'texto_comentario'].join(','));

    data.posts.forEach(post => {
      if (post.comments && post.comments.length > 0) {
        post.comments.forEach(c => {
          rows.push([
            csvEscape(post.id),
            csvEscape(post.author),
            csvEscape(post.text),
            csvEscape(post.capturedAt),
            csvEscape(post.url),
            post.commentCount,
            csvEscape(c.author),
            csvEscape(c.text)
          ].join(','));
        });
      } else {
        rows.push([
          csvEscape(post.id),
          csvEscape(post.author),
          csvEscape(post.text),
          csvEscape(post.capturedAt),
          csvEscape(post.url),
          0, '', ''
        ].join(','));
      }
    });

    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    downloadFile(blob, `fb_posts_${dateStamp()}.csv`);
    setStatus(`✅ CSV exportado!`, 'success');
  });
});

// ── Visualizar Dados ──────────────────────────
document.getElementById('viewData').addEventListener('click', () => {
  chrome.storage.local.get({ posts: [] }, (data) => {
    if (data.posts.length === 0) { setStatus('Nenhum dado ainda.', 'error'); return; }

    // Gera HTML para visualização
    const html = generateViewerHTML(data.posts);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    chrome.tabs.create({ url });
  });
});

// ── Limpar Dados ──────────────────────────────
document.getElementById('clearData').addEventListener('click', () => {
  if (!confirm('Tem certeza? Todos os dados serão apagados.')) return;
  chrome.storage.local.set({ posts: [], totalSaved: 0 }, () => {
    postCountEl.textContent = '0';
    commentCountEl.textContent = '0';
    lastPostEl.textContent = 'Nenhum post ainda...';
    setStatus('🗑️ Dados limpos.', 'success');
  });
});

// ── Helpers ───────────────────────────────────

function csvEscape(val) {
  if (!val) return '""';
  return '"' + String(val).replace(/"/g, '""').replace(/\n/g, ' ') + '"';
}

function dateStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
}

function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function generateViewerHTML(posts) {
  const totalComments = posts.reduce((a, p) => a + (p.commentCount || 0), 0);

  const postsHTML = posts.map(post => `
    <div class="post">
      <div class="post-header">
        <span class="author">👤 ${esc(post.author)}</span>
        <span class="meta">${esc(post.capturedAt?.substring(0,19).replace('T',' '))} · ${post.commentCount} comentário(s)</span>
      </div>
      <div class="post-text">${esc(post.text)}</div>
      ${post.comments && post.comments.length > 0 ? `
        <div class="comments-section">
          <div class="comments-title">💬 Comentários (${post.comments.length})</div>
          ${post.comments.map(c => `
            <div class="comment">
              <strong>${esc(c.author)}</strong>
              <span>${esc(c.text)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>FB Scraper - ${posts.length} Posts</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0f2f5; margin: 0; padding: 20px; }
  h1 { color: #1877f2; font-size: 20px; margin-bottom: 4px; }
  .summary { color: #65676b; font-size: 13px; margin-bottom: 20px; }
  .post { background: white; border-radius: 10px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
  .post-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .author { font-weight: 700; color: #1877f2; }
  .meta { font-size: 11px; color: #65676b; }
  .post-text { font-size: 14px; line-height: 1.5; color: #1c1e21; white-space: pre-wrap; word-break: break-word; }
  .comments-section { margin-top: 12px; padding-top: 12px; border-top: 1px solid #e4e6eb; }
  .comments-title { font-size: 12px; font-weight: 700; color: #65676b; margin-bottom: 8px; }
  .comment { padding: 6px 10px; margin-bottom: 6px; background: #f0f2f5; border-radius: 16px; font-size: 13px; }
  .comment strong { color: #1c1e21; margin-right: 6px; }
  .comment span { color: #1c1e21; }
</style>
</head>
<body>
  <h1>📥 FB Group Scraper</h1>
  <div class="summary">${posts.length} posts · ${totalComments} comentários · Exportado em ${new Date().toLocaleString('pt-BR')}</div>
  ${postsHTML}
</body>
</html>`;
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
