import { useEffect, useRef } from 'react';
import { Toast } from '@douyinfe/semi-ui';
import { db } from '../../work/drawdb/src/data/db';
import { importModel, exportModel } from './model-file';

export function useDesktopWorkspace(value) {
  const current = useRef(value);
  current.current = value;
  useEffect(() => {
    if (!window.erDesktop) return;
    document.body.classList.add('drawdb-desktop');
    let busy = false;

    // Commit focused inputs before reading React state (including onBlur edits).
    const settleEditor = async () => {
      document.activeElement?.blur();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    };
    const leave = async () => {
      await settleEditor();
      const state = current.current;
      if (!state.ready) throw new Error('模型尚未载入，请稍后重试');
      if (state.isDirty()) {
        const choice = state.autosave ? 'save' : await window.erDesktop.confirmLeave();
        if (choice === 'cancel') return false;
        if (choice === 'save') await current.current.save();
      }
      // Independent viewport transaction: never persists discarded field edits.
      const { snapshot } = current.current;
      if (snapshot.diagramId) {
        await db.diagrams.where('diagramId').equals(snapshot.diagramId)
          .modify({ pan: snapshot.pan, zoom: snapshot.zoom });
      }
      return true;
    };
    const run = async ({ id, action, route, targetId }) => {
      if (busy) { if (id) window.erDesktop.commandResult(id, false); return; }
      busy = true;
      let ok = false;
      try {
        await settleEditor();
        if (!current.current.ready) throw new Error('模型尚未载入，请稍后重试');
        if (action === 'export') {
          const { snapshot } = current.current;
          ok = await window.erDesktop.exportModel(snapshot.name, exportModel(snapshot));
          if (ok) Toast.success('已导出模型文件；后续编辑不会自动更新该文件');
        } else if (action === 'import') {
          const file = await window.erDesktop.openModel();
          if (!file) return;
          const model = importModel(file.json, file.name);
          if (!await leave()) return;
          await db.diagrams.add(model);
          current.current.navigate(`/editor/diagrams/${model.diagramId}`);
          Toast.success('已导入为新副本，原模型与文件均未覆盖');
          ok = true;
        } else if (action === 'switch') {
          if(typeof targetId!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(targetId))throw new Error('无效的模型标识');
          if(targetId===current.current.snapshot.diagramId){ok=true;return;}
          const target=await db.diagrams.where('diagramId').equals(targetId).first();
          if(!target)throw new Error('模型不存在或已被删除');
          if(!await leave())return;
          current.current.navigate(`/editor/diagrams/${target.diagramId}`);
          ok=true;
        } else if (action === 'navigate' && /^\/editor\/templates\/[a-zA-Z0-9_-]{1,128}$/.test(route)) {
          if (!await leave()) return;
          current.current.navigate(route);
          ok = true;
        } else if (action === 'leave') {
          ok = await leave();
        }
      } catch (error) {
        Toast.error({ content: error.message || '操作失败，模型未关闭', duration: 8 });
      } finally {
        busy = false;
        if (id) window.erDesktop.commandResult(id, ok);
      }
    };
    const remove = window.erDesktop.onCommand(run);
    const onLocalCommand = event => run({ action: event.detail });
    const onNavigate = event => run({ action: 'navigate', route: event.detail });
    const onSwitch = event => run({action:'switch',targetId:event.detail}).finally(()=>window.dispatchEvent(new Event('erwiki-switch-model-complete')));
    window.addEventListener('erwiki-command', onLocalCommand);
    window.addEventListener('erwiki-navigate', onNavigate);
    window.addEventListener('erwiki-switch-model', onSwitch);
    return () => {
      remove(); window.removeEventListener('erwiki-command', onLocalCommand);
      window.removeEventListener('erwiki-navigate', onNavigate);
      window.removeEventListener('erwiki-switch-model', onSwitch);
    };
  }, []);
}
