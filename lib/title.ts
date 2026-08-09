// Deterministic title cleanup, locked verbatim per 02-CONTEXT.md D-04/D-05:
// strip the extension, replace runs of underscores/hyphens with a single
// space, collapse repeated whitespace, trim, then Title Case each word.
// No special-case parsing for author/title splitting or leading track
// numbers (D-05) — this keeps the rule fully predictable.
//
// Kept to plain functions/simple type annotations (no enums, namespaces,
// or parameter properties) so scripts/library-logic.test.mjs can import it
// directly under Node's built-in type stripping.
export function cleanTitle(filename: string): string {
  const withoutExt = filename.replace(/\.[^/.]+$/, "");
  const spaced = withoutExt
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return spaced.replace(
    /\w\S*/g,
    (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
  );
}
// cleanTitle('the_great_gatsby-01.mp3') === 'The Great Gatsby 01' (D-04's locked example)
