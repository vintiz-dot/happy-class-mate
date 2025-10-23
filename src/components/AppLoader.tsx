import { GraduationCap, Loader2 } from "lucide-react";

interface AppLoaderProps {
  message?: string;
}

export function AppLoader({ message = "Loading..." }: AppLoaderProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="relative">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
              <GraduationCap className="h-12 w-12 text-primary" />
            </div>
            <Loader2 className="h-8 w-8 animate-spin text-primary absolute -bottom-2 -right-2" />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Tuition Manager
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}
