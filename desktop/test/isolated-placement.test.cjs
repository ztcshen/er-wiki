const {test}=require('node:test');const assert=require('node:assert/strict');
const fixture=()=>({projection:{nodes:[{id:'a',tableId:'a',kind:'table',ports:[{id:'ap',x:200,y:60,layoutOptions:{'elk.port.side':'EAST'}}]},{id:'b',tableId:'b',kind:'table',ports:[{id:'bp',x:0,y:60,layoutOptions:{'elk.port.side':'WEST'}}]},{id:'c',tableId:'c',kind:'table',ports:[]}],edges:[{id:'e',sources:['ap'],targets:['bp'],netIds:[],refs:[],kind:'wire'}],nets:[],domains:[{id:'g',tableIds:['a','c']}]},layout:{children:[{id:'a',x:100,y:100,width:200,height:120},{id:'b',x:500,y:100,width:200,height:120},{id:'c',x:2000,y:2000,width:200,height:120}],edges:[{id:'e',sections:[{startPoint:{x:300,y:160},endPoint:{x:500,y:160}}]}],width:2240,height:2240}});
test('isolated tables stay near their domain without semantic or route changes',async()=>{
 const {placeIsolatedTables}=await import('../eda/isolated-placement.mjs');const f=fixture(),before=structuredClone(f);
 const next=placeIsolatedTables(f.projection,f.layout),c=next.children[2];
 assert(c.x<500&&c.y<500);assert.deepEqual(next.edges,f.layout.edges);assert.deepEqual(next.children.slice(0,2),f.layout.children.slice(0,2));assert.deepEqual(f,before);
 assert(!(c.y<160&&c.y+c.height>160&&c.x<500&&c.x+c.width>300),'Do not obscure a wire');
});
test('unassigned tables and explicit placement hints are not overridden',async()=>{
 const {placeIsolatedTables}=await import('../eda/isolated-placement.mjs');
 for(const mode of ['unassigned','hint','no-peer']){const f=fixture();if(mode==='unassigned')f.projection.domains[0].id='__unassigned__';if(mode==='hint')f.projection.nodes[2].placement={belowTableId:'a'};if(mode==='no-peer')f.projection.domains[0].tableIds=['c'];
 assert.deepEqual(placeIsolatedTables(f.projection,f.layout).children,f.layout.children);}
});
