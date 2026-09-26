/**
 * ============================================================
 *  Vercel serverless functie: leningovereenkomst uitlezen met AI
 *  POST /api/lening-uitlezen
 *  Body: { bestand: <base64 zonder data:-prefix>, mediaType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp" }
 *  Antwoord: { velden: {...}, opmerkingen: [...] }
 *
 *  Vereist de omgevingsvariabele ANTHROPIC_API_KEY (Vercel → Settings → Environment Variables).
 *  Het document wordt alleen doorgestuurd naar Claude en nergens opgeslagen.
 * ============================================================
 */
import Anthropic from '@anthropic-ai/sdk';

const TOEGESTAAN = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_BASE64 = 4_200_000; // Vercel accepteert max. ~4,5 MB request body

// Elk veld: waarde + hoe zeker + letterlijke bron uit het document
const veld = waardeSchema => ({
  type: 'object',
  properties: {
    waarde: { anyOf: [waardeSchema, { type: 'null' }] },
    zekerheid: { type: 'string', enum: ['hoog', 'middel', 'laag'] },
    bron: { type: 'string', description: 'Korte letterlijke passage of paginaverwijzing waar de waarde vandaan komt; leeg als niet gevonden.' },
  },
  required: ['waarde', 'zekerheid', 'bron'],
  additionalProperties: false,
});
const tekst = { type: 'string' };
const getal = { type: 'number' };
const datum = { type: 'string', description: 'Datum als YYYY-MM-DD' };

const SCHEMA = {
  type: 'object',
  properties: {
    velden: {
      type: 'object',
      properties: {
        naam: veld({ type: 'string', description: 'Korte naam voor de lening, bijv. "ING Amsterdam" (geldgever + plaats/object).' }),
        geldgever: veld(tekst),
        type: veld({ type: 'string', enum: ['hypotheek', 'bouwfinanciering', 'asl', 'overbrugging', 'mezzanine'] }),
        hoofdsom: veld(getal),
        huidig_saldo: veld(getal),
        rente_pct: veld(getal),
        rente_type: veld({ type: 'string', enum: ['vast', 'variabel'] }),
        aflossing_type: veld({ type: 'string', enum: ['annuiteit', 'lineair', 'bullet', 'geen'] }),
        ingangsdatum: veld(datum),
        einddatum: veld(datum),
        covenant_ltv_max: veld(getal),
        covenant_dscr_min: veld(getal),
        onderpand: veld({ type: 'string', description: 'Adres en plaats van het onderpand, als genoemd.' }),
      },
      required: ['naam', 'geldgever', 'type', 'hoofdsom', 'huidig_saldo', 'rente_pct', 'rente_type', 'aflossing_type',
        'ingangsdatum', 'einddatum', 'covenant_ltv_max', 'covenant_dscr_min', 'onderpand'],
      additionalProperties: false,
    },
    opmerkingen: {
      type: 'array',
      description: 'Overige belangrijke bepalingen (boeterente, zekerheden, ICR-covenant, opeisingsgronden, renteherziening, kosten).',
      items: { type: 'string' },
    },
  },
  required: ['velden', 'opmerkingen'],
  additionalProperties: false,
};

const INSTRUCTIE = `Je leest een (meestal Nederlandse) leningovereenkomst of financieringsofferte voor een vastgoedbedrijf uit.
Vul de velden in voor het leningenoverzicht van het dashboard.

- Bedragen in euro als getal zonder opmaak (2.300.000,00 → 2300000). Percentages als getal (3,45% → 3.45).
- rente_pct: de rente die nu geldt. Bij variabele rente (Euribor + opslag) de huidige totale rente als die genoemd wordt, anders alleen de opslag met zekerheid "laag" en uitleg in de opmerkingen.
- huidig_saldo: het nu uitstaande bedrag. Staat dat er niet, gebruik de hoofdsom met zekerheid "laag".
- aflossing_type: annuiteit, lineair, bullet (aflossingsvrij, alles aan het eind) of geen.
- covenant_ltv_max: maximale LTV (ook "loan-to-value", "verhouding lening/marktwaarde"). covenant_dscr_min: minimale DSCR (ook "debt service coverage", "rentedekkingsgraad" is ICR — dat is iets anders, zet ICR in de opmerkingen).
- Datums als YYYY-MM-DD. Einddatum = einde looptijd / vervaldatum van de lening, niet de einddatum van een rentevastperiode (die hoort in de opmerkingen).
- Vind je een waarde niet: waarde null, zekerheid "laag", bron leeg. Verzin niets.
- zekerheid "hoog" alleen als de waarde letterlijk en eenduidig in het document staat.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ fout: 'Alleen POST is toegestaan.' });
  }

  // Alleen aanroepen vanaf het eigen dashboard (beperkt misbruik van de API-sleutel)
  const origin = req.headers.origin || req.headers.referer || '';
  if (origin && !origin.includes(req.headers.host)) {
    return res.status(403).json({ fout: 'Niet toegestaan vanaf dit domein.' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ fout: 'ANTHROPIC_API_KEY is niet ingesteld in Vercel (Settings → Environment Variables).' });
  }

  const { bestand, mediaType } = req.body || {};
  if (typeof bestand !== 'string' || !bestand) {
    return res.status(400).json({ fout: 'Geen bestand ontvangen.' });
  }
  if (!TOEGESTAAN.includes(mediaType)) {
    return res.status(400).json({ fout: 'Alleen PDF, JPG, PNG of WEBP wordt ondersteund.' });
  }
  if (bestand.length > MAX_BASE64) {
    return res.status(413).json({ fout: 'Bestand is te groot (max. ca. 3 MB). Comprimeer de PDF of upload alleen de relevante pagina\'s.' });
  }

  const documentBlok = mediaType === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: bestand } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data: bestand } };

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{
        role: 'user',
        content: [documentBlok, { type: 'text', text: INSTRUCTIE }],
      }],
    });

    if (response.stop_reason === 'refusal') {
      return res.status(422).json({ fout: 'Het document kon niet automatisch worden uitgelezen. Vul de velden handmatig in.' });
    }
    if (response.stop_reason === 'max_tokens') {
      return res.status(422).json({ fout: 'Het antwoord was onvolledig. Probeer het opnieuw of upload minder pagina\'s.' });
    }
    const tekstBlok = response.content.find(b => b.type === 'text');
    if (!tekstBlok) {
      return res.status(502).json({ fout: 'Geen resultaat ontvangen van de AI.' });
    }
    return res.status(200).json(JSON.parse(tekstBlok.text));
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ fout: 'Te veel verzoeken. Probeer het over een minuut opnieuw.' });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(500).json({ fout: 'De ANTHROPIC_API_KEY in Vercel is ongeldig.' });
    }
    if (err instanceof Anthropic.BadRequestError) {
      return res.status(400).json({ fout: 'Het document kon niet worden verwerkt (' + err.message + ').' });
    }
    if (err instanceof Anthropic.APIError) {
      return res.status(502).json({ fout: 'De AI-dienst gaf een fout (' + (err.status || '?') + '). Probeer het opnieuw.' });
    }
    if (err instanceof SyntaxError) {
      return res.status(502).json({ fout: 'Het resultaat kon niet worden gelezen. Probeer het opnieuw.' });
    }
    console.error(err);
    return res.status(500).json({ fout: 'Onverwachte fout bij het uitlezen.' });
  }
}
