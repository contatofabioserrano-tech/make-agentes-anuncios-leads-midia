"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { agentForStage } from "@/lib/flow";
import type { Message, StageKey } from "@/lib/types";
import {
  approveStage,
  ensureKickoff,
  requestAdjustment,
  sendUserMessage,
} from "./actions";

interface Props {
  projectId: string;
  initialMessages: Message[];
  currentStage: StageKey;
}

export function ProjectChat({ projectId, initialMessages, currentStage }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustText, setAdjustText] = useState("");
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const kickedRef = useRef(false);

  const inSquad = agentForStage(currentStage) !== null;

  // Keep local state in sync when the server revalidates.
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  // Kick off the conversation on first load if empty.
  useEffect(() => {
    if (kickedRef.current) return;
    if (initialMessages.length === 0 && inSquad) {
      kickedRef.current = true;
      startTransition(async () => {
        await ensureKickoff(projectId);
        router.refresh();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime: append new messages for this project.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
          );
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Auto-scroll on new messages.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, pending]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || pending) return;
    setInput("");
    startTransition(async () => {
      await sendUserMessage(projectId, text);
      router.refresh();
    });
  }

  function handleApprove() {
    if (pending) return;
    setAdjustOpen(false);
    startTransition(async () => {
      await approveStage(projectId);
      router.refresh();
    });
  }

  function handleAdjustSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = adjustText.trim();
    if (!text || pending) return;
    setAdjustText("");
    setAdjustOpen(false);
    startTransition(async () => {
      await requestAdjustment(projectId, text);
      router.refresh();
    });
  }

  // The latest approval_request still open for action sits at the tail.
  const lastApprovalIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].kind === "approval_request") return i;
    }
    return -1;
  })();
  const hasOpenApproval =
    inSquad &&
    lastApprovalIndex !== -1 &&
    !messages
      .slice(lastApprovalIndex + 1)
      .some(
        (m) => m.role === "user" && m.kind === "approval_response"
      );

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* Thread */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto scroll-thin px-6 py-6 sm:px-8"
      >
        {messages.length === 0 && pending && (
          <div className="flex items-center gap-2 text-sm text-muted-fg">
            <span className="h-2 w-2 animate-ping rounded-full bg-brand-blue" />
            A squad está iniciando…
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {pending && messages.length > 0 && (
          <div className="flex items-center gap-2 pl-1 text-sm text-muted-fg">
            <span className="inline-flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-violet [animation-delay:-0.2s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-violet [animation-delay:-0.1s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-violet" />
            </span>
            processando…
          </div>
        )}
      </div>

      {/* Action zone */}
      <div className="border-t border-black/[0.06] bg-surface-muted px-6 py-4 sm:px-8">
        {hasOpenApproval && !adjustOpen && (
          <div className="mb-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleApprove}
              disabled={pending}
              className="btn-primary"
            >
              ✓ Aprovar
            </button>
            <button
              type="button"
              onClick={() => setAdjustOpen(true)}
              disabled={pending}
              className="btn-secondary"
            >
              ✎ Ajustar
            </button>
          </div>
        )}

        {hasOpenApproval && adjustOpen && (
          <form onSubmit={handleAdjustSubmit} className="mb-3 space-y-2">
            <label className="label" htmlFor="adjust">
              O que ajustar nesta etapa?
            </label>
            <textarea
              id="adjust"
              autoFocus
              value={adjustText}
              onChange={(e) => setAdjustText(e.target.value)}
              className="input min-h-[72px] resize-y"
              placeholder="Ex.: deixar o hook mais direto e cortar a primeira cena."
              disabled={pending}
            />
            <div className="flex gap-3">
              <button type="submit" disabled={pending} className="btn-primary">
                Enviar ajuste
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdjustOpen(false);
                  setAdjustText("");
                }}
                disabled={pending}
                className="btn-secondary"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Free-form composer */}
        <form onSubmit={handleSend} className="flex items-end gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="input flex-1"
            placeholder={
              inSquad
                ? "Fale com a squad…"
                : "Render em andamento — acompanhe ao lado."
            }
            disabled={pending}
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            className="btn-primary shrink-0"
          >
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <p className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-medium text-emerald-700">
          {message.text}
        </p>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] animate-fade-in rounded-2xl rounded-br-md bg-brand-gradient px-4 py-2.5 text-sm text-white shadow-soft">
          {message.text}
        </div>
      </div>
    );
  }

  // agent
  const isApproval = message.kind === "approval_request";
  return (
    <div className="flex animate-fade-in gap-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-dark text-base">
        {message.emoji ?? "🤖"}
      </div>
      <div className="min-w-0 max-w-[85%]">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-sm font-semibold text-ink">
            {message.agent ?? "Agente"}
          </span>
          {message.meta &&
            typeof message.meta.role_desc === "string" && (
              <span className="text-xs text-muted-fg">
                {message.meta.role_desc as string}
              </span>
            )}
        </div>
        <div
          className={`rounded-2xl rounded-tl-md px-4 py-2.5 text-sm ${
            isApproval
              ? "border border-brand-blue/20 bg-brand-blue/[0.06] text-ink"
              : "bg-surface-muted text-ink/90"
          }`}
        >
          {message.text}
        </div>
      </div>
    </div>
  );
}
