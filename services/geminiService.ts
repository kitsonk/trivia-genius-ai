import { GoogleGenAI, Type, Modality } from "@google/genai";
import { HostPersonality, TriviaQuestion } from "../types";
import { base64ToBytes, decodeAudioData } from "../utils/audioUtils";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// 1. Search Grounding: Generate Questions
export const generateTriviaQuestions = async (topic: string): Promise<{ questions: TriviaQuestion[], sources: string[] }> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate 5 interesting, fact-checked trivia questions about "${topic}".
      Include the correct answer and a brief context/fun fact for each.
      Ensure the information is up-to-date using Google Search.
      
      Output the result purely as a valid JSON object with the following structure:
      {
        "questions": [
          {
            "question": "string",
            "answer": "string",
            "context": "string"
          }
        ]
      }
      Do not wrap the response in markdown code blocks (like \`\`\`json). Just return the raw JSON string.`,
      config: {
        tools: [{ googleSearch: {} }],
        // Note: responseMimeType and responseSchema are NOT supported when using tools like googleSearch
      },
    });

    let jsonText = response.text;
    if (!jsonText) throw new Error("No data returned");
    
    // Cleanup potential markdown formatting if the model ignores the instruction
    jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const parsed = JSON.parse(jsonText);
    
    // Extract grounding sources
    const sources: string[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach(chunk => {
        if (chunk.web?.uri) {
          sources.push(chunk.web.uri);
        }
      });
    }

    return { questions: parsed.questions, sources: Array.from(new Set(sources)) }; // Unique sources
  } catch (error) {
    console.error("Error generating questions:", error);
    // Fallback questions if search fails or quota issues
    return {
      questions: [
        { question: "What is the capital of France?", answer: "Paris", context: "It is known as the City of Lights." }
      ],
      sources: []
    };
  }
};

// 2. TTS: Generate Speech
export const playTextToSpeech = async (text: string, personality: HostPersonality, audioContext: AudioContext): Promise<void> => {
  // Return a promise that resolves when audio FINISHES playing
  return new Promise(async (resolve) => {
    try {
      // Select voice based on personality
      let voiceName = 'Puck'; // Default
      if (personality === HostPersonality.SARCASTIC_ROBOT) voiceName = 'Kore';
      if (personality === HostPersonality.ENTHUSIASTIC_HOST) voiceName = 'Fenrir';
      if (personality === HostPersonality.STRICT_PROFESSOR) voiceName = 'Charon';
      if (personality === HostPersonality.CHILL_SURFER) voiceName = 'Aoede';

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
         if (audioContext.state === 'closed') {
            resolve();
            return;
         }

        const audioBuffer = await decodeAudioData(
          base64ToBytes(base64Audio),
          audioContext,
          24000,
          1
        );
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        
        // Resolve promise when audio ends
        source.onended = () => {
          resolve();
        };
        
        source.start();
      } else {
        resolve();
      }
    } catch (e) {
      console.error("TTS Error", e);
      resolve(); // Resolve on error so queue doesn't get stuck
    }
  });
};

// 3. Live API Connection Helper
export const connectToLiveSession = async (
  personality: HostPersonality, 
  topic: string, 
  questions: TriviaQuestion[],
  callbacks: {
    onOpen: () => void,
    onMessage: (message: any) => void,
    onClose: () => void,
    onError: (e: any) => void
  }
) => {
  const questionsContext = questions.map((q, i) => 
    `Q${i+1}: ${q.question} (Answer: ${q.answer}. Context: ${q.context})`
  ).join('\n');

  return await ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    callbacks: {
      onopen: callbacks.onOpen,
      onmessage: callbacks.onMessage,
      onclose: callbacks.onClose,
      onerror: callbacks.onError,
    },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
      },
      systemInstruction: `
        You are a trivia host with the personality of a "${personality}".
        The topic is "${topic}".
        You have the following list of 5 questions to ask the user:
        ${questionsContext}
        
        Instructions:
        1. Introduce yourself briefly and the topic.
        2. Ask the questions one by one. Wait for the user to answer verbally.
        3. If they get it right, congratulate them (in character).
        4. If they get it wrong, reveal the answer gently (or sarcastically, depending on personality) and provide the context.
        5. After 5 questions, summarize their performance and say goodbye.
        
        Keep it fun, interactive, and keep the conversation moving.
      `,
    },
  });
};