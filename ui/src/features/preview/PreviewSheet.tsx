import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useUiStore } from "../../store/uiStore";
import { PreviewPanel } from "./PreviewPanel";

export function PreviewSheet({ sessionId }: { sessionId?: string }) {
  const previewOpen = useUiStore((state) => state.previewOpen);
  const setPreviewOpen = useUiStore((state) => state.setPreviewOpen);

  return (
    <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
      <SheetContent className="w-[min(100vw,980px)] gap-0 p-0 sm:max-w-none" side="right">
        <SheetHeader className="border-b border-hairline px-5 py-4">
          <SheetTitle>Preview</SheetTitle>
          <SheetDescription>Run and inspect the active project preview.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1">
          <PreviewPanel sessionId={sessionId} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
