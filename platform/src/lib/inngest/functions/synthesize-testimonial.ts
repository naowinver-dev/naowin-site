import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { generateTestimonialSynthesis } from "@/lib/anthropic";

export const synthesizeTestimonial = inngest.createFunction(
  { id: "synthesize-testimonial" },
  { event: "testimonial/answers.transcribed" },
  async ({ event, step }) => {
    const { testimonialId } = event.data as { testimonialId: string };

    const testimonial = await step.run("load-testimonial", () =>
      prisma.testimonial.findUniqueOrThrow({
        where: { id: testimonialId },
        include: {
          company: true,
          answers: { include: { question: true }, orderBy: { question: { orderIndex: "asc" } } },
        },
      }),
    );

    const synthesis = await step.run("generate-synthesis", () =>
      generateTestimonialSynthesis(
        testimonial.company.name,
        testimonial.answers.map((a) => ({
          phase: a.question.phase,
          question: a.question.promptText,
          transcript: a.transcriptText ?? "",
        })),
      ),
    );

    await step.run("save-synthesis", () =>
      prisma.testimonial.update({
        where: { id: testimonialId },
        data: { synthesisText: synthesis },
      }),
    );
  },
);
