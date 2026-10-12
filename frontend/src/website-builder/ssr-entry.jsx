// Server entry: turns a render bundle into HTML. Built with `npm run build:ssr`
// into dist-ssr/site-ssr.cjs, which the API loads to serve /site/<address>/… pages.
import { renderToString } from "react-dom/server";
import SiteView from "./SiteCore";
import { fontHref } from "./theme";

export function render(bundle, requestPath) {
  const linkTo = (p) => `/site/${bundle.site.siteKey}${p === "/" ? "" : p}`;
  const html = renderToString(
    <SiteView theme={bundle.theme} content={bundle.page.content} site={bundle.site} menus={bundle.menus} mode="public" path={requestPath} linkTo={linkTo} bundle={bundle} />
  );
  return { html, fontHref: fontHref(bundle.theme) };
}
