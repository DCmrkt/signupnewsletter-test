const svg=document.getElementById('background-network');
if(svg){
  const ns='http://www.w3.org/2000/svg',path=svg.querySelector('.network-links'),dots=svg.querySelector('.network-dots');
  const nodes=[],edges=[],columns=13,rows=9;
  const noise=(x,y)=>{const value=Math.sin(x*127.1+y*311.7)*43758.5453;return value-Math.floor(value);};
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const circle=document.createElementNS(ns,'circle');circle.setAttribute('r','2');dots.append(circle);
    nodes.push({x:col*150+(noise(col,row)-.5)*88,y:row*137.5+(noise(row+20,col)-.5)*74,phase:noise(col+13,row+7)*Math.PI*2,circle});
    const index=row*columns+col;
    if(col)edges.push([index,index-1]);
    if(row)edges.push([index,index-columns]);
    if(row&&col&&noise(col+5,row)>.45)edges.push([index,index-columns-1]);
  }
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let frame,last=0;
  function draw(time){
    const phase=reduced.matches?0:time/8500;
    const positions=nodes.map(node=>({x:node.x+Math.sin(phase+node.phase)*15,y:node.y+Math.cos(phase*.8+node.phase)*12}));
    for(let i=0;i<nodes.length;i++){nodes[i].circle.setAttribute('cx',positions[i].x.toFixed(1));nodes[i].circle.setAttribute('cy',positions[i].y.toFixed(1));}
    path.setAttribute('d',edges.map(([a,b])=>'M'+positions[a].x.toFixed(1)+' '+positions[a].y.toFixed(1)+'L'+positions[b].x.toFixed(1)+' '+positions[b].y.toFixed(1)).join(''));
  }
  function animate(time){if(time-last>45){draw(time);last=time;}frame=requestAnimationFrame(animate);}
  function start(){cancelAnimationFrame(frame);draw(0);if(!reduced.matches&&!document.hidden)frame=requestAnimationFrame(animate);}
  reduced.addEventListener('change',start);document.addEventListener('visibilitychange',start);start();
}
