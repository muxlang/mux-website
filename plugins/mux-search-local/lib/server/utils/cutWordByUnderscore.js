"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cutWordByUnderscore = cutWordByUnderscore;
const splitRegExp = [/(_)([^_])/g, /([^_])(_)/g];
function cutWordByUnderscore(input) {
    return splitRegExp
        .reduce((carry, re) => carry.replace(re, "$1\0$2"), input)
        .split("\0");
}
