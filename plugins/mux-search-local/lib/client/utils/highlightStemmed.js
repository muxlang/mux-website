import { escapeHtml } from "./escapeHtml";
import { highlight } from "./highlight";
import { looseTokenize } from "./looseTokenize";
export function highlightStemmed(content, positions, tokens, maxLength = 50) {
  const chunkIndexRef = {
    chunkIndex: -1,
  };
  const chunks = splitIntoChunks(content, positions, tokens, 0, 0, chunkIndexRef);
  const leadingChunks = chunks.slice(0, chunkIndexRef.chunkIndex);
  const firstChunk = chunks[chunkIndexRef.chunkIndex];
  const html = [firstChunk.html];
  const trailingChunks = chunks.slice(chunkIndexRef.chunkIndex + 1);
  let currentLength = firstChunk.textLength;
  let leftPadding = 0;
  let rightPadding = 0;
  let leftOverflowed = false;
  let rightOverflowed = false;
  while (currentLength < maxLength) {
    const shouldTakeLeft =
      (leftPadding <= rightPadding || trailingChunks.length === 0) && leadingChunks.length > 0;
    if (shouldTakeLeft) {
      const chunk = leadingChunks.pop();
      if (!appendChunk(html, chunk, maxLength, currentLength, "left")) {
        leftOverflowed = true;
        leadingChunks.length = 0;
      } else {
        leftPadding += chunk.textLength;
        currentLength += chunk.textLength;
      }
      continue;
    }
    if (trailingChunks.length === 0) break;
    const chunk = trailingChunks.shift();
    if (!appendChunk(html, chunk, maxLength, currentLength, "right")) {
      rightOverflowed = true;
      trailingChunks.length = 0;
    } else {
      rightPadding += chunk.textLength;
      currentLength += chunk.textLength;
    }
  }
  if (leftOverflowed || leadingChunks.length > 0) {
    html.unshift("…");
  }
  if (rightOverflowed || trailingChunks.length > 0) {
    html.push("…");
  }
  return html.join("");
}
function appendChunk(html, chunk, maxLength, currentLength, side) {
  if (currentLength + chunk.textLength > maxLength) return false;
  if (side === "left") html.unshift(chunk.html);
  else html.push(chunk.html);
  return true;
}
export function splitIntoChunks(content, positions, tokens, positionIndex, cursor, chunkIndexRef) {
  const chunks = [];
  const [start, length] = positions[positionIndex];
  if (start < cursor) {
    positionIndex += 1;
    if (positionIndex < positions.length) {
      chunks.push(...splitIntoChunks(content, positions, tokens, positionIndex, cursor));
    }
    return chunks;
  }
  if (start > cursor) {
    chunks.push(
      ...looseTokenize(content.substring(cursor, start)).map((token) => ({
        html: escapeHtml(token),
        textLength: token.length,
      })),
    );
  }
  if (chunkIndexRef) {
    chunkIndexRef.chunkIndex = chunks.length;
  }
  chunks.push({
    html: highlight(content.substr(start, length), tokens, true),
    textLength: length,
  });
  const nextCursor = start + length;
  positionIndex += 1;
  if (positionIndex < positions.length) {
    chunks.push(...splitIntoChunks(content, positions, tokens, positionIndex, nextCursor));
  } else if (nextCursor < content.length) {
    chunks.push(
      ...looseTokenize(content.substr(nextCursor)).map((token) => ({
        html: escapeHtml(token),
        textLength: token.length,
      })),
    );
  }
  return chunks;
}
