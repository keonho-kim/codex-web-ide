import { ServiceList } from "./ServiceList";
import { ServiceToolbar } from "./ServiceToolbar";
import { useServicesPanel } from "./useServicesPanel";

export function ServicesPanel({ sessionId }: { sessionId?: string }) {
  const services = useServicesPanel(sessionId);

  return (
    <div className="panel-body">
      <ServiceToolbar
        command={services.command}
        startDisabled={services.actions.startDisabled}
        onCommandChange={services.setCommand}
        onRefresh={services.actions.refresh}
        onStart={services.actions.start}
      />
      {services.actions.error ? <p className="error-text mt-2">{services.actions.error}</p> : null}
      <div className="split-grid mt-2.5">
        <ServiceList
          restartPending={services.actions.restartPending}
          services={services.services}
          stopPending={services.actions.stopPending}
          onRestart={services.actions.restart}
          onStop={services.actions.stop}
        />
        <pre className="log-output">{services.latestLog}</pre>
      </div>
    </div>
  );
}
