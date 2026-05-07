# Paytrack - Számlák és utalások kezelése

A Paytrack a MOON42 RDI Kft. beérkező és fizetendő számláinak nyilvántartását támogató Google Apps Script projekt.

A rendszer egy már létező Google Sheets munkafüzetet egészít ki automatizmusokkal. A kód TypeScriptben készül, a Google Apps Script projektbe pedig `clasp` segítségével kerül feltöltésre.

## Jelenlegi funkciók

### K&H HUF GIRO utalási export

A projekt megvalósítja a belföldi forintutalások exportját a K&H vállalkozói e-bank tranzakció import funkciójának `IV. Egyszerűsített forintátutalás` formátuma szerint.

A funkció a `Számlák` menü `Forint utalások exportja` pontjából indul. A menü megnyit egy sidebar-t, ahol az `Ellenőrzés` gomb összegyűjti és validálja a `Rögzíthető` státuszú, `HUF` pénznemű számlákat.

Sikeres ellenőrzés után a sidebar:

- megmutatja az exportálható számlák számát,
- megmutatja a teljes exportálandó összeget,
- utalási nap szerint csoportosítja a tételek összegét és darabszámát,
- minden utalási naphoz letölthető `.HUF.CSV` fájlokat ad,
- 40 tételnél nagyobb napi mennyiséget több fájlra bont.

Hiba esetén a rendszer nem készít exportot. A sidebar sor- és mezőszinten listázza a javítandó adatokat.

Az export nem módosítja a táblázat adatait: nem állít státuszt, nem ír dátumot, és nem jelöli késznek az utalásokat.

## Google Sheets munkafüzet

### `SZÁMLÁK` munkalap

A számlák nyilvántartása a `SZÁMLÁK` munkalapon történik. A munkalap első sora fejlécsor, az Apps Script az oszlopokat fejlécnév alapján keresi.

A GIRO exporthoz szükséges oszlopok:

- `Kedvezményezett`: a számla kedvezményezettje.
- `Számlaszám`: a kedvezményezett bankszámlaszáma.
- `Közlemény`: az utalási közlemény.
- `bruttó`: az utalandó összeg.
- `pénznem`: az összeg devizaneme, HUF exportnál `HUF`.
- `státusz`: a fizetési státusz, exporthoz `Rögzíthető`.
- `utalás napja`: az utalás értéknapja.

A táblázatban további használt oszlopok:

- `határidő`: a fizetési határidő.
- `komment`: belső megjegyzés.
- `PS`: fizetettségi státusz, ahol `0` fizetve, `1` fizetetlen, de nem lejárt, `2` lejárt fizetési határidő.

### `PARTNEREK` munkalap

A `PARTNEREK` munkalap a partnerek bankszámlaszámait tartalmazza:

- A oszlop: partner neve.
- B oszlop: partner számlaszáma.

A munkalap jelenleg egyszerű adatlista, fejlécek és típusos táblázat nélkül. Ha egy partnernek több számlaszáma van, külön néven szerepelhetnek, például `Partner Kft. (EUR)` és `Partner Kft. (HUF)`.

A számlaszámok jellemzően GIRO formátumban vannak rögzítve, `2x8` vagy `3x8` számjegyből álló, kötőjelezett alakban.

### `CONFIG` munkalap

A `CONFIG` munkalap a rendszer beállításait tartalmazza. Az első sor fejléc:

- `property`: a beállítás neve.
- `value`: a beállítás értéke.

A jelenleg használt property:

- `PAYTRACK_HUF_SOURCE_ACCOUNT`: a HUF export terhelendő forrásszámlája.

## GIRO export szabályai

Az export csak azokat a sorokat veszi figyelembe, ahol:

- a `státusz` pontosan `Rögzíthető`,
- a `pénznem` pontosan `HUF`,
- az `utalás napja` ki van töltve, és nem múltbeli dátum,
- a `bruttó` pozitív egész forintösszeg,
- a `Számlaszám` érvényes 16 vagy 24 számjegyű GIRO szám.

A kedvezményezett számlaszáma exportkor normalizálva kerül a fájlba, vagyis a kötőjelek és szóközök nélkül.

Az exportált CSV oszlopai:

- `Forrás számlaszám`
- `Partner számlaszáma`
- `Partner neve`
- `Átutalandó összeg`
- `Átutalandó deviza`
- `Közlemény`
- `Átutalás egyedi azonosítója`
- `Értéknap`

Az `Átutalás egyedi azonosítója` mezőt a rendszer jelenleg üresen hagyja. Az `Értéknap` formátuma `yyyy.MM.dd`.

A fájlok neve:

```text
paytrack-huf-YYYYMMDD-SS.HUF.CSV
```

Ahol `SS` az adott naphoz tartozó fájl sorszáma, például `01` vagy `02`.

## Konfiguráció

A HUF exporthoz be kell állítani a terhelendő MOON42 bankszámlaszámot a `CONFIG` munkalapon:

```text
property,value
PAYTRACK_HUF_SOURCE_ACCOUNT,12345678-12345678-12345678
```

Az érték lehet GIRO vagy IBAN alakú számlaszám. A rendszer a kötőjeleket és szóközöket eltávolítja export előtt.

## Fejlesztés

### Követelmények

- Node.js
- npm
- Google Apps Script hozzáférés
- `clasp` autentikáció a fejlesztői gépen

### Telepítés

```bash
npm ci
```

Ha a gépen még nincs `clasp` bejelentkezés:

```bash
npx clasp login
```

Headless környezetben:

```bash
npx clasp login --no-localhost
```

### Build

```bash
npm run build
```

A build:

1. lefuttatja a TypeScript fordítót,
2. a `build` könyvtárba készíti a JavaScript fájlokat,
3. átmásolja az `appsscript.json` manifestet,
4. átmásolja a `src` alatti `.html` fájlokat is.

Fejlesztés közben használható folyamatos fordítás:

```bash
npm run watch
```

Fontos: a `watch` csak fordít, nem pushol automatikusan.

### Push Apps Scriptbe

Először készíts helyi `.clasp.json` fájlt a `.clasp.json.example` alapján, és állítsd be benne a cél Apps Script `scriptId` értéket.

Ezután:

```bash
npm run push
```

A `push` script előbb buildel, majd `clasp push` paranccsal feltölti a `build` könyvtár tartalmát.

### Pull Apps Scriptből

```bash
npm run pull
```

A projekt fejlesztési iránya szerint a forráskód elsődleges helye a repo `src` könyvtára. Pull után ellenőrizni kell, hogy az Apps Script felületen történt módosítások nem írják-e felül a TypeScript forrást.

### Elérhető npm parancsok

- `npm run build`: TypeScript fordítás, manifest és HTML fájlok másolása a `build` könyvtárba.
- `npm run watch`: TypeScript figyelő mód.
- `npm run push`: build után feltöltés Apps Scriptbe.
- `npm run pull`: távoli Apps Script projekt lehúzása.

## Projekt struktúra

```text
.
├── appsscript.json
├── package.json
├── scripts/
│   └── copy-manifest.mjs
├── src/
│   ├── Code.ts
│   └── HufTransferExportSidebar.html
└── tsconfig.json
```

Fontosabb fájlok:

- `src/Code.ts`: Apps Script backend, Sheets menü, validáció, CSV generálás.
- `src/HufTransferExportSidebar.html`: sidebar felület és kliensoldali letöltés.
- `scripts/copy-manifest.mjs`: build utáni manifest és HTML másolás.
- `appsscript.json`: Apps Script manifest, V8 runtime és Budapest timezone.

## Tesztelés

Jelenleg nincs automatizált test suite. A minimális ellenőrzés:

```bash
npm run build
```

Manuális ellenőrzési forgatókönyvek:

- hiányzó `CONFIG` munkalap vagy hiányzó `PAYTRACK_HUF_SOURCE_ACCOUNT` property esetén validációs hiba jelenik meg,
- hiányzó kötelező oszlop esetén validációs hiba jelenik meg,
- `Rögzíthető` + `HUF` sorok megjelennek a napi összesítésben,
- nem HUF sorok, üres utalási nap, múltbeli dátum, nem egész összeg hibáznak,
- 41 azonos napra eső tétel két exportfájlt eredményez,
- a letöltött fájl fejlécsort tartalmaz, pontosvesszővel elválasztott, és `.HUF.CSV` kiterjesztésű.

## Későbbi lehetőségek

- automatikus tesztek bevezetése a validációhoz és CSV generáláshoz,
- deviza vagy SEPA export,
- export után opcionális státuszkezelés,
- külön konfigurációs munkalap,
- partneradatok strukturáltabb kezelése.
