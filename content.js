// UI/state sync bridge for WhatsApp Web (audio/voice processing intentionally inactive)
(() => {
  let currentConfig = null;

  function applyConfig(config) {
    currentConfig = config;
  }

  chrome.storage.local.get(null, (items) => {
    if (items && Object.keys(items).length > 0) {
      applyConfig(items);
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === "STATE_UPDATED") {
      applyConfig(message.state);
    }
  });
})();
