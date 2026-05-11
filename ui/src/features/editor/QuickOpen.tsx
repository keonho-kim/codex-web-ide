export function QuickOpen({
  matches,
  onClose,
  onOpen,
  onQueryChange,
  query,
}: {
  matches: string[];
  onClose(): void;
  onOpen(path: string): void;
  onQueryChange(query: string): void;
  query: string;
}) {
  return (
    <div className="absolute inset-0 z-30 bg-canvas/70 p-6 backdrop-blur-[1px]">
      <div className="mx-auto w-full max-w-xl overflow-hidden rounded-lg border border-hairline bg-panel shadow-sm">
        <input
          autoFocus
          className="h-11 w-full border-b border-hairline bg-canvas px-4 text-sm outline-none"
          placeholder="Quick open file"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onClose();
            if (event.key === "Enter" && matches[0]) onOpen(matches[0]);
          }}
        />
        <div className="max-h-80 overflow-auto p-2">
          {matches.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted">No files found.</p>
          ) : (
            matches.map((path) => (
              <button
                className="block w-full rounded-md px-2 py-2 text-left font-mono text-xs text-ink hover:bg-page"
                key={path}
                type="button"
                onClick={() => onOpen(path)}
              >
                {path}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
