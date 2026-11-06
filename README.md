# Kotipaneeli: mobiilimockup käyttäjätestaukseen

Android-sovelluksen mockup, josta näkee yhdellä vilkaisulla, onko kotona tai mökillä jokin laite päällä, hana auki tai ovi lukitsematta.

| Kansio | Sisältö |
|---|---|
| `mobile/` | Expo (SDK 58) / React Native -sovellus Androidille |
| `backend/` | FastAPI-mock-API ja testinohjaajan selainsivu. Tila pidetään muistissa. |
| `shared/` | Laitetyypit, kohteiden pohjapiirrokset ja testitilanteet (JSON). Sekä sovellus että backend lukevat nämä. |
| `docs/kuvakaappaukset/` | Kuvat sovelluksesta ja testinohjauksesta raporttia varten |

## Nopein tapa: sovellus ilman palvelinta

Sovelluksessa on mukana sama data ja logiikka kuin backendissä, joten se toimii yksinään.

```bash
cd mobile
npm install
npx expo start
```

Asenna testipuhelimeen **Expo Go** Play Kaupasta ja skannaa terminaaliin tuleva QR-koodi. Jos puhelin ei löydä konetta (WSL2:ssa tavallista), käynnistä tunnelin kautta:

```bash
npx expo start --tunnel
```

Node.js 24 on asennettu kotihakemistoon (`~/.local/opt`, komennot `~/.local/bin`). Tyyppitarkistus: `npx tsc --noEmit`, lint: `npx eslint .`.

## Selainversio (Vercel)

Sovelluksesta saa selaimessa toimivan version, jonka voi jakaa linkkinä. Se käyttää sovelluksen omaa dataa samoin kuin Expo Go ilman palvelinta. Laajalla näytöllä sovellus pysyy puhelimen levyisenä keskellä.

Paikallinen kokeilu:

```bash
cd mobile
npx expo export --platform web   # tulos kansioon mobile/dist
python3 -m http.server 4173 -d dist
```

Julkaisu: tuo repo Verceliin (Add New → Project) ja jätä Root Directory tyhjäksi eli repon juureksi. Asetukset luetaan juuren `vercel.json`-tiedostosta, eikä muuta tarvitse muuttaa. Jokainen push `main`-haaraan julkaisee uuden version. Vaihtoehtoisesti komentoriviltä: `npx vercel` (esikatselu) tai `npx vercel --prod`.

**Rajoitus:** Vercelin sivu on HTTPS-osoitteessa, joten selain ei päästä sitä läppärin `http://…:8000`-backendiin (mixed content). Testinohjaus (`/ohjaus`) toimii siis vain Expo Go -sovelluksen kanssa tai kun selainversiota ajetaan omalta koneelta.

## Testitilanteen ohjaus palvelimen kautta

Kun backend on käynnissä, ohjaaja voi vaihtaa testitilannetta läppäriltä testaajan puhelimeen koskematta.

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
```

1. Avaa läppärillä **http://localhost:8000/ohjaus**. Sivulla vaihdetaan laitteiden ohjaus päälle tai pois, aloitusnäkymä, puhelimen kohde ja testitilanne. Laitteiden tiloja voi asettaa yksitellen, ja tapahtumaloki näyttää, mitä testaaja teki.
2. Yhdistä puhelin: paina sovelluksessa kohteen nimeä (**Koti**) pitkään noin sekunnin, jolloin aukeavat **Testiasetukset**. Valitse Tietolähde: **Palvelin**, kirjoita läppärin osoite, esim. `http://192.168.1.20:8000`, ja paina **Yhdistä**. Osoite tallentuu puhelimeen.
   Vaihtoehtoisesti osoitteen voi antaa käynnistyksessä: `EXPO_PUBLIC_API_URL=http://192.168.1.20:8000 npx expo start`.
3. Puhelin hakee tilan kahden sekunnin välein.

**WSL2-huomio:** puhelin ei näe WSL:n sisällä pyörivää palvelinta oletuksena. Helpoin korjaus on lisätä Windowsin tiedostoon `%UserProfile%\.wslconfig` rivit `[wsl2]` ja `networkingMode=mirrored`, käynnistää WSL uudelleen (`wsl --shutdown`) ja sallia portti 8000 Windowsin palomuurissa. Toinen vaihtoehto on ajaa backend suoraan Windowsissa.

## Sovelluksen toiminta

- **Yläreuna** kertoo tilanteen yhdellä lauseella: "Kaikki kunnossa", "Liesi päällä" tai "2 asiaa vaatii huomiota". Pelkät päälle jääneet valot eivät tee tilasta hälyttävää, koska testeissä valot huolestuttivat vähemmän kuin kodinkoneet.
- **Pohjapiirros** ja **Lista** näyttävät saman tiedon. Punainen on vaatii huomiota, keltainen on valo päällä ja harmaa on kunnossa. Laitetta napauttamalla aukeaa sen tiedot.
- **Laitteiden ohjaus** (kehittäjän kytkin, oletuksena pois): kun se on päällä, sovellus näyttää painikkeet Sammuta, Sulje hana, Lukitse ja Sammuta kaikki valot. Oven lukituksen avaaminen etänä kysyy vahvistuksen.
- **Kohteet**: Koti ja Mökki, vaihto yläreunan valinnasta.
- Ohjaajan lataama testitilanne siirtää puhelimen oikeaan kohteeseen. Testaajan valitsema näkymä (pohjapiirros tai lista) säilyy, ellei ohjaaja vaihda aloitusnäkymää.
- Tumma tila seuraa puhelimen asetusta.

## Rajapinta lyhyesti

Sovellus (noudattaa `controlsEnabled`-asetusta):

| Kutsu | Tarkoitus |
|---|---|
| `GET /api/snapshot?siteId=koti` | Asetukset, kohteiden yhteenvedot ja valitun kohteen laitteet yhdellä kyselyllä |
| `GET /api/catalog` | Laitekategoriat ja -tyypit |
| `POST /api/devices/{id}/state` `{"state": "off"}` | Muuta laitteen tilaa. 403 jos ohjaus on pois käytöstä, 409 jos siirtymä ei ole sallittu. |
| `POST /api/sites/{id}/lights-off` | Sammuta kaikki valot |
| `POST /api/events` `{"kind": "open", "message": "Avasi: Liesi"}` | Käyttötapahtuma ohjaajan lokiin |

Testinohjaaja (ohittaa ohjausasetuksen):

| Kutsu | Tarkoitus |
|---|---|
| `GET /ohjaus` | Testinohjauksen selainsivu |
| `GET /api/facilitator` | Asetukset, testitilanteet ja kohteiden tila |
| `PATCH /api/facilitator/config` | `controlsEnabled`, `defaultView` (`floorplan` / `list`), `activeSiteId` |
| `POST /api/facilitator/scenarios/{id}/apply` | Lataa valmis testitilanne, esim. `hella-unohtui` |
| `POST /api/facilitator/devices/{id}/state` `{"state": "on", "minutesAgo": 40}` | Aseta mikä tahansa tila |
| `POST /api/facilitator/reset` | Palauta aloitustila |
| `GET /api/facilitator/events?afterId=0` | Tapahtumaloki (lähde: `app` / `ohjaus` / `system`) |

Rajapinnan dokumentaatio: http://localhost:8000/docs. Backendin testit: `.venv/bin/python -m pytest`.

## Ohjaussäännöt

Jokaisella laitetyypillä on turvallinen tila (liesi pois, hana kiinni, ovi lukossa) ja ohjaustapa:

- `none`: ei ohjattavissa (jääkaapin ovi)
- `safe_only`: vain turvalliseen tilaan (lieden voi sammuttaa, ei sytyttää)
- `both`: molempiin suuntiin (valot, ovien lukot)

Kohteen tila on `attention`, jos jokin kodinkone tai ovi on muussa kuin turvallisessa tilassa, `info`, jos vain valoja on päällä, ja muuten `ok`. Samat säännöt on toteutettu sekä `backend/app/store.py`:ssä että `mobile/src/data/local.ts`:ssä, joten muutokset tehdään molempiin.

## Datan muokkaus

Laitteita, huoneita ja testitilanteita lisätään suoraan `shared/`-kansion JSON-tiedostoihin. Pohjapiirroksen koordinaatit ovat metrejä vasemmasta yläkulmasta. Palvelin tarkistaa datan käynnistyessä ja kertoo virheestä suomeksi. Ikonit ovat [Material Design Icons](https://pictogrammers.com/library/mdi/) -nimiä.
