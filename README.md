# Google Apps Script TypeScript Skeleton

Ez a repository egy skeleton projekt Google Apps Script fejlesztéshez. A célja az, hogy új Google Sheetshez kötött Apps Script projekteket gyorsan lehessen indítani egy előre elkészített, TypeScript alapú helyi környezettel.

A skeletonból kiindulva az új projekt menete röviden:

1. Klónozd ezt a repót.
2. Telepítsd a Node-függőségeket.
3. Hozz létre egy új Google Sheetet.
4. Hozd létre benne a bound Apps Script projektet.
5. Másold be a kapott `Script ID`-t a helyi `.clasp.json` fájlba.
6. Pushold fel a buildelt kódot.

## Mire való ez a skeleton

Ez a projekt azt a kényelmet adja meg, hogy minden új Google Sheets + Apps Script projekted ugyanarról az alapról induljon:

- TypeScript forráskód;
- előre beállított `clasp` workflow;
- külön `src/` és `build/` mappa;
- automatikus manifest másolás build közben;
- egy egyszerű minta custom function.

Így nem kell minden új projekt elején újra kézzel összerakni a TypeScript, `clasp` és Apps Script build környezetet.

## Projektstruktúra

```text
.
├── .clasp.json.example
├── .gitignore
├── README.md
├── appsscript.json
├── package.json
├── package-lock.json
├── scripts/
│   └── copy-manifest.mjs
├── src/
│   └── Code.ts
└── tsconfig.json
```

Az egyes fontosabb elemek szerepe:

- `src/`
  Itt van a TypeScript forráskód. Az Apps Script logikát itt érdemes írni.

- `build/`
  Generált kimeneti mappa. Ide kerül a fordított JavaScript és a bemásolt `appsscript.json`. Ez a mappa nincs verziókezelés alatt.

- `appsscript.json`
  Az Apps Script manifest. Ide kerülnek a projekt szintű beállítások, például időzóna, runtime vagy később scope-ok és service dependency-k.

- `.clasp.json.example`
  Minta `clasp` konfiguráció. Ebből kell új projektnél létrehozni a valódi `.clasp.json` fájlt.

- `.clasp.json`
  A valódi, helyi `clasp` konfiguráció. Ez nincs verziózva, mert projekt-specifikus `scriptId`-t tartalmaz.

- `scripts/copy-manifest.mjs`
  Build után átmásolja az `appsscript.json` fájlt a `build/` mappába.

## Hogyan működik a build és a push

Ez a projekt nem közvetlenül a TypeScript fájlokat tölti fel Google Apps Scriptbe.

A folyamat:

1. A `src/*.ts` fájlokat a TypeScript compiler lefordítja JavaScriptre.
2. A kimenet a `build/` mappába kerül.
3. A `scripts/copy-manifest.mjs` bemásolja az `appsscript.json` fájlt a `build/` mappába.
4. A `clasp push` a `build/` mappából tölti fel a fájlokat.

Ez azért hasznos, mert a Google Apps Script JavaScriptet kap, miközben te helyben TypeScriptben dolgozol.

## Új projekt indítása ebből a skeletonból

Ez a legfontosabb rész a repo használatához.

### 1. Klónozd a skeleton projektet

```bash
git clone <YOUR_TEMPLATE_REPO_URL> my-new-sheet-project
cd my-new-sheet-project
```

Ha szeretnéd, ezen a ponton át is nevezheted a projektet a saját igényeid szerint.

### 2. Telepítsd a függőségeket

```bash
npm install
```

### 3. Hozz létre egy új Google Sheetet

Nyisd meg a Google Drive-ot, és hozz létre egy új spreadsheetet.

### 4. Hozd létre a Sheethez kötött Apps Script projektet

A frissen létrehozott Google Sheetben nyisd meg:

`Extensions > Apps Script`

Ez létrehozza a Google Sheethez kötött bound Apps Script projektet.

### 5. Másold ki a Script ID-t

Az Apps Script editorban nyisd meg:

`Project Settings > Script ID`

Másold ki a megjelenő `Script ID` értéket.

### 6. Hozd létre a helyi `.clasp.json` fájlt

Másold le a minta konfigurációt:

```bash
cp .clasp.json.example .clasp.json
```

Ezután a `.clasp.json` fájlban cseréld le ezt:

```json
"scriptId": "PASTE_YOUR_SCRIPT_ID_HERE"
```

a saját Apps Script projekted valódi `Script ID`-jára.

### 7. Jelentkezz be `clasp`-pal

Ha még nem vagy bejelentkezve:

```bash
npx clasp login
```

Headless környezetben:

```bash
npx clasp login --no-localhost
```

### 8. Futtasd a buildet

```bash
npm run build
```

### 9. Pushold fel a projektet

```bash
npm run push
```

Ezzel a lokális TypeScript projekted felkerül a frissen létrehozott, Sheethez kötött Apps Script projektbe.

## Fejlesztési workflow a későbbiekben

Miután az első kapcsolat létrejött, a tipikus napi workflow ez:

1. Módosítsd a kódot a `src/` mappában.
2. Futtasd:
   ```bash
   npm run build
   ```
3. Ha minden rendben:
   ```bash
   npm run push
   ```
4. Ellenőrizd a működést a Google Sheetben.

Ha folyamatosan szeretnéd fordítani a TypeScriptet fejlesztés közben:

```bash
npm run watch
```

Fontos: a `watch` csak fordít, nem pushol automatikusan.

## Elérhető npm parancsok

- `npm run build`
  Lefordítja a TypeScriptet és bemásolja a manifestet a `build/` mappába.

- `npm run watch`
  Figyeli a `src/` mappa változásait és újrafordít.

- `npm run push`
  Build után feltölti a `build/` mappa tartalmát az Apps Script projektbe.

- `npm run pull`
  Lehúzza a távoli Apps Script projekt aktuális tartalmát.

## Miért nincs verziózva a `.clasp.json`

A `.clasp.json` tartalmazza az adott Google Apps Script projekt egyedi `scriptId` azonosítóját. Ez minden konkrét projektben más lesz, ezért a skeleton repo nem ezt a fájlt verziózza, hanem egy `.clasp.json.example` mintát ad hozzá.

Ez azért jó, mert:

- a skeleton újrafelhasználható marad;
- nem kerül bele egy konkrét projektazonosító a template-be;
- minden új projekt saját `scriptId`-val indulhat.

## TypeScript beállítások

A [tsconfig.json](/home/garaik/work/clasp/clasptest/tsconfig.json) fontosabb részei:

- `rootDir: "src"`
- `outDir: "build"`
- `types: ["google-apps-script"]`
- `strict: true`
- `noEmitOnError: true`

Ezek biztosítják, hogy a forrás a `src/` mappában legyen, a kimenet a `build/` mappába kerüljön, és a fordítás hibás kód esetén megálljon.

## Minta kód

A [src/Code.ts](/home/garaik/work/clasp/clasptest/src/Code.ts) jelenleg egy egyszerű példa Google Sheets custom functiont tartalmaz:

```ts
function ADD_NUMBERS(a: unknown, b: unknown): number
```

Ez csak mintaindulópont. Új projekt indításakor nyugodtan lecserélheted a saját Apps Script logikádra.

## Fontos megjegyzések

- A Google Apps Script végül JavaScriptet futtat, nem közvetlen TypeScriptet.
- A `build/` mappa generált tartalom, kézzel nem ezt érdemes szerkeszteni.
- A tényleges forráskódot mindig a `src/` mappában érdemes módosítani.
- Ha megváltozik a kapcsolt Apps Script projekt, a helyi `.clasp.json` fájl `scriptId` értékét kell frissíteni.
- A `clasp push` csak érvényes Google bejelentkezéssel működik.
