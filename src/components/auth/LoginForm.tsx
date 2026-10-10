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
import { loginUser } from "@/lib/api/auth.api";
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
