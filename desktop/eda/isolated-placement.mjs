import {sectionsOf} from './metrics.mjs';
import {cardinalityBadges,bundleBadges} from './cardinality.mjs';

const overlap=(a,b,gap=12)=>a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;
const bounds=nodes=>({left:Math.min(...nodes.map(n=>n.x)),top:Math.min(...nodes.map(n=>n.y)),right:Math.max(...nodes.map(n=>n.x+n.width)),bottom:Math.max(...nodes.map(n=>n.y+n.height))});

// An isolated table is still part of a business domain. Place it near that
// domain without inventing a graph edge, moving connected nodes or rerouting.
// This operates on geometry only; user placement hints always take precedence.
export function placeIsolatedTables(projection,input){
  const touched=new Set(projection.edges.flatMap(e=>[...e.sources,...e.targets]));
  const connected=projection.nodes.filter(n=>n.kind==='table'&&n.ports.some(p=>touched.has(p.id)));
  const isolated=projection.nodes.filter(n=>n.kind==='table'&&!n.placement&&!n.ports.some(p=>touched.has(p.id))).sort((a,b)=>a.id.localeCompare(b.id));
  if(!isolated.length||!connected.length)return input;
  const layout=structuredClone(input),geometry=new Map(layout.children.map(n=>[n.id,n]));
  let changed=false;
  const annotations=[...layout.edges.flatMap(e=>e.labels||[]),
    ...cardinalityBadges({layout,projection}).map(b=>({x:b.x-b.width/2,y:b.y-b.height/2,width:b.width,height:b.height})),
    ...bundleBadges({layout,projection}).map(b=>({x:b.x-32,y:b.y-8,width:64,height:16}))];
  const wires=layout.edges.flatMap(e=>sectionsOf(e).flatMap(points=>points.slice(1).map((b,i)=>({x:Math.min(points[i].x,b.x),y:Math.min(points[i].y,b.y),width:Math.abs(points[i].x-b.x),height:Math.abs(points[i].y-b.y)}))));
  for(const meta of isolated){
    const group=projection.domains.find(g=>g.id!=='__unassigned__'&&g.tableIds.includes(meta.tableId));
    if(!group)continue;
    const peers=connected.filter(n=>group.tableIds.includes(n.tableId)).map(n=>geometry.get(n.id)).filter(Boolean);
    if(!peers.length)continue;
    const node=geometry.get(meta.id),box=bounds(peers),obstacles=[...layout.children.filter(n=>n.id!==node.id),...annotations,...wires];
    const candidates=[];
    for(const peer of peers)for(const gap of [48,80,128]){
      candidates.push({x:peer.x,y:peer.y+peer.height+gap},{x:peer.x,y:peer.y-node.height-gap},
        {x:peer.x+peer.width+gap,y:peer.y},{x:peer.x-node.width-gap,y:peer.y});
    }
    const cost=p=>{
      const extent=bounds([...peers,{...node,...p}]);
      return (extent.right-extent.left)*(extent.bottom-extent.top)+
        Math.abs(p.x+node.width/2-(box.left+box.right)/2)+Math.abs(p.y+node.height/2-(box.top+box.bottom)/2);
    };
    candidates.push({x:node.x,y:node.y});
    const best=candidates.filter(p=>p.x>=40&&p.y>=40&&!obstacles.some(o=>overlap({...node,...p},o)))
      .sort((a,b)=>cost(a)-cost(b)||a.y-b.y||a.x-b.x)[0];
    if(best&&(best.x!==node.x||best.y!==node.y)){Object.assign(node,best);changed=true;}
  }
  if(!changed)return input;
  const extents=[...layout.children,...annotations,...wires];
  layout.width=Math.max(...extents.map(n=>n.x+n.width))+40;
  layout.height=Math.max(...extents.map(n=>n.y+n.height))+40;
  return layout;
}
