# Werkafspraken

- Wijzigingen na afronding altijd direct ook naar `main` pushen (de eigenaar heeft hier vaste toestemming voor gegeven). `main` wordt automatisch gedeployed op Vercel.
- Statische site zonder build-stap: `index.html` laadt `data.js`, `store.js`, `engine.js`, Chart.js (cdnjs), `dashboard.js`, `editor.js`, `account.js` vanuit de hoofdmap.
- `api/lening-uitlezen.js` is een Vercel serverless functie (Node, ESM) die leningovereenkomsten via de Claude API uitleest; vereist `ANTHROPIC_API_KEY` in Vercel.
- Taal van de interface en documentatie: Nederlands.
