import { ServiceList } from "./ServiceList";
import { ServiceToolbar } from "./ServiceToolbar";
import { useServicesPanel } from "./useServicesPanel";

export function ServicesPanel({ sessionId }: { sessionId?: string }) {
  const services = useServicesPanel(sessionId);

  return (
    <div className="h-full overflow-auto p-4">
      <ServiceToolbar
        command={services.command}
        startDisabled={services.actions.startDisabled}
        onCommandChange={services.setCommand}
        onRefresh={services.actions.refresh}
        onStart={services.actions.start}
      />
      {services.actions.error ? <p className="mt-2 text-xs text-destructive">{services.actions.error}</p> : null}
      <div className="mt-4 grid min-h-0 grid-cols-[minmax(240px,34%)_minmax(0,1fr)] gap-4 max-[900px]:grid-cols-1">
        <ServiceList
          restartPending={services.actions.restartPending}
          services={services.services}
          stopPending={services.actions.stopPending}
          onRestart={services.actions.restart}
          onStop={services.actions.stop}
        />
        <pre className="min-h-[220px] overflow-auto rounded-md bg-ink p-4 text-xs whitespace-pre-wrap text-white">{services.latestLog}</pre>
      </div>
    </div>
  );
}
