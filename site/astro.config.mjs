import { defineConfig } from 'astro/config';

// Static output, no adapter — the build is a plain folder of files, so it can go
// to Cloudflare Pages, Netlify or Vercel unchanged. Pick the host later; nothing
// here has to change when you do.
export default defineConfig({
  output: 'static',
  build: { inlineStylesheets: 'never' },
});
