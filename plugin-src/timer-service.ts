export class TimerService {
  [key: string]: any;
  constructor(done){this.done=done;this.listeners=new Set();this.reset();}
  reset(){if(this.handle)clearInterval(this.handle);this.handle=null;this.mode="countdown";this.seconds=0;this.running=false;this.paused=false;this.target=0;this.started=0;this.emit();}
  start(sec){this.reset();sec=Math.max(0,Math.floor(Number(sec)||0));if(!sec)return;this.mode="countdown";this.seconds=sec;this.running=true;this.target=Date.now()+sec*1000;this.tick();}
  stopwatch(){this.reset();this.mode="stopwatch";this.running=true;this.started=Date.now();this.tick();}
  pause(){if(!this.running||this.paused)return;this.sync();clearInterval(this.handle);this.handle=null;this.paused=true;this.emit();}
  resume(){if(!this.paused)return;this.paused=false;if(this.mode==="countdown")this.target=Date.now()+this.seconds*1000;else this.started=Date.now()-this.seconds*1000;this.tick();}
  subscribe(fn){this.listeners.add(fn);fn(this.snapshot());return()=>this.listeners.delete(fn);}
  snapshot(){this.sync();return{mode:this.mode,seconds:this.seconds,running:this.running,paused:this.paused};}
  sync(){if(!this.running||this.paused)return;if(this.mode==="countdown")this.seconds=Math.max(0,Math.ceil((this.target-Date.now())/1000));else this.seconds=Math.max(0,Math.floor((Date.now()-this.started)/1000));}
  tick(){this.sync();this.emit();this.handle=setInterval(()=>{this.sync();this.emit();if(this.mode==="countdown"&&this.running&&!this.paused&&this.seconds<=0){clearInterval(this.handle);this.handle=null;this.running=false;this.done();this.emit();}},250);}
  emit(){const s={mode:this.mode,seconds:this.seconds,running:this.running,paused:this.paused};[...this.listeners].forEach(fn=>fn(s));}
  destroy(){if(this.handle)clearInterval(this.handle);this.listeners.clear();}
}

