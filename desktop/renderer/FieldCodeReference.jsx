import { fieldCodeNote } from './field-labels.mjs';

export default function FieldCodeReference({ tableName, field }) {
  const note=fieldCodeNote(tableName,field);
  if(!note)return null;
  const source=note.meaningSource||note;
  return <details className="field-code-reference"><summary>源码说明</summary>
    <p>{note.meaning||`代码原注释：${note.comment}`}</p>
    <small title={`${source.path}:${source.line}\nMapper：${note.mapper}:${note.mapperLine}`}>
      源码：{source.path.split('/').at(-1)}:{source.line} · {note.property}
    </small>
  </details>;
}
