export const modulePath = (value) =>
  String(value).replaceAll("\\", "/").split("?")[0];

export function excludedPackageSource(relativePath) {
  return /(?:^|\/)(?:node_modules|dist|release|test-results|\.git)(?:\/|$)/.test(
    modulePath(relativePath),
  );
}
