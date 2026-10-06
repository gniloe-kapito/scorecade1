"use client";

import { Component, useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";
import { WifiOff } from "lucide-react";
import { useHashRoute } from "@/lib/router";
import { useAuth } from "@/lib/auth-context";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { Footer } from "./Footer";
import { BackToTop } from "./BackToTop";
import { HomeView } from "./views/HomeView";
import { GameView } from "./views/GameView";
import { ProfileView } from "./views/ProfileView";
import { FeedView } from "./views/FeedView";
import { LoginView, RegisterView } from "./views/AuthViews";
import { UserListView } from "./views/UserListView";
import { NotFoundView } from "./views/NotFoundView";

class RouteErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(err: Error) {
    return { hasError: true, message: err?.message ?? "Неизвестная ошибка" };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="py-20 text-center">
          <h2 className="text-2xl font-extrabold">Что-то пошло не так</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {this.state.message}
          </p>
          <Button asChild className="mt-6">
            <a href="#/">На главную</a>
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** #/me — my profile or a login prompt. */
function MeView() {
  const { user, ready } = useAuth();
  if (!ready) {
    return <GameSkeletonBlock />;
  }
  if (!user) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-extrabold">Это ваш профиль</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Но пока вы не вошли в аккаунт. Войдите — и здесь появятся ваши оценки,
          статистика и подписки.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild>
            <a href="#/login">Войти</a>
          </Button>
          <Button asChild variant="secondary">
            <a href="#/register">Создать аккаунт</a>
          </Button>
        </div>
      </div>
    );
  }
  return <ProfileView username={user.username} isMe />;
}

function GameSkeletonBlock() {
  return (
    <div className="py-6">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="mt-4 h-4 w-1/3" />
      <Skeleton className="mt-8 h-40 w-full rounded-2xl" />
    </div>
  );
}

export function App() {
  const route = useHashRoute();
  const online = useOnlineStatus();

  // Scroll to top on navigation
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route.path]);

  const seg = route.segments;
  let view: ReactNode;
  let isGame = false;

  if (seg.length === 0) {
    view = <HomeView />;
  } else if (seg[0] === "game" && seg[1]) {
    isGame = true;
    view = <GameView id={seg[1]} />;
  } else if (seg[0] === "u" && seg[1]) {
    if (seg[2] === "followers" || seg[2] === "following") {
      view = <UserListView username={seg[1]} kind={seg[2]} />;
    } else {
      view = <ProfileView username={seg[1]} />;
    }
  } else if (seg[0] === "feed") {
    view = <FeedView />;
  } else if (seg[0] === "me") {
    view = <MeView />;
  } else if (seg[0] === "login") {
    view = <LoginView from={route.query.get("from")} />;
  } else if (seg[0] === "register") {
    view = <RegisterView from={route.query.get("from")} />;
  } else {
    view = <NotFoundView />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {!online && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 top-2 z-[70] mx-auto flex w-fit items-center gap-2 rounded-full border border-amber-400/40 bg-card/95 px-4 py-2 text-xs font-bold text-amber-300 shadow-lg backdrop-blur"
        >
          <WifiOff className="h-4 w-4" aria-hidden />
          Нет соединения — офлайн-режим
        </div>
      )}
      {!isGame && <Header />}
      <div className="flex-1">
        <main className="mx-auto w-full max-w-[900px] px-4 pb-12">
          <div key={route.path} className="animate-view-in">
            <RouteErrorBoundary>{view}</RouteErrorBoundary>
          </div>
        </main>
      </div>
      <Footer />
      <BottomNav />
      <BackToTop />
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          style: {
            background: "var(--card)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
          },
        }}
      />
    </div>
  );
}
