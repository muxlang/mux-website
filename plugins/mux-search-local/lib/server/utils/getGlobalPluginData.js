"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGlobalPluginData = getGlobalPluginData;
const getIndexHash_1 = require("./getIndexHash");
function getGlobalPluginData(pluginConfig) {
    const { externalSearchSources, removeDefaultStopWordFilter, searchResultContextMaxLength, searchResultLimits, translations, highlightSearchTermsOnTargetPage, } = pluginConfig;
    return {
        externalSearchSources,
        removeDefaultStopWordFilter,
        searchResultContextMaxLength,
        searchResultLimits,
        translations,
        highlightSearchTermsOnTargetPage,
        indexHash: (0, getIndexHash_1.getIndexHash)(pluginConfig),
    };
}
