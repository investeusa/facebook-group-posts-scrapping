// =============================================
// FB Group Scraper - content.js
// Captura posts e comentários em tempo real
// =============================================

const processedPosts = new Set();
let isEnabled = true;
let totalSaved = 0;

// ── Utilitários ──────────────────────────────

function cleanText(text) {
  return text ? text.trim().replace(/\s+/g, ' ') : '';
}

function getTimestamp(el) {
  if (!el) return null;
  // Tenta pegar o atributo data-utime ou o title do elemento de tempo
  const abbr = el.querySelector('abbr[data-utime]');
  if (abbr) return new Date(parseInt(abbr.getAttribute('data-utime')) * 1000).toISOString();
  const timeEl = el.querySelector('a[href*="permalink"] span') || el.querySelector('[aria-label]');
  return timeEl?.getAttribute('aria-label') || timeEl?.innerText || null;
}

// ── Extração de Comentários ───────────────────

function extractComments(postEl) {
  const comments = [];

  // Seletores para comentários (Facebook usa estrutura aninhada)
  const commentContainers = postEl.querySelectorAll(
    '[aria-label*="Comentário"], [data-testid*="comment"], ul li[class]'
  );

  // Fallback: pega elementos de comentário por estrutura do DOM
  const allCommentBlocks = postEl.querySelectorAll(
    'div[role="article"] ~ div div[role="article"], ' +
    'div > ul > li, ' +
    '[data-visualcompletion="ignore-dynamic"] div[dir="auto"]'
  );

  // Tentativa principal: busca comentários por padrão de estrutura
  const commentSections = postEl.querySelectorAll('div[aria-label*="comment"], div[aria-label*="comentário"]');

  commentSections.forEach(section => {
    const commentItems = section.querySelectorAll('div[role="article"]');
    commentItems.forEach(item => {
      const authorEl = item.querySelector('a[role="link"] span') || item.querySelector('h3 a') || item.querySelector('strong a');
      const textEl = item.querySelector('div[dir="auto"][style]') || item.querySelector('div[dir="auto"]');
      const timeEl = item.querySelector('a[href*="comment"]') || item.querySelector('abbr');

      const author = cleanText(authorEl?.innerText);
      const text = cleanText(textEl?.innerText);

      if (author && text && text !== author) {
        comments.push({
          author,
          text,
          time: timeEl?.getAttribute('aria-label') || timeEl?.innerText || null
        });
      }
    });
  });

  // Se não achou pelo método acima, tenta método alternativo
  if (comments.length === 0) {
    const liElements = postEl.querySelectorAll('ul > li');
    liElements.forEach(li => {
      const spans = li.querySelectorAll('div[dir="auto"]');
      const linkEl = li.querySelector('a[role="link"] span');
      if (spans.length > 0 && linkEl) {
        const author = cleanText(linkEl.innerText);
        const text = cleanText(spans[spans.length - 1]?.innerText);
        if (author && text && text !== author && text.length > 2) {
          comments.push({ author, text, time: null });
        }
      }
    });
  }

  return comments;
}

// ── Extração de Posts ─────────────────────────

function extractPosts() {
  if (!isEnabled) return;

  // Seletor principal para artigos/posts do Facebook
  const articles = document.querySelectorAll('[role="article"]');

  articles.forEach(article => {
    try {
      // Pula artigos que são comentários (geralmente aninhados dentro de outros artigos)
      const parentArticle = article.parentElement?.closest('[role="article"]');
      if (parentArticle) return;

      // Tenta pegar autor do post
      const authorEl =
        article.querySelector('h2 a strong') ||
        article.querySelector('h2 a') ||
        article.querySelector('a[role="link"] strong') ||
        article.querySelector('strong > span');

      // Texto principal do post
      const textContainers = article.querySelectorAll('div[dir="auto"]');
      let postText = '';

      textContainers.forEach(tc => {
        // Evita pegar texto de comentários (dentro de listas)
        if (!tc.closest('ul') && !tc.closest('[role="article"] [role="article"]')) {
          const t = cleanText(tc.innerText);
          if (t && t.length > postText.length) {
            postText = t;
          }
        }
      });

      const author = cleanText(authorEl?.innerText);

      // Ignora se não tem conteúdo relevante
      if (!postText || postText.length < 5) return;

      // Cria ID único baseado no autor + início do texto
      const postId = `${author}_${postText.substring(0, 80)}`;
      if (processedPosts.has(postId)) return;

      // Extrai comentários
      const comments = extractComments(article);

      // Monta objeto do post
      const postData = {
        id: postId,
        author: author || 'Desconhecido',
        text: postText,
        comments: comments,
        commentCount: comments.length,
        capturedAt: new Date().toISOString(),
        url: window.location.href
      };

      // Salva no storage
      chrome.storage.local.get({ posts: [] }, (data) => {
        // Verifica se já existe post com mesmo ID
        const exists = data.posts.some(p => p.id === postId);
        if (!exists) {
          processedPosts.add(postId);
          data.posts.push(postData);
          chrome.storage.local.set({ posts: data.posts, totalSaved: data.posts.length });
          totalSaved = data.posts.length;

          // Notifica o popup (se aberto)
          chrome.runtime.sendMessage({
            type: 'POST_SAVED',
            count: data.posts.length,
            lastPost: { author: postData.author, commentCount: comments.length }
          }).catch(() => {}); // Ignora se popup não está aberto
        } else {
          // Atualiza comentários se o post já existe mas tem novos comentários
          const idx = data.posts.findIndex(p => p.id === postId);
          if (idx !== -1 && comments.length > data.posts[idx].commentCount) {
            data.posts[idx].comments = comments;
            data.posts[idx].commentCount = comments.length;
            data.posts[idx].updatedAt = new Date().toISOString();
            chrome.storage.local.set({ posts: data.posts });
          }
        }
      });

    } catch (e) {
      console.warn('[FB Scraper] Erro ao processar post:', e);
    }
  });
}

// ── Observer: detecta novos posts carregados ──

const observer = new MutationObserver((mutations) => {
  // Pequeno debounce para não rodar a cada micro-mudança
  clearTimeout(window._fbScraperTimeout);
  window._fbScraperTimeout = setTimeout(extractPosts, 500);
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Roda ao carregar a página
extractPosts();

// ── Mensagens do Popup ────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'TOGGLE') {
    isEnabled = msg.enabled;
    sendResponse({ ok: true });
  }
  if (msg.type === 'GET_COUNT') {
    chrome.storage.local.get({ posts: [] }, (data) => {
      sendResponse({ count: data.posts.length });
    });
    return true; // async
  }
});

console.log('[FB Scraper] Extensão ativa no grupo:', window.location.href);
