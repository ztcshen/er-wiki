// Independently authored fictional retail fulfillment schema. No row data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const groups=[
  {id:'catalog',name:'商品与库存',color:'#3276b9',tableIds:['products','warehouses','inventory']},
  {id:'orders',name:'订单与库存占用',color:'#0f766e',tableIds:['customers','orders','order_items','stock_reservations']},
  {id:'fulfillment',name:'分仓履约与发货',color:'#865bb4',tableIds:['fulfillments','fulfillment_items','shipments','shipment_items']},
  {id:'returns',name:'退货与处置',color:'#bd7a24',tableIds:['returns','return_items']},
];
const tableSpecs=[
  ['customers','客户标识；仅定义结构，不包含任何个人记录。',[
    ['customer_code','VARCHAR(32)','客户编号'],['display_name','VARCHAR(80)','显示名称']]],
  ['products','按 SKU 管理的示例商品；不建模复杂商品变体。',[
    ['sku','VARCHAR(40)','SKU'],['name','VARCHAR(120)','商品名称'],['active','BOOLEAN','可销售']]],
  ['warehouses','可用于出库或退货入库的仓库。',[
    ['warehouse_code','VARCHAR(24)','仓库编码'],['name','VARCHAR(80)','仓库名称']]],
  ['inventory','每个仓库和 SKU 一条库存；可用量=在库量-占用量。',[
    ['warehouse_id','BIGINT','仓库'],['product_id','BIGINT','商品'],['on_hand','INT','在库数量'],['reserved','INT','占用数量'],['version','INT','并发版本']]],
  ['orders','客户订单可拆为多个仓库履约单，也可部分发货。',[
    ['order_no','VARCHAR(40)','订单号'],['customer_id','BIGINT','客户'],['status','VARCHAR(24)','订单状态',['DRAFT','CONFIRMED','PARTIAL','FULFILLED','CANCELLED']],['currency','CHAR(3)','币种'],['total_minor','BIGINT','金额最小单位']]],
  ['order_items','订单商品行保留交易时的数量与单价快照。',[
    ['order_id','BIGINT','订单'],['product_id','BIGINT','商品'],['quantity','INT','下单数量'],['unit_price_minor','BIGINT','单价最小单位']]],
  ['stock_reservations','订单行可分配至多个仓库库存；释放占用不等于已经出库。',[
    ['order_item_id','BIGINT','订单行'],['inventory_id','BIGINT','仓库库存'],['reservation_key','VARCHAR(64)','幂等键'],['quantity','INT','占用数量'],['status','VARCHAR(24)','占用状态',['RESERVED','CONSUMED','RELEASED']],['expires_at','DATETIME','过期时间']]],
  ['fulfillments','一个订单可按仓库、处理批次拆分多个履约单。',[
    ['order_id','BIGINT','订单'],['warehouse_id','BIGINT','出库仓库'],['fulfillment_no','VARCHAR(40)','履约单号'],['status','VARCHAR(24)','履约状态',['PLANNED','PICKING','PACKED','SHIPPED','CANCELLED']]]],
  ['fulfillment_items','分仓拣配明细，明确对应订单行与库存占用。',[
    ['fulfillment_id','BIGINT','履约单'],['order_item_id','BIGINT','订单行'],['reservation_id','BIGINT','库存占用'],['quantity','INT','履约数量']]],
  ['shipments','履约单可分包裹发货；物流交付状态独立于拣配状态。',[
    ['fulfillment_id','BIGINT','履约单'],['carrier_code','VARCHAR(24)','承运商'],['tracking_no','VARCHAR(64)','运单号'],['status','VARCHAR(24)','物流状态',['CREATED','IN_TRANSIT','DELIVERED','EXCEPTION']],['shipped_at','DATETIME','发货时间']]],
  ['shipment_items','包裹明细支持部分发货，避免只在订单头保存一个运单号。',[
    ['shipment_id','BIGINT','包裹'],['fulfillment_item_id','BIGINT','履约明细'],['quantity','INT','发货数量']]],
  ['returns','退货申请独立于退款；此示例不包含支付和退款账务。',[
    ['order_id','BIGINT','原订单'],['return_no','VARCHAR(40)','退货单号'],['status','VARCHAR(24)','退货状态',['REQUESTED','APPROVED','RECEIVED','CLOSED','REJECTED']]]],
  ['return_items','退货行关联已发货明细，区分可售入库、隔离和报废。',[
    ['return_id','BIGINT','退货单'],['shipment_item_id','BIGINT','原发货明细'],['warehouse_id','BIGINT','退货接收仓库'],['quantity','INT','退货数量'],['disposition','VARCHAR(24)','处置方式',['RESTOCK','QUARANTINE','SCRAP']]]],
];
const enumLabels={DRAFT:'草稿',CONFIRMED:'已确认',PARTIAL:'部分完成',FULFILLED:'履约完成',CANCELLED:'已取消',RESERVED:'已占用',CONSUMED:'已消耗',RELEASED:'已释放',PLANNED:'待处理',PICKING:'拣货中',PACKED:'已打包',SHIPPED:'已发货',CREATED:'已创建',IN_TRANSIT:'运输中',DELIVERED:'已签收',EXCEPTION:'异常',REQUESTED:'已申请',APPROVED:'已批准',RECEIVED:'已收货',CLOSED:'已关闭',REJECTED:'已拒绝',RESTOCK:'可售入库',QUARANTINE:'隔离',SCRAP:'报废'};
function field(table,name,type,label,values){
  const m=/^([A-Z]+)(?:\(([^)]+)\))?$/.exec(type);
  return {id:table+'.'+name,name,type:m[1],size:m[2]||'',default:'',check:'',primary:name==='id',unique:false,notNull:true,increment:name==='id',unsigned:/^(BIGINT|INT)$/.test(type),comment:label,reviewChineseName:label,
    ...(values?{reviewEnumValues:values.map(value=>({value,label:enumLabels[value]||value}))}: {})};
}
const tables=tableSpecs.map(([name,comment,fields],i)=>({id:name,name,comment:'Fictional demo. '+comment,x:(i%4)*450,y:Math.floor(i/4)*420,color:groups.find(g=>g.tableIds.includes(name)).color,locked:false,hidden:false,collapsed:false,
  fields:[field(name,'id','BIGINT','标识'),...fields.map(f=>field(name,...f)),field(name,'created_at','DATETIME','创建时间')],indices:[],uniqueConstraints:[],
  reviewOverviewFields:fields.filter(f=>f[3]||['quantity','on_hand','reserved','sku','order_no','fulfillment_no','return_no'].includes(f[0])).map(f=>f[0])}));
const unique=[['customers',['customer_code']],['products',['sku']],['warehouses',['warehouse_code']],['inventory',['warehouse_id','product_id']],['orders',['order_no']],['stock_reservations',['reservation_key']],['fulfillments',['fulfillment_no']],['returns',['return_no']]];
for(const [name,fields]of unique){const table=tables.find(t=>t.name===name);table.indices.push({id:0,name:'uq_'+name,fields,unique:true});}
const refs=[
  ['inventory','warehouse_id','warehouses'],['inventory','product_id','products'],['orders','customer_id','customers'],
  ['order_items','order_id','orders'],['order_items','product_id','products'],
  ['stock_reservations','order_item_id','order_items'],['stock_reservations','inventory_id','inventory'],
  ['fulfillments','order_id','orders'],['fulfillments','warehouse_id','warehouses'],
  ['fulfillment_items','fulfillment_id','fulfillments'],['fulfillment_items','order_item_id','order_items'],['fulfillment_items','reservation_id','stock_reservations'],
  ['shipments','fulfillment_id','fulfillments'],['shipment_items','shipment_id','shipments'],['shipment_items','fulfillment_item_id','fulfillment_items'],
  ['returns','order_id','orders'],['return_items','return_id','returns'],['return_items','shipment_item_id','shipment_items'],['return_items','warehouse_id','warehouses'],
];
const relationships=refs.map(([child,column,parent],i)=>({id:'demo-rel-'+i,name:'fk_'+child+'_'+column,startTableId:child,startFieldId:child+'.'+column,endTableId:parent,endFieldId:parent+'.id',
  fields:[{startFieldId:child+'.'+column,endFieldId:parent+'.id'}],cardinality:'many_to_one',updateConstraint:'No action',deleteConstraint:'No action',color:'#64748b',
  reviewEvidence:{kind:'physical',description:'Explicit foreign key in the independently authored example DDL; not a real business database.',source:'examples/fulfillment.sql'}}));
const model={title:'电商履约 · Fictional fulfillment',database:'mysql',tables,relationships,reviewGroups:groups,notes:[],subjectAreas:[],views:[],types:[],enums:[],transform:{pan:{x:0,y:0},zoom:0.4},processModel:JSON.parse(fs.readFileSync(path.join(root,'examples/fulfillment.process.json'),'utf8'))};
fs.mkdirSync(path.join(root,'examples'),{recursive:true});
fs.writeFileSync(path.join(root,'examples/fulfillment.drawdb.json'),JSON.stringify(model,null,2)+'\n');
const quote=s=>'\x60'+s+'\x60';
const sql=tables.map(table=>{
  const fields=table.fields.map(f=>'  '+quote(f.name)+' '+f.type+(f.size?'('+f.size+')':'')+(f.unsigned?' UNSIGNED':'')+' NOT NULL'+(f.increment?' AUTO_INCREMENT':'')+' COMMENT '+JSON.stringify(f.comment));
  fields.push('  PRIMARY KEY ('+quote('id')+')');
  for(const index of table.indices)fields.push('  UNIQUE KEY '+quote(index.name)+' ('+index.fields.map(quote).join(', ')+')');
  return 'CREATE TABLE '+quote(table.name)+' (\n'+fields.join(',\n')+'\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;';
}).join('\n\n');
const constraints=relationships.map(r=>'ALTER TABLE '+quote(r.startTableId)+' ADD CONSTRAINT '+quote(r.name)+' FOREIGN KEY ('+quote(r.startFieldId.split('.')[1])+') REFERENCES '+quote(r.endTableId)+' ('+quote('id')+');').join('\n');
fs.writeFileSync(path.join(root,'examples/fulfillment.sql'),'-- Fictional educational schema; not a production migration.\n'+sql+'\n\n'+constraints+'\n');
// Documentation images must come from the packaged app, not a second renderer.
// Run scripts/capture-demo.mjs after packaging to refresh PNG snapshots and SVG.
console.log('Generated fictional fulfillment demo: '+tables.length+' tables, '+relationships.length+' relationships.');
