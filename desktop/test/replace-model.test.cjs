const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {
  replacementArgs,
  createModelHandoff,
} = require("../native/model-handoff.cjs");

test("replacement retains identity and replaces, rather than merges, the complete document", async () => {
  const { replacementRecord } = await import("../renderer/replace-model.mjs");
  const old = {
    id: 0,
    diagramId: "same",
    name: "old",
    tables: ["removed"],
    references: ["removed"],
    reviewGroups: ["removed"],
  };
  const next = replacementRecord(
    old,
    { diagramId: "new-id", tables: [], references: [], reviewGroups: [] },
    "new title",
  );
  assert.equal(next.id, 0);
  assert.equal(next.diagramId, "same");
  assert.equal(next.name, "new title");
  assert.deepEqual(next.tables, []);
  assert.deepEqual(old.tables, ["removed"]);
  assert.throws(() => replacementRecord({}, {}, ""), /saved/);
});

test("replacement refuses stale identities/documents and leaves data intact on write failure", async () => {
  const { commitReplacement } = await import("../renderer/replace-model.mjs");
  const old = { id: 1, diagramId: "same", name: "old" },
    next = { ...old, name: "new" };
  let stored = old,
    fail = false;
  const db = {
    diagrams: {
      where: () => ({ equals: () => ({ toArray: async () => [stored] }) }),
      put: async (value) => {
        if (fail) throw Error("quota");
        stored = value;
      },
    },
    transaction: async (_mode, _table, fn) => fn(),
  };
  await assert.rejects(
    commitReplacement(db, old, next, () => false),
    /changed/,
  );
  fail = true;
  await assert.rejects(
    commitReplacement(db, old, next, () => true),
    /quota/,
  );
  assert.deepEqual(stored, old);
  fail = false;
  await assert.rejects(
    commitReplacement(db, old, { ...next, id: 2 }, () => true),
    /identity/,
  );
  await commitReplacement(db, old, next, () => true);
  assert.deepEqual(stored, next);
  await assert.rejects(
    commitReplacement(db, old, next, () => true),
    /changed/,
  );
});

test("CLI replacement uses explicit file and model id; rejects ambiguous commands", () => {
  assert.equal(replacementArgs(["app"], "/tmp"), null);
  assert.deepEqual(replacementArgs(['--replace-model=/tmp/a b.json','--model-id=a-1'],'/tmp'),{file:'/tmp/a b.json',targetId:'a-1'});
  assert.deepEqual(
    replacementArgs(
      ["app", "--replace-model", "m.json", "--model-id", "a-1"],
      "/tmp",
    ),
    { file: "/tmp/m.json", targetId: "a-1" },
  );
  for (const args of [
    ["--replace-model", "x"],
    ["--replace-model", "x", "--model-id", "../x"],
    ["--replace-model", "x", "--replace-model", "y", "--model-id", "a"],
  ])
    assert.throws(() => replacementArgs(args, "/tmp"));
});

test("handoff waits for workspace, never targets another model, and reports the settled result", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "er-replace-unit-")),
    file = path.join(dir, "model.json");
  await fs.writeFile(file, '{"tables":[]}');
  const results = [],
    requests = [];
  const handoff = createModelHandoff({
    request: async (payload) => {
      requests.push(payload);
      return true;
    },
    writeResult: async (value) => results.push(value),
    timeoutMs: 1000,
  });
  await handoff.enqueue(["--replace-model", file, "--model-id", "a"], dir);
  assert.equal(requests.length, 0);
  handoff.ready("wrong");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(results.at(-1).ok, false);
  assert.equal(requests.length, 0);
  handoff.ready("a");
  await handoff.enqueue(["--replace-model", file, "--model-id", "a"], dir);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(results.at(-1).ok, true);
  assert.equal(requests[0].targetId, "a");
});
