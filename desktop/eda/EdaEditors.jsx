import { useState } from 'react';
import { useDiagram, useLayout, useSelect } from '@drawdb/hooks';
import { ObjectType, Cardinality, Constraint, defaultRelationshipColor } from '@drawdb/data/constants';
import { areFieldsCompatible } from '@drawdb/utils/utils';
import CanvasEditorDialog from '@drawdb/components/EditorCanvas/CanvasEditorDialog';
import TableInfo from '@drawdb/components/EditorSidePanel/TablesTab/TableInfo';
import RelationshipInfo from '@drawdb/components/EditorSidePanel/RelationshipsTab/RelationshipInfo';
import SidePanel from '@drawdb/components/EditorSidePanel/SidePanel';

export default function EdaEditors({ tools, setTools }) {
  const { tables, relationships } = useDiagram();
  const { selectedElement, setSelectedElement } = useSelect();
  const table=selectedElement.element===ObjectType.TABLE&&tables.find(t=>t.id===selectedElement.id);
  const relationship=selectedElement.element===ObjectType.RELATIONSHIP&&relationships.find(r=>r.id===selectedElement.id);
  const close=()=>setSelectedElement(s=>({...s,openDialogue:false,open:false}));
  return <>
    {table&&selectedElement.openDialogue&&<CanvasEditorDialog title={`编辑表 · ${table.name}`} visible onClose={close} accentColor={table.color}>
      <TableInfo key={table.id} data={table} reviewStyle/>
    </CanvasEditorDialog>}
    {relationship&&selectedElement.openDialogue&&<CanvasEditorDialog title={`编辑关系 · ${relationship.name}`} visible onClose={close}>
      <RelationshipInfo key={relationship.id} data={relationship}/>
    </CanvasEditorDialog>}
    <CanvasEditorDialog title="模型编辑" visible={tools==='model'} onClose={()=>setTools(null)}>
      <div className="eda-model-editor"><SidePanel width={690} resize={false} setResize={()=>{}}/></div>
    </CanvasEditorDialog>
    {tools==='relationship'&&<NewRelationship onClose={()=>setTools(null)}/>}
  </>;
}

function NewRelationship({ onClose }) {
  const { tables, relationships, database, addRelationship }=useDiagram(),{layout}=useLayout();
  const {setSelectedElement}=useSelect();
  const [source,setSource]=useState(''),[target,setTarget]=useState(''),[sourceField,setSourceField]=useState(''),[targetField,setTargetField]=useState('');
  const [cardinality,setCardinality]=useState(Cardinality.MANY_TO_ONE),[error,setError]=useState('');
  const a=tables.find(t=>String(t.id)===source),b=tables.find(t=>String(t.id)===target);
  const add=event=>{
    event.preventDefault();if(layout.readOnly)return;
    const af=a?.fields.find(f=>String(f.id)===sourceField),bf=b?.fields.find(f=>String(f.id)===targetField);
    if(!af||!bf){setError('请选择两端的表和字段');return;}
    if(a.id===b.id&&af.id===bf.id){setError('不能连接字段自身');return;}
    if(!areFieldsCompatible(database,af.type,bf.type)){setError('两端字段类型不兼容');return;}
    if(relationships.some(r=>r.startTableId===a.id&&r.endTableId===b.id&&(r.fields||[r]).some(p=>p.startFieldId===af.id&&p.endFieldId===bf.id))){setError('这两个字段的关系已存在');return;}
    const id=crypto.randomUUID();
    addRelationship({id,name:`fk_${a.name}_${af.name}_${b.name}`,startTableId:a.id,startFieldId:af.id,endTableId:b.id,endFieldId:bf.id,
      fields:[{startFieldId:af.id,endFieldId:bf.id}],cardinality,updateConstraint:Constraint.NONE,deleteConstraint:Constraint.NONE,color:defaultRelationshipColor});
    onClose();setSelectedElement(s=>({...s,id,element:ObjectType.RELATIONSHIP,open:false,openDialogue:true}));
  };
  return <CanvasEditorDialog title="新增关系" visible onClose={onClose}>
    <form className="eda-relationship-form" onSubmit={add}>
      <p>明确选择引用字段和目标字段，不根据表名猜测关系。</p>
      <label>引用表<select aria-label="引用表" value={source} onChange={e=>{setSource(e.target.value);setSourceField('');}}><option value="">请选择</option>{tables.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label>引用字段<select aria-label="引用字段" value={sourceField} onChange={e=>setSourceField(e.target.value)}><option value="">请选择</option>{a?.fields.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      <label>目标表<select aria-label="目标表" value={target} onChange={e=>{setTarget(e.target.value);setTargetField('');}}><option value="">请选择</option>{tables.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label>目标字段<select aria-label="目标字段" value={targetField} onChange={e=>setTargetField(e.target.value)}><option value="">请选择</option>{b?.fields.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      <label>基数<select aria-label="关系基数" value={cardinality} onChange={e=>setCardinality(e.target.value)}><option value={Cardinality.MANY_TO_ONE}>多对一</option><option value={Cardinality.ONE_TO_ONE}>一对一</option><option value={Cardinality.ONE_TO_MANY}>一对多</option></select></label>
      {error&&<p role="alert">{error}</p>}<button disabled={layout.readOnly} type="submit">创建关系</button>
    </form>
  </CanvasEditorDialog>;
}
