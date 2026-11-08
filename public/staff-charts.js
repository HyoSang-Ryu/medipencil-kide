/* Accessible charts drawn from recorded values; absent days remain gaps. */
(()=>{
 const rendered=new WeakMap();
 function paint(canvas){
  const data=JSON.parse(canvas.dataset.staffChart),box=canvas.getBoundingClientRect();if(!box.width)return;
  const key=canvas.dataset.staffChart+':'+Math.round(box.width);if(rendered.get(canvas)===key)return;rendered.set(canvas,key);
  const ratio=Math.min(devicePixelRatio||1,2),width=box.width,height=220;canvas.width=width*ratio;canvas.height=height*ratio;
  const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);ctx.clearRect(0,0,width,height);
  const all=data.series.flatMap(s=>s.values).filter(v=>v!=null&&Number.isFinite(v)),left=42,right=12,top=20,bottom=34,w=width-left-right,h=height-top-bottom;
  let min=0,max=data.unit==='%'?100:Math.max(10,...all)*1.15;if(data.type!=='bar'&&all.length){min=Math.max(0,Math.floor(Math.min(...all)/10)*10-10);max=Math.ceil(Math.max(...all)/10)*10+10;}
  if(data.unit==='℃'&&all.length){min=Math.floor(Math.min(...all)*10)/10-.2;max=Math.ceil(Math.max(...all)*10)/10+.2;}
  const barPadding=data.type==='bar'?Math.min(18,w/(Math.max(data.dates.length,1)*2)):0;
  const x=i=>left+barPadding+(data.dates.length>1?i/(data.dates.length-1)*(w-2*barPadding):(w-2*barPadding)/2),y=v=>top+h-(v-min)/(max-min)*h;
  ctx.font='10px Arial,sans-serif';ctx.textAlign='right';ctx.textBaseline='middle';
  for(let i=0;i<5;i++){const yy=top+i*h/4;ctx.strokeStyle='#e7edf3';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(width-right,yy);ctx.stroke();ctx.fillStyle='#718096';ctx.fillText(data.unit==='℃'?(max-i*(max-min)/4).toFixed(1):String(Math.round(max-i*(max-min)/4)),left-8,yy);}
  ctx.textAlign='center';ctx.fillStyle='#718096';const step=Math.max(1,Math.ceil(data.dates.length/7));data.dates.forEach((date,i)=>{if(i%step===0||i===data.dates.length-1)ctx.fillText(date,x(i),height-13);});
  for(const series of data.series){ctx.strokeStyle=series.color;ctx.fillStyle=series.color;ctx.lineWidth=2.5;
   if(data.type==='bar'){const bar=Math.min(30,w/Math.max(data.dates.length,1)*.58);series.values.forEach((value,i)=>{if(value==null)return;const yy=y(value);ctx.globalAlpha=.85;ctx.fillRect(x(i)-bar/2,yy,bar,Math.max(1,top+h-yy));ctx.globalAlpha=1;});}
   else{ctx.beginPath();let connected=false;series.values.forEach((value,i)=>{if(value==null){connected=false;return}if(connected)ctx.lineTo(x(i),y(value));else ctx.moveTo(x(i),y(value));connected=true;});ctx.stroke();series.values.forEach((value,i)=>{if(value==null)return;ctx.beginPath();ctx.arc(x(i),y(value),3.5,0,Math.PI*2);ctx.fill();});}
  }
  if(!all.length){ctx.fillStyle='#647183';ctx.font='13px Arial,sans-serif';ctx.fillText('선택 기간의 기록이 없습니다.',left+w/2,top+h/2);}
 }
 window.MediPencilCharts={draw(root){root.querySelectorAll('canvas[data-staff-chart]').forEach(paint)}};
})();
