import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { transcribeAnswer } from "@/lib/inngest/functions/transcribe-answer";
import { synthesizeTestimonial } from "@/lib/inngest/functions/synthesize-testimonial";
import { retentionCleanup } from "@/lib/inngest/functions/retention-cleanup";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [transcribeAnswer, synthesizeTestimonial, retentionCleanup],
});
