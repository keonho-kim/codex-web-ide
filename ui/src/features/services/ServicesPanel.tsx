import { ServiceList } from "./ServiceList";
import { ServiceToolbar } from "./ServiceToolbar";
import { useServicesPanel } from "./useServicesPanel";

export function ServicesPanel({ sessionId }: { sessionId?: string }) {
  const services = useServicesPanel(sessionId);

  return (
    <div className="h-[calc(100%-38px)] overflow-auto p-2.5">
      <ServiceToolbar
        command={services.command}
        startDisabled={services.actions.startDisabled}
        onCommandChange={services.setCommand}
        onRefresh={services.actions.refresh}
        onStart={services.actions.start}
      />
      <div className="mt-2.5 grid grid-cols-[minmax(220px,34%)_minmax(0,1fr)] gap-2.5">
        <ServiceList
          restartPending={services.actions.restartPending}
          services={services.services}
          stopPending={services.actions.stopPending}
          onRestart={services.actions.restart}
          onStop={services.actions.stop}
        />
        <pre className="h-[150px] overflow-auto rounded-md bg-ink p-2.5 text-xs whitespace-pre-wrap text-white">{services.latestLog}</pre>
      </div>
    </div>
  );
}
