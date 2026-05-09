import { useState, useRef } from "react";
import { Mic, MicOff, Volume2, Check, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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

const POS_OPTIONS = [
  { value: "noun", label: "Noun (n.)" },
  { value: "verb", label: "Verb (v.)" },
  { value: "adjective", label: "Adj (adj.)" },
  { value: "adverb", label: "Adv (adv.)" },
  { value: "phrase", label: "Phrase" },
];

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
  const { toast } = useToast();

  // --- Pronunciation ---
  const speak = (text: string, lang = "en-US") => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 0.8;
    speechSynthesis.speak(u);
  };

  // --- Image fetch (debounced) ---
  const onWordChange = (val: string) => {
    setWord(val);
    clearTimeout(debounceRef.current);
    if (val.trim().length < 2) { setImages([]); setSelectedImage(""); return; }
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
  };

  // --- Voice input (direct browser SpeechRecognition, no AI dependency) ---
  const toggleVoice = (field: string, lang: string) => {
    if (listeningField === field) {
      recRef.current?.stop();
      setListeningField(null);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast({ title: "Not Supported", description: "Speech recognition is not available in this browser.", variant: "destructive" });
      return;
    }
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      if (field === "word") setWord(prev => prev ? prev + " " + t : t);
      if (field === "meaning") setMeaning(prev => prev ? prev + " " + t : t);
      if (field === "example") setExample(prev => prev ? prev + " " + t : t);
      setListeningField(null);
    };
    rec.onerror = () => { setListeningField(null); };
    rec.onend = () => { setListeningField(null); };
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
        <p className="text-center text-sm text-muted-foreground">Tap the 🎤 to speak or type your word</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Word + POS */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">English Word</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder="e.g. beautiful"
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
                placeholder="e.g. xinh đẹp"
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
            <Label className="text-base font-semibold">Example Sentence</Label>
            <div className="relative">
              <Textarea
                placeholder='e.g. She is a very beautiful girl.'
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
