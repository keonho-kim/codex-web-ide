import { useQuery } from "@tanstack/react-query";
import { FileCode2, Folder } from "lucide-react";
import { SectionTitle } from "../../components/SectionTitle";
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
    <section className="pane file-pane">
      <SectionTitle label="Files" />
      <div className="tree">
        {tree.data?.map((node) => <TreeNode key={node.id} node={node} onOpen={setActiveFilePath} />)}
      </div>
    </section>
  );
}

function TreeNode({ node, onOpen }: { node: FileTreeNode; onOpen(path: string): void }) {
  return (
    <div>
      <button className="tree-row" type="button" onClick={() => (node.isDirectory ? undefined : onOpen(node.path))}>
        {node.isDirectory ? <Folder size={14} /> : <FileCode2 size={14} />}
        <span>{node.name}</span>
      </button>
      {node.children?.length ? (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} onOpen={onOpen} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
