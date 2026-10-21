# Training GIF recorder

Re-makes the GIFs in `docs/training/` from the running app (frontend on :5173, API on :4001, seed admin login).

    cd docs/training/recorder
    npm init -y && npm install puppeteer-core@23.11.1 ffmpeg-static@5.2.0
    OUT=.. node scenes-all.mjs                 # every scene
    OUT=.. node scenes-all.mjs 16-deals-pipeline 31-approvals   # only some

Uses the Chrome installed on the Mac. Demo records (a form, a company, deals, products, a quotation) are made before recording and deleted after.
Don't edit the app while it records — a page reload closes open drawers mid-scene.
