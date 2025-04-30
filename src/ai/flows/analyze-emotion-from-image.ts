// 'use server';

/**
 * @fileOverview Detects the predominant emotion in an image.
 *
 * - analyzeEmotionFromImage - A function that analyzes an image and detects the predominant emotion.
 * - AnalyzeEmotionFromImageInput - The input type for the analyzeEmotionFromImage function.
 * - AnalyzeEmotionFromImageOutput - The return type for the analyzeEmotionFromImage function.
 */

'use server';

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const AnalyzeEmotionFromImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo containing faces, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type AnalyzeEmotionFromImageInput = z.infer<typeof AnalyzeEmotionFromImageInputSchema>;

const AnalyzeEmotionFromImageOutputSchema = z.object({
  emotion: z.string().describe('The predominant emotion detected in the image.'),
  confidence: z.number().describe('The confidence score of the detected emotion (0-1).'),
});
export type AnalyzeEmotionFromImageOutput = z.infer<typeof AnalyzeEmotionFromImageOutputSchema>;

export async function analyzeEmotionFromImage(input: AnalyzeEmotionFromImageInput): Promise<AnalyzeEmotionFromImageOutput> {
  return analyzeEmotionFromImageFlow(input);
}

const analyzeEmotionPrompt = ai.definePrompt({
  name: 'analyzeEmotionPrompt',
  input: {
    schema: z.object({
      photoDataUri: z
        .string()
        .describe(
          "A photo containing faces, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
        ),
    }),
  },
  output: {
    schema: z.object({
      emotion: z.string().describe('The predominant emotion detected in the image.'),
      confidence: z.number().describe('The confidence score of the detected emotion (0-1).'),
    }),
  },
  prompt: `You are an AI trained to detect emotions in images of faces. Analyze the image and determine the predominant emotion expressed in the faces.

  Respond with only the emotion and a confidence score (0-1) of your analysis.
  
  Photo: {{media url=photoDataUri}}
  `,
});

const analyzeEmotionFromImageFlow = ai.defineFlow<
  typeof AnalyzeEmotionFromImageInputSchema,
  typeof AnalyzeEmotionFromImageOutputSchema
>({
  name: 'analyzeEmotionFromImageFlow',
  inputSchema: AnalyzeEmotionFromImageInputSchema,
  outputSchema: AnalyzeEmotionFromImageOutputSchema,
}, async input => {
  const {output} = await analyzeEmotionPrompt(input);
  return output!;
});
