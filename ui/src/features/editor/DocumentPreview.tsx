import { MarkdownContent } from "@/shared/markdown/MarkdownContent";
import { isHtmlPath } from "@/features/editor/documentTypes";

export function DocumentPreview({ content, path }: { content: string; path: string }) {
  if (isHtmlPath(path)) {
    return (
      <iframe
        className="h-full w-full border-0 bg-white"
        sandbox="allow-forms allow-modals allow-popups"
        srcDoc={content}
        title={`${path} preview`}
      />
    );
  }

  return <MarkdownContent className="h-full overflow-auto bg-canvas px-6 py-5 max-[700px]:px-4 max-[700px]:py-3" content={content} />;
}
