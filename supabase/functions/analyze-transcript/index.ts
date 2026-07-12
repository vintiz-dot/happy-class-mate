/**
 * analyze-transcript Edge Function
 * =================================
 * A class transcript is uploaded at the end of the lesson and must be
 * analyzed immediately so teacher/admin dashboards are ready to view.
 *
 * The frontend inserts a `class_transcripts` row (status `processing`) and
 * invokes this function with the row id. Pipeline:
 *
 *   1. Parse the transcript (WebVTT / SRT / "Name: line" plain text).
 *   2. Compute deterministic per-speaker metrics locally: utterances,
 *      words, questions, vocabulary richness, participation share.
 *   3. Match speakers to the class roster (diacritic-insensitive).
 *   4. One LLM pass per transcript extracts, per student: grammar/vocab
 *      errors (with corrections + CEFR topic), a CEFR estimate, and
 *      notable highlights — plus a lesson summary.
 *   5. Persist: transcript_speaker_metrics, student_error_log (+ SRS cards
 *      for spaced repetition), cefr_assessments, transcript summary.
 *
 * Input:  { transcript_id: string }
 * Output: { success, transcript_id, speakers, matched_students,
 *           errors_logged, summary }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CEFR_SCORE: Record<string, number> = {
  "Pre-A1": 0, A1: 1, "A1+": 1.5, A2: 2, "A2+": 2.5,
  B1: 3, "B1+": 3.5, B2: 4, "B2+": 4.5, C1: 5, C2: 6,
};

interface Utterance {
  speaker: string;
  text: string;
}

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function normName(s: string): string {
  return stripDiacritics(s).toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Parse VTT/SRT cue text or plain "Speaker: line" transcripts into
 * speaker-attributed utterances. Zoom-style "Name: text" inside cues is
 * also handled.
 */
function parseTranscript(raw: string): Utterance[] {
  const out: Utterance[] = [];
  let lastSpeaker = "";

  const lines = raw
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    // drop VTT/SRT structural noise: headers, cue numbers, timestamps
    .filter(
      (l) =>
        l &&
        l !== "WEBVTT" &&
        !/^\d+$/.test(l) &&
        !/^\d{2}:\d{2}(:\d{2})?[.,]\d{3}\s+-->/.test(l) &&
        !/^NOTE\b/.test(l),
    );

  // Zoom VTT uses "Name: text"; MS Teams "<v Name>text</v>"
  const vTag = /^<v\s+([^>]+)>(.*?)(<\/v>)?$/i;
  const nameColon = /^([A-Za-zÀ-ỹ' .-]{2,40}):\s*(.+)$/;

  for (const line of lines) {
    const v = line.match(vTag);
    if (v) {
      out.push({ speaker: v[1].trim(), text: v[2].trim() });
      lastSpeaker = v[1].trim();
      continue;
    }
    const nc = line.match(nameColon);
    if (nc && nc[1].split(" ").length <= 5) {
      out.push({ speaker: nc[1].trim(), text: nc[2].trim() });
      lastSpeaker = nc[1].trim();
      continue;
    }
    // Continuation line — attach to the previous speaker.
    if (lastSpeaker && out.length) {
      out[out.length - 1].text += " " + line;
    }
  }
  return out.filter((u) => u.text);
}

interface SpeakerStats {
  label: string;
  utterances: string[];
  words: number;
  distinctWords: Set<string>;
  questions: number;
}

function computeStats(utterances: Utterance[]): Map<string, SpeakerStats> {
  const map = new Map<string, SpeakerStats>();
  for (const u of utterances) {
    const key = u.speaker;
    if (!map.has(key)) {
      map.set(key, { label: key, utterances: [], words: 0, distinctWords: new Set(), questions: 0 });
    }
    const s = map.get(key)!;
    s.utterances.push(u.text);
    const tokens = u.text.toLowerCase().replace(/[^a-z'\s]/g, " ").split(/\s+/).filter(Boolean);
    s.words += tokens.length;
    for (const t of tokens) s.distinctWords.add(t);
    if (u.text.includes("?")) s.questions++;
  }
  return map;
}

async function llmAnalyze(
  perStudent: Array<{ name: string; sample: string }>,
  lessonExcerpt: string,
): Promise<any> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY is not configured");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 3500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an ESL assessment specialist analyzing a class transcript from an English " +
            "club for Vietnamese school students (levels Pre-A1 to B2). For each listed student, " +
            "analyze ONLY their quoted utterances.\n\n" +
            'Return JSON: {"summary": string (4-6 sentence lesson summary: topics covered, overall ' +
            'class dynamics), "students": [{"name": string (exactly as given), ' +
            '"cefr_estimate": "Pre-A1"|"A1"|"A1+"|"A2"|"A2+"|"B1"|"B1+"|"B2"|null (null if too little speech), ' +
            '"confidence": number 0-1, ' +
            '"errors": [{"error_text": string (verbatim student utterance fragment), ' +
            '"corrected_text": string, "error_type": "grammar"|"vocabulary"|"pronunciation"|"spelling"|"syntax"|"other", ' +
            '"cefr_topic": string (e.g. "past simple", "articles", "subject-verb agreement")}] (max 5, most instructive first, ' +
            "ignore casual contractions and normal spoken ellipsis — flag only genuine learner errors), " +
            '"highlights": [string] (up to 2 notable moments: breakthroughs, great vocabulary use), ' +
            '"evidence": string (1 sentence justifying the CEFR estimate)}]}',
        },
        {
          role: "user",
          content:
            `Lesson excerpt (context):\n${lessonExcerpt.slice(0, 3000)}\n\n` +
            `Per-student utterances:\n` +
            perStudent
              .map((s) => `### ${s.name}\n${s.sample}`)
              .join("\n\n"),
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.choices?.[0]?.message?.content || "{}");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let transcriptId: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    transcriptId = String(body.transcript_id ?? "").trim() || null;
    if (!transcriptId) return respond({ success: false, error: "transcript_id is required" }, 400);

    const { data: tr, error: trErr } = await sb
      .from("class_transcripts")
      .select("id, class_id, raw_text, uploaded_by, transcript_date")
      .eq("id", transcriptId)
      .single();
    if (trErr || !tr) return respond({ success: false, error: "transcript not found" }, 404);

    // ── 1 + 2. Parse and compute deterministic metrics ───────────────────
    const utterances = parseTranscript(tr.raw_text);
    if (!utterances.length) throw new Error("could not parse any speaker turns from the transcript");
    const stats = computeStats(utterances);

    // ── 3. Roster match ──────────────────────────────────────────────────
    const { data: enrollRows } = await sb
      .from("enrollments")
      .select("students(id, full_name)")
      .eq("class_id", tr.class_id)
      .eq("status", "active");
    const roster: Array<{ id: string; full_name: string }> = (enrollRows || [])
      .map((r: any) => r.students)
      .filter((s: any) => s?.id);

    const { data: teacherRows } = await sb
      .from("sessions")
      .select("teachers(full_name)")
      .eq("class_id", tr.class_id)
      .limit(20);
    const teacherNames = new Set(
      (teacherRows || [])
        .map((r: any) => r.teachers?.full_name)
        .filter(Boolean)
        .map((n: string) => normName(n)),
    );

    const matchStudent = (label: string) => {
      const n = normName(label);
      if (!n) return null;
      let best: { id: string; score: number } | null = null;
      for (const s of roster) {
        const rn = normName(s.full_name);
        let score = 0;
        if (rn === n) score = 1;
        else if (rn.includes(n) || n.includes(rn)) score = 0.9;
        else {
          const nTok = new Set(n.split(" "));
          const rTok = rn.split(" ");
          const hits = rTok.filter((t) => nTok.has(t)).length;
          score = hits / Math.max(rTok.length, 1);
        }
        if (!best || score > best.score) best = { id: s.id, score };
      }
      return best && best.score >= 0.5 ? best.id : null;
    };

    const speakers = [...stats.values()];
    const totalStudentWords = speakers
      .filter((s) => !teacherNames.has(normName(s.label)))
      .reduce((sum, s) => sum + s.words, 0);

    // ── 4. LLM analysis over matched students ────────────────────────────
    const studentSpeakers = speakers
      .map((s) => ({ ...s, studentId: matchStudent(s.label), isTeacher: teacherNames.has(normName(s.label)) }))
      .filter((s) => !s.isTeacher);

    const llmInput = studentSpeakers
      .filter((s) => s.words >= 5)
      .map((s) => ({
        name: s.label,
        sample: s.utterances.slice(0, 40).join("\n").slice(0, 2500),
      }));

    const analysis = llmInput.length
      ? await llmAnalyze(llmInput, utterances.slice(0, 60).map((u) => `${u.speaker}: ${u.text}`).join("\n"))
      : { summary: "No student speech detected in this transcript.", students: [] };

    const byName = new Map<string, any>(
      (analysis.students || []).map((s: any) => [normName(String(s.name || "")), s]),
    );

    // ── 5. Persist everything ────────────────────────────────────────────
    // Re-analysis: clear previous derived rows for this transcript.
    await sb.from("transcript_speaker_metrics").delete().eq("transcript_id", transcriptId);

    let errorsLogged = 0;
    let matchedCount = 0;

    for (const s of speakers) {
      const isTeacher = teacherNames.has(normName(s.label));
      const studentId = isTeacher ? null : matchStudent(s.label);
      if (studentId) matchedCount++;
      const ai = byName.get(normName(s.label));

      await sb.from("transcript_speaker_metrics").insert({
        transcript_id: transcriptId,
        class_id: tr.class_id,
        student_id: studentId,
        speaker_label: s.label,
        is_teacher: isTeacher,
        utterance_count: s.utterances.length,
        word_count: s.words,
        avg_utterance_length: s.utterances.length ? s.words / s.utterances.length : 0,
        questions_asked: s.questions,
        participation_share:
          !isTeacher && totalStudentWords > 0 ? s.words / totalStudentWords : null,
        vocabulary_richness: s.words > 0 ? s.distinctWords.size / s.words : null,
        errors_count: ai?.errors?.length ?? 0,
        cefr_estimate: ai?.cefr_estimate ?? null,
        highlights: ai?.highlights?.length ? ai.highlights : null,
      });

      if (!studentId || !ai) continue;

      // Error log + auto SRS cards
      for (const err of ai.errors ?? []) {
        if (!err?.error_text || !err?.corrected_text) continue;
        const { data: errRow } = await sb
          .from("student_error_log")
          .insert({
            student_id: studentId,
            class_id: tr.class_id,
            source: "transcript",
            source_id: transcriptId,
            error_text: String(err.error_text).slice(0, 500),
            corrected_text: String(err.corrected_text).slice(0, 500),
            error_type: ["grammar", "vocabulary", "pronunciation", "spelling", "syntax", "other"].includes(err.error_type)
              ? err.error_type
              : "grammar",
            cefr_topic: err.cefr_topic ? String(err.cefr_topic).slice(0, 80) : null,
          })
          .select("id")
          .single();
        if (errRow) {
          errorsLogged++;
          await sb.from("srs_cards").insert({
            student_id: studentId,
            source: "error",
            error_log_id: errRow.id,
            front: `Fix this sentence:\n“${String(err.error_text).slice(0, 300)}”`,
            back: String(err.corrected_text).slice(0, 300),
            hint: err.cefr_topic ? `Topic: ${err.cefr_topic}` : null,
          });
        }
      }

      // CEFR trajectory point
      if (ai.cefr_estimate && CEFR_SCORE[ai.cefr_estimate] !== undefined) {
        await sb.from("cefr_assessments").insert({
          student_id: studentId,
          class_id: tr.class_id,
          source: "transcript",
          level: ai.cefr_estimate,
          level_score: CEFR_SCORE[ai.cefr_estimate],
          confidence: typeof ai.confidence === "number" ? ai.confidence : null,
          evidence: ai.evidence ? String(ai.evidence).slice(0, 500) : null,
          assessed_at: tr.transcript_date,
          source_id: transcriptId,
        });
      }
    }

    await sb
      .from("class_transcripts")
      .update({
        status: "analyzed",
        summary: analysis.summary ?? null,
        analysis,
        analyzed_at: new Date().toISOString(),
      })
      .eq("id", transcriptId);

    return respond({
      success: true,
      transcript_id: transcriptId,
      speakers: speakers.length,
      matched_students: matchedCount,
      errors_logged: errorsLogged,
      summary: analysis.summary ?? null,
    });
  } catch (error) {
    console.error("analyze-transcript error:", error);
    if (transcriptId) {
      await sb
        .from("class_transcripts")
        .update({
          status: "failed",
          error_message: (error as Error).message?.slice(0, 500),
        })
        .eq("id", transcriptId);
    }
    return respond({ success: false, error: (error as Error).message }, 500);
  }
});
