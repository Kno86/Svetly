import { Controller, Get } from '@nestjs/common';
import { RequirePermission } from '../auth/guards.js';
import { PrismaService } from '../prisma/prisma.service.js';

interface Node {
  id: string;
  slug: string;
  name: string;
  kind: string;
  parentId: string | null;
  isActive: boolean;
  isDefault: boolean;
}

/** Ancestors from the top (region) down to the direct parent. */
export function pathOf(
  node: Node,
  all: Node[],
): Array<{ slug: string; name: string; kind: string }> {
  const byId = new Map(all.map((n) => [n.id, n]));
  const path: Node[] = [];
  const seen = new Set<string>([node.id]);
  for (
    let p = node.parentId ? byId.get(node.parentId) : undefined;
    p && !seen.has(p.id);
    p = p.parentId ? byId.get(p.parentId) : undefined
  ) {
    seen.add(p.id);
    path.unshift(p);
  }
  return path.map(({ slug, name, kind }) => ({ slug, name, kind }));
}

@Controller()
export class TerritoriesController {
  constructor(private readonly prisma: PrismaService) {}

  private async all(): Promise<Node[]> {
    return this.prisma.territory.findMany({ orderBy: { createdAt: 'asc' } });
  }

  /** Public: the default locality and the localities a visitor may switch to. */
  @Get('territories')
  async list() {
    const all = await this.all();
    const view = (n: Node) => ({ slug: n.slug, name: n.name, kind: n.kind, path: pathOf(n, all) });
    const available = all.filter((n) => n.kind === 'locality' && n.isActive);
    const current = available.find((n) => n.isDefault) ?? available[0];
    return { current: current ? view(current) : null, available: available.map(view) };
  }

  @Get('admin/territories')
  @RequirePermission('settings.manage')
  async adminList() {
    const all = await this.all();
    return { items: all.map((n) => ({ ...n, path: pathOf(n, all) })) };
  }
}
