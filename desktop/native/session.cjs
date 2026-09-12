const { pathToFileURL } = require("node:url");
const { allowsPermission, assetPath } = require("../security.cjs");

function installSessionPolicy({ session, protocol, net, root, getWindow }) {
  const permissionContext = (contents, details) => ({
    focused: Boolean(
      getWindow()?.isFocused() && contents === getWindow().webContents,
    ),
    mainFrame: details.isMainFrame === true,
    url: details.requestingUrl,
  });
  session.defaultSession.setPermissionRequestHandler(
    (contents, permission, callback, details) =>
      callback(
        allowsPermission(permission, permissionContext(contents, details)),
      ),
  );
  session.defaultSession.setPermissionCheckHandler(
    (contents, permission, origin, details) =>
      allowsPermission(
        permission,
        permissionContext(contents, {
          ...details,
          requestingUrl: details.requestingUrl || origin,
        }),
      ),
  );
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: /^(https?|wss?|ftp):/i.test(details.url) });
  });
  // Monaco's AMD worker bootstrap needs eval; all scripts/assets remain local.
  const csp =
    "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
  protocol.handle("erwiki", async (request) => {
    if (request.method !== "GET")
      return new Response("Method not allowed", { status: 405 });
    const file = assetPath(root, request.url);
    if (!file) return new Response("Forbidden", { status: 403 });
    try {
      const response = await net.fetch(pathToFileURL(file).href);
      const headers = new Headers(response.headers);
      headers.set("Content-Security-Policy", csp);
      headers.set("X-Content-Type-Options", "nosniff");
      return new Response(response.body, { status: response.status, headers });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}
module.exports = { installSessionPolicy };
