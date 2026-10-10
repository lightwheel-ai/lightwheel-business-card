// In-memory test double: no Auth, database or storage network requests.
type Row = Record<string, any>;
const records: Row[] = [
  {
    id: 'fixture-1',
    name: 'Test Person',
    title: 'Product Director',
    phone: '+86 13800008888',
    email: 'user@example.com',
    template: 'english',
    source: '英文名片Test Person.png',
    needs_review: true,
    version: 1,
    updated_at: new Date().toISOString(),
  },
];
const events: Row[] = [];
export const diagnostics = { saves: 0, search: '', failNext: false };
const result = (data: any) => ({ data, error: null });
export const supabase = {
  auth: {
    getSession: async () =>
      result({
        session: {
          user: { id: 'local-test-manager', email: 'test@example.invalid' },
        },
      }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => result(null),
    signInWithOtp: async () => result(null),
    verifyOtp: async () => result(null),
  },
  from(table: string) {
    let rows =
      table === 'card_records'
        ? records.filter((r) => !r.deleted)
        : table === 'card_events'
          ? events
          : [];
    const query = {
      select() {
        return query;
      },
      ilike(_key: string, value: string) {
        diagnostics.search = value;
        const term = value.slice(1, -1).replace(/\\/g, '').toLowerCase();
        rows = rows.filter((r) => r.name.toLowerCase().includes(term));
        return query;
      },
      order() {
        rows = [...rows].reverse();
        return query;
      },
      range(a: number, b: number) {
        rows = rows.slice(a, b + 1);
        return query;
      },
      eq(key: string, value: string) {
        rows = rows.filter((r) => r[key] === value);
        return query;
      },
      limit(n: number) {
        rows = rows.slice(0, n);
        return query;
      },
      then(resolve: (data: any) => unknown) {
        return Promise.resolve(result(structuredClone(rows))).then(resolve);
      },
    };
    return query;
  },
  async rpc(name: string, args: Row = {}) {
    if (name === 'card_access') return result({ manager: true, owner: false });
    if (name === 'card_save') {
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (diagnostics.failNext) {
        diagnostics.failNext = false;
        return { data: null, error: { code: 'NETWORK' } };
      }
      let row = records.find((row) => row.id === args.record_id);
      if (row && row.version !== args.expected_version)
        return { data: null, error: { code: '40001' } };
      if (!row) {
        row = {
          id: crypto.randomUUID(),
          version: 0,
          source: args.fields.source ?? 'manual',
        };
        records.push(row);
      }
      Object.assign(row, args.fields, {
        version: row.version + 1,
        updated_at: new Date().toISOString(),
      });
      diagnostics.saves++;
      events.push({
        id: events.length + 1,
        record_id: row.id,
        action: args.event_action,
        created_at: row.updated_at,
        snapshot: structuredClone(row),
      });
      return result(structuredClone(row));
    }
    if (name === 'card_delete' || name === 'card_restore') {
      const row = records.find((r) => r.id === args.record_id);
      if (row) row.deleted = name === 'card_delete';
      return result(null);
    }
    return result(null);
  },
  storage: {
    from() {
      return {
        upload: async () => result({}),
        createSignedUrl: async () =>
          result({
            signedUrl:
              'data:image/svg+xml,' +
              encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="340"><rect width="600" height="340" fill="white"/><text x="50" y="110" font-size="32">Test Person</text></svg>',
              ),
          }),
      };
    },
  },
};
