import { FENCE, norm, join, parent, day, now, planOf, tags, uuid, num, modeOf, volume, e1rm } from "./utils";

export class GymService {
  [key: string]: any;
  constructor(plugin,index){this.plugin=plugin;this.app=plugin.app;this.index=index;this.queues=new Map();}
  async ensureFolder(p){let cur="";for(const part of norm(p).split("/").filter(Boolean)){cur=cur?cur+"/"+part:part;if(!this.app.vault.getAbstractFileByPath(cur))await this.app.vault.createFolder(cur);}}
  async update(file,patch,del=[]){const next={...this.index.fm(file),...patch};del.forEach(k=>delete next[k]);await this.app.fileManager.processFrontMatter(file,f=>{del.forEach(k=>delete f[k]);Object.entries(patch).forEach(([k,v])=>v===undefined?delete f[k]:f[k]=v);});this.index.reindex(file,next);}
  async create(path,fm,body){await this.ensureFolder(parent(path));const file=await this.app.vault.create(path,"---\n---\n\n"+(body||"").trim()+"\n");await this.app.fileManager.processFrontMatter(file,f=>Object.assign(f,fm));this.index.reindex(file,fm);return file;}
  sessionFrom(file){if(!file)return null;const f=this.index.fm(file);if(tags(f).includes("workout")&&!file.path.includes("/Log/"))return file;return f.workout_id?this.index.sessionById(f.workout_id)?.file||null:null;}
  remaining(file){
    const f=this.index.fm(file), skipped=new Set((Array.isArray(f.skipped_exercises)?f.skipped_exercises:[]).map(String)), counts=new Map();
    this.index.workoutLogs(f.id,false).forEach(l=>{if(l.exerciseId&&String(l.fm.set_type||"working")!=="warmup")counts.set(l.exerciseId,(counts.get(l.exerciseId)||0)+1);});
    return planOf(f).map(p=>({exercise:this.index.exerciseById(p.exercise_id),...p,completed:counts.get(p.exercise_id)||0,remaining:skipped.has(p.exercise_id)?0:Math.max(0,p.sets-(counts.get(p.exercise_id)||0))})).filter(x=>x.remaining>0);
  }
  async createSession(template){
    const tf=template?this.index.fm(template):{},title=template?String(tf.workout_title||template.basename):"Free Workout",slug=String(template?.basename||title).replace(/[\\/:*?"<>|]/g,"-");
    let folder=join(this.plugin.settings.workoutsRoot,day()+" - "+slug),n=2;while(this.app.vault.getAbstractFileByPath(folder))folder=join(this.plugin.settings.workoutsRoot,day()+" - "+slug+" ("+(n++)+")");
    await this.ensureFolder(join(folder,"Log"));const id=uuid(),started=now();
    const file=await this.create(join(folder,slug+".md"),{schema_version:3,id,workout_title:title,date:day(),started_at:started,ended_at:null,status:"active",exercise_plan:template?planOf(tf):[],skipped_exercises:[],workout_type:template?String(tf.workout_type||""):"Custom",workout_place:template?String(tf.workout_place||""):"",set_count:0,working_set_count:0,exercise_counts:{},total_volume:0,timed_seconds:0,distance_km:0,pr_count:0,duration_minutes:0,cssclasses:["gym-workout"],tags:["workout"]},FENCE+"obsidian-gym-session\n"+FENCE);
    await this.event(file,"workout_start",started);return file;
  }
  async event(file,type,at){return this.queue(file,async()=>this.create(await this.nextLog(file),{schema_version:3,id:uuid(),workout_id:String(this.index.fm(file).id),event_type:type,performed_at:at||now(),tags:["log","event",type==="workout_start"?"start":"end"]},"# "+(type==="workout_start"?"Workout start":"Workout end")));}
  prs(cur,h){
    if(cur.set_type==="warmup"||!h.length)return[];h=h.filter(f=>String(f.set_type||"working")!=="warmup");if(!h.length)return[];const out=[],m=cur.tracking_mode,w=num(cur.weight_kg)||0,r=num(cur.reps)||0;
    if(m==="strength"||m==="bodyweight"){if(w>Math.max(0,...h.map(f=>num(f.weight_kg)||0)))out.push("weight");const same=h.filter(f=>Math.abs((num(f.weight_kg)||0)-w)<.001);if(r>Math.max(0,...same.map(f=>num(f.reps)||0)))out.push("reps_at_weight");if(volume(w,r)>Math.max(0,...h.map(f=>volume(f.weight_kg,f.reps))))out.push("set_volume");if(e1rm(w,r)>Math.max(0,...h.map(f=>e1rm(f.weight_kg,f.reps))))out.push("estimated_1rm");}
    else if(m==="duration"&&(num(cur.duration_seconds)||0)>Math.max(0,...h.map(f=>num(f.duration_seconds??f.duration)||0)))out.push("duration");
    else if(m==="distance_time"){const d=num(cur.distance_km)||0,t=num(cur.duration_seconds)||0;if(d>Math.max(0,...h.map(f=>num(f.distance_km)||0)))out.push("distance");const p=t&&d?t/d:Infinity,ps=h.map(f=>{const hd=num(f.distance_km)||0,ht=num(f.duration_seconds)||0;return hd&&ht?ht/hd:Infinity;}).filter(Number.isFinite);if(ps.length&&p<Math.min(...ps))out.push("pace");}
    return out;
  }
  async refreshExercisePrs(id,name,extraWorkoutIds=[]){
    const records=this.index.history(id,name),prior=[],workouts=new Set(extraWorkoutIds.filter(Boolean).map(String));
    for(const rec of records){
      const x=rec.fm,next=String(x.set_type||"working")==="warmup"?[]:this.prs(x,prior),old=Array.isArray(x.prs)?x.prs:[];
      if(old.length!==next.length||old.some((v,i)=>v!==next[i])){
        await this.update(rec.file,{prs:next});
        if(rec.workoutId)workouts.add(String(rec.workoutId));
      }
      prior.push(x);
    }
    for(const wid of workouts){const s=this.index.sessionById(wid);if(s)await this.recalc(s.file);}
  }
  validateSet(p){
    const mode=modeOf(p);
    if((mode==="strength"||mode==="bodyweight")&&!(num(p.reps)>0))throw new Error("Reps must be greater than 0.");
    if(mode==="duration"&&!(num(p.duration_seconds)>0))throw new Error("Duration must be greater than 0.");
    if(mode==="distance_time"&&(!(num(p.distance_km)>0)||!(num(p.duration_seconds)>0)))throw new Error("Distance and duration must be greater than 0.");
  }
  async log(file,p){
    return this.queue(file,async()=>{this.validateSet(p);const sf=this.index.fm(file);if(sf.status==="completed")throw new Error("Workout is completed.");const h=this.index.history(p.exercise_id,p.exercise).map(x=>x.fm),pr=p.set_type==="warmup"?[]:this.prs(p,h),existing=this.index.workoutLogs(sf.id,false);
      const setIndex=Math.max(0,...existing.map(x=>Number(x.fm.set_index)||0))+1;
      const fm={schema_version:3,id:uuid(),workout_id:String(sf.id),set_index:setIndex,exercise_id:String(p.exercise_id),exercise:p.exercise,performed_at:now(),tracking_mode:p.tracking_mode,set_type:p.set_type,effort:p.effort??null,note:p.note||"",prs:pr,tags:["exercise","log","set"]};
      ["weight_kg","reps","duration_seconds","distance_km"].forEach(k=>{if(p[k]!=null)fm[k]=Number(p[k]);});const log=await this.create(await this.nextLog(file),fm,FENCE+"obsidian-gym-log\n"+FENCE);await this.delta(file,fm,pr);return{file:log,prs:pr};
    });
  }
  async delta(file,l,prs){const f=this.index.fm(file),working=String(l.set_type||"working")!=="warmup",counts={...(f.exercise_counts||{})};if(working)counts[l.exercise]=Number(counts[l.exercise]||0)+1;await this.update(file,{set_count:Number(f.set_count||0)+1,working_set_count:Number(f.working_set_count||0)+(working?1:0),exercise_counts:counts,total_volume:Math.round((Number(f.total_volume||0)+(working?volume(l.weight_kg,l.reps):0))*100)/100,timed_seconds:Number(f.timed_seconds||0)+(working?(num(l.duration_seconds)||0):0),distance_km:Math.round((Number(f.distance_km||0)+(working?(num(l.distance_km)||0):0))*1000)/1000,pr_count:Number(f.pr_count||0)+prs.length});}
  async recalc(file){const f=this.index.fm(file),logs=this.index.workoutLogs(f.id,true),sets=logs.filter(l=>!l.eventType),counts={};let work=0,v=0,t=0,d=0,pr=0;sets.forEach(l=>{const x=l.fm;if(String(x.set_type||"working")!=="warmup"){work++;counts[x.exercise]=Number(counts[x.exercise]||0)+1;v+=volume(x.weight_kg,x.reps);t+=num(x.duration_seconds??x.duration)||0;d+=num(x.distance_km)||0;}pr+=Array.isArray(x.prs)?x.prs.length:0;});const start=logs.find(l=>l.eventType==="workout_start")?.performedAt||f.started_at,end=[...logs].reverse().find(l=>l.eventType==="workout_end")?.performedAt||f.ended_at,dur=start?Math.max(0,Math.round(((end?new Date(end):new Date()).getTime()-new Date(start).getTime())/60000)):0;await this.update(file,{set_count:sets.length,working_set_count:work,exercise_counts:counts,total_volume:Math.round(v*100)/100,timed_seconds:Math.round(t),distance_km:Math.round(d*1000)/1000,pr_count:pr,duration_minutes:dur,status:end?"completed":"active",started_at:start||null,ended_at:end||null},["Logs","ExerciseCounts","ExercisesSummary","Total Volume","timed_load","duration"]); }
  async finish(file){return this.queue(file,async()=>{const f=this.index.fm(file);if(f.status==="completed")return;const end=now();await this.create(await this.nextLog(file),{schema_version:3,id:uuid(),workout_id:String(f.id),event_type:"workout_end",performed_at:end,tags:["log","event","end"]},"# Workout end");await this.update(file,{status:"completed",ended_at:end,duration_minutes:Math.max(0,Math.round((new Date(end).getTime()-new Date(f.started_at||end).getTime())/60000))});});}
  async delSet(file,log){return this.queue(file,async()=>{const x=this.index.fm(log),wid=String(this.index.fm(file).id||"");const p=log.path;await this.app.fileManager.trashFile(log);this.index.remove(p);await this.refreshExercisePrs(x.exercise_id,x.exercise,[wid]);});}
  async editSet(file,log,patch,del=[]){
    return this.queue(file,async()=>{
      const current=this.index.fm(log),next={...current,...patch};del.forEach(k=>delete next[k]);this.validateSet(next);
      const history=this.index.history(next.exercise_id,next.exercise).filter(x=>x.file.path!==log.path).map(x=>x.fm);
      const prs=String(next.set_type||"working")==="warmup"?[]:this.prs(next,history);
      await this.update(log,{...patch,prs},del);await this.refreshExercisePrs(next.exercise_id,next.exercise,[String(this.index.fm(file).id||"")]);
    });
  }
  async undo(file){return this.queue(file,async()=>{const a=this.index.workoutLogs(this.index.fm(file).id,false),l=a.at(-1);if(!l)return false;const x=l.fm,wid=String(this.index.fm(file).id||""),p=l.file.path;await this.app.fileManager.trashFile(l.file);this.index.remove(p);await this.refreshExercisePrs(x.exercise_id,x.exercise,[wid]);return true;});}
  async repeat(file,log){const f=this.index.fm(log),e=this.index.exerciseById(f.exercise_id)||this.index.exerciseByName(f.exercise);if(!e)throw new Error("Exercise not found.");return this.log(file,{exercise_id:e.id,exercise:e.name,tracking_mode:modeOf(f),set_type:f.set_type||"working",weight_kg:num(f.weight_kg),reps:num(f.reps),duration_seconds:num(f.duration_seconds),distance_km:num(f.distance_km),effort:num(f.effort),note:String(f.note||"")});}
  async skip(file,id){return this.queue(file,async()=>{const f=this.index.fm(file),s=new Set((Array.isArray(f.skipped_exercises)?f.skipped_exercises:[]).map(String));s.add(String(id));await this.update(file,{skipped_exercises:[...s]});});}
  async next(file,id){return this.queue(file,async()=>{const f=this.index.fm(file),p=planOf(f),i=p.findIndex(x=>x.exercise_id===String(id));if(i<=0)return;const x=p.splice(i,1)[0];p.unshift(x);await this.update(file,{exercise_plan:p});});}
  async replace(file,from,to){return this.queue(file,async()=>{const f=this.index.fm(file),p=planOf(f),counts=new Map();this.index.workoutLogs(f.id,false).forEach(l=>{if(l.exerciseId&&String(l.fm.set_type||"working")!=="warmup")counts.set(l.exerciseId,(counts.get(l.exerciseId)||0)+1);});const out=[];let n=0;p.forEach(x=>{if(x.exercise_id!==String(from)){out.push(x);return;}const c=Math.min(x.sets,counts.get(x.exercise_id)||0);if(c)out.push({exercise_id:x.exercise_id,sets:c});n+=Math.max(0,x.sets-c);});if(n){const e=out.find(x=>x.exercise_id===String(to));if(e)e.sets+=n;else out.push({exercise_id:String(to),sets:n});}await this.update(file,{exercise_plan:out});});}
  async createExercise(x){const name=x.name.includes(" - ")?x.name:x.muscle+" - "+x.name,path=join(this.plugin.settings.exercisesRoot,x.muscle,name.replace(/[\\/:*?"<>|]/g,"-")+".md");if(this.app.vault.getAbstractFileByPath(path))throw new Error("Exercise already exists.");const f:any={schema_version:3,id:uuid(),exercise:name,muscle_group:x.muscle,equipment:x.equipment,tracking_mode:x.mode,default_rest_seconds:Math.max(0,Number(x.rest??this.plugin.settings.defaultRestSeconds)),instructions:x.instructions||"",aliases:[],tags:["exercise"]};if(x.reps!=null)f.default_reps=Number(x.reps);if(x.weight!=null)f.default_weight_kg=Number(x.weight);if(x.duration!=null)f.default_duration_seconds=Number(x.duration);if(x.distance!=null)f.default_distance_km=Number(x.distance);return this.create(path,f,FENCE+"obsidian-gym-exercise\n"+FENCE);}
  async createRoutine(x){const slug=x.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||("workout-"+uuid().slice(0,8)),path=join(this.plugin.settings.workoutTemplatesRoot,"gym",slug+".md");if(this.app.vault.getAbstractFileByPath(path))throw new Error("Routine already exists.");return this.create(path,{schema_version:3,workout_title:x.name,exercise_plan:x.plan,workout_type:x.type,workout_place:x.place,tags:["workout"]},"# "+x.name+"\n\n"+FENCE+"obsidian-gym-routine\n"+FENCE);}
  async nextLog(file){const folder=join(parent(file.path),"Log");await this.ensureFolder(folder);let n=Math.max(0,...this.index.workoutLogs(this.index.fm(file).id,true).map(x=>Number(x.file.basename)).filter(Number.isFinite))+1;for(;;n++){const p=join(folder,String(n).padStart(3,"0")+".md");if(!this.app.vault.getAbstractFileByPath(p))return p;}}
  async queue(file,fn){const key=String(this.index.fm(file).id||file.path),prev=this.queues.get(key)||Promise.resolve(),next=prev.catch(()=>{}).then(fn),stored=next.then(()=>{},()=>{});this.queues.set(key,stored);try{return await next;}finally{if(this.queues.get(key)===stored)this.queues.delete(key);}}
}

