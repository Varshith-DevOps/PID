'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { getOrgChart } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import { Avatar, Button, IconButton, LoadingBlock, EmptyState, ErrorState } from '@/components/ui';

type OrgChartNode = {
  id: string;
  employeeId: string;
  name: string;
  designation: string;
  title?: string;
  managerId?: string | null;
  email?: string;
  department?: string;
  status?: string;
  profileImage?: string | null;
  photoUrl?: string | null;
  directReportCount: number;
  children: OrgChartNode[];
};

type OrgChartResponse = {
  success: boolean;
  roots: OrgChartNode[];
  unassigned: OrgChartNode[];
  circular?: OrgChartNode[];
  warnings?: string[];
  meta?: {
    reportingField?: string;
    employeeCount?: number;
    unassignedCount?: number;
    circularCount?: number;
  };
};

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

const normalize = (value?: string | null) => String(value || '').toLowerCase();

const searchNode = (node: OrgChartNode, query: string) => {
  const q = normalize(query);
  if (!q) return false;
  return [node.name, node.designation, node.department, node.employeeId].some((value) => normalize(value).includes(q));
};

const collectParentMap = (nodes: OrgChartNode[], parentId: string | null, map: Map<string, string | null>) => {
  nodes.forEach((node) => {
    map.set(node.id, parentId);
    collectParentMap(node.children || [], node.id, map);
  });
};

const collectDepthExpansion = (nodes: OrgChartNode[], depth: number, expanded: Set<string>) => {
  nodes.forEach((node) => {
    if ((node.children?.length || 0) > 0 && depth < 2) expanded.add(node.id);
    collectDepthExpansion(node.children || [], depth + 1, expanded);
  });
};

const findFirstMatch = (nodes: OrgChartNode[], query: string): OrgChartNode | null => {
  for (const node of nodes) {
    if (searchNode(node, query)) return node;
    const childMatch = findFirstMatch(node.children || [], query);
    if (childMatch) return childMatch;
  }
  return null;
};

const flatten = (nodes: OrgChartNode[]): OrgChartNode[] => nodes.flatMap((node) => [node, ...flatten(node.children || [])]);

const expandAncestors = (nodeId: string, parentMap: Map<string, string | null>, expanded: Set<string>) => {
  let current = parentMap.get(nodeId);
  while (current) {
    expanded.add(current);
    current = parentMap.get(current);
  }
};

const buildDisplayRoots = (chart: OrgChartResponse | null): OrgChartNode[] => {
  if (!chart) return [];

  const promotedRoots = chart.roots?.length
    ? chart.roots
    : (chart.unassigned || []).filter((node) => !node.managerId);

  if (promotedRoots.length <= 1) return promotedRoots;

  return [{
    id: 'top-management-root',
    employeeId: 'ROOT',
    name: 'Top Management',
    designation: 'Organization Leadership',
    department: 'Leadership',
    status: 'ACTIVE',
    directReportCount: promotedRoots.length,
    children: promotedRoots,
  }];
};

const EmployeeCard = memo(function EmployeeCard({
  node,
  highlighted,
  pathHighlighted,
  expanded,
  onToggle,
  onOpen,
}: {
  node: OrgChartNode;
  highlighted: boolean;
  pathHighlighted: boolean;
  expanded: boolean;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const image = node.profileImage || node.photoUrl;
  const inactive = node.status && node.status !== 'ACTIVE';

  return (
    <div
      role="button"
      tabIndex={0}
      data-employee-id={node.id}
      className={`org-card ${highlighted ? 'is-highlighted' : ''} ${pathHighlighted ? 'is-path' : ''} ${inactive ? 'is-inactive' : ''}`}
      onClick={() => onOpen(node.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(node.id);
        }
      }}
    >
      <div className="org-card-header">
        <Avatar name={node.name} src={image ? `${API_ORIGIN}/${image}` : null} size={30} />
        <div className="org-card-title">
          <strong>{node.name}</strong>
          <span>{node.designation || node.title || 'Employee'}</span>
        </div>
      </div>
      <div className="org-card-meta">
        <span>{node.department || 'General'}</span>
        <span>{node.employeeId}</span>
      </div>
      {hasChildren && (
        <button
          type="button"
          className="org-toggle"
          aria-label={expanded ? 'Collapse reports' : 'Expand reports'}
          onClick={(event) => {
            event.stopPropagation();
            onToggle(node.id);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.stopPropagation();
              onToggle(node.id);
            }
          }}
        >
          {expanded ? '-' : '+'}
        </button>
      )}
    </div>
  );
});

const OrgNode = memo(function OrgNode({
  node,
  expandedIds,
  highlightedId,
  pathIds,
  onToggle,
  onOpen,
}: {
  node: OrgChartNode;
  expandedIds: Set<string>;
  highlightedId: string | null;
  pathIds: Set<string>;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const isExpanded = expandedIds.has(node.id);
  const hasVisibleChildren = node.children.length > 0 && isExpanded;

  return (
    <li className={`org-node ${hasVisibleChildren ? 'has-children' : ''}`}>
      <EmployeeCard
        node={node}
        highlighted={highlightedId === node.id}
        pathHighlighted={pathIds.has(node.id)}
        expanded={isExpanded}
        onToggle={onToggle}
        onOpen={onOpen}
      />
      {hasVisibleChildren && (
        <ul className="org-children">
          {node.children.map((child) => (
            <OrgNode
              key={child.id}
              node={child}
              expandedIds={expandedIds}
              highlightedId={highlightedId}
              pathIds={pathIds}
              onToggle={onToggle}
              onOpen={onOpen}
            />
          ))}
        </ul>
      )}
    </li>
  );
});

function OrgTree({
  roots,
  expandedIds,
  highlightedId,
  pathIds,
  onToggle,
  onOpen,
}: {
  roots: OrgChartNode[];
  expandedIds: Set<string>;
  highlightedId: string | null;
  pathIds: Set<string>;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <ul className="org-tree">
      {roots.map((root) => (
        <OrgNode
          key={root.id}
          node={root}
          expandedIds={expandedIds}
          highlightedId={highlightedId}
          pathIds={pathIds}
          onToggle={onToggle}
          onOpen={onOpen}
        />
      ))}
    </ul>
  );
}

export default function OrgChartPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0 });

  const [chart, setChart] = useState<OrgChartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(0.9);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading, router]);

  const displayRoots = useMemo(() => buildDisplayRoots(chart), [chart]);
  const promotedRootIds = useMemo(() => new Set(flatten(displayRoots).map((node) => node.id)), [displayRoots]);
  const groupedNodes = useMemo(() => {
    const groups = [...displayRoots];
    const unassigned = (chart?.unassigned || []).filter((node) => !promotedRootIds.has(node.id));
    if (unassigned.length) {
      groups.push({
        id: 'unassigned-employees',
        employeeId: 'UNASSIGNED',
        name: 'Unassigned Employees',
        designation: 'No valid reporting manager',
        department: 'Needs Review',
        status: 'ACTIVE',
        directReportCount: unassigned.length,
        children: unassigned,
      });
    }
    if (chart?.circular?.length) {
      groups.push({
        id: 'circular-reporting',
        employeeId: 'WARNING',
        name: 'Circular Reporting Data',
        designation: 'Relationship needs correction',
        department: 'Warning',
        status: 'INACTIVE',
        directReportCount: chart.circular.length,
        children: chart.circular,
      });
    }
    return groups;
  }, [chart, displayRoots, promotedRootIds]);

  const parentMap = useMemo(() => {
    const map = new Map<string, string | null>();
    collectParentMap(groupedNodes, null, map);
    return map;
  }, [groupedNodes]);

  const pathIds = useMemo(() => {
    const ids = new Set<string>();
    if (highlightedId) expandAncestors(highlightedId, parentMap, ids);
    return ids;
  }, [highlightedId, parentMap]);

  const initializeExpansion = useCallback((nodes: OrgChartNode[]) => {
    const next = new Set<string>();
    collectDepthExpansion(nodes, 0, next);
    setExpandedIds(next);
  }, []);

  const loadOrgChart = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await getOrgChart();
      const normalized: OrgChartResponse = Array.isArray(data)
        ? { success: true, roots: data, unassigned: [] }
        : data;
      setChart(normalized);
      const initialDisplayRoots = buildDisplayRoots(normalized);
      const initialPromotedRootIds = new Set(flatten(initialDisplayRoots).map((node) => node.id));
      const initialGroups = [...initialDisplayRoots];
      const initialUnassigned = (normalized.unassigned || []).filter((node) => !initialPromotedRootIds.has(node.id));
      if (initialUnassigned.length) {
        initialGroups.push({
          id: 'unassigned-employees',
          employeeId: 'UNASSIGNED',
          name: 'Unassigned Employees',
          designation: 'No valid reporting manager',
          department: 'Needs Review',
          status: 'ACTIVE',
          directReportCount: initialUnassigned.length,
          children: initialUnassigned,
        });
      }
      initializeExpansion(initialGroups);
    } catch (err) {
      console.error('Error fetching org chart:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [initializeExpansion]);

  useEffect(() => {
    if (user) loadOrgChart();
  }, [user, loadOrgChart]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setHighlightedId(null);
      return;
    }
    const match = findFirstMatch(groupedNodes, query);
    if (!match) {
      setHighlightedId(null);
      return;
    }
    setHighlightedId(match.id);
    setExpandedIds((previous) => {
      const next = new Set(previous);
      expandAncestors(match.id, parentMap, next);
      if (match.children.length > 0) next.add(match.id);
      return next;
    });
    window.setTimeout(() => {
      viewportRef.current?.querySelector(`[data-employee-id="${match.id}"]`)?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    }, 80);
  }, [groupedNodes, parentMap, searchQuery]);

  const toggleNode = useCallback((id: string) => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openEmployee = useCallback((id: string) => {
    if (id === 'top-management-root' || id === 'unassigned-employees' || id === 'circular-reporting') return;
    router.push(`/employees/${id}`);
  }, [router]);

  const resetView = () => {
    setZoom(0.9);
    setPan({ x: 0, y: 0 });
    viewportRef.current?.scrollTo({ top: 0, left: Math.max(0, viewportRef.current.scrollWidth / 2 - viewportRef.current.clientWidth / 2), behavior: 'smooth' });
  };

  const fitToScreen = () => {
    const viewport = viewportRef.current;
    const tree = viewport?.querySelector('.org-tree-canvas') as HTMLElement | null;
    if (!viewport || !tree) return;
    const scale = Math.max(0.55, Math.min(1.05, (viewport.clientWidth - 48) / Math.max(tree.scrollWidth, 1)));
    setZoom(scale);
    setPan({ x: 0, y: 0 });
    viewport.scrollTo({ top: 0, left: Math.max(0, viewport.scrollWidth / 2 - viewport.clientWidth / 2), behavior: 'smooth' });
  };

  const handleWheel = (event: React.WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setZoom((value) => Math.max(0.55, Math.min(1.35, value + (event.deltaY > 0 ? -0.05 : 0.05))));
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) return;
    setDragging(true);
    dragStart.current = { x: event.clientX - pan.x, y: event.clientY - pan.y };
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!dragging) return;
    setPan({ x: event.clientX - dragStart.current.x, y: event.clientY - dragStart.current.y });
  };

  if (authLoading || !user) {
    return <div className="loading-container"><div className="loading-spinner" />Loading auth...</div>;
  }

  const employeeCount = chart?.meta?.employeeCount ?? flatten(groupedNodes).filter((node) => !['top-management-root', 'unassigned-employees', 'circular-reporting'].includes(node.id)).length;
  const hasNoEmployees = !loading && !loadError && employeeCount === 0;
  const hasNoRoot = !loading && !loadError && employeeCount > 0 && displayRoots.length === 0;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content org-page">
        <div className="org-toolbar">
          <div>
            <h1 className="page-title">Organization Chart</h1>
            <p className="page-subtitle">{chart?.meta?.reportingField || 'managerId'} reporting hierarchy</p>
          </div>
          <div className="org-actions">
            <div className="org-search">
              <input
                type="text"
                placeholder="Search name, role, department, ID..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="input-field"
              />
            </div>
            <div className="org-zoom card">
              <IconButton label="Zoom Out" size={30} onClick={() => setZoom((value) => Math.max(0.55, value - 0.1))}>-</IconButton>
              <span>{Math.round(zoom * 100)}%</span>
              <IconButton label="Zoom In" size={30} onClick={() => setZoom((value) => Math.min(1.35, value + 0.1))}>+</IconButton>
              <IconButton label="Reset View" size={30} onClick={resetView}>R</IconButton>
              <Button variant="ghost" size="sm" onClick={fitToScreen}>Fit</Button>
            </div>
          </div>
        </div>

        <div
          ref={viewportRef}
          className={`org-viewport ${dragging ? 'is-dragging' : ''}`}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={() => setDragging(false)}
          onMouseLeave={() => setDragging(false)}
        >
          {loading ? (
            <div className="org-state"><LoadingBlock label="Building organization hierarchy..." /></div>
          ) : loadError ? (
            <div className="org-state"><ErrorState onRetry={loadOrgChart} /></div>
          ) : hasNoEmployees ? (
            <div className="org-state"><EmptyState title="No employees" message="No employees are available to build the organization chart." /></div>
          ) : hasNoRoot ? (
            <div className="org-state">
              <EmptyState title="No root configured" message="No CEO or root reporting employee is configured." />
              {groupedNodes.length > 0 && (
                <div className="org-tree-canvas org-orphans">
                  <OrgTree roots={groupedNodes} expandedIds={expandedIds} highlightedId={highlightedId} pathIds={pathIds} onToggle={toggleNode} onOpen={openEmployee} />
                </div>
              )}
            </div>
          ) : (
            <div
              className="org-tree-canvas"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'top center',
              }}
            >
              <OrgTree roots={groupedNodes} expandedIds={expandedIds} highlightedId={highlightedId} pathIds={pathIds} onToggle={toggleNode} onOpen={openEmployee} />
            </div>
          )}
        </div>
      </main>

      <style jsx global>{`
        .org-page {
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
          padding: 0;
        }

        .org-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          padding: 1.25rem 1.75rem;
          background: var(--surface-overlay);
          border-bottom: 1px solid var(--border-subtle);
          flex-wrap: wrap;
        }

        .org-toolbar .page-title,
        .org-toolbar .page-subtitle {
          margin: 0;
        }

        .org-actions,
        .org-zoom {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .org-search .input-field {
          width: min(320px, 78vw);
          border-radius: var(--radius-full);
          font-size: 0.85rem;
        }

        .org-zoom {
          padding: 0.25rem;
          border-radius: var(--radius-full);
        }

        .org-zoom span {
          min-width: 44px;
          text-align: center;
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-muted);
        }

        .org-viewport {
          flex: 1;
          overflow: auto;
          background: var(--surface-canvas);
          cursor: grab;
          user-select: none;
          padding: 1rem;
        }

        .org-viewport.is-dragging {
          cursor: grabbing;
        }

        .org-state {
          min-height: 100%;
          display: grid;
          place-items: center;
          gap: 1.25rem;
        }

        .org-tree-canvas {
          --org-card-width: 180px;
          --org-gap-x: 30px;
          --org-gap-y: 20px;
          --org-branch-inset: 105px;
          width: max-content;
          min-width: 100%;
          padding: 0.75rem 1.5rem 4rem;
          transition: transform 0.12s ease;
        }

        .org-tree,
        .org-children {
          display: flex;
          justify-content: center;
          align-items: flex-start;
          gap: var(--org-gap-x);
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .org-tree {
          gap: var(--org-gap-x);
        }

        .org-node {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: var(--org-gap-y);
        }

        .org-tree > .org-node {
          padding-top: 0;
        }

        .org-node::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          width: 2px;
          height: var(--org-gap-y);
          background: var(--border-strong);
          transform: translateX(-50%);
        }

        .org-tree > .org-node::before {
          display: none;
        }

        .org-node.has-children > .org-card::after {
          content: '';
          position: absolute;
          left: 50%;
          bottom: calc(var(--org-gap-y) * -1);
          width: 2px;
          height: var(--org-gap-y);
          background: var(--border-strong);
          transform: translateX(-50%);
        }

        .org-children {
          position: relative;
          padding-top: var(--org-gap-y);
          margin-top: var(--org-gap-y);
        }

        .org-children::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          right: 50%;
          height: 2px;
          background: var(--border-strong);
        }

        .org-children:has(> .org-node:nth-child(2))::before {
          left: var(--org-branch-inset);
          right: var(--org-branch-inset);
        }

        .org-card {
          position: relative;
          z-index: 1;
          width: var(--org-card-width);
          min-height: 88px;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          padding: 0.6rem 0.65rem;
          border: 1px solid var(--border-subtle);
          border-left: 3px solid var(--accent);
          border-radius: 8px;
          background: var(--surface-raised);
          box-shadow: var(--shadow-1);
          color: var(--text-primary);
          text-align: left;
          cursor: pointer;
          transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
        }

        .org-card:hover {
          border-color: var(--accent);
          box-shadow: var(--shadow-2);
          transform: translateY(-1px);
        }

        .org-card.is-highlighted {
          border: 2px solid var(--accent);
          background: var(--accent-soft);
          box-shadow: var(--shadow-3);
        }

        .org-card.is-path {
          border-color: var(--accent);
        }

        .org-card.is-inactive {
          opacity: 0.68;
        }

        .org-card-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          min-width: 0;
        }

        .org-card-title {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.12rem;
        }

        .org-card-title strong,
        .org-card-title span,
        .org-card-meta span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .org-card-title strong {
          font-size: 0.78rem;
          line-height: 1.2;
        }

        .org-card-title span {
          color: var(--text-secondary);
          font-size: 0.68rem;
          line-height: 1.2;
        }

        .org-card-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.45rem;
          border-top: 1px solid var(--border-subtle);
          padding-top: 0.4rem;
          color: var(--text-muted);
          font-size: 0.66rem;
          line-height: 1.2;
        }

        .org-toggle {
          position: absolute;
          bottom: -11px;
          left: 50%;
          width: 22px;
          height: 22px;
          display: grid;
          place-items: center;
          transform: translateX(-50%);
          border-radius: 50%;
          border: 2px solid var(--surface-canvas);
          background: var(--accent);
          color: #fff;
          font-weight: 800;
          font-size: 0.8rem;
          box-shadow: var(--shadow-2);
          cursor: pointer;
          z-index: 2;
        }

        @media (max-width: 760px) {
          .org-page {
            height: auto;
            min-height: 100vh;
          }

          .org-toolbar {
            align-items: flex-start;
          }

          .org-actions {
            width: 100%;
          }

          .org-viewport {
            overflow: visible;
            padding: 1rem;
          }

          .org-tree-canvas {
            width: 100%;
            min-width: 0;
            padding: 0 0 3rem;
            transform: none !important;
          }

          .org-tree,
          .org-children {
            width: 100%;
            display: block;
          }

          .org-node {
            align-items: stretch;
            padding: 0 0 0 1.25rem;
            margin: 0.75rem 0;
          }

          .org-node::before,
          .org-node.has-children > .org-card::after,
          .org-children::before {
            display: none;
          }

          .org-node::after {
            content: '';
            position: absolute;
            left: 0.35rem;
            top: 0;
            bottom: -0.75rem;
            width: 2px;
            background: var(--border-subtle);
          }

          .org-card {
            width: 100%;
          }

          .org-children {
            margin-top: 0.75rem;
            padding-top: 0;
          }
        }
      `}</style>
    </div>
  );
}
