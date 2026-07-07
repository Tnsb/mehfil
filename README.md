# plot

**plot** — AI-native hosting for run clubs, supper clubs, tech hangs, and intimate IRL events.

- [`website/`](website/) — the landing page
- [`app/`](app/) — the app: an AI-native party OS (Next.js + agent tool registry, AI Cohost, One Shot, AfterParty Drop, Taps). See [app/README.md](app/README.md) to run it locally.

**Live site:** [https://tnsb.github.io/plot/](https://tnsb.github.io/plot/)

## Run locally

```bash
cd website
npm install
npm run dev
```

## Deploy

On push to `main`, GitHub Actions builds `website/` and publishes to the `gh-pages` branch.

**One-time GitHub setup** (if the site 404s):

1. **Settings → General → Repository name** → rename to `plot` (URL becomes `tnsb.github.io/plot`)
2. **Settings → Pages → Build and deployment** → Source: **Deploy from a branch** → Branch: `gh-pages` / `/ (root)`
