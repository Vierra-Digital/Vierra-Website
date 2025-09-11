import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

// Function to upload image to URL generator service
async function uploadImageToUrlGenerator(b64Image: string, platform: string) {
  try {
    const response = await fetch(process.env.URL_GENERATOR_ENDPOINT || '', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.URL_GENERATOR_TOKEN}`
      },
      body: JSON.stringify({
        b64: b64Image,
        ext: 'png'
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`[${platform}] Image uploaded to URL generator:`, {
        id: result.id,
        url: result.url,
        expires_in_seconds: result.expires_in_seconds
      });
      return result;
    } else {
      console.error(`[${platform}] Failed to upload image to URL generator:`, response.status, response.statusText);
      return null;
    }
  } catch (error) {
    console.error(`[${platform}] Error uploading image to URL generator:`, error);
    return null;
  }
}

// Prompt IDs for each platform and content type
const PROMPT_IDS = {
  instagram: {
    image: { id: "pmpt_689771914cc081978da7c0d0994b42c806c62650fedaedc3", version: "5" },
    caption: { id: "pmpt_68975a3b97148197908332368c48010b0509e5bdcf7b9b8d", version: "2" }
  },
  facebook: {
    image: { id: "pmpt_68976a171f7881948fbb508b495d5fb7062e4ca49780f059", version: "7" },
    caption: { id: "pmpt_689759d94d908196861f9c220d307b8703c0ad84133b3fcd", version: "3" }
  },
  linkedin: {
    image: { id: "pmpt_689771e5b4a081969b18ec66936f527301f248411dd6927f", version: "5" },
    caption: { id: "pmpt_68975a60fe6481909c356bf5c783464e01f59f629764062a", version: "2" }
  },
  googleads: {
    image: { id: "pmpt_689771914cc081978da7c0d0994b42c806c62650fedaedc3", version: "5" }, // Using Instagram image as fallback
    caption: { id: "pmpt_68975a3b97148197908332368c48010b0509e5bdcf7b9b8d", version: "2" } // Using Instagram caption as fallback
  }
};

export async function generateImage(platform: string, includeContext: boolean = false, imageUrls?: string[], userId?: number) {
  
  try {
    if (!userId) {
      throw new Error('User ID is required for database storage');
    }

    const promptConfig = PROMPT_IDS[platform as keyof typeof PROMPT_IDS]?.image;
    if (!promptConfig) {
      throw new Error(`No image prompt configuration found for platform: ${platform}`);
    }

    // Get the latest website analysis from database
    const analysis = await prisma.websiteAnalysis.findFirst({
      where: { userId },
      orderBy: { timestamp: 'desc' }
    });

    if (!analysis) {
      throw new Error('No website analysis found. Please run website analysis first.');
    }

    let fullAnalysis = analysis.analysis;
    console.log('Using analysis from database for image generation:', fullAnalysis.substring(0, 200) + '...');

    // Get additional context if requested
    let additionalContext = '';
    
    if (includeContext) {
      const context = await prisma.clientContext.findFirst({
        where: { 
          userId,
          isActive: true 
        },
        orderBy: { updatedAt: 'desc' }
      });
      
      if (context) {
        additionalContext = context.context.trim();
        console.log('Using context from database for image generation:', additionalContext);
      }
    }

    // Build the user message content array
    const userMessageContent = [];
    
    // Add text content (context + analysis)
    let textContent = '';
    if (includeContext && additionalContext) {
      textContent = `${additionalContext}\n\nWebsite Analysis:\n${fullAnalysis}`;
    } else {
      textContent = fullAnalysis;
    }
    
    userMessageContent.push({
      type: "input_text",
      text: textContent
    });
    
    // Add image content if provided (up to 3 images)
    if (imageUrls && imageUrls.length > 0) {
      const maxImages = Math.min(imageUrls.length, 3); // Limit to 3 images
      console.log(`Including ${maxImages} uploaded images in image generation`);
      
      for (let i = 0; i < maxImages; i++) {
        userMessageContent.push({
          type: "input_image",
          image_url: imageUrls[i]
        });
      }
    }
    
    console.log('Final user message content for image generation:', JSON.stringify(userMessageContent, null, 2));

    const response = await openai.responses.create({
      prompt: {
        id: promptConfig.id,
        version: promptConfig.version,
      },
      input: [
        { role: "user", content: userMessageContent }
      ]
    } as any);

    console.log('Image generation response:', JSON.stringify(response, null, 2));

    // Extract the image data from the response (same as website analysis connection file)
    const b64Image = (response.output[0] as any).result;

    // Upload the image to the URL generator service
    const uploadedImage = await uploadImageToUrlGenerator(b64Image, platform);

    // Save to database
    const generatedContent = await prisma.generatedContent.create({
      data: {
        userId,
        platform,
        contentType: 'image',
        content: b64Image,
        urlLink: uploadedImage?.url || null,
        metadata: {
          promptId: promptConfig.id,
          promptVersion: promptConfig.version,
          includeContext,
          imageUrls: imageUrls || [],
          uploadedImageUrl: uploadedImage?.url || null
        }
      }
    });

    console.log('Image content saved to database successfully');
    console.log('Content ID:', generatedContent.id);

    return {
      success: true,
      imagePath: `/api/content/${generatedContent.id}/image`,
      contentId: generatedContent.id,
      urlLink: uploadedImage?.url || null
    };

  } catch (error) {
    console.error('Image generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

export async function generateCaption(platform: string, includeContext: boolean = false, imageUrls?: string[], userId?: number) {
  
  try {
    if (!userId) {
      throw new Error('User ID is required for database storage');
    }

    const promptConfig = PROMPT_IDS[platform as keyof typeof PROMPT_IDS]?.caption;
    if (!promptConfig) {
      throw new Error(`No caption prompt configuration found for platform: ${platform}`);
    }

    // Get the latest website analysis from database
    const analysis = await prisma.websiteAnalysis.findFirst({
      where: { userId },
      orderBy: { timestamp: 'desc' }
    });

    if (!analysis) {
      throw new Error('No website analysis found. Please run website analysis first.');
    }

    let fullAnalysis = analysis.analysis;
    console.log('Using analysis from database for caption generation:', fullAnalysis.substring(0, 200) + '...');

    // Get additional context if requested
    let additionalContext = '';
    
    if (includeContext) {
      const context = await prisma.clientContext.findFirst({
        where: { 
          userId,
          isActive: true 
        },
        orderBy: { updatedAt: 'desc' }
      });
      
      if (context) {
        additionalContext = context.context.trim();
        console.log('Using context from database for caption generation:', additionalContext);
      }
    }

    // Build the user message content array
    const userMessageContent = [];
    
    // Add text content (context + analysis)
    let textContent = '';
    if (includeContext && additionalContext) {
      textContent = `${additionalContext}\n\nWebsite Analysis:\n${fullAnalysis}`;
    } else {
      textContent = fullAnalysis;
    }
    
    userMessageContent.push({
      type: "input_text",
      text: textContent
    });
    
    // Add image content if provided (up to 3 images)
    if (imageUrls && imageUrls.length > 0) {
      const maxImages = Math.min(imageUrls.length, 3); // Limit to 3 images
      console.log(`Including ${maxImages} uploaded images in caption generation`);
      
      for (let i = 0; i < maxImages; i++) {
        userMessageContent.push({
          type: "input_image",
          image_url: imageUrls[i]
        });
      }
    }
    
    console.log('Final user message content for caption generation:', JSON.stringify(userMessageContent, null, 2));

    const response = await openai.responses.create({
      prompt: {
        id: promptConfig.id,
        version: promptConfig.version,
      },
      input: [
        { role: "user", content: userMessageContent }
      ]
    } as any);

    console.log('Caption generation response:', JSON.stringify(response, null, 2));

    // Extract the caption text from the response
    let captionText = "No caption generated";
    
    if (response.output && response.output.length > 1) {
      const messageOutput = response.output[1];
      if (messageOutput.type === 'message' && messageOutput.content && messageOutput.content.length > 0) {
        const textContent = messageOutput.content[0];
        if (textContent.type === 'output_text' && textContent.text) {
          captionText = textContent.text;
        }
      }
    }

    // Save to database
    const generatedContent = await prisma.generatedContent.create({
      data: {
        userId,
        platform,
        contentType: 'caption',
        content: captionText,
        metadata: {
          promptId: promptConfig.id,
          promptVersion: promptConfig.version,
          includeContext,
          imageUrls: imageUrls || []
        }
      }
    });

    console.log('Caption content saved to database successfully');
    console.log('Content ID:', generatedContent.id);

    return {
      success: true,
      caption: captionText,
      contentId: generatedContent.id
    };

  } catch (error) {
    console.error('Caption generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}
