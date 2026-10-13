// Display preferences never enter the projection, routing or saved model data.
export const DISPLAY_OPTION_DEFAULTS = Object.freeze({
  edaGrid: true,
  edaRelationLabels: true,
  edaPortMarkers: true,
  edaDimOthers: true,
  edaCardinality: true,
  edaSemanticZoom: true,
  edaMinimap: true,
  edaMetrics: false,
});

export function displayOptionsPatch(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.keys(DISPLAY_OPTION_DEFAULTS)
    .filter(key => Object.hasOwn(value, key) && typeof value[key] === 'boolean')
    .map(key => [key, value[key]]));
}

export const normalizeDisplayOptions = value => ({ ...DISPLAY_OPTION_DEFAULTS, ...displayOptionsPatch(value) });

export const displayOpacity = (hasActive, highlighted, dimOthers = true, faded = 0.2) =>
  dimOthers && hasActive && !highlighted ? faded : 1;
