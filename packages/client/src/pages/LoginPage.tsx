import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Dice6 } from "lucide-react";
import { Button, Input, Card, CardContent } from "../components/ui";
import { useAuthStore } from "../stores/authStore";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    // Client-side validation
    if (username.length < 3) {
      setFormError("Username must be at least 3 characters");
      return;
    }
    if (password.length < 6) {
      setFormError("Password must be at least 6 characters");
      return;
    }

    try {
      await login(username, password);
      navigate("/");
    } catch {
      // Error is handled by the store
    }
  };

  const displayError = formError || error;

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <Card variant="elevated" className="w-full max-w-md">
        <CardContent className="pt-8">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-violet-500/10 mb-4">
              <Dice6 className="w-8 h-8 text-violet-500" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-50">
              DnD Voice Chat
            </h1>
            <p className="text-gray-400 mt-1">Sign in to continue</p>
          </div>

          {/* Error Display */}
          {displayError && (
            <div className="mb-6 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {displayError}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              autoComplete="username"
              autoFocus
            />

            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="current-password"
            />

            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
              disabled={isLoading}
            >
              Sign In
            </Button>
          </form>

          {/* Register Link */}
          <div className="mt-6 text-center text-sm text-gray-400">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
            >
              Create one
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
