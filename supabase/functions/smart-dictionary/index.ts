/**
 * smart-dictionary Edge Function
 * ===============================
 * Produces CEFR-calibrated dictionary entries via OpenAI gpt-4o-mini.
 *
 * Input:  { word: string, grade: number (1-8) }
 * Output: DictEntry[] matching the frontend interface
 *
 * Secrets required (Supabase Dashboard → Edge Functions → Secrets):
 *   OPENAI_API_KEY
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── Grade → CEFR prompt constraints (mirrors src/lib/cefrMapping.ts) ───

interface CEFRConstraint {
  level: string;
  vocabCeiling: number;
  prompt: string;
}

const CEFR_MAP: Record<number, CEFRConstraint> = {
  1: {
    level: "Pre-A1",
    vocabCeiling: 300,
    prompt:
      "Use only the 300 most common English words. " +
      "Definitions must be 1 short sentence (max 8 words). " +
      "Example sentences must be 3-6 words using simple present tense. " +
      "Avoid abstract concepts; use concrete, visible things a 6-year-old understands.",
  },
  2: {
    level: "Pre-A1",
    vocabCeiling: 400,
    prompt:
      "Use only the 400 most common English words. " +
      "Definitions must be 1 short sentence (max 10 words). " +
      "Example sentences must be 4-7 words using simple present tense. " +
      "Avoid abstract concepts; use concrete, visible things a 7-year-old understands.",
  },
  3: {
    level: "A1",
    vocabCeiling: 500,
    prompt:
      "Use only the 500 most common English words. " +
      "Definitions must be 1-2 simple sentences (max 12 words each). " +
      "Example sentences must be 5-8 words. " +
      "Use only simple present and present continuous tenses. " +
      "Avoid idioms or figurative language.",
  },
  4: {
    level: "A1",
    vocabCeiling: 800,
    prompt:
      "Use vocabulary within the A1 CEFR word list (~800 headwords). " +
      "Definitions should be 1-2 clear sentences (max 15 words each). " +
      "Example sentences should be 6-10 words. " +
      "Simple present, present continuous, simple past are acceptable. " +
      "No idioms or phrasal verbs with non-literal meanings.",
  },
  5: {
    level: "A2",
    vocabCeiling: 1200,
    prompt:
      "Use vocabulary within the A2 CEFR word list (~1200 headwords). " +
      "Definitions should be 1-2 sentences (max 18 words each). " +
      "Example sentences should be 7-12 words. " +
      "All basic tenses are acceptable. " +
      "May include common phrasal verbs (get up, look for) but no idioms.",
  },
  6: {
    level: "A2",
    vocabCeiling: 1500,
    prompt:
      "Use vocabulary within the A2-B1 CEFR word list (~1500 headwords). " +
      "Definitions should be concise (1-2 sentences, max 20 words each). " +
      "Example sentences 8-14 words. " +
      "All tenses including present perfect are acceptable. " +
      "Common phrasal verbs and collocations are fine.",
  },
  7: {
    level: "A2-B1",
    vocabCeiling: 2000,
    prompt:
      "Use vocabulary within the B1 CEFR word list (~2000 headwords). " +
      "Definitions can be 1-2 sentences of natural academic English. " +
      "Example sentences 8-16 words. " +
      "All tenses, passive voice, and reported speech are acceptable. " +
      "Moderate use of linking words (however, although).",
  },
  8: {
    level: "B1",
    vocabCeiling: 2500,
    prompt:
      "Use vocabulary within the B1 CEFR word list (~2500 headwords). " +
      "Definitions should be precise and natural. " +
      "Example sentences can be full complex sentences (up to 18 words). " +
      "All grammar structures are acceptable. " +
      "Common idioms and phrasal verbs are fine.",
  },
};

function getConstraint(grade: number): CEFRConstraint {
  if (grade >= 1 && grade <= 8) return CEFR_MAP[grade];
  return CEFR_MAP[3]; // fallback
}

// ─── Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { word, grade } = await req.json();

    if (!word || typeof word !== "string") {
      return new Response(
        JSON.stringify({ error: "word is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const gradeNum = Number(grade) || 3;
    const cefr = getConstraint(gradeNum);

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) {
      console.error(
        "OPENAI_API_KEY is not configured in edge function secrets."
      );
      // Graceful fallback — proxy to free dictionary API instead of hard-failing
      return await freeDictionaryFallback(word);
    }

    // ── Build the CEFR-calibrated system prompt ──
    const systemPrompt = `You are an expert ESL dictionary designed for Vietnamese public school students.
The student is in Grade ${gradeNum} (CEFR level: ${cefr.level}, vocabulary ceiling: ~${cefr.vocabCeiling} headwords).

LANGUAGE CONSTRAINTS — follow these strictly:
${cefr.prompt}

TASK:
Provide a dictionary entry for the word the user sends.
Each definition MUST include an example sentence.
Include IPA phonetic transcription.

Respond ONLY with a valid JSON object in this exact structure:
{
  "entries": [
    {
      "word": "the word",
      "phonetic": "/IPA phonetic/",
      "meanings": [
        {
          "partOfSpeech": "noun",
          "definitions": [
            {
              "definition": "CEFR-appropriate definition.",
              "example": "CEFR-appropriate example sentence."
            }
          ]
        }
      ]
    }
  ]
}

Rules:
- Include up to 2 parts of speech if the word is commonly used in multiple ways.
- Include up to 2 definitions per part of speech.
- Every definition MUST have an example sentence.
- The JSON must be valid. No markdown, no commentary.`;

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + openAiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: word.trim().toLowerCase() },
          ],
          temperature: 0.2,
          max_tokens: 600,
          response_format: { type: "json_object" },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI API error:", errText);
      // Fallback to free dictionary
      return await freeDictionaryFallback(word);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return await freeDictionaryFallback(word);
    }

    let result;
    try {
      const parsed = JSON.parse(content);
      // Extract the entries array from the json_object response
      if (Array.isArray(parsed)) {
        result = parsed;
      } else if (parsed?.entries && Array.isArray(parsed.entries)) {
        result = parsed.entries;
      } else {
        // Try to find any array property
        const arrayKey = Object.keys(parsed).find((k) =>
          Array.isArray(parsed[k])
        );
        result = arrayKey ? parsed[arrayKey] : [parsed];
      }
    } catch (e) {
      console.error("Failed to parse AI JSON:", e, content);
      return await freeDictionaryFallback(word);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("smart-dictionary error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// ─── Fallback: Free Dictionary API ──────────────────────────────────────

async function freeDictionaryFallback(word: string): Promise<Response> {
  try {
    const res = await fetch(
      "https://api.dictionaryapi.dev/api/v2/entries/en/" +
        encodeURIComponent(word.trim().toLowerCase())
    );
    if (res.ok) {
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch {
    /* silent */
  }
  return new Response(
    JSON.stringify({ error: "Word not found" }),
    {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
