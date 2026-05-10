import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tree, type NodeRendererProps } from "react-arborist";
import { FileCode2, Folder } from "lucide-react";
import { SectionTitle } from "../../components/SectionTitle";
import { api } from "../../lib/api";
import type { FileTreeNode } from "../../lib/types";
import { useUiStore } from "../../store/uiStore";
import { FileActions } from "./FileActions";

export function FilePane({ sessionId }: { sessionId?: string }) {
  const treeHost = useRef<HTMLDivElement>(null);
  const size = useElementSize(treeHost);
  const setActiveFilePath = useUiStore((state) => state.setActiveFilePath);
  const tree = useQuery({
    queryKey: ["tree", sessionId],
    queryFn: () => api<FileTreeNode[]>(`/api/sessions/${sessionId}/files/tree`),
    enabled: Boolean(sessionId),
  });

  return (
    <section className="grid h-full min-w-0 grid-rows-[38px_auto_minmax(0,1fr)] gap-3 overflow-hidden bg-canvas p-4 max-[700px]:p-3" data-testid="file-pane">
      <SectionTitle label="Files" />
      <FileActions sessionId={sessionId} />
      <div ref={treeHost} className="min-h-0 overflow-hidden text-[13px]">
        <Tree<FileTreeNode>
          data={tree.data ?? []}
          height={Math.max(size.height, 120)}
          width={Math.max(size.width, 180)}
          rowHeight={34}
          indent={18}
          openByDefault={false}
          idAccessor="path"
          childrenAccessor="children"
          disableDrag
          disableEdit
        >
          {(props) => <FileTreeRow {...props} onOpen={setActiveFilePath} />}
        </Tree>
      </div>
    </section>
  );
}

function FileTreeRow({ node, style, onOpen }: NodeRendererProps<FileTreeNode> & { onOpen(path: string): void }) {
  const item = node.data;
  return (
    <div style={style} className="flex items-center">
      <button
        className="inline-flex min-h-8 w-full items-center justify-start gap-2 overflow-hidden rounded-md border border-transparent bg-transparent px-3 py-1.5 text-left text-sm text-ink hover:bg-page"
        type="button"
        onClick={() => (item.isDirectory ? node.toggle() : onOpen(item.path))}
      >
        {item.isDirectory ? <Folder size={14} /> : <FileCode2 size={14} />}
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{item.name}</span>
      </button>
    </div>
  );
}

function useElementSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
