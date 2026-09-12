import { renderToStaticMarkup } from 'react-dom/server';
import EdaScene from './EdaScene';

export function diagramSvg(result, view, style, {showCardinality=true,...sceneProps} = {}) {
  const text = renderToStaticMarkup(<EdaScene result={result} view={view} selectedNet={null} showCardinality={showCardinality} onNet={()=>{}} onNode={()=>{}} onEdit={()=>{}} onField={()=>{}} onView={()=>{}} {...sceneProps}/>);
  const document = new DOMParser().parseFromString(text, 'image/svg+xml'), svg = document.documentElement;
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', String(Math.ceil(view[2]))); svg.setAttribute('height', String(Math.ceil(view[3])));
  svg.removeAttribute('class');
  const palette = ['--wiki-ink','--wiki-muted','--wiki-card','--wiki-line','--wiki-surface','--wiki-type-number','--wiki-grid','--wiki-canvas','--eda-active','--eda-field-active'];
  const css = document.createElementNS(svg.namespaceURI, 'style');
  css.textContent = `svg{${palette.map(k=>`${k}:${style.getPropertyValue(k)}`).join(';')};background:var(--wiki-canvas);font-family:system-ui,sans-serif}
    .eda-node-title{font-size:14px;font-weight:600;fill:var(--wiki-ink)}
    .eda-small{font-size:11px;fill:var(--wiki-muted)}
    .eda-label-code{font-size:12px;font-weight:600;fill:var(--wiki-ink)}
    .eda-field-name{font-size:11px;fill:var(--wiki-ink)}.eda-field-type{font-size:10px;fill:var(--wiki-type-number)}`;
  svg.insertBefore(css, svg.firstChild);
  return new XMLSerializer().serializeToString(svg);
}

export async function svgToPng(svgText, view) {
  const scale = Math.min(2, 8192 / Math.max(view[2], view[3]), Math.sqrt(24_000_000 / (view[2] * view[3])));
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.ceil(view[2]*scale)); canvas.height = Math.max(1,Math.ceil(view[3]*scale));
  const image = new Image(), url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
  try {
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('无法生成图片，请尝试 SVG 导出'));image.src=url;});
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG export failed')),'image/png'));
  } finally { URL.revokeObjectURL(url); }
}
