"use client";

import { useState } from "react";
import { IconCheck, IconCopy } from "./icons";

export function CopyButton({
  value,
  label = "Copy",
  className = "",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable — ignore.
    }
  }

  return (
    <button type="button" onClick={copy} className={`btn !px-2 !py-1.5 text-xs ${className}`} title={label}>
      {copied ? <IconCheck className="h-3.5 w-3.5 text-success" /> : <IconCopy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}
