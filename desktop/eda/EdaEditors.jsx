import { useState } from "react";
import { useDiagram, useLayout, useSelect } from "@drawdb/hooks";
import {
  ObjectType,
  Cardinality,
  Constraint,
  defaultRelationshipColor,
} from "@drawdb/data/constants";
import RelationshipFields from "../review/RelationshipFields";
import {
  relationshipDraft,
  validateRelationshipDraft,
  endpointPatch,
} from "../review/relationship-draft.mjs";
import { tr } from "../i18n/renderer";
import CanvasEditorDialog from "@drawdb/components/EditorCanvas/CanvasEditorDialog";
import TableInfo from "@drawdb/components/EditorSidePanel/TablesTab/TableInfo";
import RelationshipInfo from "@drawdb/components/EditorSidePanel/RelationshipsTab/RelationshipInfo";
import SidePanel from "@drawdb/components/EditorSidePanel/SidePanel";

export default function EdaEditors({ tools, setTools }) {
  const { tables, relationships } = useDiagram();
  const { selectedElement, setSelectedElement } = useSelect();
  const table =
    selectedElement.element === ObjectType.TABLE &&
    tables.find((t) => t.id === selectedElement.id);
  const relationship =
    selectedElement.element === ObjectType.RELATIONSHIP &&
    relationships.find((r) => r.id === selectedElement.id);
  const close = () =>
    setSelectedElement((s) => ({ ...s, openDialogue: false, open: false }));
  return (
    <>
      {table && selectedElement.openDialogue && (
        <CanvasEditorDialog
          title={`编辑表 · ${table.name}`}
          visible
          onClose={close}
          accentColor={table.color}
        >
          <TableInfo key={table.id} data={table} reviewStyle />
        </CanvasEditorDialog>
      )}
      {relationship && selectedElement.openDialogue && (
        <CanvasEditorDialog
          title={`编辑关系 · ${relationship.name}`}
          visible
          onClose={close}
        >
          <RelationshipInfo key={relationship.id} data={relationship} />
        </CanvasEditorDialog>
      )}
      <CanvasEditorDialog
        title="模型编辑"
        visible={tools === "model"}
        onClose={() => setTools(null)}
      >
        <div className="eda-model-editor">
          <SidePanel width={690} resize={false} setResize={() => {}} />
        </div>
      </CanvasEditorDialog>
      {tools === "relationship" && (
        <NewRelationship onClose={() => setTools(null)} />
      )}
    </>
  );
}

function NewRelationship({ onClose }) {
  const { tables, relationships, addRelationship } = useDiagram(),
    { layout } = useLayout(),
    { setSelectedElement } = useSelect();
  const [draft, setDraft] = useState(() => relationshipDraft()),
    [name, setName] = useState(""),
    [cardinality, setCardinality] = useState(Cardinality.MANY_TO_ONE),
    [attempted, setAttempted] = useState(false);
  const validation = validateRelationshipDraft(draft, tables, relationships);
  const add = (event) => {
    event.preventDefault();
    setAttempted(true);
    if (layout.readOnly || validation.errors.length) return;
    const a = tables.find((t) => t.id === draft.startTableId),
      b = tables.find((t) => t.id === draft.endTableId),
      first = a.fields.find((f) => f.id === draft.fields[0].startFieldId);
    const id = crypto.randomUUID();
    addRelationship({
      id,
      name: name.trim() || `fk_${a.name}_${first.name}_${b.name}`,
      ...endpointPatch(draft),
      cardinality,
      updateConstraint: Constraint.NONE,
      deleteConstraint: Constraint.NONE,
      color: defaultRelationshipColor,
    });
    onClose();
    setSelectedElement((s) => ({
      ...s,
      id,
      element: ObjectType.RELATIONSHIP,
      open: false,
      openDialogue: true,
    }));
  };
  return (
    <CanvasEditorDialog title="新增关系" visible onClose={onClose}>
      <form className="eda-relationship-form" onSubmit={add}>
        <p>明确选择引用字段和目标字段，不根据表名猜测关系。</p>
        <label>
          关系名称
          <input
            aria-label="关系名称"
            value={name}
            placeholder="留空自动命名"
            onChange={(e) => setName(e.target.value)}
            disabled={layout.readOnly}
          />
        </label>
        <RelationshipFields
          tables={tables}
          draft={draft}
          onChange={setDraft}
          readOnly={layout.readOnly}
        />
        <label>
          基数
          <select
            aria-label="关系基数"
            value={cardinality}
            onChange={(e) => setCardinality(e.target.value)}
            disabled={layout.readOnly}
          >
            <option value={Cardinality.MANY_TO_ONE}>多对一</option>
            <option value={Cardinality.ONE_TO_ONE}>一对一</option>
            <option value={Cardinality.ONE_TO_MANY}>一对多</option>
          </select>
        </label>
        {attempted &&
          validation.errors.map((error) => (
            <p role="alert" key={error}>
              {tr(error)}
            </p>
          ))}
        {validation.warnings.length > 0 && (
          <p className="relationship-reminders">
            {tr(validation.warnings[0])} · 仅提醒，不阻止逻辑关联。
          </p>
        )}
        <button disabled={layout.readOnly} type="submit">
          创建关系
        </button>
      </form>
    </CanvasEditorDialog>
  );
}
