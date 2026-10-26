export function isTrustedBridge(origin,source,frameWindow){
  try{
    const url=new URL(origin);
    if(url.protocol!=='https:' || !(url.hostname==='script.google.com' || url.hostname==='script.googleusercontent.com' || url.hostname.endsWith('-script.googleusercontent.com'))) return false;
    for(let level=0;source && level<4;level++){
      if(source===frameWindow) return true;
      if(source===source.parent) break;
      source=source.parent;
    }
  }catch{}
  return false;
}
export function deliveryView(result={}){
  if(result.status==='sent' && result.formSaved===true && result.mailAccepted===true) return {success:true,freeze:true,retry:false,check:false,message:'Google ha registrato le risposte e ha accettato il messaggio per l’invio a Mirco.'};
  if(result.status==='rejected' && result.safeToEdit===true && result.formSaved===false) return {success:false,freeze:false,retry:true,check:false,message:(result.message || 'Controlla i dati e riprova.')+' Nessun invio è stato avviato.'};
  if(result.status==='not_saved') return {success:false,freeze:false,retry:true,check:false,message:'Le risposte non sono state trasmesse a Google. Puoi riprovare.'};
  if(result.status==='busy') return {success:false,freeze:true,retry:true,check:false,message:'Il servizio sta elaborando un invio. Attendi qualche secondo e riprova: conserveremo lo stesso riferimento e lo stesso contenuto.'};
  if(['mail_pending','saved'].includes(result.status) && result.formSaved) return {success:false,freeze:true,retry:true,check:false,message:'Le risposte sono registrate. La mail è in attesa: puoi riprovare la sola notifica, senza reinviare il questionario.'};
  if(result.status==='mail_unknown' || result.status==='sending') return {success:false,freeze:true,retry:false,check:true,message:'Le risposte sono registrate, ma l’esito dell’email è da verificare. Non ripetere l’invio: controlla lo stato o comunica il riferimento al team.'};
  return {success:false,freeze:true,retry:false,check:true,message:'L’esito della richiesta è da verificare. Controlla lo stato prima di ripetere l’invio e conserva il riferimento mostrato sotto.'};
}
