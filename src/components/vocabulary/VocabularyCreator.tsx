import { useState, useRef, useCallback } from "react";
import { Mic, MicOff, Volume2, Check, Loader2, BookOpen, Lightbulb, PenLine, Timer, SpellCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { getCEFRBadgeLabel, getCEFRProfile } from "@/lib/cefrMapping";
import { VisemePlayer } from "./VisemePlayer";

declare global {
  interface Window { SpeechRecognition: any; webkitSpeechRecognition: any; }
}

interface Props {
  onAddWord: (w: { word: string; partOfSpeech: string; meaning: string; example: string; imageUrl: string }) => void;
}

interface DictDefinition { definition: string; example?: string; }
interface DictMeaning { partOfSpeech: string; definitions: DictDefinition[]; }
interface DictEntry { word: string; phonetic?: string; phonetics?: { text?: string; audio?: string }[]; meanings: DictMeaning[]; }

const POS_OPTIONS = [
  { value: "noun", label: "Noun (n.)" }, { value: "verb", label: "Verb (v.)" },
  { value: "adjective", label: "Adj (adj.)" }, { value: "adverb", label: "Adv (adv.)" },
  { value: "phrase", label: "Phrase" }, { value: "other", label: "Other" },
];
const POS_COLORS: Record<string, string> = {
  noun: "bg-blue-100 text-blue-700", verb: "bg-emerald-100 text-emerald-700",
  adjective: "bg-amber-100 text-amber-700", adverb: "bg-purple-100 text-purple-700",
};

function speak(text: string, lang = "en-US", rate = 0.8) {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = lang; u.rate = rate;
  speechSynthesis.speak(u);
}

const GRADE_KEY = "hec-vocab-grade";
const GRADES = ["1", "2", "3", "4", "5", "6", "7", "8"];

export function VocabularyCreator({ onAddWord }: Props) {
  const [grade, setGrade] = useState(() => localStorage.getItem(GRADE_KEY) || "");
  const [word, setWord] = useState("");
  const [pos, setPos] = useState("noun");
  const [meaning, setMeaning] = useState("");
  const [example, setExample] = useState("");
  const [images, setImages] = useState<{ url: string; alt: string }[]>([]);
  const [selectedImage, setSelectedImage] = useState("");
  const [fetchingImages, setFetchingImages] = useState(false);
  const [listeningField, setListeningField] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [dictData, setDictData] = useState<DictEntry | null>(null);
  const [dictLoading, setDictLoading] = useState(false);
  const [viTranslation, setViTranslation] = useState("");
  const [viDefinitions, setViDefinitions] = useState<Record<string, string>>({});
  const [grammarResult, setGrammarResult] = useState<string | null>(null);
  const [checkingGrammar, setCheckingGrammar] = useState(false);

  const recRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const grammarRef = useRef<ReturnType<typeof setTimeout>>();
  const { toast } = useToast();

  const gradeNum = parseInt(grade) || 0;
  const setAndSaveGrade = (g: string) => { setGrade(g); localStorage.setItem(GRADE_KEY, g); };

  // ---- Word change: triggers dictionary + images + translation ----
  const onWordChange = (val: string) => {
    setWord(val);
    clearTimeout(debounceRef.current);
    if (val.trim().length < 2) {
      setImages([]); setSelectedImage(""); setDictData(null); setViTranslation("");
      return;
    }
    debounceRef.current = setTimeout(() => {
      const q = val.trim().toLowerCase();
      fetchDictionary(q);
      fetchImages(q);
      fetchVietnamese(q);
    }, 700);
  };

  // ---- Dictionary API (Grade-appropriate via Edge Function) ----
  const fetchDictionary = async (q: string) => {
    setDictLoading(true); setDictData(null); setViDefinitions({});
    try {
      const { data, error } = await supabase.functions.invoke("smart-dictionary", {
        body: { word: q, grade: gradeNum || 3 },
      });
      if (!error && data?.[0]) {
        setDictData(data[0]);
        const firstPos = data[0].meanings[0]?.partOfSpeech;
        if (firstPos) {
          const m = POS_OPTIONS.find(p => firstPos.startsWith(p.value));
          if (m) setPos(m.value);
        }
        // For Grade 1-5: translate definitions to Vietnamese
        if (gradeNum >= 1 && gradeNum <= 5) {
          translateDefinitions(data[0]);
        }
      } else {
        // Fallback to free dictionary API
        const res = await fetch("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(q));
        if (res.ok) {
          const fallbackData: DictEntry[] = await res.json();
          if (fallbackData?.[0]) {
            setDictData(fallbackData[0]);
            const firstPos = fallbackData[0].meanings[0]?.partOfSpeech;
            if (firstPos) {
              const m = POS_OPTIONS.find(p => firstPos.startsWith(p.value));
              if (m) setPos(m.value);
            }
            // For Grade 1-5: translate definitions to Vietnamese
            if (gradeNum >= 1 && gradeNum <= 5) {
              translateDefinitions(fallbackData[0]);
            }
          }
        }
      }
    } catch { /* silent */ }
    setDictLoading(false);
  };

  // ---- Translate definitions to Vietnamese for younger students ----
  const translateDefinitions = async (entry: DictEntry) => {
    const defsToTranslate: { key: string; text: string }[] = [];
    entry.meanings.forEach((m, mi) => {
      m.definitions.slice(0, 2).forEach((d, di) => {
        defsToTranslate.push({ key: mi + "-" + di, text: d.definition });
      });
    });
    const results: Record<string, string> = {};
    // Translate in parallel (max 4 to avoid rate limits)
    await Promise.all(defsToTranslate.slice(0, 4).map(async (item) => {
      try {
        const res = await fetch("https://api.mymemory.translated.net/get?q=" + encodeURIComponent(item.text.slice(0, 200)) + "&langpair=en|vi");
        if (res.ok) {
          const data = await res.json();
          const t = data?.responseData?.translatedText;
          if (t) results[item.key] = t;
        }
      } catch { /* silent */ }
    }));
    setViDefinitions(results);
  };

  // ---- Vietnamese translation (MyMemory API, free, no key) ----
  const fetchVietnamese = async (q: string) => {
    setViTranslation("");
    try {
      const res = await fetch("https://api.mymemory.translated.net/get?q=" + encodeURIComponent(q) + "&langpair=en|vi");
      if (res.ok) {
        const data = await res.json();
        const t = data?.responseData?.translatedText;
        if (t && t.toLowerCase() !== q.toLowerCase()) {
          setViTranslation(t);
          if (!meaning.trim()) setMeaning(t);
        }
      }
    } catch { /* silent */ }
  };

  // ---- Image search (Wikimedia Commons — free, no API key, relevant images) ----
  const fetchImages = async (q: string) => {
    setFetchingImages(true); setImages([]); setSelectedImage("");
    try {
      const url =
        "https://commons.wikimedia.org/w/api.php?action=query" +
        "&generator=search&gsrsearch=" + encodeURIComponent(q + " photo") +
        "&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url" +
        "&iiurlwidth=400&format=json&origin=*";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const pages = data?.query?.pages;
        if (pages) {
          const imgs = Object.values(pages)
            .map((p: any) => {
              const info = p.imageinfo?.[0];
              if (!info?.thumburl) return null;
              // Filter out SVGs, icons, and tiny images
              const title = (p.title || "").toLowerCase();
              if (title.endsWith(".svg") || title.includes("icon") || title.includes("logo")) return null;
              return { url: info.thumburl, alt: (p.title || q).replace("File:", "") };
            })
            .filter(Boolean) as { url: string; alt: string }[];
          if (imgs.length > 0) {
            setImages(imgs.slice(0, 10));
            setSelectedImage(imgs[0].url);
            setFetchingImages(false);
            return;
          }
        }
      }
    } catch { /* silent */ }
    setFetchingImages(false);
  };

  // ---- Grammar check on example sentence (debounced, via edge function) ----
  const onExampleChange = (val: string) => {
    setExample(val);
    setGrammarResult(null);
    clearTimeout(grammarRef.current);
    if (val.trim().length < 5) return;
    grammarRef.current = setTimeout(() => checkGrammar(val.trim()), 1200);
  };

  const checkGrammar = async (text: string) => {
    setCheckingGrammar(true);
    try {
      const { data, error } = await supabase.functions.invoke("smart-dictation", {
        body: { rawText: text, targetLanguage: "en" },
      });
      if (!error && data?.correctedText && !data.warning) {
        const corrected = data.correctedText;
        if (corrected.toLowerCase() !== text.toLowerCase()) {
          setGrammarResult(corrected);
        } else {
          setGrammarResult(null); // No corrections needed
        }
      }
    } catch { /* AI unavailable, silent */ }
    setCheckingGrammar(false);
  };

  const acceptGrammarFix = () => {
    if (grammarResult) { setExample(grammarResult); setGrammarResult(null); }
  };

  // ---- Dictionary audio ----
  const playDictAudio = () => {
    if (!dictData?.phonetics) { speak(dictData?.word || word); return; }
    const audioUrl = dictData.phonetics.find(p => p.audio)?.audio;
    if (audioUrl) { new Audio(audioUrl).play(); } else { speak(dictData.word); }
  };

  // ---- Voice with countdown timer ----
  const startVoiceWithCountdown = (field: string, lang: string) => {
    if (listeningField === field) { recRef.current?.stop(); setListeningField(null); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast({ title: "Not Supported", description: "Speech recognition unavailable.", variant: "destructive" }); return; }

    // 3-second countdown
    setCountdown(3);
    let count = 3;
    const timer = setInterval(() => {
      count--;
      if (count > 0) { setCountdown(count); return; }
      clearInterval(timer);
      setCountdown(null);
      // Start recording
      const rec = new SR();
      rec.lang = lang; rec.continuous = false; rec.interimResults = false;
      rec.onresult = (e: any) => {
        const t = e.results[0][0].transcript;
        if (field === "word") onWordChange(t);
        else if (field === "meaning") setMeaning(prev => prev ? prev + " " + t : t);
        else if (field === "example") setExample(prev => prev ? prev + " " + t : t);
        setListeningField(null);
      };
      rec.onerror = () => setListeningField(null);
      rec.onend = () => setListeningField(null);
      recRef.current = rec;
      rec.start();
      setListeningField(field);
    }, 1000);
  };

  // ---- Submit ----
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim() || !meaning.trim()) {
      toast({ title: "Required", description: "Please enter the word and its meaning.", variant: "destructive" }); return;
    }
    onAddWord({
      word: word.trim(), partOfSpeech: pos, meaning: meaning.trim(),
      example: example.trim() || ("I learned the word " + word.trim() + " today."),
      imageUrl: selectedImage || ("https://picsum.photos/seed/" + Date.now() + "/400/300"),
    });
    setWord(""); setMeaning(""); setExample(""); setSelectedImage(""); setImages([]);
    setDictData(null); setViTranslation(""); setGrammarResult(null);
    toast({ title: "Word Added! ✨", description: word.trim() + " is now in your vocabulary." });
  };

  const MicBtn = ({ field, lang }: { field: string; lang: string }) => {
    const active = listeningField === field;
    return (
      <Button type="button" variant={active ? "destructive" : "ghost"} size="icon"
        onClick={() => startVoiceWithCountdown(field, lang)}
        className={cn("rounded-full shrink-0", active && "animate-pulse")}>
        {active ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </Button>
    );
  };

  return (
    <>
      {/* Countdown overlay */}
      {countdown !== null && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center space-y-4 animate-in zoom-in duration-200">
            <div className="text-8xl font-black text-white drop-shadow-2xl animate-pulse">{countdown}</div>
            <p className="text-xl text-white/80 font-medium">Get ready to speak...</p>
            <Timer className="w-8 h-8 text-white/60 mx-auto animate-spin" />
          </div>
        </div>
      )}

      <Card className="w-full max-w-2xl mx-auto shadow-xl border-0 bg-gradient-to-br from-white to-blue-50/50 dark:from-slate-900 dark:to-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl font-bold text-center bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
            Add a New Word
          </CardTitle>
          <p className="text-center text-sm text-muted-foreground">Tap 🎤 to speak or type your word</p>
        </CardHeader>
        <CardContent>
          {/* Grade Selector (shown if not set) */}
          {!grade ? (
            <div className="text-center space-y-5 py-6">
              <div className="text-5xl">🎓</div>
              <h3 className="text-xl font-bold text-foreground">What grade are you in?</h3>
              <p className="text-sm text-muted-foreground">This helps us show definitions you can understand.</p>
              <div className="grid grid-cols-4 gap-3 max-w-xs mx-auto">
                {GRADES.map(g => (
                  <Button key={g} variant="outline" onClick={() => setAndSaveGrade(g)}
                    className="h-14 text-xl font-bold rounded-xl hover:bg-violet-50 hover:border-violet-400 hover:text-violet-700 transition-all">
                    {g}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Grade + CEFR indicator */}
            <div className="flex items-center justify-end gap-2">
              <Badge variant="outline" className="text-[10px] font-medium bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border-violet-200">
                {getCEFRBadgeLabel(gradeNum)}
              </Badge>
              <button type="button" onClick={() => setAndSaveGrade("")} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                🎓 Grade {grade}
                <span className="underline">change</span>
              </button>
            </div>

            {/* Word + POS */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">English Word</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input placeholder="e.g. exercise" value={word} onChange={e => onWordChange(e.target.value)} className="text-lg h-12 pr-20" />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {word && <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => speak(word)}><Volume2 className="w-4 h-4 text-blue-500" /></Button>}
                    <MicBtn field="word" lang="en-US" />
                  </div>
                </div>
                <Select value={pos} onValueChange={setPos}>
                  <SelectTrigger className="w-[120px] h-12"><SelectValue /></SelectTrigger>
                  <SelectContent>{POS_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Smart Word Explorer */}
            {dictLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Looking up word...</div>}

            {dictData && (
              <div className="rounded-2xl border-2 border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                {/* Header with Viseme Pronunciation */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-5 h-5 text-violet-600" />
                    <h3 className={cn("font-bold capitalize", gradeNum <= 3 ? "text-2xl" : "text-lg")}>{dictData.word}</h3>
                    {gradeNum >= 4 && dictData.phonetic && <span className="text-sm text-muted-foreground font-mono">{dictData.phonetic}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <VisemePlayer word={dictData.word} compact />
                    <Button type="button" variant="ghost" size="sm" onClick={playDictAudio} className="text-violet-600 gap-1">
                      <Volume2 className="w-4 h-4" /> {gradeNum <= 3 ? "🔊" : "Listen"}
                    </Button>
                  </div>
                </div>

                {/* Vietnamese translation — always prominent */}
                {viTranslation && (
                  <div className={cn("flex items-center gap-2 rounded-lg px-3", gradeNum <= 3 ? "bg-blue-100 dark:bg-blue-950/40 py-3" : "bg-blue-50 dark:bg-blue-950/30 py-2")}>
                    <span className={gradeNum <= 3 ? "text-2xl" : "text-sm"}>🇻🇳</span>
                    <span className={cn("font-bold text-blue-700 dark:text-blue-300", gradeNum <= 3 ? "text-xl" : "text-sm")}>{viTranslation}</span>
                  </div>
                )}

                <Separator className="bg-violet-200 dark:bg-violet-800" />

                {/* === GRADE 1-3: Simple, Vietnamese-first, emoji-rich === */}
                {gradeNum >= 1 && gradeNum <= 3 && (
                  <div className="space-y-3">
                    {dictData.meanings.slice(0, 1).map((m, mi) => (
                      <div key={mi} className="space-y-2">
                        <Badge className={cn("text-sm font-bold", POS_COLORS[m.partOfSpeech] || "bg-slate-100 text-slate-600")}>
                          {m.partOfSpeech === "noun" ? "📦 Thing (Noun)" : m.partOfSpeech === "verb" ? "🏃 Action (Verb)" : m.partOfSpeech === "adjective" ? "🌈 Describing (Adjective)" : "📝 " + m.partOfSpeech}
                        </Badge>
                        {m.definitions.slice(0, 1).map((d, di) => {
                          const viDef = viDefinitions[mi + "-" + di];
                          return (
                            <div key={di} className="bg-white dark:bg-slate-800 rounded-xl p-3 space-y-2 border">
                              {viDef && <p className="text-base font-bold text-foreground">🇻🇳 {viDef}</p>}
                              {d.example && (
                                <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg px-3 py-2">
                                  <span className="text-lg">💬</span>
                                  <p className="text-sm font-medium text-foreground italic">"{d.example}"</p>
                                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-blue-500" onClick={() => speak(d.example!, "en-US", 0.7)}>
                                    <Volume2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}

                {/* === GRADE 4-5: Bilingual, simplified === */}
                {gradeNum >= 4 && gradeNum <= 5 && (
                  <div className="space-y-3">
                    {dictData.meanings.slice(0, 2).map((m, mi) => (
                      <div key={mi} className="space-y-1.5">
                        <Badge className={cn("text-xs font-bold uppercase", POS_COLORS[m.partOfSpeech] || "bg-slate-100 text-slate-600")}>
                          {m.partOfSpeech}
                        </Badge>
                        <ul className="space-y-2 pl-1">
                          {m.definitions.slice(0, 2).map((d, di) => {
                            const viDef = viDefinitions[mi + "-" + di];
                            return (
                              <li key={di} className="text-sm space-y-1">
                                <p><span className="font-medium text-muted-foreground mr-1">{di + 1}.</span>{d.definition}</p>
                                {viDef && <p className="text-xs text-blue-600 dark:text-blue-400 pl-4">🇻🇳 {viDef}</p>}
                                {d.example && (
                                  <p className="text-xs text-muted-foreground italic pl-4 border-l-2 border-violet-200">
                                    "{d.example}"
                                    <Button type="button" variant="ghost" size="sm" className="ml-1 h-5 px-1 text-blue-500" onClick={() => speak(d.example!, "en-US", 0.8)}>
                                      <Volume2 className="w-3 h-3" />
                                    </Button>
                                  </p>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {/* === GRADE 6-8: Full English definitions === */}
                {gradeNum >= 6 && (
                  <div className="space-y-3">
                    {dictData.meanings.map((m, mi) => (
                      <div key={mi} className="space-y-1.5">
                        <Badge className={cn("text-xs font-bold uppercase", POS_COLORS[m.partOfSpeech] || "bg-slate-100 text-slate-600")}>
                          {m.partOfSpeech}
                        </Badge>
                        <ul className="space-y-1.5 pl-1">
                          {m.definitions.slice(0, 3).map((d, di) => (
                            <li key={di} className="text-sm space-y-0.5">
                              <p><span className="font-medium text-muted-foreground mr-1">{di + 1}.</span>{d.definition}</p>
                              {d.example && (
                                <p className="text-xs text-muted-foreground italic pl-4 border-l-2 border-violet-200">
                                  "{d.example}"
                                  <Button type="button" variant="ghost" size="sm" className="ml-1 h-5 px-1 text-blue-500" onClick={() => speak(d.example!, "en-US", 0.8)}>
                                    <Volume2 className="w-3 h-3" />
                                  </Button>
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {/* Prompt */}
                <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-xl p-3">
                  <Lightbulb className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <p className={cn("text-amber-700 dark:text-amber-400", gradeNum <= 3 ? "text-base" : "text-sm")}>
                    {gradeNum <= 3
                      ? <><strong>Đến lượt em!</strong> Viết một câu có từ "<strong>{dictData.word}</strong>" ở bên dưới nhé! ✍️</>
                      : <><strong>Your turn!</strong> Write your own sentence using "<strong>{dictData.word}</strong>" below!</>}
                  </p>
                </div>
              </div>
            )}

            {/* Image Gallery */}
            {images.length > 0 && (
              <div className="space-y-2 bg-muted/30 p-3 rounded-xl border">
                <Label className="text-sm font-medium text-muted-foreground">Pick the best picture for this word</Label>
                <ScrollArea className="w-full whitespace-nowrap rounded-lg">
                  <div className="flex w-max gap-3 p-1">
                    {images.map((img, i) => (
                      <div key={i}
                        className={cn("relative cursor-pointer rounded-xl overflow-hidden w-[130px] h-[95px] shrink-0 transition-all duration-200 hover:scale-105",
                          selectedImage === img.url ? "ring-3 ring-violet-500 ring-offset-2 shadow-lg" : "opacity-70 hover:opacity-100"
                        )} onClick={() => setSelectedImage(img.url)}>
                        <img src={img.url} alt={img.alt} className="w-full h-full object-cover" loading="lazy" />
                        {selectedImage === img.url && <div className="absolute top-1 right-1 bg-violet-500 text-white rounded-full p-0.5"><Check className="w-3 h-3" /></div>}
                      </div>
                    ))}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>

              </div>
            )}

            {/* Vietnamese Meaning */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Vietnamese Meaning (Nghĩa tiếng Việt)</Label>
              <div className="relative">
                <Input placeholder="e.g. bài tập" value={meaning} onChange={e => setMeaning(e.target.value)} className="text-lg h-12 pr-12" />
                <div className="absolute right-1 top-1/2 -translate-y-1/2"><MicBtn field="meaning" lang="vi-VN" /></div>
              </div>
              {viTranslation && meaning !== viTranslation && (
                <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => setMeaning(viTranslation)}>
                  💡 Suggested: {viTranslation}
                </button>
              )}
            </div>

            {/* Example Sentence with grammar check */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Your Example Sentence</Label>
                {checkingGrammar && <Badge variant="outline" className="text-xs gap-1 animate-pulse"><SpellCheck className="w-3 h-3" /> Checking...</Badge>}
              </div>
              <div className="relative">
                <Textarea placeholder="Write a sentence using this word..." value={example} onChange={e => onExampleChange(e.target.value)} className="text-base min-h-[80px] resize-none pr-12" />
                <div className="absolute top-2 right-1"><MicBtn field="example" lang="en-US" /></div>
              </div>
              {grammarResult && (
                <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 rounded-xl p-3 animate-in fade-in duration-200">
                  <SpellCheck className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <div className="flex-1 text-sm">
                    <p className="text-blue-700 dark:text-blue-300 font-medium">AI suggests:</p>
                    <p className="text-blue-800 dark:text-blue-200 italic">"{grammarResult}"</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="text-blue-600 shrink-0 text-xs" onClick={acceptGrammarFix}>
                    Accept ✓
                  </Button>
                </div>
              )}
            </div>

            <Button type="submit" className="w-full h-14 text-lg font-bold rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all">
              {gradeNum <= 3 ? "Thêm từ vựng ✨" : "Add to My Vocabulary ✨"}
            </Button>
          </form>
          )}
        </CardContent>
      </Card>
    </>
  );
}
