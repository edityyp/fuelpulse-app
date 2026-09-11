// Web Audio API tactile feedback helper
export const soundFx = {
  playBeep(freq = 800, dur = 0.08) {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
      // audio context muted or restricted by browser gesture
    }
  },
  playTap() {
    this.playBeep(700, 0.04);
  },
  playScan() {
    this.playBeep(920, 0.06);
    setTimeout(() => this.playBeep(1180, 0.08), 60);
  },
  playSuccess() {
    this.playBeep(520, 0.08);
    setTimeout(() => this.playBeep(1040, 0.16), 80);
  },
};
