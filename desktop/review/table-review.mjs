const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function reviewContextErrors(context) {
  if (context === undefined) return [];
  const errors = [];
  const invalid = path => errors.push({ code: 'TABLE_CONTEXT_INVALID', path, message: '表业务说明格式无效' });
  if (!object(context)) { invalid('reviewContext'); return errors; }
  for (const key of ['purpose', 'grain']) if (context[key] !== undefined && typeof context[key] !== 'string') invalid(`reviewContext.${key}`);
  if (context.authority !== undefined) {
    const authority = context.authority;
    if (!object(authority)) invalid('reviewContext.authority');
    else {
      if (!['design', 'observed', 'unknown'].includes(authority.kind)) invalid('reviewContext.authority.kind');
      if (typeof authority.summary !== 'string') invalid('reviewContext.authority.summary');
      if (authority.source !== undefined) {
        if (!object(authority.source)) invalid('reviewContext.authority.source');
        else {
          if (!['ddl', 'code', 'doc'].includes(authority.source.kind)) invalid('reviewContext.authority.source.kind');
          if (typeof authority.source.locator !== 'string') invalid('reviewContext.authority.source.locator');
        }
      }
    }
  }
  return errors;
}

export function tableConstraints(table) {
  const fields = table.fields || [];
  const resolve = reference => {
    const matches = fields.filter(field => field.id === reference || field.name === reference);
    return matches.length === 1 ? { id: matches[0].id, name: matches[0].name } : { reference, invalid: true, ambiguous: matches.length > 1 };
  };
  const primary = fields.filter(field => field.primary);
  return [
    ...(primary.length ? [{ name: 'PRIMARY', kind: 'primary', fields: primary.map(field => ({ id: field.id, name: field.name })) }] : []),
    ...fields.filter(field => field.unique && !field.primary).map(field => ({ name: field.name, kind: 'unique', fields: [{ id: field.id, name: field.name }] })),
    ...(table.indices || []).map(index => ({ name: index.name, kind: index.unique ? 'unique' : 'index', fields: index.fields.map(resolve) })),
    ...(table.uniqueConstraints || []).map(index => ({ name: index.name, kind: 'unique', fields: index.fields.map(resolve) })),
  ];
}

export function tableBusinessName(table) {
  return typeof table.reviewChineseName === 'string' ? table.reviewChineseName.trim() : '';
}
