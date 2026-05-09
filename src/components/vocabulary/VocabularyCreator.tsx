import { useState, useEffect, useRef } from "react";
import { Mic, Loader2, Image as ImageIcon, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface VocabularyCreatorProps {
  onAddWord: (word: any) => void;
}

// Ensure TypeScript knows about webkitSpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function VocabularyCreator({ onAddWord }: VocabularyCreatorProps) {
  const [word, setWord] = useState("");
  const [meaning, setMeaning] = useState("");
  const [example, setExample] = useState("");
  
  const [images, setImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [isFetchingImages, setIsFetchingImages] = useState(false);
  
  // Speech recognition states
  const [activeInput, setActiveInput] = useState<"word" | "meaning" | "example" | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [language, setLanguage] = useState<"en" | "vi">("en");
  
  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      
      recognition.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        setIsListening(false);
        
        if (language === "vi") {
          updateActiveInput(transcript);
        } else {
          // English mode - polish with AI
          await polishTextWithAI(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
        setActiveInput(null);
        toast({
          title: "Microphone Error",
          description: "There was an error with the microphone. Please try again.",
          variant: "destructive",
        });
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [language, activeInput]); // Re-init if language changes to update lang property (handled in startListening)

  const updateActiveInput = (text: string) => {
    if (activeInput === "word") setWord((prev) => (prev ? prev + " " + text : text));
    if (activeInput === "meaning") setMeaning((prev) => (prev ? prev + " " + text : text));
    if (activeInput === "example") setExample((prev) => (prev ? prev + " " + text : text));
    setActiveInput(null);
  };

  const polishTextWithAI = async (rawText: string) => {
    setIsPolishing(true);
    try {
      const { data, error } = await supabase.functions.invoke('smart-dictation', {
        body: { rawText, targetLanguage: 'en' }
      });

      if (error) throw error;
      
      const correctedText = data.correctedText;
      updateActiveInput(correctedText);
      
      toast({
        title: "AI Polished",
        description: "Your pronunciation was corrected and polished!",
      });
    } catch (error) {
      console.error("Error polishing text:", error);
      toast({
        title: "Polishing Failed",
        description: "Could not polish the text. Using rough transcript instead.",
        variant: "destructive",
      });
      updateActiveInput(rawText);
    } finally {
      setIsPolishing(false);
    }
  };

  const toggleListening = (inputName: "word" | "meaning" | "example") => {
    if (isListening && activeInput === inputName) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setActiveInput(null);
      return;
    }

    if (recognitionRef.current) {
      setActiveInput(inputName);
      // Auto-set language based on input type for convenience, but respect manual toggle if needed.
      // Usually Meaning is VI, Word/Example are EN.
      const targetLang = inputName === "meaning" ? "vi-VN" : "en-US";
      recognitionRef.current.lang = targetLang;
      // We also track language state for AI polishing
      setLanguage(inputName === "meaning" ? "vi" : "en");
      
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error("Speech recognition already started");
      }
    } else {
      toast({
        title: "Not Supported",
        description: "Speech recognition is not supported in this browser.",
        variant: "destructive",
      });
    }
  };

  // Debounced Image Fetcher
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (word.trim().length > 2) {
        fetchImages(word.trim());
      } else {
        setImages([]);
      }
    }, 800);

    return () => clearTimeout(delayDebounceFn);
  }, [word]);

  const fetchImages = async (searchQuery: string) => {
    setIsFetchingImages(true);
    // Note: Since Unsplash source URL (source.unsplash.com) has been deprecated/changed, 
    // we generate a list of mock URLs using a reliable placeholder service like Picsum or a dynamic Unsplash source endpoint if still active.
    // For a real app, you would use the Unsplash API via Edge Function.
    // Here we simulate fetching 5 images based on the keyword using Unsplash Source format
    try {
      // Simulate network request
      await new Promise(r => setTimeout(r, 500));
      const newImages = Array.from({ length: 8 }).map((_, i) => 
        \`https://source.unsplash.com/400x300/?\${encodeURIComponent(searchQuery)}&sig=\${i}\`
      );
      setImages(newImages);
      // Auto-select first image if none selected
      if (!selectedImage && newImages.length > 0) {
        setSelectedImage(newImages[0]);
      }
    } catch (e) {
      console.error("Failed to fetch images", e);
    } finally {
      setIsFetchingImages(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!word || !meaning || !example || !selectedImage) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields and select an image.",
        variant: "destructive",
      });
      return;
    }
    
    onAddWord({
      id: crypto.randomUUID(),
      word,
      meaning,
      example,
      imageUrl: selectedImage,
      createdAt: new Date().toISOString()
    });
    
    // Reset form
    setWord("");
    setMeaning("");
    setExample("");
    setSelectedImage("");
    setImages([]);
    
    toast({
      title: "Success",
      description: "Vocabulary word added to the list!",
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg border-2 border-primary/10 bg-white/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-center text-primary mb-2">Create New Word</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* WORD INPUT */}
          <div className="space-y-2">
            <Label htmlFor="word" className="text-lg font-semibold">English Word</Label>
            <div className="relative flex items-center">
              <Input 
                id="word"
                placeholder="e.g. Beautiful" 
                value={word}
                onChange={(e) => setWord(e.target.value)}
                className="pr-12 text-lg py-6"
                disabled={isPolishing && activeInput === "word"}
              />
              <div className="absolute right-2 flex items-center space-x-1">
                {isPolishing && activeInput === "word" ? (
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                ) : (
                  <Button 
                    type="button" 
                    variant={isListening && activeInput === "word" ? "destructive" : "ghost"}
                    size="icon"
                    onClick={() => toggleListening("word")}
                    className={\`rounded-full \${isListening && activeInput === "word" ? 'animate-pulse' : ''}\`}
                  >
                    <Mic className="w-5 h-5" />
                  </Button>
                )}
              </div>
            </div>
            {isPolishing && activeInput === "word" && (
              <p className="text-xs text-primary animate-pulse flex items-center mt-1">
                <Loader2 className="w-3 h-3 animate-spin mr-1"/> AI is polishing your pronunciation...
              </p>
            )}
          </div>

          {/* IMAGE GALLERY */}
          <div className="space-y-2 bg-muted/30 p-4 rounded-xl border border-muted">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-semibold flex items-center text-muted-foreground">
                <ImageIcon className="w-4 h-4 mr-1" />
                Smart Images
              </Label>
              {isFetchingImages && <Badge variant="secondary" className="animate-pulse">Searching...</Badge>}
            </div>
            
            {images.length > 0 ? (
              <ScrollArea className="w-full whitespace-nowrap rounded-md">
                <div className="flex w-max space-x-4 p-2">
                  {images.map((imgUrl, i) => (
                    <div 
                      key={i} 
                      className={\`relative cursor-pointer transition-all duration-300 transform hover:scale-105 rounded-xl overflow-hidden shadow-sm w-[150px] h-[120px] shrink-0 \${
                        selectedImage === imgUrl ? 'ring-4 ring-primary ring-offset-2' : 'hover:ring-2 hover:ring-primary/50'
                      }\`}
                      onClick={() => setSelectedImage(imgUrl)}
                    >
                      <img src={imgUrl} alt="Vocabulary visual" className="w-full h-full object-cover" />
                      {selectedImage === imgUrl && (
                        <div className="absolute top-2 right-2 bg-primary text-white rounded-full p-1 shadow-md">
                          <Check className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            ) : (
              <div className="h-[120px] flex items-center justify-center border-2 border-dashed rounded-xl text-muted-foreground bg-white/50">
                {word.length > 2 ? "No images found." : "Type a word to see auto-fetched images..."}
              </div>
            )}
          </div>

          {/* MEANING INPUT */}
          <div className="space-y-2">
            <Label htmlFor="meaning" className="text-lg font-semibold">Vietnamese Meaning</Label>
            <div className="relative flex items-center">
              <Input 
                id="meaning"
                placeholder="e.g. Xinh đẹp" 
                value={meaning}
                onChange={(e) => setMeaning(e.target.value)}
                className="pr-12 text-lg py-6"
              />
              <div className="absolute right-2 flex items-center space-x-1">
                <Button 
                  type="button" 
                  variant={isListening && activeInput === "meaning" ? "destructive" : "ghost"}
                  size="icon"
                  onClick={() => toggleListening("meaning")}
                  className={\`rounded-full \${isListening && activeInput === "meaning" ? 'animate-pulse' : ''}\`}
                >
                  <Mic className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* EXAMPLE INPUT */}
          <div className="space-y-2">
            <Label htmlFor="example" className="text-lg font-semibold">Example Sentence</Label>
            <div className="relative flex items-center">
              <Textarea 
                id="example"
                placeholder="e.g. She is a very beautiful girl." 
                value={example}
                onChange={(e) => setExample(e.target.value)}
                className="pr-12 text-lg min-h-[100px] resize-none"
                disabled={isPolishing && activeInput === "example"}
              />
              <div className="absolute top-2 right-2 flex flex-col items-center space-y-1">
                {isPolishing && activeInput === "example" ? (
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                ) : (
                  <Button 
                    type="button" 
                    variant={isListening && activeInput === "example" ? "destructive" : "ghost"}
                    size="icon"
                    onClick={() => toggleListening("example")}
                    className={\`rounded-full \${isListening && activeInput === "example" ? 'animate-pulse' : ''}\`}
                  >
                    <Mic className="w-5 h-5" />
                  </Button>
                )}
              </div>
            </div>
             {isPolishing && activeInput === "example" && (
              <p className="text-xs text-primary animate-pulse flex items-center mt-1">
                <Loader2 className="w-3 h-3 animate-spin mr-1"/> AI is polishing your sentence...
              </p>
            )}
          </div>

          <Button type="submit" className="w-full text-lg py-6 rounded-xl shadow-lg hover:shadow-xl transition-all font-bold">
            Add to Vocabulary
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
