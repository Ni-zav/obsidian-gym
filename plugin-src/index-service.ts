import { inside, tags, modeOf } from "./utils";

export class IndexService {
  [key: string]: any;
  constructor(plugin){ this.plugin=plugin; this.app=plugin.app; this.clear(); }
  clear(){ this.exercises=new Map();this.byExerciseId=new Map();this.byExerciseName=new Map();this.routines=new Map();this.sessions=new Map();this.bySessionId=new Map();this.logs=new Map();this.byWorkout=new Map();this.byLogExerciseId=new Map();this.byLogExerciseName=new Map();this.kind=new Map(); }
  fm(file){ return this.app.metadataCache.getFileCache(file)?.frontmatter||{}; }
  rebuild(){ this.clear(); this.app.vault.getMarkdownFiles().forEach(f=>this.reindex(f)); }
  register(){
    this.plugin.registerEvent(this.app.metadataCache.on("changed",(f,_d,c)=>this.reindex(f,c&&c.frontmatter||{})));
    this.plugin.registerEvent(this.app.vault.on("delete",f=>this.remove(f.path)));
    this.plugin.registerEvent(this.app.vault.on("rename",(f,old)=>{this.remove(old); if(f.extension==="md")this.reindex(f);}));
  }
  addNested(map,key,path,rec){ if(!map.has(key))map.set(key,new Map()); map.get(key).set(path,rec); }
  delNested(map,key,path){ const g=map.get(key); if(!g)return;g.delete(path);if(!g.size)map.delete(key); }
  remove(path){
    const k=this.kind.get(path); if(!k)return;
    if(k==="exercise"){const r=this.exercises.get(path);this.exercises.delete(path);if(r){if(this.byExerciseId.get(r.id)?.file.path===path)this.byExerciseId.delete(r.id);[r.name,r.file.basename,...r.aliases].forEach(n=>{if(this.byExerciseName.get(String(n))?.file.path===path)this.byExerciseName.delete(String(n));});}}
    else if(k==="routine")this.routines.delete(path);
    else if(k==="session"){const r=this.sessions.get(path);this.sessions.delete(path);if(r&&this.bySessionId.get(r.id)?.file.path===path)this.bySessionId.delete(r.id);}
    else if(k==="log"){const r=this.logs.get(path);this.logs.delete(path);if(r){this.delNested(this.byWorkout,r.workoutId,path);if(r.exerciseId)this.delNested(this.byLogExerciseId,r.exerciseId,path);if(r.exerciseName)this.delNested(this.byLogExerciseName,r.exerciseName,path);}}
    this.kind.delete(path);
  }
  reindex(file,known){
    if(!file||file.extension!=="md")return; this.remove(file.path);
    const f=known||this.fm(file), s=this.plugin.settings, ts=tags(f);
    if(inside(file.path,s.exercisesRoot)&&ts.includes("exercise")&&!f.workout_id&&!f.event_type){
      const id=String(f.id||"");if(!id)return;const r={file,fm:f,id,name:String(f.exercise||file.basename),aliases:Array.isArray(f.aliases)?f.aliases.map(String):[],trackingMode:modeOf(f)};
      this.exercises.set(file.path,r);this.byExerciseId.set(id,r);[r.name,file.basename,...r.aliases].forEach(n=>this.byExerciseName.set(String(n),r));this.kind.set(file.path,"exercise");return;
    }
    if(inside(file.path,s.workoutTemplatesRoot)&&ts.includes("workout")){this.routines.set(file.path,{file,fm:f});this.kind.set(file.path,"routine");return;}
    if(inside(file.path,s.workoutsRoot)&&!file.path.includes("/Log/")&&ts.includes("workout")){
      const id=String(f.id||"");if(!id)return;const r={file,fm:f,id};this.sessions.set(file.path,r);this.bySessionId.set(id,r);this.kind.set(file.path,"session");return;
    }
    if(inside(file.path,s.workoutsRoot)&&(file.path.includes("/Log/")||f.workout_id||ts.includes("log"))){
      const wid=String(f.workout_id||"");if(!wid)return;const event=f.event_type||(f.exercise==="Workout start"?"workout_start":f.exercise==="Workout end"?"workout_end":null);
      const r={file,fm:f,id:String(f.id||file.path),workoutId:wid,exerciseId:event?null:(f.exercise_id!=null?String(f.exercise_id):null),exerciseName:event?null:(f.exercise?String(f.exercise):null),eventType:event,performedAt:String(f.performed_at||f.date||"")};
      this.logs.set(file.path,r);this.addNested(this.byWorkout,wid,file.path,r);if(r.exerciseId)this.addNested(this.byLogExerciseId,r.exerciseId,file.path,r);if(r.exerciseName)this.addNested(this.byLogExerciseName,r.exerciseName,file.path,r);this.kind.set(file.path,"log");
    }
  }
  exercisesList(){ return [...this.exercises.values()].sort((a,b)=>a.name.localeCompare(b.name)); }
  exerciseById(id){ return id==null?null:this.byExerciseId.get(String(id))||null; }
  exerciseByName(n){ return n==null?null:this.byExerciseName.get(String(n))||null; }
  routinesList(){ return [...this.routines.values()].sort((a,b)=>String(a.fm.workout_title||a.file.basename).localeCompare(String(b.fm.workout_title||b.file.basename))); }
  sessionsList(){ return [...this.sessions.values()].sort((a,b)=>new Date(b.fm.started_at||b.fm.date||0).getTime()-new Date(a.fm.started_at||a.fm.date||0).getTime()); }
  activeSessions(){ return this.sessionsList().filter(r=>r.fm.status==="active"||(!r.fm.ended_at&&r.fm.started_at)); }
  sessionById(id){ return id==null?null:this.bySessionId.get(String(id))||null; }
  workoutLogs(id,events=true){ return [...(this.byWorkout.get(String(id))?.values()||[])].filter(r=>events||!r.eventType).sort((a,b)=>new Date(a.performedAt||0).getTime()-new Date(b.performedAt||0).getTime()); }
  history(id,name){
    const m=new Map(); if(id!=null)for(const r of this.byLogExerciseId.get(String(id))?.values()||[])m.set(r.file.path,r);
    const def=id!=null?this.exerciseById(id):this.exerciseByName(name), names=[name,...(def?.aliases||[])].filter(Boolean).map(String);
    names.forEach(n=>{for(const r of this.byLogExerciseName.get(n)?.values()||[])m.set(r.file.path,r);});
    return [...m.values()].sort((a,b)=>new Date(a.performedAt||0).getTime()-new Date(b.performedAt||0).getTime());
  }
  latest(id,name){ const h=this.history(id,name);return h.at(-1)||null; }
  allLogs(){ return [...this.logs.values()].filter(r=>!r.eventType).sort((a,b)=>new Date(a.performedAt||0).getTime()-new Date(b.performedAt||0).getTime()); }
}

