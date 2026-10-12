import { useEffect, useRef, useState } from 'react';
import CanvasEditorDialog from '@drawdb/components/EditorCanvas/CanvasEditorDialog';
import { tr, useLocale } from '../i18n/renderer';
import { exportReadingHtml } from './html-reader.mjs';
import { diagramSvg } from './export-diagram';
import { createLayoutTask } from './layout-task.mjs';

// Parent owns visibility. Export jobs use existing layout workers and the
// restricted native exportAsset channel; no renderer filesystem access.
export default function ReadingExport({ model, title = model?.title || 'ER Wiki', diagramViews = model?.diagramViews || [], onClose }) {
  const { i18n } = useLocale();
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const job = useRef(null), controller = useRef(null), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); job.current?.cancel(); }; }, []);
  const close = () => { controller.current?.abort(); job.current?.cancel(); onClose?.(); };
  const arrange = (documentModel, options) => {
    const task = createLayoutTask(() => new Worker(new URL('./layout.worker.js', import.meta.url), { type: 'module' }), documentModel, options);
    job.current = task;
    return task.promise.finally(() => { if (job.current === task) job.current = null; });
  };
  const run = async () => {
    const abort = new AbortController(); controller.current = abort;
    setBusy(true); setError(''); setMessage('');
    try {
      const style = getComputedStyle(document.querySelector('.eda-workspace') || document.documentElement);
      const html = await exportReadingHtml(model, {
        title, diagramViews, language: i18n.language, signal: abort.signal, layout: arrange,
        sceneToSvg: (result, view, props) => diagramSvg(result, view, style, props),
        onProgress: ({ completed, total, name }) => { if (mounted.current) setMessage(tr('正在生成阅读视图 {{v0}} / {{v1}}：{{v2}}', { v0: Math.min(completed + 1, total), v1: total, v2: name })); },
      });
      if (abort.signal.aborted) return;
      const exported = await window.erDesktop.exportAsset({ name: title, extension: 'html', content: html });
      if (exported && mounted.current) setMessage(tr('离线阅读器已导出，双击 HTML 文件即可打开。'));
      else if (mounted.current) setMessage('');
    } catch (cause) {
      if (!abort.signal.aborted && mounted.current) { setError(tr(cause.message)); setMessage(''); }
    } finally {
      if (mounted.current) setBusy(false);
      if (controller.current === abort) controller.current = null;
    }
  };
  return <CanvasEditorDialog title={tr('导出离线阅读器')} visible footerNote="" onClose={close}>
    <div className="desktop-form">
      <p>{tr('导出完整模型与全部保存视图，包含字段文档、关联依据、搜索和图文定位。')}</p>
      <p>{tr('单个 HTML 文件可离线打开，无需服务器。候选关联保留在文档中，并明确标记为未确认。')}</p>
      <p>{tr('视图数量：{{v0}}', { v0: diagramViews.length + 1 })}</p>
      <button type="button" disabled={busy || !model?.tables?.length} onClick={run}>{tr(busy ? '正在导出…' : '导出 HTML')}</button>
      {busy && <button type="button" onClick={close}>{tr('取消')}</button>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </div>
  </CanvasEditorDialog>;
}
