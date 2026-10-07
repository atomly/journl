"use client";

import { fileToAvatarDataUrl } from "@better-auth-ui/core";
import { useAuth, useSession, useUpdateUser } from "@better-auth-ui/react";
import { Trash2, Upload } from "lucide-react";
import { type ChangeEvent, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { UserAvatar } from "~/components/auth/user/user-avatar";
import { Button } from "~/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "~/components/ui/field";
import { Spinner } from "~/components/ui/spinner";

const MAX_AVATAR_FILE_BYTES = 5 * 1024 * 1024;
const AVATAR_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export type ChangeAvatarProps = {
  className?: string;
};

// Adapted from Better Auth UI's Base UI user-profile registry item:
// https://better-auth-ui.com/r/base-nova/user-profile.json
// Keep its resize/upload/delete hooks, with local validation and awaited saves.
export function ChangeAvatar({ className }: ChangeAvatarProps) {
  const { authClient, localization, avatar } = useAuth();
  const { data: session } = useSession(authClient);

  const { mutateAsync: updateUser, isPending: updatePending } =
    useUpdateUser(authClient);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const descriptionId = useId();
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isPending = updatePending || isUploading || isDeleting;

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = "";
    setError(null);

    if (!session || isPending) return;
    if (!AVATAR_FILE_TYPES.includes(file.type)) {
      setError("Choose a JPG, PNG, WebP, or GIF image.");
      return;
    }
    if (file.size === 0 || file.size > MAX_AVATAR_FILE_BYTES) {
      setError("Choose an image smaller than 5 MB that isn't empty.");
      return;
    }

    setIsUploading(true);

    let image: string;
    try {
      const resized =
        (await avatar.resize?.(file, avatar.size, avatar.extension)) || file;

      image = avatar.upload
        ? await avatar.upload(resized)
        : await fileToAvatarDataUrl(resized);
    } catch {
      setError(localization.errors.imageUploadFailed);
      setIsUploading(false);
      return;
    }
    try {
      await updateUser({ image });
      toast.success(localization.settings.avatarChangedSuccess);
    } catch {
      setError("Your photo couldn't be saved. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  // Manual removal only. Uploading a replacement does not call this handler.
  async function handleDelete() {
    const currentImage = session?.user.image;
    if (!session || !currentImage || isPending) return;
    setError(null);
    setIsDeleting(true);

    try {
      await updateUser({ image: null });
    } catch {
      setError("Your photo couldn't be removed. Please try again.");
      setIsDeleting(false);
      return;
    }
    try {
      await avatar.delete?.(currentImage);
      toast.success(localization.settings.avatarDeletedSuccess);
    } catch {
      setError(
        "Your photo was removed, but the stored file couldn't be deleted.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Field className={className}>
      <FieldLabel htmlFor={inputId}>{localization.settings.avatar}</FieldLabel>

      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept={AVATAR_FILE_TYPES.join(",")}
        className="hidden"
        disabled={!session || isPending}
        aria-describedby={descriptionId}
        onChange={handleFileChange}
      />

      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="ghost"
          className="h-auto w-auto rounded-full p-0"
          disabled={!session || isPending}
          aria-label={localization.settings.uploadAvatar}
          onClick={() => fileInputRef.current?.click()}
        >
          <UserAvatar className="size-12" isPending={isPending} />
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!session || isPending}
            onClick={() => fileInputRef.current?.click()}
            aria-describedby={descriptionId}
          >
            {isUploading ? <Spinner /> : <Upload />}
            {localization.settings.uploadAvatar}
          </Button>
          {session?.user.image && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={handleDelete}
            >
              {isDeleting ? <Spinner /> : <Trash2 />}
              {localization.settings.deleteAvatar}
            </Button>
          )}
        </div>
      </div>
      <FieldDescription id={descriptionId}>
        JPG, PNG, WebP, or GIF. Maximum 5 MB.
      </FieldDescription>
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}
