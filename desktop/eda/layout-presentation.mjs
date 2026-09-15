export function readingToken(view, location) {
  return JSON.stringify([view, location.selectedTable, location.selectedField, location.selectedNet, location.selectedRelation]);
}

// Applying a changed geometry after a reader navigated would move the objects
// beneath their focus. Keep the preview until they explicitly accept the result.
export function deferImprovement(preview, final, initialToken, currentToken) {
  return !!preview && initialToken !== currentToken && JSON.stringify(preview.layout) !== JSON.stringify(final.layout);
}
