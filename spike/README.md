# Arabic export spike — Bucket 3, Step 1

Proves that Arabic exports correctly to PDF and Word before anything is
built on top of it. Kept in the repo because the findings, not the code,
are what Bucket 3 is built on.

## Run it

```
node build-html.mjs     # writes sample.html with Cairo inlined as base64
node make-docx.mjs      # writes studio-os-arabic-sample.docx
```

PDF, via the browser engine:

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --virtual-time-budget=20000 \
  --no-pdf-header-footer --print-to-pdf=out.pdf file://$PWD/sample.html
```

## What was learned

**`--virtual-time-budget` is not optional.** Without it Chrome prints
before the webfonts have loaded. The result is a 21KB PDF with correct
vector layout, zero embedded fonts, and no Arabic at all — it fails
silently and looks like a font problem. With it, the same page produces
a 225KB PDF with the fonts embedded. Any serverless version of this must
wait for `document.fonts.ready` before printing.

**Bidi needs explicit isolation, in both formats.** A phone number like
`+20 106 679 2806` inside an Arabic line renders reversed as
`2806 679 106 20+`, because the leading `+` and the spaces are
bidi-neutral and get absorbed by the surrounding Arabic. Setting the run
to LTR is not enough.

- HTML/PDF: wrap in `<bdi>`
- Word: wrap in U+2066 LEFT-TO-RIGHT ISOLATE … U+2069 POP DIRECTIONAL ISOLATE

**Do not isolate a string that is itself Arabic.** Wrapping the Arabic
date `4 أغسطس 2026` as LTR pushed the day to the end (`أغسطس 2026 4`).
Isolation is for foreign runs only — Latin names, emails, phone numbers,
codes.

**Phone numbers need `white-space: nowrap`,** or they break across lines
mid-number.

## Verification notes

`textutil` was used to preview the .docx, and it right-aligns the English
section. That is a converter artifact, not a defect: the OOXML has no
`w:bidi` and `w:jc="left"` on every English paragraph, `w:bidi` +
`w:jc="right"` on every Arabic one, and `w:bidiVisual` on the Arabic
table only. Word is the target and honours all three.
