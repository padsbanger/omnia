import { FormEvent, useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { loginUser, registerUser } from "../api/auth";
import { useAuthStore } from "../store";

type AuthMode = "login" | "register";

const AuthScreen = () => {
  const setSession = useAuthStore((state) => state.setSession);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(
    () => email.trim().length > 0 && password.length >= 8 && !isSubmitting,
    [email, isSubmitting, password],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const authenticate = mode === "login" ? loginUser : registerUser;
      const response = await authenticate(email.trim(), password);
      setSession(response.token, response.user);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Authentication failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
  };

  return (
    <main className="flex h-full w-full items-center justify-center bg-slate-100 px-6">
      <section className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold text-slate-950">Omnia</h1>
          <p className="mt-1 text-sm text-slate-600">
            {mode === "login"
              ? "Sign in to continue to your workspace."
              : "Create an account to start using Omnia."}
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-md border border-slate-200 p-1">
          <button
            type="button"
            className={`rounded px-3 py-2 text-sm font-medium ${
              mode === "login"
                ? "bg-slate-900 text-white"
                : "text-slate-700 hover:bg-slate-100"
            }`}
            onClick={() => switchMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={`rounded px-3 py-2 text-sm font-medium ${
              mode === "register"
                ? "bg-slate-900 text-white"
                : "text-slate-700 hover:bg-slate-100"
            }`}
            onClick={() => switchMode("register")}
          >
            Register
          </button>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
            Email
            <input
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
            Password
            <input
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={8}
              required
            />
          </label>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button type="submit" isDisabled={!canSubmit}>
            {isSubmitting
              ? mode === "login"
                ? "Signing in..."
                : "Creating account..."
              : mode === "login"
              ? "Sign in"
              : "Create account"}
          </Button>
        </form>
      </section>
    </main>
  );
};

export default AuthScreen;
