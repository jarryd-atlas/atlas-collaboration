"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "../ui/dialog";
import { Textarea, Select } from "../ui/input";
import { Button } from "../ui/button";
import { submitFeedback } from "../../lib/actions/feedback";

interface FeedbackDialogProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  { value: "bug", label: "Bug Report" },
  { value: "feature_request", label: "Feature Request" },
  { value: "improvement", label: "Improvement" },
  { value: "other", label: "Other" },
];

export function FeedbackDialog({ open, onClose }: FeedbackDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const formData = new FormData(e.currentTarget);
    formData.set("pageUrl", pathname);

    startTransition(async () => {
      const result = await submitFeedback(formData);
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        setSubmitted(true);
        setTimeout(() => {
          handleClose();
          router.refresh();
        }, 1500);
      }
    });
  }

  function handleClose() {
    setError("");
    setSubmitted(false);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      {submitted ? (
        <>
          <DialogHeader onClose={handleClose}>Thank you!</DialogHeader>
          <DialogBody>
            <div className="py-8 text-center">
              <div className="text-4xl mb-3">&#10003;</div>
              <p className="text-sm text-gray-600">
                Your feedback has been submitted. We appreciate you helping us improve ATLAS.
              </p>
            </div>
          </DialogBody>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <DialogHeader onClose={handleClose}>Send Feedback</DialogHeader>
          <DialogBody className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <Select
              id="fb-category"
              name="category"
              label="Category"
              options={CATEGORIES}
            />

            <Textarea
              id="fb-message"
              name="message"
              label="Your feedback"
              placeholder="Tell us what's on your mind — bugs, ideas, things that could be better..."
              rows={5}
              required
            />

            <p className="text-xs text-gray-400">
              We&apos;ll also capture which page you&apos;re on for context.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Sending..." : "Send Feedback"}
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  );
}
