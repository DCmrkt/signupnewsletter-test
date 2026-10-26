import {isTrustedBridge} from './submission-state.js';

export function createDeliveryService(config){
  let iframe,channel,peer,peerOrigin,connection;
  const waiting=new Map();
  function connect(){
    if(connection) return connection;
    connection=new Promise((resolve,reject)=>{
      if(!config.enabled || !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(config.backendUrl)) {reject(Error('Il servizio di invio è ancora in attivazione.'));return;}
      channel=crypto.randomUUID();
      iframe=document.createElement('iframe');iframe.hidden=true;iframe.title='Servizio di invio Benchmark 2027';iframe.referrerPolicy='no-referrer';
      const url=new URL(config.backendUrl);url.searchParams.set('channel',channel);iframe.src=url.href;
      let onMessage;
      const timer=setTimeout(()=>{window.removeEventListener('message',onMessage);reject(Error('Il servizio Google non risponde. Nessun invio è stato avviato.'));},25000);
      onMessage=event=>{
        if(!event.data || event.data.channel!==channel || !isTrustedBridge(event.origin,event.source,iframe.contentWindow)) return;
        const message=event.data;
        if(message.type==='benchmark-ready') {peer=event.source;peerOrigin=event.origin;clearTimeout(timer);resolve();return;}
        const pending=waiting.get(message.callId);
        if(!pending || event.source!==peer || event.origin!==peerOrigin) return;
        if(message.type==='benchmark-result') {clearTimeout(pending.timer);waiting.delete(message.callId);pending.resolve(message.result);}
        if(message.type==='benchmark-error') {clearTimeout(pending.timer);waiting.delete(message.callId);pending.reject(Error(message.error||'Il servizio non ha completato la richiesta.'));}
      };
      window.addEventListener('message',onMessage);
      document.body.append(iframe);
    }).catch(error=>{iframe?.remove();connection=null;error.safeToRetry=true;throw error;});
    return connection;
  }
  async function call(type,requestId,payload){
    await connect();
    return new Promise((resolve,reject)=>{
      const callId=crypto.randomUUID();
      const timer=setTimeout(()=>{waiting.delete(callId);reject(Error('Il servizio sta impiegando più tempo del previsto. Verifica lo stato della richiesta.'));},55000);
      waiting.set(callId,{resolve,reject,timer});
      peer.postMessage({type,channel,requestId,callId,payload},peerOrigin);
    });
  }
  return {send:payload=>call('benchmark-submit',payload.requestId,payload),status:requestId=>call('benchmark-status',requestId)};
}
