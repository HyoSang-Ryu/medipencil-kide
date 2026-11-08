// Mono PCM16 at 16 kHz in 100 ms frames; no playback.
class RoundLoopPCM extends AudioWorkletProcessor {
 constructor(){super();this.ratio=sampleRate/16000;this.phase=0;this.buffer=[];this.stopped=false;this.port.onmessage=()=>{this.flush();this.stopped=true;this.port.postMessage({flushed:true});};}
 flush(){if(!this.buffer.length)return;const out=new Int16Array(this.buffer.length);for(let i=0;i<out.length;i++){const v=Math.max(-1,Math.min(1,this.buffer[i]));out[i]=v<0?v*32768:v*32767;}this.buffer=[];this.port.postMessage(out.buffer,[out.buffer]);}
 process(inputs){if(this.stopped)return false;const channel=inputs[0]?.[0];if(channel)for(const v of channel){this.phase++;if(this.phase>=this.ratio){this.phase-=this.ratio;this.buffer.push(v);}if(this.buffer.length>=1600)this.flush();}return true;}
}
registerProcessor('roundloop-pcm',RoundLoopPCM);
