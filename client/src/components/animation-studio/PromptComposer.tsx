import { useMemo, useState } from "react";
import { Scene, PromptVariant, PromptTokenSelection } from "./types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { RefreshCw, Split, History, Copy } from "lucide-react";

interface PromptComposerProps {
  scene: Scene;
  autoPrompt: string;
  onUpdate: (sceneId: string, updates: Partial<Scene>) => void;
}

const TOKEN_PRESETS = {
  shot: ["Establishing", "Medium", "Close-up", "Two-shot", "Over-shoulder"],
  cameraMove: ["Static", "Dolly-in", "Parallax", "Tilt-up", "Whip-pan", "Orbit"],
  mood: ["Warm", "Nostalgic", "Chaotic", "Suspenseful", "Tender"],
  lighting: ["Golden hour", "Neon", "Lab fluorescents", "Moonlit", "Stage spot"],
  style: ["Classic comic", "Halftone+", "Painterly", "Cel-shade", "Analog film"],
} as const;

const EMPTY_TOKENS: PromptTokenSelection = {
  shot: null,
  cameraMove: null,
  mood: null,
  lighting: null,
  style: null,
  consistencyLocks: [],
};

function buildPrompt(tokens: PromptTokenSelection, freeform: string, fallback: string) {
  const pieces: string[] = [];
  if (tokens.shot || tokens.cameraMove || tokens.mood || tokens.lighting || tokens.style) {
    const descriptors = [tokens.shot, tokens.cameraMove, tokens.mood, tokens.lighting, tokens.style]
      .filter(Boolean)
      .join(", ");
    if (descriptors) {
      pieces.push(descriptors);
    }
  }
  if (freeform.trim().length > 0) {
    pieces.push(freeform.trim());
  } else if (fallback) {
    pieces.push(fallback);
  }
  if (tokens.consistencyLocks.length > 0) {
    pieces.push(`Consistency locks: ${tokens.consistencyLocks.join(", ")}`);
  }
  return pieces.join(". ").trim();
}

export function PromptComposer({ scene, autoPrompt, onUpdate }: PromptComposerProps) {
  const [lockDraft, setLockDraft] = useState("");

  const composedPrompt = useMemo(
    () => buildPrompt(scene.promptTokens, scene.promptFreeform, autoPrompt),
    [scene.promptTokens, scene.promptFreeform, autoPrompt],
  );

  const handleTokenChange = (key: keyof Omit<PromptTokenSelection, "consistencyLocks">, value: string) => {
    const nextTokens: PromptTokenSelection = { ...scene.promptTokens, [key]: scene.promptTokens[key] === value ? null : value };
    const nextPrompt = buildPrompt(nextTokens, scene.promptFreeform, autoPrompt);
    onUpdate(scene.id, {
      promptTokens: nextTokens,
      prompt: nextPrompt,
      promptWasEdited: true,
    });
  };

  const handleFreeformChange = (value: string) => {
    const nextPrompt = buildPrompt(scene.promptTokens, value, autoPrompt);
    onUpdate(scene.id, {
      promptFreeform: value,
      prompt: nextPrompt,
      promptWasEdited: true,
    });
  };

  const handleAddLock = () => {
    const trimmed = lockDraft.trim();
    if (!trimmed) return;
    const nextTokens: PromptTokenSelection = {
      ...scene.promptTokens,
      consistencyLocks: [...scene.promptTokens.consistencyLocks, trimmed],
    };
    const nextPrompt = buildPrompt(nextTokens, scene.promptFreeform, autoPrompt);
    onUpdate(scene.id, {
      promptTokens: nextTokens,
      prompt: nextPrompt,
      promptWasEdited: true,
    });
    setLockDraft("");
  };

  const handleRemoveLock = (lock: string) => {
    const nextTokens: PromptTokenSelection = {
      ...scene.promptTokens,
      consistencyLocks: scene.promptTokens.consistencyLocks.filter(entry => entry !== lock),
    };
    const nextPrompt = buildPrompt(nextTokens, scene.promptFreeform, autoPrompt);
    onUpdate(scene.id, {
      promptTokens: nextTokens,
      prompt: nextPrompt,
      promptWasEdited: true,
    });
  };

  const handleVariantChange = (variant: PromptVariant) => {
    if (variant === scene.activePromptVariant) return;
    const fallback = scene.promptVariants[variant] ?? composedPrompt;
    onUpdate(scene.id, {
      activePromptVariant: variant,
      prompt: fallback,
      promptFreeform: fallback,
    });
  };

  const handleForkVariant = () => {
    const target: PromptVariant = scene.activePromptVariant === "A" ? "B" : "A";
    onUpdate(scene.id, {
      promptVariants: { ...scene.promptVariants, [target]: scene.prompt },
      activePromptVariant: target,
    });
  };

  const handleReset = () => {
    onUpdate(scene.id, {
      promptTokens: { ...EMPTY_TOKENS },
      promptFreeform: "",
      prompt: autoPrompt,
      promptWasEdited: false,
    });
  };

  const handleRestorePrompt = (prompt: string) => {
    onUpdate(scene.id, {
      prompt: prompt,
      promptFreeform: prompt,
      promptWasEdited: true,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="secondary" className="rounded-full">Prompt variants</Badge>
        {["A", "B"].map(variant => (
          <Button
            key={variant}
            type="button"
            size="sm"
            variant={scene.activePromptVariant === variant ? "default" : "outline"}
            className="rounded-full"
            onClick={() => handleVariantChange(variant as PromptVariant)}
          >
            Variant {variant}
          </Button>
        ))}
        <Button type="button" size="sm" variant="ghost" className="gap-2" onClick={handleForkVariant}>
          <Split className="h-3 w-3" /> Duplicate to other variant
        </Button>
      </div>

      <div className="grid gap-3 text-xs sm:grid-cols-2">
        {(Object.keys(TOKEN_PRESETS) as (keyof typeof TOKEN_PRESETS)[]).map(key => (
          <div key={key} className="rounded-2xl border border-border/60 bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-semibold capitalize">{key}</span>
              {scene.promptTokens[key as keyof Omit<PromptTokenSelection, "consistencyLocks">] ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleTokenChange(key as keyof Omit<PromptTokenSelection, "consistencyLocks">, scene.promptTokens[key as keyof Omit<PromptTokenSelection, "consistencyLocks">] as string)}
                >
                  Clear
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {TOKEN_PRESETS[key].map(option => (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant={scene.promptTokens[key as keyof Omit<PromptTokenSelection, "consistencyLocks">] === option ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => handleTokenChange(key as keyof Omit<PromptTokenSelection, "consistencyLocks">, option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Freeform notes
          <Button type="button" size="sm" variant="ghost" className="gap-1" onClick={handleReset}>
            <RefreshCw className="h-3 w-3" /> Reset to story
          </Button>
        </div>
        <Textarea
          value={scene.promptFreeform}
          onChange={event => handleFreeformChange(event.target.value)}
          rows={4}
          placeholder={autoPrompt || "Describe motion, mood, and pacing overrides."}
          className="mt-3"
        />
        <p className="mt-2 text-[11px] text-muted-foreground">{composedPrompt.length} characters</p>
      </div>

      <div className="rounded-2xl border border-dashed border-border/60 p-4 text-xs">
        <div className="mb-2 font-semibold uppercase tracking-wide text-muted-foreground">Consistency locks</div>
        <div className="flex flex-wrap gap-2">
          {scene.promptTokens.consistencyLocks.map(lock => (
            <Badge key={lock} variant="outline" className="rounded-full">
              {lock}
              <button className="ml-2 text-[10px] uppercase" onClick={() => handleRemoveLock(lock)}>
                Remove
              </button>
            </Badge>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Input
            value={lockDraft}
            onChange={event => setLockDraft(event.target.value)}
            placeholder="Add Zara hair=curly, palette=page-01"
          />
          <Button type="button" size="sm" onClick={handleAddLock}>
            Add
          </Button>
        </div>
      </div>

      {scene.promptVersionHistory.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-xs">
          <div className="mb-2 flex items-center gap-2 font-semibold uppercase tracking-wide text-muted-foreground">
            <History className="h-3 w-3" /> Version history
          </div>
          <div className="space-y-2">
            {scene.promptVersionHistory.map((entry, index) => (
              <div key={`${entry}-${index}`} className="flex items-center justify-between gap-3">
                <p className="line-clamp-2 text-muted-foreground">{entry}</p>
                <Button type="button" size="sm" variant="ghost" className="gap-1" onClick={() => handleRestorePrompt(entry)}>
                  <Copy className="h-3 w-3" /> Restore
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
