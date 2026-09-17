# OurFilm TikTok-csatorna audit

**Audit dátuma:** 2026. szeptember 16.  
**Vizsgált profil:** [@ourfilm.app](https://www.tiktok.com/@ourfilm.app)  
**Cél:** fenntartható termékcsatorna értékelése, nem puszta megtekintés-maximalizálás.

## Rövid ítélet

Az indulás elérés szempontjából erős, márkaépítés szempontjából viszont veszélyesen sekély. A csatorna 13 nap alatt körülbelül 468 ezer megtekintést szerzett, miközben 276 követője van. A követőszám az összes látható view mindössze **0,06%-a**. Ez nem valódi konverziós ráta — egy ember több posztot is nézhetett, és a követés forrása nem nyilvános —, de erős proxy arra, hogy a feed főleg egyszer használatos esküvői érzelmet ad el, nem egy követésre érdemes OurFilm-világot.

A jó hír: már most látszik a nyerő minta. A konkrét problémával és valódi termékképpel induló posztoknál a mentés és a megosztás nagyon erős. A rossz hír: ezt a tanulságot a csatorna nem rendszerré, hanem egyre több, egymásra hasonlító, első személyű, részben kitaláltnak ható esküvői történetté alakította. Rövid távon ez hozhat view-t; hosszú távon bizalmat éget és algoritmusfüggővé teszi a növekedést.

**Brutális összefoglaló:** az OurFilmnek van egy erős TikTok-kreatív sablonja, de még nincs TikTok-csatornája.

## Pillanatkép

A profil nyilvános állapota az audit idején:

- Megjelenített név: **Ourfilm** — ez nincs összhangban a márka hivatalos **OurFilm** írásmódjával.
- Handle: **@ourfilm.app**.
- Követés: **0**.
- Követők: **276**.
- Összes kedvelés: a profil betöltése közben **11,1K-ról 11,2K-ra** frissült.
- Bio: **„Ők megörökítik. Ti örökre megőrzitek🤍 ourfilm.app📷”**.
- A nyilvános profiloldalon nem látszik külön kattintható weboldalmező; a domain a bio szövegében szerepel.
- A csatorna első nyilvános posztja szeptember 3-i, a legfrissebb szeptember 16-i.
- A profil 32 nyilvános posztja mind `/photo/` típusú carousel; natív videó, emberi arcra épülő magyarázó tartalom vagy beszélő alapító nem látszik.
- 32 poszt 14 naptári nap alatt: **2,3 poszt/nap**.
- Az összes látható view nagyjából **468 ezer**, az átlag kb. **14,6 ezer**, de a medián csak kb. **5 ezer**.
- A négy legnézettebb poszt (81,9K; 66,5K; 66,5K; 65,4K) adja az összes view közel **60%-át**. Az átlag ezért félrevezető.
- A legutóbbi 16 poszt hat nap alatt kb. **141,9 ezer** view-t hozott; a medián kb. **4,85 ezer**. Nyolc poszt 5K alatt maradt, hat érte el a 10K-t.

A számok folyamatosan változnak; a fenti értékek 2026. szeptember 16-i pillanatfelvételek. Forrás: [TikTok-profil](https://www.tiktok.com/@ourfilm.app).

## Termékanalitikai kiegészítés: Vercel + PostHog

Az alábbi számok a 2026. szeptember 3–16. közötti időszak production jelölésű eseményei. A PostHog projekt UTC időzónát használ. A TikTok-csatorna ugyanebben az időszakban indult, de **az időbeli együttmozgás nem jelent forrásattribúciót**.

### A legfontosabb megállapítás: jelenleg nincs TikTok-attribúció

- A PostHogban production marketing-pageview nem található. A teljes projektben összesen három `$pageview` esemény volt, mind `localhost:3971` hosttal és direkt referrerrel.
- A production onboarding- és termékesemények ettől függetlenül érkeznek, tehát a termékhasználat mérhető, de a látogatás forrása nem.
- A Vercel Web Analytics komponens a marketing- és terméklayoutban is be van építve, de a csatlakoztatott Vercel eszköz nem ad hozzáférést a Web Analytics összesített visitor/referrer riportjához. A runtime logok nem helyettesítik ezt: dinamikus kéréseket mutatnak, nem teljes, egyedi látogatós forgalmat.
- Következmény: a 468 ezer TikTok-view és az alábbi aktivációs adatok között jelenleg **nem számítható view → látogatás → esemény → fizetés tölcsér**. Bármilyen ilyen konverziós arány kitalált szám lenne.

### Amit a PostHog ténylegesen bizonyít

Az onboarding egyedi `creation_key` alapján:

| Lépés                                       | Egyedi draft | Előző lépéshez képest |
| ------------------------------------------- | -----------: | --------------------: |
| Eseménynév kitöltve                         |          123 |                     — |
| Befejezési idő megadva                      |          113 |                 91,9% |
| Előhívás kiválasztva                        |          105 |                 92,9% |
| Vendég/film/beállítások képernyő teljesítve |           54 |                 51,4% |
| Létrehozási kísérlet                        |           54 |                  100% |
| Esemény létrejött                           |           30 |                 55,6% |

A legnagyobb veszteség tehát nem a név vagy az időpont, hanem az utolsó, sok döntést és a regisztrációt egyesítő szakasz. A reveal kérdés után a draftok majdnem fele eltűnik; a létrehozási kísérletek további 44%-a nem jut el létrejött eseményig, ahol a magic-link visszatérés is része a folyamatnak.

A 30 production eseményből:

- 29 magyar és 1 angol;
- 19 free és 11 full tervvel jött létre;
- 14 instant, 16 esemény végi előhívást választott;
- 11 onboardingból induló egyedi checkoutból 6 jutott `paid` állapotig;
- 5 settingsből induló egyedi checkoutból 1 jutott `paid` állapotig.

Összesen 7 production `paid` settlement látszik. Ezt **nem szabad automatikusan valódi árbevételnek nevezni**, mert az esemény nem rögzíti a Stripe `livemode` értékét, és a vizsgált időszak Vercel logjaiban teszt- és live-fiókhoz kapcsolódó checkout próbálkozások egyaránt megjelentek.

### A közönség eszközprofilja passzol a TikTokhoz

Az első onboarding kérdésig eljutó 123 draftból:

- 80 iOS mobil;
- 34 Android mobil;
- 7 macOS desktop;
- 2 Windows desktop.

Ez 92,7% mobilhasználat. Tehát a termék mobil-first kialakítása és a TikTok feltételezett közönsége jól illeszkedik egymáshoz. A forrást ez sem bizonyítja, de azt igen, hogy az onboardingot szinte teljesen telefonról használják.

### A létrejött események nem üres teszteknek látszanak

A production termékesemények között 771 vendégoldal-megnyitás, 569 kameranyitás, 489 exponálás és 491 megerősített feltöltés szerepel. A kameráig eljutó egyedi technikai felhasználók száma 192, exponálásig és megerősített feltöltésig 168. Vagyis az OurFilm használatba véve valódi aktivitást kap; a stratégiai vakfolt inkább az akvizíció és az onboarding attribúciója.

### Vercel működési kép

- A legutóbbi production deployment `READY` állapotú.
- Az elmúlt 24 órában nem volt látható runtime error.
- A 14 napos runtime státuszlekérdezés nem mutatott 5xx kérést.
- Korábban ugyanebben az időszakban voltak checkout-konfigurációs/idempotencia hibák és egy régi deploymenthez tartozó Server Action eltérés. Ezek a checkout-konverziót torzíthatták, ezért a korai funnel nem tekinthető tiszta marketingtesztnek.

### Mit változtat ez a TikTok-ítéleten?

Az eredeti kritika, hogy a csatorna gyengén épít követőt és túl sok view-only kreatívot gyárt, továbbra is áll. Viszont az analitika alapján **nem állítható, hogy a TikTok nem hoz eseményeket vagy fizetési szándékot**. Az ellenkezője sem állítható. A csatornaindulással párhuzamosan van érdemi mobil onboarding, 30 létrejött esemény és 6 onboardingból induló paid settlement, de a forráskapcsolat hiányzik.

Ezért a legelső marketingfeladat nem még több tartalom, hanem az attribúció javítása:

1. minden TikTok bio- és kampánylink kapjon `utm_source=tiktok`, `utm_medium=organic`, `utm_campaign` és kreatívazonosító paramétert;
2. a PostHog rögzítse a marketing landinget és a sanitizált UTM-eket az első draft `creation_key` rekordjához;
3. az attribúció öröklődjön az `event_created`, `checkout_started` és `checkout_settled` eseményekre;
4. a settlement esemény kapjon `livemode` mezőt, hogy a tesztfizetés soha ne keveredjen árbevétellel;
5. a következő 30 nap kreatívjait ne view, hanem attribútált draft, létrejött esemény és live paid settlement alapján rangsoroljátok.

## Mit posztol jelenleg a csatorna?

A domináns formátum minden vizsgált posztnál ugyanaz:

1. romantikus vagy drámai, első személyű esküvői hook;
2. stock-/AI-hatású esküvői képekből álló carousel;
3. a QR-kód vagy a telefonon futó termék csak a második-harmadik slide-on jelenik meg;
4. általános esküvői hashtagek és trendzene;
5. nincs konkrét következő lépésre irányító CTA.

Gyakori hook-szerkezetek:

- „A nagymamám az esküvőnk másnapján sírva fakadt…” — [65,4K view](https://www.tiktok.com/@ourfilm.app/photo/7681299906312686870)
- „Nem gondoltam volna, hogy EZ lesz az esküvőnk egyik legjobb ötlete…” — [81,9K view](https://www.tiktok.com/@ourfilm.app/photo/7681399597977177366)
- „A legjobb döntés volt, hogy EZT kértük a vendégektől…” — [66,5K view](https://www.tiktok.com/@ourfilm.app/photo/7683818751287889174)
- „El sem hiszem, hogy ezt tette az öcsém az esküvőmön…” — [20,3K view](https://www.tiktok.com/@ourfilm.app/photo/7686041886515072258)
- „A férjemmel titokban hagytunk egymásnak pár képet az esküvő reggeléről…” — [16,2K view](https://www.tiktok.com/@ourfilm.app/photo/7684923499411950870)
- „Ha a legszebb nászajándék ötletet keresed…” — [legfrissebb poszt](https://www.tiktok.com/@ourfilm.app/photo/7686202308182494486)

Ez nem véletlenül működik: a történet kíváncsiságot nyit, az esküvői képek érzelmet adnak, a carousel pedig lapozásra kényszerít. A gond az, hogy a formátumot a csatorna már most túlhasználja, miközben alig épít új tudást vagy kapcsolatot.

## Saját csatornás benchmark: view és valódi szándék nem ugyanaz

| Poszt                                                                                                           | Hook / szerep                             |                View |          Like |        Mentés |    Megosztás | Komment | Mit jelez?                                                                              |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------: | ------------: | ------------: | -----------: | ------: | --------------------------------------------------------------------------------------- |
| [A legjobb képek a vendégek telefonján maradnak](https://www.tiktok.com/@ourfilm.app/photo/7684691200816811287) | Probléma- és termékelső                   |               34,9K | 1 624 (4,65%) |   897 (2,57%) |  370 (1,06%) |       4 | A legerősebb minőségi engagement; valós fájdalom + azonnal érthető QR-megoldás.         |
| [Nem gondoltam volna, hogy EZ lesz…](https://www.tiktok.com/@ourfilm.app/photo/7681399597977177366)             | Érzelmi hook, de korán mutatja a működést |               81,9K | 2 503 (3,06%) | 1 619 (1,98%) |  450 (0,55%) |       6 | Nagy reach és magas mentés: a termékötletet a nézők esküvői inspirációként tárolják.    |
| [A legjobb döntés volt…](https://www.tiktok.com/@ourfilm.app/photo/7683818751287889174)                         | Ismételt hook, erős termékképek           |               66,5K | 1 931 (2,90%) | 1 049 (1,58%) |  361 (0,54%) |       6 | A vizuálisan bizonyított termék ismét működik, de már ugyanazt az állítást mondja újra. |
| [A buli végére 172 vendég emlékei…](https://www.tiktok.com/@ourfilm.app/photo/7681608598702624022)              | Konkrét eredmény + termékkép              |               66,5K | 1 057 (1,59%) |   526 (0,79%) |  119 (0,18%) |       3 | A konkrétum segít, de jóval kisebb a továbbadási szándék.                               |
| [El sem hiszem, hogy ezt tette az öcsém…](https://www.tiktok.com/@ourfilm.app/photo/7686041886515072258)        | Családi érzelmi bait                      |               20,3K |   133 (0,66%) |    43 (0,21%) |   14 (0,07%) |       0 | Van view, alig van szándék. Klasszikus „nézték, de nem érdekelte őket eléggé” poszt.    |
| [A férjemmel titokban…](https://www.tiktok.com/@ourfilm.app/photo/7684923499411950870)                          | Romantikus történet                       |               16,2K |   109 (0,67%) |    36 (0,22%) |    8 (0,05%) |       0 | A történet terjeszthető, a termék nem ragad meg.                                        |
| [Ha a legszebb nászajándékot keresed…](https://www.tiktok.com/@ourfilm.app/photo/7686202308182494486)           | Friss ajánlat-horog                       | 1,1K az első órában |            12 |             3 | nem látszott |       0 | Túl friss az összehasonlításhoz; CTA ekkor sincs.                                       |

A fő tanulság a csatorna saját számaiból: **a 20,3K és 16,2K view-t hozó érzelmi történetek like-, mentés- és megosztási aránya 4–20-szor rosszabb**, mint a 34,9K-s problémaelső poszté. A view itt nem üzleti proxy. A mentés és a megosztás sokkal közelebb áll a későbbi eseménytervezési és vásárlási szándékhoz.

## Kiegészítés: @menyasszonytitkok csatorna

**Pillanatfelvétel:** 2026. szeptember 17.  
**Profil:** [@menyasszonytitkok](https://www.tiktok.com/@menyasszonytitkok)

A `menyasszonytitkok` nem független inspirációs profilként működik: a bio nyíltan megnevezi az OurFilmet, a négy induló posztból három pedig közvetlenül a vendégfotó-problémát vagy magát a terméket mutatja. Ez stratégiailag értelmesebb közönséget célozhat, mint az általános márkafiók érzelmi esküvői reach-tartalmai, de még nem bizonyította, hogy külön csatornaként jobb ügyfeleket hoz.

A profil nyilvános állapota:

- 4 poszt körülbelül két nap alatt;
- 5 követő és 270 összes kedvelés;
- 7 550 összes látható megtekintés, 1 224-es medián;
- 270 kedvelés, 62 mentés, 11 megosztás és 1 komment;
- az összes látható interakció a view 4,56%-a;
- a követő/view proxy 0,066%, gyakorlatilag ugyanaz a nagyságrend, mint az `@ourfilm.app` 0,06%-a.

| Poszt                                                                                                                 | Szerep                                    |               View | Like | Mentés | Megosztás | Komment |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | -----------------: | ---: | -----: | --------: | ------: |
| [Telefonmentes esküvőt javasoltak](https://www.tiktok.com/@menyasszonytitkok/video/7685448337570499862)               | Konkrét ellenpont + 24 képes OurFilm-demó |              4 271 |  121 |     40 |         7 |       0 |
| [A fotós nem lehet ott minden pillanatnál](https://www.tiktok.com/@menyasszonytitkok/video/7685800684104518934)       | Problématudatosítás                       |              1 047 |   33 |      7 |         0 |       0 |
| [Azt hittem, a fotós képei lesznek a kedvenceim](https://www.tiktok.com/@menyasszonytitkok/video/7686013952811142422) | Érzelmi, AI-menyasszonyos hook            |              1 401 |   68 |      7 |         2 |       0 |
| [3 apróság az esküvőnkről](https://www.tiktok.com/@menyasszonytitkok/photo/7686445189208018198)                       | Menthető esküvői tipplista, QR-táblával   | 831 az első órában |   48 |      8 |         2 |       1 |

### Mi jobb rajta, mint a fő csatornán?

1. **Élesebb közönségpozicionálás.** A név rögtön az esküvő előtt álló nők problématerébe helyezi a profilt; nem kell előbb megérteni az OurFilm márkanevet.
2. **A legerősebb videó valóban megmutatja a terméket.** Telefon, OurFilm-képernyő, 24 képes film és privát galéria jelenik meg, nem csak romantikus képek mögé rejtett QR-albumígéret.
3. **Hasznos tartalom felé nyit.** A „3 apróság” formátum adhat önálló okot a követésre és a mentésre. Ez fenntarthatóbb irány, mint a márkafiók sorozatos cliffhanger-történetei.
4. **A 62 mentés erősebb jel az 5 követőnél.** A nézők egy része ötletként elteszi a tartalmat, tehát van valós esküvőtervezési relevancia.

### Mi rossz vagy veszélyes?

1. **Négy poszt még nem benchmark.** A legújabb poszt az adatfelvételkor csak 33 perce volt kint; ebből nem szabad csatornagyőzelmet hirdetni.
2. **A külön profil még nem javította meg a követőépítést.** A follower/view proxy ugyanúgy körülbelül 0,06%, mint a fő csatornán. Egyelőre reach-fiók, nem közösség.
3. **Megmaradt a művi hitelességprobléma.** Több poszt AI-generáltként jelölt, miközben első személyben beszél „a fotósunkról”, „a vendégeinkről” és „az esküvőnkről”. Egy névtelen tanácsadó profilnál ez még inkább astroturfing-hatású lehet.
4. **A két csatorna könnyen kannibalizálja egymást.** Ha mindkettő ugyanazokat az AI-menyasszonyos történeteket és QR-képernyőket posztolja, kettéoszlik a social proof és a tanulási adat, de nem jön létre két külön márkaérték.
5. **A bio megnevezi az OurFilmet, de nincs látható kattintható weboldalmező vagy videós CTA.** A magasabb vásárlási szándékú közönség útja ugyanott megszakad, mint a fő csatornán.
6. **A legerősebb új csatornás poszt engagementje sem veri a fő profil jó termékkreatívját.** A 4 271 view-s videó látható interakciós aránya 3,93%; a fő profil „A legjobb képek a vendégek telefonján maradnak” posztja körülbelül 8,3%-ot ért el. A tanulság nem az, hogy új profil kell, hanem hogy a konkrét termékprobléma és a valódi demonstráció működik.

### Döntés: megtartanám, de csak kontrollált kísérletként

A két profilnak külön feladatot kell adni:

- `@ourfilm.app`: termékbizonyíték, valódi események, működés, adatvédelem, ár, alapítói arc és ügyféltörténetek;
- `@menyasszonytitkok`: esküvőtervezési média, amelynek nagyjából 70%-a önállóan hasznos tanács, 30%-a pedig természetesen vezeti be az OurFilmet.

Az „esküvőnk” hangot csak valódi, megnevezhető és engedéllyel használt történetnél szabad megtartani. Egyébként a profil beszéljen szerkesztőségi hangon: „3 ötlet, amit a vendégek imádni fognak”, ne pedig kitalált menyasszonyként.

A csatorna kapjon külön attribúciót (`utm_campaign=menyasszonytitkok`, videónként eltérő `utm_content`). Húsz-harminc poszt után nem view alapján kell dönteni a folytatásáról, hanem attribútált landingek, onboarding-draftok, létrejött események és live fizetések alapján. Ha ezekben nem ad inkrementális eredményt, a két csatornát érdemes visszaolvasztani egy erősebb OurFilm-profilba.

## Mi jó?

### 1. A csatorna megtalálta a piac egyik legerősebb fájdalmát

„A legjobb képek a vendégek telefonján maradnak” azonnal érthető, konkrét és valós. Nem kell hozzá kategóriaismeret, és természetesen vezeti be az OurFilmet. A hozzá tartozó [34,9K-s poszt](https://www.tiktok.com/@ourfilm.app/photo/7684691200816811287) kimagasló 2,57%-os mentési és 1,06%-os megosztási aránya azt mutatja, hogy a nézők nemcsak elfogyasztották, hanem el is tették vagy továbbküldték az ötletet.

### 2. A termék vizuálisan TikTok-kompatibilis

A QR-tábla, az egyetlen koppintással használható kamera és a közös album jól demonstrálható mobilképernyőn. A [81,9K-s poszt](https://www.tiktok.com/@ourfilm.app/photo/7681399597977177366) második slide-ja már elmagyarázza, hogy érkezéskor QR-kódot olvasnak a vendégek; a [66,5K-s termékbemutató](https://www.tiktok.com/@ourfilm.app/photo/7681608598702624022) pedig az alkalmazás felületét is mutatja. Nem absztrakt SaaS-termékről van szó: a „QR → fotó → emlék” lánc képen eladható.

### 3. A mentési viselkedés erős vásárlási előszándékot jelez

Az esküvőt tervezők hónapokkal előre gyűjtenek ötleteket. A top posztok 526–1 619 mentése sokkal értékesebb jel, mint az önmagában magas view. Ezt a csatorna még nem méri vagy használja láthatóan funnelként, de az alapanyag megvan.

### 4. A vizuális világ konzisztens

A meleg tónusú esküvői képek, a fehér feliratok, a QR-tábla és a telefonos termékkép egységes feedet ad. A bio fő mondata — „Ők megörökítik. Ti örökre megőrzitek” — érzelmileg illeszkedik ehhez.

## Mi rossz?

### 1. View-generátor mintázat, nem csatorna

32-ből 32 poszt photo carousel, jellemzően ugyanazzal a dramaturgiával. Nincs sorozatlogika, nincs visszatérő ember, nincs vélemény, nincs kulissza, nincs közösségi rituálé, nincs ok a követésre. A néző megkapja az egyszeri „jó esküvői ötletet”, elmenti, majd továbbmegy.

A 276 követő körülbelül 468 ezer view után kifejezetten gyenge követőkonverzió. Ez a legfontosabb száma a csatornának, nem a 81,9K-s csúcs.

### 2. A feed a rossz kategóriába pozicionálja a terméket

Az OurFilm valódi megkülönböztetése a privát digitális eldobható kamera: fix képkockaszám, nincs előnézet, nincs újrafotózás, a képek előhívása késleltethető. A vizsgált TikTokok ehelyett szinte kizárólag **„QR-kódos közös esküvői albumként”** mutatják be. Ez könnyen másolható, ár-összehasonlítható kategória, és elveszi a termék legerősebb érzelmi mechanikáját: a kíváncsiságot és a későbbi közös felfedezést.

Az [egyik poszt](https://www.tiktok.com/@ourfilm.app/photo/7681608598702624022) szövege például azt hangsúlyozza, hogy a kép „már ment is a közös galériába”. Ez az instant album érzetét erősíti, nem a disposable-camera élményt. Működhet egy azonnali reveal beállításnál, de márkaígéretként összemossa az OurFilmet az egyszerű feltöltőoldalakkal.

### 3. Az első személyű történetek hitelességi adósságot építenek

„A nagymamám…”, „a férjemmel…”, „az öcsém…” — a márkafiók úgy beszél, mintha minden poszt egy másik valódi menyasszony saját története lenne. Nincs megjelölve, hogy ezek ügyféltörténetek, illusztrációk vagy fiktív szcenáriók. Már néhány nap után sablonossá és kitalálttá válik.

Ez különösen rossz egy privát emlékeket kezelő terméknél. Itt a bizalom maga a termék része.

### 4. Valós fotóhasználati és bizalmi kockázat látszik a kommentekben

Az első, [65,4K-s poszt](https://www.tiktok.com/@ourfilm.app/photo/7681299906312686870) alatt Szénás Dóri (`@doras_moments`) ezt kommentelte: **„Mik vannak, kicsi a világ, mert ezek az én fotóim!”** A komment barátságos hangú, ezért önmagában nem bizonyít engedély nélküli használatot. Viszont azonnal indokol egy jogtisztasági auditot: van-e minden fotóra dokumentált felhasználási engedély és alkotói kredit?

Ha nincs, ez nem „content probléma”, hanem márka- és jogi kockázat. Ha van, a fotós megjelölése továbbra is jobb gyakorlat és bizalmat épít.

### 5. Az AI-jelölés ütközik a márkaígérettel

Minden részletesen megnyitott OurFilm-posztnál látszott a **„MI által generált médiaanyagot tartalmaz”** jelölés. Lehet technikailag indokolt, de a néző számára furcsa egy olyan márkánál, amely valódi, megismételhetetlen emberi emlékeket ígér. A feed emiatt könnyen művi esküvői moodboardnak látszik.

Nem az AI-használat önmagában a probléma, hanem hogy nincs mellette elég valódi bizonyíték: igazi vendégek, igazi események, valódi OurFilm-albumok és engedéllyel bemutatott képek.

### 6. Nincs valódi CTA vagy mérhető út a termékhez

A mintázott captionök hashtagekkel zárulnak. Nem kérnek profillátogatást, ingyenes eseményindítást, kommentet, demót vagy követést. A bio kiírja az `ourfilm.app` domaint, de a nyilvános profilnézetben nem látszik külön kattintható weboldalmező.

Így a legjobb poszt is tud úgy 1 619 mentést hozni, hogy a csatorna nem mondja meg: **mit csináljon most az, aki ezt a saját esküvőjére akarja?**

### 7. A kommentek száma feltűnően alacsony

A 34,9K-s poszton 4, a 81,9K-s poszton 6, a 20,3K-s és 16,2K-s poszton 0 komment volt. A hangulat ahol látszott, pozitív, de többnyire sekély: emojik, „legjobb ötlet”, rövid elismerés. Nincs valódi beszélgetés árakról, működésről, adatvédelemről, képszámról vagy revealről.

Ez azt jelenti, hogy a tartalom inspirál, de még nem nyit vásárlás előtti párbeszédet.

### 8. A profil higiénéje nincs kész

- A megjelenített név **Ourfilm**, nem **OurFilm**.
- 0 követett fiók: a márka kívül áll az esküvői ökoszisztémán, nem látszik, hogy fotósokkal, helyszínekkel, ceremóniamesterekkel vagy párokkal kapcsolatot építene.
- Nincs három egyértelműen kitűzött „mi ez / bizonyíték / hogyan kezdd el” belépő tartalom a nyilvános profilnézetben.
- A bio szép, de nem mondja el a kategóriát, a fő differenciát vagy a következő lépést.

## Fenntartható csatornastratégia

### Azonnal abbahagynám

1. **Napi 2–3 ugyanolyan AI-carouselt.** Ez nem tesztelés, ha ugyanaz a hook, ugyanaz a képvilág és ugyanaz a CTA-hiány ismétlődik.
2. **Fiktívnek ható első személyű családi történeteket márkahangon.** Ha valódi ügyféltörténet, nevezzétek és kérjetek engedélyt; ha szcenárió, írjátok úgy: „Képzeld el, hogy…”.
3. **A view-t fő KPI-ként.** A 20,3K-s poszt minőségben sokkal gyengébb a 34,9K-snál.
4. **Jelöletlen vagy bizonytalan jogú esküvői fotók használatát.** Minden képhez legyen forrás, engedély, időtartam és felhasználási kör.

### Tartalmi pillérek

Javasolt heti 5 poszt, nem 15–20:

| Arány | Pillér                             | Példák                                                                                                                                       |
| ----: | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
|   40% | **Valódi eseménybizonyíték**       | „137 vendég, 842 kép, ezek voltak a legjobbak”; pár reakciója az előhíváskor; engedélyezett vendégfotók; fotós és helyszín kredit.           |
|   25% | **Termékdemó és megkülönböztetés** | Fix 24 képes roll; nincs preview és retake; mikor jelennek meg a képek; QR-scan élőben; 15 másodperces teljes guest flow.                    |
|   20% | **Host-oktatás**                   | Hová kerüljön a QR-tábla; hogyan vesz rá 100 vendéget a használatra; instant vs esemény végi reveal; adatvédelem; mi történik gyenge nettel. |
|   15% | **Emberi márka és építés**         | Miért építjük az OurFilmet; founder kamera előtt; valódi hibák/tanulságok; rendezvényes partnerek; kommentre válaszvideók.                   |

### Három kötelező kitűzött videó

1. **„Mi az OurFilm 20 másodpercben?”** QR → név → fix filmtekercs → nincs előnézet → közös előhívás.
2. **„Így nézett ki egy valódi esküvőn”** — valós számokkal, engedélyezett képekkel és a pár reakciójával.
3. **„Mennyibe kerül és hogyan indul?”** — ingyenes belépő, korlátok, fizetős esemény, webcím.

### Kreatív szabályok

- A termék vagy a fájdalom legyen az **első slide-on**, ne a harmadikon.
- Két másodpercen belül derüljön ki, hogy ez digitális eldobható kamera, nem Dropbox QR-kóddal.
- Legalább minden második posztban legyen valódi kéz, hang vagy arc.
- A képernyőfelvétel mutassa meg a guest flow-t, ne csak egy telefon mockupot.
- Egy poszt egy állítást bizonyítson. Ne általános esküvői montázs legyen.
- Minden ügyféltörténetnél szerepeljen: esemény típusa, konkrét eredmény, engedéllyel közölt vizuál, partnerkreditek.

### CTA-rendszer

Ne minden poszt ugyanazt kérje. A cél szerinti CTA:

- **Felfedezés:** „Küldd el annak, aki 2027-ben házasodik.”
- **Megfontolás:** „Mentsd el a QR-tábla ötletet az esküvői listádhoz.”
- **Bizalom:** „Kérdezz az adatvédelemről vagy a vendéglimitről — válaszvideót csinálunk.”
- **Konverzió:** „Indítsd el a saját kamerádat az ourfilm.app-on.”
- **Követés:** „Kövess valódi vendégfotókért és heti egy működő esküvői kamera-tippért.”

Amint elérhető a kattintható profil-link, minden TikTok-forgalom külön UTM-et kapjon. Link nélkül is legyen rövid, kimondott és feliratozott domain.

## Mit mérnék a következő 30 napban?

Nem a view alapján választanék győztest. Posztonként:

1. 1 000 view-ra jutó profilmegtekintés;
2. profilból követés aránya;
3. mentés + megosztás / view;
4. TikTokból érkező webes session;
5. esemény-draft indítás;
6. létrehozott esemény;
7. checkout indítás és vásárlás;
8. kommentekben megjelenő valódi kérdések száma.

A csatorna saját jelenlegi benchmarkja alapján:

- **jó tartalom:** legalább kb. 1,5% mentés és 0,5% megosztás;
- **view-only tartalom:** 0,3% alatti mentés és 0,1% alatti megosztás;
- **márkaépítő tartalom:** a profilmegtekintésből követés és a visszatérő néző aránya is nő;
- **üzleti tartalom:** mérhetően draftot vagy eseményt indít, még ha kevesebb view-t is kap.

Ezek nem általános iparági küszöbök, hanem az OurFilm jelenlegi legerősebb és gyengébb posztjaiból képzett belső mércék.

## 30 napos tesztterv

Heti öt poszt, összesen húsz:

- 4 valódi esemény-case study;
- 4 élő termékdemó;
- 4 host-tipp;
- 3 founder/BTS;
- 3 kommentre válasz;
- 2 érzelmi carousel kontrollként, de valós történettel és egyértelmű forrással.

Minden formátumból legalább két hook-verzió fusson. A győztest ne view, hanem **profil-látogatás → eseményindítás** alapján válasszátok. Ha egy 8K-s videó három fizető eseményt hoz, az többet ér, mint egy 80K-s slideshow, amely csak mentéseket termel.

## Végső prioritási sorrend

1. **Javítsátok a jogtisztaságot és a forrásolást.**
2. **Mutassátok meg a valódi termékkategóriát: digitális eldobható kamera, nem közös QR-album.**
3. **Építsetek emberi hitelességet valódi eseményekkel és arcokkal.**
4. **Tegyetek egyértelmű CTA-t és mérhető TikTok-funnelt minden tartalomtípus mögé.**
5. **Csökkentsétek a mennyiséget, növeljétek a formátum- és állításdiverzitást.**

Az OurFilm TikTokja nem rossz. Ennél veszélyesebb: **elég jó ahhoz, hogy a magas view-k elfedjék a rossz irányt**. A csatorna akkor lesz fenntartható, ha az esküvői érzelem nem maga a tartalom, hanem a valódi termékbizonyíték csomagolása.

## Elsődleges források

- [OurFilm TikTok-profil](https://www.tiktok.com/@ourfilm.app)
- [65,4K — „A nagymamám…”](https://www.tiktok.com/@ourfilm.app/photo/7681299906312686870)
- [81,9K — „Nem gondoltam volna…”](https://www.tiktok.com/@ourfilm.app/photo/7681399597977177366)
- [66,5K — „A buli végére 172 vendég…”](https://www.tiktok.com/@ourfilm.app/photo/7681608598702624022)
- [66,5K — „A legjobb döntés volt…”](https://www.tiktok.com/@ourfilm.app/photo/7683818751287889174)
- [34,9K — „A legjobb képek a vendégek telefonján…”](https://www.tiktok.com/@ourfilm.app/photo/7684691200816811287)
- [16,2K — „A férjemmel titokban…”](https://www.tiktok.com/@ourfilm.app/photo/7684923499411950870)
- [20,3K — „El sem hiszem, hogy ezt tette az öcsém…”](https://www.tiktok.com/@ourfilm.app/photo/7686041886515072258)
- [Legfrissebb poszt — „Ha a legszebb nászajándék…”](https://www.tiktok.com/@ourfilm.app/photo/7686202308182494486)

### Módszertani megjegyzés

Az audit a nyilvános TikTok webes profil és a nyilvánosan megnyitható posztok elsődleges adatait használta. A view-kat a profilrácsról, a like/komment/mentés/megosztás értékeket a posztoldalakról rögzítette. A TikTok számlálói folyamatosan változnak, a legfrissebb poszt pedig még nem érett be. A belső analitika — retention, teljes profilmegtekintés, linkkattintás, követés forrása és konverzió — nem volt hozzáférhető, ezért ezekre külön mérési terv készült, nem becslés.
