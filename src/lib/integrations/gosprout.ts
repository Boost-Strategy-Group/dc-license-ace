// Adapter stub. Today everything flows through the launchpad UI.
// When GoSprout exposes a public API, implement these and flip
// tenant config `integration_mode` from "launchpad" to "api".

export type RtiCompletion = {
  userId: string;
  courseTitle: string;
  ceus: number;
  hours: number;
  completedAt: string; // ISO
  certificateUrl?: string;
};

export type RosterEntry = {
  userId: string;
  email: string;
  fullName?: string;
  gosproutUsername?: string;
};

export async function pushRtiCompletion(_: RtiCompletion): Promise<{ ok: boolean; reason?: string }> {
  return { ok: false, reason: "GoSprout API not yet available — using launchpad mode." };
}

export async function syncRoster(_: RosterEntry[]): Promise<{ ok: boolean; reason?: string }> {
  return { ok: false, reason: "GoSprout API not yet available — using launchpad mode." };
}
