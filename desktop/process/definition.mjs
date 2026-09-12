export const ACCESS = ["read", "create", "update", "delete"];
export const STEP_KINDS = ["action", "decision", "event"];
const text = (value, max = 1000) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const reference = (value) =>
  text(value, 1000) || (typeof value === "number" && Number.isFinite(value));
const fail = (message) => {
  throw new Error(message);
};

// Definition validation is independent of the current schema: deleting a table
// must leave a visible broken mapping, not erase the process or prevent saving ER.
export function validateProcessModel(value) {
  if (value == null) return null;
  if (
    value.version !== 1 ||
    !Array.isArray(value.scenarios) ||
    value.scenarios.length > 30
  )
    fail("Invalid process model version or scenarios");
  const scenarios = new Set();
  for (const scenario of value.scenarios) {
    if (
      !text(scenario.id, 100) ||
      scenarios.has(scenario.id) ||
      !text(scenario.name, 120)
    )
      fail("Invalid or duplicate scenario");
    scenarios.add(scenario.id);
    if (
      !Array.isArray(scenario.steps) ||
      scenario.steps.length > 150 ||
      !Array.isArray(scenario.flows) ||
      scenario.flows.length > 500
    )
      fail("Process scenario exceeds preview limits");
    const ids = new Set();
    for (const step of scenario.steps) {
      if (
        !text(step.id, 100) ||
        ids.has(step.id) ||
        !text(step.name, 120) ||
        !STEP_KINDS.includes(step.kind)
      )
        fail("Invalid or duplicate process step");
      ids.add(step.id);
      if (!Array.isArray(step.bindings) || step.bindings.length > 50)
        fail("Invalid data bindings");
      for (const binding of step.bindings) {
        if (
          !reference(binding.tableId) ||
          !ACCESS.includes(binding.access) ||
          !Array.isArray(binding.fieldIds) ||
          binding.fieldIds.length > 200 ||
          !binding.fieldIds.every(reference)
        )
          fail("Invalid process data binding");
        if (
          binding.state != null &&
          (!reference(binding.state.fieldId) ||
            !text(binding.state.to, 300) ||
            (binding.state.from != null && !text(binding.state.from, 300)))
        )
          fail("Invalid state transition");
      }
    }
    const edges = new Set();
    for (const flow of scenario.flows) {
      if (
        !text(flow.id, 100) ||
        edges.has(flow.id) ||
        !ids.has(flow.from) ||
        !ids.has(flow.to) ||
        !["normal", "condition", "return"].includes(flow.kind)
      )
        fail("Invalid process flow endpoint or kind");
      if (flow.kind !== "normal" && !text(flow.label, 200))
        fail("Conditional and return flows require a label");
      edges.add(flow.id);
    }
  }
  if (JSON.stringify(value).length > 1000000)
    fail("Process configuration is too large");
  return value;
}

export function bindingIssues(definition, tables) {
  const index = new Map(tables.map((table) => [table.id, table]));
  return (definition?.scenarios || []).flatMap((scenario) =>
    scenario.steps.flatMap((step) =>
      step.bindings.flatMap((binding) => {
        const table = index.get(binding.tableId);
        if (!table)
          return [
            {
              scenarioId: scenario.id,
              stepId: step.id,
              tableId: binding.tableId,
              message: `${step.name}: missing table ${binding.tableId}`,
            },
          ];
        const fields = [
          ...binding.fieldIds,
          ...(binding.state ? [binding.state.fieldId] : []),
        ];
        return [...new Set(fields)]
          .filter((id) => !table.fields.some((field) => field.id === id))
          .map((id) => ({
            scenarioId: scenario.id,
            stepId: step.id,
            tableId: binding.tableId,
            message: `${step.name}: missing field ${table.name}.${id}`,
          }));
      }),
    ),
  );
}

export function actionsForTable(scenario, tableId, fieldId = null) {
  return (scenario?.steps || []).filter((step) =>
    step.bindings.some(
      (binding) =>
        binding.tableId === tableId &&
        (fieldId == null ||
          binding.fieldIds.includes(fieldId) ||
          binding.state?.fieldId === fieldId),
    ),
  );
}

export function processSelection(definition, scenarioId, activityId) {
  const scenario =
    definition?.scenarios.find((value) => value.id === scenarioId) ||
    definition?.scenarios[0] ||
    null;
  const activity =
    scenario?.steps.find((value) => value.id === activityId) ||
    scenario?.steps.find((value) => value.kind === "action") ||
    scenario?.steps[0] ||
    null;
  return { scenario, activity };
}
