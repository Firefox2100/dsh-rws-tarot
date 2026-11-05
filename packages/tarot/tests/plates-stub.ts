/** What the build's `virtual:rws-plates` holds: each plate's package-asset URL by file name, here without the content revision. */
export default new Proxy<Record<string, string>>({}, { get: (_, name) => `plugins/dsh-rws-tarot/assets/plates/${String(name)}` })
