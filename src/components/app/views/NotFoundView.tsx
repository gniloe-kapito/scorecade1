"use client";

import { Ghost } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/EmptyState";
import { SITE_NAME } from "@/lib/config";
import { useEffect } from "react";

export function NotFoundView() {
  useEffect(() => {
    document.title = `Страница не найдена — ${SITE_NAME}`;
  }, []);
  return (
    <div className="py-16">
      <EmptyState
        icon={Ghost}
        title="Такой страницы нет"
        hint="Возможно, ссылка устарела или в ней опечатка."
        action={
          <Button asChild>
            <a href="#/">На главную</a>
          </Button>
        }
      />
    </div>
  );
}
