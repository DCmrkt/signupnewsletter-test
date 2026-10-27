import {sections} from './questions.js';

export async function postGoogleSubmission(submission){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),20000);
  try{
    // Exclude Google login cookies and saved drafts, as on the other questionnaire landings.
    const response=await fetch(submission.action,{
      method:'POST',mode:'no-cors',credentials:'omit',
      body:new URLSearchParams(submission.fields),signal:controller.signal
    });
    if(response.type!=='opaque'&&!response.ok)throw Error('Invio non riuscito. Le risposte restano nel riepilogo.');
    // Opaque responses acknowledge transport only. Verify storage in the owner view during QA.
    return {requestCompleted:true,registrationVerified:false};
  }catch(error){
    if(error.name==='AbortError')throw Error('Il server non ha risposto in tempo. Le risposte restano qui; verifica con il team prima di ripetere un invio che potrebbe essere già arrivato.');
    throw error;
  }finally{clearTimeout(timeout);}
}

export function buildGoogleSubmission(answers,other={}){
  const fields=[['fvv','1'],['pageHistory',sections.map((_,i)=>i).join(',')]];
  for(const q of sections.flatMap(section=>section.questions)){
    const values=answers[q.id]||[];
    if(!Array.isArray(values) || values.some(value=>typeof value!=='string'))throw Error('Risposta non valida: '+q.title);
    const filled=values.filter(value=>value.trim());
    if(q.required && !filled.length)throw Error('Compila: '+q.title);
    if(q.type!==4 && filled.length>1)throw Error('Seleziona una sola risposta: '+q.title);
    if(q.id==='email'){
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(filled[0]||''))throw Error('Inserisci un indirizzo email valido.');
      fields.push(['emailAddress',filled[0]]);continue;
    }
    for(const value of filled){
      const option=q.options.find(option=>option.label===value);
      if(q.options.length && !option)throw Error('Opzione non valida: '+q.title);
      fields.push(['entry.'+q.id,option?.other?'__other_option__':value]);
      if(option?.other){
        if(typeof other[q.id]!=='string' || !other[q.id].trim())throw Error('Specifica la risposta Altro: '+q.title);
        fields.push(['entry.'+q.id+'.other_option_response',other[q.id]]);
      }
    }
    if(q.type===2 || q.type===4)fields.push(['entry.'+q.id+'_sentinel','']);
  }
  return {action:'https://docs.google.com/forms/d/e/1FAIpQLSd8Vz9hgXzW0TqhN1DiXRrXZi-j7A3Vjb6yr4q_0z3sctdR5A/formResponse',fields};
}
