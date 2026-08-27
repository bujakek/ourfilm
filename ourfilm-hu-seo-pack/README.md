# OurFilm magyar SEO/AEO tartalomcsomag – Film mód

Frissítve: 2026-08-24  
Nyelv: magyar  
Összes MDX-oldal: 69

## Aktuális termékpozíció

Az OurFilm közös digitális eldobható fényképezőgép esküvőkre. A vendégek
QR-kóddal vagy linkkel, alkalmazás és fiók nélkül kapnak kamerát. A szervező
5, 10, 16, 24 vagy 36 képet választhat résztvevőnként, valamint azonnali,
esemény végi vagy későbbi előhívást állíthat be. Korlátlan vendég csatlakozhat,
az esemény egyszeri ára 12 900 Ft.

Jelenleg nem ígérünk Original/Vintage/B&W filtert, videót, audio vendégkönyvet,
élő slideshow-t vagy korlátlan fotózást az alap Film módban.

## Tartalom

| Könyvtár               | Oldaltípus                  | Darab | Célútvonal                   |
| ---------------------- | --------------------------- | ----: | ---------------------------- |
| `content/pages`        | money landing page          |     8 | `/hu/<slug>`                 |
| `content/blog`         | útmutató és best-of cikk    |    41 | `/hu/blog/<slug>`            |
| `content/alternatives` | versenytárs-alternatíva     |     8 | `/hu/alternativak/<slug>`    |
| `content/vs`           | OurFilm-összehasonlítás     |     7 | `/hu/osszehasonlitas/<slug>` |
| `content/compare`      | versenytárs-összehasonlítás |     5 | `/hu/osszehasonlitas/<slug>` |

A teljes URL-, prioritás- és fájltérkép a `content-map.csv`, a pivot részletes
hatáslistája a `PIVOT-AUDIT.md` fájlban található.

## Elsőként publikálandó P0-oldalak

1. `/hu/digitalis-eldobhato-fenykepezogep-eskuvore`
2. `/hu/blog/disposable-camera-app-eskuvore`
3. `/hu/alternativak/once-alternativa`
4. `/hu/alternativak/pov-alternativa`
5. `/hu/alternativak/lense-alternativa`
6. `/hu/osszehasonlitas/ourfilm-vs-once`
7. `/hu/osszehasonlitas/ourfilm-vs-pov`
8. `/hu/osszehasonlitas/ourfilm-vs-lense`
9. A megmaradó QR/photo-sharing money page-ek.

## Frontmatter és route-integráció

Minden fájl ugyanazt az `id / locale / slug / title / description /
publishedAt / author / related` sémát használja. Ha a jelenlegi loader csak a
blogkönyvtárat olvassa, ugyanazt a renderelőt kell a `pages`,
`alternatives`, `vs` és `compare` route-gyökerekhez bekötni.

## Publikálás előtt

- ellenőrizd a főoldal és az árak oldalának pivot utáni copyját;
- a termékben valóban legyen kész a kamera-first vendégoldal, képszámláló és
  időzített reveal, mielőtt a P0-oldalak indexelhetők;
- generálódjon canonical, Open Graph, sitemap és strukturált adat;
- a versenytársi árakat publikáláskor, majd legalább negyedévente ellenőrizd;
- ne kerüljön ki jövőbeli filter, videó vagy unlimited-photo állítás.
