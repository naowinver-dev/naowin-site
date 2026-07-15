import { requireCompanyUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createQuestion } from "../actions";

const PHASE_LABELS: Record<string, string> = {
  PROBLEM: "Problème initial",
  EXPERIENCE: "Expérience vécue",
  RESULT: "Résultat concret",
  RECOMMENDATION: "Recommandation",
};

export default async function QuestionsPage() {
  const companyUser = await requireCompanyUser();

  const questions = await prisma.question.findMany({
    where: { companyId: companyUser.companyId, active: true },
    orderBy: { orderIndex: "asc" },
  });

  return (
    <div>
      <h1>Questions posées au client</h1>
      <p>Structurées en 4 temps narratifs. Modifier une question crée une nouvelle version — les témoignages déjà collectés gardent la question telle qu&apos;elle était posée.</p>
      <ul>
        {questions.map((q) => (
          <li key={q.id} style={{ marginBottom: 12 }}>
            <strong>{PHASE_LABELS[q.phase]}</strong> — {q.promptText}{" "}
            <span style={{ color: "#8a7a63" }}>({q.minDurationSeconds}s min)</span>
          </li>
        ))}
      </ul>

      <h2>Ajouter une question</h2>
      <form action={createQuestion}>
        <label>
          Temps narratif
          <select name="phase" required>
            {Object.entries(PHASE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <br />
        <label>
          Texte de la question
          <input name="promptText" required style={{ display: "block", width: "100%" }} />
        </label>
        <button type="submit" style={{ marginTop: 8 }}>
          Ajouter
        </button>
      </form>
    </div>
  );
}
