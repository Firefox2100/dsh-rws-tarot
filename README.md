# dsh-rws-tarot

Rider-Waite-Smith tarot for DeepSeek Harness. The plugin is in [`packages/tarot`](packages/tarot); its card data and the deterministic engine are the libraries in `packages/tarot-data` and `packages/tarot-engine`, bundled into it. See the [plugin README](packages/tarot/README.md).

```bash
pnpm install
pnpm test
pnpm --filter dsh-rws-tarot build
```

Licensed under GPL-3.0-only.
