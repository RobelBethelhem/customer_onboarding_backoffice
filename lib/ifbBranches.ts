import IfbBranchSettings, { IBranch, IIfbBranchMapping } from '@/lib/models/IfbBranchSettings';
import { DEFAULT_BRANCHES } from '@/lib/ifbBranchDefaults';

const DIRECTORY_VERSION = 2;

export const defaultBranches = (): IBranch[] => DEFAULT_BRANCHES.map(b => ({ ...b }));

/**
 * The admin-maintained branch directory (Settings → Branches). Seeded with the default list on
 * first use; an older IFB-codes-only table is upgraded once, keeping the IFB codes saved in it.
 */
export async function getBranches(): Promise<IBranch[]> {
  const doc = await IfbBranchSettings.findOneAndUpdate(
    { _id: 'default' },
    { $setOnInsert: { version: DIRECTORY_VERSION, mappings: defaultBranches(), updatedBy: 'system (default list)' } },
    { upsert: true, new: true }
  ).lean() as any;

  if ((doc?.version || 1) >= DIRECTORY_VERSION) return doc.mappings || [];

  const saved: IIfbBranchMapping[] = doc?.mappings || [];
  const savedIfb = new Map(saved.map(m => [m.conventionalCode, m.ifbCode]));
  const upgraded = defaultBranches().map(b => ({ ...b, ifbCode: savedIfb.get(b.conventionalCode) ?? b.ifbCode }));
  const known = new Set(upgraded.map(b => b.conventionalCode));
  for (const m of saved) {
    if (!known.has(m.conventionalCode)) {
      upgraded.push({
        branchName: m.branchName || `Branch ${m.conventionalCode}`, conventionalCode: m.conventionalCode, ifbCode: m.ifbCode,
        branchType: 'Branch', category: 'City', latitude: null, longitude: null, active: true,
      });
    }
  }
  await IfbBranchSettings.updateOne({ _id: 'default' }, { $set: { version: DIRECTORY_VERSION, mappings: upgraded } });
  return upgraded;
}

/** Conventional → IFB code pairs (branches that have an IFB code, active or not) */
export async function getIfbMappings(): Promise<IIfbBranchMapping[]> {
  return (await getBranches()).filter(b => b.ifbCode);
}

/**
 * FlexCube branch for an interest-free account at this branch: the IFB code mapped to it, the code
 * itself if it already is an IFB code, or null when no mapping is configured.
 */
export async function ifbBranchFor(branchCode: string): Promise<string | null> {
  if (!branchCode) return null;
  const mappings = await getIfbMappings();
  if (mappings.some(m => m.ifbCode === branchCode)) return branchCode;
  return mappings.find(m => m.conventionalCode === branchCode)?.ifbCode || null;
}

/** A branch plus its IFB (or conventional) counterpart — what a branch user or Personal Banker may see */
export async function branchCodesFor(branchCode: string): Promise<string[]> {
  if (!branchCode) return [];
  const mappings = await getIfbMappings();
  const codes = new Set([branchCode]);
  for (const m of mappings) {
    if (m.conventionalCode === branchCode) codes.add(m.ifbCode);
    if (m.ifbCode === branchCode) codes.add(m.conventionalCode);
  }
  return Array.from(codes);
}
