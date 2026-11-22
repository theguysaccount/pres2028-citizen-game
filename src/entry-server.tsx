// Build-time rendering. scripts/build.mjs bundles this file and calls it to write the static pages.
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import CitizenGame from "./CitizenGame.tsx";
import { AboutPage, GuidePage, buildFaq } from "./pages.tsx";
import type { SiteConfig } from "./config.ts";

export { buildFaq };

export function renderGame(config: SiteConfig) {
  return renderToString(<CitizenGame config={config} />);
}

export function renderGuide(config: SiteConfig) {
  return renderToStaticMarkup(<GuidePage config={config} />);
}

export function renderAbout(config: SiteConfig) {
  return renderToStaticMarkup(<AboutPage config={config} />);
}
