import { GoogleGenAI, Type } from '@google/genai';
import { buildSystemPrompt } from './memoryContext';

const apiKey = typeof process !== 'undefined' && process.env ? process.env.GEMINI_API_KEY : (import.meta as any).env?.VITE_GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey || '' });

export interface DiagnosisData {
  problem: string | null;
  cause: string | null;
  severity: 'low' | 'medium' | 'high' | null;
  product_applied: string | null;
  product_category: string | null;
  dosage: string | null;
  application_method: string | null;
}

export interface AiResponseJson {
  response_text: string;
  intent: 'diagnosis' | 'advice' | 'followup' | 'general' | 'unclear';
  crop_mentioned: string | null;
  field_scope: 'specific' | 'general';
  question_count: number;
  has_banned_opener: boolean;
  diagnosis_data: DiagnosisData | null;
}

export function validateResponse(json: AiResponseJson, hasActiveField: boolean): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (json.question_count > 1) {
    errors.push("question_count > 1: AI asks more than one question.");
  }
  if (json.has_banned_opener) {
    errors.push("has_banned_opener == true: Response starts with a banned opener (e.g., 'Great question!', 'Certainly!', 'Of course!').");
  }
  if (hasActiveField && json.field_scope !== 'specific') {
    errors.push("field_scope must be 'specific' because an active field exists.");
  }
  if (!json.response_text || json.response_text.trim() === '') {
    errors.push("response_text is empty.");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export interface ChatMessage {
  role: string;
  content: string;
  images?: { mimeType: string; data: string }[];
}

export function sanitizeAssistantText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function generateValidatedResponse(
  messages: ChatMessage[],
  fieldContext: string,
  hasActiveField: boolean
): Promise<AiResponseJson | null> {
  if (!apiKey) {
    console.error('Missing Gemini API key. Set GEMINI_API_KEY or VITE_GEMINI_API_KEY.');
    return null;
  }

  const systemInstruction = buildSystemPrompt(fieldContext);

  const schema = {
    type: Type.OBJECT,
    properties: {
      response_text: { type: Type.STRING },
      intent: { type: Type.STRING, enum: ['diagnosis', 'advice', 'followup', 'general', 'unclear'] },
      crop_mentioned: { type: Type.STRING, nullable: true },
      field_scope: { type: Type.STRING, enum: ['specific', 'general'] },
      question_count: { type: Type.INTEGER },
      has_banned_opener: { type: Type.BOOLEAN },
      diagnosis_data: {
        type: Type.OBJECT,
        nullable: true,
        properties: {
          problem: { type: Type.STRING, nullable: true },
          cause: { type: Type.STRING, nullable: true },
          severity: { type: Type.STRING, enum: ['low', 'medium', 'high'], nullable: true },
          product_applied: { type: Type.STRING, nullable: true },
          product_category: { type: Type.STRING, nullable: true },
          dosage: { type: Type.STRING, nullable: true },
          application_method: { type: Type.STRING, nullable: true }
        }
      }
    },
    required: ["response_text", "intent", "field_scope", "question_count", "has_banned_opener"]
  };

  const callGemini = async (extraInstruction?: string) => {
    const contents = messages.map(m => {
      const parts: any[] = [{ text: m.content }];
      if (m.images && m.images.length > 0) {
        m.images.forEach(img => {
          parts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: img.data
            }
          });
        });
      }
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts
      };
    });

    if (extraInstruction) {
      contents[contents.length - 1].parts[0].text += `\n\n[SYSTEM: ${extraInstruction}]`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: schema as any
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as AiResponseJson;
    }
    return null;
  };

  try {
    let json = await callGemini();
    if (!json) return null;
    json = {
      ...json,
      response_text: sanitizeAssistantText(json.response_text),
    };

    const validation = validateResponse(json, hasActiveField);
    if (!validation.valid) {
      // Auto-repair
      const repairInstruction = `Your previous response failed validation with these errors: ${validation.errors.join(' ')}. Please correct them and return a valid JSON.`;
      const repairedJson = await callGemini(repairInstruction);
      if (repairedJson) {
        json = {
          ...repairedJson,
          response_text: sanitizeAssistantText(repairedJson.response_text),
        };
      }
    }

    return json;
  } catch (e) {
    console.error("Error generating validated response:", e);
    return null;
  }
}
