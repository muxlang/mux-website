"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanDocuments = scanDocuments;
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
const path_1 = tslib_1.__importDefault(require("path"));
const util_1 = tslib_1.__importDefault(require("util"));
const parse_1 = require("./parse");
const debug_1 = require("./debug");
const readFileAsync = util_1.default.promisify(fs_1.default.readFile);
let nextDocId = 0;
const getNextDocId = () => {
    return (nextDocId += 1);
};
async function scanDocuments(DocInfoWithFilePathList) {
    const titleDocuments = [];
    const headingDocuments = [];
    const contentDocuments = [];
    const allDocuments = [titleDocuments, headingDocuments, contentDocuments];
    await Promise.all(DocInfoWithFilePathList.map(async ({ filePath, url, type }) => {
        (0, debug_1.debugVerbose)(`parsing %s file %o of %o`, type, path_1.default.relative(process.cwd(), filePath), url);
        const html = await readFileAsync(filePath, { encoding: "utf8" });
        const { pageTitle, sections, breadcrumb } = (0, parse_1.parse)(html, type, url);
        const titleId = getNextDocId();
        titleDocuments.push({
            i: titleId,
            t: pageTitle,
            u: url,
            b: breadcrumb,
        });
        for (const section of sections) {
            if (section.title !== pageTitle) {
                headingDocuments.push({
                    i: getNextDocId(),
                    t: section.title,
                    u: url,
                    h: section.hash,
                    p: titleId,
                });
            }
            if (section.content) {
                contentDocuments.push({
                    i: getNextDocId(),
                    t: section.content,
                    s: section.title || pageTitle,
                    u: url,
                    h: section.hash,
                    p: titleId,
                });
            }
        }
    }));
    return allDocuments;
}
