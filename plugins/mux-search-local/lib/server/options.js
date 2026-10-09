"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptionsSchema = exports.DEFAULT_OPTIONS = void 0;
exports.validateOptions = validateOptions;
const utils_validation_1 = require("@docusaurus/utils-validation");
exports.DEFAULT_OPTIONS = {
    indexDocs: true,
    indexBlog: true,
    indexPages: false,
    docsRouteBasePath: ["docs"],
    blogRouteBasePath: ["blog"],
    hashed: false,
    docsDir: ["docs"],
    blogDir: ["blog"],
    removeDefaultStopWordFilter: false,
    highlightSearchTermsOnTargetPage: false,
    searchResultLimits: 5,
    searchResultContextMaxLength: 50,
    ignoreFiles: [],
    translations: {
        search_placeholder: "Search",
        see_all_results: "See all results",
        no_results: "No results.",
        search_results_for: 'Search results for "{{ keyword }}"',
        search_the_documentation: "Search the documentation",
        count_documents_found_plural: "{{ count }} documents found",
        count_documents_found: "{{ count }} document found",
        no_documents_were_found: "No documents were found",
    },
    externalSearchSources: [],
};
const isStringOrArrayOfStrings = utils_validation_1.Joi.alternatives().try(utils_validation_1.Joi.string(), utils_validation_1.Joi.array().items(utils_validation_1.Joi.string()));
const isArrayOfStringsOrRegExpsOrStringOrRegExp = utils_validation_1.Joi.alternatives().try(utils_validation_1.Joi.array().items(utils_validation_1.Joi.alternatives().try(utils_validation_1.Joi.string(), utils_validation_1.Joi.object().regex())), utils_validation_1.Joi.string(), utils_validation_1.Joi.object().regex());
exports.OptionsSchema = utils_validation_1.Joi.object({
    indexDocs: utils_validation_1.Joi.boolean().default(exports.DEFAULT_OPTIONS.indexDocs),
    indexBlog: utils_validation_1.Joi.boolean().default(exports.DEFAULT_OPTIONS.indexBlog),
    indexPages: utils_validation_1.Joi.boolean().default(exports.DEFAULT_OPTIONS.indexPages),
    docsRouteBasePath: isStringOrArrayOfStrings.default(exports.DEFAULT_OPTIONS.docsRouteBasePath),
    blogRouteBasePath: isStringOrArrayOfStrings.default(exports.DEFAULT_OPTIONS.blogRouteBasePath),
    hashed: utils_validation_1.Joi.boolean().default(exports.DEFAULT_OPTIONS.hashed),
    docsDir: isStringOrArrayOfStrings.default(exports.DEFAULT_OPTIONS.docsDir),
    blogDir: isStringOrArrayOfStrings.default(exports.DEFAULT_OPTIONS.blogDir),
    removeDefaultStopWordFilter: utils_validation_1.Joi.boolean().default(exports.DEFAULT_OPTIONS.removeDefaultStopWordFilter),
    highlightSearchTermsOnTargetPage: utils_validation_1.Joi.boolean().default(exports.DEFAULT_OPTIONS.highlightSearchTermsOnTargetPage),
    searchResultLimits: utils_validation_1.Joi.number().default(exports.DEFAULT_OPTIONS.searchResultLimits),
    searchResultContextMaxLength: utils_validation_1.Joi.number().default(exports.DEFAULT_OPTIONS.searchResultContextMaxLength),
    ignoreFiles: isArrayOfStringsOrRegExpsOrStringOrRegExp.default(exports.DEFAULT_OPTIONS.ignoreFiles),
    translations: utils_validation_1.Joi.object({
        search_placeholder: utils_validation_1.Joi.string().default(exports.DEFAULT_OPTIONS.translations.search_placeholder),
        see_all_results: utils_validation_1.Joi.string().default(exports.DEFAULT_OPTIONS.translations.see_all_results),
        no_results: utils_validation_1.Joi.string().default(exports.DEFAULT_OPTIONS.translations.no_results),
        search_results_for: utils_validation_1.Joi.string().default(exports.DEFAULT_OPTIONS.translations.search_results_for),
        search_the_documentation: utils_validation_1.Joi.string().default(exports.DEFAULT_OPTIONS.translations.search_the_documentation),
        count_documents_found_plural: utils_validation_1.Joi.string().default((parent) => {
            var _a;
            return (_a = parent.count_documents_found) !== null && _a !== void 0 ? _a : exports.DEFAULT_OPTIONS.translations.count_documents_found_plural;
        }),
        count_documents_found: utils_validation_1.Joi.string().default(exports.DEFAULT_OPTIONS.translations.count_documents_found),
        no_documents_were_found: utils_validation_1.Joi.string().default(exports.DEFAULT_OPTIONS.translations.no_documents_were_found),
    })
        .default()
        .unknown(false),
    externalSearchSources: utils_validation_1.Joi.array()
        .items(utils_validation_1.Joi.object({
        heading: utils_validation_1.Joi.string(),
        uri: utils_validation_1.Joi.string(),
    }))
        .default(exports.DEFAULT_OPTIONS.externalSearchSources),
});
function validateOptions({ validate, options, }) {
    return validate(exports.OptionsSchema, options);
}
