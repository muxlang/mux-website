import { useEffect } from "react";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { resolveApiUrl } from "../lib/apiUrl";

const WARMUP_SESSION_KEY = "mux-api-warmed";

/**
 * Fires a single fire-and-forget request to the Mux API's health endpoint
 * once per browser session, to pre-warm it before the user presses Run.
 * The API scales to zero on fly.io, so the first real request can take up
 * to about a minute; warming it as soon as an editor mounts hides most of
 * that cold start behind the time the user spends reading/writing code.
 *
 * Safe to call from multiple components mounting at once: sessionStorage
 * guards against sending more than one warmup request per session.
 */
function useApiWarmup(): void {
  const { siteConfig } = useDocusaurusContext();
  const apiUrl = resolveApiUrl(siteConfig.customFields);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let alreadyWarmed = false;
    try {
      alreadyWarmed = window.sessionStorage.getItem(WARMUP_SESSION_KEY) !== null;
    } catch {
      // sessionStorage unavailable (e.g. privacy mode); skip warmup.
      return;
    }

    if (alreadyWarmed) {
      return;
    }

    try {
      window.sessionStorage.setItem(WARMUP_SESSION_KEY, "1");
    } catch {
      // Ignore write failures; worst case we send an extra warmup request.
    }

    fetch(`${apiUrl}/health`).catch(() => {
      // Best-effort only; ignore all errors.
    });
  }, [apiUrl]);
}

export default useApiWarmup;
