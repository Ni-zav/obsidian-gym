import { moment, normalizePath as obsidianNormalizePath } from "obsidian";

export const FENCE = String.fromCharCode(96).repeat(3);
export const DEFAULTS = {
  exercisesRoot: "Templates/exercises",
  workoutTemplatesRoot: "Templates/Workouts",
  workoutsRoot: "Workouts",
  homeNote: "Home.md",
  openHomeOnStartup: true,
  defaultRestSeconds: 60,
  weightStepKg: 2.5,
  schemaVersion: 3
};

export function norm(v){ if(typeof v!=="string") return ""; return obsidianNormalizePath(v.trim()).replace(/^\/+|\/+$/g,""); }
export function join(){ return [...arguments].filter(Boolean).map((x,i)=>i?String(x).replace(/^\/+|\/+$/g,""):String(x).replace(/\/+$/g,"")).join("/"); }
export function parent(p){ p=norm(p); const i=p.lastIndexOf("/"); return i<0?"":p.slice(0,i); }
export function inside(p,r){ p=norm(p); r=norm(r); return !!(p&&r&&(p===r||p.startsWith(r+"/"))); }
export function tags(f){ const v=f&&f.tags!=null?f.tags:[]; return (Array.isArray(v)?v:[v]).filter(Boolean).map(x=>String(x).replace(/^#/,"")); }
export function num(v){ if(v===""||v==null) return null; const n=Number(v); return Number.isFinite(n)?n:null; }
export function uuid(){ if(globalThis.crypto&&crypto.randomUUID) return crypto.randomUUID(); return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==="x"?r:(r&3|8);return v.toString(16);}); }
export function now(){ return moment().format("YYYY-MM-DDTHH:mm:ss"); }
export function day(){ return moment().format("YYYY-MM-DD"); }
export function modeOf(f){
  const m=f&&f.tracking_mode;
  if(["strength","bodyweight","duration","distance_time"].includes(m)) return m;
  if(f&&(f.distance_km!=null||f.default_distance_km!=null)) return "distance_time";
  if(f&&(f.timed===true||f.timed==="true"||f.duration!=null||f.default_duration_seconds!=null)) return "duration";
  return String(f&&f.equipment||"").toLowerCase().includes("bodyweight")?"bodyweight":"strength";
}
export function planOf(f){
  if(Array.isArray(f&&f.exercise_plan)) return f.exercise_plan.map(x=>({exercise_id:String(x.exercise_id||x.id||""),sets:Math.max(1,Math.floor(Number(x.sets)||1))})).filter(x=>x.exercise_id);
  const ids=Array.isArray(f&&f.exercises)?f.exercises.map(String):[], counts=new Map(), order=[];
  ids.forEach(id=>{if(!counts.has(id))order.push(id);counts.set(id,(counts.get(id)||0)+1);});
  return order.map(id=>({exercise_id:id,sets:counts.get(id)||1}));
}
export function volume(w,r){ return Math.max(0,num(w)||0)*Math.max(0,num(r)||0); }
export function e1rm(w,r){ w=num(w)||0;r=num(r)||0;return w>0&&r>0&&r<37?w*(36/(37-r)):0; }
export function parseLegacy(v){ const n=num(v); if(n!=null)return n; if(typeof v!=="string")return null; const m=[...v.matchAll(/["'](-?\d+(?:\.\d+)?)["']/g)]; return m.length?num(m[m.length-1][1]):null; }
export function formatSeconds(s){ s=Math.max(0,Math.floor(Number(s)||0)); const m=Math.floor(s/60),r=s%60; return String(m).padStart(2,"0")+":"+String(r).padStart(2,"0"); }
export function esc(s){ return String(s==null?"":s); }

