import { useEffect, useRef } from 'react';
import { Toast } from '@douyinfe/semi-ui';
import { db } from '@drawdb/data/db';
import { importModel, exportModel } from './model-file';
import { tr } from '../i18n/renderer';
import { openPanel, openCommandPalette } from './commands';
import { replaceWorkspace } from './replace-workspace';
import { useSelect } from '@drawdb/hooks';
import { ObjectType } from '@drawdb/data/constants';
import { sqlExportModel } from '../review/sql-export-model.mjs';
import { readWorkspace } from './read-workspace';
import { assertReadableDraft } from './model-content.mjs';
import { layoutObserver } from '../eda/layout-observation.mjs';

export function useDesktopWorkspace(value) {
  const { setSelectedElement, setBulkSelectedElements } = useSelect();
  const current = useRef(value);
  current.current = value;
  useEffect(() => {
    window.erDesktop?.workspaceReady(value.ready ? value.snapshot.diagramId || null : null);
    return () => window.erDesktop?.workspaceReady(null);
  }, [value.ready, value.snapshot.diagramId]);
  useEffect(() => {
    if (!value.ready || !value.lastSaved || !value.snapshot.diagramId || !window.erDesktop) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        // Read the committed record, never unsaved React state, for automatic backups.
        const saved = await db.diagrams.where('diagramId').equals(value.snapshot.diagramId).first();
        if (saved && active) await window.erDesktop.createBackup({ modelId: saved.diagramId, name: saved.name, json: exportModel(saved) }, true);
      } catch (error) { if (active) Toast.warning({ content: tr('自动备份失败，模型仍保存在工作区。') + ' ' + tr(error.message), duration: 8 }); }
    }, 400);
    return () => { active = false; clearTimeout(timer); };
  }, [value.lastSaved, value.ready, value.snapshot.diagramId]);
  useEffect(() => {
    if (!window.erDesktop) return;
    document.body.classList.add('drawdb-desktop');
    let busy = false;

    // Commit focused inputs before reading React state (including onBlur edits).
    const settleEditor = async () => {
      document.activeElement?.blur();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if(document.querySelector('[data-editor-draft-invalid="true"]'))throw new Error('请先修正无效的长度或精度，或按 Esc 取消输入。');
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
    const run = async ({ id, requestId, action, route, targetId, json, name, backupId, expectedContentHash, resolve }) => {
      if (action === 'palette') { openCommandPalette(); return; }
      if (action === 'settings' || action === 'help') { openPanel(action); return; }
      if (busy) { const result = {ok:false,errorCode:'WORKSPACE_BUSY',message:tr('请等待当前操作完成')}; if (id) window.erDesktop.commandResult(id, result); resolve?.({...result,error:result.message}); return; }
      busy = true;
      let ok = false;
      let failure;
      let details = {};
      try {
        if (action === 'read-current' || expectedContentHash != null) assertReadableDraft(document);
        else await settleEditor();
        if (!current.current.ready) throw new Error('模型尚未载入，请稍后重试');
        if (action === 'read-current') {
          details = await readWorkspace(current, targetId); ok = true;
        } else if (action === 'save') {
          if(current.current.readOnly)throw new Error('只读模式下不可保存模型');
          await current.current.save(); ok = true;
        } else if (action === 'replace' || action === 'replace-json') {
          ok = await replaceWorkspace({ current, db, action, targetId, json, expectedContentHash, requestId });
          if (ok) {
            details = layoutObserver.current(requestId) || {};
            setSelectedElement(s => ({ ...s, element: ObjectType.NONE, id: -1, open: false, openDialogue: false }));
            setBulkSelectedElements([]);
            Toast.success(tr('当前模型已完整替换，图形已更新；模型 ID 保持不变'));
          }
        } else if (action === 'export') {
          const { snapshot } = current.current;
          ok = await window.erDesktop.exportModel(snapshot.name, exportModel(snapshot));
          if (ok) Toast.success(tr('已导出模型文件；后续编辑不会自动更新该文件'));
        } else if (['import','import-json','restore','clone','new'].includes(action)) {
          let file;
          if (action === 'import') file = await window.erDesktop.openModel();
          else if (action === 'restore') file = await window.erDesktop.readBackup(backupId);
          else if (action === 'clone') file = { json: exportModel(current.current.snapshot), name: current.current.snapshot.name };
          else if (action === 'new') file = { json: JSON.stringify({title:tr('新模型'),database:'mysql',tables:[],relationships:[],notes:[],subjectAreas:[]}),name:tr('新模型') };
          else file = { json, name };
          if (!file) return;
          const model = importModel(file.json, file.name);
          if (action === 'new') model.name = tr('新模型');
          if (action === 'restore') model.name = `${file.name} · ${tr('恢复副本')}`;
          if (!await leave()) return;
          await db.diagrams.add(model);
          current.current.navigate(`/editor/diagrams/${model.diagramId}`);
          Toast.success(tr('已导入为新副本，原模型与文件均未覆盖'));
          ok = true;
        } else if (action === 'backup') {
          const snapshot = current.current.snapshot;
          await window.erDesktop.createBackup({modelId:snapshot.diagramId||'blank',name:snapshot.name,json:exportModel(snapshot)});
          ok = true;
        } else if (action === 'export-sql') {
          const { exportSQL } = await import('@drawdb/utils/exportSQL');
          const snapshot = current.current.snapshot;
          const { model, skippedRelationships } = sqlExportModel(snapshot);
          const sql = exportSQL(model);
          if (!sql) throw new Error('当前数据库类型不支持 SQL 导出，请使用 JSON');
          ok = await window.erDesktop.exportAsset({name:snapshot.name,extension:'sql',content:sql});
          if (ok && skippedRelationships.length) {
            const counts = skippedRelationships.reduce((all, relation) => {
              all[relation.reason] = (all[relation.reason] || 0) + 1; return all;
            }, {});
            Toast.warning({ content: `${tr('未导出为物理外键的关系')} (${skippedRelationships.length}): ${Object.entries(counts).map(([reason, count]) => `${tr(reason)} × ${count}`).join('; ')}`, duration: 0 });
          }
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
        failure=tr(error.message || '操作失败，模型未关闭');
        details = { errorCode: error.code || 'COMMAND_FAILED', message: failure,
          errors: error.errors || [], warnings: error.warnings || [] };
        if(!resolve)Toast.error({ content: failure, duration: 8 });
      } finally {
        busy = false;
        const result = {ok,error:failure,...details};
        if (id) window.erDesktop.commandResult(id, result);
        resolve?.(result);
      }
    };
    const remove = window.erDesktop.onCommand(run);
    const onLocalCommand = event => run(typeof event.detail==='string'?{ action: event.detail }:event.detail);
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
