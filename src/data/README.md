# Data

Lihastohtorin data on staattista JSONia. Jokaisella datatiedostolla on JSON Schema -skeema kansiossa `schema/`. `npm test` validoi kaikki tämän kansion `*.json`-tiedostot skeemojaan vasten. Jos tiedostolla ei ole skeemaa, testi epäonnistuu.

| Tiedosto | Skeema | Sisältö |
|---|---|---|
| `muscles.json` | `schema/muscle.schema.json` | Lihakset (S2.2) |
| `structures.json` | `schema/structure.schema.json` | Jänteet ja kalvot, joiden kautta kytkökset kulkevat (S2.3) |
| `connections.json` | `schema/connection.schema.json` | Kytkökset lihasten, rakenteiden ja kipualueiden välillä (S2.3) |
| `sources.json` | `schema/source.schema.json` | Lähdeluettelo, johon muu data viittaa id:llä (S5.2) |

## Lihas (`muscles.json`)

| Kenttä | Tyyppi | Pakollinen | Kuvaus |
|---|---|---|---|
| `id` | string, `snake_case` | ✓ | Pysyvä tunniste |
| `meshes` | string[], vähintään 1 | | 3D-mallin meshien nimet täsmälleen mallitiedoston mukaisina, esim. kaksi päätä = kaksi meshiä (S1.1) |
| `name.fi` | string | ✓ | Suomenkielinen nimi |
| `name.la` | string | ✓ | Latinankielinen nimi (näytetään kursiivilla) |
| `origin` | string | ✓ | Origo |
| `insertion` | string | ✓ | Insertio |
| `action` | string | ✓ | Toiminta |
| `layer` | `"superficial"` \| `"deep"` | ✓ | Kerros 3D-näkymän kerrosvalitsimessa (S1.3) |
| `sources` | string[], vähintään 1 | ✓ | Viittaukset `sources.json`-tiedoston id:ihin |

Tekstikentät kirjoitetaan suomeksi. Muita kenttiä ei sallita.

```json
{
  "id": "soleus",
  "name": { "fi": "leveä kantalihas", "la": "Musculus soleus" },
  "origin": "…",
  "insertion": "…",
  "action": "…",
  "layer": "superficial",
  "sources": ["teachme-leg-posterior", "fipat-ta2"]
}
```

### Nimeäminen

- **`id`:** latinankielinen nimi `snake_case`-muodossa ilman sanaa *musculus*. Jos rakenteella on samanniminen vastine toisessa raajassa, id saa TA2:n tapaan `_pedis`- tai `_manus`-päätteen (esim. `lumbricales_pedis` ja `lumbricales_manus`). Näin id:t eivät mene päällekkäin, kun malli laajenee koko kehoon.
- **`name.la`:** Terminologia Anatomica 2 (FIPAT 2019) -nimistön `Musculus …`-muoto. Jos TA2:n ensisijainen termi on uutta muotoa (esim. *Flexor longus hallucis*), käytetään TA2:n latinankielistä synonyymiä (*Musculus flexor hallucis longus*), koska se on oppikirjoista tutumpi. Jos synonyymi on oppikirjoista poikkeava (*Musculus major psoae*), käytetään TA2:n ensisijaista termiä (*Psoas major*).
- **`name.fi`:** Deltan käännös TA2:n latinan- ja englanninkielisistä termeistä (päätös 2026-10-03: englanninkielinen nimistölähde riittää). Nimiä ei ole tarkistettu suomenkielistä sanakirjaa vasten.

### Kerrosjako (`layer`)

`layer` on käyttöliittymän ryhmittely. Se on johdettu lähteiden sijaintikuvauksista seuraavasti:

- **Säären takaosasto:** TA2:n ja TeachMeAnatomyn pinnallinen osa on `superficial` ja syvä osa `deep`.
- **Etu- ja sivuosasto:** lihas on `deep`, jos lähde sanoo sen olevan toisen lihaksen alla. Isonvarpaan pitkä ojentajalihas ja lyhyt pohjeluulihas ovat siksi `deep`.
- **Poikkeus etuosastossa:** varpaiden pitkä ojentajalihas on luokiteltu `superficial`-kerrokseen, vaikka TeachMe kuvaa sen olevan "lateraalisesti ja syvemmällä" kuin etummainen säärilihas. Kolmas pohjeluulihas seuraa sitä, koska niillä on yhteinen lähtökohta. Molemmat tarkistetaan mallia vasten S1.3:ssa.
- **Jalkaterä:** jalkapöydän lihakset ja jalkapohjan kerros 1 ovat `superficial`, jalkapohjan kerrokset 2–4 `deep`.
- **Yläraaja:** lihas on `deep`, jos TeachMe sijoittaa sen syvään kerrokseen tai sanoo sen olevan toisen lihaksen alla (esim. olkalihas ja korppiolkalihas hauislihaksen alla, lapaluun kohottaja ja suunnikaslihakset epäkäslihaksen alla). Kyynärvarren etuosaston keskikerros (sormien pinnallinen koukistajalihas) luetaan `deep`-kerrokseen, koska käyttöliittymässä on vain kaksi kerrosta.
- **Kiertäjäkalvosin:** sen neljä lihasta ovat ryhmänä `deep`. TeachMe ei kuvaa niiden syvyyttä, joten jako on käyttöliittymäpäätös: pinnallisen kerroksen piilottaminen paljastaa koko kalvosimen.
- **Kämmenselän puoleiset luidenväliset lihakset** ovat `superficial`, koska TeachMe kuvaa ne kämmenselän pinnallisimmiksi lihaksiksi.

## Rakenne (`structures.json`)

Jänne tai kalvo, joka ei ole lihas mutta jonka kautta kytkösketju kulkee (esim. akillesjänne). Kentät: `id`, `meshes`, `name.fi`, `name.la` ja `sources`, joilla on sama merkitys kuin lihaksella.

## Kytkös (`connections.json`)

| Kenttä | Tyyppi | Kuvaus |
|---|---|---|
| `id` | string, `kebab-case` | Pysyvä tunniste |
| `type` | `shared_tissue` \| `attachment` \| `referred_pain` | Yhteinen jänne tai kalvo, kiinnittyminen toiseen rakenteeseen tai yhteinen kiinnityskohta, tai heijastekipu |
| `from` | `muscle:<id>` \| `structure:<id>` | Kytköksen toinen pää |
| `to` | `muscle:<id>` \| `structure:<id>` \| `region:<id>` | Toinen pää. Alue (`region`, ks. `src/viewer/regions.ts`) vain heijastekivussa. |
| `evidence` | `anatomy` \| `cadaver_study` \| `contested` | Näytön taso: anatominen perustieto, ruumiinavaus- tai kudostutkimus tai tieteellisesti kiistanalainen |
| `description` | string | Käyttäjälle näytettävä kuvaus siitä, mitä lähteet kertovat |
| `sources` | string[], vähintään 1 | Viittaukset `sources.json`-tiedoston id:ihin |

Kaikki kentät ovat pakollisia. Heijastekipu kulkee aina lihaksesta alueeseen, ja muut tyypit yhdistävät vain lihaksia ja rakenteita. Skeema tarkistaa molemmat.

Kuvaus kertoo, mitä lähteet raportoivat, eikä koskaan väitä, että jokin aiheuttaa kipua. Kiistanalaisessa näytössä kiistanalaisuus sanotaan kuvauksessa ääneen, ja sen lähteeksi merkitään kriittinen arvio.

## Lähde (`sources.json`)

| Kenttä | Tyyppi | Pakollinen | Kuvaus |
|---|---|---|---|
| `id` | string, `kebab-case` | ✓ | Pysyvä tunniste, johon data viittaa |
| `label` | string | ✓ | Lyhyt merkintä väitteen vieressä, esim. "Snow ym. 1995" |
| `citation` | string | ✓ | Täydellinen viite: tekijät, nimeke, painos tai lehti, vuosi ja tarvittaessa luku tai sivu |
| `url` | string, `http(s)://` | | Linkki lähteeseen |

## Säännöt

- Jokaisella tietueella on vähintään yksi lähde. Väitteitä ei lisätä ilman lähdettä (CLAUDE.md, terveystiedon periaate).
- Id:t ovat yksikäsitteisiä, jokainen `sources`-viittaus osoittaa olemassa olevaan lähteeseen ja jokainen kytkös olemassa olevaan lihakseen, rakenteeseen tai alueeseen. Testi tarkistaa kaikki kolme.
- Jos lähteestä on luettu vain tiivistelmä, viitteessä lukee "Tiivistelmä luettu". Väitteet perustuvat silloin vain tiivistelmään.
- `meshes` sisältää 3D-mallin solmujen (node) nimet. three.js nimeää objektit solmujen mukaan, ja testi vaatii jokaiselle lihakselle meshit ja tarkistaa, että nimet löytyvät tiedostosta `public/models/lower-limb.glb`. Skeemassa kenttä on valinnainen, koska testi valvoo sitä mallikohtaisesti.
- Malli tuotetaan skriptillä `scripts/extract-lower-limb.mjs`, joka ottaa mukaan lähdemallin kaikki lihakset ja luut sekä `structures.json`:n rakenteet. Mallissa voi siis olla lihaksia, joille ei vielä ole dataa; niitä ei näytetä kipuhaun tuloksissa. Kun rakenne lisätään, aja skripti uudelleen (lähde ja tarkistussumma: `public/models/ATTRIBUTION.md`). Kiinnityskohdat tuottaa `scripts/extract-attachments.mjs` lihasten `attachmentMeshes`-kentistä.

## Lähdepolitiikka (päätös 2026-10-03)

- **Lihasdata:** pääviite TeachMeAnatomy. StatPearls (NCBI Bookshelf) on hyväksytty lähde, mutta NCBI:n captcha estää Deltaa lukemasta sitä, joten StatPearls-viitteet lisää ihminen.
- **OpenStax:** ei käytetä tekoälyn luonnostelemassa datassa, koska OpenStaxin käyttöehdot kieltävät sisällön syöttämisen kielimalleihin. Ihminen voi käyttää sitä viitteenä, mutta ei ainoana lähteenä, koska sen taulukoissa on virheitä.
- **Kirjoitetaan omin sanoin.** Lähteistä poimitaan faktat, tekstiä tai kuvia ei kopioida.
- **Viitataan vain luettuun.** Viite osoittaa sivuun tai lukuun, josta tieto on tarkistettu.
- **Kytkökset (S2.3):** jokaisella kytköksellä on näytön taso (esim. anatominen oppikirjatieto, ruumiinavaustutkimus, kliininen havainto, kiistanalainen). Käyttöliittymä muotoilee väitteen tason mukaan: "voi liittyä", ei koskaan "syy on".
