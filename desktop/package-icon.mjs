import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

export function packageIcon(here) {
  const png=path.join(here,'assets/icon.png');
  if(process.platform!=='darwin')return undefined;
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'er-wiki-icon-')),iconset=path.join(directory,'App.iconset');
  fs.mkdirSync(iconset);
  for(const size of [16,32,128,256,512])for(const scale of [1,2])
    execFileSync('sips',['-z',String(size*scale),String(size*scale),png,'--out',path.join(iconset,`icon_${size}x${size}${scale===2?'@2x':''}.png`)],{stdio:'ignore'});
  const output=path.join(directory,'App.icns');execFileSync('iconutil',['-c','icns',iconset,'-o',output],{stdio:'inherit'});return output;
}
