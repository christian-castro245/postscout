import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { dokumentId, aufgabe, absender, betreff } = req.body;

  let dokZusammenfassung = '';
  if (dokumentId) {
    const { data } = await supabase
      .from('dokumente')
      .select('zusammenfassung, titel, absender')
      .eq('id', dokumentId)
      .single();
    if (data) dokZusammenfassung = data.zusammenfassung || '';
  }

  const prompt = `Du hilfst älteren Menschen beim Verfassen von Antwortbriefen auf Post.

Aufgabe: ${aufgabe || 'Antwort erforderlich'}
Empfänger/Absender: ${absender || 'Unbekannt'}
Betreff: ${betreff || ''}
${dokZusammenfassung ? `
Zusammenfassung des Dokuments:
${dokZusammenfassung}` : ''}

Schreibe einen höflichen, klaren Antwortbrief auf Deutsch. 
- Beginne mit "Sehr geehrte Damen und Herren," (oder passend zum Absender)
- Halte es kurz und klar (3-5 Sätze)
- Schließe mit "Mit freundlichen Grüßen"
- Kein Name am Ende (wird manuell ergänzt)
- Kein [Platzhalter] verwenden, nur tatsächlich sinnvolle Sätze

Antworte NUR mit dem Brieftext, nichts anderes.`;

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = msg.content[0]?.text || '';
    res.json({ text });
  } catch (err) {
    console.error('generate-reply error:', err);
    res.status(500).json({ error: 'Fehler beim Generieren' });
  }
}
