"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parse = parse;
const tslib_1 = require("tslib");
const cheerio = tslib_1.__importStar(require("cheerio"));
const parseDocument_1 = require("./parseDocument");
const parsePage_1 = require("./parsePage");
function parse(html, type, url) {
    const $ = cheerio.load(html);
    // Remove copy buttons from code boxes
    $('div[class^="mdxCodeBlock_"] button').remove();
    if (type === "docs") {
        // Remove version badges
        $("span.badge")
            .filter((_, element) => $(element).text().startsWith("Version:"))
            .remove();
    }
    if (type === "page") {
        return (0, parsePage_1.parsePage)($, url);
    }
    return (0, parseDocument_1.parseDocument)($);
}
