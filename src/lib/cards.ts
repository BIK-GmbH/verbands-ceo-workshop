/**
 * Cards from card mode carry their classification as prefixes: "[Kategorie] {Zeithorizont} Kartentext".
 * On slides those prefixes drive the layout; in the protocol and in every export the text comes
 * first and the classification follows as a readable suffix.
 */
const GROUP_PREFIX = /^\[([^\]]+)\]\s*/;
const TAG_PREFIX = /^\{([^}]+)\}\s*/;

export function formatCardLine(line: string): string {
  let rest = line;
  const labels: string[] = [];
  const group = GROUP_PREFIX.exec(rest);
  if (group) {
    labels.push(group[1]);
    rest = rest.slice(group[0].length);
  }
  const tag = TAG_PREFIX.exec(rest);
  if (tag) {
    labels.push(tag[1]);
    rest = rest.slice(tag[0].length);
  }
  return labels.length ? `${rest} (${labels.join(" · ")})` : rest;
}
