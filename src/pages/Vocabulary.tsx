import { useState } from "react";
import { VocabularyCreator } from "@/components/vocabulary/VocabularyCreator";
import { VocabularyIndex, VocabularyItem } from "@/components/vocabulary/VocabularyIndex";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Layout } from "@/components/Layout";

// Dummy data for initial testing, matching the strict 30-item pagination testing needs
const initialVocabulary: VocabularyItem[] = Array.from({ length: 45 }).map((_, i) => ({
  id: `mock-\${i}`,
  word: ["Apple", "Beautiful", "Cat", "Dog", "Elephant", "Flower", "Guitar", "House"][i % 8] + (i > 7 ? ` \${i}` : ""),
  meaning: ["Quả táo", "Xinh đẹp", "Con mèo", "Con chó", "Con voi", "Bông hoa", "Đàn ghi-ta", "Ngôi nhà"][i % 8],
  example: "This is a sample sentence for testing the UI layout and features.",
  imageUrl: `https://source.unsplash.com/400x300/?nature&sig=\${i}`,
  createdAt: new Date().toISOString()
}));

export default function Vocabulary() {
  const [vocabularyList, setVocabularyList] = useState<VocabularyItem[]>(initialVocabulary);

  const handleAddWord = (newWord: VocabularyItem) => {
    setVocabularyList(prev => [newWord, ...prev]);
  };

  return (
    <Layout>
      <div className="container max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8 animate-in fade-in duration-500">
        <PageHeader 
          title="Smart Vocabulary" 
          description="Build and explore your personal English vocabulary with AI assistance."
          icon={<BookOpen className="w-8 h-8 text-primary" />}
        />

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
