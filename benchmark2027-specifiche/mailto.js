export const RECIPIENT='mirco.devito@mondadori.it';
export const DEFAULT_SUBJECT='Benchmark 2027 · Questionario completato';
export const DEFAULT_BODY='Ciao Mirco,\n\nho completato e inviato il questionario Benchmark 2027.\n\nLe informazioni sono pronte per la vostra verifica. Resto a disposizione per eventuali chiarimenti.\n\nGrazie!';

export function createMailto(subject,body){
  if(typeof subject!=='string' || !subject.trim() || subject.length>200 || /[\r\n]/.test(subject)) throw Error('Inserisci un oggetto valido, entro 200 caratteri.');
  if(typeof body!=='string' || !body.trim() || body.length>4000) throw Error('Scrivi un messaggio entro 4.000 caratteri.');
  const text=body.replace(/\r\n|\r|\n/g,'\r\n');
  return 'mailto:'+RECIPIENT+'?subject='+encodeURIComponent(subject.trim())+'&body='+encodeURIComponent(text);
}
