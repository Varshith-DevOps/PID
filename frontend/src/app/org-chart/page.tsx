'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { getOrgChart } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import { Avatar, Badge, Button, IconButton, LoadingBlock, EmptyState, ErrorState } from '@/components/ui';

interface OrgNode {
  id: string;
  name: string;
  title: string;
  managerId: string | null;
  email?: string;
  photoUrl?: string;
  department?: string;
  children?: OrgNode[];
}

export default function OrgChartPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [rawData, setRawData] = useState<any[]>([]);
  const [treeRoots, setTreeRoots] = useState<OrgNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Interactive Viewport States
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);

  // Collapse State tracking
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading]);

  useEffect(() => {
    if (user) {
      loadOrgChart();
    }
  }, [user]);

  const loadOrgChart = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await getOrgChart();
      setRawData(data);
      buildAndSetTree(data);
    } catch (err) {
      console.error('Error fetching org chart:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const buildAndSetTree = (flatList: any[]) => {
    const map: Record<string, OrgNode> = {};
    const roots: OrgNode[] = [];

    flatList.forEach((emp) => {
      map[emp.id] = { ...emp, children: [] };
    });

    flatList.forEach((emp) => {
      if (emp.managerId && map[emp.managerId]) {
        map[emp.managerId].children?.push(map[emp.id]);
      } else {
        roots.push(map[emp.id]);
      }
    });

    setTreeRoots(roots);
  };

  // Zoom and Pan Handlers
  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.1, 0.4));
  const handleReset = () => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Avoid dragging when clicking interactive items (buttons, links, search input, etc)
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('a')) return;

    setIsDragging(true);
    dragStart.current = { x: e.clientX - panX, y: e.clientY - panY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanX(e.clientX - dragStart.current.x);
    setPanY(e.clientY - dragStart.current.y);
  };

  const handleMouseUp = () => setIsDragging(false);

  // Toggle Collapse Node
  const toggleCollapse = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  // Helper to check if a node or any of its children match the search
  const isMatchOrHasMatchingChild = (node: OrgNode, query: string): boolean => {
    if (!query) return false;
    const q = query.toLowerCase();
    const isCurrentMatch = !!(
      node.name.toLowerCase().includes(q) ||
      node.title.toLowerCase().includes(q) ||
      node.department?.toLowerCase().includes(q)
    );

    if (isCurrentMatch) return true;

    if (node.children && node.children.length > 0) {
      return node.children.some((child) => isMatchOrHasMatchingChild(child, query));
    }

    return false;
  };

  // Check if a node itself matches the search query
  const isExactMatch = (node: OrgNode, query: string): boolean => {
    if (!query) return false;
    const q = query.toLowerCase();
    return !!(
      node.name.toLowerCase().includes(q) ||
      node.title.toLowerCase().includes(q) ||
      node.department?.toLowerCase().includes(q)
    );
  };

  // Recursive Tree Node Renderer
  const renderNode = (node: OrgNode) => {
    const isCollapsed = collapsedNodes[node.id];
    const hasChildren = node.children && node.children.length > 0;
    const hasMatch = searchQuery ? isMatchOrHasMatchingChild(node, searchQuery) : false;
    const exactMatch = searchQuery ? isExactMatch(node, searchQuery) : false;

    return (
      <div key={node.id} className="org-tree-node-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>

        {/* Node Card */}
        <div
          className={`org-card card ${exactMatch ? 'search-highlight' : ''} ${hasMatch ? 'path-highlight' : ''}`}
          style={{
            padding: '1rem',
            width: '260px',
            borderRadius: 'var(--radius-lg)',
            border: exactMatch ? '2px solid var(--accent)' : '1px solid var(--border-subtle)',
            boxShadow: exactMatch ? 'var(--shadow-3)' : 'var(--shadow-1)',
            background: exactMatch ? 'var(--accent-soft)' : 'var(--surface-raised)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            cursor: 'default',
            position: 'relative',
            zIndex: 10,
            marginBottom: hasChildren && !isCollapsed ? '40px' : '0px',
          }}
        >
          {/* Avatar and Info Header */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <Avatar
              name={node.name}
              src={node.photoUrl ? `http://localhost:5000/${node.photoUrl}` : null}
              size={48}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.name}</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '2px 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.title}</p>
            </div>
          </div>

          {/* Department badge and contact trigger */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem' }}>
            <Badge tone="info">{node.department || 'General'}</Badge>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {node.email && (
                <a
                  href={`mailto:${node.email}`}
                  title={`Email ${node.name}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: 'var(--surface-sunken)',
                    color: 'var(--text-secondary)',
                    transition: 'all 0.2s',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </a>
              )}
              <IconButton
                label="View Profile"
                size={26}
                onClick={() => router.push(`/employees/${node.id}`)}
                style={{ borderRadius: '50%', background: 'var(--surface-sunken)', border: 'none' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </IconButton>
            </div>
          </div>

          {/* Expand/Collapse Handle */}
          {hasChildren && (
            <button
              onClick={(e) => toggleCollapse(node.id, e)}
              aria-label={isCollapsed ? 'Expand reports' : 'Collapse reports'}
              className="org-collapse-btn"
              style={{
                position: 'absolute',
                bottom: '-12px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'var(--accent)',
                border: '2px solid var(--surface-canvas)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-2)',
                zIndex: 15,
                transition: 'all 0.2s',
              }}
            >
              {isCollapsed ? '+' : '−'}
            </button>
          )}
        </div>

        {/* Tree Connectors & Children Rendering */}
        {hasChildren && !isCollapsed && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            {/* Vertical connection line indicator overlay */}
            <div className="org-connector-line" style={{
              width: '2px',
              height: '40px',
              background: exactMatch || hasMatch ? 'var(--accent)' : 'var(--border-strong)',
              position: 'absolute',
              top: '80px',
              zIndex: 1,
            }} />

            <div className="org-children-container" style={{
              display: 'flex',
              gap: '2.5rem',
              position: 'relative',
              paddingTop: '20px',
            }}>
              {/* Left-to-right connection crossbar */}
              {node.children && node.children.length > 1 && (
                <div style={{
                  position: 'absolute',
                  top: '0px',
                  left: 'calc(130px + 1.25rem)',
                  right: 'calc(130px + 1.25rem)',
                  height: '2px',
                  background: exactMatch || hasMatch ? 'var(--accent)' : 'var(--border-strong)',
                  zIndex: 1,
                }} />
              )}

              {node.children?.map((child) => (
                <div key={child.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                  {/* Vertical stub line for child */}
                  <div style={{
                    width: '2px',
                    height: '20px',
                    background: searchQuery && isMatchOrHasMatchingChild(child, searchQuery) ? 'var(--accent)' : 'var(--border-strong)',
                    position: 'absolute',
                    top: '-20px',
                    zIndex: 1,
                  }} />
                  {renderNode(child)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (authLoading || !user) {
    return <div className="loading-container"><div className="loading-spinner" />Loading auth...</div>;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100vh', padding: 0 }}>

        {/* Top Control Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          padding: '1.5rem 2rem',
          background: 'var(--surface-overlay)',
          borderBottom: '1px solid var(--border-subtle)',
          zIndex: 20,
        }}>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Organization Chart</h1>
            <p className="page-subtitle" style={{ margin: '4px 0 0 0' }}>Visual Reporting Relationships & Hierarchy</p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {/* Live Search */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search employee or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field"
                style={{
                  width: '260px',
                  borderRadius: 'var(--radius-full)',
                  paddingLeft: '2.5rem',
                  fontSize: '0.85rem',
                }}
              />
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              >
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
              </svg>
            </div>

            {/* Interactive Zoom Map Controls */}
            <div className="card" style={{ display: 'flex', gap: '0.2rem', padding: '0.25rem', borderRadius: 'var(--radius-full)', alignItems: 'center' }}>
              <IconButton label="Zoom Out" size={30} onClick={handleZoomOut} style={{ border: 'none', borderRadius: '50%' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
              </IconButton>
              <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', minWidth: '40px', justifyContent: 'center' }}>
                {Math.round(zoom * 100)}%
              </span>
              <IconButton label="Zoom In" size={30} onClick={handleZoomIn} style={{ border: 'none', borderRadius: '50%' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              </IconButton>
              <IconButton label="Reset View" size={30} onClick={handleReset} style={{ border: 'none', borderRadius: '50%', color: 'var(--accent)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
              </IconButton>
            </div>
          </div>
        </div>

        {/* Tree Render Canvas Viewport */}
        <div
          ref={viewportRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            background: 'var(--surface-canvas)',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
          }}
        >
          {loading ? (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
              <LoadingBlock label="Building organization hierarchy…" />
            </div>
          ) : loadError ? (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
              <ErrorState onRetry={loadOrgChart} />
            </div>
          ) : treeRoots.length === 0 ? (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
              <EmptyState title="No hierarchy yet" message="No active employees configured." />
            </div>
          ) : (
            /* Transformable Node Canvas */
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '15%',
                // translateX(-50%) keeps the tree centred on the viewport; without it
                // the canvas starts at screen-centre and wide subtrees run off-screen.
                transform: `translate(calc(-50% + ${panX}px), ${panY}px) scale(${zoom})`,
                transformOrigin: 'top center',
                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingBottom: '200px',
              }}
            >
              {treeRoots.map((root) => renderNode(root))}
            </div>
          )}
        </div>
      </main>

      <style jsx global>{`
        .search-highlight {
          border: 2px solid var(--accent) !important;
          background: var(--accent-soft) !important;
          box-shadow: var(--shadow-3) !important;
          transform: scale(1.03);
        }
        .path-highlight {
          border-color: var(--accent) !important;
        }
      `}</style>
    </div>
  );
}
