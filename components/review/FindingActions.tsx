"use client";

import React, { useState } from "react";
import type { Evidence } from "@/src/types";
import { Tooltip } from "./Tooltip";

export function FindingActions({
  evidence,
  criterionRef,
  criterionText,
}: {
  evidence: Evidence;
  criterionRef: string;
  criterionText: string;
}) {
  const [flash, setFlash] = useState<"copy" | "github" | null>(null);
  const [showRepo, setShowRepo] = useState(false);
  const [repoInput, setRepoInput] = useState("");

  const plainText = [
    `Accessibility issue: ${criterionRef}`,
    evidence.rawId ? `Rule: ${evidence.rawId}` : null,
    `Detail: ${evidence.detail}`,
    evidence.ref ? `Location: ${evidence.ref}` : null,
  ].filter(Boolean).join("\n");

  const issueTitle = `Accessibility: ${criterionRef}${evidence.rawId ? ` — ${evidence.rawId}` : ""}`;
  const issueBody = [
    `## Accessibility Issue: ${criterionRef}`,
    "",
    `**Criterion:** ${criterionRef} — ${criterionText}`,
    evidence.rawId ? `**Rule:** \`${evidence.rawId}\`` : null,
    "",
    "### Finding",
    evidence.detail,
    "",
    evidence.ref ? `### Location\n\`\`\`\n${evidence.ref}\n\`\`\`` : null,
    "",
    "---",
    "_Found by VPAT Compliance Scanner_",
  ].filter((l) => l !== null).join("\n");

  const flashFor = (key: "copy" | "github") => {
    setFlash(key);
    setTimeout(() => setFlash(null), 2000);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(plainText).then(() => flashFor("copy"));
  };

  const openIssue = (repoUrl: string) => {
    const base = repoUrl.replace(/\/$/, "").replace(/\.git$/, "");
    const url = `${base}/issues/new?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}`;
    window.open(url, "_blank", "noopener");
    flashFor("github");
    setShowRepo(false);
  };

  const handleGitHub = () => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("vpat-github-repo") : null;
    if (saved) {
      openIssue(saved);
    } else {
      setRepoInput("");
      setShowRepo(true);
    }
  };

  const handleRepoSubmit = () => {
    const url = repoInput.trim();
    if (!url) return;
    localStorage.setItem("vpat-github-repo", url);
    openIssue(url);
  };

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Tooltip text="Copy this finding as plain text for pasting into an email">
          <button
            onClick={handleCopy}
            className="text-[10px] px-2 py-0.5 rounded border border-orange-300 text-orange-700 hover:bg-orange-100 transition-colors"
          >
            {flash === "copy" ? "Copied!" : "Copy"}
          </button>
        </Tooltip>
        <Tooltip text="Open a pre-filled GitHub issue with this finding's details">
          <button
            onClick={handleGitHub}
            className="text-[10px] px-2 py-0.5 rounded border border-orange-300 text-orange-700 hover:bg-orange-100 transition-colors"
          >
            {flash === "github" ? "Opened!" : "GitHub issue ↗"}
          </button>
        </Tooltip>
        {localStorage.getItem("vpat-github-repo") && (
          <Tooltip text="Change the saved GitHub repository URL">
            <button
              onClick={() => { localStorage.removeItem("vpat-github-repo"); setShowRepo(false); }}
              className="text-[10px] text-orange-400 hover:text-orange-600 transition-colors"
            >
              change repo
            </button>
          </Tooltip>
        )}
      </div>
      {showRepo && (
        <div className="flex items-center gap-1.5">
          <input
            aria-label="GitHub repository URL"
            className="flex-1 text-[10px] rounded border border-orange-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white"
            placeholder="https://github.com/org/repo"
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleRepoSubmit(); if (e.key === "Escape") setShowRepo(false); }}
          />
          <button
            onClick={handleRepoSubmit}
            disabled={!repoInput.trim()}
            className="text-[10px] px-2 py-1 rounded bg-orange-700 text-white hover:bg-orange-800 disabled:opacity-50"
          >
            Open
          </button>
          <button onClick={() => setShowRepo(false)} className="text-[10px] text-orange-500 hover:text-orange-700">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
