import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap } from "lucide-react";

type AuthMode = "login" | "signup" | "forgot";
type UserRole = "admin" | "teacher" | "family" | "student";

const Auth = () => {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [loading, setLoading] = useState(false);
  const [showBootstrap, setShowBootstrap] = useState(false);
  const [checkingAdmins, setCheckingAdmins] = useState(true);
  const [bootstrapping, setBootstrapping] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const checkForAdmins = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-admin-users', {
        body: { action: 'checkAdmins' }
      });

      if (error) {
        console.error('Error checking for admins:', error);
      } else {
        setShowBootstrap(!data.hasAdmins);
      }
    } catch (error) {
      console.error('Error checking for admins:', error);
    } finally {
      setCheckingAdmins(false);
    }
  };

  const handleBootstrap = async () => {
    setBootstrapping(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-admin-users', {
        body: { action: 'bootstrap' }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Bootstrap successful!",
        description: "First admin created: test@admin.com / abcabc!",
      });

      // Auto-login with the new admin credentials
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: 'test@admin.com',
        password: 'abcabc!',
      });

      if (loginError) throw loginError;

      // Hide bootstrap button and navigate
      setShowBootstrap(false);
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Bootstrap failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setBootstrapping(false);
    }
  };

  useEffect(() => {
    checkForAdmins();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast({
          title: "Login successful",
          description: "Welcome back!",
        });
        navigate("/");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/`,
        });

        if (error) throw error;

        toast({
          title: "Reset email sent",
          description: "Check your email for a password reset link",
        });
        setMode("login");
      } else {
        const redirectUrl = `${window.location.origin}/`;
        
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              role: role,
            },
          },
        });

        if (error) throw error;

        toast({
          title: "Registration successful",
          description: "Your account has been created!",
        });
        navigate("/");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <GraduationCap className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">
            {mode === "login" ? "Sign In" : mode === "forgot" ? "Reset Password" : "Sign Up"}
          </CardTitle>
          <CardDescription className="text-center">
            Tuition Manager - Happy English Club
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showBootstrap && !checkingAdmins && (
            <div className="mb-6 p-4 border border-primary/20 rounded-lg bg-primary/5">
              <h3 className="font-semibold text-sm mb-2">No Admin Accounts Exist</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Create the first admin account to get started with the system.
              </p>
              <Button 
                onClick={handleBootstrap} 
                disabled={bootstrapping}
                variant="outline"
                className="w-full"
              >
                {bootstrapping ? "Creating Admin..." : "Bootstrap First Admin"}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                This will create: test@admin.com / abcabc!
              </p>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            )}
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={role} onValueChange={(value: UserRole) => setRole(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="family">Parent</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Processing..." : mode === "login" ? "Sign In" : mode === "forgot" ? "Send Reset Link" : "Sign Up"}
            </Button>
          </form>
          <div className="mt-4 space-y-2 text-center text-sm">
            {mode === "login" && (
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="text-primary hover:underline block w-full"
              >
                Forgot password?
              </button>
            )}
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-primary hover:underline"
            >
              {mode === "login" ? "Don't have an account? Sign up" : mode === "forgot" ? "Back to sign in" : "Already have an account? Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
