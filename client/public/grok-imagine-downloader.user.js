// ==UserScript==
// @name         Grok Imagine Downloader
// @namespace    https://grok.com
// @version      1.0.4
// @description  Bulk download all your Grok Imagine image and video creations to your local machine, and optionally unfavorite them. Includes Dry Run mode, visual thumbnail picker with date-range filter, reconnect/resume after interruption, and destination folder presets.
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
  const SCRIPT_VERSION = '1.0.4';
  const API = {
    LIST:   'https://grok.com/rest/media/post/list',
    UNLIKE: 'https://grok.com/rest/media/post/unlike',
  };
  const PAGE_SIZE = 40;
  const DOWNLOAD_DELAY_MS = 350;
  const UNFAVORITE_DELAY_MS = 200;

  const FOLDER_PRESETS = [
    { label: 'grok-imagine (default)', value: 'grok-imagine' },
    { label: 'grok-imagine/images', value: 'grok-imagine/images' },
    { label: 'grok-imagine/videos', value: 'grok-imagine/videos' },
    { label: 'grok-imagine/batch-1', value: 'grok-imagine/batch-1' },
    { label: 'grok-imagine/batch-2', value: 'grok-imagine/batch-2' },
    { label: 'grok-imagine/batch-3', value: 'grok-imagine/batch-3' },
    { label: '— Custom path…', value: '__custom__' },
  ];

  // ─── State ────────────────────────────────────────────────────────────────
  let state = {
    posts: [],
    selectedIds: new Set(),   // IDs of items selected in picker
    useSelection: false,      // true = operate on selectedIds, false = operate on all filtered
    isFetching: false,
    isDownloading: false,
    isUnfavoriting: false,
    cancelRequested: false,
    downloadedCount: 0,
    failedCount: 0,
    unfavoritedCount: 0,
    dryRunItems: [],
    downloadFolder: GM_getValue('downloadFolder', 'grok-imagine'),
    batchLimit: GM_getValue('batchLimit', 0),   // 0 = no limit (all)
    filterType: 'all',
    dryRunMode: GM_getValue('dryRunMode', false),
    // Resume / reconnect state
    resumeOp: GM_getValue('resumeOp', null),       // 'download' | 'unfavorite' | 'both'
    resumeIndex: GM_getValue('resumeIndex', 0),    // next item index to process
    resumePostIds: GM_getValue('resumePostIds', null), // JSON array of post IDs
  };

  // ─── Styles ───────────────────────────────────────────────────────────────
  GM_addStyle(`
    /* ── Panel ── */
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
    .gid-title-row { display: flex; align-items: center; gap: 8px; }
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

    .gid-stat-row { display: flex; gap: 8px; margin-bottom: 12px; }
    .gid-stat {
      flex: 1;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 10px;
      padding: 10px 8px;
      text-align: center;
    }
    .gid-stat-value { font-size: 20px; font-weight: 700; color: #60a5fa; line-height: 1; }
    .gid-stat-label { font-size: 9px; color: #64748b; margin-top: 3px; letter-spacing: 0.05em; }

    .gid-filter-row { display: flex; gap: 6px; margin-bottom: 12px; }
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

    .gid-input-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .gid-input-label { font-size: 11px; color: #64748b; white-space: nowrap; }
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

    /* ── Selection Banner ── */
    .gid-selection-banner {
      display: none;
      align-items: center;
      justify-content: space-between;
      background: rgba(99, 102, 241, 0.1);
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 10px;
      padding: 9px 12px;
      margin-bottom: 12px;
    }
    .gid-selection-banner.visible { display: flex; }
    .gid-selection-banner-left { display: flex; flex-direction: column; gap: 2px; }
    .gid-selection-count {
      font-size: 12px;
      font-weight: 700;
      color: #a5b4fc;
    }
    .gid-selection-desc { font-size: 10px; color: #475569; }
    .gid-selection-clear {
      font-size: 10px;
      font-weight: 600;
      color: #6366f1;
      background: none;
      border: 1px solid rgba(99,102,241,0.3);
      border-radius: 6px;
      padding: 4px 8px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .gid-selection-clear:hover { background: rgba(99,102,241,0.15); }

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
    .gid-dryrun-label { font-size: 12px; font-weight: 700; color: #fbbf24; display: flex; align-items: center; gap: 5px; }
    .gid-dryrun-desc { font-size: 10px; color: #78716c; line-height: 1.4; }
    .gid-toggle-switch { position: relative; width: 36px; height: 20px; flex-shrink: 0; }
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
    .gid-toggle-switch input:checked + .gid-toggle-slider { background: rgba(245, 158, 11, 0.4); }
    .gid-toggle-switch input:checked + .gid-toggle-slider::before { transform: translateX(16px); background: #fbbf24; }

    /* ── Dry Run Results ── */
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
    .gid-dryrun-item .type-badge.img { background: rgba(59,130,246,0.2); color: #60a5fa; }
    .gid-dryrun-item .type-badge.vid { background: rgba(139,92,246,0.2); color: #a78bfa; }
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

    /* ── Progress ── */
    .gid-progress-wrap { margin-bottom: 12px; display: none; }
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
    .gid-progress-bar.dryrun { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
    .gid-progress-text { font-size: 11px; color: #64748b; text-align: center; }

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

    .gid-divider { border: none; border-top: 1px solid rgba(255,255,255,0.07); margin: 10px 0; }

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
    .gid-btn-secondary:not(:disabled):hover { background: rgba(255,255,255,0.1); color: #e2e8f0; }
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
    .gid-btn-picker {
      background: rgba(99,102,241,0.12);
      border: 1px solid rgba(99,102,241,0.35);
      color: #a5b4fc;
    }
    .gid-btn-picker:not(:disabled):hover { background: rgba(99,102,241,0.2); }
    .gid-btn-reconnect {
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.35);
      color: #6ee7b7;
      font-size: 11px;
    }
    .gid-btn-reconnect:not(:disabled):hover { background: rgba(16, 185, 129, 0.22); }
    .gid-select {
      flex: 1;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 7px 10px;
      font-size: 12px;
      color: #e2e8f0;
      outline: none;
      cursor: pointer;
      transition: border-color 0.15s;
      appearance: none;
      -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 10px center;
      padding-right: 28px;
    }
    .gid-select:focus { border-color: rgba(59,130,246,0.5); }
    .gid-select option { background: #0f172a; color: #e2e8f0; }
    .gid-reconnect-banner {
      display: none;
      align-items: center;
      justify-content: space-between;
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 10px;
      padding: 9px 12px;
      margin-bottom: 12px;
      gap: 8px;
    }
    .gid-reconnect-banner.visible { display: flex; }
    .gid-reconnect-info { font-size: 11px; color: #6ee7b7; line-height: 1.4; }
    .gid-reconnect-info strong { font-size: 12px; display: block; margin-bottom: 2px; }

    .gid-footer {
      padding: 8px 16px 12px;
      border-top: 1px solid rgba(255,255,255,0.06);
      font-size: 10px;
      color: #334155;
      text-align: center;
    }
    .gid-footer a { color: #3b82f6; text-decoration: none; }
    .gid-footer a:hover { text-decoration: underline; }

    /* ── Picker Modal ── */
    #gid-picker-overlay {
      position: fixed;
      inset: 0;
      background: rgba(4, 6, 14, 0.92);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 9999999;
      display: flex;
      flex-direction: column;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
    }
    #gid-picker-overlay.visible {
      opacity: 1;
      pointer-events: all;
    }

    #gid-picker-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      background: rgba(8,12,24,0.8);
      flex-shrink: 0;
    }
    #gid-picker-title {
      font-family: 'Outfit', system-ui, sans-serif;
      font-size: 16px;
      font-weight: 700;
      background: linear-gradient(90deg, #60a5fa, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      flex: 1;
    }
    #gid-picker-count {
      font-size: 12px;
      color: #64748b;
    }
    #gid-picker-count span {
      color: #a5b4fc;
      font-weight: 700;
    }

    .gid-picker-toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      background: rgba(8,12,24,0.6);
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    .gid-picker-toolbar-btn {
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 7px;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.05);
      color: #94a3b8;
      cursor: pointer;
      transition: all 0.15s;
    }
    .gid-picker-toolbar-btn:hover { background: rgba(255,255,255,0.1); color: #e2e8f0; }
    .gid-picker-toolbar-btn.active {
      background: rgba(59,130,246,0.2);
      border-color: rgba(59,130,246,0.5);
      color: #60a5fa;
    }
    .gid-picker-search {
      flex: 1;
      min-width: 160px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 7px;
      padding: 6px 10px;
      font-size: 12px;
      color: #e2e8f0;
      outline: none;
      transition: border-color 0.15s;
    }
    .gid-picker-search:focus { border-color: rgba(59,130,246,0.5); }
    .gid-picker-search::placeholder { color: #334155; }
    .gid-picker-date-row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 20px 8px;
      background: rgba(8,12,24,0.4);
      border-bottom: 1px solid rgba(255,255,255,0.04);
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    .gid-picker-date-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #475569;
      white-space: nowrap;
    }
    .gid-picker-date-input {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 7px;
      padding: 5px 8px;
      font-size: 12px;
      color: #e2e8f0;
      outline: none;
      transition: border-color 0.15s;
      color-scheme: dark;
    }
    .gid-picker-date-input:focus { border-color: rgba(59,130,246,0.5); }
    .gid-picker-date-sep { font-size: 11px; color: #475569; }
    .gid-picker-date-clear {
      padding: 4px 10px;
      font-size: 10px;
      font-weight: 600;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.04);
      color: #64748b;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    }
    .gid-picker-date-clear:hover { background: rgba(255,255,255,0.1); color: #94a3b8; }
    .gid-picker-date-count {
      font-size: 10px;
      color: #475569;
      margin-left: auto;
    }

    #gid-picker-grid {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 10px;
      align-content: start;
    }

    .gid-thumb {
      position: relative;
      border-radius: 10px;
      overflow: hidden;
      aspect-ratio: 1;
      cursor: pointer;
      border: 2px solid transparent;
      transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
      background: rgba(255,255,255,0.04);
    }
    .gid-thumb:hover { transform: scale(1.02); box-shadow: 0 4px 16px rgba(0,0,0,0.4); }
    .gid-thumb.selected {
      border-color: #6366f1;
      box-shadow: 0 0 0 1px #6366f1, 0 4px 20px rgba(99,102,241,0.3);
    }
    .gid-thumb img, .gid-thumb video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .gid-thumb-check {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: rgba(8,12,24,0.7);
      border: 2px solid rgba(255,255,255,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }
    .gid-thumb.selected .gid-thumb-check {
      background: #6366f1;
      border-color: #6366f1;
    }
    .gid-thumb-check::after {
      content: '';
      display: none;
      width: 5px;
      height: 9px;
      border: 2px solid white;
      border-top: none;
      border-left: none;
      transform: rotate(45deg) translateY(-1px);
    }
    .gid-thumb.selected .gid-thumb-check::after { display: block; }
    .gid-thumb-type {
      position: absolute;
      bottom: 5px;
      left: 5px;
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 2px 5px;
      border-radius: 4px;
      background: rgba(0,0,0,0.6);
    }
    .gid-thumb-type.img { color: #60a5fa; }
    .gid-thumb-type.vid { color: #a78bfa; }
    .gid-thumb-prompt {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 20px 6px 6px;
      font-size: 9px;
      color: rgba(255,255,255,0.7);
      background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      opacity: 0;
      transition: opacity 0.15s;
    }
    .gid-thumb:hover .gid-thumb-prompt { opacity: 1; }

    .gid-thumb-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      background: rgba(255,255,255,0.03);
    }

    #gid-picker-footer {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 20px;
      border-top: 1px solid rgba(255,255,255,0.07);
      background: rgba(8,12,24,0.8);
      flex-shrink: 0;
    }
    #gid-picker-confirm {
      flex: 1;
      padding: 11px 20px;
      border-radius: 10px;
      border: none;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s;
      box-shadow: 0 4px 14px rgba(99,102,241,0.35);
    }
    #gid-picker-confirm:hover {
      box-shadow: 0 6px 20px rgba(99,102,241,0.5);
      transform: translateY(-1px);
    }
    #gid-picker-confirm:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
    #gid-picker-cancel {
      padding: 11px 18px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.05);
      color: #94a3b8;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    #gid-picker-cancel:hover { background: rgba(255,255,255,0.1); color: #e2e8f0; }

    #gid-picker-empty {
      display: none;
      grid-column: 1 / -1;
      text-align: center;
      padding: 60px 20px;
      color: #334155;
      font-size: 14px;
    }
    #gid-picker-empty.visible { display: block; }
  `);

  // ─── Utility ──────────────────────────────────────────────────────────────
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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

  // ─── API ──────────────────────────────────────────────────────────────────
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
      const body = { limit: PAGE_SIZE, filter: { source: 'MEDIA_POST_SOURCE_LIKED', safeForWork: false } };
      if (cursor) body.cursor = String(cursor);

      let data;
      try { data = await apiPost(API.LIST, body); }
      catch (e) { throw new Error(`Failed to fetch page ${page + 1}: ${e.message}`); }

      const posts = data.posts || [];
      if (posts.length === 0) break;

      for (const post of posts) {
        if (post.mediaUrl) {
          const isVideo = post.mediaType === 'MEDIA_POST_TYPE_VIDEO';
          allMedia.push({
            id: post.id,
            postId: post.id,
            url: isVideo && post.hdMediaUrl ? post.hdMediaUrl : post.mediaUrl,
            thumbUrl: post.mediaUrl,
            isVideo,
            mimeType: post.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
            prompt: post.originalPrompt || post.prompt || '',
            createTime: post.createTime || '',
          });
        }
        if (post.childPosts && post.childPosts.length > 0) {
          for (const child of post.childPosts) {
            if (!child.mediaUrl) continue;
            const isVideo = child.mediaType === 'MEDIA_POST_TYPE_VIDEO';
            allMedia.push({
              id: child.id,
              postId: post.id,
              url: isVideo && child.hdMediaUrl ? child.hdMediaUrl : child.mediaUrl,
              thumbUrl: child.mediaUrl,
              isVideo,
              mimeType: child.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
              prompt: child.originalPrompt || child.prompt || post.originalPrompt || post.prompt || '',
              createTime: child.createTime || post.createTime || '',
            });
          }
        }
      }

      page++;
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
    } catch { return false; }
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
    ['gid-btn-fetch', 'gid-btn-download', 'gid-btn-unfavorite', 'gid-btn-both', 'gid-btn-dryrun', 'gid-btn-picker', 'gid-btn-reconnect'].forEach(id => {
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

  function updateSelectionBanner() {
    const banner = document.getElementById('gid-selection-banner');
    const countEl = document.getElementById('gid-selection-count');
    const descEl = document.getElementById('gid-selection-desc');
    if (!banner) return;

    if (state.useSelection && state.selectedIds.size > 0) {
      banner.classList.add('visible');
      if (countEl) countEl.textContent = `${state.selectedIds.size} items selected`;
      if (descEl) descEl.textContent = 'Actions will apply to your selection only.';

      // Update button labels to reflect selection
      const dlBtn = document.getElementById('gid-btn-download');
      const unfavBtn = document.getElementById('gid-btn-unfavorite');
      const bothBtn = document.getElementById('gid-btn-both');
      if (dlBtn) dlBtn.textContent = `⬇ Download Selected (${state.selectedIds.size})`;
      if (unfavBtn) unfavBtn.textContent = `🗑 Unfavorite Selected (${state.selectedIds.size})`;
      if (bothBtn) bothBtn.textContent = `⬇🗑 Download + Unfavorite Selected (${state.selectedIds.size})`;
    } else {
      banner.classList.remove('visible');
      const dlBtn = document.getElementById('gid-btn-download');
      const unfavBtn = document.getElementById('gid-btn-unfavorite');
      const bothBtn = document.getElementById('gid-btn-both');
      if (dlBtn) dlBtn.textContent = '⬇ Download All';
      if (unfavBtn) unfavBtn.textContent = '🗑 Unfavorite All (Remove from Server)';
      if (bothBtn) bothBtn.textContent = '⬇🗑 Download + Unfavorite All';
    }
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
      const results = document.getElementById('gid-dryrun-results');
      if (results) results.classList.remove('visible');
    } else {
      if (actionBtns) actionBtns.style.display = 'block';
      if (dryRunBtn) dryRunBtn.style.display = 'none';
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
    document.getElementById('gid-dryrun-export-btn').addEventListener('click', () => exportDryRunList(items));
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

  // ─── Picker Modal ─────────────────────────────────────────────────────────
  let pickerSearchTerm = '';
  let pickerFilterType = 'all';
  let pickerDateFrom = '';  // ISO date string YYYY-MM-DD or ''
  let pickerDateTo   = '';  // ISO date string YYYY-MM-DD or ''

  function resetPickerFilters() {
    pickerSearchTerm = '';
    pickerFilterType = 'all';
    pickerDateFrom = '';
    pickerDateTo = '';
  }

  function buildPickerOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'gid-picker-overlay';
    overlay.innerHTML = `
      <div id="gid-picker-header">
        <div id="gid-picker-title">🖼 Select Items</div>
        <div id="gid-picker-count">
          <span id="gid-picker-sel-count">0</span> selected of
          <span id="gid-picker-total-count">0</span>
        </div>
      </div>

      <div class="gid-picker-toolbar">
        <button class="gid-picker-toolbar-btn active" id="gid-picker-filter-all">All</button>
        <button class="gid-picker-toolbar-btn" id="gid-picker-filter-images">Images</button>
        <button class="gid-picker-toolbar-btn" id="gid-picker-filter-videos">Videos</button>
        <input class="gid-picker-search" id="gid-picker-search" type="text" placeholder="Search by prompt…" />
        <button class="gid-picker-toolbar-btn" id="gid-picker-select-all">Select All</button>
        <button class="gid-picker-toolbar-btn" id="gid-picker-select-none">Clear</button>
      </div>
      <div class="gid-picker-date-row">
        <span class="gid-picker-date-label">Date range:</span>
        <input class="gid-picker-date-input" id="gid-picker-date-from" type="date" title="From date" />
        <span class="gid-picker-date-sep">→</span>
        <input class="gid-picker-date-input" id="gid-picker-date-to" type="date" title="To date" />
        <button class="gid-picker-date-clear" id="gid-picker-date-clear">Clear dates</button>
        <span class="gid-picker-date-count" id="gid-picker-date-count"></span>
      </div>

      <div id="gid-picker-grid">
        <div id="gid-picker-empty">No items match your filter.</div>
      </div>

      <div id="gid-picker-footer">
        <button id="gid-picker-cancel">Cancel</button>
        <button id="gid-picker-confirm" disabled>✓ Use Selection</button>
      </div>
    `;
    document.body.appendChild(overlay);

    // Toolbar events
    ['all', 'images', 'videos'].forEach(type => {
      document.getElementById(`gid-picker-filter-${type}`).addEventListener('click', () => {
        pickerFilterType = type;
        document.querySelectorAll('.gid-picker-toolbar-btn').forEach(b => {
          if (['gid-picker-filter-all','gid-picker-filter-images','gid-picker-filter-videos'].includes(b.id))
            b.classList.remove('active');
        });
        document.getElementById(`gid-picker-filter-${type}`).classList.add('active');
        renderPickerGrid();
      });
    });

    document.getElementById('gid-picker-search').addEventListener('input', e => {
      pickerSearchTerm = e.target.value.toLowerCase();
      renderPickerGrid();
    });

    document.getElementById('gid-picker-date-from').addEventListener('change', e => {
      pickerDateFrom = e.target.value;  // YYYY-MM-DD or ''
      renderPickerGrid();
    });
    document.getElementById('gid-picker-date-to').addEventListener('change', e => {
      pickerDateTo = e.target.value;
      renderPickerGrid();
    });
    document.getElementById('gid-picker-date-clear').addEventListener('click', () => {
      pickerDateFrom = '';
      pickerDateTo = '';
      document.getElementById('gid-picker-date-from').value = '';
      document.getElementById('gid-picker-date-to').value = '';
      renderPickerGrid();
    });

    document.getElementById('gid-picker-select-all').addEventListener('click', () => {
      getPickerVisibleItems().forEach(item => state.selectedIds.add(item.id));
      renderPickerGrid();
      updatePickerCounts();
    });

    document.getElementById('gid-picker-select-none').addEventListener('click', () => {
      state.selectedIds.clear();
      renderPickerGrid();
      updatePickerCounts();
    });

    document.getElementById('gid-picker-cancel').addEventListener('click', closePicker);

    document.getElementById('gid-picker-confirm').addEventListener('click', () => {
      state.useSelection = state.selectedIds.size > 0;
      closePicker();
      updateSelectionBanner();
      if (state.useSelection) {
        setStatus(`${state.selectedIds.size} items selected. Actions will apply to selection only.`);
      }
    });

    // Close on backdrop click
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closePicker();
    });
  }

  function getPickerVisibleItems() {
    const fromMs = pickerDateFrom ? new Date(pickerDateFrom + 'T00:00:00').getTime() : null;
    // To-date is inclusive of the full day
    const toMs   = pickerDateTo   ? new Date(pickerDateTo   + 'T23:59:59').getTime() : null;
    return state.posts.filter(item => {
      if (pickerFilterType === 'images' && item.isVideo) return false;
      if (pickerFilterType === 'videos' && !item.isVideo) return false;
      if (pickerSearchTerm && !item.prompt.toLowerCase().includes(pickerSearchTerm)) return false;
      if (fromMs !== null || toMs !== null) {
        // createTime is a Unix timestamp in seconds (from Grok API)
        const itemMs = item.createTime ? item.createTime * 1000 : 0;
        if (fromMs !== null && itemMs < fromMs) return false;
        if (toMs   !== null && itemMs > toMs)   return false;
      }
      return true;
    });
  }

  function renderPickerGrid() {
    const grid = document.getElementById('gid-picker-grid');
    const emptyEl = document.getElementById('gid-picker-empty');
    if (!grid) return;

    const items = getPickerVisibleItems();

    // Update date-range count badge
    const dateCountEl = document.getElementById('gid-picker-date-count');
    if (dateCountEl) {
      if (pickerDateFrom || pickerDateTo) {
        dateCountEl.textContent = `${items.length} item${items.length !== 1 ? 's' : ''} in range`;
      } else {
        dateCountEl.textContent = '';
      }
    }

    // Remove existing thumbs
    grid.querySelectorAll('.gid-thumb').forEach(el => el.remove());

    if (items.length === 0) {
      if (emptyEl) emptyEl.classList.add('visible');
      return;
    }
    if (emptyEl) emptyEl.classList.remove('visible');

    const frag = document.createDocumentFragment();
    items.forEach(item => {
      const thumb = document.createElement('div');
      thumb.className = 'gid-thumb' + (state.selectedIds.has(item.id) ? ' selected' : '');
      thumb.dataset.id = item.id;

      if (item.isVideo) {
        thumb.innerHTML = `
          <video src="${item.thumbUrl}" muted preload="metadata" style="pointer-events:none"></video>
          <div class="gid-thumb-check"></div>
          <div class="gid-thumb-type vid">VID</div>
          ${item.prompt ? `<div class="gid-thumb-prompt">${item.prompt}</div>` : ''}
        `;
      } else {
        thumb.innerHTML = `
          <img src="${item.thumbUrl}" loading="lazy" alt="${item.prompt || ''}" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='flex')" />
          <div class="gid-thumb-placeholder" style="display:none">🖼</div>
          <div class="gid-thumb-check"></div>
          <div class="gid-thumb-type img">IMG</div>
          ${item.prompt ? `<div class="gid-thumb-prompt">${item.prompt}</div>` : ''}
        `;
      }

      thumb.addEventListener('click', () => {
        if (state.selectedIds.has(item.id)) {
          state.selectedIds.delete(item.id);
          thumb.classList.remove('selected');
        } else {
          state.selectedIds.add(item.id);
          thumb.classList.add('selected');
        }
        updatePickerCounts();
      });

      frag.appendChild(thumb);
    });
    grid.appendChild(frag);
    updatePickerCounts();
  }

  function updatePickerCounts() {
    const selCount = document.getElementById('gid-picker-sel-count');
    const totalCount = document.getElementById('gid-picker-total-count');
    const confirmBtn = document.getElementById('gid-picker-confirm');
    if (selCount) selCount.textContent = state.selectedIds.size;
    if (totalCount) totalCount.textContent = state.posts.length;
    if (confirmBtn) {
      confirmBtn.disabled = state.selectedIds.size === 0;
      confirmBtn.textContent = state.selectedIds.size > 0
        ? `✓ Use Selection (${state.selectedIds.size})`
        : '✓ Use Selection';
    }
  }

  function openPicker() {
    if (state.posts.length === 0) {
      setStatus('Fetch your library first before picking items.', 'warning');
      return;
    }
    resetPickerFilters();
    const overlay = document.getElementById('gid-picker-overlay');
    if (!overlay) return;

    // Reset toolbar state
    document.querySelectorAll('.gid-picker-toolbar-btn').forEach(b => {
      if (['gid-picker-filter-all','gid-picker-filter-images','gid-picker-filter-videos'].includes(b.id))
        b.classList.remove('active');
    });
    document.getElementById('gid-picker-filter-all').classList.add('active');
    const searchEl = document.getElementById('gid-picker-search');
    if (searchEl) searchEl.value = '';
    const dateFrom = document.getElementById('gid-picker-date-from');
    const dateTo   = document.getElementById('gid-picker-date-to');
    if (dateFrom) dateFrom.value = '';
    if (dateTo)   dateTo.value   = '';

    renderPickerGrid();
    overlay.classList.add('visible');
  }

  function closePicker() {
    const overlay = document.getElementById('gid-picker-overlay');
    if (overlay) overlay.classList.remove('visible');
  }

  // ─── Core Operations ──────────────────────────────────────────────────────
  // ─── Resume / Reconnect ──────────────────────────────────────────────────
  function saveResume(op, index, items) {
    state.resumeOp = op;
    state.resumeIndex = index;
    state.resumePostIds = JSON.stringify(items.map(i => i.id));
    GM_setValue('resumeOp', op);
    GM_setValue('resumeIndex', index);
    GM_setValue('resumePostIds', state.resumePostIds);
  }

  function clearResume() {
    state.resumeOp = null;
    state.resumeIndex = 0;
    state.resumePostIds = null;
    GM_setValue('resumeOp', null);
    GM_setValue('resumeIndex', 0);
    GM_setValue('resumePostIds', null);
  }

  function updateReconnectBanner() {
    const banner = document.getElementById('gid-reconnect-banner');
    const desc = document.getElementById('gid-reconnect-desc');
    if (!banner) return;
    if (!state.resumeOp || !state.resumePostIds) {
      banner.classList.remove('visible');
      return;
    }
    let ids;
    try { ids = JSON.parse(state.resumePostIds); } catch { clearResume(); return; }
    const remaining = ids.length - state.resumeIndex;
    if (remaining <= 0) { clearResume(); return; }
    const opLabel = state.resumeOp === 'download' ? 'Download' : state.resumeOp === 'unfavorite' ? 'Unfavorite' : 'Download + Unfavorite';
    desc.textContent = `${opLabel} — ${remaining} of ${ids.length} items remaining`;
    banner.classList.add('visible');
  }

  async function doReconnect() {
    if (!state.resumeOp || !state.resumePostIds) return;
    let ids;
    try { ids = JSON.parse(state.resumePostIds); } catch { clearResume(); updateReconnectBanner(); return; }

    // If we already have the posts in memory, use them; otherwise ask user to fetch first
    if (state.posts.length === 0) {
      setStatus('Fetching library to restore session…');
      await doFetch();
      if (state.posts.length === 0) {
        setStatus('Could not load library. Please click Fetch Library manually.', 'error');
        return;
      }
    }

    // Reconstruct item list from saved IDs (preserving original order)
    const idSet = new Set(ids);
    const allItems = state.posts.filter(p => idSet.has(p.id));
    // Sort by saved ID order
    const idOrder = new Map(ids.map((id, i) => [id, i]));
    allItems.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));

    const startIndex = Math.max(0, state.resumeIndex);
    const remaining = allItems.slice(startIndex);

    if (remaining.length === 0) {
      setStatus('Nothing left to resume — all items already processed.', 'success');
      clearResume();
      updateReconnectBanner();
      return;
    }

    // Hide reconnect banner and run
    document.getElementById('gid-reconnect-banner').classList.remove('visible');
    setStatus(`Resuming ${state.resumeOp} from item ${startIndex + 1} of ${allItems.length}…`);

    const op = state.resumeOp;
    clearResume();

    if (op === 'download') {
      await doDownloadItems(remaining, allItems, startIndex);
    } else if (op === 'unfavorite') {
      await doUnfavorite(remaining);
    } else if (op === 'both') {
      await doDownloadAndUnfavoriteItems(remaining, allItems, startIndex);
    }
  }

  async function doFetch() {
    if (state.isFetching) return;
    state.isFetching = true;
    state.cancelRequested = false;
    setButtonsDisabled(true);
    setProgress(0, 'Starting…');

    try {
      const posts = await fetchAllPosts();
      state.posts = posts;
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

  function getActiveItems() {
    let result;
    if (state.useSelection && state.selectedIds.size > 0) {
      result = state.posts.filter(p => state.selectedIds.has(p.id));
    } else if (state.filterType === 'images') {
      result = state.posts.filter(p => !p.isVideo);
    } else if (state.filterType === 'videos') {
      result = state.posts.filter(p => p.isVideo);
    } else {
      result = state.posts;
    }
    // Apply batch limit (0 = no limit)
    if (state.batchLimit > 0) result = result.slice(0, state.batchLimit);
    return result;
  }

  async function doDryRun() {
    const items = getActiveItems();
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
      if (i % 20 === 0) await sleep(10);
    }

    state.dryRunItems = dryRunItems;
    const imgCount = dryRunItems.filter(i => !i.isVideo).length;
    const vidCount = dryRunItems.filter(i => i.isVideo).length;
    setStatus(`Dry Run complete: ${dryRunItems.length} files (${imgCount} images, ${vidCount} videos). No files were downloaded or modified.`, 'dryrun');
    setProgress(100, `${dryRunItems.length} files identified`, true);
    renderDryRunResults(dryRunItems);
    setButtonsDisabled(false);
    setTimeout(hideProgress, 3000);
  }

  async function doDownload() {
    if (state.isDownloading) return;
    const items = getActiveItems();
    if (items.length === 0) {
      setStatus('No items to download. Fetch your library first.', 'warning');
      return;
    }
    await doDownloadItems(items, items, 0);
  }

  async function doDownloadItems(items, allItems, startOffset) {
    if (state.isDownloading) return;
    state.isDownloading = true;
    state.cancelRequested = false;
    state.downloadedCount = 0;
    state.failedCount = 0;
    setButtonsDisabled(true);
    setProgress(0, `0 / ${items.length}`);
    setStatus(`Downloading ${items.length} files…`);
    saveResume('download', startOffset, allItems);

    for (let i = 0; i < items.length; i++) {
      if (state.cancelRequested) {
        saveResume('download', startOffset + i, allItems);
        setStatus(`Cancelled after ${state.downloadedCount} downloads. Reconnect to resume.`, 'warning');
        updateReconnectBanner();
        break;
      }
      const ok = await downloadItem(items[i]);
      if (ok) state.downloadedCount++; else state.failedCount++;
      setProgress(((i + 1) / items.length) * 100, `${i + 1} / ${items.length} — ${state.downloadedCount} saved, ${state.failedCount} failed`);
      updateStat('downloaded', state.downloadedCount);
      // Save checkpoint every 10 items
      if (i % 10 === 9) saveResume('download', startOffset + i + 1, allItems);
      await sleep(DOWNLOAD_DELAY_MS);
    }

    if (!state.cancelRequested) {
      clearResume();
      updateReconnectBanner();
      setStatus(`Done! ${state.downloadedCount} downloaded${state.failedCount > 0 ? `, ${state.failedCount} failed` : ''}.`, state.failedCount > 0 ? 'warning' : 'success');
    }
    state.isDownloading = false;
    setButtonsDisabled(false);
    setTimeout(hideProgress, 3000);
  }

  async function doUnfavorite(postsOverride) {
    if (state.isUnfavoriting) return;
    const items = postsOverride || getActiveItems();
    if (items.length === 0) { setStatus('No items to unfavorite. Fetch your library first.', 'warning'); return; }

    if (!postsOverride) {
      const confirmed = confirm(`⚠️ Unfavorite ${items.length} items?\n\nThis will remove them from your Grok Imagine favorites.\n\nProceed?`);
      if (!confirmed) return;
    }

    state.isUnfavoriting = true;
    state.cancelRequested = false;
    state.unfavoritedCount = 0;
    setButtonsDisabled(true);
    setProgress(0, `0 / ${items.length}`);
    setStatus(`Unfavoriting ${items.length} items…`);
    if (!postsOverride) saveResume('unfavorite', 0, items);

    const seenPostIds = new Set();
    const uniquePosts = items.filter(item => {
      if (seenPostIds.has(item.postId)) return false;
      seenPostIds.add(item.postId);
      return true;
    });

    for (let i = 0; i < uniquePosts.length; i++) {
      if (state.cancelRequested) {
        if (!postsOverride) {
          saveResume('unfavorite', i, items);
          updateReconnectBanner();
        }
        setStatus(`Cancelled after ${state.unfavoritedCount} unfavorites. Reconnect to resume.`, 'warning');
        break;
      }
      const ok = await unlikePost(uniquePosts[i].postId);
      if (ok) state.unfavoritedCount++;
      setProgress(((i + 1) / uniquePosts.length) * 100, `${i + 1} / ${uniquePosts.length} — ${state.unfavoritedCount} removed`);
      updateStat('unfavorited', state.unfavoritedCount);
      if (i % 10 === 9 && !postsOverride) saveResume('unfavorite', i + 1, items);
      await sleep(UNFAVORITE_DELAY_MS);
    }

    if (!state.cancelRequested) {
      if (!postsOverride) { clearResume(); updateReconnectBanner(); }
      setStatus(`Done! ${state.unfavoritedCount} items unfavorited.`, 'success');
    }
    state.isUnfavoriting = false;
    setButtonsDisabled(false);
    setTimeout(hideProgress, 3000);
  }

  async function doDownloadAndUnfavorite() {
    if (state.isDownloading || state.isUnfavoriting) return;
    const items = getActiveItems();
    if (items.length === 0) { setStatus('No items found. Fetch your library first.', 'warning'); return; }
    const confirmed = confirm(`Download ${items.length} items AND unfavorite them?\n\nFiles will be saved to: ${state.downloadFolder}/\nItems will be removed from your Grok favorites.\n\nProceed?`);
    if (!confirmed) return;
    await doDownloadAndUnfavoriteItems(items, items, 0);
  }

  async function doDownloadAndUnfavoriteItems(items, allItems, startOffset) {
    if (state.isDownloading || state.isUnfavoriting) return;
    state.isDownloading = true;
    state.isUnfavoriting = true;
    state.cancelRequested = false;
    state.downloadedCount = 0;
    state.failedCount = 0;
    state.unfavoritedCount = 0;
    setButtonsDisabled(true);
    saveResume('both', startOffset, allItems);

    // Group items by postId so we can unfavorite a post as soon as ALL its
    // media files (variations) have been downloaded.
    const postGroups = new Map(); // postId -> [item, ...]
    for (const item of items) {
      if (!postGroups.has(item.postId)) postGroups.set(item.postId, []);
      postGroups.get(item.postId).push(item);
    }

    // Track which files per post have been downloaded
    const postDownloaded = new Map(); // postId -> count of downloaded files
    const postTotal = new Map();      // postId -> total files expected
    for (const [pid, group] of postGroups) postTotal.set(pid, group.length);

    const total = items.length;
    let processed = 0;

    for (let i = 0; i < items.length; i++) {
      if (state.cancelRequested) {
        saveResume('both', startOffset + i, allItems);
        setStatus(`Cancelled. ${state.downloadedCount} downloaded, ${state.unfavoritedCount} unfavorited. Reconnect to resume.`, 'warning');
        updateReconnectBanner();
        state.isDownloading = false;
        state.isUnfavoriting = false;
        setButtonsDisabled(false);
        return;
      }

      const item = items[i];
      const ok = await downloadItem(item);
      if (ok) state.downloadedCount++; else state.failedCount++;
      processed++;

      // Track per-post download completion
      const doneForPost = (postDownloaded.get(item.postId) || 0) + 1;
      postDownloaded.set(item.postId, doneForPost);

      // Unfavorite this post immediately once all its files are downloaded
      if (doneForPost >= postTotal.get(item.postId)) {
        const unlikeOk = await unlikePost(item.postId);
        if (unlikeOk) state.unfavoritedCount++;
        updateStat('unfavorited', state.unfavoritedCount);
        await sleep(UNFAVORITE_DELAY_MS);
      }

      updateStat('downloaded', state.downloadedCount);
      setProgress(
        (processed / total) * 100,
        `${processed} / ${total} — ${state.downloadedCount} saved, ${state.unfavoritedCount} unfavorited`
      );

      // Checkpoint every 10 items
      if (i % 10 === 9) saveResume('both', startOffset + i + 1, allItems);
      await sleep(DOWNLOAD_DELAY_MS);
    }

    state.isDownloading = false;
    state.isUnfavoriting = false;
    setButtonsDisabled(false);
    clearResume();
    updateReconnectBanner();
    setStatus(`All done! ${state.downloadedCount} downloaded, ${state.unfavoritedCount} unfavorited${state.failedCount > 0 ? `, ${state.failedCount} failed` : ''}.`, state.failedCount > 0 ? 'warning' : 'success');
    setTimeout(hideProgress, 4000);
  }

  // ─── Build Panel ──────────────────────────────────────────────────────────
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

        <div class="gid-section-label">Filter (applies when no selection active)</div>
        <div class="gid-filter-row">
          <button class="gid-filter-btn active" id="gid-filter-all">All</button>
          <button class="gid-filter-btn" id="gid-filter-images">Images</button>
          <button class="gid-filter-btn" id="gid-filter-videos">Videos</button>
        </div>

        <div class="gid-section-label">Destination Folder</div>
        <div class="gid-input-row">
          <span class="gid-input-label">Preset:</span>
          <select class="gid-select" id="gid-folder-select">
            ${FOLDER_PRESETS.map(p => `<option value="${p.value}"${(!FOLDER_PRESETS.find(x => x.value === state.downloadFolder) || state.downloadFolder === p.value) && !(p.value === '__custom__' && FOLDER_PRESETS.find(x => x.value === state.downloadFolder)) ? ' selected' : ''}>${p.label}</option>`).join('')}
          </select>
        </div>
        <div class="gid-input-row" id="gid-custom-folder-row" style="${FOLDER_PRESETS.find(p => p.value === state.downloadFolder) ? 'display:none' : ''}">
          <span class="gid-input-label">Path:</span>
          <input class="gid-input" id="gid-folder-input" type="text" value="${state.downloadFolder}" placeholder="e.g. grok-imagine/custom" />
        </div>
        <div style="font-size:11px;color:#475569;margin:-6px 0 8px;padding:0 2px">Saved inside your browser&#39;s Downloads folder.</div>

        <div class="gid-section-label">Batch Limit</div>
        <div class="gid-input-row">
          <span class="gid-input-label">Max files:</span>
          <input class="gid-input" id="gid-batch-input" type="number" min="0" max="6000"
            value="${state.batchLimit || ''}" placeholder="All (no limit)" style="width:120px" />
        </div>
        <div style="font-size:11px;color:#475569;margin:-6px 0 8px;padding:0 2px">
          Leave blank to download everything. Max recommended: 6,000.
        </div>

        <!-- Reconnect Banner -->
        <div class="gid-reconnect-banner" id="gid-reconnect-banner">
          <div class="gid-reconnect-info">
            <strong>↩ Interrupted session detected</strong>
            <span id="gid-reconnect-desc">Resume previous operation?</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0">
            <button class="gid-btn gid-btn-reconnect" id="gid-btn-reconnect" style="margin-bottom:0">Resume</button>
            <button class="gid-btn gid-btn-secondary" id="gid-btn-reconnect-dismiss" style="margin-bottom:0;font-size:10px;padding:5px 10px">Dismiss</button>
          </div>
        </div>

        <!-- Selection Banner -->
        <div class="gid-selection-banner" id="gid-selection-banner">
          <div class="gid-selection-banner-left">
            <div class="gid-selection-count" id="gid-selection-count">0 items selected</div>
            <div class="gid-selection-desc" id="gid-selection-desc">Actions will apply to your selection only.</div>
          </div>
          <button class="gid-selection-clear" id="gid-selection-clear">✕ Clear</button>
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
        <button class="gid-btn gid-btn-picker" id="gid-btn-picker" disabled>🖼 Pick Items to Select…</button>

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
    document.getElementById('gid-close-btn').addEventListener('click', () => panel.classList.add('gid-hidden'));
    document.getElementById('gid-toggle-btn').addEventListener('click', () => panel.classList.toggle('gid-hidden'));

    // Folder preset dropdown
    const folderSelect = document.getElementById('gid-folder-select');
    const customFolderRow = document.getElementById('gid-custom-folder-row');
    const folderInput = document.getElementById('gid-folder-input');

    // Set initial dropdown selection
    const isPreset = FOLDER_PRESETS.some(p => p.value !== '__custom__' && p.value === state.downloadFolder);
    if (!isPreset) {
      folderSelect.value = '__custom__';
      customFolderRow.style.display = '';
    } else {
      folderSelect.value = state.downloadFolder;
      customFolderRow.style.display = 'none';
    }

    folderSelect.addEventListener('change', e => {
      const val = e.target.value;
      if (val === '__custom__') {
        customFolderRow.style.display = '';
        folderInput.focus();
      } else {
        customFolderRow.style.display = 'none';
        state.downloadFolder = val;
        GM_setValue('downloadFolder', val);
      }
    });

    folderInput.addEventListener('input', e => {
      state.downloadFolder = e.target.value.trim() || 'grok-imagine';
      GM_setValue('downloadFolder', state.downloadFolder);
    });

    // Reconnect banner
    updateReconnectBanner();
    document.getElementById('gid-btn-reconnect').addEventListener('click', doReconnect);
    document.getElementById('gid-btn-reconnect-dismiss').addEventListener('click', () => {
      clearResume();
      updateReconnectBanner();
    });

    document.getElementById('gid-batch-input').addEventListener('input', e => {
      const val = parseInt(e.target.value, 10);
      state.batchLimit = (!isNaN(val) && val > 0) ? Math.min(val, 6000) : 0;
      GM_setValue('batchLimit', state.batchLimit);
      // clamp displayed value to 6000 if user types higher
      if (!isNaN(val) && val > 6000) e.target.value = 6000;
    });

    // Filter buttons
    ['all', 'images', 'videos'].forEach(type => {
      document.getElementById(`gid-filter-${type}`).addEventListener('click', () => {
        state.filterType = type;
        document.querySelectorAll('.gid-filter-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`gid-filter-${type}`).classList.add('active');
        const count = getActiveItems().length;
        if (count > 0) setStatus(`${count} items in scope (${type}).`);
      });
    });

    // Dry Run toggle
    const dryRunRow = document.getElementById('gid-dryrun-row');
    const dryRunCheckbox = document.getElementById('gid-dryrun-checkbox');
    dryRunRow.addEventListener('click', (e) => {
      if (e.target === dryRunCheckbox) return;
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

    // Selection clear
    document.getElementById('gid-selection-clear').addEventListener('click', () => {
      state.selectedIds.clear();
      state.useSelection = false;
      updateSelectionBanner();
      setStatus(`Selection cleared. Operating on all filtered items.`);
    });

    // Picker button
    document.getElementById('gid-btn-picker').addEventListener('click', openPicker);

    // Fetch
    document.getElementById('gid-btn-fetch').addEventListener('click', async () => {
      await doFetch();
      const hasItems = state.posts.length > 0;
      ['gid-btn-download', 'gid-btn-unfavorite', 'gid-btn-both', 'gid-btn-dryrun', 'gid-btn-picker'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = !hasItems;
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
    buildPickerOverlay();
    refreshUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 1500);
  }

})();
