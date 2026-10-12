export const CONTEXT_VIEWS = ['details', 'references', 'queries'];
export function cleanReadingLayout(value = {}) {
  value = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const context = Array.isArray(value.children) ? value.children.find(item => item?.id === 'context') : null;
  return { type: 'split', direction: value.direction === 'vertical' ? 'vertical' : 'horizontal',
    directoryVisible: typeof value.directoryVisible === 'boolean' ? value.directoryVisible : null,
    children: [{ type: 'leaf', id: 'diagram', view: 'diagram' }, { type: 'tabs', id: 'context',
      active: CONTEXT_VIEWS.includes(context?.active) ? context.active : 'details', visible: context?.visible === true,
      children: CONTEXT_VIEWS.map(view => ({ type: 'leaf', id: view, view })) }] };
}
export const contextLayout = (value, patch) => {
  const layout = cleanReadingLayout(value);
  return { ...layout, children: layout.children.map(item => item.id === 'context' ? { ...item, ...patch } : item) };
};
