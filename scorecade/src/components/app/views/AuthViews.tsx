"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import { SITE_NAME } from "@/lib/config";
import { Wordmark } from "@/components/app/Wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function goToAfterLogin(from: string | null) {
  let target = "#/";
  if (from) {
    try {
      target = decodeURIComponent(from);
      if (!target.startsWith("#")) target = "#/";
    } catch {
      target = "#/";
    }
  }
  window.location.hash = target;
}

export function LoginView({ from }: { from: string | null }) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    document.title = `Вход — ${SITE_NAME}`;
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError("Введите никнейм и пароль.");
      return;
    }
    setPending(true);
    try {
      const user = await login(username.trim(), password);
      toast.success(`С возвращением, ${user.username}!`);
      goToAfterLogin(from);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Не удалось войти. Попробуйте ещё раз.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-sm flex-col py-10 md:py-16">
      <div className="mb-8 flex justify-center">
        <a href="#/" className="flex items-center gap-2">
          <Wordmark />
        </a>
      </div>
      <div className="rounded-2xl border border-border/70 bg-card/70 p-6 shadow-xl">
        <h1 className="text-xl font-extrabold">Вход</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Рады видеть вас снова в {SITE_NAME}
        </p>
        <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="login-username">Никнейм</Label>
            <Input
              id="login-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="например, arcade_fan"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="login-password">Пароль</Label>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <LogIn className="h-4 w-4" aria-hidden />
            )}
            Войти
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Нет аккаунта?{" "}
          <a
            href={from ? `#/register?from=${encodeURIComponent(from)}` : "#/register"}
            className="font-bold text-primary hover:underline"
          >
            Зарегистрируйтесь
          </a>
        </p>
      </div>
    </div>
  );
}

export function RegisterView({ from }: { from: string | null }) {
  const { register } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    document.title = `Регистрация — ${SITE_NAME}`;
  }, []);

  const usernameValid = /^[a-zA-Z0-9_]{3,20}$/.test(username);
  const passwordValid = password.length >= 8;
  const canSubmit = usernameValid && passwordValid && !pending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!canSubmit) return;
    setPending(true);
    try {
      const user = await register(username, password);
      toast.success(`Аккаунт создан. Добро пожаловать, ${user.username}!`);
      goToAfterLogin(from);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Не удалось создать аккаунт.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-sm flex-col py-10 md:py-16">
      <div className="mb-8 flex justify-center">
        <a href="#/" className="flex items-center gap-2">
          <Wordmark />
        </a>
      </div>
      <div className="rounded-2xl border border-border/70 bg-card/70 p-6 shadow-xl">
        <h1 className="text-xl font-extrabold">Регистрация</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Аккаунт нужен, чтобы сохранять оценки и подписываться на друзей
        </p>
        <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="reg-username">Никнейм</Label>
            <Input
              id="reg-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="3–20 символов: латиница, цифры, _"
              aria-invalid={username.length > 0 && !usernameValid}
            />
            {username.length > 0 && !usernameValid && (
              <p className="text-xs text-amber-400">
                3–20 символов: латиница, цифры и знак подчёркивания
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-password">Пароль</Label>
            <div className="relative">
              <Input
                id="reg-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="минимум 8 символов"
                className="pr-10"
                aria-invalid={password.length > 0 && !passwordValid}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
            {password.length > 0 && !passwordValid && (
              <p className="text-xs text-amber-400">
                Пароль должен быть не короче 8 символов
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={!canSubmit}
            className={cn("w-full", !canSubmit && "opacity-60")}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <UserPlus className="h-4 w-4" aria-hidden />
            )}
            Создать аккаунт
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Уже есть аккаунт?{" "}
          <a
            href={from ? `#/login?from=${encodeURIComponent(from)}` : "#/login"}
            className="font-bold text-primary hover:underline"
          >
            Войти
          </a>
        </p>
      </div>
      <p className="mt-4 px-4 text-center text-[11px] leading-relaxed text-muted-foreground/70">
        Пароль хранится только в виде хэша. Мы не спрашиваем почту — только
        никнейм и пароль.
      </p>
    </div>
  );
}
