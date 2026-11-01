# dsh-rws-tarot

Rider-Waite-Smith tarot for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). Open a **Tarot** page in the right dock, pick a spread, and click the glowing card to turn it over. Each card is read to you in the conversation as it is turned.

The cards are drawn by code, not by the model: the shuffle, the cuts, the layout and the position of every card are done deterministically (with a cryptographic random source), and what each card means in its position comes from the text of Arthur Edward Waite's *The Pictorial Key to the Tarot* (1910), which the plugin carries. The model only reasons on top of those facts, so it is never asked to recall a card's meaning, and it is told to say nothing about a card that has not been turned.

## Install

```bash
dsh plugin --profile <profile> add dsh-rws-tarot
```

Requires DeepSeek Harness `>=0.2.1-rc.5 <0.2.2` and a model the profile can already use. The plugin adds a page to the right dock and does not change any existing page.

## Use

1. Open a conversation, open the right dock and choose **Tarot** on its start page.
2. Choose how to draw (**Celtic Cross**, the ancient method described by Waite) and, optionally, write your question.
3. Click the glowing card. The first click begins the reading; each following click turns the next card, and the model answers for that card, in the position where it fell and against the cards already on the table. After the tenth card it brings the whole spread together.
4. **Options** (collapsed) let you choose the **Significator**, the card that stands for the person or the matter asked about, either from a description of the person (sex, age, colouring) or by naming a card; the side it faces; and whether some cards may come up **reversed** (off by default).

A reading lives in its conversation: reload the page and the cards are as you left them. **New reading** starts another once the tenth card is turned.

You can also ask in the conversation: the model has a tool, `tarot_lay_spread`, that lays a spread for you. It never turns a card; you turn the cards on the Tarot page. The command `/tarot` runs the same steps from the composer (`/tarot start celtic <card-id> <left|right> <upright|reversed> <language> [question]`, then `/tarot draw` for each card).

### Language

A reading is held in the language of the screen it was begun on. For Chinese and English the card names, position names and the instructions given to the model are translated, and the model answers in the language it is spoken to. The meanings themselves are Waite's English; the model renders them in your language. Another language falls back to English.

## Configuration

Settings of the `rws-tarot` plugin in the profile (all optional):

| Setting | Default | Meaning |
|---|---|---|
| `reversedShare` | `0.5` | Share of cards that lie reversed when reversed cards are turned on. |
| `maxQuestion` | `500` | Longest question accepted, in characters. |
| `defaultLanguage` | `en` | Language of a reading the model begins when it names none. |

## Sources and licence

- Text: Waite, *The Pictorial Key to the Tarot* (1910, 1922 reprint), public domain, from the English Wikisource transcription, whose volunteer formatting may carry CC BY-SA 4.0 attribution requirements.
- Plates: the 78 illustrations by Pamela Colman Smith as printed in that book, public domain, from Wikimedia Commons.
- Card and position names in Chinese, and the Chinese rendering of the position explanations, are translations made for this plugin.

Licensed under GPL-3.0-only.
