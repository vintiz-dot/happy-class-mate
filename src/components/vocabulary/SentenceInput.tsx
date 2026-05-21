import { useState, useRef, useCallback } from "react";
import { Search, Loader2, CornerDownLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  onSubmit: (sentence: string, words: string[]) => void;
  loading?: boolean;
}

export function SentenceInput({ onSubmit, loading }: Props) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const trimmed = value.trim();
      if (!trimmed) return;

      // Parse into words: strip punctuation, split by whitespace
      const words = trimmed
        .split(/\s+/)
        .map((w) => w.replace(/[^a-zA-ZÀ-ỹ'-]/g, ""))
        .filter((w) => w.length > 0);

      if (words.length === 0) return;
      onSubmit(trimmed, words);
    },
    [value, onSubmit]
  );

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative group">
        <div
          className={cn(
            "relative flex items-center gap-2 rounded-full p-1.5 transition-all duration-300",
            "bg-[hsl(240_8%_12%)] border border-[hsl(240_8%_20%)]",
            "group-focus-within:border-[hsl(265_50%_40%)] group-focus-within:shadow-[0_0_20px_rgba(139,92,246,0.08)]"
          )}
        >
          <div className="flex items-center pl-3 text-muted-foreground">
            <Search className="w-4 h-4" />
          </div>

          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Type a word or sentence…"
            className="flex-1 border-0 bg-transparent text-base h-10 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-[hsl(220_10%_35%)]"
            disabled={loading}
            autoComplete="off"
            spellCheck={false}
          />

          <Button
            type="submit"
            disabled={!value.trim() || loading}
            className={cn(
              "rounded-full h-9 w-9 p-0 transition-all duration-200",
              "bg-[hsl(240_8%_18%)] hover:bg-[hsl(240_8%_22%)] text-foreground/70 hover:text-foreground",
              "disabled:opacity-30 disabled:cursor-not-allowed"
            )}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CornerDownLeft className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground/60 mt-3">
        Type a single word or a full sentence, then click a word to explore it
      </p>
    </form>
  );
}
