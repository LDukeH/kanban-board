import { useRef, useState } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle, Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import {
  loginSchema,
  type LoginFormSchema,
} from "@/lib/validations/auth.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { loginUser, loginWithGoogle } from "@/lib/api/auth.api";
import { describeAuthFormError } from "@/lib/httpStatus";
import { useQueryClient } from "@tanstack/react-query";
import CaptchaField from "./CaptchaField";

interface LoginFormProps {
  onNavigate: (target: "login" | "register" | "forgot") => void;
}

export default function LoginForm({ onNavigate }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const captcha = useRef<HCaptcha>(null);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormSchema>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginFormSchema) {
    setFormError(null);
    if (!captchaToken) {
      setFormError("Please complete the hCaptcha challenge.");
      return;
    }
    try {
      await loginUser(data, captchaToken);

      await queryClient.refetchQueries({ queryKey: ["currentUser"] });
    } catch (error) {
      setFormError(describeAuthFormError(error, "Sign in"));
    } finally {
      captcha.current?.resetCaptcha();
      setCaptchaToken("");
    }
  }
  async function handleGoogleLogin() {
    setFormError(null);
    try {
      await loginWithGoogle();
    } catch (error) {
      setFormError(describeAuthFormError(error, "Sign in with Google"));
    }
  }
  return (
    <div className="flex flex-col gap-6 w-full max-w-md mx-auto px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to continue to your work.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        {formError && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{formError}</span>
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            placeholder="name@example.com"
            required
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          <p className="text-xs min-h-1 text-red-500 ">
            {errors.email?.message}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">Password</Label>
            <button
              type="button"
              onClick={() => onNavigate("forgot")}
              className="text-xs font-medium text-primary hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
              className="pr-9"
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          <p className="text-xs min-h-1 text-red-500">
            {errors.password?.message}
          </p>
        </div>

        <CaptchaField ref={captcha} onTokenChange={setCaptchaToken} />

        <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <LogIn className="size-4" aria-hidden />
          )}
          {isSubmitting ? "Signing in…" : "Sign In"}
        </Button>
      </form>

      <Button type="button" variant="outline" className="w-full gap-2" onClick={() => void handleGoogleLogin()}>
        <GoogleIcon />
        Continue with Google
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <button
          type="button"
          onClick={() => onNavigate("register")}
          className="font-medium text-primary hover:underline inline cursor-pointer"
        >
          Sign up
        </button>
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      viewBox="0 0 24 24"
      role="img"
    >
      <path
        fill="#4285F4"
        d="M21.35 12.27c0-.7-.06-1.38-.18-2.02H12v3.83h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.2Z"
      />
      <path
        fill="#34A853"
        d="M12 21.75c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.75 9.75 0 0 0 12 21.75Z"
      />
      <path
        fill="#FBBC05"
        d="M6.54 13.83A5.86 5.86 0 0 1 6.23 12c0-.64.11-1.26.31-1.83V7.64H3.3A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.05 1.05 4.36l3.24-2.53Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.14c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.83 3.23 14.63 2.25 12 2.25a9.75 9.75 0 0 0-8.7 5.39l3.24 2.53c.77-2.31 2.92-4.03 5.46-4.03Z"
      />
    </svg>
  );
}
