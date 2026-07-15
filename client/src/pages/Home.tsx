/**
 * Design: Deep Space Dashboard
 * - Deep navy (#080c18) base, glassmorphism panels
 * - Electric blue (#3b82f6) + violet (#8b5cf6) accents
 * - Outfit font for headings, Inter for body
 * - Mission-control layout: hero → install steps → features → FAQ
 */

import { useState } from "react";
import { motion } from "framer-motion";

const HERO_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663473487032/7SGFFjgcTXTDttBaSPwZr2/hero-bg-3WyWRMW5WZoB6TWmYp9h57.webp";
const SCRIPT_ICON = "https://d2xsxph8kpxj0f.cloudfront.net/310519663473487032/7SGFFjgcTXTDttBaSPwZr2/script-icon-BnNubc4BWN7qA5DZaJKBSa.webp";
const SCRIPT_URL = "/grok-imagine-downloader.user.js";
const SCRIPT_VERSION = "1.4.0";
const ETH_ADDRESS = "0x274b41cC717b95193bb74A9370e13FB987f3E56a";
const ENS_NAME = "obijuan.uni.eth";
const QR_CODE_URL = "/manus-storage/qr-donate_29d775c6.jpeg";

const changelog = [
  {
    version: "1.4.0",
    date: "Jul 2026",
    tag: "latest",
    tagColor: "#6366f1",
    changes: [
      { type: "new", text: "Date-range filter in the visual picker — set a From and To date to instantly narrow the thumbnail grid to a specific time window. Item count updates live. Filters reset each time the picker opens." },
      { type: "improve", text: "Picker filters (type, search, date range) all compose together — only items matching every active filter are shown and eligible for Select All." },
    ],
  },
  {
    version: "1.3.0",
    date: "Jul 2026",
    tag: "previous",
    tagColor: "#475569",
    changes: [
      { type: "new", text: "Reconnect & Resume — if a download or unfavorite is interrupted (network drop, browser close, or cancel), a green banner appears on next load showing how many items remain. One click picks up exactly where it left off." },
      { type: "new", text: "Destination Folder dropdown — choose from preset subfolder paths (grok-imagine, images, videos, batch-1/2/3) or select \"Custom\" to type any path. Saved across sessions." },
      { type: "improve", text: "Progress is checkpointed every 10 items so a crash loses at most 10 items of progress, not the entire run." },
    ],
  },
  {
    version: "1.2.1",
    date: "May 2026",
    tag: "older",
    tagColor: "#334155",
    changes: [
      { type: "new", text: "Batch Limit field — set a maximum number of files to process per operation (blank = no limit, max recommended 6,000). Persisted across sessions." },
      { type: "improve", text: "Batch limit applies uniformly to all modes: download, unfavorite, dry run, and picker selection." },
    ],
  },
  {
    version: "1.2.0",
    date: "May 2026",
    tag: "older",
    tagColor: "#334155",
    changes: [
      { type: "new", text: "Visual thumbnail picker — browse a full-screen grid of all your creations, search by prompt, filter by type, and select individual items before acting." },
      { type: "new", text: "Selection mode — once items are picked, all action buttons (Download, Unfavorite, Download+Unfavorite) operate only on the selection." },
      { type: "new", text: "Selection banner in the panel shows the active count and a one-click Clear button to return to full-library mode." },
      { type: "improve", text: "Thumbnail grid lazy-loads images and shows a placeholder for items with broken URLs." },
    ],
  },
  {
    version: "1.1.0",
    date: "May 2026",
    tag: "older",
    tagColor: "#334155",
    changes: [
      { type: "new", text: "Dry Run mode — preview every file that would be downloaded/unfavorited before committing, with an exportable .txt file list." },
      { type: "new", text: "Version badge displayed in the in-page panel header." },
      { type: "improve", text: "Dry Run progress bar uses distinct amber colour to distinguish from live operations." },
      { type: "improve", text: "Panel width slightly increased for better readability of long filenames in dry run results." },
    ],
  },
  {
    version: "1.0.0",
    date: "May 2026",
    tag: "initial",
    tagColor: "#334155",
    changes: [
      { type: "new", text: "Initial release with bulk download, unfavorite, and combined download+unfavorite flows." },
      { type: "new", text: "Paginated library fetch with full child post (variation) support." },
      { type: "new", text: "Filter by images only, videos only, or all media." },
      { type: "new", text: "Customisable download subfolder with persistent preference." },
      { type: "new", text: "Cancel button to stop any in-progress operation cleanly." },
    ],
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" },
  }),
};

const features = [
  {
    icon: "⬇",
    title: "Bulk Download",
    desc: "Downloads every image and video — including all versions and variations — directly to a folder on your local machine.",
  },
  {
    icon: "🗑",
    title: "Unfavorite & Remove",
    desc: "Calls the Grok API to unfavorite each post after download, removing it from your saved library on the server.",
  },
  {
    icon: "⚡",
    title: "Seamless Processing",
    desc: "Paginated API fetching with progress tracking. Rate-limited downloads prevent browser throttling. Cancel at any time.",
  },
  {
    icon: "🔒",
    title: "100% Private",
    desc: "Runs entirely in your browser using your existing Grok session. No data ever touches a third-party server.",
  },
  {
    icon: "📂",
    title: "Destination Folder Presets",
    desc: "Choose from preset subfolders (images, videos, batch-1/2/3) or type a custom path. All files land inside your browser\u2019s Downloads folder.",
  },
  {
    icon: "↩️",
    title: "Reconnect & Resume",
    desc: "Interrupted by a network drop or browser close? A green banner appears on next visit showing exactly how many items remain. One click resumes from where you left off.",
  },
  {
    icon: "📦",
    title: "All Versions",
    desc: "Fetches child posts (variations) for each creation, ensuring every generated version is captured — not just the latest.",
  },
  {
    icon: "🔍",
    title: "Dry Run Mode",
    desc: "Preview exactly which files would be downloaded or unfavorited — with counts, filenames, and an exportable .txt list — before a single file is touched.",
  },
  {
    icon: "🖼️",
    title: "Visual Subset Picker",
    desc: "Open a full-screen thumbnail grid, search by prompt, filter by type, and hand-pick exactly which items to download or unfavorite — no need to act on your entire library.",
  },
];

const steps = [
  {
    num: "01",
    title: "Install Tampermonkey",
    desc: "Install the Tampermonkey browser extension for Chrome, Firefox, Edge, or Safari.",
    link: "https://www.tampermonkey.net/",
    linkLabel: "Get Tampermonkey →",
  },
  {
    num: "02",
    title: "Install the Script",
    desc: 'Click the button below. Tampermonkey will open an install page — click "Install" to confirm.',
    link: SCRIPT_URL,
    linkLabel: null, // handled by main CTA
    isCTA: true,
  },
  {
    num: "03",
    title: "Open Grok Imagine Favorites",
    desc: "Navigate to grok.com/imagine/favorites. The download panel will appear in the bottom-right corner.",
    link: "https://grok.com/imagine/favorites",
    linkLabel: "Open Favorites →",
  },
  {
    num: "04",
    title: "Fetch, Download & Clean Up",
    desc: 'Click "Fetch Library" to load all your creations, then choose to download, unfavorite, or both.',
    link: null,
    linkLabel: null,
  },
];

const faqs = [
  {
    q: "Does this require an API key or login?",
    a: "No. The script uses your existing Grok browser session (cookies) to authenticate automatically. You just need to be logged in to grok.com.",
  },
  {
    q: "Where are files saved?",
    a: 'Files are saved to your browser\'s default downloads folder, inside a "grok-imagine" subfolder (customizable in the panel). Each file is named with a timestamp, ID, and prompt snippet.',
  },
  {
    q: "What does \"unfavorite\" actually do?",
    a: "On Grok Imagine, favoriting a post saves it to your library. Unfavoriting removes it from your saved list. Note: Grok may still retain the media on their servers — this tool removes it from your account\'s favorites.",
  },
  {
    q: "Will this work on all my creations, including old ones?",
    a: "The script fetches all posts from the /rest/media/post/list API with full pagination. Grok's API has a known server-side limit of ~6,000 posts per session, but incremental fetching over multiple sessions can cover larger libraries.",
  },
  {
    q: "Is this safe to use?",
    a: "The script only reads your media list and calls the unlike endpoint — both are standard Grok API calls. It does not modify any other account data. Use at your own risk; this is an unofficial tool.",
  },
];

function DonateSection() {
  const [copied, setCopied] = useState(false);

  function copyAddress() {
    navigator.clipboard.writeText(ETH_ADDRESS).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <section
      style={{
        padding: "72px 0",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(8,12,24,0.6)",
      }}
    >
      <div className="container" style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.01 }}
        >
          {/* Ethereum diamond icon */}
          <motion.div variants={fadeUp} custom={0} style={{ marginBottom: 20 }}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 256 417"
              xmlns="http://www.w3.org/2000/svg"
              style={{ margin: "0 auto", display: "block", filter: "drop-shadow(0 0 16px rgba(99,102,241,0.5))" }}
            >
              <polygon fill="#8b5cf6" fillOpacity="0.9" points="127.9611,0 125.1661,9.5 125.1661,285.168 127.9611,287.958 255.9231,212.32" />
              <polygon fill="#6366f1" points="127.9611,0 0,212.32 127.9611,287.958 127.9611,154.158" />
              <polygon fill="#a78bfa" fillOpacity="0.9" points="127.9611,312.1866 126.3861,314.1066 126.3861,412.3056 127.9611,416.9066 255.9991,236.5866" />
              <polygon fill="#7c3aed" points="127.9611,416.9066 127.9611,312.1866 0,236.5866" />
              <polygon fill="#6366f1" fillOpacity="0.7" points="127.9611,287.9577 255.9221,212.3207 127.9611,154.1587" />
              <polygon fill="#4f46e5" fillOpacity="0.7" points="0.0009,212.3207 127.9609,287.9577 127.9609,154.1587" />
            </svg>
          </motion.div>

          <motion.h2
            variants={fadeUp}
            custom={1}
            style={{
              fontFamily: "'Outfit', system-ui, sans-serif",
              fontSize: "clamp(22px, 3vw, 32px)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              marginBottom: 10,
            }}
          >
            Support the Project
          </motion.h2>

          <motion.p
            variants={fadeUp}
            custom={2}
            style={{ fontSize: 15, color: "#64748b", marginBottom: 32, lineHeight: 1.6 }}
          >
            This tool is free and open-source. If it saved you time, consider sending a tip — accepted on 18 networks.
          </motion.p>

          {/* QR code + address card */}
          <motion.div
            variants={fadeUp}
            custom={3}
            style={{
              background: "rgba(99,102,241,0.07)",
              border: "1px solid rgba(99,102,241,0.25)",
              borderRadius: 16,
              padding: "24px",
              marginBottom: 16,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            {/* ENS name */}
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Outfit', system-ui, sans-serif", letterSpacing: "-0.01em" }}>
              <span style={{ color: "#e2e8f0" }}>obijuan</span>
              <span style={{ color: "#a5b4fc" }}>.uni.eth</span>
            </div>

            {/* QR code */}
            <img
              src={QR_CODE_URL}
              alt="Wallet QR code for obijuan.uni.eth"
              style={{
                width: 180,
                height: 180,
                borderRadius: 12,
                border: "3px solid rgba(99,102,241,0.3)",
                objectFit: "cover",
                objectPosition: "center 38%",
              }}
            />

            {/* Address + copy */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center", width: "100%" }}>
              <code
                style={{
                  fontFamily: "'Courier New', monospace",
                  fontSize: "clamp(10px, 1.8vw, 12px)",
                  color: "#a5b4fc",
                  letterSpacing: "0.04em",
                  wordBreak: "break-all",
                  flex: 1,
                  minWidth: 180,
                  textAlign: "left",
                }}
              >
                {ETH_ADDRESS}
              </code>
              <button
                onClick={copyAddress}
                style={{
                  padding: "8px 16px",
                  borderRadius: 10,
                  border: copied ? "1px solid rgba(74,222,128,0.4)" : "1px solid rgba(99,102,241,0.4)",
                  background: copied ? "rgba(74,222,128,0.1)" : "rgba(99,102,241,0.15)",
                  color: copied ? "#4ade80" : "#a5b4fc",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {copied ? "✓ Copied!" : "Copy Address"}
              </button>
            </div>

            <p style={{ fontSize: 11, color: "#475569", margin: 0 }}>Accepted on 18 networks</p>
          </motion.div>

          {/* Etherscan link */}
          <motion.div variants={fadeUp} custom={5}>
            <a
              href={`https://etherscan.io/address/${ETH_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12,
                color: "#475569",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                transition: "color 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "#6366f1")}
              onMouseLeave={e => (e.currentTarget.style.color = "#475569")}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              View on Etherscan
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.origin + SCRIPT_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="min-h-screen text-white"
      style={{ background: "#080c18", fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{ minHeight: "100vh", display: "flex", alignItems: "center" }}
      >
        {/* Background */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${HERO_BG})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.45,
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(8,12,24,0.3) 0%, rgba(8,12,24,0.7) 60%, rgba(8,12,24,1) 100%)",
          }}
        />

        {/* Nav */}
        <nav
          className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-5"
          style={{ zIndex: 10 }}
        >
          <div className="flex items-center gap-3">
            <img src={SCRIPT_ICON} alt="logo" style={{ width: 36, height: 36, borderRadius: "50%" }} />
            <span
              style={{
                fontFamily: "'Outfit', system-ui, sans-serif",
                fontWeight: 700,
                fontSize: 16,
                background: "linear-gradient(90deg, #60a5fa, #a78bfa)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Grok Imagine Downloader
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
                color: "#475569",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 4,
                padding: "2px 6px",
              }}
            >
              v{SCRIPT_VERSION}
            </span>
          </div>
          <a
            href={SCRIPT_URL}
            style={{
              background: "linear-gradient(135deg, #3b82f6, #6366f1)",
              color: "white",
              padding: "8px 20px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              boxShadow: "0 4px 14px rgba(59,130,246,0.35)",
              transition: "all 0.15s",
            }}
          >
            Install Script
          </a>
        </nav>

        {/* Hero Content */}
        <div className="relative container" style={{ zIndex: 10, paddingTop: 120, paddingBottom: 100 }}>
          <motion.div
            initial="hidden"
            animate="visible"
            style={{ maxWidth: 680 }}
          >
            <motion.div
              variants={fadeUp}
              custom={0}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(59,130,246,0.12)",
                border: "1px solid rgba(59,130,246,0.3)",
                borderRadius: 99,
                padding: "5px 14px",
                fontSize: 12,
                fontWeight: 600,
                color: "#93c5fd",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginBottom: 24,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6", display: "inline-block" }} />
              Tampermonkey Userscript · Free & Open Source
            </motion.div>

            <motion.h1
              variants={fadeUp}
              custom={1}
              style={{
                fontFamily: "'Outfit', system-ui, sans-serif",
                fontSize: "clamp(36px, 6vw, 64px)",
                fontWeight: 800,
                lineHeight: 1.1,
                marginBottom: 24,
                letterSpacing: "-0.02em",
              }}
            >
              Download All Your{" "}
              <span
                style={{
                  background: "linear-gradient(90deg, #60a5fa, #a78bfa)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Grok Imagine
              </span>{" "}
              Creations
            </motion.h1>

            <motion.p
              variants={fadeUp}
              custom={2}
              style={{ fontSize: 18, color: "#94a3b8", lineHeight: 1.7, marginBottom: 40, maxWidth: 560 }}
            >
              Bulk download every image and video you've created on Grok Imagine — including all versions and variations — directly to your local machine. Optionally unfavorite them to clean up your library.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="flex" style={{ gap: 12, flexWrap: "wrap" }}>
              <a
                href={SCRIPT_URL}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "linear-gradient(135deg, #3b82f6, #6366f1)",
                  color: "white",
                  padding: "14px 28px",
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 700,
                  textDecoration: "none",
                  boxShadow: "0 6px 24px rgba(59,130,246,0.4)",
                  transition: "all 0.2s",
                  letterSpacing: "0.01em",
                }}
              >
                ⬇ Install Script
              </a>
              <button
                onClick={handleCopy}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#94a3b8",
                  padding: "14px 24px",
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {copied ? "✓ Copied!" : "📋 Copy Script URL"}
              </button>
            </motion.div>

            <motion.p
              variants={fadeUp}
              custom={4}
              style={{ fontSize: 12, color: "#334155", marginTop: 20 }}
            >
              Requires Tampermonkey · Works on Chrome, Firefox, Edge, Safari · Unofficial tool
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <section style={{ padding: "80px 0", background: "rgba(255,255,255,0.015)" }}>
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.01 }}
          >
            <motion.div variants={fadeUp} custom={0} style={{ marginBottom: 48 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "#3b82f6",
                  marginBottom: 12,
                }}
              >
                Quick Start
              </div>
              <h2
                style={{
                  fontFamily: "'Outfit', system-ui, sans-serif",
                  fontSize: "clamp(28px, 4vw, 40px)",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                }}
              >
                Up and running in 4 steps
              </h2>
            </motion.div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 20,
              }}
            >
              {steps.map((step, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  custom={i + 1}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 16,
                    padding: "28px 24px",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      fontSize: 48,
                      fontWeight: 800,
                      color: "rgba(59,130,246,0.12)",
                      position: "absolute",
                      top: 12,
                      right: 20,
                      lineHeight: 1,
                      fontFamily: "'Outfit', system-ui, sans-serif",
                      letterSpacing: "-0.04em",
                    }}
                  >
                    {step.num}
                  </div>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "linear-gradient(135deg, #3b82f6, #6366f1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "white",
                      marginBottom: 16,
                    }}
                  >
                    {step.num.replace("0", "")}
                  </div>
                  <h3
                    style={{
                      fontFamily: "'Outfit', system-ui, sans-serif",
                      fontSize: 17,
                      fontWeight: 700,
                      marginBottom: 8,
                    }}
                  >
                    {step.title}
                  </h3>
                  <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, marginBottom: step.link ? 16 : 0 }}>
                    {step.desc}
                  </p>
                  {step.isCTA && (
                    <a
                      href={SCRIPT_URL}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: "linear-gradient(135deg, #3b82f6, #6366f1)",
                        color: "white",
                        padding: "9px 18px",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        textDecoration: "none",
                        boxShadow: "0 4px 14px rgba(59,130,246,0.3)",
                      }}
                    >
                      ⬇ Install Script
                    </a>
                  )}
                  {!step.isCTA && step.link && step.linkLabel && (
                    <a
                      href={step.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 13,
                        color: "#60a5fa",
                        textDecoration: "none",
                        fontWeight: 600,
                      }}
                    >
                      {step.linkLabel}
                    </a>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section style={{ padding: "80px 0" }}>
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.01 }}
          >
            <motion.div variants={fadeUp} custom={0} style={{ marginBottom: 48 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "#8b5cf6",
                  marginBottom: 12,
                }}
              >
                Capabilities
              </div>
              <h2
                style={{
                  fontFamily: "'Outfit', system-ui, sans-serif",
                  fontSize: "clamp(28px, 4vw, 40px)",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                }}
              >
                Everything you need to own your creations
              </h2>
            </motion.div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 16,
              }}
            >
              {features.map((f, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  custom={i + 1}
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 14,
                    padding: "24px 22px",
                    transition: "border-color 0.2s, background 0.2s",
                  }}
                  whileHover={{
                    borderColor: "rgba(59,130,246,0.25)",
                    background: "rgba(59,130,246,0.04)",
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 14 }}>{f.icon}</div>
                  <h3
                    style={{
                      fontFamily: "'Outfit', system-ui, sans-serif",
                      fontSize: 16,
                      fontWeight: 700,
                      marginBottom: 8,
                    }}
                  >
                    {f.title}
                  </h3>
                  <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.65 }}>{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Panel Preview ─────────────────────────────────────────────────── */}
      <section
        style={{
          padding: "80px 0",
          background: "rgba(59,130,246,0.04)",
          borderTop: "1px solid rgba(59,130,246,0.1)",
          borderBottom: "1px solid rgba(59,130,246,0.1)",
        }}
      >
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.01 }}
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}
          >
            <motion.div variants={fadeUp} custom={0}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "#3b82f6",
                  marginBottom: 12,
                }}
              >
                In-Page Panel
              </div>
              <h2
                style={{
                  fontFamily: "'Outfit', system-ui, sans-serif",
                  fontSize: "clamp(24px, 3.5vw, 36px)",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  marginBottom: 20,
                }}
              >
                A floating control panel, right inside Grok
              </h2>
              <p style={{ fontSize: 15, color: "#64748b", lineHeight: 1.7, marginBottom: 24 }}>
                The script injects a sleek, non-intrusive panel into the bottom-right corner of your Grok Imagine favorites page. No new tabs, no separate apps — everything happens right where your content lives.
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {[
                  "Live progress bar with item counts",
                  "Per-operation cancel button",
                  "Persistent folder preference",
                  "Filter by images, videos, or all",
                  "Stat counters: fetched / downloaded / unfavorited",
                ].map((item, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 14,
                      color: "#94a3b8",
                      marginBottom: 10,
                    }}
                  >
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "rgba(59,130,246,0.15)",
                        border: "1px solid rgba(59,130,246,0.3)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        color: "#60a5fa",
                        flexShrink: 0,
                      }}
                    >
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Mock panel UI */}
            <motion.div variants={fadeUp} custom={1}>
              <div
                style={{
                  background: "rgba(8, 12, 24, 0.97)",
                  border: "1px solid rgba(59, 130, 246, 0.35)",
                  borderRadius: 16,
                  boxShadow: "0 0 40px rgba(59, 130, 246, 0.15), 0 24px 64px rgba(0,0,0,0.6)",
                  overflow: "hidden",
                  maxWidth: 380,
                  margin: "0 auto",
                }}
              >
                {/* Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 18px 12px",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      background: "linear-gradient(90deg, #60a5fa, #a78bfa)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    ⬇ Grok Imagine Downloader
                  </span>
                  <span style={{ color: "#334155", fontSize: 16 }}>✕</span>
                </div>

                {/* Body */}
                <div style={{ padding: "14px 18px" }}>
                  {/* Stats */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    {[
                      { val: "247", label: "FETCHED", color: "#60a5fa" },
                      { val: "247", label: "DOWNLOADED", color: "#4ade80" },
                      { val: "247", label: "UNFAVORITED", color: "#f87171" },
                    ].map((s, i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.07)",
                          borderRadius: 10,
                          padding: "10px 8px",
                          textAlign: "center",
                        }}
                      >
                        <div style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.val}</div>
                        <div style={{ fontSize: 9, color: "#475569", marginTop: 3, letterSpacing: "0.05em" }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Progress */}
                  <div style={{ marginBottom: 14 }}>
                    <div
                      style={{
                        background: "rgba(255,255,255,0.07)",
                        borderRadius: 99,
                        height: 6,
                        overflow: "hidden",
                        marginBottom: 6,
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: "78%",
                          borderRadius: 99,
                          background: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 11, color: "#475569", textAlign: "center" }}>
                      193 / 247 — 193 saved, 0 failed
                    </div>
                  </div>

                  {/* Status */}
                  <div style={{ fontSize: 11, color: "#4ade80", textAlign: "center", marginBottom: 12 }}>
                    Downloading 193 files…
                  </div>

                  {/* Buttons */}
                  {[
                    { label: "⬇ Download All", style: { background: "linear-gradient(135deg, #3b82f6, #6366f1)", color: "white" } },
                    { label: "🗑 Unfavorite All", style: { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" } },
                    { label: "✕ Cancel Operation", style: { background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#fbbf24" } },
                  ].map((btn, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 600,
                        textAlign: "center",
                        marginBottom: 7,
                        ...btn.style,
                      }}
                    >
                      {btn.label}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section style={{ padding: "80px 0" }}>
        <div className="container" style={{ maxWidth: 720 }}>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.01 }}
          >
            <motion.div variants={fadeUp} custom={0} style={{ marginBottom: 40 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "#8b5cf6",
                  marginBottom: 12,
                }}
              >
                FAQ
              </div>
              <h2
                style={{
                  fontFamily: "'Outfit', system-ui, sans-serif",
                  fontSize: "clamp(24px, 3.5vw, 36px)",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                }}
              >
                Common questions
              </h2>
            </motion.div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {faqs.map((faq, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  custom={i + 1}
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "18px 20px",
                      background: "none",
                      border: "none",
                      color: "#e2e8f0",
                      cursor: "pointer",
                      fontSize: 15,
                      fontWeight: 600,
                      textAlign: "left",
                      gap: 12,
                    }}
                  >
                    <span>{faq.q}</span>
                    <span
                      style={{
                        color: "#3b82f6",
                        fontSize: 20,
                        flexShrink: 0,
                        transition: "transform 0.2s",
                        transform: openFaq === i ? "rotate(45deg)" : "none",
                      }}
                    >
                      +
                    </span>
                  </button>
                  {openFaq === i && (
                    <div
                      style={{
                        padding: "0 20px 18px",
                        fontSize: 14,
                        color: "#64748b",
                        lineHeight: 1.7,
                        borderTop: "1px solid rgba(255,255,255,0.05)",
                        paddingTop: 14,
                      }}
                    >
                      {faq.a}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Changelog ─────────────────────────────────────────────────── */}
      <section style={{ padding: "80px 0", background: "rgba(255,255,255,0.015)" }}>
        <div className="container" style={{ maxWidth: 720 }}>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.01 }}
          >
            <motion.div variants={fadeUp} custom={0} style={{ marginBottom: 40 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase" as const,
                  color: "#3b82f6",
                  marginBottom: 12,
                }}
              >
                Changelog
              </div>
              <h2
                style={{
                  fontFamily: "'Outfit', system-ui, sans-serif",
                  fontSize: "clamp(24px, 3.5vw, 36px)",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                }}
              >
                What's new
              </h2>
            </motion.div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {changelog.map((release, i) => (
                <motion.div
                  key={release.version}
                  variants={fadeUp}
                  custom={i + 1}
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    border: `1px solid ${i === 0 ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.07)"}`,
                    borderRadius: 14,
                    overflow: "hidden",
                  }}
                >
                  {/* Release header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "16px 20px",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                      background: i === 0 ? "rgba(59,130,246,0.04)" : "transparent",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Outfit', system-ui, sans-serif",
                        fontSize: 17,
                        fontWeight: 700,
                        color: "#e2e8f0",
                      }}
                    >
                      v{release.version}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase" as const,
                        color: release.tagColor,
                        background: `${release.tagColor}18`,
                        border: `1px solid ${release.tagColor}40`,
                        borderRadius: 4,
                        padding: "2px 7px",
                      }}
                    >
                      {release.tag}
                    </span>
                    <span style={{ marginLeft: "auto", fontSize: 12, color: "#475569" }}>
                      {release.date}
                    </span>
                  </div>

                  {/* Changes list */}
                  <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {release.changes.map((change, j) => (
                      <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase" as const,
                            padding: "2px 6px",
                            borderRadius: 4,
                            flexShrink: 0,
                            marginTop: 2,
                            ...(change.type === "new"
                              ? { background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)" }
                              : { background: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.25)" }
                            ),
                          }}
                        >
                          {change.type === "new" ? "new" : "improved"}
                        </span>
                        <span style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                          {change.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section
        style={{
          padding: "80px 0",
          background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.08))",
          borderTop: "1px solid rgba(59,130,246,0.1)",
        }}
      >
        <div className="container" style={{ textAlign: "center" }}>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.01 }}
          >
            <motion.h2
              variants={fadeUp}
              custom={0}
              style={{
                fontFamily: "'Outfit', system-ui, sans-serif",
                fontSize: "clamp(28px, 4vw, 44px)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                marginBottom: 16,
              }}
            >
              Your creations. Your machine.
            </motion.h2>
            <motion.p
              variants={fadeUp}
              custom={1}
              style={{ fontSize: 16, color: "#64748b", marginBottom: 36, maxWidth: 480, margin: "0 auto 36px" }}
            >
              Take ownership of everything you've made on Grok Imagine in minutes.
            </motion.p>
            <motion.a
              variants={fadeUp}
              custom={2}
              href={SCRIPT_URL}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                background: "linear-gradient(135deg, #3b82f6, #6366f1)",
                color: "white",
                padding: "16px 36px",
                borderRadius: 14,
                fontSize: 16,
                fontWeight: 700,
                textDecoration: "none",
                boxShadow: "0 8px 32px rgba(59,130,246,0.4)",
                letterSpacing: "0.01em",
              }}
            >
              ⬇ Install the Script
            </motion.a>
          </motion.div>
        </div>
      </section>

      {/* ── Donate ───────────────────────────────────────────────────────── */}
      <DonateSection />

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer
        style={{
          padding: "32px 0",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          textAlign: "center",
          fontSize: 13,
          color: "#1e293b",
        }}
      >
        <div className="container">
          <p style={{ marginBottom: 8 }}>
            Grok Imagine Downloader is an unofficial, open-source tool. Not affiliated with xAI or Grok.
          </p>
          <p style={{ marginTop: 8, color: "#1e293b" }}>
            Built with ❤️ — tips keep it maintained
          </p>
          <p>
            <a
              href="https://grok.com/imagine/favorites"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#3b82f6", textDecoration: "none" }}
            >
              Open Grok Imagine Favorites
            </a>
            {" · "}
            <a
              href="https://www.tampermonkey.net/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#3b82f6", textDecoration: "none" }}
            >
              Get Tampermonkey
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
