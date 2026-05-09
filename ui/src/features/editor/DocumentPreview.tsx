import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { isHtmlPath } from "./documentTypes";

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

  return (
    <article className="h-full overflow-auto bg-canvas px-6 py-5 text-[14px] leading-[1.6] text-ink max-[700px]:px-4 max-[700px]:py-3">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ ...props }) => <h1 className="mt-0 mb-4 text-2xl font-semibold tracking-normal text-ink" {...props} />,
          h2: ({ ...props }) => <h2 className="mt-6 mb-3 border-b border-hairline pb-2 text-xl font-semibold tracking-normal text-ink" {...props} />,
          h3: ({ ...props }) => <h3 className="mt-5 mb-2 text-base font-semibold tracking-normal text-ink" {...props} />,
          p: ({ ...props }) => <p className="my-3 text-[14px] leading-[1.65] text-ink" {...props} />,
          a: ({ ...props }) => <a className="text-primary underline-offset-4 hover:underline" {...props} />,
          ul: ({ ...props }) => <ul className="my-3 list-disc pl-5" {...props} />,
          ol: ({ ...props }) => <ol className="my-3 list-decimal pl-5" {...props} />,
          li: ({ ...props }) => <li className="my-1" {...props} />,
          blockquote: ({ ...props }) => <blockquote className="my-4 border-l-2 border-selected-border bg-panel py-2 pr-3 pl-4 text-muted" {...props} />,
          code: ({ className, ...props }) => <code className={`rounded bg-page px-1 py-0.5 font-mono text-[13px] ${className ?? ""}`} {...props} />,
          pre: ({ ...props }) => <pre className="my-4 overflow-auto rounded-md border border-hairline bg-[#f7f7f9] p-3 font-mono text-[13px]" {...props} />,
          table: ({ ...props }) => <table className="my-4 w-full border-collapse text-left text-[13px]" {...props} />,
          th: ({ ...props }) => <th className="border border-hairline bg-panel px-2 py-1 font-semibold" {...props} />,
          td: ({ ...props }) => <td className="border border-hairline px-2 py-1" {...props} />,
          hr: ({ ...props }) => <hr className="my-6 border-hairline" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
