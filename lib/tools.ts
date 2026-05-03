export type ToolStatus = 'live' | 'planned';

export interface Tool {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  summary: string;
  status: ToolStatus;
  emoji?: string;
}

export const tools: Tool[] = [
  {
    id: 'rsu-tax-shortfall',
    slug: 'rsu-tax-shortfall',
    title: 'RSU Tax Withholding Shortfall Calculator',
    shortTitle: 'RSU Tax Shortfall',
    summary:
      'Estimate the gap between what your employer withholds at RSU vest (22% or 37%) and what you actually owe at your marginal rate.',
    status: 'live',
    emoji: '📈',
  },
];

export function liveTools(): Tool[] {
  return tools.filter((t) => t.status === 'live');
}

export function findTool(slug: string): Tool | undefined {
  return tools.find((t) => t.slug === slug);
}
