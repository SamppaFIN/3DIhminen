# Design-brief — Lihastohtori

## Projekti
**Lihastohtori** on web-sovellus, joka näyttää ihmisen anatomian 3D:nä ja kertoo, mitkä lihakset voivat aiheuttaa kipua klikattuun kohtaan. Esimerkki: käyttäjä klikkaa kipeää jalkapohjaa, ja sovellus valaisee ketjun jalkapohjasta plantaarifaskian ja akillesjänteen kautta pohjelihaksen kiinnitykseen polven takana. MVP kattaa alaraajan polvesta alaspäin.

## Kohdekäyttäjä
Aikuinen, jolla on lihas- tai jännekipua ja joka haluaa ymmärtää, mistä kipu voi olla peräisin. Ei anatomian ammattilainen. Käyttää usein puhelinta, mahdollisesti kipeänä ja kärsimättömänä: näkymän on oltava heti ymmärrettävä ilman ohjeita. Toissijaisesti: liikunnan harrastaja tai opiskelija, joka tutkii lihasten kytköksiä.

## Ensisijainen tehtävä
Kipukohta → mahdolliset lähteet → miksi. Kaikki muu on toissijaista.

## Näkymät
| # | Näkymä | Sisältö |
|---|---|---|
| 1 | Ensikäynnin ilmoitus | Lyhyt selitys mitä sovellus tekee ja ettei se diagnosoi. Yksi painike: "Aloita". |
| 2 | 3D-päänäkymä | Koko näytön malli, navigointi (pyöritys, zoom, panorointi), "Palauta näkymä", kerrosvalitsin (pinnalliset/syvät). |
| 3 | Kipukohdan valinta | Klikattu piste merkitään mallin pintaan, kehon alue nimetään ("Jalkapohja"). |
| 4 | Kipuhaun tulos | Korostetut lihakset mallissa + tekstilista: paikalliset ja kauempana olevat lähteet erikseen. Ei-diagnoosi-ilmoitus näkyvissä. |
| 5 | Kytkösketju | Valitun lähteen ketju vaihe vaiheelta kipukohdasta lähteeseen, jokaisessa vaiheessa lähdeviite. |
| 6 | Lihaksen tietopaneeli | Nimi suomeksi ja latinaksi, origo, insertio, toiminta, kytkeytyvät lihakset (klikattavia). |
| 7 | Haku | Hakukenttä (suomi ja latina), valinta kohdistaa kameran lihakseen. |
| 8 | Lähteet | Datan lähdeluettelo ja 3D-mallin lisenssiattribuutio. |

## Asettelu
Malli täyttää koko näytön; käyttöliittymä on sen päällä mahdollisimman ohuena.

```
Mobiili                         Työpöytä
┌─────────────────┐             ┌──────────────────────────┬──────────┐
│ [haku]   [kerr.]│             │ [haku]           [kerr.] │ Tulos /  │
│                 │             │                          │ tieto-   │
│     3D-malli    │             │        3D-malli          │ paneeli  │
│        ●        │             │           ●              │          │
│                 │             │                          │ ketju    │
├─────────────────┤             │ [palauta]                │ lähteet  │
│ ▔▔ alapaneeli ▔▔│             └──────────────────────────┴──────────┘
│ tulos / ketju   │
└─────────────────┘
```
- Mobiili: tulokset ja tiedot vedettävässä alapaneelissa (puoliksi auki / täysin auki), malli näkyy aina sen yläpuolella.
- Työpöytä (≥ 64rem): kiinteä oikea paneeli, leveys clamp(20rem, 28vw, 26rem).
- Teksti tasataan vasemmalle. Rivinpituus paneeleissa enintään ~60 merkkiä.

## Visuaalinen suunta
Lähtökohta on klassinen anatominen atlas: viileä, kliininen tausta, lihakset omassa lihaksen värissään ja jänteet helmenvalkoisina. Korostusvärit on valittu niin, että ne erottuvat punaisista lihaksista. Latinankieliset nimet kursiivilla, kuten anatomian kirjoissa.

**Yksi muistettava elementti:** kytkösketjun valaistuminen. Kun tulos avautuu, ketju syttyy kipukohdasta lähdettä kohti vaihe kerrallaan. Tämä on sovelluksen ainoa automaattinen animaatio; kaikki muu liike vastaa käyttäjän toimintaan.

## Design-systeemi

### Värit (OKLCH)
```css
:root {
  /* Pinnat */
  --surface:        oklch(97% 0.008 240);  /* viileä atlaspaperi */
  --surface-raised: oklch(99.5% 0.004 240);
  --ink:            oklch(24% 0.02 250);   /* leipäteksti */
  --ink-muted:      oklch(48% 0.02 250);
  --line:           oklch(88% 0.01 240);

  /* Anatomia */
  --muscle:         oklch(58% 0.14 22);    /* lihaskudos, oletus */
  --muscle-dim:     oklch(72% 0.06 22);    /* ei-valitut lihakset tuloksessa */
  --tendon:         oklch(88% 0.05 85);    /* jänne, faskia */

  /* Merkitykselliset korostukset */
  --pain:           oklch(70% 0.14 215);   /* kipukohdan merkki */
  --source-local:   oklch(74% 0.17 65);    /* paikallinen lähde */
  --source-distant: oklch(60% 0.18 300);   /* kauempana oleva lähde */
  --focus:          oklch(55% 0.2 260);    /* näppäimistöfokus */
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --surface:        oklch(20% 0.015 250);
    --surface-raised: oklch(25% 0.015 250);
    --ink:            oklch(94% 0.01 240);
    --ink-muted:      oklch(72% 0.015 240);
    --line:           oklch(34% 0.015 250);
    --muscle-dim:     oklch(42% 0.06 22);
  }
}
```
Väri ei koskaan kanna merkitystä yksin: paikalliset ja kauempana olevat lähteet erotetaan myös tekstilistan otsikoilla ja ikoneilla, ja kipumerkki on muodoltaan rengas, ei pelkkä väripiste.

### Typografia
Yksi perhe: **Atkinson Hyperlegible Next** (suunniteltu luettavuutta varten, sopii terveysaiheeseen). Varafontit: `system-ui, -apple-system, "Segoe UI", sans-serif`. Latinankieliset nimet kursiivilla.

```css
:root {
  --step--1: clamp(0.83rem, 0.80rem + 0.15vw, 0.90rem);  /* lähdeviitteet, apuvihjeet */
  --step-0:  clamp(1.00rem, 0.96rem + 0.20vw, 1.10rem);  /* leipäteksti */
  --step-1:  clamp(1.20rem, 1.12rem + 0.40vw, 1.40rem);  /* lihaksen nimi paneelissa */
  --step-2:  clamp(1.44rem, 1.30rem + 0.70vw, 1.80rem);  /* alueen nimi ("Jalkapohja") */
  --leading: 1.5;
}
```
Lauseenalkuiset isot kirjaimet, ei VERSAALIOTSIKOITA.

### Kosketus ja vuorovaikutus
- Kaikki kosketuskohteet vähintään **44 × 44 px**, myös kerrosvalitsimen ja hakutulosten rivit.
- Mallissa klikattavalle alueelle on annettava anteeksi: pieni virhe osuu lähimpään pintaan, ei tyhjään.
- Näkyvä näppäimistöfokus (`--focus`, 2px outline + 2px offset). Lihaslista ja ketju ovat näppäimistöllä selattavia.

### Liike
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
- Kamera siirtyy lihakseen pehmeästi (≈ 400 ms); vähennetyllä liikkeellä hyppää suoraan.
- Kytkösketju syttyy vaiheittain (≈ 150 ms/vaihe); vähennetyllä liikkeellä koko ketju näkyy heti.
- Ei automaattista mallin pyöritystä.

## Teksti
- Kirjoita käyttäjän kielellä: "Mistä kipu voi tulla", ei "Heijastekipuanalyysi".
- Ilmoitus: "Lihastohtori näyttää mahdollisia yhteyksiä, ei diagnoosia. Jos kipu on kova tai pitkittynyt, käänny ammattilaisen puoleen."
- Tyhjä tila: "Klikkaa kohtaa, johon sattuu."
