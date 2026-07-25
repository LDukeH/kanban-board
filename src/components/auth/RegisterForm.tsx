import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import OAuthButtons from "./OAuthButtons";
import {
  registerSchema,
  type RegisterFormSchema,
} from "@/lib/validations/auth.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { registerUser } from "@/lib/api/auth.api";

interface RegisterFormProps {
  onNavigate: (target: "login" | "register") => void;
}

export default function RegisterForm({ onNavigate }: RegisterFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Validation
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormSchema>({
    resolver: zodResolver(registerSchema),
  });

  function onSubmit(data: RegisterFormSchema) {
    // Call the register API
    registerUser(data)
      .then((response) => {
        console.log("Registration successful:", response);
      })
      .catch((error) => {
        console.error("Registration failed:", error);
      });
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-md mx-auto px-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">
          Create your account
        </h1>
        <p className="text-sm text-muted-foreground">
          Start organizing your work with your Kanban workspace.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 mb-1">
          <Label htmlFor="register-name">Full name</Label>
          <Input
            id="register-name"
            type="text"
            placeholder="John Doe"
            required
            autoComplete="name"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="register-email">Email</Label>
          <Input
            id="register-email"
            type="email"
            placeholder="name@example.com"
            required
            autoComplete="email"
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

        <Button type="submit" className="w-full gap-2">
          <UserPlus className="size-4" />
          Create Account
        </Button>
      </form>

      {/* OAuth */}
      <OAuthButtons />

      {/* Navigation */}
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
