import { VocabularyIndex } from "@/components/vocabulary/VocabularyIndex";
import { VocabularyPractice } from "@/components/vocabulary/VocabularyPractice";
import { WordExplorer } from "@/components/vocabulary/WordExplorer";
import { ClassSelectorModal } from "@/components/vocabulary/ClassSelectorModal";
import { useVocabularyStore } from "@/hooks/useVocabularyStore";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Brain, Sparkles, Star, Search } from "lucide-react";
import Layout from "@/components/Layout";

export default function Vocabulary() {
  const { user } = useAuth();
  const store = useVocabularyStore(user?.id);
  const stats = store.getStats();
  const wordsForReview = store.getWordsForReview();

  return (
    <Layout title="Smart Vocabulary">
      <ClassSelectorModal userId={user?.id} />
      <div className="max-w-5xl mx-auto space-y-8 py-10 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-3xl glass-sm flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-violet-600" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Smart Vocabulary</h1>
              <p className="text-muted-foreground text-sm">Look up a word, write your own examples, save it to your word bank.</p>
            </div>
          </div>

          {/* Stats */}
          {stats.total > 0 && (
            <div className="flex gap-3 flex-wrap items-center">
              <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-full text-sm font-medium">
                <BookOpen className="w-4 h-4" /> {stats.total} words
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 px-3 py-1.5 rounded-full text-sm font-medium">
                <Star className="w-4 h-4" /> {stats.mastered} mastered
              </div>
              {stats.dueForReview > 0 && (
                <div className="flex items-center gap-1.5 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 px-3 py-1.5 rounded-full text-sm font-medium animate-pulse">
                  <Brain className="w-4 h-4" /> {stats.dueForReview} due
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabs (Add Word is now merged into Explore) */}
        <Tabs defaultValue="explore" className="w-full">
          <div className="flex justify-center mb-6">
            <TabsList className="grid w-full max-w-lg grid-cols-3 p-1.5 glass rounded-3xl h-14">
              <TabsTrigger
                value="explore"
                className="rounded-2xl text-sm font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all gap-1.5"
              >
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">Explore & Save</span>
                <span className="sm:hidden">🔍</span>
              </TabsTrigger>
              <TabsTrigger
                value="bank"
                className="rounded-2xl text-sm font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all gap-1.5"
              >
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Word Bank</span>
                <span className="sm:hidden">Bank</span>
              </TabsTrigger>
              <TabsTrigger
                value="practice"
                className="rounded-2xl text-sm font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all gap-1.5 relative"
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

          <TabsContent value="explore" className="mt-0 outline-none">
            <div className="py-4">
              <WordExplorer onWordSaved={store.ingestSavedEntry} />
            </div>
          </TabsContent>

          <TabsContent value="bank" className="mt-0 outline-none">
            <VocabularyIndex
              items={store.words}
              onDelete={store.deleteWord}
              onUpdate={store.updateWord}
            />
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
