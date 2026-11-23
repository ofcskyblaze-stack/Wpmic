const DEFAULTS = { bass:0, lowMid:0, mid:0, highMid:0, treble:0, gain:1, pitch:0, reverb:18 };
const BANDS = [
  {k:'bass', l:'Bass 60Hz', min:-15, max:15, step:0.5},
  {k:'lowMid', l:'Low-Mid 300Hz', min:-15, max:15, step:0.5},
  {k:'mid', l:'Mid 1kHz', min:-15, max:15, step:0.5},
  {k:'highMid', l:'High-Mid 3kHz', min:-15, max:15, step:0.5},
  {k:'treble', l:'Treble 8kHz', min:-15, max:15, step:0.5},
  {k:'gain', l:'Mic Gain', min:0.2, max:2.5, step:0.1},
  {k:'pitch', l:'Pitch Shift', min:-12, max:12, step:1},
  {k:'reverb', l:'Reverb Mix', min:0, max:100, step:1},
];
const container = document.getElementById('sliders');
let state = {...DEFAULTS};

function render(){
  container.innerHTML = '';
  BANDS.forEach(b=>{
    const wrap = document.createElement('div');
    wrap.className = 'card';
    wrap.innerHTML = `
      <div class="label"><span>${b.l}</span><span class="val" id="val-${b.k}">${state[b.k]}</span></div>
      <input type="range" id="${b.k}" min="${b.min}" max="${b.max}" step="${b.step}" value="${state[b.k]}"/>
    `;
    container.appendChild(wrap);
  });
  BANDS.forEach(b=>{
    const el = document.getElementById(b.k);
    el.addEventListener('input', e=>{
      state[b.k] = parseFloat(e.target.value);
      document.getElementById('val-'+b.k).textContent = state[b.k];
      chrome.storage.sync.set(state);
    });
  });
}

chrome.storage.sync.get(DEFAULTS, (res)=>{
  state = {...DEFAULTS, ...res};
  render();
});

document.getElementById('resetBtn').addEventListener('click', ()=>{
  state = {...DEFAULTS};
  chrome.storage.sync.set(state, ()=> render());
  chrome.tabs.query({active:true, currentWindow:true}, tabs=>{
    if(tabs[0]) chrome.tabs.sendMessage(tabs[0].id, {type:'EQ_UPDATE', settings: state});
  });
});

document.getElementById('saveBtn').addEventListener('click', ()=>{
  chrome.storage.sync.set(state, ()=>{
    const btn = document.getElementById('saveBtn');
    btn.textContent = 'Saved ✓';
    setTimeout(()=> btn.textContent = 'Save & Apply', 1200);
  });
  chrome.tabs.query({active:true, currentWindow:true}, tabs=>{
    if(tabs[0]) chrome.tabs.sendMessage(tabs[0].id, {type:'EQ_UPDATE', settings: state});
  });
});
