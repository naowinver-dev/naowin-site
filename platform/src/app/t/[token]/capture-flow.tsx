"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "PROBLEM" | "EXPERIENCE" | "RESULT" | "RECOMMENDATION";

interface Question {
  id: string;
  phase: Phase;
  promptText: string;
  minDurationSeconds: number;
  orderIndex: number;
}

interface SessionData {
  status: string;
  company: { name: string; logoUrl: string | null; brandColor: string | null };
  questions: Question[];
  consentTextVersion: number;
}

interface ReviewAnswer {
  id: string;
  phase: Phase;
  question: string;
  transcript: string | null;
  qualityCheckPassed: boolean;
}

type Step =
  | "loading"
  | "error"
  | "consent"
  | "recording"
  | "processing"
  | "review"
  | "reward";

const SILENCE_RMS_THRESHOLD = 0.02;

export function CaptureFlow({ token }: { token: string }) {
  const [step, setStep] = useState<Step>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [retakeMessage, setRetakeMessage] = useState<string | null>(null);
  const [review, setReview] = useState<{ synthesisText: string; answers: ReviewAnswer[] } | null>(null);
  const [reward, setReward] = useState<{ code: string; type: string; value: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/capture/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Ce lien n'est plus disponible.");
        }
        return res.json();
      })
      .then((data: SessionData) => {
        setSession(data);
        setStep("consent");
      })
      .catch((err: Error) => {
        setErrorMessage(err.message);
        setStep("error");
      });
  }, [token]);

  async function handleConsent() {
    setIsBusy(true);
    try {
      const res = await fetch(`/api/capture/${token}/consent`, { method: "POST" });
      if (!res.ok) throw new Error("Impossible d'enregistrer votre consentement.");
      setStep("recording");
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleAnswerRecorded(question: Question, blob: Blob, durationSeconds: number, hasSpeech: boolean) {
    if (durationSeconds < question.minDurationSeconds || !hasSpeech) {
      setRetakeMessage(
        !hasSpeech
          ? "On n'a pas bien entendu votre réponse — voulez-vous la refaire ?"
          : `Une réponse un peu plus longue nous aiderait (au moins ${question.minDurationSeconds}s). On refait ?`,
      );
      return;
    }
    setRetakeMessage(null);
    setErrorMessage(null);
    setIsBusy(true);
    try {
      const uploadRes = await fetch(`/api/capture/${token}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id }),
      });
      if (!uploadRes.ok) throw new Error("Envoi impossible, réessayez.");
      const { answerId, uploadUrl } = await uploadRes.json();

      const form = new FormData();
      form.append("file", blob, "answer.webm");
      await fetch(uploadUrl, { method: "POST", body: form });

      await fetch(`/api/capture/${token}/answers/${answerId}/duration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationSeconds }),
      });

      if (session && questionIndex + 1 < session.questions.length) {
        setQuestionIndex((i) => i + 1);
      } else {
        setStep("processing");
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    if (step !== "processing") return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/capture/${token}/status`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.ready) {
        setReview({ synthesisText: data.synthesisText, answers: data.answers });
        setStep("review");
        clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [step, token]);

  async function handleValidate() {
    setIsBusy(true);
    try {
      const res = await fetch(`/api/capture/${token}/submit`, { method: "POST" });
      if (!res.ok) throw new Error("Impossible de valider votre témoignage.");
      const data = await res.json();
      setReward(data);
      setStep("reward");
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsBusy(false);
    }
  }

  if (step === "loading") return <Centered>Chargement…</Centered>;
  if (step === "error") return <Centered>{errorMessage ?? "Une erreur est survenue."}</Centered>;

  if (step === "consent" && session) {
    return (
      <Centered>
        <h1>Un mot pour {session.company.name} ?</h1>
        <p>
          Vous allez enregistrer une courte vidéo (webcam ou caméra frontale) en répondant à
          quelques questions. Votre témoignage pourra être publié par {session.company.name} sur
          son site et ses supports de communication.
        </p>
        <p>
          Nous avons besoin d&apos;accéder à votre caméra et votre micro. Vos données sont traitées
          conformément à notre politique de confidentialité et au RGPD.
        </p>
        <button disabled={isBusy} onClick={handleConsent}>
          J&apos;accepte et je continue
        </button>
      </Centered>
    );
  }

  if (step === "recording" && session) {
    const question = session.questions[questionIndex];
    if (!question) return <Centered>Une erreur est survenue.</Centered>;
    return (
      <Centered>
        <p>
          Question {questionIndex + 1} / {session.questions.length}
        </p>
        <h2>{question.promptText}</h2>
        {retakeMessage && <p style={{ color: "#9d2131" }}>{retakeMessage}</p>}
        {errorMessage && <p style={{ color: "#9d2131" }}>{errorMessage}</p>}
        {isBusy && <p>Envoi en cours…</p>}
        <Recorder
          minDurationSeconds={question.minDurationSeconds}
          disabled={isBusy}
          onRecorded={(blob, duration, hasSpeech) =>
            handleAnswerRecorded(question, blob, duration, hasSpeech)
          }
        />
      </Centered>
    );
  }

  if (step === "processing") {
    return <Centered>Nous préparons la synthèse de votre témoignage…</Centered>;
  }

  if (step === "review" && review) {
    return (
      <Centered>
        <h2>Relisez votre témoignage</h2>
        <p style={{ fontStyle: "italic" }}>{review.synthesisText}</p>
        <ul>
          {review.answers.map((a) => (
            <li key={a.id}>
              <strong>{a.question}</strong>
              <p>{a.transcript}</p>
            </li>
          ))}
        </ul>
        <button disabled={isBusy} onClick={handleValidate}>
          Je valide mon témoignage
        </button>
      </Centered>
    );
  }

  if (step === "reward" && reward) {
    return (
      <Centered>
        <h2>Merci pour votre témoignage !</h2>
        <p>Voici votre code de réduction pour votre prochaine prestation :</p>
        <p style={{ fontSize: 28, fontWeight: 700 }}>{reward.code}</p>
      </Centered>
    );
  }

  return null;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "48px 24px" }}>
      {children}
    </main>
  );
}

function Recorder({
  minDurationSeconds,
  disabled,
  onRecorded,
}: {
  minDurationSeconds: number;
  disabled: boolean;
  onRecorded: (blob: Blob, durationSeconds: number, hasSpeech: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const maxRmsRef = useRef(0);
  const startedAtRef = useRef(0);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: true })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        /* l'utilisateur a refusé l'accès — le bouton restera inactif */
      });
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;

    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    maxRmsRef.current = 0;

    const sampleLoop = () => {
      if (!recorderRef.current || recorderRef.current.state !== "recording") return;
      analyser.getByteTimeDomainData(data);
      let sumSquares = 0;
      for (const sample of data) {
        const normalized = (sample - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / data.length);
      if (rms > maxRmsRef.current) maxRmsRef.current = rms;
      requestAnimationFrame(sampleLoop);
    };

    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      audioCtx.close();
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const durationSeconds = (Date.now() - startedAtRef.current) / 1000;
      const hasSpeech = maxRmsRef.current > SILENCE_RMS_THRESHOLD;
      onRecorded(blob, durationSeconds, hasSpeech);
    };

    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    recorder.start();
    setIsRecording(true);
    requestAnimationFrame(sampleLoop);
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setIsRecording(false);
  }

  return (
    <div>
      <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", borderRadius: 12 }} />
      <div style={{ marginTop: 16 }}>
        {!isRecording ? (
          <button disabled={disabled} onClick={startRecording}>
            Démarrer l&apos;enregistrement
          </button>
        ) : (
          <button disabled={disabled} onClick={stopRecording}>
            Terminer ({minDurationSeconds}s minimum)
          </button>
        )}
      </div>
    </div>
  );
}
