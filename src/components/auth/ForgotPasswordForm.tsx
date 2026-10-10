import { useRef, useState } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { AlertCircle, ArrowLeft, Loader2, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  forgotPasswordSchema,
  type ForgotPasswordFormSchema,
} from "@/lib/validations/auth.schema";
import { requestPasswordReset } from "@/lib/api/auth.api";
import { describeAuthFormError } from "@/lib/httpStatus";
import CaptchaField from "./CaptchaField";

interface ForgotPasswordFormProps {
  onNavigate: (target: "login" | "register" | "forgot") => void;
}

export default function ForgotPasswordForm({
  onNavigate,
}: ForgotPasswordFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const captcha = useRef<HCaptcha>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormSchema>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  async function onSubmit(data: ForgotPasswordFormSchema) {
    setFormError(null);
    if (!captchaToken) {
      setFormError("Please complete the hCaptcha challenge.");
      return;
    }
    try {
      await requestPasswordReset(data, captchaToken);
      setIsSent(true);
    } catch (error) {
      setFormError(describeAuthFormError(error, "Send reset email"));
    } finally {
      captcha.current?.resetCaptcha();
      setCaptchaToken("");
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-6 mx-auto px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a link to choose a new password.
        </p>
      </div>

      {isSent ? (
        <div className="flex flex-col gap-4">
          <p className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
            If an account exists for that email, a password reset link has been
            sent. Check your inbox and spam folder.
          </p>
          <Button type="button" variant="outline" onClick={() => onNavigate("login")}>
            <ArrowLeft className="size-4" aria-hidden />
            Back to sign in
          </Button>
        </div>
      ) : (
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
            <Label htmlFor="forgot-email">Email</Label>
            <Input
              id="forgot-email"
              type="email"
              placeholder="name@example.com"
              required
              autoComplete="email"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            <p className="min-h-1 text-xs text-red-500">
              {errors.email?.message}
            </p>
          </div>
          <CaptchaField ref={captcha} onTokenChange={setCaptchaToken} />
          <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Mail className="size-4" aria-hidden />
            )}
            {isSubmitting ? "Sending…" : "Send reset link"}
          </Button>
          <button
            type="button"
            onClick={() => onNavigate("login")}
            className="inline-flex items-center justify-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to sign in
          </button>
        </form>
      )}
    </div>
  );
}
