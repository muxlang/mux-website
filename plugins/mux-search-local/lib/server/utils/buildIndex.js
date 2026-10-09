"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildIndex = buildIndex;
const tslib_1 = require("tslib");
const lunr_1 = tslib_1.__importDefault(require("lunr"));
function buildIndex(allDocuments) {
    return allDocuments.map((documents) => ({
        documents,
        index: (0, lunr_1.default)(function () {
            this.ref("i");
            this.field("t");
            this.metadataWhitelist = ["position"];
            documents.forEach((doc) => {
                this.add(Object.assign(Object.assign({}, doc), {
                    // The ref must be a string.
                    i: doc.i.toString() }));
            });
        }),
    }));
}
