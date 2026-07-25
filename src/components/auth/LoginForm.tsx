import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, LogIn } from "lucide-react";
import {
  loginSchema,
  type LoginFormSchema,
} from "@/lib/validations/auth.schema";
import OAuthButtons from "./OAuthButtons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { loginUser } from "@/lib/api/auth.api";
import { useQueryClient } from "@tanstack/react-query";

interface LoginFormProps {
  onNavigate: (target: "login" | "register") => void;
}

export default function LoginForm({ onNavigate }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const queryClient = useQueryClient();
  // Validation
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginFormSchema) {
    // Call the login API
    try {
      await loginUser(data);

      // Refetch
      await queryClient.refetchQueries({ queryKey: ["currentUser"] });
    } catch (error) {
      console.error("Login failed:", error);
    }
  }
  return (
    <div className="flex flex-col gap-6 w-full max-w-md mx-auto px-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to continue to your work.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            placeholder="name@example.com"
            required
            autoComplete="email"
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
              className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              onClick={() => {
                // Placeholder — forgot password not implemented
              }}
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

        <Button type="submit" className="w-full gap-2">
          <LogIn className="size-4" />
          Sign In
        </Button>
      </form>

      {/* OAuth */}
      <OAuthButtons />

      {/* Navigation */}
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
