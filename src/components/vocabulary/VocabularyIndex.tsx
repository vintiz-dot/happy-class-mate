import { useState, useMemo } from "react";
import Fuse from "fuse.js";
import { Search, ArrowDownAZ, ArrowUpZA, Volume2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";

export interface VocabularyItem {
  id: string;
  word: string;
  meaning: string;
  example: string;
  imageUrl: string;
  createdAt: string;
}

interface VocabularyIndexProps {
  items: VocabularyItem[];
}

const ITEMS_PER_PAGE = 30;

export function VocabularyIndex({ items }: VocabularyIndexProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);

  // Fuse.js for fuzzy search
  const fuse = useMemo(() => new Fuse(items, {
    keys: ["word", "meaning", "example"],
    threshold: 0.3,
  }), [items]);

  // Search and Sort Pipeline
  const processedItems = useMemo(() => {
    let result = items;

    // 1. Search
    if (searchQuery.trim()) {
      result = fuse.search(searchQuery).map(res => res.item);
    }

    // 2. Sort
    result = [...result].sort((a, b) => {
      const compareResult = a.word.localeCompare(b.word);
      return sortOrder === "asc" ? compareResult : -compareResult;
    });

    return result;
  }, [items, searchQuery, sortOrder, fuse]);

  // Pagination
  const totalPages = Math.ceil(processedItems.length / ITEMS_PER_PAGE);
  const paginatedItems = processedItems.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const toggleSort = () => {
    setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    setCurrentPage(1); // Reset to first page on sort
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1); // Reset to first page on search
  };

  const playPronunciation = (word: string) => {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="space-y-6">
      {/* TOOLBAR */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white/50 backdrop-blur-sm p-4 rounded-2xl shadow-sm border border-primary/10">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
          <Input 
            placeholder="Search vocabulary..." 
            value={searchQuery}
            onChange={handleSearch}
            className="pl-10 h-12 text-lg rounded-xl border-primary/20 focus-visible:ring-primary/30 bg-white"
          />
        </div>
        
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <Badge variant="secondary" className="text-sm py-1 px-3">
            {processedItems.length} Words
          </Badge>
          <Button 
            variant="outline" 
            onClick={toggleSort}
            className="h-12 px-4 rounded-xl border-primary/20 hover:bg-primary/5"
          >
            {sortOrder === "asc" ? <ArrowDownAZ className="w-5 h-5 mr-2" /> : <ArrowUpZA className="w-5 h-5 mr-2" />}
            Sort A-Z
          </Button>
        </div>
      </div>

      {/* GRID LAYOUT */}
      {paginatedItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {paginatedItems.map((item) => (
            <Card key={item.id} className="overflow-hidden flex flex-col group hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-primary/20 rounded-2xl">
              <div className="relative h-48 w-full overflow-hidden bg-muted">
                <img 
                  src={item.imageUrl} 
                  alt={item.word} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4 flex justify-between items-end">
                  <h3 className="text-2xl font-black text-white drop-shadow-md capitalize truncate pr-2">
                    {item.word}
                  </h3>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-sm shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      playPronunciation(item.word);
                    }}
                  >
                    <Volume2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <CardContent className="flex-grow p-5 space-y-4 bg-white">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-primary/80 uppercase tracking-wider">Meaning</p>
                  <p className="text-lg font-bold text-slate-800 line-clamp-2">{item.meaning}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-primary/80 uppercase tracking-wider">Example</p>
                  <p className="text-base text-slate-600 italic leading-relaxed line-clamp-3">"{item.example}"</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white/50 rounded-3xl border-2 border-dashed border-primary/20">
          <p className="text-xl text-muted-foreground font-medium">No vocabulary words found.</p>
          {searchQuery && <p className="text-sm mt-2 text-muted-foreground">Try adjusting your search query.</p>}
        </div>
      )}

      {/* STRICT 30-ITEM PAGINATION */}
      {totalPages > 1 && (
        <div className="py-6 flex justify-center">
          <Pagination>
            <PaginationContent className="bg-white/80 backdrop-blur-md p-2 rounded-2xl shadow-sm border border-primary/10">
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                // Show standard sliding window of pages
                if (
                  page === 1 || 
                  page === totalPages || 
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <PaginationItem key={page}>
                      <PaginationLink 
                        onClick={() => setCurrentPage(page)}
                        isActive={currentPage === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  );
                }
                
                // Show ellipsis
                if (
                  (page === 2 && currentPage > 3) || 
                  (page === totalPages - 1 && currentPage < totalPages - 2)
                ) {
                  return <PaginationItem key={page}><span className="px-4 py-2">...</span></PaginationItem>;
                }
                
                return null;
              })}

              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
