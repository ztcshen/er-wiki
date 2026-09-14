import { projectModel } from './model.mjs';
import { scoreLayout, validateLayout, sectionsOf } from './metrics.mjs';
import { arrangePlaced } from './placement.mjs';
import { elkGraph } from './elk-graph.mjs';
import { layoutQuality, compareCandidates } from './layout-quality.mjs';
import { optimizeLayouts } from './optimize-layout.mjs';
import { refinePositions } from './refine-positions.mjs';

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
    const directions = ['RIGHT', 'DOWN'].includes(options.direction) ? [options.direction] : ['RIGHT', 'DOWN'];
    for(const [direction,seed]of directions.flatMap(direction => [11, 37].map(seed => [direction, seed]))){
      const graph=elkGraph(p,{'elk.algorithm':'layered','elk.edgeRouting':'ORTHOGONAL',
        'elk.direction':direction,'elk.randomSeed':String(seed),'elk.layered.crossingMinimization.strategy':'LAYER_SWEEP',
        'elk.layered.crossingMinimization.greedySwitch.type':'TWO_SIDED','elk.spacing.nodeNode':'65',
        'elk.layered.spacing.nodeNodeBetweenLayers':'110','elk.layered.spacing.edgeNodeBetweenLayers':'30',
        'elk.spacing.edgeNode':'22','elk.spacing.edgeEdge':'14','elk.padding':'[top=40,left=40,bottom=40,right=40]'});
      const base=await elk.layout(graph);validateLayout(base,p);
      for(const {layout,placement}of await arrangePlaced(p,base,elk)){
        validateLayout(layout,p);
        const metrics=scoreLayout(layout,p);
        if(placement&&metrics.overlaps)continue;
        results.push({projection:p,layout,metrics,quality:layoutQuality(layout,p,metrics,options.targetAspectRatio),direction,seed,...(placement?{placement}:{})});
      }
    }
    if(!results.length)throw new Error('Relative table placement cannot be satisfied without overlapping nodes');
    results.sort(compareCandidates);
    if(options.optimize===false)return results;
    return refinePositions(await optimizeLayouts(results,elk,options),options);
  }
  let results=await candidates(projection),best=results[0];
  if(options.labels!=='off'&&options.level!=='system'){
    const long=new Set(),lengths=new Map();const meta=new Map(projection.edges.map(e=>[e.id,e]));
    for(const e of best.layout.edges){const m=meta.get(e.id);if(m.kind==='label-stub'||m.kind==='conditional'||m.netIds.some(id=>(options.expanded||[]).includes(id)))continue;
      const length=sectionsOf(e).reduce((sum,p)=>sum+p.slice(1).reduce((n,b,i)=>n+Math.abs(b.x-p[i].x)+Math.abs(b.y-p[i].y),0),0);
      m.refs.forEach(id=>lengths.set(id,(lengths.get(id)||0)+length));
    }
    for(const [id,length]of lengths)if(length>(options.longThreshold||1600))long.add(id);
    if(long.size){projection=projectModel(model,options,long);results=await candidates(projection);best=results[0];}
  }
  return {projection:best.projection,layout:best.layout,metrics:best.metrics,quality:best.quality,optimization:best.optimization||'elk',
    candidates:results.map(({direction,seed,metrics,quality,placement,optimization})=>({direction,seed,metrics,quality,...(placement?{placement}:{}),...(optimization?{optimization}:{})}))};
}
