import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

export async function analyzeWebsite(websiteUrl: string, userId: number) {
  try {
    const userMessage = `Analyze this website: ${websiteUrl}`;

    const response = await openai.responses.create({
      prompt: {
        id: "pmpt_6892a13fa5988193860a013f3820912200b3514e7f51f572", //website analysis prompt id
        version: "4",
      },
      input: [
        { role: "user", content: userMessage }
      ]
    } as any);

    console.log('Full response:', JSON.stringify(response, null, 2));

    // Extract the analysis text from the response (same as caption generation)
    let analysisResult = "No analysis result available";
    
    if (response.output && response.output.length > 1) {
      const messageOutput = response.output[1];
      if (messageOutput.type === 'message' && messageOutput.content && messageOutput.content.length > 0) {
        const textContent = messageOutput.content[0];
        if (textContent.type === 'output_text' && textContent.text) {
          analysisResult = textContent.text;
        }
      }
    }
    
    console.log('Extracted result:', analysisResult);

    // Save to database instead of file
    const timestamp = new Date();
    const analysis = await prisma.websiteAnalysis.create({
      data: {
        userId,
        websiteUrl,
        analysis: analysisResult,
        timestamp,
        metadata: {
          promptId: "pmpt_6892a13fa5988193860a013f3820912200b3514e7f51f572",
          promptVersion: "4",
          responseType: "website_analysis"
        }
      }
    });

    console.log('Analysis saved to database successfully');
    console.log('Analysis ID:', analysis.id);

    return {
      success: true,
      result: analysisResult,
      timestamp: timestamp.toISOString(),
      analysisId: analysis.id
    };

  } catch (error) {
    console.error('Website analysis error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}
