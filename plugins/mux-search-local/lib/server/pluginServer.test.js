import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import lunr from "lunr";
import { describe, expect, it, vi } from "vitest";
import { validateOptions, DEFAULT_OPTIONS } from "./options";
import DocusaurusSearchLocalPlugin from "./index";
import { buildIndex } from "./utils/buildIndex";
import { getGlobalPluginData } from "./utils/getGlobalPluginData";
import { getIndexHash } from "./utils/getIndexHash";
import { getPluginConfig } from "./utils/getPluginConfig";
import { parse } from "./utils/parse";
import { processDocInfos } from "./utils/processDocInfos";
import { scanDocuments } from "./utils/scanDocuments";

describe("search plugin server", () => {
  it("validates defaults and normalizes single directory options", () => {
    const validated = validateOptions({
      validate: (schema, options) => schema.validate(options),
      options: {},
    });
    expect(validated.value).toMatchObject(DEFAULT_OPTIONS);
    expect(validated.value.translations.count_documents_found_plural).toBe(
      DEFAULT_OPTIONS.translations.count_documents_found_plural,
    );
    const config = getPluginConfig(
      { ...DEFAULT_OPTIONS, docsDir: "manual", docsRouteBasePath: "/guide", ignoreFiles: "hidden" },
      "/site",
    );
    expect(config.docsDir).toEqual(["/site/manual"]);
    expect(config.docsRouteBasePath).toEqual(["guide"]);
    expect(config.ignoreFiles).toEqual(["hidden"]);
  });

  it("exposes plugin routes, theme path, and browser data", async () => {
    const plugin = DocusaurusSearchLocalPlugin(
      { siteDir: "/site", baseUrl: "/base/" },
      { ...DEFAULT_OPTIONS },
    );
    expect(plugin.name).toBe("docusaurus-plugin-search-local");
    expect(plugin.getPathsToWatch()).toEqual([expect.stringContaining("SearchPage/index.js")]);
    expect(plugin.getThemePath()).toContain("client/theme");
    const addRoute = vi.fn();
    const setGlobalData = vi.fn();
    await plugin.contentLoaded({ actions: { addRoute, setGlobalData } });
    expect(addRoute).toHaveBeenCalledWith({
      path: "/base/search",
      component: "@theme/SearchPage",
      exact: true,
    });
    expect(setGlobalData).toHaveBeenCalledWith(getGlobalPluginData(DEFAULT_OPTIONS));
  });

  it("filters routes and creates indexes from parsed documentation", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "mux-search-tests-"));
    try {
      const docsDir = path.join(root, "docs");
      mkdirSync(docsDir);
      const html = path.join(docsDir, "guide.html");
      writeFileSync(
        html,
        '<article><header><h1>Guide</h1></header><div class="markdown"><h1>Guide</h1><p>Intro <strong>text</strong>.</p><h2>Setup<a class="hash-link" href="#setup">#</a></h2><p>Install Mux.</p></div></article>',
      );
      const parsed = parse(readFileSync(html, "utf8"), "docs", "/docs/guide");
      expect(parsed.pageTitle).toBe("Guide");
      expect(parsed.sections.map(({ title }) => title)).toContain("Setup");

      const docs = processDocInfos(
        {
          routesPaths: ["/docs/guide", "/docs", "/search", "/blog/post"],
          outDir: root,
          baseUrl: "/",
          siteConfig: { trailingSlash: true },
        },
        {
          indexDocs: true,
          indexBlog: false,
          indexPages: false,
          docsRouteBasePath: ["docs"],
          blogRouteBasePath: ["blog"],
        },
      );
      expect(docs).toEqual([
        { filePath: path.join(root, "docs/guide/index.html"), url: "/docs/guide", type: "docs" },
        { filePath: path.join(root, "docs/index.html"), url: "/docs", type: "docs" },
      ]);

      const scanned = await scanDocuments([{ filePath: html, url: "/docs/guide", type: "docs" }]);
      const indexes = buildIndex(scanned);
      expect(indexes).toHaveLength(3);
      expect(
        indexes[0].index.query((query) =>
          query.term("guide", { wildcard: lunr.Query.wildcard.NONE }),
        ),
      ).toHaveLength(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("parses standalone pages and calculates hashes only when enabled", () => {
    expect(
      parse(
        "<html><title>Page</title><main><p>Hello <em>world</em>.</p></main></html>",
        "page",
        "/page",
      ),
    ).toMatchObject({
      pageTitle: "Page",
      sections: [{ content: "Hello world." }],
    });
    const root = mkdtempSync(path.join(os.tmpdir(), "mux-search-hash-"));
    try {
      writeFileSync(path.join(root, "guide.md"), "# Guide");
      expect(getIndexHash({ hashed: false })).toBeNull();
      expect(
        getIndexHash({ hashed: true, indexDocs: true, docsDir: [root], indexBlog: false }),
      ).toMatch(/^[a-f0-9]{8}$/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("writes a searchable index after a site build", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "mux-search-build-"));
    try {
      const documentPath = path.join(root, "docs/guide/index.html");
      mkdirSync(path.dirname(documentPath), { recursive: true });
      writeFileSync(
        documentPath,
        "<article><header><h1>Guide</h1></header><div class=markdown><h1>Guide</h1><p>Searchable Mux content.</p></div></article>",
      );
      const plugin = DocusaurusSearchLocalPlugin(
        { siteDir: root, baseUrl: "/" },
        { ...DEFAULT_OPTIONS, docsDir: ["docs"], indexBlog: false },
      );
      await plugin.postBuild({
        routesPaths: ["/docs/guide"],
        outDir: root,
        baseUrl: "/",
        siteConfig: { trailingSlash: true },
      });
      const indexes = JSON.parse(readFileSync(path.join(root, "search-index.json"), "utf8"));
      expect(indexes).toHaveLength(3);
      expect(indexes[0].documents[0]).toMatchObject({ t: "Guide", u: "/docs/guide" });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
