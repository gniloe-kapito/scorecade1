"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { loginRedirectUrl } from "@/lib/router";

export function FollowButton({
  username,
  initialFollowing,
  size = "sm",
  className,
}: {
  username: string;
  initialFollowing: boolean | null;
  size?: "sm" | "default";
  className?: string;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [following, setFollowing] = useState(initialFollowing === true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setFollowing(initialFollowing === true);
  }, [initialFollowing]);

  const toggle = async () => {
    if (!user) {
      window.location.hash = loginRedirectUrl();
      return;
    }
    if (pending) return;
    setPending(true);
    const next = !following;
    setFollowing(next); // optimistic
    try {
      await api(`/api/users/${encodeURIComponent(username)}/follow`, {
        method: next ? "POST" : "DELETE",
      });
      queryClient.invalidateQueries({ queryKey: ["profile", username] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["friendsRatings"] });
      queryClient.invalidateQueries({ queryKey: ["userList", username] });
      toast.success(
        next ? `Вы подписались на ${username}` : `Вы отписались от ${username}`,
      );
    } catch (err) {
      setFollowing(!next);
      toast.error(
        err instanceof ApiError ? err.message : "Не удалось обновить подписку",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      onClick={toggle}
      disabled={pending}
      variant={following ? "secondary" : "default"}
      size={size}
      className={className}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : following ? (
        <Check className="h-4 w-4" aria-hidden />
      ) : (
        <UserPlus className="h-4 w-4" aria-hidden />
      )}
      {following ? "Вы подписаны" : "Подписаться"}
    </Button>
  );
}
