import { useQuery } from "@tanstack/react-query";
import { FileCode2, Folder } from "lucide-react";
import { SectionTitle } from "../../components/SectionTitle";
import { transparentListButtonClass } from "../../components/uiClasses";
import { api } from "../../lib/api";
import type { FileTreeNode } from "../../lib/types";
import { useUiStore } from "../../store/uiStore";

export function FilePane({ sessionId }: { sessionId?: string }) {
  const setActiveFilePath = useUiStore((state) => state.setActiveFilePath);
  const tree = useQuery({
    queryKey: ["tree", sessionId],
    queryFn: () => api<FileTreeNode[]>(`/api/sessions/${sessionId}/files/tree`),
    enabled: Boolean(sessionId),
  });
  return (
    <section className="min-w-0 overflow-hidden border-r border-[#e0e0e0] bg-white p-2.5">
      <SectionTitle label="Files" />
      <div className="overflow-auto text-[13px]">
        {tree.data?.map((node) => <TreeNode key={node.id} node={node} onOpen={setActiveFilePath} />)}
      </div>
    </section>
  );
}

function TreeNode({ node, onOpen }: { node: FileTreeNode; onOpen(path: string): void }) {
  return (
    <div>
      <button className={transparentListButtonClass} type="button" onClick={() => (node.isDirectory ? undefined : onOpen(node.path))}>
        {node.isDirectory ? <Folder size={14} /> : <FileCode2 size={14} />}
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{node.name}</span>
      </button>
      {node.children?.length ? (
        <div className="ml-[9px] border-l border-[#ececf0] pl-[7px]">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} onOpen={onOpen} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
