const https = require('node:https');
const RELEASES = 'https://github.com/ztcshen/er-wiki/releases';
function versionParts(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-preview\.(\d+))?$/.exec(value || '');
  return match ? [...match.slice(1, 4).map(Number), match[4] === undefined ? Number.MAX_SAFE_INTEGER : Number(match[4])] : null;
}
function isNewer(candidate, current) {
  const a = versionParts(candidate), b = versionParts(current); if (!a || !b) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}
function checkUpdates(current) {
  // Explicit user action only. Never send model content, profile paths or identifiers.
  return new Promise((resolve, reject) => {
    const request = https.get('https://api.github.com/repos/ztcshen/er-wiki/releases?per_page=20',
      { headers: { 'User-Agent': 'er-wiki-update-check', Accept: 'application/vnd.github+json' }, timeout: 12000 }, response => {
        if (response.statusCode !== 200) { response.resume(); reject(new Error(`GitHub HTTP ${response.statusCode}`)); return; }
        let body = ''; response.setEncoding('utf8');
        response.on('data', chunk => { body += chunk; if (body.length > 1024 * 1024) request.destroy(new Error('Update response too large')); });
        response.on('end', () => { try {
          const releases = JSON.parse(body); if (!Array.isArray(releases)) throw new Error('Invalid release response');
          const latest = releases.filter(r => !r.draft && versionParts(r.tag_name)).sort((a, b) => isNewer(a.tag_name, b.tag_name) ? -1 : 1)[0];
          resolve({ current, latest: latest?.tag_name || current, available: !!latest && isNewer(latest.tag_name, current), url: RELEASES });
        } catch (error) { reject(error); } });
        response.on('error', reject);
      });
    request.on('timeout', () => request.destroy(new Error('Update check timed out'))); request.on('error', reject);
  });
}
module.exports = { isNewer, checkUpdates, RELEASES };
