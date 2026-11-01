# The Pictorial Key to the Tarot (A. E. Waite, 1910; 1922 reprint)

Reference text and illustrations for the Rider-Waite-Smith system. Waite's text and Pamela Colman Smith's
illustrations (1909 deck, as printed in the book) are public domain (published before 1931).

## Layout

- `text/` — full book as markdown, split by part. `<!-- pdf-page N -->` markers give the scan page index (not the printed page number).
  - `00-front-matter.md`, `01-part-1-the-veil-and-its-symbols.md`, `02-part-2-the-doctrine-behind-the-veil.md` (the 22 Trumps Major, symbolism),
    `03-part-3-the-outer-method-of-the-oracles.md` (divinatory meanings for all 78 cards, then spreads), `04-bibliography.md`
  - Card sections carry `##` headings; see `INDEX.md`.
- `images/` — 78 card plates from the book (`Pictorial_Key_to_the_Tarot_<NN>_<Name>.jpg`, `..._<Suit>_<01-14>.jpg`; 11-14 = Page, Knight, Queen, King),
  the 1922 title page and the frontispiece scan, plus `manifest.json` (source URL, sha1, size).
- `source/The_Pictorial_Key_to_the_Tarot.pdf` — the page-scan PDF the text was proofread against (ground truth for any doubt about the transcription).

## Provenance

- Text: English Wikisource proofread page transcriptions (`Page:The Pictorial Key to the Tarot.pdf/N`, N=1..345), rendered and converted to markdown. 
  Wikisource volunteer formatting may carry CC BY-SA 4.0 attribution requirements; the underlying work is public domain.
- Images and PDF: Wikimedia Commons, category "The Pictorial Key to the Tarot" (original-era scans, not modern redraws). 
  The vectorised `Pamela Colman Smith Tarot 10 Wheel of Fortune.svg` was deliberately skipped in favour of the scan.
- Fetched 2026-10-31. Footnote markers were dropped from the text; footnote bodies remain at the end of each file.
