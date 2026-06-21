import { CSSProperties, FormEvent, useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { loginUser, registerUser } from "../api/auth";
import { useAuthStore } from "../store";
import omniaLogo from "../../assets/icon-square.png";

type AuthMode = "login" | "register";

type AuthScreenProps = {
  hasCachedRoutes?: boolean;
  onContinueOffline?: () => void;
};

const AuthScreen = ({
  hasCachedRoutes = false,
  onContinueOffline,
}: AuthScreenProps) => {
  const setSession = useAuthStore((state) => state.setSession);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const particles = useMemo(
    () =>
      Array.from({ length: 34 }, (_, index) => ({
        id: index,
        delay: `${Math.random() * -28}s`,
        duration: `${18 + Math.random() * 24}s`,
        left: `${Math.random() * 100}%`,
        size: `${2 + Math.random() * 4}px`,
        top: `${Math.random() * 100}%`,
        travelX: `${(Math.random() - 0.5) * 180}px`,
        travelY: `${-120 - Math.random() * 220}px`,
        color:
          index % 3 === 0
            ? "rgba(97, 240, 255, 0.7)"
            : index % 3 === 1
            ? "rgba(124, 72, 255, 0.62)"
            : "rgba(231, 43, 255, 0.58)",
      })),
    [],
  );

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
    <main className="omnia-auth-background relative flex h-full w-full items-center justify-center overflow-hidden px-6">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {particles.map((particle) => (
          <span
            key={particle.id}
            className="omnia-auth-particle"
            style={
              {
                "--particle-color": particle.color,
                "--particle-size": particle.size,
                "--particle-travel-x": particle.travelX,
                "--particle-travel-y": particle.travelY,
                animationDelay: particle.delay,
                animationDuration: particle.duration,
                left: particle.left,
                top: particle.top,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <section className="relative z-10 w-full max-w-sm rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <img
              src={omniaLogo}
              alt="Omnia"
              className="h-11 w-11 rounded-lg border border-slate-200 bg-white"
            />
            <div>
              <h1 className="text-xl font-semibold text-slate-950">Omnia</h1>
              <p className="mt-1 text-sm text-slate-500">
                {mode === "login"
                  ? "Sign in to continue to your workspace."
                  : "Create an account to start using Omnia."}
              </p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="mb-5 grid grid-cols-2 rounded-md border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              className={`rounded px-3 py-2 text-sm font-medium ${
                mode === "login"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-white hover:text-slate-950"
              }`}
              onClick={() => switchMode("login")}
            >
              Login
            </button>
            <button
              type="button"
              className={`rounded px-3 py-2 text-sm font-medium ${
                mode === "register"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-white hover:text-slate-950"
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
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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

            <Button
              type="submit"
              className="bg-blue-600 font-medium text-white"
              isDisabled={!canSubmit}
            >
              {isSubmitting
                ? mode === "login"
                  ? "Signing in..."
                  : "Creating account..."
                : mode === "login"
                ? "Sign in"
                : "Create account"}
            </Button>
            {hasCachedRoutes && onContinueOffline && (
              <Button
                type="button"
                className="border border-slate-300 bg-white font-medium text-slate-700"
                onClick={onContinueOffline}
              >
                Use saved routes offline
              </Button>
            )}
          </form>
        </div>
      </section>
    </main>
  );
};

export default AuthScreen;
