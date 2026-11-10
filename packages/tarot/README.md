# dsh-rws-tarot

Translations into languages other than English are machine-generated, so quality may vary. Corrections are very welcome through a pull request or issue.

Rider-Waite-Smith tarot for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). Open a **Tarot** page in the right dock, pick a spread (the three methods of the book, a plain draw, or three or nine cards in modern layouts), and click the glowing card to turn it over. Each card is read to you in the conversation as it is turned.

This is a tool for reflection, study and entertainment. It cannot foretell anything: please read the [disclaimer](#disclaimer).

## Features

- **Six ways to draw.** Three methods from Waite's book (the Celtic Cross, the alternative method of 42 cards, and the thirty-five card continuation), a plain draw of 1 to 12 cards, and two layouts of modern practice, three cards (past, present, future) and nine cards (a 3 × 3 grid).
- **A right-dock page.** The spread lies on the page with the card backs up. The next card to turn glows, and only that card can be clicked; the plates are Pamela Colman Smith's, as printed in the book.
- **One card at a time.** Each card you turn is handed to the conversation with its position, its meanings from the book and the cards already down, and the model answers for it. After the last card it draws the whole spread together.
- **The book's own words.** Card meanings, position explanations and the methods come from *The Pictorial Key to the Tarot* and are supplied by code, never recalled by the model. Where the book is silent a field stays empty rather than being filled in from elsewhere.
- **Reversals, recurrences, repeats.** Optional reversed cards, the book's remark when a rank comes up two, three or four times, and the follow-up the book suggests for a doubtful tenth card.
- **Durable readings.** A reading is stored in its conversation and survives a reload or a restart; a session can hold any number of them.
- **Command and tool.** `/tarot` runs every step from the composer, and the model has a `tarot_lay_spread` tool to lay a spread when you ask in conversation.
- **Languages.** English and Chinese (card and position names, instructions to the model and the page); other languages fall back to English. The plugin's name and description on the Plugins page are translated into every language the shell offers.
- **Non-intrusive.** The plugin adds a page and one row for its own tool; it replaces nothing of the host.

The cards are drawn by code, not by the model: the shuffle, the cuts, the layout and the position of every card are done deterministically (with a cryptographic random source), and what each card means in its position comes from the text of Arthur Edward Waite's *The Pictorial Key to the Tarot* (1910), which the plugin carries. The model only reasons on top of those facts, so it is never asked to recall a card's meaning, and it is told to say nothing about a card that has not been turned.

## Install

```bash
dsh plugin --profile <profile> add dsh-rws-tarot
```

Requires DeepSeek Harness `>=0.2.2-rc.1 <0.2.3` and a model the profile can already use. The plugin adds a page to the right dock and does not change any existing page.

## Use

1. Open a conversation, open the right dock and choose **Tarot** on its start page.
2. Choose how to draw and, optionally, write your question. Open **About this spread** for a concise explanation of how the selected layout unfolds. Three methods from Waite's book are available, and three draws of modern practice:
   - **Celtic Cross**, the ancient method, for a definite question: a Significator and ten cards.
   - **Thirty-five card method**, which carries a finished alternative reading further with the 35 cards it left over, laid in six lines of unequal length (7, 6, 5, 4, 2 and 11 cards) read from the left. Each line has a meaning of its own, from the book (the house, the person, what is passing outside, a surprise, consolation, and the line that explains the others). It becomes available once an alternative reading is finished, and you may add what remained doubtful.
   - **Alternative method**, for when no definite question is asked and you want to hear generally about the course of your life: 42 cards in six lines of seven, with the Querent's card (the Magician for a man, the High Priestess for a woman) lying beside the first line. You may name a period of time instead of a question.
   - **Plain draw**, for a simple question or when you just want a few cards: choose how many (1 to 12) and turn them one at a time. It is not one of the book's methods, so the cards have no positions; each carries the book's meanings and is read with the others on the table.
   - **Three cards**: the past, the present and the future, a quick look at a matter. Not from the book, but each place borrows what the Celtic Cross says of the card behind the person (the influence just passed or passing away), the card that covers them (the atmosphere the other currents work in) and the card before them (what comes into action in the near future); think of it as a simplified Celtic Cross.
   - **Nine cards**: three rows of three, turned in order from the top left. Not from the book: the layout is common modern practice (the *Portrait* or *Box* of Lenormand cartomancy, as described by Tina Gong of Labyrinthos in "How to Read Nine-Card (Portrait, Box or 3x3) Lenormand Spreads"). Each column is a stretch of time (the past, the present, the near future, rarely beyond a month); each row is a level (thought, reality, undercurrent); the centre card is the theme of the whole reading and the corners frame it. Other writers assign past, present and future to the rows instead; this plugin keeps the columns. The position wording is the plugin's own; the card meanings are still the book's.
3. Click the glowing card (or, in the alternative method, the glowing line). The first click begins the reading; each following click turns the next card, or the next line of seven, and the model answers for it against the cards already on the table. After the last one it brings the whole spread together.
4. **Options** (collapsed). For the Celtic Cross: the **Significator**, the card that stands for the person or the matter asked about, chosen from a description of the person (sex, age, colouring) or by searching for and choosing a card, and the side it faces. The chosen card is shown with its plate. For the alternative method: whether the Querent is a man or a woman. For both, whether some cards may come up **reversed**: off by default for the Celtic Cross, on for the alternative method, whose instructions turn some of the cards round.

When a card turned brings a second, third or fourth card of the same rank (two Kings, three Tens, ...) onto the table, upright or reversed together, the model is also given what the book says of that recurrence.

A reading lives in its conversation: reload the page, or restart DSH, and the cards are as you left them, ready to carry on. The page keeps the current step and progress above the spread. Once the last card is turned, a recap shows the cards together and offers either **New reading** or, after the alternative method, **Continue with the 35 cards left**. **End this reading** ends one early (it stays in the session, marked as ended early, and cannot be carried further; the model is told to set it aside). After a finished Celtic Cross, **Repeat with the tenth card as the Significator** does what the book suggests when the last card is doubtful or a Court Card: a fresh Celtic Cross with that card as its Significator. A session holds any number of readings one after another, and **Earlier readings** lists the ones before the current one with the cards of each.

You can also ask in the conversation: the model has a tool, `tarot_lay_spread`, that lays a spread for you. It never turns a card; you turn the cards on the Tarot page. The command `/tarot` runs the same steps from the composer (`/tarot start celtic <card-id> <left|right> <upright|reversed> <language> [question]` or `/tarot start alternative <male|female> <upright|reversed> <language> [question]`, `/tarot start plain <count> <upright|reversed> <language> [question]`, `/tarot start three|nine <upright|reversed> <language> [question]`, `/tarot abandon`, `/tarot repeat <upright|reversed> [question]` for the Celtic Cross again with its tenth card as the Significator, `/tarot continue [question]` for the thirty-five card method after an alternative reading, then `/tarot draw` for each card or line).

### Language

A reading is held in the language of the screen it was begun on. For Chinese and English the card names, position names and the instructions given to the model are translated, and the model answers in the language it is spoken to. The meanings themselves are Waite's English; the model renders them in your language. Another language falls back to English.

## Configuration

Settings of the `rws-tarot` plugin in the profile (all optional):

| Setting | Default | Meaning |
|---|---|---|
| `reversedShare` | `0.5` | Share of cards that lie reversed when reversed cards are turned on. |
| `maxQuestion` | `500` | Longest question accepted, in characters. |
| `defaultLanguage` | `en` | Language of a reading the model begins when it names none. |

## How it works

- A reading begins with a cryptographically random shuffle and cut done by code (the draw is reproducible from its seed in the tests). The order of the whole pack, the placement of each card and whether it is reversed are fixed at that moment and stored in the conversation; the model never chooses or turns a card.
- When you turn a card, the plugin assembles the facts for it (the card, its position, the book's meanings and position explanation, the cards already turned, any recurrence) and hands them to the model with a short style note: speak to the person as "you", plain prose, no citations, nothing about cards not yet turned. The book's name never reaches the model.
- Everything is held in the conversation as ignorable plugin records, replayed on load, so a session never fails to open because of this plugin.

## Development

The repository is a pnpm workspace:

| Package | What it is |
|---|---|
| `packages/tarot-data` | The book's card, method and recurrence data (JSON, each text with its source page), the schemas and the card names. No DSH import. |
| `packages/tarot-engine` | The deterministic engine: decks, seeded shuffle and cut, reversals, layouts, the facts handed to the model. No DSH import. |
| `packages/tarot` | The DSH plugin (this package): host (command, tool, projection), client (the dock page) and the plates, with the two libraries bundled in. |

```bash
pnpm install
pnpm typecheck        # needs a large heap: NODE_OPTIONS=--max-old-space-size=12288
pnpm test
node scripts/check-cards.mjs     # card data against the book, image hashes, gap report
node scripts/check-methods.mjs   # every quoted method text and diagram against the book
pnpm --filter dsh-rws-tarot build
```

To try a build, add the package folder to a scratch profile and start DSH on it:

```bash
dsh plugin --profile <scratch> add ./packages/tarot
dsh --profile <scratch>
```

Card data is generated from the book's text in `references/` by `scripts/build-cards.mjs` and `scripts/build-recurrence.mjs`; the check scripts fail when data and book disagree. A transcription error is fixed in the book text and the data regenerated, never patched in the JSON.

## Disclaimer

Tarot is a traditional practice of symbolism and reflection. This plugin follows documented, published conventions: the card meanings and methods of Waite's 1910 book, and, for the three-card and nine-card layouts, common modern practice. It does not and cannot predict or interpret real events in anyone's life.

- The cards are drawn at random by software. A card has no connection to your circumstances, and the readings the model gives are generated text built on the book's wording, not insight into your situation. A language model can also be wrong, inconsistent or misleading.
- Do not use a reading as guidance for decisions about health, medicine, mental health, law, money, relationships, safety or anything else that matters. For such matters consult a qualified professional.
- It is offered for entertainment, study and personal reflection only. You are solely responsible for what you decide and do.
- The software is provided as is, without warranty of any kind, under the GPL-3.0 licence.

## Sources and licence

- Text: Waite, *The Pictorial Key to the Tarot* (1910, 1922 reprint), public domain, from the English Wikisource transcription, whose volunteer formatting may carry CC BY-SA 4.0 attribution requirements.
- Plates: the 78 illustrations by Pamela Colman Smith as printed in that book, public domain, from Wikimedia Commons.
- Card and position names in Chinese, and the Chinese rendering of the position explanations, are translations made for this plugin.

Licensed under GPL-3.0-only.
