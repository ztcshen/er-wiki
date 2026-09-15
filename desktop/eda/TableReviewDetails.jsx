import { tableConstraints, reviewContextErrors } from '../review/table-review.mjs';
import { tr } from '../i18n/renderer';
import { useProcessModel } from '../process/context';
import { actionsForTable } from '../process/definition.mjs';
import { accessLabel } from '../process/ProcessGlyphs';

export default function TableReviewDetails({ table, actions }) {
  const { processModel } = useProcessModel();
  const steps = (processModel?.scenarios || []).flatMap(scenario => actionsForTable(scenario, table.id).map(step => ({ scenario, step })));
  const constraints = tableConstraints(table);
  const errors = reviewContextErrors(table.reviewContext);
  const context = errors.length ? {} : table.reviewContext || {};
  return <>
    <details className="eda-evidence" data-table-constraints>
      <summary>{tr('索引与约束')} ({constraints.length})</summary>
      {constraints.map((constraint, index) => <div key={index} className="eda-constraint">
        <strong>{constraint.name}</strong> <small>{tr({ primary: '主键', unique: '唯一约束', index: '普通索引' }[constraint.kind])}</small>
        <div>{constraint.fields.map((field, position) => <span key={position}>
          {position > 0 && ' → '}{field.invalid ? <span role="status">{String(field.reference)} ({tr(field.ambiguous ? '字段引用有歧义' : '字段不存在')})</span>
            : <button onClick={() => actions.inspectField(table.id, field.id)}>{field.name}</button>}
        </span>)}</div>
      </div>)}
      {!constraints.length && <p>{tr('未提供')}</p>}
    </details>
    <details className="eda-evidence" data-table-review-context>
      <summary>{tr('业务含义与事实来源')}</summary>
      {errors.length > 0 && <p role="alert">{tr('表业务说明格式无效')}</p>}
      <dl>
        <dt>{tr('表的职责')}</dt><dd>{context.purpose || tr('未提供')}</dd>
        <dt>{tr('一行代表什么')}</dt><dd>{context.grain || tr('未提供')}</dd>
        <dt>{tr('事实来源')}</dt><dd>{tr({ design: '设计约定', observed: '观察依据', unknown: '来源未确认' }[context.authority?.kind] || '未提供')}</dd>
        <dd>{context.authority?.summary}</dd>
        {context.authority?.source && <dd><code>{context.authority.source.kind}: {context.authority.source.locator}</code></dd>}
      </dl>
    </details>
    {steps.length > 0 && <details className="eda-evidence" data-table-process-access>
      <summary>{tr('哪些流程步骤使用此表')} ({steps.length})</summary>
      {steps.map(({ scenario, step }) => <div key={`${scenario.id}:${step.id}`} className="eda-constraint">
        <strong>{scenario.name} · {step.name}</strong>
        <div>{step.bindings.filter(binding => binding.tableId === table.id).map((binding, index) => <span key={index}>
          {index > 0 && ' · '}{tr(accessLabel(binding.access))}
          {binding.fieldIds.length > 0 && ` (${binding.fieldIds.map(id => table.fields.find(field => field.id === id)?.name || String(id)).join(', ')})`}
        </span>)}</div>
      </div>)}
    </details>}
  </>;
}
