export function sectionsOf(edge){return (edge.sections||[]).map(s=>[s.startPoint,...(s.bendPoints||[]),s.endPoint]);}
export function scoreLayout(layout, projection){
  const meta=new Map(projection.edges.map(e=>[e.id,e]));
  const segments=[];let bends=0;
  for(const e of layout.edges||[])for(const path of sectionsOf(e)){
    bends+=Math.max(0,path.length-2);
    for(let i=1;i<path.length;i++)segments.push({a:path[i-1],b:path[i],nets:meta.get(e.id)?.netIds||[],id:e.id});
  }
  const cross=new Set();
  for(let i=0;i<segments.length;i++)for(let j=0;j<i;j++){
    const a=segments[i],b=segments[j];if(a.nets.some(n=>b.nets.includes(n)))continue;
    const ah=Math.abs(a.a.y-a.b.y)<.01,bh=Math.abs(b.a.y-b.b.y)<.01;if(ah===bh)continue;
    const h=ah?a:b,v=ah?b:a,x=v.a.x,y=h.a.y;
    if(x>Math.min(h.a.x,h.b.x)+.1&&x<Math.max(h.a.x,h.b.x)-.1&&y>Math.min(v.a.y,v.b.y)+.1&&y<Math.max(v.a.y,v.b.y)-.1)
      cross.add(`${x.toFixed(2)}:${y.toFixed(2)}:${[h.nets.join(),v.nets.join()].sort().join('|')}`);
  }
  const nodes=layout.children||[];let overlaps=0;
  for(let i=0;i<nodes.length;i++)for(let j=0;j<i;j++){const a=nodes[i],b=nodes[j];
    if(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y)overlaps++;}
  // Shared collinear segments of the same net count once in bus length.
  const lanes=new Map();
  for(const s of segments){const horizontal=Math.abs(s.a.y-s.b.y)<.01;
    const key=JSON.stringify([s.nets.slice().sort(),horizontal,horizontal?s.a.y:s.a.x]);
    const interval=horizontal?[s.a.x,s.b.x]:[s.a.y,s.b.y];interval.sort((a,b)=>a-b);
    if(!lanes.has(key))lanes.set(key,[]);lanes.get(key).push(interval);}
  let length=0;
  for(const spans of lanes.values()){spans.sort((a,b)=>a[0]-b[0]);let start=spans[0][0],end=spans[0][1];
    for(const [a,b]of spans.slice(1)){if(a<=end+.01)end=Math.max(end,b);else{length+=end-start;start=a;end=b;}}length+=end-start;}
  return {crossings:cross.size,overlaps,length:Math.round(length),bends};
}
export function compareScores(a,b){for(const key of ['crossings','overlaps','length','bends'])if(a[key]!==b[key])return a[key]-b[key];return 0;}

export function validateLayout(layout, projection){
  const ids=new Set((layout.children||[]).map(n=>n.id));
  if(ids.size!==projection.nodes.length)throw new Error('布局结果缺失节点');
  for(const n of layout.children||[])if(![n.x,n.y,n.width,n.height].every(Number.isFinite))throw new Error('布局坐标无效');
  if((layout.edges||[]).length!==projection.edges.length)throw new Error('布局结果缺失关系');
  for(const e of layout.edges||[]){if(!e.sections?.length)throw new Error('布局结果缺失布线路径');
    for(const p of sectionsOf(e))for(let i=1;i<p.length;i++)if(![p[i].x,p[i].y].every(Number.isFinite)||
      Math.abs(p[i].x-p[i-1].x)>.01&&Math.abs(p[i].y-p[i-1].y)>.01)throw new Error('收到非正交路径');}
}
