// A replacement is a complete document, not a merge or a new diagram.
export function replacementRecord(existing, incoming, title) {
  if (!existing?.diagramId || existing.id == null)
    throw new Error("The current model must be saved before replacing it");
  return {
    ...incoming,
    id: existing.id,
    diagramId: existing.diagramId,
    name:
      typeof title === "string" && title.trim() ? title.trim() : existing.name,
    lastModified: new Date(),
  };
}

export async function commitReplacement(db, expected, next, stillCurrent) {
  return db.transaction("rw", db.diagrams, async () => {
    const rows = await db.diagrams
      .where("diagramId")
      .equals(expected.diagramId)
      .toArray();
    if (
      rows.length !== 1 ||
      JSON.stringify(rows[0]) !== JSON.stringify(expected) ||
      !stillCurrent()
    )
      throw new Error(
        "The current model changed during replacement; retry with the current document",
      );
    if (next.id !== expected.id || next.diagramId !== expected.diagramId)
      throw new Error("Replacement must retain the current model identity");
    await db.diagrams.put(next);
    return next;
  });
}
