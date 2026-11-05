# DSH Plugin for Rider-Waite-Smith Tarot

[![Quality gate status](https://sonarcloud.io/api/project_badges/measure?project=Firefox2100_dsh-rws-tarot&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Firefox2100_dsh-rws-tarot) [![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=Firefox2100_dsh-rws-tarot&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=Firefox2100_dsh-rws-tarot) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=Firefox2100_dsh-rws-tarot&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=Firefox2100_dsh-rws-tarot)

English | [中文](README-zh.md)

Rider-Waite-Smith tarot for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): lay a spread in the right dock, turn the cards one at a time and have each read from Arthur Edward Waite's *The Pictorial Key to the Tarot* (1910, public domain). Code draws the cards and supplies the book's meanings and methods; the language model only reasons on top of those facts.

For entertainment, study and reflection only. It cannot predict or interpret real events and is no guide for decisions; see the [disclaimer](packages/tarot/README.md#disclaimer).

## Install

```bash
dsh plugin --profile <profile> add dsh-rws-tarot
```

Requires DeepSeek Harness `>=0.2.2-rc.1 <0.2.3` and a model the profile can already use. Features, usage, configuration and the `/tarot` command are in the [plugin README](packages/tarot/README.md).

## Repository

| Path | Contents |
|---|---|
| `packages/tarot` | The plugin (host and client). |
| `packages/tarot-data` | The book's card, method and recurrence data and the card names. |
| `packages/tarot-engine` | The deterministic engine: shuffle, layouts, facts for the model. |
| `references/pictorial-key` | The book: text by part, the 78 plates, and the page-scan PDF the data is checked against. |
| `scripts` | Data generators and check scripts. |

The two libraries are bundled into the plugin.

## Development

```bash
pnpm install
pnpm typecheck        # needs NODE_OPTIONS=--max-old-space-size=12288
pnpm test
node scripts/check-cards.mjs
node scripts/check-methods.mjs
pnpm --filter dsh-rws-tarot build
```

Card data is generated from the book (`node scripts/build-cards.mjs`, `node scripts/build-recurrence.mjs`); the check scripts fail when the data and the book disagree. More in the [plugin README](packages/tarot/README.md#development).

Licensed under GPL-3.0-only.
