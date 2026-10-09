"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPluginConfig = getPluginConfig;
const tslib_1 = require("tslib");
const path_1 = tslib_1.__importDefault(require("path"));
function getArrayOption(value) {
    return Array.isArray(value) ? value : [value];
}
function getPluginConfig(options, siteDir) {
    const { blogDir, blogRouteBasePath, docsDir, docsRouteBasePath, externalSearchSources, hashed, highlightSearchTermsOnTargetPage, id, ignoreFiles, indexBlog, indexDocs, indexPages, removeDefaultStopWordFilter, searchResultContextMaxLength, searchResultLimits, translations, } = options;
    const config = {
        externalSearchSources,
        hashed,
        highlightSearchTermsOnTargetPage,
        id,
        indexBlog,
        indexDocs,
        indexPages,
        removeDefaultStopWordFilter,
        searchResultContextMaxLength,
        searchResultLimits,
        translations,
        blogDir: getArrayOption(blogDir).map((dir) => path_1.default.resolve(siteDir, dir)),
        docsDir: getArrayOption(docsDir).map((dir) => path_1.default.resolve(siteDir, dir)),
        blogRouteBasePath: getArrayOption(blogRouteBasePath).map((basePath) => basePath.replace(/^\//, "")),
        docsRouteBasePath: getArrayOption(docsRouteBasePath).map((basePath) => basePath.replace(/^\//, "")),
        ignoreFiles: getArrayOption(ignoreFiles),
    };
    return config;
}
