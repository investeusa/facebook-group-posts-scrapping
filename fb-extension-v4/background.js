// background.js - abre/fecha o painel ao clicar no ícone da extensão
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' });
});
