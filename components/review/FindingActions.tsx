"use client";

import React, { useState } from "react";
import type { Evidence } from "@/src/types";
import { Tooltip } from "./Tooltip";
import { Button } from "@/components/ui/Button";

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
          <Button variant="secondary" size="sm" onClick={handleCopy}>
            {flash === "copy" ? "Copied!" : "Copy"}
          </Button>
        </Tooltip>
        <Tooltip text="Open a pre-filled GitHub issue with this finding's details">
          <Button variant="secondary" size="sm" onClick={handleGitHub}>
            {flash === "github" ? "Opened!" : "GitHub issue ↗"}
          </Button>
        </Tooltip>
        {localStorage.getItem("vpat-github-repo") && (
          <Tooltip text="Change the saved GitHub repository URL">
            <Button variant="ghost" size="sm" onClick={() => { localStorage.removeItem("vpat-github-repo"); setShowRepo(false); }}>
              change repo
            </Button>
          </Tooltip>
        )}
      </div>
      {showRepo && (
        <div className="flex items-center gap-1.5">
          <input
            aria-label="GitHub repository URL"
            className="flex-1 text-[12px] rounded border border-rule px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent bg-surface text-ink-1"
            placeholder="https://github.com/org/repo"
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleRepoSubmit(); if (e.key === "Escape") setShowRepo(false); }}
          />
          <Button variant="primary" size="sm" onClick={handleRepoSubmit} disabled={!repoInput.trim()}>
            Open
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowRepo(false)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
