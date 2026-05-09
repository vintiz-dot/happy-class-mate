import { useState } from "react";
import { VocabularyCreator } from "@/components/vocabulary/VocabularyCreator";
import { VocabularyIndex } from "@/components/vocabulary/VocabularyIndex";
import { VocabularyPractice } from "@/components/vocabulary/VocabularyPractice";
import { useVocabularyStore } from "@/hooks/useVocabularyStore";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, PlusCircle, Brain, Sparkles, Star, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";

export default function Vocabulary() {
  const { user } = useAuth();
  const store = useVocabularyStore(user?.id);
  const stats = store.getStats();
  const wordsForReview = store.getWordsForReview();
  const { toast } = useToast();
  const [testingAI, setTestingAI] = useState(false);

  // --- Test AI Connection ---
  const testAI = async () => {
    setTestingAI(true);
    toast({ title: "Testing AI...", description: "Sending a test phrase to OpenAI via smart-dictation..." });

    try {
      const { data, error } = await supabase.functions.invoke("smart-dictation", {
        body: { rawText: "I liek to go too the skool", targetLanguage: "en" },
      });

      if (error) {
        toast({
          title: "❌ AI Connection Failed",
          description: "Error: " + (error.message || JSON.stringify(error)),
          variant: "destructive",
        });
        console.error("AI test error:", error);
        return;
      }

      if (data?.warning) {
        toast({
          title: "⚠️ AI Fallback Active",
          description: "The edge function responded but AI polishing is unavailable. Check that OPENAI_API_KEY is set in Supabase Secrets. Response: " + data.correctedText,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "✅ AI is Working!",
        description: 'Input: "I liek to go too the skool" → Output: "' + data.correctedText + '"',
      });
    } catch (err: any) {
      toast({
        title: "❌ Connection Error",
        description: "Could not reach the edge function: " + (err.message || "Unknown error"),
        variant: "destructive",
      });
      console.error("AI test exception:", err);
    } finally {
      setTestingAI(false);
    }
  };

  return (
    <Layout title="Smart Vocabulary">
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-blue-500/10 flex items-center justify-center shadow-sm">
              <Sparkles className="w-7 h-7 text-violet-600" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Smart Vocabulary</h1>
              <p className="text-muted-foreground text-sm">Your personal word bank — learn, practice, master.</p>
            </div>
          </div>

          {/* Quick Stats + AI Test */}
          <div className="flex gap-3 flex-wrap items-center">
            {stats.total > 0 && (
              <>
                <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-xl text-sm font-medium">
                  <BookOpen className="w-4 h-4" /> {stats.total} words
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 px-3 py-1.5 rounded-xl text-sm font-medium">
                  <Star className="w-4 h-4" /> {stats.mastered} mastered
                </div>
                {stats.dueForReview > 0 && (
                  <div className="flex items-center gap-1.5 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 px-3 py-1.5 rounded-xl text-sm font-medium animate-pulse">
                    <Brain className="w-4 h-4" /> {stats.dueForReview} due
                  </div>
                )}
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={testAI}
              disabled={testingAI}
              className="rounded-xl gap-1.5 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
            >
              {testingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              Test AI
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="bank" className="w-full">
          <div className="flex justify-center mb-6">
            <TabsList className="grid w-full max-w-xl grid-cols-3 p-1 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border shadow-sm rounded-2xl h-12">
              <TabsTrigger
                value="bank"
                className="rounded-xl text-sm font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all gap-1.5"
              >
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Word Bank</span>
                <span className="sm:hidden">Words</span>
              </TabsTrigger>
              <TabsTrigger
                value="add"
                className="rounded-xl text-sm font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all gap-1.5"
              >
                <PlusCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Add Word</span>
                <span className="sm:hidden">Add</span>
              </TabsTrigger>
              <TabsTrigger
                value="practice"
                className="rounded-xl text-sm font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all gap-1.5 relative"
              >
                <Brain className="w-4 h-4" />
                <span className="hidden sm:inline">Practice</span>
                <span className="sm:hidden">Quiz</span>
                {stats.dueForReview > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {stats.dueForReview > 9 ? "9+" : stats.dueForReview}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="bank" className="mt-0 outline-none">
            <VocabularyIndex items={store.words} onDelete={store.deleteWord} />
          </TabsContent>

          <TabsContent value="add" className="mt-0 outline-none">
            <div className="py-4">
              <VocabularyCreator onAddWord={store.addWord} />
            </div>
          </TabsContent>

          <TabsContent value="practice" className="mt-0 outline-none">
            <VocabularyPractice
              words={store.words}
              wordsForReview={wordsForReview}
              onUpdateMastery={store.updateMastery}
            />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
