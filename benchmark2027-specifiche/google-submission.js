import {sections} from './questions.js';

let deliverySequence=0;

export function postGoogleSubmission(submission,{showConfirmation=false,confirmationContainer}={}){
  const post=document.createElement('form');
  post.method='POST';post.action=submission.action;post.hidden=true;post.acceptCharset='UTF-8';
  let frame;
  if(showConfirmation){post.target='_blank';post.rel='noopener';}
  else{
    frame=document.createElement('iframe');
    frame.name='benchmark-google-delivery-'+(++deliverySequence);
    frame.hidden=!confirmationContainer;frame.title='Conferma del questionario con Google';
    if(!confirmationContainer)frame.setAttribute('aria-hidden','true');
    if(confirmationContainer) {
      const action=new URL(post.action); action.searchParams.set('embedded','true'); post.action=action.href;
    }
    post.target=frame.name;
    // noopener would turn this named target into a new tab. Never infer success from iframe load.
    (confirmationContainer || document.body).append(frame);
  }
  for(const [name,value] of submission.fields){
    const field=document.createElement('input');field.type='hidden';field.name=name;field.value=value;post.append(field);
  }
  try{document.body.append(post);post.submit();}
  catch(error){frame?.remove();throw error;}
  finally{post.remove();}
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
