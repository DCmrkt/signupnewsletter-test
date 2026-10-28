import {sections} from './questions.js';

const KEY='dc-benchmark2027-progress-v1';
const questions=sections.flatMap(section=>section.questions);
const schema=JSON.stringify(questions.map(q=>[q.id,q.type,q.required,q.options.map(o=>[o.label,!!o.other])]));
const LIFETIME=30*24*60*60*1000;

export function saveProgress(state){
 try{window.localStorage.setItem(KEY,JSON.stringify({...state,schema,expiresAt:Date.now()+LIFETIME}));return {ok:true};}
 catch{return {ok:false};}
}

export function loadProgress(){
 try{
  const raw=window.localStorage.getItem(KEY);if(raw===null)return {};
  const state=JSON.parse(raw);
  if(!state||state.schema!==schema||!Number.isFinite(state.expiresAt))return {error:'invalid'};
  if(state.expiresAt<=Date.now()){window.localStorage.removeItem(KEY);return {expired:true};}
  if(!['draft','uncertain','completed'].includes(state.phase)||typeof state.previouslySubmitted!=='boolean'||!Number.isInteger(state.current)||!Number.isInteger(state.furthest)||state.current<0||state.current>5||state.furthest<state.current||state.furthest>5)return {error:'invalid'};
  if(!state.values||typeof state.values!=='object'||Array.isArray(state.values)||!state.other||typeof state.other!=='object'||Array.isArray(state.other))return {error:'invalid'};
  for(const q of questions){
   const values=state.values[q.id];
   if(!Array.isArray(values)||values.some(value=>typeof value!=='string')||(q.type!==4&&values.length>1))return {error:'invalid'};
   if(q.options.length&&values.some(value=>!q.options.some(option=>option.label===value)))return {error:'invalid'};
   if(state.other[q.id]!==undefined&&typeof state.other[q.id]!=='string')return {error:'invalid'};
  }
  return {state};
 }catch(error){return {error:error instanceof SyntaxError?'invalid':'unavailable'};}
}

export function clearProgress(){
 try{window.localStorage.removeItem(KEY);return {ok:true};}
 catch{return {ok:false};}
}
