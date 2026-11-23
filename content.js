(() => {
  console.log('[WA Mic Studio] injected');
  let eqSettings = { bass:0, lowMid:0, mid:0, highMid:0, treble:0, gain:1, pitch:0, reverb:18 };
  let audioCtx = null;
  let nodes = null;
  let originalStream = null;
  const pitchWorkletCode = "class PitchShiftProcessor extends AudioWorkletProcessor {\n  constructor() {\n    super();\n    this.bufferSize = 8192;\n    this.buffer = new Float32Array(this.bufferSize);\n    this.writePos = 0;\n    this.readPos = 0;\n    this.pitchRatio = 1;\n    this.port.onmessage = (e) => {\n      if (e.data && e.data.pitchRatio) this.pitchRatio = e.data.pitchRatio;\n    };\n  }\n  process(inputs, outputs) {\n    const input = inputs[0];\n    const output = outputs[0];\n    if (!input || !input.length) return true;\n    const inCh = input[0];\n    const outCh = output[0];\n    if (!inCh || !outCh) return true;\n    for (let i = 0; i < inCh.length; i++) {\n      this.buffer[this.writePos] = inCh[i];\n      this.writePos = (this.writePos + 1) % this.bufferSize;\n      const r = this.readPos;\n      const i0 = Math.floor(r);\n      const frac = r - i0;\n      const s0 = this.buffer[i0 % this.bufferSize];\n      const s1 = this.buffer[(i0 + 1) % this.bufferSize];\n      outCh[i] = s0 + (s1 - s0) * frac;\n      this.readPos = (this.readPos + this.pitchRatio) % this.bufferSize;\n      let diff = (this.writePos - this.readPos + this.bufferSize) % this.bufferSize;\n      if (diff < 512) {\n        this.readPos = (this.writePos - 2048 + this.bufferSize) % this.bufferSize;\n      }\n      if (diff > this.bufferSize - 512) {\n        this.readPos = (this.writePos - 2048 + this.bufferSize) % this.bufferSize;\n      }\n    }\n    return true;\n  }\n}\nregisterProcessor('pitch-shift', PitchShiftProcessor);";

  function loadSettings(cb){
    try {
      chrome.storage.sync.get(eqSettings, (r)=>{
        eqSettings = Object.assign({}, eqSettings, r);
        if(cb) cb();
      });
    } catch(e){ if(cb) cb(); }
  }

  function createReverbImpulse(ctx, seconds=2.2, decay=2.5){
    const rate = ctx.sampleRate;
    const len = rate * seconds;
    const impulse = ctx.createBuffer(2, len, rate);
    for(let ch=0; ch<2; ch++){
      const data = impulse.getChannelData(ch);
      for(let i=0;i<len;i++){
        data[i] = (Math.random()*2-1) * Math.pow(1 - i/len, decay);
      }
    }
    return impulse;
  }

  async function ensureWorklet(ctx){
    try {
      const blob = new Blob([pitchWorkletCode], {type:'application/javascript'});
      const url = URL.createObjectURL(blob);
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      return true;
    } catch(e){
      console.warn('[WA Mic Studio] worklet failed', e);
      return false;
    }
  }

  async function buildChain(sourceNode, ctx){
    const bass = ctx.createBiquadFilter(); bass.type='lowshelf'; bass.frequency.value=60; bass.gain.value=eqSettings.bass;
    const lowMid = ctx.createBiquadFilter(); lowMid.type='peaking'; lowMid.frequency.value=300; lowMid.Q.value=1; lowMid.gain.value=eqSettings.lowMid;
    const mid = ctx.createBiquadFilter(); mid.type='peaking'; mid.frequency.value=1000; mid.Q.value=1; mid.gain.value=eqSettings.mid;
    const highMid = ctx.createBiquadFilter(); highMid.type='peaking'; highMid.frequency.value=3000; highMid.Q.value=1; highMid.gain.value=eqSettings.highMid;
    const treble = ctx.createBiquadFilter(); treble.type='highshelf'; treble.frequency.value=8000; treble.gain.value=eqSettings.treble;
    const gain = ctx.createGain(); gain.gain.value = eqSettings.gain;

    let pitchNode = null;
    const pitchRatio = Math.pow(2, eqSettings.pitch/12);
    if (Math.abs(eqSettings.pitch) > 0.1) {
      const ok = await ensureWorklet(ctx);
      if (ok) {
        pitchNode = new AudioWorkletNode(ctx, 'pitch-shift');
        pitchNode.port.postMessage({pitchRatio});
      }
    }

    const convolver = ctx.createConvolver();
    convolver.buffer = createReverbImpulse(ctx);
    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();
    const mix = eqSettings.reverb/100;
    dryGain.gain.value = 1 - mix*0.8;
    wetGain.gain.value = mix;

    // connect EQ
    sourceNode.connect(bass);
    bass.connect(lowMid);
    lowMid.connect(mid);
    mid.connect(highMid);
    highMid.connect(treble);
    treble.connect(gain);

    let last = gain;
    if (pitchNode) { last.connect(pitchNode); last = pitchNode; }

    const dest = ctx.createMediaStreamDestination();

    // dry/wet split for reverb
    last.connect(dryGain);
    dryGain.connect(dest);
    last.connect(convolver);
    convolver.connect(wetGain);
    wetGain.connect(dest);

    nodes = { bass, lowMid, mid, highMid, treble, gain, pitchNode, convolver, dryGain, wetGain, dest, ctx };
    return dest;
  }

  async function createFilteredStream(origStream){
    if (audioCtx) { try{ await audioCtx.close(); }catch{} }
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({sampleRate:48000});
    const source = audioCtx.createMediaStreamSource(origStream);
    const filteredDest = await buildChain(source, audioCtx);
    // keep video tracks if any
    const newStream = filteredDest.stream;
    origStream.getVideoTracks().forEach(t=> newStream.addTrack(t));
    originalStream = origStream;
    return newStream;
  }

  function updateLiveNodes(){
    if(!nodes) return;
    nodes.bass.gain.value = eqSettings.bass;
    nodes.lowMid.gain.value = eqSettings.lowMid;
    nodes.mid.gain.value = eqSettings.mid;
    nodes.highMid.gain.value = eqSettings.highMid;
    nodes.treble.gain.value = eqSettings.treble;
    nodes.gain.gain.value = eqSettings.gain;
    const mix = eqSettings.reverb/100;
    nodes.dryGain.gain.value = 1 - mix*0.8;
    nodes.wetGain.gain.value = mix;
    if(nodes.pitchNode){
      nodes.pitchNode.port.postMessage({pitchRatio: Math.pow(2, eqSettings.pitch/12)});
    }
  }

  // intercept getUserMedia
  const origGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices.getUserMedia);
  navigator.mediaDevices.getUserMedia = async function(constraints){
    const stream = await origGUM(constraints);
    if(constraints && constraints.audio){
      try{
        const isWA = location.hostname.includes('whatsapp.com');
        if(isWA){
          const filtered = await createFilteredStream(stream);
          console.log('[WA Mic Studio] mic filtered', eqSettings);
          return filtered;
        }
      } catch(e){ console.warn('[WA Mic Studio] filter fail', e); }
    }
    return stream;
  };

  // listen for popup updates
  try{
    chrome.runtime.onMessage.addListener((msg)=>{
      if(msg && msg.type==='EQ_UPDATE' && msg.settings){
        eqSettings = Object.assign({}, eqSettings, msg.settings);
        updateLiveNodes();
      }
    });
    chrome.storage.onChanged.addListener((changes)=>{
      let changed=false;
      for(const k in changes){ if(k in eqSettings){ eqSettings[k]=changes[k].newValue; changed=true; } }
      if(changed) updateLiveNodes();
    });
  }catch(e){}

  loadSettings();
})();
