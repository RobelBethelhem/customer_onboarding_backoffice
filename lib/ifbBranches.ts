import IfbBranchSettings, { IIfbBranchMapping } from '@/lib/models/IfbBranchSettings';
import { DEFAULT_IFB_BRANCHES } from '@/lib/ifbBranchDefaults';

export const defaultIfbMappings = (): IIfbBranchMapping[] =>
  DEFAULT_IFB_BRANCHES.map(([conventionalCode, ifbCode, branchName]) => ({ conventionalCode, ifbCode, branchName }));

/** The admin-configured conventional → IFB branch table (seeded with the bank rule on first use) */
export async function getIfbMappings(): Promise<IIfbBranchMapping[]> {
  const doc = await IfbBranchSettings.findOneAndUpdate(
    { _id: 'default' },
    { $setOnInsert: { mappings: defaultIfbMappings(), updatedBy: 'system (default rule)' } },
    { upsert: true, new: true }
  ).lean() as any;
  return doc?.mappings || [];
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
