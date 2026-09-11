import { projectModel } from './model.mjs';
import { scoreLayout, compareScores, validateLayout, sectionsOf } from './metrics.mjs';

export async function arrangeSchematic(model, options={}, elk){
  // Node tests use the bundled fake worker; the desktop worker injects a real
  // ELK API worker. Loading elk.bundled inside WorkerGlobalScope is invalid.
  if(!elk){const {default:ELK}=await import('elkjs/lib/elk.bundled.js');elk=new ELK();}
  if(model.tables.length>5000||model.relationships.length>20000)throw new Error('输入规模超过当前保护上限，请拆分模型');
  let projection=projectModel(model,options);
  if(!projection.nodes.length)return {projection,layout:{children:[],edges:[],width:800,height:500},metrics:{crossings:0,overlaps:0,length:0,bends:0},candidates:[]};
  async function candidates(p){
    if(p.nodes.length>1500||p.edges.length>6000)throw new Error('当前视图过大，请先选择更小的领域');
    const results=[];
    for(const [direction,seed]of [['RIGHT',11],['RIGHT',37],['DOWN',11],['DOWN',37]]){
      const graph={id:'root',layoutOptions:{'elk.algorithm':'layered','elk.edgeRouting':'ORTHOGONAL',
        'elk.direction':direction,'elk.randomSeed':String(seed),'elk.layered.crossingMinimization.strategy':'LAYER_SWEEP',
        'elk.layered.crossingMinimization.greedySwitch.type':'TWO_SIDED','elk.spacing.nodeNode':'65',
        'elk.layered.spacing.nodeNodeBetweenLayers':'110','elk.layered.spacing.edgeNodeBetweenLayers':'30',
        'elk.spacing.edgeNode':'22','elk.spacing.edgeEdge':'14','elk.padding':'[top=40,left=40,bottom=40,right=40]'},
        children:p.nodes.map(n=>({id:n.id,width:n.width,height:n.height,ports:n.ports,
          layoutOptions:{'elk.portConstraints':'FIXED_POS'}})),
        edges:p.edges.map(e=>({id:e.id,sources:e.sources,targets:e.targets}))};
      const layout=await elk.layout(graph);validateLayout(layout,p);
      results.push({layout,metrics:scoreLayout(layout,p),direction,seed});
    }
    results.sort((a,b)=>compareScores(a.metrics,b.metrics));return results;
  }
  let results=await candidates(projection),best=results[0];
  if(options.labels!=='off'&&options.level!=='system'){
    const long=new Set(),lengths=new Map();const meta=new Map(projection.edges.map(e=>[e.id,e]));
    for(const e of best.layout.edges){const m=meta.get(e.id);if(m.kind==='label-stub'||m.netIds.some(id=>(options.expanded||[]).includes(id)))continue;
      const length=sectionsOf(e).reduce((sum,p)=>sum+p.slice(1).reduce((n,b,i)=>n+Math.abs(b.x-p[i].x)+Math.abs(b.y-p[i].y),0),0);
      m.refs.forEach(id=>lengths.set(id,(lengths.get(id)||0)+length));
    }
    for(const [id,length]of lengths)if(length>(options.longThreshold||1600))long.add(id);
    if(long.size){projection=projectModel(model,options,long);results=await candidates(projection);best=results[0];}
  }
  return {projection,layout:best.layout,metrics:best.metrics,candidates:results.map(({direction,seed,metrics})=>({direction,seed,metrics}))};
}
