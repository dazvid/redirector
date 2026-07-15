"use client";

import { useState } from "react";
import { CopyIcon } from "@/components/Icons";

/** The search-engine URL template, with a copy button and the same toast pattern used elsewhere in the app. */
export function CopyableUrl({ url }: { url: string }) {
  const [toast, setToast] = useState<string | null>(null);

  async function copy() {
    try {
      await navigator.clipboard?.writeText(url);
    } catch {
      /* clipboard unavailable — toast still confirms intent */
    }
    setToast("Copied to clipboard");
    window.setTimeout(() => setToast(null), 1900);
  }

  return (
    <>
      <div className="prefixed" style={{ display: "inline-flex", maxWidth: "100%" }}>
        <span className="mono trunc">{url}</span>
        <button type="button" className="iconbtn" title="Copy" onClick={copy}>
          <CopyIcon size={14} />
        </button>
      </div>
      {toast ? (
        <div className="toast" role="status">
          <span className="toast-dot" />
          {toast}
        </div>
      ) : null}
    </>
  );
}
