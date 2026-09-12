import { useState } from 'react';
import { Popover } from '@douyinfe/semi-ui';

export default function ReadingBookmarks({ session }) {
  const [name, setName] = useState('');
  return <Popover trigger="click" position="bottomLeft" content={<div className="eda-bookmarks">
    <strong>阅读书签</strong><p>保存当前领域、选中表和视角，不修改模型。</p>
    <form onSubmit={e => { e.preventDefault(); session.addBookmark(name); setName(''); }}>
      <input aria-label="书签名称" placeholder="例如：订单到发货" value={name} maxLength={120} onChange={e => setName(e.target.value)}/>
      <button disabled={!name.trim()}>添加</button>
    </form>
    {!session.bookmarks.length && <p>尚无书签</p>}
    {session.bookmarks.map(b => <div className="eda-bookmark-row" key={b.id}>
      <button onClick={() => session.openBookmark(b)} title={b.name}>{b.name}</button>
      <button aria-label={`删除书签 ${b.name}`} onClick={() => session.removeBookmark(b.id)}>×</button>
    </div>)}
  </div>}><button aria-label="阅读书签" title="阅读书签"><i className="bi bi-bookmark" aria-hidden="true"/></button></Popover>;
}
