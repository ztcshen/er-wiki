import { objectReferences } from './model-index.mjs';
import { relationNatureLabel } from '../review/relation-semantics.mjs';
import { tr } from '../i18n/renderer';

export default function ObjectReferences({ model, index, tableId, fieldId, onLocate }) {
  const table = model.tables.find(t => t.id === tableId), known = new Map(model.relationships.map(r => [r.id, r]));
  const references = objectReferences(index, tableId, fieldId);
  const tableName = id => model.tables.find(t => t.id === id)?.name || String(id);
  if (!table) return <div className="reading-context-empty">{tr('选中表或字段查看入向和出向引用')}</div>;
  return <div className="object-references"><h3>{table.name}{fieldId != null && ' · '+(table.fields.find(f => f.id === fieldId)?.name || String(fieldId))}</h3>
    <p>{tr('已声明、待确认和异常关联分别标注。')}</p>
    {Object.entries(references).map(([direction, rows]) => <section key={direction}><h4>{tr(direction === 'incoming' ? '入向引用' : '出向引用')} · {rows.length}</h4>
      {!rows.length && <p className="reading-context-empty">{tr('没有匹配的引用')}</p>}
      {rows.slice(0,300).map(item => { const relation = known.get(item.id); if (!relation) return null;
        return <article key={JSON.stringify(item.id)} data-reference-id={JSON.stringify(item.id)}><button onClick={() => onLocate(relation)}>{relation.name || `${tableName(item.source)} → ${tableName(item.target)}`}</button>
          <small>{tr(!item.valid ? '异常关联' : item.status === 'candidate' ? '待确认关系' : relationNatureLabel(relation, model.tables.find(t => t.id === item.source)))}</small>
          <p>{relation.reviewEvidence?.description || tr('尚未填写关联依据')}</p>{item.problems.length > 0 && <p className="reading-reference-warning">{item.problems.map(p => tr(p)).join(' · ')}</p>}
          <span>{tableName(item.source)} → {tableName(item.target)}</span></article>;
      })}
    </section>)}
  </div>;
}
