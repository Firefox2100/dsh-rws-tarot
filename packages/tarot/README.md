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
2. Choose how to draw and, optionally, write your question. Three methods from Waite's book are available, and a plain draw:
   - **Celtic Cross**, the ancient method, for a definite question: a Significator and ten cards.
   - **Thirty-five card method**, which carries a finished alternative reading further with the 35 cards it left over, laid in six lines of unequal length (7, 6, 5, 4, 2 and 11 cards) read from the left. Each line has a meaning of its own, from the book (the house, the person, what is passing outside, a surprise, consolation, and the line that explains the others). It becomes available once an alternative reading is finished, and you may add what remained doubtful.
   - **Alternative method**, for when no definite question is asked and you want to hear generally about the course of your life: 42 cards in six lines of seven, with the Querent's card (the Magician for a man, the High Priestess for a woman) lying beside the first line. You may name a period of time instead of a question.
   - **Plain draw**, for a simple question or when you just want a few cards: choose how many (1 to 12) and turn them one at a time. It is not one of the book's methods, so the cards have no positions; each carries the book's meanings and is read with the others on the table.
3. Click the glowing card (or, in the alternative method, the glowing line). The first click begins the reading; each following click turns the next card, or the next line of seven, and the model answers for it against the cards already on the table. After the last one it brings the whole spread together.
4. **Options** (collapsed). For the Celtic Cross: the **Significator**, the card that stands for the person or the matter asked about, chosen from a description of the person (sex, age, colouring) or by naming a card, and the side it faces. For the alternative method: whether the Querent is a man or a woman. For both, whether some cards may come up **reversed**: off by default for the Celtic Cross, on for the alternative method, whose instructions turn some of the cards round.

A reading lives in its conversation: reload the page and the cards are as you left them. **New reading** starts another once the last card is turned.

You can also ask in the conversation: the model has a tool, `tarot_lay_spread`, that lays a spread for you. It never turns a card; you turn the cards on the Tarot page. The command `/tarot` runs the same steps from the composer (`/tarot start celtic <card-id> <left|right> <upright|reversed> <language> [question]` or `/tarot start alternative <male|female> <upright|reversed> <language> [question]`, `/tarot start plain <count> <upright|reversed> <language> [question]`, `/tarot continue [question]` for the thirty-five card method after an alternative reading, then `/tarot draw` for each card or line).

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
