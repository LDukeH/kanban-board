import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  UserPlus,
} from "lucide-react";
import {
  registerSchema,
  type RegisterFormSchema,
} from "@/lib/validations/auth.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { loginUser, registerUser } from "@/lib/api/auth.api";
import { describeAuthFormError } from "@/lib/httpStatus";
import { useQueryClient } from "@tanstack/react-query";

interface RegisterFormProps {
  onNavigate: (target: "login" | "register") => void;
}

export default function RegisterForm({ onNavigate }: RegisterFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(
    null,
  );
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormSchema>({
    resolver: zodResolver(registerSchema),
  });

  // The backend's register endpoint creates the account but does not start a
  // session (it returns the created user, no cookie). Log the new account in
  // explicitly so the user lands signed in instead of bouncing to login.
  async function onSubmit(data: RegisterFormSchema) {
    setFormError(null);
    try {
      const result = await registerUser(data);
      if (result.requiresEmailConfirmation) {
        setConfirmationEmail(data.email.trim().toLowerCase());
        return;
      }
      await loginUser({ email: data.email, password: data.password });
      await queryClient.refetchQueries({ queryKey: ["currentUser"] });
    } catch (error) {
      setFormError(describeAuthFormError(error, "Create account"));
    }
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-md mx-auto px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">
          Create your account
        </h1>
        <p className="text-sm text-muted-foreground">
          Start organizing your work with your Kanban workspace.
        </p>
      </div>

      {confirmationEmail ? (
        <div className="flex flex-col gap-4">
          <p
            role="status"
            className="flex items-start gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary"
          >
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Your account was created. We sent a confirmation link to{" "}
              <strong>{confirmationEmail}</strong>. Confirm your email, then
              return here to sign in.
            </span>
          </p>
          <Button type="button" variant="outline" onClick={() => onNavigate("login")}>
            Go to sign in
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
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
          <Label htmlFor="register-email">Email</Label>
          <Input
            id="register-email"
            type="email"
            placeholder="name@example.com"
            required
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          <p className="min-h-1 text-sm text-destructive">
            {errors.email?.message}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="register-password">Password</Label>
          <div className="relative">
            <Input
              id="register-password"
              type={showPassword ? "text" : "password"}
              placeholder="Create a password"
              required
              autoComplete="new-password"
              className="pr-9"
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
          <p className="text-xs min-h-1 text-red-500 mt-1">
            {errors.password?.message}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="register-confirm-password">Confirm password</Label>
          <div className="relative">
            <Input
              id="register-confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm your password"
              required
              autoComplete="new-password"
              className="pr-9"
              {...register("confirmPassword")}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
              aria-label={
                showConfirmPassword ? "Hide password" : "Show password"
              }
            >
              {showConfirmPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>

          <p className="text-xs min-h-1 text-red-500 mt-1">
            {errors.confirmPassword?.message}
          </p>
        </div>

        <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <UserPlus className="size-4" aria-hidden />
          )}
          {isSubmitting ? "Creating account…" : "Create Account"}
        </Button>
        </form>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <button
          type="button"
          onClick={() => onNavigate("login")}
          className="font-medium text-primary hover:underline inline cursor-pointer"
        >
          Sign in
        </button>
      </p>
    </div>
  );
}
