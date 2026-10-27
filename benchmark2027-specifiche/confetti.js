let stopPrevious;

export function launchConfetti(origin){
  stopPrevious?.();
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  const canvas=document.createElement('canvas');canvas.className='confetti-canvas';canvas.setAttribute('aria-hidden','true');
  const context=canvas.getContext('2d');if(!context)return;
  const width=window.innerWidth,height=window.innerHeight,ratio=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);context.scale(ratio,ratio);
  const bounds=origin?.getBoundingClientRect();
  const x=bounds?bounds.left+bounds.width/2:width/2,y=bounds?bounds.top:height*.6;
  const colors=['#eea32d','#f4d99c','#344657','#a8d5cf'];
  const particles=Array.from({length:width<600?42:64},()=>({vx:(Math.random()-.5)*650,vy:-230-Math.random()*290,size:4+Math.random()*5,angle:Math.random()*Math.PI,spin:(Math.random()-.5)*10,color:colors[Math.floor(Math.random()*colors.length)]}));
  const started=window.performance.now();let frame,stopped=false;
  function stop(){if(stopped)return;stopped=true;window.cancelAnimationFrame(frame);canvas.remove();window.removeEventListener('pagehide',stop);window.removeEventListener('resize',stop);if(stopPrevious===stop)stopPrevious=undefined;}
  function draw(now){
    if(stopped)return;
    const elapsed=(now-started)/1000;if(elapsed>=2.3){stop();return;}
    context.clearRect(0,0,width,height);context.globalAlpha=Math.min(1,(2.3-elapsed)*1.7);
    for(const particle of particles){context.save();context.translate(x+particle.vx*elapsed,y+particle.vy*elapsed+250*elapsed*elapsed);context.rotate(particle.angle+particle.spin*elapsed);context.fillStyle=particle.color;context.fillRect(-particle.size/2,-particle.size/2,particle.size,particle.size*.55);context.restore();}
    frame=window.requestAnimationFrame(draw);
  }
  stopPrevious=stop;document.body.append(canvas);window.addEventListener('pagehide',stop);window.addEventListener('resize',stop);frame=window.requestAnimationFrame(draw);return stop;
}
