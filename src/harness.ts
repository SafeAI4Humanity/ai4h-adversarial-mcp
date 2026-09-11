export const harnessName = "@safeai4humanity/adversarial-mcp" as const;
export const harnessVersion = "0.2.0";

function versionParts(value: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) throw new Error(`Invalid semantic version: ${value}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function supportsMinimumVersion(minimumVersion: string): boolean {
  const current = versionParts(harnessVersion);
  const minimum = versionParts(minimumVersion);
  for (let index = 0; index < current.length; index += 1) {
    if (current[index]! > minimum[index]!) return true;
    if (current[index]! < minimum[index]!) return false;
  }
  return true;
}
