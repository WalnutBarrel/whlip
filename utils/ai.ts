/**
 * Utility for interfacing with Chrome's built-in Local AI (Gemini Nano)
 * with a graceful fallback for browsers without the experimental flag enabled.
 */

export async function rewriteText(originalText: string): Promise<string> {
  try {
    // 1. Check if the Chrome Built-in AI API is available
    if (typeof (window as any).ai !== 'undefined') {
      const ai = (window as any).ai;
      
      // Some API versions use 'languageModel', some use 'assistant'
      const modelInterface = ai.languageModel || ai.assistant || ai;

      if (typeof modelInterface.create === 'function' || typeof modelInterface.createTextSession === 'function') {
        const createSession = modelInterface.create || modelInterface.createTextSession;
        const session = await createSession.bind(modelInterface)();
        
        const prompt = `Rewrite the following text to make it extremely simple and easy to read, at a 6th-grade reading level. Keep it concise.\n\nText: ${originalText}`;
        const result = await session.prompt(prompt);
        
        // Some early versions require session.destroy(), others use session.clone() etc
        if (typeof session.destroy === 'function') {
          session.destroy();
        }
        
        return result.trim();
      }
    }
  } catch (error) {
    console.error("Local AI failed, falling back to simulated prototype:", error);
  }

  // 2. Fallback: Simulated AI Prototype
  // If the browser doesn't have `window.ai` enabled (no experimental flags),
  // we simulate network latency and return a placeholder to prove the UI works.
  
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve("✨ This text was too complex, so Ghost UI automatically simplified it for you. (Enable Chrome's 'window.ai' flags for real Local AI rewriting!)");
    }, 1500);
  });
}
