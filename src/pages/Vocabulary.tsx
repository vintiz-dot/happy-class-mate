import { useState } from "react";
import { VocabularyCreator } from "@/components/vocabulary/VocabularyCreator";
import { VocabularyIndex, VocabularyItem } from "@/components/vocabulary/VocabularyIndex";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, PlusCircle, Sparkles } from "lucide-react";
import Layout from "@/components/Layout";

// Dummy data for initial testing, matching the strict 30-item pagination testing needs
const initialVocabulary: VocabularyItem[] = Array.from({ length: 45 }).map((_, i) => ({
  id: `mock-${i}`,
  word: ["Apple", "Beautiful", "Cat", "Dog", "Elephant", "Flower", "Guitar", "House"][i % 8] + (i > 7 ? ` ${i}` : ""),
  meaning: ["Quả táo", "Xinh đẹp", "Con mèo", "Con chó", "Con voi", "Bông hoa", "Đàn ghi-ta", "Ngôi nhà"][i % 8],
  example: "This is a sample sentence for testing the UI layout and features.",
  imageUrl: `https://picsum.photos/seed/${i + 100}/400/300`,
  createdAt: new Date().toISOString()
}));

export default function Vocabulary() {
  const [vocabularyList, setVocabularyList] = useState<VocabularyItem[]>(initialVocabulary);

  const handleAddWord = (newWord: VocabularyItem) => {
    setVocabularyList(prev => [newWord, ...prev]);
  };

  return (
    <Layout title="Smart Vocabulary">
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
        {/* Page Header */}
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-sm">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Smart Vocabulary</h1>
            <p className="text-muted-foreground mt-0.5">Build and explore your personal English vocabulary with AI assistance.</p>
          </div>
        </div>

        <Tabs defaultValue="index" className="w-full">
          <div className="flex justify-center mb-8">
            <TabsList className="grid w-full max-w-md grid-cols-2 p-1 bg-white/50 backdrop-blur-md border border-primary/10 shadow-sm rounded-2xl h-14">
              <TabsTrigger 
                value="index" 
                className="rounded-xl text-base font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
              >
                <BookOpen className="w-5 h-5 mr-2" />
                My Words
              </TabsTrigger>
              <TabsTrigger 
                value="create" 
                className="rounded-xl text-base font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
              >
                <PlusCircle className="w-5 h-5 mr-2" />
                Add Word
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="index" className="mt-0 outline-none">
            <VocabularyIndex items={vocabularyList} />
          </TabsContent>

          <TabsContent value="create" className="mt-0 outline-none">
            <div className="py-6">
              <VocabularyCreator onAddWord={handleAddWord} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
