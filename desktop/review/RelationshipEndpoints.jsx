import { useEffect, useState } from "react";
import { useDiagram, useLayout, useUndoRedo } from "@drawdb/hooks";
import { Action, ObjectType } from "@drawdb/data/constants";
import {
  relationshipDraft,
  validateRelationshipDraft,
  endpointPatch,
} from "./relationship-draft.mjs";
import RelationshipFields from "./RelationshipFields";
import { tr } from "../i18n/renderer";

export default function RelationshipEndpoints({ data }) {
  const { tables, relationships, updateRelationship } = useDiagram(),
    { layout } = useLayout(),
    { setUndoStack, setRedoStack } = useUndoRedo();
  const [draft, setDraft] = useState(() => relationshipDraft(data)),
    [attempted, setAttempted] = useState(false);
  const current = JSON.stringify(relationshipDraft(data));
  useEffect(() => {
    setDraft(relationshipDraft(data));
    setAttempted(false);
  }, [current]);
  const changed = JSON.stringify(draft) !== current,
    validation = validateRelationshipDraft(
      draft,
      tables,
      relationships,
      data.id,
    );
  const apply = () => {
    setAttempted(true);
    if (layout.readOnly || validation.errors.length || !changed) return;
    const redo = endpointPatch(draft),
      undo = {
        startTableId: data.startTableId,
        endTableId: data.endTableId,
        startFieldId: data.startFieldId,
        endFieldId: data.endFieldId,
        fields: data.fields,
      };
    setUndoStack((stack) => [
      ...stack,
      {
        action: Action.EDIT,
        element: ObjectType.RELATIONSHIP,
        component: "self",
        rid: data.id,
        undo,
        redo,
        message: `修改关系字段 ${data.name}`,
      },
    ]);
    setRedoStack([]);
    updateRelationship(data.id, redo);
  };
  return (
    <section className="relationship-endpoint-editor">
      <RelationshipFields
        tables={tables}
        draft={draft}
        onChange={setDraft}
        readOnly={layout.readOnly}
      />
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
      <div className="relationship-apply">
        <button
          type="button"
          onClick={apply}
          disabled={layout.readOnly || !changed}
        >
          应用字段映射
        </button>
        <small>更换表和字段后应用，可撤销。</small>
      </div>
    </section>
  );
}
