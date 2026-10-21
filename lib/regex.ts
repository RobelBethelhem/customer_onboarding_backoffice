/** Text typed into a search box as a literal pattern (no regex syntax, so no runaway matching) */
export const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
