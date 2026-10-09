"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postBuildFactory = postBuildFactory;
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
const path_1 = tslib_1.__importDefault(require("path"));
const util_1 = tslib_1.__importDefault(require("util"));
const buildIndex_1 = require("./buildIndex");
const debug_1 = require("./debug");
const processDocInfos_1 = require("./processDocInfos");
const scanDocuments_1 = require("./scanDocuments");
const writeFileAsync = util_1.default.promisify(fs_1.default.writeFile);
function postBuildFactory(config) {
    return async function postBuild(buildData) {
        (0, debug_1.debugInfo)("gathering documents");
        const data = (0, processDocInfos_1.processDocInfos)(buildData, config);
        (0, debug_1.debugInfo)("parsing documents");
        // Give every index entry a unique id so that the index does not need to store long URLs.
        const allDocuments = await (0, scanDocuments_1.scanDocuments)(data);
        (0, debug_1.debugInfo)("building index");
        const searchIndex = (0, buildIndex_1.buildIndex)(allDocuments);
        (0, debug_1.debugInfo)("writing index to disk");
        await writeFileAsync(path_1.default.join(buildData.outDir, "search-index.json"), JSON.stringify(searchIndex), { encoding: "utf8" });
        (0, debug_1.debugInfo)("index written to disk successfully!");
    };
}
