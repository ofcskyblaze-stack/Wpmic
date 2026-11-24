const DEFAULT_STATE = {
  enabled: true,
  activeMode: "loud",
  gainSlider: 22,
  loudnessSlider: 194445,
  boostSlider: 152778,
  saturationSlider: 1.5,
  compThreshSlider: -60,
  compRatioSlider: 20,
  limiterSlider: -0.10,
  presenceSlider: 24,
  bassSlider: -13,
  trebleSlider: 18,
  chkAntiDuck: true,
  chkRawMic: true,
  chkReverbKeepAlive: true,
  chkMicKeepAlive: true,
  sustainTargetSlider: 5,
  sustainMaxSlider: 120,
  reverbWetSlider: 0.18,
  keepAliveFloorSlider: 0.00120
};

const SLIDER_IDS = [
  "gainSlider",
  "loudnessSlider",
  "boostSlider",
  "saturationSlider",
  "compThreshSlider",
  "compRatioSlider",
  "limiterSlider",
  "presenceSlider",
  "bassSlider",
  "trebleSlider",
  "sustainTargetSlider",
  "sustainMaxSlider",
  "reverbWetSlider",
  "keepAliveFloorSlider"
];

const CHECK_IDS = [
  "chkAntiDuck",
  "chkRawMic",
  "chkReverbKeepAlive",
  "chkMicKeepAlive"
];

function formatGainLabel(val) {
  const num = Number(val);
  const db = Math.round((num / 100) * 95);
  const mult = Math.max(1, Math.round((num / 100) * 50));
  return `${db} dB / ${mult}x`;
}

function formatSliderValue(id, rawVal) {
  switch (id) {
    case "gainSlider":
      return formatGainLabel(rawVal);
    case "loudnessSlider":
    case "boostSlider":
    case "compThreshSlider":
    case "compRatioSlider":
    case "presenceSlider":
    case "bassSlider":
    case "trebleSlider":
    case "sustainTargetSlider":
    case "sustainMaxSlider":
      return String(Math.round(Number(rawVal)));
    case "saturationSlider":
      return Number(rawVal).toFixed(1);
    case "limiterSlider":
      return Number(rawVal).toFixed(2);
    case "reverbWetSlider":
      return Number(rawVal).toFixed(2);
    case "keepAliveFloorSlider":
      return Number(rawVal).toFixed(5);
    default:
      return String(rawVal);
  }
}

function updateSliderTrack(el) {
  const min = Number(el.min);
  const max = Number(el.max);
  const val = Number(el.value);
  const pct = max === min ? 0 : ((val - min) / (max - min)) * 100;
  el.style.setProperty("--fill", `${Math.max(0, Math.min(100, pct))}%`);
}

function renderState(state) {
  const masterToggle = document.getElementById("masterToggle");
  masterToggle.checked = Boolean(state.enabled);

  const royalBtn = document.getElementById("modeRoyalClear");
  const loudBtn = document.getElementById("modeLoudMic");
  royalBtn.classList.toggle("active", state.activeMode === "royal");
  loudBtn.classList.toggle("active", state.activeMode === "loud");

  for (const id of SLIDER_IDS) {
    const slider = document.getElementById(id);
    const valElId = id.replace("Slider", "Value");
    const valEl = document.getElementById(valElId);
    const val = state[id] !== undefined ? state[id] : DEFAULT_STATE[id];

    slider.value = val;
    if (valEl) {
      valEl.textContent = formatSliderValue(id, val);
    }
    updateSliderTrack(slider);
  }

  for (const id of CHECK_IDS) {
    const btn = document.getElementById(id);
    const isChecked = Boolean(state[id]);
    btn.classList.toggle("checked", isChecked);
    btn.setAttribute("aria-pressed", String(isChecked));
  }
}

function saveState(partial) {
  chrome.storage.local.get(DEFAULT_STATE, (current) => {
    const next = { ...current, ...partial };
    chrome.storage.local.set(next, () => {
      renderState(next);
      notifyWhatsAppTab(next);
    });
  });
}

function notifyWhatsAppTab(state) {
  chrome.tabs.query({ url: "https://web.whatsapp.com/*" }, (tabs) => {
    const hookBanner = document.getElementById("hookStatusBanner");
    if (tabs && tabs.length > 0) {
      hookBanner.textContent = "Hook status: connected — WhatsApp Web tab active";
      for (const tab of tabs) {
        if (tab.id !== undefined) {
          chrome.tabs.sendMessage(tab.id, { type: "STATE_UPDATED", state }, () => {
            void chrome.runtime.lastError;
          });
        }
      }
    } else {
      hookBanner.textContent = "Hook status: waiting — open or reload WhatsApp Web";
    }
  });
}

function applyPreset(mode) {
  if (mode === "royal") {
    saveState({
      activeMode: "royal",
      gainSlider: 14,
      loudnessSlider: 85000,
      boostSlider: 64000,
      saturationSlider: 0.4,
      compThreshSlider: -24,
      compRatioSlider: 6,
      limiterSlider: -1.0,
      presenceSlider: 8,
      bassSlider: -4,
      trebleSlider: 5,
      sustainTargetSlider: -6,
      sustainMaxSlider: 35,
      reverbWetSlider: 0.05,
      keepAliveFloorSlider: 0.0005
    });
  } else {
    saveState({
      activeMode: "loud",
      gainSlider: 22,
      loudnessSlider: 194445,
      boostSlider: 152778,
      saturationSlider: 1.5,
      compThreshSlider: -60,
      compRatioSlider: 20,
      limiterSlider: -0.10,
      presenceSlider: 24,
      bassSlider: -13,
      trebleSlider: 18,
      sustainTargetSlider: 5,
      sustainMaxSlider: 120,
      reverbWetSlider: 0.18,
      keepAliveFloorSlider: 0.00120
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(DEFAULT_STATE, (state) => {
    renderState(state);
    notifyWhatsAppTab(state);
  });

  document.getElementById("closeBtn").addEventListener("click", () => {
    window.close();
  });

  document.getElementById("masterToggle").addEventListener("change", (e) => {
    saveState({ enabled: e.target.checked });
  });

  document.getElementById("modeRoyalClear").addEventListener("click", () => {
    applyPreset("royal");
  });

  document.getElementById("modeLoudMic").addEventListener("click", () => {
    applyPreset("loud");
  });

  for (const id of SLIDER_IDS) {
    const slider = document.getElementById(id);
    slider.addEventListener("input", () => {
      const valEl = document.getElementById(id.replace("Slider", "Value"));
      if (valEl) {
        valEl.textContent = formatSliderValue(id, slider.value);
      }
      updateSliderTrack(slider);
    });
    slider.addEventListener("change", () => {
      saveState({ [id]: Number(slider.value) });
    });
  }

  for (const id of CHECK_IDS) {
    const btn = document.getElementById(id);
    btn.addEventListener("click", () => {
      const nextVal = !btn.classList.contains("checked");
      saveState({ [id]: nextVal });
    });
  }
});
