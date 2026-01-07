import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Dice6, Crown, User } from "lucide-react";
import { Button, Input, Card, CardContent } from "../components/ui";
import { useAuthStore } from "../stores/authStore";

type Role = "dm" | "player";

export function RegisterPage() {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<Role>("player");
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
    if (username.length > 30) {
      setFormError("Username must be at most 30 characters");
      return;
    }
    if (password.length < 6) {
      setFormError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match");
      return;
    }

    try {
      await register(username, password, role);
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
            <p className="text-gray-400 mt-1">Create your account</p>
          </div>

          {/* Error Display */}
          {displayError && (
            <div className="mb-6 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {displayError}
            </div>
          )}

          {/* Register Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username"
              type="text"
              placeholder="Choose a username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              autoComplete="username"
              autoFocus
            />

            <Input
              label="Password"
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="new-password"
            />

            <Input
              label="Confirm Password"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="new-password"
            />

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Role
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("player")}
                  disabled={isLoading}
                  className={`
                    flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all
                    ${
                      role === "player"
                        ? "border-violet-500 bg-violet-500/10"
                        : "border-gray-700 bg-gray-800 hover:border-gray-600"
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  <User
                    className={`w-6 h-6 ${
                      role === "player" ? "text-violet-500" : "text-gray-400"
                    }`}
                  />
                  <span
                    className={`text-sm font-medium ${
                      role === "player" ? "text-violet-400" : "text-gray-300"
                    }`}
                  >
                    Player
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole("dm")}
                  disabled={isLoading}
                  className={`
                    flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all
                    ${
                      role === "dm"
                        ? "border-amber-500 bg-amber-500/10"
                        : "border-gray-700 bg-gray-800 hover:border-gray-600"
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  <Crown
                    className={`w-6 h-6 ${
                      role === "dm" ? "text-amber-500" : "text-gray-400"
                    }`}
                  />
                  <span
                    className={`text-sm font-medium ${
                      role === "dm" ? "text-amber-400" : "text-gray-300"
                    }`}
                  >
                    Dungeon Master
                  </span>
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
              disabled={isLoading}
            >
              Create Account
            </Button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center text-sm text-gray-400">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
            >
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
