import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Volume2, Check, Loader2, BookOpen, Lightbulb, PenLine } from "lucide-react";
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

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface Props {
  onAddWord: (w: { word: string; partOfSpeech: string; meaning: string; example: string; imageUrl: string }) => void;
}

// --- Dictionary API types ---
interface DictPhonetic {
  text?: string;
  audio?: string;
}

interface DictDefinition {
  definition: string;
  example?: string;
}

interface DictMeaning {
  partOfSpeech: string;
  definitions: DictDefinition[];
}

interface DictEntry {
  word: string;
  phonetic?: string;
  phonetics?: DictPhonetic[];
  meanings: DictMeaning[];
}

const POS_OPTIONS = [
  { value: "noun", label: "Noun (n.)" },
  { value: "verb", label: "Verb (v.)" },
  { value: "adjective", label: "Adj (adj.)" },
  { value: "adverb", label: "Adv (adv.)" },
  { value: "preposition", label: "Prep (prep.)" },
  { value: "phrase", label: "Phrase" },
  { value: "other", label: "Other" },
];

const POS_COLORS: Record<string, string> = {
  noun: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  verb: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  adjective: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  adverb: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  preposition: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
};

function speak(text: string, lang = "en-US", rate = 0.8) {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  speechSynthesis.speak(u);
}

export function VocabularyCreator({ onAddWord }: Props) {
  const [word, setWord] = useState("");
  const [pos, setPos] = useState("noun");
  const [meaning, setMeaning] = useState("");
  const [example, setExample] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState("");
  const [fetchingImages, setFetchingImages] = useState(false);
  const [listeningField, setListeningField] = useState<string | null>(null);
  const recRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const dictDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const { toast } = useToast();

  // --- Dictionary state ---
  const [dictData, setDictData] = useState<DictEntry | null>(null);
  const [dictLoading, setDictLoading] = useState(false);
  const [dictError, setDictError] = useState(false);

  // --- Debounced dictionary + image fetch ---
  const onWordChange = (val: string) => {
    setWord(val);
    clearTimeout(debounceRef.current);
    clearTimeout(dictDebounceRef.current);

    if (val.trim().length < 2) {
      setImages([]);
      setSelectedImage("");
      setDictData(null);
      setDictError(false);
      return;
    }

    // Images (800ms)
    debounceRef.current = setTimeout(() => {
      setFetchingImages(true);
      const h = val.split("").reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
      const seed = Math.abs(h);
      const urls = Array.from({ length: 8 }, (_, i) =>
        "https://picsum.photos/seed/" + (seed + i) + "/400/300"
      );
      setImages(urls);
      setSelectedImage(urls[0]);
      setFetchingImages(false);
    }, 800);

    // Dictionary (600ms)
    dictDebounceRef.current = setTimeout(() => {
      fetchDictionary(val.trim().toLowerCase());
    }, 600);
  };

  const fetchDictionary = async (searchWord: string) => {
    setDictLoading(true);
    setDictError(false);
    setDictData(null);
    try {
      const res = await fetch("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(searchWord));
      if (!res.ok) {
        setDictError(true);
        return;
      }
      const data: DictEntry[] = await res.json();
      if (data && data.length > 0) {
        setDictData(data[0]);
        // Auto-set part of speech from first meaning
        const firstPos = data[0].meanings[0]?.partOfSpeech;
        if (firstPos) {
          const mapped = POS_OPTIONS.find(p => firstPos.startsWith(p.value));
          if (mapped) setPos(mapped.value);
        }
      }
    } catch {
      setDictError(true);
    } finally {
      setDictLoading(false);
    }
  };

  // Play dictionary audio if available
  const playDictAudio = () => {
    if (!dictData?.phonetics) return;
    const audioUrl = dictData.phonetics.find(p => p.audio)?.audio;
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play();
    } else {
      speak(dictData.word, "en-US", 0.7);
    }
  };

  // --- Voice input ---
  const toggleVoice = (field: string, lang: string) => {
    if (listeningField === field) {
      recRef.current?.stop();
      setListeningField(null);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast({ title: "Not Supported", description: "Speech recognition is not available.", variant: "destructive" });
      return;
    }
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      if (field === "word") onWordChange(t);
      if (field === "meaning") setMeaning(prev => prev ? prev + " " + t : t);
      if (field === "example") setExample(prev => prev ? prev + " " + t : t);
      setListeningField(null);
    };
    rec.onerror = () => setListeningField(null);
    rec.onend = () => setListeningField(null);
    recRef.current = rec;
    rec.start();
    setListeningField(field);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim() || !meaning.trim()) {
      toast({ title: "Required", description: "Please enter the word and its Vietnamese meaning.", variant: "destructive" });
      return;
    }
    onAddWord({
      word: word.trim(),
      partOfSpeech: pos,
      meaning: meaning.trim(),
      example: example.trim() || ("I learned the word " + word.trim() + " today."),
      imageUrl: selectedImage || ("https://picsum.photos/seed/" + Date.now() + "/400/300"),
    });
    setWord(""); setMeaning(""); setExample(""); setSelectedImage(""); setImages([]);
    setDictData(null); setDictError(false);
    toast({ title: "Word Added! ✨", description: word.trim() + " is now in your vocabulary." });
  };

  const MicButton = ({ field, lang }: { field: string; lang: string }) => {
    const active = listeningField === field;
    return (
      <Button
        type="button"
        variant={active ? "destructive" : "ghost"}
        size="icon"
        onClick={() => toggleVoice(field, lang)}
        className={cn("rounded-full shrink-0", active && "animate-pulse")}
      >
        {active ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </Button>
    );
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl border-0 bg-gradient-to-br from-white to-blue-50/50 dark:from-slate-900 dark:to-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl font-bold text-center bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
          Add a New Word
        </CardTitle>
        <p className="text-center text-sm text-muted-foreground">Tap 🎤 to speak or type your word</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Word Input */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">English Word</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder="e.g. exercise"
                  value={word}
                  onChange={e => onWordChange(e.target.value)}
                  className="text-lg h-12 pr-20"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {word && (
                    <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => speak(word)}>
                      <Volume2 className="w-4 h-4 text-blue-500" />
                    </Button>
                  )}
                  <MicButton field="word" lang="en-US" />
                </div>
              </div>
              <Select value={pos} onValueChange={setPos}>
                <SelectTrigger className="w-[120px] h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POS_OPTIONS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ========== SMART WORD EXPLORER ========== */}
          {dictLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
              <Loader2 className="w-4 h-4 animate-spin" /> Looking up word...
            </div>
          )}

          {dictData && (
            <div className="rounded-2xl border-2 border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              {/* Header: Word + Phonetic + Audio */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-violet-600" />
                  <h3 className="text-lg font-bold text-foreground capitalize">{dictData.word}</h3>
                  {dictData.phonetic && (
                    <span className="text-sm text-muted-foreground font-mono">{dictData.phonetic}</span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={playDictAudio}
                  className="text-violet-600 hover:text-violet-700 hover:bg-violet-100 rounded-lg gap-1"
                >
                  <Volume2 className="w-4 h-4" /> Listen
                </Button>
              </div>

              <Separator className="bg-violet-200 dark:bg-violet-800" />

              {/* Word Forms & Meanings */}
              <div className="space-y-4">
                {dictData.meanings.map((m, mi) => (
                  <div key={mi} className="space-y-2">
                    <Badge className={cn("text-xs font-bold uppercase tracking-wider", POS_COLORS[m.partOfSpeech] || "bg-slate-100 text-slate-600")}>
                      {m.partOfSpeech}
                    </Badge>
                    <ul className="space-y-2 pl-1">
                      {m.definitions.slice(0, 3).map((d, di) => (
                        <li key={di} className="text-sm space-y-1">
                          <p className="text-foreground">
                            <span className="font-medium text-muted-foreground mr-1">{di + 1}.</span>
                            {d.definition}
                          </p>
                          {d.example && (
                            <p className="text-xs text-muted-foreground italic pl-4 border-l-2 border-violet-200 dark:border-violet-700">
                              "{d.example}"
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="ml-1 h-5 px-1 text-blue-500 hover:text-blue-600"
                                onClick={() => speak(d.example!, "en-US", 0.8)}
                              >
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

              <Separator className="bg-violet-200 dark:bg-violet-800" />

              {/* Prompt: Make your own example */}
              <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                <Lightbulb className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-amber-800 dark:text-amber-300">Your turn!</p>
                  <p className="text-amber-700 dark:text-amber-400">
                    Now write your own example sentence using "<strong>{dictData.word}</strong>" in the Example field below. Try using it as a <strong>{dictData.meanings[0]?.partOfSpeech}</strong>!
                  </p>
                </div>
              </div>
            </div>
          )}

          {dictError && word.trim().length >= 2 && (
            <div className="text-xs text-muted-foreground px-1">
              No dictionary entry found for "{word.trim()}". You can still add it manually!
            </div>
          )}

          {/* Image Gallery */}
          {images.length > 0 && (
            <div className="space-y-2 bg-muted/30 p-3 rounded-xl border">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-medium text-muted-foreground">Choose an image</Label>
                {fetchingImages && <Badge variant="secondary" className="animate-pulse text-xs">Loading...</Badge>}
              </div>
              <ScrollArea className="w-full whitespace-nowrap rounded-lg">
                <div className="flex w-max gap-3 p-1">
                  {images.map((url, i) => (
                    <div
                      key={i}
                      className={cn(
                        "relative cursor-pointer rounded-xl overflow-hidden w-[120px] h-[90px] shrink-0 transition-all duration-200 hover:scale-105",
                        selectedImage === url ? "ring-3 ring-violet-500 ring-offset-2 shadow-lg" : "opacity-70 hover:opacity-100"
                      )}
                      onClick={() => setSelectedImage(url)}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      {selectedImage === url && (
                        <div className="absolute top-1 right-1 bg-violet-500 text-white rounded-full p-0.5">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
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
              <Input
                placeholder="e.g. bài tập / tập thể dục"
                value={meaning}
                onChange={e => setMeaning(e.target.value)}
                className="text-lg h-12 pr-12"
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2">
                <MicButton field="meaning" lang="vi-VN" />
              </div>
            </div>
          </div>

          {/* Example Sentence */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Your Example Sentence</Label>
              {dictData && (
                <Badge variant="outline" className="text-xs gap-1 text-violet-600 border-violet-300">
                  <PenLine className="w-3 h-3" /> Write your own!
                </Badge>
              )}
            </div>
            <div className="relative">
              <Textarea
                placeholder="Write a sentence using this word..."
                value={example}
                onChange={e => setExample(e.target.value)}
                className="text-base min-h-[80px] resize-none pr-12"
              />
              <div className="absolute top-2 right-1">
                <MicButton field="example" lang="en-US" />
              </div>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-14 text-lg font-bold rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all"
          >
            Add to My Vocabulary ✨
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
