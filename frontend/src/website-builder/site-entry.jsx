// Browser entry for published websites (site.html). Much smaller than the admin app:
// it only makes the server-drawn page interactive and handles moving between pages.
import { hydrateRoot, createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PublicSite } from "./PublicSite";

const root = document.getElementById("root");
const app = (
  <BrowserRouter>
    <Routes><Route path="/site/:siteKey/*" element={<PublicSite />} /></Routes>
  </BrowserRouter>
);
// a page that arrived drawn by the server is hydrated in place; anything else is drawn from scratch
if (document.getElementById("wb-bundle") && root.firstElementChild) hydrateRoot(root, app);
else { root.textContent = ""; createRoot(root).render(app); }
