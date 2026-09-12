import { useRef } from 'react';
import { useDiagram, useLayout, useUndoRedo } from '@drawdb/hooks';
import { Action, ObjectType } from '@drawdb/data/constants';

export default function DisplayNameEditor({table,field}) {
  const {updateField}=useDiagram(),{layout}=useLayout(),{setUndoStack,setRedoStack}=useUndoRedo();
  const original=useRef(field.reviewChineseName);
  return <label className="desktop-display-name">显示名称
    <input value={field.reviewChineseName||''} readOnly={layout.readOnly} placeholder="可填写中文名或业务别名" maxLength={120}
      onFocus={()=>{original.current=field.reviewChineseName;}}
      onChange={e=>{if(!layout.readOnly)updateField(table.id,field.id,{reviewChineseName:e.target.value});}}
      onBlur={()=>{if(layout.readOnly||original.current===field.reviewChineseName)return;
        setUndoStack(s=>[...s,{action:Action.EDIT,element:ObjectType.TABLE,component:'field',tid:table.id,fid:field.id,
          undo:{reviewChineseName:original.current},redo:{reviewChineseName:field.reviewChineseName},message:`修改显示名称 ${table.name}.${field.name}`}]);setRedoStack([]);
      }}/>
  </label>;
}
