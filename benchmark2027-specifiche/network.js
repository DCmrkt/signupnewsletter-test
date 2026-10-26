const svg=document.getElementById('background-network');
if(svg){
  const ns='http://www.w3.org/2000/svg',path=svg.querySelector('.network-links'),dots=svg.querySelector('.network-dots');
  const threads=document.createElementNS(ns,'path');threads.setAttribute('class','network-threads');svg.insertBefore(threads,dots);
  const nodes=[],edges=[],fineEdges=[],used=new Set();
  const noise=(x,y)=>{const value=Math.sin(x*127.1+y*311.7)*43758.5453;return value-Math.floor(value);};
  const normal=(a,b)=>Math.sqrt(-2*Math.log(Math.max(.00001,noise(a,b))))*Math.cos(2*Math.PI*noise(b+71,a+29));
  const zones=[{x:1540,y:120,sx:260,sy:160,count:50},{x:200,y:960,sx:300,sy:190,count:62},{x:1420,y:1000,sx:300,sy:140,count:32},{x:120,y:10,sx:320,sy:170,count:24}];
  function add(x,y,seed){
    const circle=document.createElementNS(ns,'circle');circle.setAttribute('r',String(.8+noise(seed,31)*.7));dots.append(circle);
    nodes.push({x:Math.max(-80,Math.min(1880,x)),y:Math.max(-80,Math.min(1180,y)),phase:noise(seed+13,7)*Math.PI*2,circle});
  }
  zones.forEach((zone,z)=>{for(let i=0;i<zone.count;i++)add(zone.x+normal(i+11,z+41)*zone.sx,zone.y+normal(i+93,z+7)*zone.sy,z*100+i);});
  for(let i=0;i<32;i++)add(noise(i+313,17)*1800,noise(i+29,83)*1100,500+i);
  for(let i=0;i<nodes.length;i++){
    const near=nodes.map((node,j)=>({j,d:Math.hypot(node.x-nodes[i].x,node.y-nodes[i].y)})).filter(value=>value.j!==i&&value.d>4).sort((a,b)=>a.d-b.d);
    for(let k=0;k<Math.min(4,near.length);k++){
      const {j,d}=near[k],key=[Math.min(i,j),Math.max(i,j)].join(':');
      if(used.has(key)||d>(k<3?290:410))continue;
      used.add(key);(k<3?edges:fineEdges).push([i,j]);
    }
  }
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let frame,last=0;
  function draw(time){
    const phase=reduced.matches?0:time/10500;
    const positions=nodes.map(node=>({x:node.x+Math.sin(phase+node.phase)*11,y:node.y+Math.cos(phase*.8+node.phase)*9}));
    for(let i=0;i<nodes.length;i++){nodes[i].circle.setAttribute('cx',positions[i].x.toFixed(2));nodes[i].circle.setAttribute('cy',positions[i].y.toFixed(2));}
    const lines=connections=>connections.map(([a,b])=>'M'+positions[a].x.toFixed(2)+' '+positions[a].y.toFixed(2)+'L'+positions[b].x.toFixed(2)+' '+positions[b].y.toFixed(2)).join('');
    path.setAttribute('d',lines(edges));threads.setAttribute('d',lines(fineEdges));
  }
  function animate(time){if(time-last>45){draw(time);last=time;}frame=requestAnimationFrame(animate);}
  function start(){cancelAnimationFrame(frame);draw(0);if(!reduced.matches&&!document.hidden)frame=requestAnimationFrame(animate);}
  reduced.addEventListener('change',start);document.addEventListener('visibilitychange',start);start();
}
