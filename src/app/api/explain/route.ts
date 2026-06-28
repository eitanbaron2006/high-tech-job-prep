import { NextResponse } from "next/server";
import { ai, getModelName } from "../../../lib/gemini";
import {
  buildExplainGenerationConfig,
  buildExplainSystemInstruction,
  ensureExplanationComplete,
  isExplanationTruncated,
  stripLeadingAcknowledgement,
} from "./explain-helpers";

export async function POST(req: Request) {
  try {
    const { selectedText, contextTitle } = await req.json();
    if (!selectedText) {
      return NextResponse.json({ error: "No text selected" }, { status: 400 });
    }

    const systemInstruction = buildExplainSystemInstruction(contextTitle);

    const prompt = `הטקסט שסימנתי ולא הבנתי הוא:\n"${selectedText}"\nאנא הסבר לי אותו בצורה ברורה וידידותית יותר.`;

    let response = await ai.models.generateContent({
      model: getModelName("gemini-2.5-flash"),
      contents: prompt,
      config: {
        systemInstruction,
        ...buildExplainGenerationConfig(),
      },
    });

    if (isExplanationTruncated(response)) {
      console.warn("[Explain] Gemini response hit max output tokens, retrying with larger budget.");
      response = await ai.models.generateContent({
        model: getModelName("gemini-2.5-flash"),
        contents: `${prompt}\n\nחשוב: כתוב תשובה שלמה, קצרה ומסודרת. אל תעצור באמצע משפט.`,
        config: {
          systemInstruction,
          ...buildExplainGenerationConfig(true),
        },
      });
    }

    ensureExplanationComplete(response);

    return NextResponse.json({ explanation: stripLeadingAcknowledgement(response.text || "") });
  } catch (error: any) {
    console.error("Error in explain:", error);
    return NextResponse.json({ error: error.message || "Failed to generate explanation" }, { status: 500 });
  }
}
