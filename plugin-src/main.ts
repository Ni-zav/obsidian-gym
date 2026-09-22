import { Plugin, PluginSettingTab, Setting, Notice, TFile, moment } from "obsidian";
import { DEFAULTS, FENCE, norm, join, parent, inside, tags, num, uuid, now, day, modeOf, planOf, volume, e1rm, parseLegacy, formatSeconds, esc } from "./utils";
import { IndexService } from "./index-service";
import { TimerService } from "./timer-service";
import { GymService } from "./gym-service";
import { Choice, LogModal, EditModal, ExerciseModal, RoutineModal, metricText, button, table } from "./ui";

class SettingsTab extends PluginSettingTab {
  [key: string]: any;
  constructor(plugin){super(plugin.app,plugin);this.p=plugin;}
  display(){const c=this.containerEl;c.empty();c.createEl("h2",{text:"Obsidian Gym"});
    const text=(name,desc,key)=>new Setting(c).setName(name).setDesc(desc).addText(t=>t.setValue(String(this.p.settings[key])).onChange(async v=>{if(["exercisesRoot","workoutTemplatesRoot","workoutsRoot"].includes(key)&&!this.p.settings.previousPaths)this.p.settings.previousPaths={exercisesRoot:this.p.settings.exercisesRoot,workoutTemplatesRoot:this.p.settings.workoutTemplatesRoot,workoutsRoot:this.p.settings.workoutsRoot};this.p.settings[key]=norm(v)||DEFAULTS[key];await this.p.saveSettings();this.p.index.rebuild();}));
    text("Exercises root","Exercise definitions and category JSON.","exercisesRoot");text("Workout templates root","Saved routines.","workoutTemplatesRoot");text("Workouts root","Generated sessions and logs.","workoutsRoot");text("Home note","Note opened by Gym: Open home.","homeNote");
    new Setting(c).setName("Open home on startup").addToggle(t=>t.setValue(!!this.p.settings.openHomeOnStartup).onChange(async v=>{this.p.settings.openHomeOnStartup=v;await this.p.saveSettings();}));
    new Setting(c).setName("Default rest seconds").addText(t=>t.setValue(String(this.p.settings.defaultRestSeconds)).onChange(async v=>{this.p.settings.defaultRestSeconds=Math.max(0,Number(v)||0);await this.p.saveSettings();}));
    new Setting(c).setName("Weight adjustment step").addText(t=>t.setValue(String(this.p.settings.weightStepKg)).onChange(async v=>{this.p.settings.weightStepKg=Math.max(.1,Number(v)||2.5);await this.p.saveSettings();}));
    new Setting(c).setName("Path migration").setDesc("Move existing files from the previously saved roots into the current roots.").addButton(b=>b.setButtonText("Preview").onClick(()=>this.p.previewPathMigration())).addButton(b=>b.setButtonText("Migrate").setDestructive().onClick(()=>this.p.migratePaths()));
    new Setting(c).setName("Data migration").setDesc("Creates a vault backup before rewriting legacy gym metadata to schema v3.").addButton(b=>b.setButtonText("Migrate to v3").setDestructive().onClick(()=>this.p.migrateV3()));
  }
}

export default class ObsidianGym extends Plugin {
  [key: string]: any;
  settings:any;
  async onload(){
    await this.loadSettings();this.index=new IndexService(this);this.gym=new GymService(this,this.index);this.timer=new TimerService(()=>new Notice("Rest finished"));this.addSettingTab(new SettingsTab(this));
    this.registerCommands();this.registerRenderers();
    this.app.workspace.onLayoutReady(()=>{this.index.rebuild();this.index.register();if(this.settings.openHomeOnStartup)this.openHome();});
  }
  onunload(){this.timer.destroy();}
  async loadSettings(){const raw=await this.loadData()||{};this.settings={...DEFAULTS,...raw,exercisesRoot:norm(raw.exercisesRoot||DEFAULTS.exercisesRoot),workoutTemplatesRoot:norm(raw.workoutTemplatesRoot||DEFAULTS.workoutTemplatesRoot),workoutsRoot:norm(raw.workoutsRoot||DEFAULTS.workoutsRoot)};}
  async saveSettings(){await this.saveData(this.settings);}
  async openHome(){const p=norm(this.settings.homeNote);const file=this.app.vault.getAbstractFileByPath(p.endsWith(".md")?p:p+".md");if(file instanceof TFile)await this.app.workspace.getLeaf(false).openFile(file);}
  activeWorkout(){return this.gym.sessionFrom(this.app.workspace.getActiveFile());}
  registerCommands(){
    this.addCommand({id:"open-home",name:"Open home",callback:()=>this.openHome()});
    this.addCommand({id:"start-workout",name:"Start workout",callback:()=>this.chooseRoutine()});
    this.addCommand({id:"start-free-workout",name:"Start free workout",callback:async()=>this.app.workspace.getLeaf(false).openFile(await this.gym.createSession(null))});
    this.addCommand({id:"log-set",name:"Log set",checkCallback:checking=>{const f=this.activeWorkout();if(!f)return false;if(!checking)new LogModal(this,f).open();return true;}});
    this.addCommand({id:"create-exercise",name:"Create exercise",callback:()=>new ExerciseModal(this).open()});
    this.addCommand({id:"create-routine",name:"Create routine",callback:()=>new RoutineModal(this).open()});
    this.addCommand({id:"finish-workout",name:"Finish active workout",checkCallback:checking=>{const f=this.activeWorkout();if(!f)return false;if(!checking)this.gym.finish(f).then(()=>new Notice("Workout finished"));return true;}});
    this.addCommand({id:"undo-last-set",name:"Undo last set",checkCallback:checking=>{const f=this.activeWorkout();if(!f)return false;if(!checking)this.gym.undo(f).then(ok=>new Notice(ok?"Last set removed":"No set to undo"));return true;}});
    this.addCommand({id:"recalculate-all",name:"Recalculate all workout metrics",callback:async()=>{for(const s of this.index.sessionsList())await this.gym.recalc(s.file);new Notice("Workout metrics rebuilt");}});
    this.addCommand({id:"audit-data",name:"Audit gym data",callback:()=>this.audit()});
    this.addCommand({id:"migrate-schema-v3",name:"Migrate gym data to schema v3",callback:()=>this.migrateV3()});
    this.addCommand({id:"preview-path-migration",name:"Preview gym path migration",callback:()=>this.previewPathMigration()});
    this.addCommand({id:"migrate-paths",name:"Migrate gym paths",callback:()=>this.migratePaths()});
  }
  chooseRoutine(){new Choice(this.app,this.index.routinesList(),"Start workout",async r=>this.app.workspace.getLeaf(false).openFile(await this.gym.createSession(r.file)),r=>String(r.fm.workout_title||r.file.basename)).open();}
  registerRenderers(){
    const reg=(lang,fn)=>this.registerMarkdownCodeBlockProcessor(lang,(_src,el,ctx)=>fn.call(this,el,ctx.sourcePath));
    reg("obsidian-gym-home",this.renderHome);reg("obsidian-gym-create",this.renderCreate);reg("obsidian-gym-session",this.renderSession);reg("obsidian-gym-exercise",this.renderExercise);reg("obsidian-gym-analytics",this.renderAnalytics);reg("obsidian-gym-recovery",this.renderRecovery);reg("obsidian-gym-routine",this.renderRoutine);reg("obsidian-gym-log",this.renderLog);
    this.registerMarkdownCodeBlockProcessor("dataviewjs",(src,el,ctx)=>{const lower=String(src||"").toLowerCase(),legacyGym=lower.includes("customjs")&&(lower.includes("workout")||lower.includes("exercise")||lower.includes("stats")||lower.includes("timer"));if(!legacyGym){const pre=el.createEl("pre"),code=pre.createEl("code");code.setText(src);return;}const f=this.app.vault.getAbstractFileByPath(ctx.sourcePath);if(!(f instanceof TFile))return;const fm=this.index.fm(f);if(ctx.sourcePath==="Home.md")return this.renderHome(el,ctx.sourcePath);if(ctx.sourcePath==="Data Visualization.md")return this.renderAnalytics(el,ctx.sourcePath);if(ctx.sourcePath==="Recovery.md")return this.renderRecovery(el,ctx.sourcePath);if(tags(fm).includes("workout")&&inside(f.path,this.settings.workoutsRoot)&&!f.path.includes("/Log/"))return this.renderSession(el,ctx.sourcePath);if(tags(fm).includes("exercise")&&!fm.workout_id)return this.renderExercise(el,ctx.sourcePath);const pre=el.createEl("pre"),code=pre.createEl("code");code.setText(src);});
  }
  fileAt(path){const f=this.app.vault.getAbstractFileByPath(path);return f instanceof TFile?f:null;}
  renderCreate(el){el.empty();const a=el.createDiv({cls:"gym-actions"});button(a,"＋ Add exercise",()=>new ExerciseModal(this).open(),true);button(a,"＋ Create routine",()=>new RoutineModal(this).open(),true);}
  renderHome(el,_path=null){
    el.empty();const active=this.index.activeSessions(),actions=el.createDiv({cls:"gym-actions"});if(active.length)button(actions,"▶ Resume "+String(active[0].fm.workout_title||active[0].file.basename),()=>this.app.workspace.getLeaf(false).openFile(active[0].file),true);else button(actions,"▶ Start workout",()=>this.chooseRoutine(),true);button(actions,"＋ Free workout",async()=>this.app.workspace.getLeaf(false).openFile(await this.gym.createSession(null)));button(actions,"＋ Exercise",()=>new ExerciseModal(this).open());button(actions,"＋ Routine",()=>new RoutineModal(this).open());
    const sessions=this.index.sessionsList(),week=Date.now()-7*86400000,recentWeek=sessions.filter(s=>new Date(s.fm.started_at||s.fm.date||0).getTime()>=week);el.createEl("h3",{text:"This week"});table(el,["Sessions","Working sets","Volume","Time"],[[recentWeek.length,recentWeek.reduce((a,s)=>a+Number(s.fm.working_set_count||0),0),Math.round(recentWeek.reduce((a,s)=>a+Number(s.fm.total_volume||s.fm["Total Volume"]||0),0))+" kg×reps",recentWeek.reduce((a,s)=>a+Number(s.fm.duration_minutes||0),0)+" min"]]);el.createEl("h3",{text:"Recent"});table(el,["Workout","Date","Sets","Volume"],sessions.slice(0,5).map(s=>[s.fm.workout_title||s.file.basename,s.fm.date||"",s.fm.working_set_count||0,Math.round(Number(s.fm.total_volume||s.fm["Total Volume"]||0))]));
  }
  renderTimer(root){const box=root.createDiv({cls:"gym-timer"}),display=box.createDiv({cls:"gym-timer-display"}),controls=box.createDiv({cls:"gym-actions"});[30,60,90,120].forEach(s=>button(controls,s+"s",()=>this.timer.start(s)));button(controls,"Stopwatch",()=>this.timer.stopwatch());button(controls,"Pause / resume",()=>{const s=this.timer.snapshot();s.paused?this.timer.resume():this.timer.pause();});button(controls,"Reset",()=>this.timer.reset());let unsubscribe=()=>{};const update=s=>{if(!display.isConnected){unsubscribe();return;}display.setText((s.mode==="stopwatch"?"Stopwatch ":"Rest ")+formatSeconds(s.seconds));};unsubscribe=this.timer.subscribe(update);}
  renderSession(el,path){
    const file=this.fileAt(path);if(!file)return;const draw=()=>{el.empty();const f=this.index.fm(file);el.createEl("h2",{text:String(f.workout_title||file.basename)});el.createEl("p",{text:[f.status,f.workout_type,f.workout_place].filter(Boolean).join(" · "),cls:"gym-muted"});const a=el.createDiv({cls:"gym-actions"});if(f.status!=="completed"){button(a,"Log set",()=>new LogModal(this,file).open(),true);button(a,"Undo",async()=>{await this.gym.undo(file);draw();});button(a,"Finish",async()=>{await this.gym.finish(file);draw();});}this.renderTimer(el);const remaining=this.gym.remaining(file);el.createEl("h3",{text:"Remaining"});if(!remaining.length)el.createEl("p",{text:planOf(f).length?"All planned sets complete.":"Free workout — choose any exercise."});else remaining.forEach(x=>{const row=el.createDiv({cls:"gym-set-row"});row.createSpan({text:(x.exercise?.name||x.exercise_id)+" · "+x.completed+"/"+x.sets+" · "+x.remaining+" left"});button(row,"Next",async()=>{await this.gym.next(file,x.exercise_id);draw();});button(row,"Skip",async()=>{await this.gym.skip(file,x.exercise_id);draw();});button(row,"Replace",()=>new Choice(this.app,this.index.exercisesList(),"Replace with",async e=>{await this.gym.replace(file,x.exercise_id,e.id);draw();},e=>e.name).open());});const logs=this.index.workoutLogs(f.id,false).slice().reverse();el.createEl("h3",{text:"Sets"});logs.slice(0,30).forEach(l=>{const row=el.createDiv({cls:"gym-set-row"});row.createSpan({text:String(l.fm.exercise||"")+" · "+metricText(l.fm)+(l.fm.set_type&&l.fm.set_type!=="working"?" · "+l.fm.set_type:"")});button(row,"↻",async()=>{await this.gym.repeat(file,l.file);draw();});button(row,"Edit",()=>new EditModal(this,file,l.file,draw).open());button(row,"×",async()=>{await this.gym.delSet(file,l.file);draw();});});};
    draw();
  }
  renderExercise(el,path){
    const file=this.fileAt(path);if(!file)return;const f=this.index.fm(file),e=this.index.exerciseById(f.id)||this.index.exerciseByName(f.exercise),h=this.index.history(e?.id,f.exercise),working=h.filter(x=>String(x.fm.set_type||"working")!=="warmup");el.empty();if(f.instructions){el.createEl("h3",{text:"Instructions"});el.createEl("p",{text:String(f.instructions)});}if(!working.length)return;const last=working.at(-1)?.fm||{},week=Date.now()-7*86400000,bestW=Math.max(0,...working.map(x=>num(x.fm.weight_kg)||0)),bestR=Math.max(0,...working.map(x=>num(x.fm.reps)||0)),best1=Math.max(0,...working.map(x=>e1rm(x.fm.weight_kg,x.fm.reps)));el.createEl("h3",{text:"Progress"});table(el,["Last","Best weight","Best reps","Est. 1RM","Sets 7d"],[[metricText(last),bestW?bestW+" kg":"—",bestR||"—",best1?best1.toFixed(1)+" kg":"—",working.filter(x=>new Date(x.performedAt).getTime()>=week).length]]);el.createEl("h3",{text:"Recent"});table(el,["When","Set","Type","Effort"],working.slice(-10).reverse().map(x=>[(moment as any)(x.performedAt).format("YYYY-MM-DD HH:mm"),metricText(x.fm),x.fm.set_type||"working",x.fm.effort??"—"]));
  }
  spark(root,title,values,labels){
    root.createEl("h3",{text:title});if(values.length<2){root.createEl("p",{text:"Not enough data.",cls:"gym-muted"});return;}const w=640,h=180,p=18,max=Math.max(...values,1),min=Math.min(...values,0),range=Math.max(1,max-min),svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox","0 0 "+w+" "+h);svg.classList.add("gym-chart");const pts=values.map((v,i)=>{const x=p+(w-2*p)*(i/(values.length-1)),y=h-p-(h-2*p)*((v-min)/range);return x+","+y;}).join(" ");const line=document.createElementNS(svg.namespaceURI,"polyline");line.setAttribute("points",pts);line.setAttribute("fill","none");line.setAttribute("stroke","currentColor");line.setAttribute("stroke-width","2");svg.appendChild(line);root.appendChild(svg);root.createEl("small",{text:(labels[0]||"")+" → "+(labels.at(-1)||""),cls:"gym-muted"});
  }
  renderAnalytics(el,_path=null){
    el.empty();const s=[...this.index.sessionsList()].reverse(),dates=s.map(x=>String(x.fm.date||"")),vol=s.map(x=>Number(x.fm.total_volume||x.fm["Total Volume"]||0)),dur=s.map(x=>Number(x.fm.duration_minutes||0));this.spark(el,"Training volume",vol,dates);this.spark(el,"Workout duration",dur,dates);el.createEl("h3",{text:"Recent sessions"});table(el,["Workout","Date","Sets","Volume","Duration"],s.slice(-12).reverse().map(x=>[x.fm.workout_title||x.file.basename,x.fm.date||"",x.fm.working_set_count||0,Math.round(Number(x.fm.total_volume||x.fm["Total Volume"]||0)),Number(x.fm.duration_minutes||0)+" min"]));
  }
  renderRecovery(el,_path=null){
    el.empty();el.createEl("p",{text:"Time since each muscle group was last logged. This is a history cue, not a physiological readiness score.",cls:"gym-muted"});const last=new Map();this.index.allLogs().forEach(l=>{const e=this.index.exerciseById(l.exerciseId)||this.index.exerciseByName(l.exerciseName),g=e?.fm.muscle_group;if(!g)return;const t=new Date(l.performedAt).getTime();if(!last.has(g)||t>last.get(g))last.set(g,t);});const grid=el.createDiv({cls:"gym-recovery-grid"});[...new Set(this.index.exercisesList().map(e=>e.fm.muscle_group).filter(Boolean))].sort().forEach(g=>{const card=grid.createDiv({cls:"gym-recovery-card"});card.createEl("strong",{text:String(g)});const t=last.get(g);card.createEl("div",{text:t?(moment as any)(t).fromNow():"No logged training",cls:"gym-muted"});if(t){const track=card.createDiv({cls:"gym-recovery-track"}),bar=track.createDiv({cls:"gym-recovery-bar"});bar.style.width=Math.min(100,Math.round((Date.now()-t)/(48*3600000)*100))+"%";}});
  }
  renderRoutine(el,path){const f=this.fileAt(path);if(!f)return;const fm=this.index.fm(f);el.empty();button(el,"Start this workout",async()=>this.app.workspace.getLeaf(false).openFile(await this.gym.createSession(f)),true);table(el,["Exercise","Sets"],planOf(fm).map(p=>[this.index.exerciseById(p.exercise_id)?.name||p.exercise_id,p.sets]));}
  renderLog(el,path){const f=this.fileAt(path);if(!f)return;const fm=this.index.fm(f);el.empty();el.createEl("p",{text:metricText(fm)+(fm.effort!=null?" · effort "+fm.effort+"/5":"")});if(fm.note)el.createEl("p",{text:String(fm.note)});}
  async audit(){
    this.index.rebuild();const missing=[],dup=new Map(),broken=[];this.index.exercisesList().forEach(e=>{if(!e.id)missing.push(e.file.path);const a=dup.get(e.id)||[];a.push(e.file.path);dup.set(e.id,a);});this.index.routinesList().forEach(r=>planOf(r.fm).forEach(p=>{if(!this.index.exerciseById(p.exercise_id))broken.push(r.file.path+" → "+p.exercise_id);}));
    const lines=["# Obsidian Gym Audit","","Generated: "+new Date().toLocaleString(),"","- Exercises: "+this.index.exercisesList().length,"- Routines: "+this.index.routinesList().length,"- Sessions: "+this.index.sessionsList().length,"- Missing exercise IDs: "+missing.length,"- Duplicate exercise IDs: "+[...dup.values()].filter(x=>x.length>1).length,"- Broken routine references: "+broken.length,"","## Broken references",...(broken.length?broken.map(x=>"- "+x):["- None"])];
    const p="Obsidian Gym Audit.md",old=this.app.vault.getAbstractFileByPath(p);if(old instanceof TFile)await this.app.vault.process(old,()=>lines.join("\n"));else await this.app.vault.create(p,lines.join("\n"));new Notice("Gym audit written to "+p);
  }
  async replaceLegacyBody(file,lang){
    await this.app.vault.process(file,raw=>{
      if(!raw.includes(FENCE+"dataviewjs")&&!raw.includes("~~~dataviewjs"))return raw;
      const backtickPattern=new RegExp(FENCE+"dataviewjs[\\s\\S]*?"+FENCE,"g");
      const tildePattern=/~~~dataviewjs[\s\S]*?~~~/g;
      const cleaned=raw.replace(backtickPattern,"").replace(tildePattern,"").trimEnd();
      return cleaned+"\n\n"+FENCE+lang+"\n"+FENCE+"\n";
    });
  }
  async previewPathMigration(){
    const old=this.settings.previousPaths;
    if(!old){new Notice("No previous paths are pending migration.");return;}
    const maps=[[old.exercisesRoot,this.settings.exercisesRoot],[old.workoutTemplatesRoot,this.settings.workoutTemplatesRoot],[old.workoutsRoot,this.settings.workoutsRoot]].filter(x=>x[0]&&x[1]&&norm(x[0])!==norm(x[1]));
    let move=0,conflict=0;
    for(const [from,to] of maps){
      for(const file of this.app.vault.getFiles().filter(f=>inside(f.path,from))){
        let rel=file.path.slice(norm(from).length);if(rel.startsWith("/"))rel=rel.slice(1);
        const target=join(to,rel);
        this.app.vault.getAbstractFileByPath(target)?conflict++:move++;
      }
    }
    new Notice("Path migration: "+move+" movable, "+conflict+" conflicts.",10000);
  }
  async migratePaths(){
    const old=this.settings.previousPaths;
    if(!old){new Notice("No previous paths are pending migration.");return;}
    const maps=[[old.exercisesRoot,this.settings.exercisesRoot],[old.workoutTemplatesRoot,this.settings.workoutTemplatesRoot],[old.workoutsRoot,this.settings.workoutsRoot]]
      .filter(x=>x[0]&&x[1]&&norm(x[0])!==norm(x[1]))
      .sort((a,b)=>String(b[0]).length-String(a[0]).length);
    let moved=0,conflicts=0;
    for(const [from,to] of maps){
      const files=this.app.vault.getFiles().filter(f=>inside(f.path,from)).sort((a,b)=>a.path.length-b.path.length);
      for(const file of files){
        let rel=file.path.slice(norm(from).length);if(rel.startsWith("/"))rel=rel.slice(1);
        const target=join(to,rel);
        if(this.app.vault.getAbstractFileByPath(target)){conflicts++;continue;}
        await this.gym.ensureFolder(parent(target));
        await this.app.fileManager.renameFile(file,target);
        moved++;
      }
    }
    for(const bp of ["Exercises List.base","Workouts List.base","Workouts History.base"]){
      const file=this.app.vault.getAbstractFileByPath(bp);
      if(!(file instanceof TFile))continue;
      await this.app.vault.process(file,raw=>{maps.forEach(([from,to])=>{raw=raw.split(String(from)).join(String(to));});return raw;});
    }
    this.settings.previousPaths=null;
    await this.saveSettings();
    this.index.rebuild();
    new Notice("Path migration complete: "+moved+" moved, "+conflicts+" conflicts.",10000);
  }
  async migrateV3(){
    const stamp=(moment as any)().format("YYYYMMDD-HHmmss"),backup=join("Gym Migration Backups",stamp);await this.gym.ensureFolder(backup);const files=this.app.vault.getMarkdownFiles().filter(f=>inside(f.path,this.settings.exercisesRoot)||inside(f.path,this.settings.workoutTemplatesRoot)||inside(f.path,this.settings.workoutsRoot));
    let changed=0;for(const file of files){const f=this.index.fm(file);if(Number(f.schema_version||0)>=3)continue;const rel=file.path.replace(/^\/+/,"");const bp=join(backup,rel);await this.gym.ensureFolder(parent(bp));try{await this.app.vault.copy(file,bp);}catch{}
      if(inside(file.path,this.settings.exercisesRoot)&&tags(f).includes("exercise")&&!f.workout_id){const patch:any={schema_version:3,tracking_mode:modeOf(f),default_rest_seconds:num(f.default_rest_seconds)??this.settings.defaultRestSeconds};const dr=parseLegacy(f.default_reps??f.reps),dw=parseLegacy(f.default_weight_kg??f.weight),dd=parseLegacy(f.default_duration_seconds??f.duration);if(dr!=null)patch.default_reps=dr;if(dw!=null)patch.default_weight_kg=dw;if(dd!=null)patch.default_duration_seconds=dd;await this.gym.update(file,patch,["date","time","weight","reps","effort","timed","duration"]);await this.replaceLegacyBody(file,"obsidian-gym-exercise");changed++;}
      else if(inside(file.path,this.settings.workoutTemplatesRoot)&&tags(f).includes("workout")){await this.gym.update(file,{schema_version:3,exercise_plan:planOf(f)},["exercises","workout_order"]);await this.replaceLegacyBody(file,"obsidian-gym-routine");changed++;}
      else if(inside(file.path,this.settings.workoutsRoot)&&file.path.includes("/Log/")){const event=f.event_type||(f.exercise==="Workout start"?"workout_start":f.exercise==="Workout end"?"workout_end":null),patch:any={schema_version:3,performed_at:f.performed_at||f.date||now()};if(event)patch.event_type=event;else{patch.tracking_mode=modeOf(f);patch.set_type=f.set_type||"working";if(f.weight_kg==null&&num(f.weight)!=null)patch.weight_kg=num(f.weight);if(f.duration_seconds==null&&num(f.duration)!=null)patch.duration_seconds=num(f.duration);}await this.gym.update(file,patch,["weight","duration","date"]);await this.replaceLegacyBody(file,"obsidian-gym-log");changed++;}
      else if(inside(file.path,this.settings.workoutsRoot)&&tags(f).includes("workout")){await this.gym.update(file,{schema_version:3,exercise_plan:planOf(f)},["exercises","workout_order"]);await this.gym.recalc(file);await this.replaceLegacyBody(file,"obsidian-gym-session");changed++;}
    }
    this.settings.schemaVersion=3;await this.saveSettings();this.index.rebuild();new Notice("Migrated "+changed+" gym files. Backup: "+backup,10000);
  }
}
