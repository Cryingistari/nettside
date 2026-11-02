# Historia om Gudbrandsdalen

Nettside for Facebook-sida «Historia om Gudbrandsdalen» (Arild og Eirik).
Hostes på Azure Static Web Apps; alt som pushes til `main` publiseres automatisk.

## Oppbygging

- `index.html` – forsiden (artikler, kommer snart, om oss)
- `kart/` – historiekartet
  - `data.js` – **gårdene og historiene på kartet**. Ny historie = ny oppføring her.
  - `app.js`, `style.css` – selve kartet
  - `geo.js` – kommunegrenser, elver, sjøer og E6 (Kartverket, CC BY 4.0)
  - `topo/` – topografisk bakgrunnskart (Kartverket, CC BY 4.0)
- `historier/` – PDF-ene med historiene. `pdf.id` i `data.js` er filnavnet uten `.pdf`.

## Legge til en historie

1. Legg PDF-en i `historier/` (f.eks. `dale-gudbrand.pdf`).
2. I `kart/data.js`: legg historien under riktig gård i `stories`, eller lag en ny gård
   med `id`, `name`, `lat`, `lon`, `kommune` og `stories`.
