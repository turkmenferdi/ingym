import type {
  AiProvider,
  PlanContent,
  PlanInputs,
  DailyFeedback,
  DailyFeedbackInputs,
  FoodEstimate,
  FoodImageInput,
} from "./types";

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    nutrition: {
      type: "object",
      properties: {
        dailyNote: { type: "string" },
        meals: {
          type: "array",
          items: {
            type: "object",
            properties: {
              meal: { type: "string" },
              idea: { type: "string" },
              approxCalories: { type: "number" },
            },
            required: ["meal", "idea", "approxCalories"],
          },
        },
      },
      required: ["dailyNote", "meals"],
    },
    workout: {
      type: "array",
      items: {
        type: "object",
        properties: {
          focus: { type: "string" },
          exercises: { type: "array", items: { type: "string" } },
        },
        required: ["focus", "exercises"],
      },
    },
  },
  required: ["summary", "nutrition", "workout"],
};

const FEEDBACK_SCHEMA = {
  type: "object",
  properties: {
    message: { type: "string" },
    tip: { type: "string" },
  },
  required: ["message", "tip"],
};

const FOOD_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    calories: { type: "number" },
    proteinG: { type: "number" },
    fatG: { type: "number" },
    carbsG: { type: "number" },
    note: { type: "string" },
  },
  required: ["name", "calories", "proteinG", "fatG", "carbsG", "note"],
};

const FOOD_PROMPT = [
  "Bu yemek fotoğrafını analiz et. Gördüğün porsiyon için makul bir tahmin yap.",
  "name: yemeğin Türkçe adı. calories: toplam tahmini kalori (kcal). proteinG/fatG/carbsG: gram cinsinden makrolar.",
  "note: 1 cümle kısa açıklama; bunun bir TAHMİN olduğunu ve porsiyona göre değişebileceğini belirt.",
  "Yemek göremiyorsan name='Yemek algılanamadı' ve değerleri 0 ver.",
].join("\n");

function buildFeedbackPrompt(inputs: DailyFeedbackInputs): string {
  const parts = [
    "Bir spor koçu ve diyetisyen olarak, kullanıcının bugünkü günlük kaydına Türkçe, kısa ve motive edici bir geri bildirim ver.",
    inputs.calories > 0
      ? `Hedef: ${inputs.goal}. Günlük kalori hedefi: ${inputs.calories} kcal.`
      : `Hedef: ${inputs.goal}. (Kullanıcının henüz oluşturulmuş bir programı yok.)`,
    `Bugün antrenman yaptı mı: ${inputs.trained ? "evet" : "hayır"}.`,
    inputs.weightKg !== null ? `Bugünkü kilo: ${inputs.weightKg} kg.` : "Kilo girilmedi.",
    inputs.notes ? `Notları: ${inputs.notes}` : "Not yok.",
    "message: 1-2 cümlelik kişisel geri bildirim. tip: yarına dair tek küçük, uygulanabilir öneri.",
  ];
  return parts.join("\n");
}

function buildPrompt(inputs: PlanInputs): string {
  const { targets, skeleton, profile } = inputs;
  const days = skeleton.days.map((d, i) => `${i + 1}. gün: ${d.focus}`).join("\n");
  return [
    "Bir spor koçu ve diyetisyen olarak Türkçe, kişiye özel bir haftalık plan içeriği üret.",
    profile.cautious
      ? "ÖNEMLİ: Kullanıcıda sağlık riski işareti var; önerileri TEMKİNLİ, düşük yoğunluklu tut ve hekime danışmayı hatırlat."
      : "",
    `Hedef: ${profile.goal}. Tecrübe: ${profile.experience}.`,
    `Günlük kalori hedefi: ${targets.calories} kcal (protein ${targets.proteinG}g, yağ ${targets.fatG}g, karbonhidrat ${targets.carbsG}g).`,
    `Antrenman: her egzersiz ${skeleton.setsPerExercise} set, ${skeleton.repRange} tekrar. Günler:`,
    days,
    "Her antrenman günü için 4-6 egzersiz öner. Beslenme için 3-4 öğün fikri ver (yaklaşık kalorileriyle). Kısa ve uygulanabilir ol.",
  ].filter(Boolean).join("\n");
}

export class GeminiProvider implements AiProvider {
  constructor(private apiKey: string | undefined = process.env.GEMINI_API_KEY) {}

  async generatePlanContent(inputs: PlanInputs): Promise<PlanContent | null> {
    if (!this.apiKey) return null;
    try {
      const res = await fetch(`${ENDPOINT}?key=${this.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(inputs) }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;
      return JSON.parse(text) as PlanContent;
    } catch {
      return null;
    }
  }

  async generateDailyFeedback(inputs: DailyFeedbackInputs): Promise<DailyFeedback | null> {
    if (!this.apiKey) return null;
    try {
      const res = await fetch(`${ENDPOINT}?key=${this.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildFeedbackPrompt(inputs) }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: FEEDBACK_SCHEMA,
          },
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;
      return JSON.parse(text) as DailyFeedback;
    } catch {
      return null;
    }
  }

  async estimateFood(input: FoodImageInput): Promise<FoodEstimate | null> {
    if (!this.apiKey) return null;
    try {
      const res = await fetch(`${ENDPOINT}?key=${this.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inlineData: { mimeType: input.mimeType, data: input.imageBase64 } },
                { text: FOOD_PROMPT },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: FOOD_SCHEMA,
          },
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;
      return JSON.parse(text) as FoodEstimate;
    } catch {
      return null;
    }
  }
}
