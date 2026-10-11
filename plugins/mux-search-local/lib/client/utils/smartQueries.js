import lunr from "lunr";
import { smartTerms } from "./smartTerms";
/**
 * Get all possible queries for a list of tokens consists of words mixed English and Chinese,
 * by a Chinese words dictionary.
 *
 * @returns A smart query list.
 */
export function smartQueries(tokens, queryOptions = {}) {
  const { removeDefaultStopWordFilter } = queryOptions;
  if (tokens.length === 0) return [];
  const terms = smartTerms(tokens);
  if (terms.length === 0) {
    // There are no matched terms.
    // All tokens are considered required and with wildcard.
    return [
      {
        tokens,
        term: tokens.map((value) => ({
          value,
          presence: lunr.Query.presence.REQUIRED,
          wildcard: lunr.Query.wildcard.LEADING | lunr.Query.wildcard.TRAILING,
        })),
      },
    ];
  }
  // The last token of a term maybe incomplete while user is typing.
  for (const term of terms) {
    term[term.length - 1].maybeTyping = true;
  }
  const refinedTerms = getTermsWithoutStopWords(terms, removeDefaultStopWordFilter);
  const extraTerms = getTermsMissingOneToken(refinedTerms);
  return getQueriesMaybeTyping(terms).concat(getQueriesMaybeTyping(extraTerms));
}
function getTermsWithoutStopWords(terms, removeDefaultStopWordFilter) {
  if (removeDefaultStopWordFilter) return terms.slice();

  const refinedTerms = [];
  const additionalTerms = [];
  for (const term of terms) {
    const filteredTerm = term.filter((item) => lunr.stopWordFilter(item.value));
    refinedTerms.push(filteredTerm);
    if (filteredTerm.length > 0 && filteredTerm.length < term.length) {
      additionalTerms.push(filteredTerm);
    }
  }
  terms.push(...additionalTerms);
  return refinedTerms;
}
function getTermsMissingOneToken(terms) {
  return terms
    .filter((term) => term.length > 2)
    .flatMap((term) => term.map((_, index) => term.slice(0, index).concat(term.slice(index + 1))));
}
function getQueriesMaybeTyping(terms) {
  return termsToQueries(terms).concat(
    termsToQueries(
      // Ignore terms whose last token already has a trailing wildcard,
      // or the last token is not `maybeTyping`.
      terms.filter((term) => {
        const token = term[term.length - 1];
        return !token.trailing && token.maybeTyping;
      }),
      true,
    ),
  );
}
function termsToQueries(terms, maybeTyping) {
  return terms.map((term) => ({
    tokens: term.map((item) => item.value),
    term: term.map((item) => ({
      value: item.value,
      presence: lunr.Query.presence.REQUIRED,
      // The last token of a term maybe incomplete while user is typing.
      // So append more queries with trailing wildcard added.
      wildcard: getWildcard(item, maybeTyping),
    })),
  }));
}
function getWildcard(item, maybeTyping) {
  const shouldUseTrailingWildcard = maybeTyping ? item.trailing || item.maybeTyping : item.trailing;
  return shouldUseTrailingWildcard ? lunr.Query.wildcard.TRAILING : lunr.Query.wildcard.NONE;
}
