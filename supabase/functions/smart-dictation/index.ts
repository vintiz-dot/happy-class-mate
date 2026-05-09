import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { rawText, targetLanguage } = await req.json()

    if (!rawText) {
      return new Response(
        JSON.stringify({ error: 'rawText is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Only process through OpenAI if the target language is English
    if (targetLanguage === 'en') {
      // SCENARIO: The OPENAI_API_KEY is pulled securely from the Supabase environment variables.
      // This is managed in the Lovable/Supabase cloud dashboard (Settings -> Edge Functions -> Secrets).
      const openAiKey = Deno.env.get('OPENAI_API_KEY')
      
      if (!openAiKey) {
        throw new Error('OPENAI_API_KEY is not configured in edge function secrets.')
      }

      const systemPrompt = `You are a supportive ESL teacher. A 7-year-old Vietnamese student learning English just spoke the following text. 1. Correct any obvious 'Viet-glish' phonetic mispronunciations. 2. Fix the grammar and spelling to a standard CEFR A1/A2 level while keeping their original meaning intact. 3. Output ONLY the corrected English sentence.`

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: rawText }
          ],
          temperature: 0.3, // Low temperature for more deterministic, corrective output
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('OpenAI API Error:', errorData)
        throw new Error('Failed to get response from OpenAI')
      }

      const data = await response.json()
      const correctedText = data.choices[0].message.content.trim()

      return new Response(
        JSON.stringify({ correctedText }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If target language is not English (e.g., Vietnamese), just return the raw text
    return new Response(
      JSON.stringify({ correctedText: rawText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Edge Function Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
