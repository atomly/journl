import {
  DocumentOverlay,
  DocumentOverlayContent,
} from "../ui/document-overlay";

type BlockEditorErrorOverlayProps = {
  isOpen: boolean;
};

export function BlockEditorErrorOverlay({
  isOpen,
}: BlockEditorErrorOverlayProps) {
  return (
    <DocumentOverlay
      className="bg-background/30 backdrop-blur-md"
      isOpen={isOpen}
    >
      <DocumentOverlayContent className="bg-background/70">
        <span className="block font-medium text-muted-foreground text-sm">
          Something went wrong while saving your changes.
        </span>
      </DocumentOverlayContent>
    </DocumentOverlay>
  );
}
