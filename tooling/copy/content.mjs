// Reads the tables of docs/design/content.md that the copy tools depend on.

export function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Rows of the first table under a `## <heading>` or `### <heading>` line, as
// arrays of trimmed cells, without the header and the separator. Fails loudly
// when the table is missing or its header changed, so a tool never runs with
// an empty table.
export function readTable(content, heading, columns, fixHint) {
  const escaped = escapeRegExp(heading);
  const section =
    content
      .split(new RegExp(`^#{2,3} ${escaped}$`, 'm'))[1]
      ?.split(/^#{1,3} /m)[0] ?? '';
  const rows = [];
  for (const line of section.split('\n')) {
    if (line.startsWith('|'))
      rows.push(
        line
          .split('|')
          .slice(1, -1)
          .map((cell) => cell.trim()),
      );
    else if (rows.length > 0) break;
  }
  const header = rows[0] ?? [];
  const body = rows.slice(2).filter((row) => row[0] !== '');
  if (columns.some((column, index) => header[index] !== column) || !body.length)
    throw new Error(
      `No table (${columns.join(' / ')}) under "${heading}" in docs/design/content.md. ${fixHint}`,
    );
  return body;
}
