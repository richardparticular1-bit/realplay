/* Trajectory rules shared by the browser and deterministic tests. */
(function (root) {
  class JuggleCounter {
    constructor() { this.reset(); }
    reset() {
      this.total = 0; this.streak = 0; this.best = 0; this.events = [];
      this.lastCount = -Infinity; this.clearTrack();
    }
    clearTrack() {
      this.previous = null; this.apex = null; this.falling = false;
      this.contact = null; this.risingFrames = 0;
    }
    missing(t) {
      if (this.previous && t - this.previous.t > 300) this.clearTrack();
      if (t - this.lastCount > 1800) this.streak = 0;
    }
    sample(s, floor, aspect = 1) {
      if (!s || s.confidence < 0.45 || !Number.isFinite(floor)) {
        this.missing(s?.t ?? 0); return null;
      }
      if (s.y + s.r >= floor - 0.008) {
        this.streak = 0; this.clearTrack(); return null;
      }
      let p = this.previous;
      if (p && (s.t <= p.t || s.t - p.t > 300 ||
          Math.hypot((s.x-p.x)*aspect,s.y-p.y) > 0.3)) {
        this.clearTrack(); p = null;
      }
      if (!p) { this.previous = s; this.apex = s.y; return null; }
      const dy = s.y - p.y;
      this.apex = Math.min(this.apex, s.y);
      if (dy > 0.004 && s.y - this.apex > Math.max(0.025,s.r*0.8)) this.falling = true;
      const nearFoot = (s.feet || []).some(f => f.visibility >= 0.6 &&
        Math.hypot((s.x-f.x)*aspect,s.y-f.y) < s.r + 0.07 && s.y <= f.y + s.r*0.5);
      if (this.falling && nearFoot && dy >= -0.004) {
        this.contact = {y:s.y,t:s.t,confidence:s.confidence};
        this.risingFrames = 0;
      }
      let event = null;
      if (this.contact) {
        if (s.t - this.contact.t > 650) { this.contact = null; this.risingFrames = 0; }
        else {
          this.risingFrames = dy < -0.003 ? this.risingFrames + 1 : 0;
          if (this.risingFrames >= 2 && this.contact.y-s.y > Math.max(0.018,s.r*0.5) && s.t-this.lastCount > 240) {
            event = {t:this.contact.t,confidence:Math.min(this.contact.confidence,s.confidence)};
            this.total++; this.streak++; this.best = Math.max(this.best,this.streak);
            this.events.push(event); this.lastCount=s.t;
            this.falling=false; this.contact=null; this.risingFrames=0; this.apex=s.y;
          }
        }
      }
      this.previous=s; return event;
    }
  }
  root.JuggleCounter = JuggleCounter;
  if (typeof module !== 'undefined') module.exports = JuggleCounter;
})(globalThis);
