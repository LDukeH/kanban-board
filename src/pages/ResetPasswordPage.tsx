import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  resetPasswordSchema,
  type ResetPasswordFormSchema,
} from "@/lib/validations/auth.schema";
import { updatePassword } from "@/lib/api/auth.api";
import { describeAuthFormError } from "@/lib/httpStatus";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isUpdated, setIsUpdated] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormSchema>({
    resolver: zodResolver(resetPasswordSchema),
  });

  async function onSubmit(data: ResetPasswordFormSchema) {
    setFormError(null);
    try {
      await updatePassword(data.password);
      await supabase.auth.signOut();
      setIsUpdated(true);
    } catch (error) {
      setFormError(describeAuthFormError(error, "Update password"));
    }
  }

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-background px-6 py-12">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
          <p className="text-sm text-muted-foreground">
            Use at least 8 characters for your new password.
          </p>
        </div>

        {isUpdated ? (
          <div className="flex flex-col gap-4">
            <p className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
              Your password has been updated. You can now sign in with it.
            </p>
            <Button type="button" onClick={() => navigate("/auth")}>
              Go to sign in
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
            <PasswordField
              id="reset-password"
              label="New password"
              autoComplete="new-password"
              error={errors.password?.message}
              visible={showPassword}
              onToggle={() => setShowPassword((visible) => !visible)}
              register={register("password")}
            />
            <PasswordField
              id="reset-confirm-password"
              label="Confirm new password"
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              visible={showConfirmPassword}
              onToggle={() => setShowConfirmPassword((visible) => !visible)}
              register={register("confirmPassword")}
            />
            <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {!isSubmitting && <KeyRound className="size-4" aria-hidden />}
              {isSubmitting ? "Updating…" : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

interface PasswordFieldProps {
  id: string;
  label: string;
  autoComplete: "new-password";
  error?: string;
  visible: boolean;
  onToggle: () => void;
  register: UseFormRegisterReturn;
}

function PasswordField({
  id,
  label,
  autoComplete,
  error,
  visible,
  onToggle,
  register,
}: PasswordFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          className="pr-9"
          aria-invalid={!!error}
          {...register}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <p className="min-h-1 text-xs text-red-500">{error}</p>
    </div>
  );
}
