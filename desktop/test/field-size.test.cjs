const { test } = require("node:test");
const assert = require("node:assert/strict");
test("length accepts typed integers and rejects partial, negative or scientific input", async () => {
  const { parseFieldSize } = await import("../renderer/field-size.mjs");
  for (const value of ["128", "256", "1024", " 256 ", "000256", 0])
    assert.equal(parseFieldSize(value).valid, true);
  assert.equal(parseFieldSize("000256").value, "256");
  for (const value of [
    "",
    null,
    "-1",
    "1.2",
    "1e3",
    "varchar(256)",
    "12,2",
    "Infinity",
    "9007199254740993",
  ])
    assert.equal(parseFieldSize(value).valid, false, String(value));
});
test("precision supports p and p,s without inventing dialect-specific limits", async () => {
  const { parseFieldSize } = await import("../renderer/field-size.mjs");
  assert.deepEqual(parseFieldSize("18, 4", true), {
    valid: true,
    value: "18,4",
  });
  assert.deepEqual(parseFieldSize("10", true), { valid: true, value: "10" });
  assert.deepEqual(parseFieldSize("", true), { valid: true, value: "" });
  for (const value of ["18,", "1,2,3", "a,b", "-2,1"])
    assert.equal(parseFieldSize(value, true).valid, false);
});
