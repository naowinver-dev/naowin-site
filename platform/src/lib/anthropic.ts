import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const MODEL = "claude-opus-4-8";

export interface SynthesisAnswer {
  phase: "PROBLEM" | "EXPERIENCE" | "RESULT" | "RECOMMENDATION";
  question: string;
  transcript: string;
}

/**
 * Génère la synthèse écrite d'un témoignage à partir des transcripts de
 * chaque réponse. Le style doit rester fidèle aux mots du client — la
 * synthèse est une mise en forme, pas une réécriture commerciale.
 */
export async function generateTestimonialSynthesis(
  companyName: string,
  answers: SynthesisAnswer[],
): Promise<string> {
  const transcriptBlock = answers
    .map((a) => `[${a.phase}] ${a.question}\nRéponse : ${a.transcript}`)
    .join("\n\n");

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      "Tu rédiges des synthèses de témoignages clients pour une plateforme de collecte d'avis vidéo. " +
      "Tu reçois les transcripts des réponses d'un client à 4 questions structurées (problème initial, " +
      "expérience vécue, résultat concret, recommandation). Rédige une synthèse fidèle, à la première " +
      "personne, en français, de 4 à 6 phrases. N'invente aucun fait, aucun chiffre, aucun détail absent " +
      "des transcripts. Ne survends pas : si le client formule des réserves, elles doivent apparaître. " +
      "Ne mentionne jamais le nom de la plateforme, uniquement le vécu du client.",
    messages: [
      {
        role: "user",
        content: `Entreprise concernée : ${companyName}\n\nTranscripts :\n\n${transcriptBlock}`,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Anthropic response contained no text block");
  }
  return textBlock.text.trim();
}
