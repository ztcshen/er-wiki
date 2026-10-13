import { projectModel } from './model.mjs';
import { scoreLayout, validateLayout, sectionsOf } from './metrics.mjs';
import { arrangePlaced } from './placement.mjs';
import { elkGraph } from './elk-graph.mjs';
import { layoutQuality, compareCandidates, candidateValidity } from './layout-quality.mjs';
import { optimizeLayouts } from './optimize-layout.mjs';
import { refinePositions } from './refine-positions.mjs';
import { layoutBudget } from './layout-budget.mjs';
import { movePorts, fourSideSuggestions, SELF_REFERENCE_CLEARANCE } from './ports.mjs';
import { loadObstacleRouter, routeObstacles } from './obstacle-router.mjs';
import {placeIsolatedTables} from './isolated-placement.mjs';
import { arrangeDomainGroups, domainLayoutEligibility } from './group-layout.mjs';
import { diagramViewPositions, projectionForDiagramPositions, diagramPositionsMatch,
  applyDiagramPositions, routeDiagramGeometry } from './diagram-geometry.mjs';
import { optimizeAnnotations } from './annotation-layout.mjs';

export async function arrangeSchematic(model, options={}, elk){
  options = { ...options, budget: options.budget || layoutBudget(options) };
  const candidateErrors = [];
  const stages = [];
  const measure = async (stage, run) => {
    const start = options.budget.now();
    try { return await run(); }
    finally { stages.push({ stage, elapsedMs: options.budget.now() - start }); }
  };
  // Node tests use the bundled fake worker; the desktop worker injects a real
  // ELK API worker. Loading elk.bundled inside WorkerGlobalScope is invalid.
  if(!elk){const {default:ELK}=await import('elkjs/lib/elk.bundled.js');elk=new ELK();}
  if(model.tables.length>5000||model.relationships.length>20000)throw new Error('输入规模超过当前保护上限，请拆分模型');
  let projection=projectModel(model,options),longCuts=[];
  projection=projectionForDiagramPositions(projection,diagramViewPositions(projection,options.diagramView));
  if(!projection.nodes.length)return {projection,layout:{children:[],edges:[],width:800,height:500},metrics:{crossings:0,overlaps:0,length:0,bends:0},candidates:[]};
  let published = null;
  const annotations = new WeakMap();
  const annotate = (p, layout) => {
    const saved = annotations.get(layout);
    if (saved?.projection === p) return saved.layout;
    const next = optimizeAnnotations(layout, p, options), entry = { projection: p, layout: next };
    annotations.set(layout, entry); annotations.set(next, entry);
    return next;
  };
  const settle = candidate => {
    // A named diagram's saved geometry takes precedence over optional isolated
    // table placement. Its free nodes were already settled before rerouting.
    if (diagramViewPositions(candidate.projection,options.diagramView).size) return candidate;
    const placed=placeIsolatedTables(candidate.projection,candidate.layout);
    if(placed===candidate.layout)return candidate;
    delete placed.annotationPositions; delete placed.annotationPlacement;
    const layout=annotate(candidate.projection,placed);
    const metrics=scoreLayout(layout,candidate.projection);
    return {...candidate,layout,metrics,quality:layoutQuality(layout,candidate.projection,metrics,options.targetAspectRatio)};
  };
  const finishCandidates = candidates => candidates.map(settle).sort(compareCandidates);
  const publish = (candidate, cuts) => {
    candidate=settle(candidate);
    if (!diagramPositionsMatch(candidate.layout,diagramViewPositions(candidate.projection,options.diagramView))) return;
    if (candidateValidity(candidate).valid && (!published || compareCandidates(candidate, published) < 0)) {
      published = { ...candidate, longCuts: cuts };
      options.onCandidate?.({ ...candidate, status: 'ready', validity: { valid: true, reasons: [] }, longCuts: cuts, candidates: [] });
    }
  };
  async function candidates(original, cuts = []){
    if(original.nodes.length>1500||original.edges.length>6000)throw new Error('当前视图过大，请先选择更小的领域');
    const fixedPositions=diagramViewPositions(original,options.diagramView);
    original=projectionForDiagramPositions(original,fixedPositions);
    const results=[];
    const evaluate=(p,layout,metadata)=>{
      validateLayout(layout,p);
      if (!diagramPositionsMatch(layout,fixedPositions)) throw Object.assign(new Error('布局改变了命名视图的固定位置'),{code:'DIAGRAM_VIEW_POSITION_INVALID'});
      layout=annotate(p,layout);
      const metrics=scoreLayout(layout,p);
      const result={projection:p,layout,metrics,quality:layoutQuality(layout,p,metrics,options.targetAspectRatio),...metadata};
      results.push(result);publish(result,cuts);
      return result;
    };
    const fixedCandidates=async(p,base,metadata)=>{
      const seed=applyDiagramPositions(p,base,fixedPositions);
      if(options.budget.expired())throw Object.assign(new Error('命名视图的固定位置尚未完成布线，请缩小视图或重试'),{code:'DIAGRAM_VIEW_ROUTING_BUDGET'});
      const layout=await measure('diagram-routing',()=>routeDiagramGeometry(p,seed,fixedPositions));
      evaluate(p,layout,{...metadata,optimization:metadata.optimization||'diagram positions',diagramGeometry:{viewId:options.diagramView.id,fixedTables:fixedPositions.size}});
      if(options.optimize===false||p.nodes.length>80||options.budget.expired())return;
      const suggestions=fourSideSuggestions(p,seed);
      const seen=new Set();
      for(const changes of [suggestions,...suggestions.slice(0,6).map(s=>[s])]){
        if(options.budget.expired())break;
        const key=JSON.stringify(changes);
        if(!changes.length||seen.has(key))continue;
        seen.add(key);
        try{
          const next=movePorts(p,changes),routed=await measure('diagram-ports',()=>routeDiagramGeometry(next,seed,fixedPositions));
          evaluate(next,routed,{...metadata,optimization:'diagram positions / four-sided ports',diagramGeometry:{viewId:options.diagramView.id,fixedTables:fixedPositions.size}});
        }catch(error){candidateErrors.push({stage:'diagram-ports',code:error.code,message:error.message});}
      }
    };
    // Preserve horizontal reading order unless the reader explicitly asks DOWN.
    // AUTO still optimizes ports/routes, but no longer rotates the whole diagram.
    const directions = [options.direction === 'DOWN' ? 'DOWN' : 'RIGHT'];
    for(const [direction,seed]of directions.flatMap(direction => [11, 37].map(seed => [direction, seed]))){
      if (options.budget.expired()) break;
      try {
      const selfPorts=original.nodes.flatMap(node=>node.ports.filter(port=>port.selfReference).map(port=>({id:port.id,side:seed===11?'EAST':'WEST'})));
      const p=selfPorts.length?movePorts(original,selfPorts):original;
      const graph=elkGraph(p,{'elk.algorithm':'layered','elk.edgeRouting':'ORTHOGONAL',
        'elk.direction':direction,'elk.randomSeed':String(seed),'elk.layered.crossingMinimization.strategy':'LAYER_SWEEP',
        'elk.layered.crossingMinimization.greedySwitch.type':'TWO_SIDED','elk.spacing.nodeNode':'65',
        'elk.layered.spacing.nodeNodeBetweenLayers':'110','elk.layered.spacing.edgeNodeBetweenLayers':'30',
        'elk.spacing.edgeNode':'22','elk.spacing.edgeEdge':'14','elk.spacing.nodeSelfLoop':String(SELF_REFERENCE_CLEARANCE),'elk.padding':'[top=40,left=40,bottom=40,right=40]'});
      const base=await measure('elk',()=>elk.layout(graph));validateLayout(base,p);
      for(const {layout:placed,placement}of await measure('placement',()=>arrangePlaced(p,base,elk,{...options,onPlacementError:(error,strategy)=>candidateErrors.push({stage:'placement',direction,seed,strategy,message:error.message})}))){
        if(fixedPositions.size){await fixedCandidates(p,placed,{direction,seed,...(placement?{placement}:{})});continue;}
        const layout=annotate(p,placeIsolatedTables(p,placed));
        validateLayout(layout,p);
        const metrics=scoreLayout(layout,p);
        if(placement&&metrics.overlaps)continue;
        results.push({projection:p,layout,metrics,quality:layoutQuality(layout,p,metrics,options.targetAspectRatio),direction,seed,...(placement?{placement}:{})});
        publish(results.at(-1), cuts);
        // Repair the baseline before spending the deadline on compactness.
        // ELK can leave shared corridors touching despite distinct net IDs.
        // Keep its placement and let the obstacle router separate the wires.
        if (!candidateValidity(results.at(-1)).valid && !options.budget.expired()) {
          try {
            const repaired = annotate(p,await measure('baseline-routing', async () => routeObstacles(await loadObstacleRouter(),p,layout)));
            validateLayout(repaired,p);
            const repairedMetrics=scoreLayout(repaired,p);
            results.push({projection:p,layout:repaired,metrics:repairedMetrics,
              quality:layoutQuality(repaired,p,repairedMetrics,options.targetAspectRatio),direction,seed,
              ...(placement?{placement}:{}),optimization:'baseline obstacle routing'});
            publish(results.at(-1),cuts);
          } catch (error) { candidateErrors.push({stage:'baseline-routing',direction,seed,message:error.message}); }
        }
      }
      } catch (error) {
        candidateErrors.push({ direction, seed,...(error.code?{code:error.code}:{}), message: error.message || String(error) });
      }
    }
    if(!results.length){
      if(fixedPositions.size)throw Object.assign(new Error('命名视图的保存位置尚未完成布线；已保留位置，请检查表间距或重试'),{code:'DIAGRAM_VIEW_ROUTING_INVALID',candidateErrors});
      throw Object.assign(new Error('No layout candidate completed; check constraints or retry'), { code: 'LAYOUT_NO_CANDIDATE', candidateErrors });
    }
    const grouping=domainLayoutEligibility(original,options);
    if(options.optimize!==false&&grouping.eligible&&!options.budget.expired()){
      try{
        const seed=await measure('domain-layout',()=>arrangeDomainGroups(original,elk,options));
        if(seed&&!options.budget.expired()){
          const metadata={direction:options.direction==='DOWN'?'DOWN':'RIGHT',seed:'domains',optimization:'domain groups / two-stage',groupLayout:seed.groupLayout};
          if(fixedPositions.size)await fixedCandidates(original,seed,metadata);
          else{
            const layout=annotate(original,await measure('domain-routing',()=>routeDiagramGeometry(original,seed)));
            const metrics=scoreLayout(layout,original),quality=layoutQuality(layout,original,metrics,options.targetAspectRatio);
            const validity=candidateValidity({projection:original,layout,metrics,quality});
            if(validity.valid)evaluate(original,layout,{...metadata,...(original.nodes.some(n=>n.placement)?{placement:'domain-groups'}:{})});
            else candidateErrors.push({stage:'domain-layout',code:'DOMAIN_LAYOUT_REJECTED',message:validity.reasons.join(', ')});
          }
        }
      }catch(error){candidateErrors.push({stage:'domain-layout',...(error.code?{code:error.code}:{}),message:error.message||String(error)});}
    }
    results.sort(compareCandidates);
    // Generic compaction and position search can move all tables; a pinned view
    // instead competes using its original geometry and bounded port variants.
    if(fixedPositions.size || options.optimize===false || options.budget.expired())return finishCandidates(results);
    const stageOptions = { ...options, onCandidate: candidate => publish(candidate, cuts) };
    const optimized = await measure('port-optimization',()=>optimizeLayouts(results,elk,stageOptions));
    return finishCandidates(await measure('position-refinement',()=>refinePositions(optimized,stageOptions,elk)));
  }
  let results=await candidates(projection),best=results[0];
  if(options.labels!=='off'&&options.level!=='system'){
    const long=new Set(),lengths=new Map();const meta=new Map(projection.edges.map(e=>[e.id,e]));
    for(const e of best.layout.edges){const m=meta.get(e.id);if(m.kind==='self'||m.kind==='label-stub'||m.kind==='conditional'||m.netIds.some(id=>(options.expanded||[]).includes(id)))continue;
      const length=sectionsOf(e).reduce((sum,p)=>sum+p.slice(1).reduce((n,b,i)=>n+Math.abs(b.x-p[i].x)+Math.abs(b.y-p[i].y),0),0);
      m.refs.forEach(id=>lengths.set(id,(lengths.get(id)||0)+length));
    }
    for(const [id,length]of lengths)if(length>(options.longThreshold||1600))long.add(id);
    if(long.size && !options.budget.expired()){
      try {
        const nextProjection=projectModel(model,options,long),nextResults=await candidates(nextProjection,[...long]);
        longCuts=[...long];projection=nextProjection;results=nextResults;best=results[0];
      } catch (error) { candidateErrors.push({ stage: 'net-labels', message: error.message }); }
    }
  }
  if (published && compareCandidates(published, best) < 0) {
    best = published; projection = published.projection; longCuts = published.longCuts;
    if (!results.includes(published)) results = [...results, published];
  }
  const validity = candidateValidity(best);
  if(diagramViewPositions(best.projection,options.diagramView).size&&!validity.valid)
    throw Object.assign(new Error('命名视图的固定位置无法完成可读布线；已保留保存的位置，请调整表间距后重试'),{code:'DIAGRAM_VIEW_ROUTING_INVALID',validity,candidateErrors});
  const grouping=domainLayoutEligibility(best.projection,options);
  return {projection:best.projection,layout:best.layout,metrics:best.metrics,quality:best.quality,validity,status:validity.valid?'ready':'degraded',optimization:best.optimization||'elk',longCuts,
    diagnostics: { elapsedMs: options.budget.now()-options.budget.started, stages, candidateErrors, stopReason: options.budget.expired()?'budget':'completed', realNodes: projection.nodes.filter(n=>n.kind==='table').length, virtualNodes: projection.nodes.filter(n=>n.kind!=='table').length, refinementMode: diagramViewPositions(best.projection,options.diagramView).size?'diagram-positions':projection.nodes.length > 80?'elk-bounded-ports':'positions-and-ports', validCandidates: results.filter(r=>candidateValidity(r).valid).length,
      groupLayout:{eligible:grouping.eligible,reason:options.optimize===false?'optimization-disabled':grouping.reason|| (results.some(r=>r.groupLayout)?'completed':options.budget.expired()?'budget':'rejected'),candidates:results.filter(r=>r.groupLayout).length},
      ...(options.diagramView?{diagramViewId:options.diagramView.id,fixedTables:diagramViewPositions(best.projection,options.diagramView).size}:{}) },
    candidates:results.map(({direction,seed,metrics,quality,placement,optimization,groupLayout,diagramGeometry})=>({direction,seed,metrics,quality,...(placement?{placement}:{}),...(optimization?{optimization}:{}),...(groupLayout?{groupLayout}:{}),...(diagramGeometry?{diagramGeometry}:{})}))};
}
