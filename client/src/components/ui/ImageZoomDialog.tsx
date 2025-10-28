import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "./dialog";
import { Button } from "./button";
import { Maximize2 } from "lucide-react";

interface ImageZoomDialogProps {
  src: string;
  alt: string;
  className?: string;
  buttonText?: string;
}

export function ImageZoomDialog({
  src,
  alt,
  className = "",
  buttonText = "Agrandir l'image"
}: ImageZoomDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Small preview image */}
      <img
        src={src}
        alt={alt}
        className={className}
      />

      {/* Enlarge button */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Maximize2 className="h-4 w-4" />
            {buttonText}
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-4xl w-full p-0 overflow-hidden">
          {/* Full-size image in modal */}
          <div className="relative">
            <img
              src={src}
              alt={alt}
              className="w-full h-auto max-h-[80vh] object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
