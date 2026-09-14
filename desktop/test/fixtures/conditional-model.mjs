// Fictional topology reproducing a polymorphic inbox plus ordinary shared FKs.
export function conditionalModel() {
  const columns = {
    credit_applications: ['id'], loans: ['id', 'credit_id'],
    repayments: ['id', 'loan_id'], loan_items: ['id', 'loan_id'],
    notifications: ['id', 'business_type', 'business_id'],
  };
  const tables = Object.entries(columns).map(([name, names]) => ({
    id: name, name, comment: 'Fictional conditional relation example', x: 0, y: 0,
    color: '#7c3aed', indices: [], uniqueConstraints: [],
    fields: names.map(column => ({ id: `${name}.${column}`, name: column,
      type: column === 'business_type' ? 'VARCHAR' : 'BIGINT',
      ...(column === 'business_type' ? { size: 32 } : {}),
      primary: column === 'id', notNull: column === 'id', unique: false,
      increment: false, default: '', check: '', comment: column,
      reviewChineseName: column === 'business_id' ? '业务ID' : column,
    })),
  }));
  const link = (id, child, field, parent) => ({ id, name: id,
    startTableId: child, startFieldId: `${child}.${field}`,
    endTableId: parent, endFieldId: `${parent}.id`, cardinality: 'many_to_one',
    updateConstraint: 'No action', deleteConstraint: 'No action',
  });
  const relationships = [link('loan-credit', 'loans', 'credit_id', 'credit_applications'),
    link('repay-loan', 'repayments', 'loan_id', 'loans'),
    link('item-loan', 'loan_items', 'loan_id', 'loans'),
    ...[['CREDIT', 'credit_applications'], ['FINANCING', 'loans'], ['REPAYMENT', 'repayments']].map(([value, table]) => ({
      ...link(`notice-${value}`, 'notifications', 'business_id', table),
      reviewEvidence: { kind: 'logical', condition: { field: 'business_type', value }, description: 'Mutually exclusive business-type branch, not a physical FK' },
    })),
  ];
  const groups = [{ id: 'business', name: 'Business', color: '#2563eb', tableIds: Object.keys(columns).filter(n => n !== 'notifications') },
    { id: 'inbox', name: 'Inbox', color: '#7c3aed', tableIds: ['notifications'] }];
  return { title: 'Conditional relations', database: 'mysql', tables, relationships,
    groups, reviewGroups: groups, notes: [], subjectAreas: [], views: [], types: [], enums: [] };
}
