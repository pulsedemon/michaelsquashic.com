# Michael Squashic's portfolio

A scrolling portfolio whose Work section is a concrete crate of records in 3D, one per project. Scrolling into Work pins the crate to the screen, and scrolling on flips through the records, resting wherever the scroll stops. Previous and Next move one record at a time, and a record's picture or title opens that project's case study at `/work/<id>`.

## Run

Node 24.11 or later: the Babel that runs the React Compiler needs it.

```sh
npm install
npm run dev
```

`npm run build` typechecks and builds to `dist/`. `npm test` checks the crate's layout and camera, and that every screenshot file has the size `src/content.ts` gives it. `npm run coverage` runs the same tests and reports how much of `src/` they reach, with a browsable copy in `coverage/`. `npm run lint` runs ESLint with typescript-eslint's strict type-checked rules; the linter reads types with TypeScript 6, installed beside the TypeScript 7 that `tsc` runs, because typescript-eslint can't use 7 yet. The override in `package.json` points typescript-eslint's optional `@typescript/native` peer at that TypeScript 7 install, so the npm that ships with Node 24.11 doesn't add a TypeScript 7.1 nightly for it. `npm run format` formats the code with Prettier, and `npm run format:check` is the check CI runs. A static host needs to fall back to `index.html` for `/work/*`.

## How it works

- `src/content.ts` holds the copy: the projects, the career list and the contact links. Each screenshot in `public/work/<id>/` also ships as smaller `-<width>.webp` copies, listed there, for screens that don't need the full file.
- `src/Page.tsx` renders the projects as ordinary cards. Without WebGL, or when the renderer can't start, those cards are what shows.
- `src/WorkCrate.tsx` turns the Work section into a scroll track. Its stage stays pinned while the scroll position becomes a scrub through the records.
- `src/crate.ts` solves the crate for each viewport: record size, crate geometry, and a camera stop that frames each record between the title and the bottom bar. It has no DOM dependencies, and `src/__tests__/crate.test.ts` tests it.
- `src/CrateCanvas.tsx` captures the laid-out cards, draws them into canvas textures for the record faces, and renders the scene with React Three Fiber.

## License

The code is MIT. The copy, the screenshots, the font and the brand marks are not; see `LICENSE`.
