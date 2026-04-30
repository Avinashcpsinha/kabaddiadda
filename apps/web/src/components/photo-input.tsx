'use client';

import * as React from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const ACCEPTED = 'image/jpeg,image/png,image/webp';
const MAX_BYTES = 2 * 1024 * 1024;

export function PhotoInput({
  name = 'photo',
  className,
}: {
  name?: string;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setError(null);

    if (!file) {
      setPreview(null);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Photo must be under 2MB');
      e.target.value = '';
      setPreview(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = '';
    setPreview(null);
    setError(null);
  }

  return (
    <div className={cn('space-y-2', className)}>
      <label
        className={cn(
          'group relative flex h-24 w-full cursor-pointer items-center justify-center gap-3 overflow-hidden rounded-md border border-dashed border-input transition-colors hover:border-primary/60 hover:bg-accent/30',
          preview && 'border-solid border-border bg-muted/30',
        )}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Player photo preview" className="h-full w-auto object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <ImagePlus className="h-5 w-5" />
            <span className="text-xs font-medium">Add photo</span>
            <span className="text-[10px] opacity-70">JPG, PNG or WebP · max 2MB</span>
          </div>
        )}
        <input
          ref={inputRef}
          name={name}
          type="file"
          accept={ACCEPTED}
          onChange={onChange}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
        {!preview && (
          <Camera className="absolute right-2 top-2 h-4 w-4 text-muted-foreground/40 group-hover:text-primary" />
        )}
      </label>

      {preview && (
        <button
          type="button"
          onClick={clear}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
        >
          <X className="h-3 w-3" />
          Remove photo
        </button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
