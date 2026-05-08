import type { Job, PreviewInstance, ServiceInstance } from "../../shared/types";
import type { JsonStore } from "../storage";

export class CommandHistoryStore {
  constructor(private store: JsonStore) {}

  loadJobs() {
    return this.store.read<Job[]>("jobs.json", []);
  }

  saveJobs(jobs: Job[]) {
    return this.store.write("jobs.json", newest(jobs, 100));
  }

  loadPreviews() {
    return this.store.read<PreviewInstance[]>("previews.json", []);
  }

  savePreviews(previews: PreviewInstance[]) {
    return this.store.write("previews.json", newest(previews, 100));
  }

  loadServices() {
    return this.store.read<ServiceInstance[]>("services.json", []);
  }

  saveServices(services: ServiceInstance[]) {
    return this.store.write("services.json", newest(services, 100));
  }
}

function newest<T extends { startedAt?: number }>(items: T[], limit: number) {
  return [...items].sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0)).slice(0, limit);
}
