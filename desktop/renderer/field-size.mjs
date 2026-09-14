// Syntax validation only. Charset, row size and dialect-specific limits still
// belong to the target database; this editor never executes DDL.
export function parseFieldSize(value, precision = false) {
  const text = String(value ?? "").trim();
  if (precision && text === "") return { valid: true, value: "" };
  const pattern = precision ? /^\d+(?:\s*,\s*\d+)?$/ : /^\d+$/;
  if (!pattern.test(text)) return { valid: false };
  const parts = text.split(",").map((part) => Number(part.trim()));
  if (!parts.every((part) => Number.isSafeInteger(part) && part >= 0))
    return { valid: false };
  return { valid: true, value: parts.join(",") };
}
