import React, { useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";
import Layout from "@theme/Layout";
import ReactMarkdown from "react-markdown";
import styles from "./changelog.module.css";

const CHANGELOG_RAW_URL =
  "https://raw.githubusercontent.com/muxlang/mux-compiler/main/CHANGELOG.md";
const CHANGELOG_SOURCE_URL = "https://github.com/muxlang/mux-compiler/blob/main/CHANGELOG.md";

export default function ChangelogPage(): ReactNode {
  const [changelog, setChangelog] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchChangelog() {
      try {
        const response = await fetch(CHANGELOG_RAW_URL);
        if (!response.ok) throw new Error("Failed to fetch changelog");
        const text = await response.text();
        if (!cancelled) setChangelog(text);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load changelog");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchChangelog();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Layout title="Changelog" description="Version history and release notes for Mux">
      <div className={styles.changelogContainer}>
        <div className={styles.header}>
          <h1>Changelog</h1>
          <p className={styles.subtitle}>Version history, features, and bug fixes</p>
        </div>

        <div className={styles.content}>
          {loading && (
            <div className={styles.loading}>
              <p>Loading changelog...</p>
            </div>
          )}

          {error && (
            <div className={styles.error}>
              <p>Failed to load changelog: {error}</p>
              <p>
                <a href={CHANGELOG_SOURCE_URL} target="_blank" rel="noopener noreferrer">
                  View on GitHub
                </a>
              </p>
            </div>
          )}

          {!loading && !error && changelog && (
            <div className={clsx("markdown", styles.markdown)}>
              <ReactMarkdown>{changelog}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
