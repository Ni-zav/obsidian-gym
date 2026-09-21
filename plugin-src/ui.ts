import { Modal, FuzzySuggestModal, Notice, TFile } from "obsidian";
import { join, num, modeOf } from "./utils";

export class Choice extends FuzzySuggestModal {
  [key: string]: any;
  constructor(app,items,label,onChoose,text){super(app);this.items=items;this.label=label;this.cb=onChoose;this.text=text||((x)=>String(x));this.setPlaceholder(label);}
  getItems(){return this.items;} getItemText(x){return this.text(x);} onChooseItem(x){this.cb(x);}
}

export function field(root,label,value,type){
  const wrap=root.createDiv({cls:"gym-field"});wrap.createEl("label",{text:label});const input=type==="textarea"?wrap.createEl("textarea"):wrap.createEl("input",{attr:{type:type||"text"}});input.value=value==null?"":String(value);return input;
}
export function selectField(root,label,values,current){
  const wrap=root.createDiv({cls:"gym-field"});wrap.createEl("label",{text:label});const s=wrap.createEl("select");values.forEach(v=>{const o=s.createEl("option",{text:String(v)});o.value=String(v);if(String(v)===String(current))o.selected=true;});return s;
}

export class LogModal extends Modal {
  [key: string]: any;
  constructor(plugin,file,pre){super(plugin.app);this.p=plugin;this.file=file;this.pre=pre;}
  onOpen(){this.render();}
  render(){
    const c=this.contentEl;c.empty();c.createEl("h2",{text:"Log set"});const ex=this.p.index.exercisesList(),remaining=this.p.gym.remaining(this.file),first=this.pre||remaining[0]?.exercise||ex[0];if(!first){c.createEl("p",{text:"No exercises in library."});return;}
    const exSel=selectField(c,"Exercise",ex.map(x=>x.name),first.name),typeSel=selectField(c,"Set type",["working","warmup","drop","failure"],"working");
    const previous=c.createDiv({cls:"gym-previous"}),metrics=c.createDiv();const effort=selectField(c,"Effort",["","1","2","3","4","5"],""),note=field(c,"Note","","textarea");
    let controls={};
    const build=()=>{
      metrics.empty();previous.empty();const e=ex.find(x=>x.name===exSel.value)||first,last=this.p.index.latest(e.id,e.name)?.fm||{},mode=e.trackingMode;previous.createEl("small",{text:last.exercise?"Previous: "+metricText(last):"No previous set"});
      controls={exercise:e};
      if(mode==="strength"||mode==="bodyweight"){
        const w=field(metrics,"Weight (kg)",last.weight_kg??e.fm.default_weight_kg??"","number"),r=field(metrics,"Reps",last.reps??e.fm.default_reps??"","number");controls.weight=w;controls.reps=r;
        const row=metrics.createDiv({cls:"gym-quick-row"});[-this.p.settings.weightStepKg,0,this.p.settings.weightStepKg].forEach(delta=>{const b=row.createEl("button",{text:delta===0?"Same":(delta>0?"+":"")+delta+" kg"});b.onclick=()=>{const base=num(last.weight_kg)??num(w.value)??0;w.value=String(Math.max(0,base+delta));};});
        ["-1","+1"].forEach(x=>{const b=row.createEl("button",{text:x+" rep"});b.onclick=()=>{r.value=String(Math.max(1,(num(r.value)||num(last.reps)||0)+(x==="+1"?1:-1)));};});
      } else if(mode==="duration"){controls.duration=field(metrics,"Duration (seconds)",last.duration_seconds??e.fm.default_duration_seconds??30,"number");if(e.fm.default_weight_kg!=null)controls.weight=field(metrics,"Weight (kg)",last.weight_kg??e.fm.default_weight_kg,"number");}
      else {controls.distance=field(metrics,"Distance (km)",last.distance_km??e.fm.default_distance_km??"","number");controls.duration=field(metrics,"Duration (seconds)",last.duration_seconds??e.fm.default_duration_seconds??"","number");}
    };
    exSel.onchange=build;build();
    const actions=c.createDiv({cls:"gym-actions"}),cancel=actions.createEl("button",{text:"Cancel"}),save=actions.createEl("button",{text:"Log set",cls:"mod-cta"});cancel.onclick=()=>this.close();
    save.onclick=async()=>{try{const e=controls.exercise,p={exercise_id:e.id,exercise:e.name,tracking_mode:e.trackingMode,set_type:typeSel.value,weight_kg:controls.weight?num(controls.weight.value):null,reps:controls.reps?num(controls.reps.value):null,duration_seconds:controls.duration?num(controls.duration.value):null,distance_km:controls.distance?num(controls.distance.value):null,effort:num(effort.value),note:note.value.trim()};if((e.trackingMode==="strength"||e.trackingMode==="bodyweight")&&!(p.reps>0))throw new Error("Reps must be greater than 0.");if(e.trackingMode==="duration"&&!(p.duration_seconds>0))throw new Error("Duration must be greater than 0.");if(e.trackingMode==="distance_time"&&(!(p.distance_km>0)||!(p.duration_seconds>0)))throw new Error("Distance and duration must be greater than 0.");const result=await this.p.gym.log(this.file,p);const rest=Math.max(0,num(e.fm.default_rest_seconds)??this.p.settings.defaultRestSeconds);if(rest)this.p.timer.start(rest);new Notice("Logged "+e.name+(result.prs.length?" · PR: "+result.prs.join(", "):""));this.close();}catch(e){new Notice("Could not log set: "+e.message);}};
  }
}

export class EditModal extends Modal {
  [key: string]: any;
  constructor(plugin,workout,log,onDone){super(plugin.app);this.p=plugin;this.workout=workout;this.log=log;this.onDone=onDone;}
  onOpen(){const c=this.contentEl,f=this.p.index.fm(this.log),m=modeOf(f);c.empty();c.createEl("h2",{text:"Edit set"});const type=selectField(c,"Set type",["working","warmup","drop","failure"],f.set_type||"working"),effort=selectField(c,"Effort",["","1","2","3","4","5"],f.effort??""),note=field(c,"Note",f.note||"","textarea"),controls={};
    if(m==="strength"||m==="bodyweight"){controls.weight=field(c,"Weight (kg)",f.weight_kg??"","number");controls.reps=field(c,"Reps",f.reps??"","number");}
    else if(m==="duration"){controls.duration=field(c,"Duration (seconds)",f.duration_seconds??f.duration??"","number");if(f.weight_kg!=null)controls.weight=field(c,"Weight (kg)",f.weight_kg,"number");}
    else{controls.distance=field(c,"Distance (km)",f.distance_km??"","number");controls.duration=field(c,"Duration (seconds)",f.duration_seconds??"","number");}
    const a=c.createDiv({cls:"gym-actions"});a.createEl("button",{text:"Cancel"}).onclick=()=>this.close();a.createEl("button",{text:"Save",cls:"mod-cta"}).onclick=async()=>{await this.p.gym.update(this.log,{set_type:type.value,effort:num(effort.value),note:note.value.trim(),weight_kg:controls.weight?num(controls.weight.value):undefined,reps:controls.reps?num(controls.reps.value):undefined,duration_seconds:controls.duration?num(controls.duration.value):undefined,distance_km:controls.distance?num(controls.distance.value):undefined},["weight","duration","date"]);await this.p.gym.recalc(this.workout);this.close();if(this.onDone)this.onDone();};
  }
}

export class ExerciseModal extends Modal {
  [key: string]: any;
  constructor(plugin){super(plugin.app);this.p=plugin;}
  async onOpen(){const c=this.contentEl;c.empty();c.createEl("h2",{text:"Add exercise"});let cats={muscleGroups:["Others"],equipment:["Bodyweight"]};try{const cf=this.app.vault.getAbstractFileByPath(join(this.p.settings.exercisesRoot,"_library/categories.json"));if(cf instanceof TFile){const a=JSON.parse(await this.app.vault.cachedRead(cf));cats={muscleGroups:Object.values(a.muscleGroups||{}).map(x=>x.name),equipment:a.equipment||[]};}}catch{}
    const name=field(c,"Name",""),muscle=selectField(c,"Muscle group",cats.muscleGroups,"Others"),equipment=selectField(c,"Equipment",cats.equipment,"Bodyweight"),mode=selectField(c,"Tracking",["strength","bodyweight","duration","distance_time"],"strength"),defaults=c.createDiv(),rest=field(c,"Rest seconds",this.p.settings.defaultRestSeconds,"number"),instructions=field(c,"Instructions","","textarea");let d={};
    const rebuild=()=>{defaults.empty();d={};if(mode.value==="strength"||mode.value==="bodyweight"){d.weight=field(defaults,"Default weight kg","","number");d.reps=field(defaults,"Default reps",8,"number");}else if(mode.value==="duration")d.duration=field(defaults,"Default duration seconds",30,"number");else{d.distance=field(defaults,"Default distance km","","number");d.duration=field(defaults,"Default duration seconds","","number");}};mode.onchange=rebuild;rebuild();
    const a=c.createDiv({cls:"gym-actions"}),save=a.createEl("button",{text:"Create",cls:"mod-cta"});a.createEl("button",{text:"Cancel"}).onclick=()=>this.close();save.onclick=async()=>{try{if(!name.value.trim())throw new Error("Exercise name is required.");if(!muscle.value)throw new Error("Muscle group is required.");const f=await this.p.gym.createExercise({name:name.value.trim(),muscle:muscle.value,equipment:equipment.value,mode:mode.value,weight:d.weight?num(d.weight.value):null,reps:d.reps?num(d.reps.value):null,duration:d.duration?num(d.duration.value):null,distance:d.distance?num(d.distance.value):null,rest:num(rest.value),instructions:instructions.value.trim()});this.close();await this.app.workspace.getLeaf(false).openFile(f);}catch(e){new Notice(e.message);}};
  }
}

export class RoutineModal extends Modal {
  [key: string]: any;
  constructor(plugin){super(plugin.app);this.p=plugin;this.rows=[];}
  onOpen(){const c=this.contentEl;c.empty();c.createEl("h2",{text:"Create routine"});const name=field(c,"Name",""),type=field(c,"Workout type","Weight Training"),place=field(c,"Place","Gym"),list=c.createDiv({cls:"gym-routine-editor"});
    const draw=()=>{list.empty();this.rows.forEach((r,i)=>{const row=list.createDiv({cls:"gym-routine-row"});row.createSpan({text:r.exercise.name});const sets=row.createEl("input",{attr:{type:"number",min:"1"}});sets.value=String(r.sets);sets.onchange=()=>r.sets=Math.max(1,Number(sets.value)||1);row.createEl("button",{text:"↑"}).onclick=()=>{if(i){[this.rows[i-1],this.rows[i]]=[this.rows[i],this.rows[i-1]];draw();}};row.createEl("button",{text:"↓"}).onclick=()=>{if(i<this.rows.length-1){[this.rows[i+1],this.rows[i]]=[this.rows[i],this.rows[i+1]];draw();}};row.createEl("button",{text:"×"}).onclick=()=>{this.rows.splice(i,1);draw();};});};
    c.createEl("button",{text:"＋ Add exercise"}).onclick=()=>new Choice(this.app,this.p.index.exercisesList(),"Choose exercise",e=>{const found=this.rows.find(r=>r.exercise.id===e.id);if(found)found.sets++;else this.rows.push({exercise:e,sets:3});draw();},e=>e.name).open();draw();
    const a=c.createDiv({cls:"gym-actions"});a.createEl("button",{text:"Cancel"}).onclick=()=>this.close();a.createEl("button",{text:"Save routine",cls:"mod-cta"}).onclick=async()=>{try{if(!name.value.trim()||!this.rows.length)throw new Error("Name and at least one exercise are required.");const f=await this.p.gym.createRoutine({name:name.value.trim(),type:type.value.trim(),place:place.value.trim(),plan:this.rows.map(r=>({exercise_id:r.exercise.id,sets:r.sets}))});this.close();await this.app.workspace.getLeaf(false).openFile(f);}catch(e){new Notice(e.message);}};
  }
}

export function metricText(f){
  const m=modeOf(f);if(m==="strength"||m==="bodyweight")return (f.weight_kg!=null?f.weight_kg+" kg × ":"")+String(f.reps??"—");
  if(m==="duration")return String(f.duration_seconds??f.duration??"—")+" sec";
  return String(f.distance_km??"—")+" km · "+String(f.duration_seconds??"—")+" sec";
}
export function button(root,text,fn,cta){const b=root.createEl("button",{text,cls:cta?"mod-cta":""});b.onclick=async()=>{b.disabled=true;try{await fn();}finally{b.disabled=false;}};return b;}
export function table(root,headers,rows){const t=root.createEl("table",{cls:"gym-table"}),h=t.createEl("thead").createEl("tr");headers.forEach(x=>h.createEl("th",{text:x}));const body=t.createEl("tbody");rows.forEach(r=>{const tr=body.createEl("tr");r.forEach(x=>{const td=tr.createEl("td");if(x instanceof Node)td.appendChild(x);else td.setText(String(x??""));});});return t;}

