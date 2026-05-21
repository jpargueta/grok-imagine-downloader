// ==UserScript==
// @name         Grok Imagine Downloader
// @namespace    https://grok.com
// @version      1.1.0
// @description  Bulk download all your Grok Imagine image and video creations to your local machine, and optionally unfavorite them to remove them from the server. Includes Dry Run mode to preview before committing.
// @author       Grok Imagine Downloader
// @match        https://grok.com/imagine*
// @icon         https://grok.com/favicon.ico
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @connect      grok.com
// @connect      assets.grok.com
// @connect      imagine-public.x.ai
// @connect      *
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // ─── Constants ────────────────────────────────────────────────────────────
  const SCRIPT_VERSION = '1.1.0';
  const API = {
    LIST:   'https://grok.com/rest/media/post/list',
    UNLIKE: 'https://grok.com/rest/media/post/unlike',
  };
  const PAGE_SIZE = 40;
  const DOWNLOAD_DELAY_MS = 350;   // ~3 downloads/sec to avoid browser limits
  const UNFAVORITE_DELAY_MS = 200; // 5 unfavorites/sec

  // ─── State ────────────────────────────────────────────────────────────────
  let state = {
    posts: [],           // All fetched posts (flat list of media items)
    isFetching: false,
    isDownloading: false,
    isUnfavoriting: false,
    cancelRequested: false,
    totalFetched: 0,
    downloadedCount: 0,
    failedCount: 0,
    unfavoritedCount: 0,
    dryRunItems: [],     // Items collected during a dry run
    downloadFolder: GM_getValue('downloadFolder', 'grok-imagine'),
    filterType: 'all',   // 'all' | 'images' | 'videos'
    dryRunMode: GM_getValue('dryRunMode', false),
  };

  // ─── Styles ───────────────────────────────────────────────────────────────
  GM_addStyle(`
    #gid-panel {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 400px;
      max-height: 90vh;
      overflow-y: auto;
      background: rgba(8, 12, 24, 0.97);
      border: 1px solid rgba(59, 130, 246, 0.35);
      border-radius: 16px;
      box-shadow: 0 0 40px rgba(59, 130, 246, 0.15), 0 24px 64px rgba(0,0,0,0.6);
      font-family: 'Outfit', 'Inter', system-ui, sans-serif;
      color: #e2e8f0;
      z-index: 999999;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      transition: transform 0.25s cubic-bezier(0.23, 1, 0.32, 1), opacity 0.25s ease;
    }
    #gid-panel.gid-hidden {
      transform: translateY(12px) scale(0.97);
      opacity: 0;
      pointer-events: none;
    }
    #gid-toggle-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 20px rgba(59, 130, 246, 0.5), 0 8px 24px rgba(0,0,0,0.4);
      z-index: 999998;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    #gid-toggle-btn:hover {
      transform: scale(1.08);
      box-shadow: 0 0 28px rgba(59, 130, 246, 0.7), 0 8px 24px rgba(0,0,0,0.4);
    }
    #gid-toggle-btn:active { transform: scale(0.95); }
    #gid-toggle-btn svg { width: 24px; height: 24px; fill: white; }

    .gid-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px 10px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .gid-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .gid-title {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.02em;
      background: linear-gradient(90deg, #60a5fa, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .gid-version-badge {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #475569;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 4px;
      padding: 2px 6px;
    }
    .gid-close {
      background: none;
      border: none;
      color: #64748b;
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
      line-height: 1;
      font-size: 18px;
      transition: color 0.15s;
    }
    .gid-close:hover { color: #e2e8f0; }

    .gid-body { padding: 12px 16px; }

    .gid-section-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #475569;
      margin-bottom: 8px;
    }

    .gid-stat-row {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    .gid-stat {
      flex: 1;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 10px;
      padding: 10px 8px;
      text-align: center;
    }
    .gid-stat-value {
      font-size: 20px;
      font-weight: 700;
      color: #60a5fa;
      line-height: 1;
    }
    .gid-stat-label {
      font-size: 9px;
      color: #64748b;
      margin-top: 3px;
      letter-spacing: 0.05em;
    }

    .gid-filter-row {
      display: flex;
      gap: 6px;
      margin-bottom: 12px;
    }
    .gid-filter-btn {
      flex: 1;
      padding: 7px 0;
      font-size: 11px;
      font-weight: 600;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.04);
      color: #94a3b8;
      cursor: pointer;
      transition: all 0.15s;
    }
    .gid-filter-btn:hover { background: rgba(59,130,246,0.12); color: #93c5fd; }
    .gid-filter-btn.active {
      background: rgba(59,130,246,0.2);
      border-color: rgba(59,130,246,0.5);
      color: #60a5fa;
    }

    .gid-input-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    .gid-input-label {
      font-size: 11px;
      color: #64748b;
      white-space: nowrap;
    }
    .gid-input {
      flex: 1;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 7px 10px;
      font-size: 12px;
      color: #e2e8f0;
      outline: none;
      transition: border-color 0.15s;
    }
    .gid-input:focus { border-color: rgba(59,130,246,0.5); }

    /* ── Dry Run Toggle ── */
    .gid-dryrun-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(245, 158, 11, 0.06);
      border: 1px solid rgba(245, 158, 11, 0.2);
      border-radius: 10px;
      padding: 10px 12px;
      margin-bottom: 12px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .gid-dryrun-row:hover { background: rgba(245, 158, 11, 0.1); }
    .gid-dryrun-row.active {
      background: rgba(245, 158, 11, 0.12);
      border-color: rgba(245, 158, 11, 0.45);
    }
    .gid-dryrun-left { display: flex; flex-direction: column; gap: 2px; }
    .gid-dryrun-label {
      font-size: 12px;
      font-weight: 700;
      color: #fbbf24;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .gid-dryrun-desc {
      font-size: 10px;
      color: #78716c;
      line-height: 1.4;
    }
    .gid-toggle-switch {
      position: relative;
      width: 36px;
      height: 20px;
      flex-shrink: 0;
    }
    .gid-toggle-switch input { opacity: 0; width: 0; height: 0; }
    .gid-toggle-slider {
      position: absolute;
      inset: 0;
      background: rgba(255,255,255,0.1);
      border-radius: 99px;
      transition: background 0.2s;
      cursor: pointer;
    }
    .gid-toggle-slider::before {
      content: '';
      position: absolute;
      width: 14px;
      height: 14px;
      left: 3px;
      top: 3px;
      background: #94a3b8;
      border-radius: 50%;
      transition: transform 0.2s, background 0.2s;
    }
    .gid-toggle-switch input:checked + .gid-toggle-slider {
      background: rgba(245, 158, 11, 0.4);
    }
    .gid-toggle-switch input:checked + .gid-toggle-slider::before {
      transform: translateX(16px);
      background: #fbbf24;
    }

    /* ── Dry Run Results Panel ── */
    .gid-dryrun-results {
      display: none;
      background: rgba(245, 158, 11, 0.05);
      border: 1px solid rgba(245, 158, 11, 0.2);
      border-radius: 10px;
      padding: 10px 12px;
      margin-bottom: 12px;
      max-height: 160px;
      overflow-y: auto;
    }
    .gid-dryrun-results.visible { display: block; }
    .gid-dryrun-results-header {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #fbbf24;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .gid-dryrun-item {
      font-size: 10px;
      color: #78716c;
      padding: 3px 0;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .gid-dryrun-item:last-child { border-bottom: none; }
    .gid-dryrun-item .type-badge {
      display: inline-block;
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.06em;
      padding: 1px 4px;
      border-radius: 3px;
      margin-right: 5px;
      text-transform: uppercase;
    }
    .gid-dryrun-item .type-badge.img {
      background: rgba(59,130,246,0.2);
      color: #60a5fa;
    }
    .gid-dryrun-item .type-badge.vid {
      background: rgba(139,92,246,0.2);
      color: #a78bfa;
    }
    .gid-dryrun-export {
      margin-top: 8px;
      width: 100%;
      padding: 6px 0;
      font-size: 10px;
      font-weight: 600;
      border-radius: 6px;
      border: 1px solid rgba(245,158,11,0.3);
      background: rgba(245,158,11,0.08);
      color: #fbbf24;
      cursor: pointer;
      transition: background 0.15s;
    }
    .gid-dryrun-export:hover { background: rgba(245,158,11,0.15); }

    .gid-progress-wrap {
      margin-bottom: 12px;
      display: none;
    }
    .gid-progress-wrap.visible { display: block; }
    .gid-progress-bar-bg {
      background: rgba(255,255,255,0.07);
      border-radius: 99px;
      height: 6px;
      overflow: hidden;
      margin-bottom: 6px;
    }
    .gid-progress-bar {
      height: 100%;
      border-radius: 99px;
      background: linear-gradient(90deg, #3b82f6, #8b5cf6);
      transition: width 0.3s ease;
      width: 0%;
    }
    .gid-progress-bar.dryrun {
      background: linear-gradient(90deg, #f59e0b, #fbbf24);
    }
    .gid-progress-text {
      font-size: 11px;
      color: #64748b;
      text-align: center;
    }

    .gid-status {
      font-size: 11px;
      color: #64748b;
      text-align: center;
      min-height: 16px;
      margin-bottom: 10px;
      transition: color 0.2s;
    }
    .gid-status.success { color: #4ade80; }
    .gid-status.error { color: #f87171; }
    .gid-status.warning { color: #fbbf24; }
    .gid-status.dryrun { color: #fbbf24; }

    .gid-divider {
      border: none;
      border-top: 1px solid rgba(255,255,255,0.07);
      margin: 10px 0;
    }

    .gid-btn {
      width: 100%;
      padding: 10px 16px;
      border-radius: 10px;
      border: none;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s cubic-bezier(0.23, 1, 0.32, 1);
      margin-bottom: 7px;
      letter-spacing: 0.02em;
    }
    .gid-btn:active { transform: scale(0.97); }
    .gid-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

    .gid-btn-primary {
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      color: white;
      box-shadow: 0 4px 14px rgba(59,130,246,0.3);
    }
    .gid-btn-primary:not(:disabled):hover {
      box-shadow: 0 6px 20px rgba(59,130,246,0.45);
      transform: translateY(-1px);
    }

    .gid-btn-danger {
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
    }
    .gid-btn-danger:not(:disabled):hover { background: rgba(239, 68, 68, 0.2); }

    .gid-btn-secondary {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      color: #94a3b8;
    }
    .gid-btn-secondary:not(:disabled):hover {
      background: rgba(255,255,255,0.1);
      color: #e2e8f0;
    }

    .gid-btn-cancel {
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.3);
      color: #fbbf24;
    }
    .gid-btn-cancel:not(:disabled):hover { background: rgba(245, 158, 11, 0.2); }

    .gid-btn-dryrun {
      background: linear-gradient(135deg, #d97706, #f59e0b);
      color: #1c1917;
      font-weight: 700;
      box-shadow: 0 4px 14px rgba(245,158,11,0.3);
    }
    .gid-btn-dryrun:not(:disabled):hover {
      box-shadow: 0 6px 20px rgba(245,158,11,0.45);
      transform: translateY(-1px);
    }

    .gid-footer {
      padding: 8px 16px 12px;
      border-top: 1px solid rgba(255,255,255,0.06);
      font-size: 10px;
      color: #334155;
      text-align: center;
    }
    .gid-footer a { color: #3b82f6; text-decoration: none; }
    .gid-footer a:hover { text-decoration: underline; }
  `);

  // ─── Utility ──────────────────────────────────────────────────────────────
  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function sanitizeFilename(str) {
    return (str || '').replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_').slice(0, 120);
  }

  function buildFilename(item) {
    const time = item.createTime
      ? item.createTime.slice(0, 19).replace(/:/g, '-').replace('T', '_')
      : 'unknown';
    const prompt = item.prompt ? '_' + sanitizeFilename(item.prompt).slice(0, 80) : '';
    const ext = item.isVideo ? 'mp4' : (item.mimeType === 'image/png' ? 'png' : 'jpg');
    return `${time}_${item.id}${prompt}.${ext}`;
  }

  // ─── API Calls ────────────────────────────────────────────────────────────
  function apiPost(url, body) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify(body),
        withCredentials: true,
        onload: res => {
          try { resolve(JSON.parse(res.responseText)); }
          catch { reject(new Error('Invalid JSON response')); }
        },
        onerror: () => reject(new Error('Network error')),
        ontimeout: () => reject(new Error('Request timed out')),
      });
    });
  }

  async function fetchAllPosts() {
    const allMedia = [];
    let cursor = null;
    let page = 0;

    setStatus('Fetching your library…');
    updateStat('total', '…');

    while (true) {
      if (state.cancelRequested) break;

      const body = {
        limit: PAGE_SIZE,
        filter: { source: 'MEDIA_POST_SOURCE_LIKED', safeForWork: false },
      };
      if (cursor) body.cursor = String(cursor);

      let data;
      try {
        data = await apiPost(API.LIST, body);
      } catch (e) {
        throw new Error(`Failed to fetch page ${page + 1}: ${e.message}`);
      }

      const posts = data.posts || [];
      if (posts.length === 0) break;

      for (const post of posts) {
        if (post.mediaUrl) {
          const isVideo = post.mediaType === 'MEDIA_POST_TYPE_VIDEO';
          const url = isVideo && post.hdMediaUrl ? post.hdMediaUrl : post.mediaUrl;
          allMedia.push({
            id: post.id,
            postId: post.id,
            url,
            isVideo,
            mimeType: post.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
            prompt: post.originalPrompt || post.prompt || '',
            createTime: post.createTime || '',
            modelName: post.modelName || '',
          });
        }

        if (post.childPosts && post.childPosts.length > 0) {
          for (const child of post.childPosts) {
            if (!child.mediaUrl) continue;
            const isVideo = child.mediaType === 'MEDIA_POST_TYPE_VIDEO';
            const url = isVideo && child.hdMediaUrl ? child.hdMediaUrl : child.mediaUrl;
            allMedia.push({
              id: child.id,
              postId: post.id,
              url,
              isVideo,
              mimeType: child.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
              prompt: child.originalPrompt || child.prompt || post.originalPrompt || post.prompt || '',
              createTime: child.createTime || post.createTime || '',
              modelName: child.modelName || post.modelName || '',
            });
          }
        }
      }

      page++;
      state.totalFetched = allMedia.length;
      updateStat('total', allMedia.length);
      setStatus(`Fetched ${allMedia.length} items (page ${page})…`);

      cursor = data.nextCursor || null;
      if (!cursor || posts.length < PAGE_SIZE) break;

      await sleep(150);
    }

    return allMedia;
  }

  async function unlikePost(postId) {
    try {
      const res = await apiPost(API.UNLIKE, { id: postId });
      return res && (res.success !== false);
    } catch {
      return false;
    }
  }

  // ─── Download ─────────────────────────────────────────────────────────────
  function downloadItem(item) {
    return new Promise((resolve) => {
      const filename = `${state.downloadFolder}/${buildFilename(item)}`;
      GM_download({
        url: item.url,
        name: filename,
        saveAs: false,
        onload: () => resolve(true),
        onerror: () => resolve(false),
        ontimeout: () => resolve(false),
      });
    });
  }

  // ─── UI Helpers ───────────────────────────────────────────────────────────
  function setStatus(msg, type = '') {
    const el = document.getElementById('gid-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'gid-status' + (type ? ` ${type}` : '');
  }

  function updateStat(key, val) {
    const el = document.getElementById(`gid-stat-${key}`);
    if (el) el.textContent = val;
  }

  function setProgress(pct, label, isDryRun = false) {
    const wrap = document.getElementById('gid-progress-wrap');
    const bar = document.getElementById('gid-progress-bar');
    const text = document.getElementById('gid-progress-text');
    if (!wrap) return;
    wrap.classList.add('visible');
    if (bar) {
      bar.style.width = `${Math.min(100, pct)}%`;
      bar.className = 'gid-progress-bar' + (isDryRun ? ' dryrun' : '');
    }
    if (text) text.textContent = label || '';
  }

  function hideProgress() {
    const wrap = document.getElementById('gid-progress-wrap');
    if (wrap) wrap.classList.remove('visible');
  }

  function setButtonsDisabled(disabled) {
    ['gid-btn-fetch', 'gid-btn-download', 'gid-btn-unfavorite', 'gid-btn-both', 'gid-btn-dryrun'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = disabled;
    });
    const cancelBtn = document.getElementById('gid-btn-cancel');
    if (cancelBtn) cancelBtn.disabled = !disabled;
  }

  function refreshUI() {
    updateStat('total', state.posts.length || '—');
    updateStat('downloaded', state.downloadedCount || '—');
    updateStat('unfavorited', state.unfavoritedCount || '—');
  }

  function updateDryRunToggleUI() {
    const row = document.getElementById('gid-dryrun-row');
    const checkbox = document.getElementById('gid-dryrun-checkbox');
    const actionBtns = document.getElementById('gid-action-btns');
    const dryRunBtn = document.getElementById('gid-btn-dryrun');

    if (row) row.classList.toggle('active', state.dryRunMode);
    if (checkbox) checkbox.checked = state.dryRunMode;

    if (state.dryRunMode) {
      if (actionBtns) actionBtns.style.display = 'none';
      if (dryRunBtn) dryRunBtn.style.display = 'block';
    } else {
      if (actionBtns) actionBtns.style.display = 'block';
      if (dryRunBtn) dryRunBtn.style.display = 'none';
      // Hide dry run results if switching off
      const results = document.getElementById('gid-dryrun-results');
      if (results) results.classList.remove('visible');
    }
  }

  function renderDryRunResults(items) {
    const container = document.getElementById('gid-dryrun-results');
    if (!container) return;

    const imgCount = items.filter(i => !i.isVideo).length;
    const vidCount = items.filter(i => i.isVideo).length;

    container.innerHTML = `
      <div class="gid-dryrun-results-header">
        <span>Preview — ${items.length} files</span>
        <span style="color:#64748b;font-weight:400">${imgCount} img · ${vidCount} vid</span>
      </div>
      ${items.slice(0, 50).map(item => `
        <div class="gid-dryrun-item">
          <span class="type-badge ${item.isVideo ? 'vid' : 'img'}">${item.isVideo ? 'VID' : 'IMG'}</span>
          ${buildFilename(item)}
        </div>
      `).join('')}
      ${items.length > 50 ? `<div class="gid-dryrun-item" style="color:#475569;font-style:italic">… and ${items.length - 50} more</div>` : ''}
      <button class="gid-dryrun-export" id="gid-dryrun-export-btn">⬇ Export file list as .txt</button>
    `;
    container.classList.add('visible');

    document.getElementById('gid-dryrun-export-btn').addEventListener('click', () => {
      exportDryRunList(items);
    });
  }

  function exportDryRunList(items) {
    const lines = [
      `Grok Imagine Downloader v${SCRIPT_VERSION} — Dry Run Report`,
      `Generated: ${new Date().toISOString()}`,
      `Total items: ${items.length} (${items.filter(i=>!i.isVideo).length} images, ${items.filter(i=>i.isVideo).length} videos)`,
      `Download folder: ${state.downloadFolder}/`,
      `Filter: ${state.filterType}`,
      '',
      '─── File List ───────────────────────────────────────────',
      ...items.map((item, i) =>
        `${String(i+1).padStart(4, '0')}  [${item.isVideo ? 'VIDEO' : 'IMAGE'}]  ${state.downloadFolder}/${buildFilename(item)}`
      ),
      '',
      '─── URLs ────────────────────────────────────────────────',
      ...items.map(item => item.url),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grok-dryrun-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Core Operations ──────────────────────────────────────────────────────
  async function doFetch() {
    if (state.isFetching) return;
    state.isFetching = true;
    state.cancelRequested = false;
    setButtonsDisabled(true);
    setProgress(0, 'Starting…');

    try {
      const posts = await fetchAllPosts();
      state.posts = posts;
      state.totalFetched = posts.length;
      updateStat('total', posts.length);
      setStatus(`Found ${posts.length} media items.`, 'success');
      setProgress(100, `${posts.length} items loaded`);
    } catch (e) {
      setStatus(e.message, 'error');
    } finally {
      state.isFetching = false;
      setButtonsDisabled(false);
      setTimeout(hideProgress, 2000);
    }
  }

  function getFilteredPosts() {
    if (state.filterType === 'images') return state.posts.filter(p => !p.isVideo);
    if (state.filterType === 'videos') return state.posts.filter(p => p.isVideo);
    return state.posts;
  }

  // ── Dry Run ───────────────────────────────────────────────────────────────
  async function doDryRun() {
    const items = getFilteredPosts();
    if (items.length === 0) {
      setStatus('No items to preview. Fetch your library first.', 'warning');
      return;
    }

    state.cancelRequested = false;
    setButtonsDisabled(true);
    setProgress(0, `Scanning 0 / ${items.length}`, true);
    setStatus(`Dry Run: scanning ${items.length} items…`, 'dryrun');

    const dryRunItems = [];
    for (let i = 0; i < items.length; i++) {
      if (state.cancelRequested) break;
      dryRunItems.push(items[i]);
      const pct = ((i + 1) / items.length) * 100;
      setProgress(pct, `Scanning ${i + 1} / ${items.length}`, true);
      // Small delay so the UI updates visibly
      if (i % 20 === 0) await sleep(10);
    }

    state.dryRunItems = dryRunItems;
    const imgCount = dryRunItems.filter(i => !i.isVideo).length;
    const vidCount = dryRunItems.filter(i => i.isVideo).length;

    setStatus(
      `Dry Run complete: ${dryRunItems.length} files (${imgCount} images, ${vidCount} videos). No files were downloaded or modified.`,
      'dryrun'
    );
    setProgress(100, `${dryRunItems.length} files identified`, true);
    renderDryRunResults(dryRunItems);

    setButtonsDisabled(false);
    setTimeout(hideProgress, 3000);
  }

  // ── Download ──────────────────────────────────────────────────────────────
  async function doDownload() {
    if (state.isDownloading) return;
    const items = getFilteredPosts();
    if (items.length === 0) {
      setStatus('No items to download. Fetch your library first.', 'warning');
      return;
    }

    state.isDownloading = true;
    state.cancelRequested = false;
    state.downloadedCount = 0;
    state.failedCount = 0;
    setButtonsDisabled(true);
    setProgress(0, `0 / ${items.length}`);
    setStatus(`Downloading ${items.length} files…`);

    for (let i = 0; i < items.length; i++) {
      if (state.cancelRequested) {
        setStatus(`Cancelled after ${state.downloadedCount} downloads.`, 'warning');
        break;
      }

      const ok = await downloadItem(items[i]);
      if (ok) state.downloadedCount++;
      else state.failedCount++;

      const pct = ((i + 1) / items.length) * 100;
      setProgress(pct, `${i + 1} / ${items.length} — ${state.downloadedCount} saved, ${state.failedCount} failed`);
      updateStat('downloaded', state.downloadedCount);
      await sleep(DOWNLOAD_DELAY_MS);
    }

    if (!state.cancelRequested) {
      const msg = `Done! ${state.downloadedCount} downloaded${state.failedCount > 0 ? `, ${state.failedCount} failed` : ''}.`;
      setStatus(msg, state.failedCount > 0 ? 'warning' : 'success');
    }

    state.isDownloading = false;
    setButtonsDisabled(false);
    setTimeout(hideProgress, 3000);
  }

  async function doUnfavorite(postsOverride) {
    if (state.isUnfavoriting) return;
    const items = postsOverride || getFilteredPosts();
    if (items.length === 0) {
      setStatus('No items to unfavorite. Fetch your library first.', 'warning');
      return;
    }

    if (!postsOverride) {
      const confirmed = confirm(
        `⚠️ Unfavorite ${items.length} items?\n\nThis will remove them from your Grok Imagine favorites.\n\nProceed?`
      );
      if (!confirmed) return;
    }

    state.isUnfavoriting = true;
    state.cancelRequested = false;
    state.unfavoritedCount = 0;
    setButtonsDisabled(true);
    setProgress(0, `0 / ${items.length}`);
    setStatus(`Unfavoriting ${items.length} items…`);

    const seenPostIds = new Set();
    const uniquePosts = items.filter(item => {
      if (seenPostIds.has(item.postId)) return false;
      seenPostIds.add(item.postId);
      return true;
    });

    for (let i = 0; i < uniquePosts.length; i++) {
      if (state.cancelRequested) {
        setStatus(`Cancelled after ${state.unfavoritedCount} unfavorites.`, 'warning');
        break;
      }

      const ok = await unlikePost(uniquePosts[i].postId);
      if (ok) state.unfavoritedCount++;

      const pct = ((i + 1) / uniquePosts.length) * 100;
      setProgress(pct, `${i + 1} / ${uniquePosts.length} — ${state.unfavoritedCount} removed`);
      updateStat('unfavorited', state.unfavoritedCount);
      await sleep(UNFAVORITE_DELAY_MS);
    }

    if (!state.cancelRequested) {
      setStatus(`Done! ${state.unfavoritedCount} items unfavorited.`, 'success');
    }

    state.isUnfavoriting = false;
    setButtonsDisabled(false);
    setTimeout(hideProgress, 3000);
  }

  async function doDownloadAndUnfavorite() {
    if (state.isDownloading || state.isUnfavoriting) return;
    const items = getFilteredPosts();
    if (items.length === 0) {
      setStatus('No items found. Fetch your library first.', 'warning');
      return;
    }

    const confirmed = confirm(
      `Download ${items.length} items AND unfavorite them?\n\nFiles will be saved to: ${state.downloadFolder}/\nItems will be removed from your Grok favorites.\n\nProceed?`
    );
    if (!confirmed) return;

    // Download phase
    state.isDownloading = true;
    state.cancelRequested = false;
    state.downloadedCount = 0;
    state.failedCount = 0;
    setButtonsDisabled(true);
    setProgress(0, `Downloading 0 / ${items.length}`);
    setStatus(`Downloading ${items.length} files…`);

    for (let i = 0; i < items.length; i++) {
      if (state.cancelRequested) break;
      const ok = await downloadItem(items[i]);
      if (ok) state.downloadedCount++;
      else state.failedCount++;
      setProgress(((i + 1) / items.length) * 50, `Downloading ${i + 1} / ${items.length}`);
      updateStat('downloaded', state.downloadedCount);
      await sleep(DOWNLOAD_DELAY_MS);
    }

    state.isDownloading = false;

    if (state.cancelRequested) {
      setStatus(`Cancelled. ${state.downloadedCount} downloaded.`, 'warning');
      setButtonsDisabled(false);
      return;
    }

    // Unfavorite phase
    setStatus(`Downloads complete. Unfavoriting…`);
    state.isUnfavoriting = true;
    state.unfavoritedCount = 0;

    const seenPostIds = new Set();
    const uniquePosts = items.filter(item => {
      if (seenPostIds.has(item.postId)) return false;
      seenPostIds.add(item.postId);
      return true;
    });

    for (let i = 0; i < uniquePosts.length; i++) {
      if (state.cancelRequested) break;
      const ok = await unlikePost(uniquePosts[i].postId);
      if (ok) state.unfavoritedCount++;
      setProgress(50 + ((i + 1) / uniquePosts.length) * 50, `Unfavoriting ${i + 1} / ${uniquePosts.length}`);
      updateStat('unfavorited', state.unfavoritedCount);
      await sleep(UNFAVORITE_DELAY_MS);
    }

    state.isUnfavoriting = false;
    setButtonsDisabled(false);
    setStatus(`All done! ${state.downloadedCount} downloaded, ${state.unfavoritedCount} unfavorited.`, 'success');
    setTimeout(hideProgress, 4000);
  }

  // ─── Build UI ─────────────────────────────────────────────────────────────
  function buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'gid-panel';
    panel.innerHTML = `
      <div class="gid-header">
        <div class="gid-title-row">
          <span class="gid-title">⬇ Grok Imagine Downloader</span>
          <span class="gid-version-badge">v${SCRIPT_VERSION}</span>
        </div>
        <button class="gid-close" id="gid-close-btn" title="Minimize">✕</button>
      </div>
      <div class="gid-body">

        <div class="gid-section-label">Library Stats</div>
        <div class="gid-stat-row">
          <div class="gid-stat">
            <div class="gid-stat-value" id="gid-stat-total">—</div>
            <div class="gid-stat-label">FETCHED</div>
          </div>
          <div class="gid-stat">
            <div class="gid-stat-value" id="gid-stat-downloaded" style="color:#4ade80">—</div>
            <div class="gid-stat-label">DOWNLOADED</div>
          </div>
          <div class="gid-stat">
            <div class="gid-stat-value" id="gid-stat-unfavorited" style="color:#f87171">—</div>
            <div class="gid-stat-label">UNFAVORITED</div>
          </div>
        </div>

        <div class="gid-section-label">Filter</div>
        <div class="gid-filter-row">
          <button class="gid-filter-btn active" id="gid-filter-all">All</button>
          <button class="gid-filter-btn" id="gid-filter-images">Images</button>
          <button class="gid-filter-btn" id="gid-filter-videos">Videos</button>
        </div>

        <div class="gid-section-label">Download Folder</div>
        <div class="gid-input-row">
          <span class="gid-input-label">Subfolder:</span>
          <input class="gid-input" id="gid-folder-input" type="text" value="${state.downloadFolder}" placeholder="grok-imagine" />
        </div>

        <!-- Dry Run Toggle -->
        <div class="gid-dryrun-row ${state.dryRunMode ? 'active' : ''}" id="gid-dryrun-row">
          <div class="gid-dryrun-left">
            <div class="gid-dryrun-label">🔍 Dry Run Mode</div>
            <div class="gid-dryrun-desc">Preview what would be downloaded — no files saved, nothing unfavorited.</div>
          </div>
          <label class="gid-toggle-switch" onclick="event.stopPropagation()">
            <input type="checkbox" id="gid-dryrun-checkbox" ${state.dryRunMode ? 'checked' : ''} />
            <span class="gid-toggle-slider"></span>
          </label>
        </div>

        <!-- Dry Run Results -->
        <div class="gid-dryrun-results" id="gid-dryrun-results"></div>

        <div id="gid-progress-wrap" class="gid-progress-wrap">
          <div class="gid-progress-bar-bg">
            <div class="gid-progress-bar" id="gid-progress-bar"></div>
          </div>
          <div class="gid-progress-text" id="gid-progress-text"></div>
        </div>

        <div class="gid-status" id="gid-status">Navigate to grok.com/imagine/favorites, then fetch your library.</div>

        <button class="gid-btn gid-btn-secondary" id="gid-btn-fetch">🔍 Fetch Library</button>

        <hr class="gid-divider">

        <!-- Normal action buttons (hidden in dry run mode) -->
        <div id="gid-action-btns" style="${state.dryRunMode ? 'display:none' : ''}">
          <button class="gid-btn gid-btn-primary" id="gid-btn-download" disabled>⬇ Download All</button>
          <button class="gid-btn gid-btn-danger" id="gid-btn-unfavorite" disabled>🗑 Unfavorite All (Remove from Server)</button>
          <button class="gid-btn gid-btn-primary" id="gid-btn-both" disabled style="background:linear-gradient(135deg,#6366f1,#8b5cf6)">⬇🗑 Download + Unfavorite All</button>
        </div>

        <!-- Dry Run button (shown only in dry run mode) -->
        <button class="gid-btn gid-btn-dryrun" id="gid-btn-dryrun" disabled style="${state.dryRunMode ? '' : 'display:none'}">🔍 Run Preview Scan</button>

        <hr class="gid-divider">

        <button class="gid-btn gid-btn-cancel" id="gid-btn-cancel" disabled>✕ Cancel Operation</button>
      </div>
      <div class="gid-footer">
        v${SCRIPT_VERSION} · Unofficial tool · <a href="https://grok.com/imagine/favorites" target="_blank">Open Favorites</a>
      </div>
    `;
    return panel;
  }

  function buildToggleBtn() {
    const btn = document.createElement('button');
    btn.id = 'gid-toggle-btn';
    btn.title = 'Grok Imagine Downloader';
    btn.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 16l-6-6h4V4h4v6h4l-6 6zm-7 2h14v2H5v-2z"/></svg>`;
    return btn;
  }

  function attachEvents(panel) {
    document.getElementById('gid-close-btn').addEventListener('click', () => {
      panel.classList.add('gid-hidden');
    });
    document.getElementById('gid-toggle-btn').addEventListener('click', () => {
      panel.classList.toggle('gid-hidden');
    });

    document.getElementById('gid-folder-input').addEventListener('input', e => {
      state.downloadFolder = e.target.value.trim() || 'grok-imagine';
      GM_setValue('downloadFolder', state.downloadFolder);
    });

    // Filter buttons
    ['all', 'images', 'videos'].forEach(type => {
      document.getElementById(`gid-filter-${type}`).addEventListener('click', () => {
        state.filterType = type;
        document.querySelectorAll('.gid-filter-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`gid-filter-${type}`).classList.add('active');
        const count = getFilteredPosts().length;
        if (count > 0) setStatus(`${count} items selected (${type}).`);
      });
    });

    // Dry Run toggle — clicking the row or the checkbox both work
    const dryRunRow = document.getElementById('gid-dryrun-row');
    const dryRunCheckbox = document.getElementById('gid-dryrun-checkbox');

    dryRunRow.addEventListener('click', (e) => {
      if (e.target === dryRunCheckbox) return; // checkbox handles itself
      dryRunCheckbox.checked = !dryRunCheckbox.checked;
      state.dryRunMode = dryRunCheckbox.checked;
      GM_setValue('dryRunMode', state.dryRunMode);
      updateDryRunToggleUI();
    });
    dryRunCheckbox.addEventListener('change', () => {
      state.dryRunMode = dryRunCheckbox.checked;
      GM_setValue('dryRunMode', state.dryRunMode);
      updateDryRunToggleUI();
    });

    // Fetch
    document.getElementById('gid-btn-fetch').addEventListener('click', async () => {
      await doFetch();
      ['gid-btn-download', 'gid-btn-unfavorite', 'gid-btn-both', 'gid-btn-dryrun'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = state.posts.length === 0;
      });
    });

    document.getElementById('gid-btn-download').addEventListener('click', doDownload);
    document.getElementById('gid-btn-unfavorite').addEventListener('click', () => doUnfavorite());
    document.getElementById('gid-btn-both').addEventListener('click', doDownloadAndUnfavorite);
    document.getElementById('gid-btn-dryrun').addEventListener('click', doDryRun);

    document.getElementById('gid-btn-cancel').addEventListener('click', () => {
      state.cancelRequested = true;
      setStatus('Cancelling…', 'warning');
    });
  }

  // ─── Init ─────────────────────────────────────────────────────────────────
  function init() {
    if (document.getElementById('gid-panel')) return;

    const panel = buildPanel();
    const toggleBtn = buildToggleBtn();

    document.body.appendChild(panel);
    document.body.appendChild(toggleBtn);

    attachEvents(panel);
    refreshUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 1500);
  }

})();
