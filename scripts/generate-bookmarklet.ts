import { writeFileSync } from 'fs'
import { join } from 'path'
import { BOOKMARKLET_SCRIPT_TEMPLATE } from '../src/lib/receipts/bookmarklet'

const OUTPUT_PATH = join(__dirname, '..', 'public', 'bookmarklet', 'trumf-import.js')

const header = `// GENERATED FILE — do not edit directly.
// Source of truth: src/lib/receipts/bookmarklet.ts (BOOKMARKLET_SCRIPT_TEMPLATE).
// Regenerate with: npm run generate:bookmarklet
//
// This is the inspectable reference copy of the Trumf receipt import bookmarklet.
// __SPENDLENS_API_BASE__ and __IMPORT_TOKEN__ are substituted per-user at generation
// time by buildBookmarkletHref() — this file keeps the raw placeholders.

`

writeFileSync(OUTPUT_PATH, header + BOOKMARKLET_SCRIPT_TEMPLATE)
console.log(`Wrote ${OUTPUT_PATH}`)
