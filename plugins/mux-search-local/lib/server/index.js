"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateOptions = void 0;
exports.default = DocusaurusSearchLocalPlugin;
const tslib_1 = require("tslib");
const path_1 = tslib_1.__importDefault(require("path"));
const utils_1 = require("@docusaurus/utils");
const validate_peer_dependencies_1 = tslib_1.__importDefault(require("validate-peer-dependencies"));
const getPluginConfig_1 = require("./utils/getPluginConfig");
const getGlobalPluginData_1 = require("./utils/getGlobalPluginData");
const postBuildFactory_1 = require("./utils/postBuildFactory");
const PLUGIN_NAME = "docusaurus-plugin-search-local";
(0, validate_peer_dependencies_1.default)(__dirname);
function DocusaurusSearchLocalPlugin(context, options) {
    const config = (0, getPluginConfig_1.getPluginConfig)(options, context.siteDir);
    const themePath = path_1.default.resolve(__dirname, "../client/theme");
    const pagePath = path_1.default.join(themePath, "SearchPage/index.js");
    return {
        name: PLUGIN_NAME,
        getThemePath() {
            return themePath;
        },
        postBuild: (0, postBuildFactory_1.postBuildFactory)(config),
        getPathsToWatch() {
            return [pagePath];
        },
        async contentLoaded({ actions: { addRoute, setGlobalData } }) {
            addRoute({
                path: (0, utils_1.normalizeUrl)([context.baseUrl, "search"]),
                component: "@theme/SearchPage",
                exact: true,
            });
            // Setting global data for use on client side.
            setGlobalData((0, getGlobalPluginData_1.getGlobalPluginData)(config));
        },
    };
}
var options_1 = require("./options");
Object.defineProperty(exports, "validateOptions", { enumerable: true, get: function () { return options_1.validateOptions; } });
