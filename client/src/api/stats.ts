import { listSwimmers } from './swimmers'

// Stats facade modeled as a REST-style endpoint (GET /stats/swimmers) over the
// local DB. Real swimmers are the persistent roster entries in the swimmers
// table — temp swimmers live only in a run's notes and never count here.
export async function getSwimmerCount(): Promise<number> {
  return (await listSwimmers()).length
}