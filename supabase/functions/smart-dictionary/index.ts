// smart-dictionary Edge Function
// Proxies requests to OpenAI gpt-4o-mini to get grade-appropriate vocabulary definitions.
// The OPENAI_API_KEY must be set in Supabase Dashboard → Edge Functions → Secrets.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { word, grade } = await req.json();

    if (!word || typeof word !== "string") {
      return new Response(
        JSON.stringify({ error: "word is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetGrade = grade ? grade.toString() : "3"; // Default to grade 3 if not specified

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) {
      console.error("OPENAI_API_KEY is not configured in edge function secrets.");
      return new Response(
        JSON.stringify({ error: "API key missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are a helpful dictionary for students. 
Provide a dictionary entry for the word requested. 
CRITICAL: The definition and example sentences MUST be written in English appropriate for a Grade ${targetGrade} student. Use simple vocabulary and clear explanations suitable for that specific reading level.

Respond ONLY with a JSON object containing an "entries" array with a single object. The structure MUST exactly match this format:
{
  "entries": [
    {
      "word": "the word",
      "phonetic": "/the phonetic/",
      "meanings": [
        {
          "partOfSpeech": "noun",
          "definitions": [
            {
              "definition": "Grade-appropriate definition here.",
              "example": "Grade-appropriate example sentence here."
            }
          ]
        }
      ]
    }
  ]
}
If a word has multiple meanings or parts of speech, include up to 2 most common ones. Ensure the JSON is valid and minified.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + openAiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: word },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenAI API error:", err);
      return new Response(
        JSON.stringify({ error: "AI dictionary failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    let content = data.choices[0].message.content.trim();
    
    // Sometimes the model might wrap the array in an object when using json_object response format
    let result;
    try {
      result = JSON.parse(content);
      // If it returned { "entries": [...] } or similar due to json_object
      if (result && typeof result === "object" && !Array.isArray(result)) {
        const key = Object.keys(result)[0];
        if (Array.isArray(result[key])) {
          result = result[key];
        } else {
          result = [result];
        }
      }
    } catch (e) {
      console.error("Failed to parse AI JSON response:", e);
      return new Response(
        JSON.stringify({ error: "Invalid response format from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("smart-dictionary error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
