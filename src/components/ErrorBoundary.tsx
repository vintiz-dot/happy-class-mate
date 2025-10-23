import { Component, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  isRecovering: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, isRecovering: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  async componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error with context
    const buildHash = import.meta.env.VITE_BUILD_HASH || "unknown";
    const { data: { session } } = await supabase.auth.getSession();
    
    console.error("ErrorBoundary caught:", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      buildHash,
      userId: session?.user?.id,
      timestamp: new Date().toISOString(),
    });

    // Start recovery
    this.setState({ isRecovering: true });
    
    try {
      // Check auth and route accordingly
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (currentSession) {
        window.location.href = "/dashboard";
      } else {
        window.location.href = "/auth";
      }
    } catch (recoveryError) {
      console.error("Recovery failed:", recoveryError);
      window.location.href = "/auth";
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {this.state.isRecovering ? "Recovering..." : "Something went wrong"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Redirecting you to safety...
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
