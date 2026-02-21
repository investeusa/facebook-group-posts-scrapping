# 📥 FB Group Scraper — Posts & Comentários

Extensão do Chrome que captura automaticamente posts e seus comentários enquanto você navega em grupos do Facebook.

## 📁 Arquivos
```
fb-extension/
├── manifest.json   → Configuração da extensão
├── content.js      → Script de captura (roda na página do FB)
├── popup.html      → Interface do popup
├── popup.js        → Lógica do popup
└── README.md       → Este arquivo
```

## 🚀 Como instalar

1. Abra o Chrome e acesse: `chrome://extensions/`
2. Ative o **Modo desenvolvedor** (toggle no canto superior direito)
3. Clique em **"Carregar sem compactação"**
4. Selecione a pasta `fb-extension`
5. A extensão aparecerá na barra do Chrome ✅

## 🎮 Como usar

1. Acesse um grupo no Facebook: `facebook.com/groups/...`
2. Role a página devagar (deixe os posts e comentários carregarem)
3. Clique no ícone da extensão para ver o painel
4. Exporte os dados quando quiser

## 📊 Funcionalidades

- ✅ Captura automática de posts ao rolar a página
- ✅ Captura comentários de cada post
- ✅ Contador em tempo real (posts + comentários)
- ✅ Toggle para pausar/retomar captura
- ✅ Exportação JSON (estruturado)
- ✅ Exportação CSV (para Excel/Google Sheets)
- ✅ Visualizador HTML interativo
- ✅ Evita duplicatas automaticamente
- ✅ Atualiza comentários se novos forem carregados

## 📄 Estrutura dos dados

```json
{
  "id": "NomeAutor_início do texto",
  "author": "Nome do Autor",
  "text": "Texto completo do post",
  "comments": [
    {
      "author": "Nome do Comentarista",
      "text": "Texto do comentário",
      "time": "há 2 horas"
    }
  ],
  "commentCount": 3,
  "capturedAt": "2024-01-15T14:30:00.000Z",
  "url": "https://www.facebook.com/groups/..."
}
```

## ⚠️ Avisos

- Os **seletores CSS** do Facebook podem mudar com atualizações do site
- Use para **uso pessoal** — respeite a privacidade dos membros do grupo
- Role a página **devagar** para garantir que os comentários carreguem
- Para ver comentários, clique em "Ver comentários" nos posts antes de rolar

## 🔧 Ajuste de Seletores

Se a extensão parar de funcionar (Facebook atualizou o layout), edite o `content.js` e ajuste os seletores CSS nas funções `extractPosts()` e `extractComments()`.

Para inspecionar os seletores: clique com botão direito em um post → Inspecionar → identifique os atributos `role`, `dir`, `aria-label`.
