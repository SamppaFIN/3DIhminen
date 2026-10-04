# SETUP — seuraavat askeleet

1. **Vaihda projektiohjeet.** Avaa claude.ai-projektissa "Set project instructions" ja korvaa koko nykyinen sisältö tiedostolla `INSTRUCTIONS-FINAL.md`.
2. **Lisää project knowledge.** Raahaa project knowledge -kenttään `CLAUDE.md` ja `backlog.json`.
3. **Avaa Claude Design** ja liitä sinne `design-brief.md`. Pyydä ensimmäiseksi mobiilinäkymä kipuhaun tuloksesta (näkymä 4); se on sovelluksen tärkein ruutu.
4. **Sopikaa Arton kanssa koodin jakotapa.** Paikallinen git ei siirrä koodia koneelta toiselle. Vaihtoehtoja: yksityinen etärepo, jaettu kansio tai patch-tiedostot. Kirjatkaa valinta CLAUDE.md:n osioon 4.
5. **Alustakaa projekti.** `npm create vite@latest lihastohtori -- --template react-ts`, sitten `git init` ja ensimmäinen commit.
6. **Etsikää 3D-malli (S1.1).** Tarkistakaa lisenssi ennen käyttöönottoa ja varmistakaa, että lihakset ovat erillisiä mesh-objekteja. Tämä on projektin suurin riski, joten aloittakaa siitä.
7. **Pystyttäkää testit (S2.0).** Asentakaa Vitest ja saakaa ensimmäinen testi läpi ennen datatyötä.
8. **Päivittäkää backlog.json** aina kun tikettien tila muuttuu: uusi `_meta.generated_at` ja (kun repo on olemassa) `_meta.git_commit` = nykyinen HEAD. Ladatkaa päivitetty tiedosto project knowledgeen vanhan tilalle.
