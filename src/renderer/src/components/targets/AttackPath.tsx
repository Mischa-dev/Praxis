import { useRef, useEffect, useMemo, useCallback } from 'react'
import * as d3 from 'd3'
import type { TargetDetail, Scan, Service, Vulnerability, Credential } from '@shared/types'
import { useUiStore } from '../../stores/ui-store'
import { EmptyState } from '../common'
import { GitBranch } from 'lucide-react'

// ── Node & Edge types ──

type NodeKind = 'target' | 'scan' | 'service' | 'vulnerability' | 'credential'

interface GraphNode extends d3.SimulationNodeDatum {
  id: string
  kind: NodeKind
  label: string
  sublabel?: string
  phase: 'passive' | 'active' | 'exploit' | 'post-exploit'
  entityId?: number // for navigation
  scanId?: number
}

interface GraphEdge extends d3.SimulationLinkDatum<GraphNode> {
  id: string
}

// ── Phase colors ──

const phaseColors: Record<GraphNode['phase'], string> = {
  passive: '#22c55e',  // green
  active: '#f59e0b',   // amber
  exploit: '#ef4444',  // red
  'post-exploit': '#a855f7' // purple
}

const kindShapes: Record<NodeKind, string> = {
  target: 'M -12 0 L 0 -12 L 12 0 L 0 12 Z',         // diamond
  scan: 'M -10 -8 L 10 -8 L 10 8 L -10 8 Z',          // rectangle
  service: 'M 0 -10 L 10 10 L -10 10 Z',                // triangle (up)
  vulnerability: 'M -10 -5 L 0 -10 L 10 -5 L 10 5 L 0 10 L -10 5 Z', // hexagon
  credential: 'M -8 -8 L 8 -8 L 8 8 L -8 8 Z'          // small square
}

// ── Classify scan tool into phase ──

function classifyScan(scan: Scan): GraphNode['phase'] {
  const cmd = scan.command.toLowerCase()
  const tool = scan.tool_id.toLowerCase()

  // Post-exploitation tools
  const postExploit = ['linpeas', 'winpeas', 'pspy', 'linux-exploit-suggester', 'bloodhound']
  if (postExploit.some((t) => tool.includes(t))) return 'post-exploit'

  // Exploit tools
  const exploit = ['hydra', 'medusa', 'ncrack', 'john', 'hashcat', 'sqlmap', 'evil-winrm',
    'msfconsole', 'msfvenom', 'searchsploit', 'impacket-psexec', 'impacket-wmiexec',
    'impacket-smbexec', 'impacket-secretsdump', 'pwncat', 'xsstrike', 'dalfox', 'commix']
  if (exploit.some((t) => tool.includes(t))) return 'exploit'

  // Active tools
  const active = ['gobuster', 'feroxbuster', 'ffuf', 'nikto', 'nuclei', 'wpscan',
    'enum4linux', 'smbclient', 'smbmap', 'crackmapexec', 'dnsenum', 'dnsrecon',
    'subfinder', 'amass', 'arjun', 'dirb', 'dirbuster']
  if (active.some((t) => tool.includes(t))) return 'active'

  // Check for aggressive flags in command
  if (cmd.includes('-sv') || cmd.includes('--script') || cmd.includes('-a ')) return 'active'

  return 'passive'
}

// ── Build graph from target detail ──

function buildGraph(detail: TargetDetail): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  // Root: target node
  nodes.push({
    id: 'target',
    kind: 'target',
    label: detail.value,
    sublabel: detail.type.toUpperCase(),
    phase: 'passive',
    entityId: detail.id
  })

  // Map scan_id to services/vulns/creds for edge building
  const servicesByScan = new Map<string, Service[]>()
  for (const svc of detail.services) {
    const key = svc.discovered_by
    if (!servicesByScan.has(key)) servicesByScan.set(key, [])
    servicesByScan.get(key)!.push(svc)
  }

  const vulnsByScan = new Map<string, Vulnerability[]>()
  for (const vuln of detail.vulnerabilities) {
    const key = vuln.discovered_by
    if (!vulnsByScan.has(key)) vulnsByScan.set(key, [])
    vulnsByScan.get(key)!.push(vuln)
  }

  const credsBySource = new Map<string, Credential[]>()
  for (const cred of detail.credentials) {
    const key = cred.source
    if (!credsBySource.has(key)) credsBySource.set(key, [])
    credsBySource.get(key)!.push(cred)
  }

  // Only show completed/failed scans (not queued/running)
  const completedScans = detail.scans.filter(
    (s) => s.status === 'completed' || s.status === 'failed'
  )

  // Sort scans chronologically
  const sortedScans = [...completedScans].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  for (const scan of sortedScans) {
    const scanNodeId = `scan-${scan.id}`
    const phase = classifyScan(scan)

    nodes.push({
      id: scanNodeId,
      kind: 'scan',
      label: scan.tool_id,
      sublabel: scan.status === 'completed' ? `exit ${scan.exit_code}` : 'FAILED',
      phase,
      scanId: scan.id,
      entityId: scan.id
    })

    // Edge: target → scan
    edges.push({ id: `e-target-${scan.id}`, source: 'target', target: scanNodeId })

    // Services discovered by this scan's tool_id
    const svcs = servicesByScan.get(scan.tool_id) || []
    // Deduplicate services across scans — only add if not already added
    for (const svc of svcs) {
      const svcNodeId = `svc-${svc.id}`
      if (!nodes.find((n) => n.id === svcNodeId)) {
        nodes.push({
          id: svcNodeId,
          kind: 'service',
          label: `${svc.port}/${svc.protocol}`,
          sublabel: svc.service_name || undefined,
          phase,
          entityId: svc.id
        })
      }
      edges.push({ id: `e-${scanNodeId}-${svcNodeId}`, source: scanNodeId, target: svcNodeId })
    }

    // Vulns discovered by this scan's tool_id
    const vulns = vulnsByScan.get(scan.tool_id) || []
    for (const vuln of vulns) {
      const vulnNodeId = `vuln-${vuln.id}`
      if (!nodes.find((n) => n.id === vulnNodeId)) {
        nodes.push({
          id: vulnNodeId,
          kind: 'vulnerability',
          label: vuln.cve || vuln.title.slice(0, 24),
          sublabel: vuln.severity.toUpperCase(),
          phase: 'exploit',
          entityId: vuln.id
        })
      }
      edges.push({ id: `e-${scanNodeId}-${vulnNodeId}`, source: scanNodeId, target: vulnNodeId })
    }

    // Creds discovered by this scan's tool_id
    const creds = credsBySource.get(scan.tool_id) || []
    for (const cred of creds) {
      const credNodeId = `cred-${cred.id}`
      if (!nodes.find((n) => n.id === credNodeId)) {
        nodes.push({
          id: credNodeId,
          kind: 'credential',
          label: cred.username,
          sublabel: cred.status.toUpperCase(),
          phase: 'post-exploit',
          entityId: cred.id
        })
      }
      edges.push({ id: `e-${scanNodeId}-${credNodeId}`, source: scanNodeId, target: credNodeId })
    }
  }

  // Deduplicate edges
  const edgeSet = new Set<string>()
  const uniqueEdges = edges.filter((e) => {
    const key = `${typeof e.source === 'string' ? e.source : (e.source as GraphNode).id}-${typeof e.target === 'string' ? e.target : (e.target as GraphNode).id}`
    if (edgeSet.has(key)) return false
    edgeSet.add(key)
    return true
  })

  return { nodes, edges: uniqueEdges }
}

// ── Component ──

interface AttackPathProps {
  detail: TargetDetail
}

export function AttackPath({ detail }: AttackPathProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useUiStore((s) => s.navigate)

  const { nodes, edges } = useMemo(() => buildGraph(detail), [detail])

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (node.kind === 'scan' && node.scanId) {
        navigate('scan-results', { scanId: node.scanId })
      } else if (node.kind === 'target' && node.entityId) {
        // Already on target detail
      }
    },
    [navigate]
  )

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || nodes.length <= 1) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Clear previous
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    svg.attr('width', width).attr('height', height)

    // Defs: arrow markers for each phase
    const defs = svg.append('defs')
    for (const [phase, color] of Object.entries(phaseColors)) {
      defs
        .append('marker')
        .attr('id', `arrow-${phase}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 20)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', color)
        .attr('opacity', 0.6)
    }

    // Glow filter
    const filter = defs.append('filter').attr('id', 'glow')
    filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur')
    const merge = filter.append('feMerge')
    merge.append('feMergeNode').attr('in', 'coloredBlur')
    merge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Container group for zoom/pan
    const g = svg.append('g')

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })
    svg.call(zoom)

    // Force simulation
    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphEdge>(edges)
          .id((d) => d.id)
          .distance(80)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30))

    // Edges
    const link = g
      .append('g')
      .selectAll<SVGLineElement, GraphEdge>('line')
      .data(edges)
      .join('line')
      .attr('stroke', (d) => {
        const sourceNode = typeof d.source === 'string' ? nodes.find((n) => n.id === d.source) : (d.source as GraphNode)
        return phaseColors[sourceNode?.phase || 'passive']
      })
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 1.5)
      .attr('marker-end', (d) => {
        const sourceNode = typeof d.source === 'string' ? nodes.find((n) => n.id === d.source) : (d.source as GraphNode)
        return `url(#arrow-${sourceNode?.phase || 'passive'})`
      })

    // Node groups
    const nodeGroup = g
      .append('g')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .on('click', (_event, d) => handleNodeClick(d))
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on('drag', (event, d) => {
            d.fx = event.x
            d.fy = event.y
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null
            d.fy = null
          })
      )

    // Node shape
    nodeGroup
      .append('path')
      .attr('d', (d) => kindShapes[d.kind])
      .attr('fill', (d) => phaseColors[d.phase])
      .attr('fill-opacity', 0.15)
      .attr('stroke', (d) => phaseColors[d.phase])
      .attr('stroke-width', 1.5)
      .attr('filter', 'url(#glow)')

    // Node label
    nodeGroup
      .append('text')
      .text((d) => d.label)
      .attr('dy', 24)
      .attr('text-anchor', 'middle')
      .attr('fill', '#e0e0e0')
      .attr('font-size', 10)
      .attr('font-family', 'JetBrains Mono, monospace')

    // Sublabel
    nodeGroup
      .filter((d) => !!d.sublabel)
      .append('text')
      .text((d) => d.sublabel!)
      .attr('dy', 36)
      .attr('text-anchor', 'middle')
      .attr('fill', '#888')
      .attr('font-size', 8)
      .attr('font-family', 'JetBrains Mono, monospace')

    // Hover effects
    nodeGroup
      .on('mouseenter', function (_, d) {
        d3.select(this)
          .select('path')
          .transition()
          .duration(150)
          .attr('fill-opacity', 0.35)
          .attr('stroke-width', 2.5)
        // Highlight connected edges
        link
          .transition()
          .duration(150)
          .attr('stroke-opacity', (l) => {
            const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id
            const tgt = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id
            return src === d.id || tgt === d.id ? 0.8 : 0.15
          })
          .attr('stroke-width', (l) => {
            const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id
            const tgt = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id
            return src === d.id || tgt === d.id ? 2.5 : 1
          })
      })
      .on('mouseleave', function () {
        d3.select(this)
          .select('path')
          .transition()
          .duration(150)
          .attr('fill-opacity', 0.15)
          .attr('stroke-width', 1.5)
        link
          .transition()
          .duration(150)
          .attr('stroke-opacity', 0.4)
          .attr('stroke-width', 1.5)
      })

    // Tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as GraphNode).x!)
        .attr('y1', (d) => (d.source as GraphNode).y!)
        .attr('x2', (d) => (d.target as GraphNode).x!)
        .attr('y2', (d) => (d.target as GraphNode).y!)

      nodeGroup.attr('transform', (d) => `translate(${d.x},${d.y})`)
    })

    // Fit to viewport after simulation stabilizes
    simulation.on('end', () => {
      const bbox = (g.node() as SVGGElement)?.getBBox()
      if (!bbox) return
      const pad = 40
      const scale = Math.min(
        (width - pad * 2) / (bbox.width || 1),
        (height - pad * 2) / (bbox.height || 1),
        1.5
      )
      const tx = width / 2 - (bbox.x + bbox.width / 2) * scale
      const ty = height / 2 - (bbox.y + bbox.height / 2) * scale
      svg.transition().duration(500).call(
        zoom.transform,
        d3.zoomIdentity.translate(tx, ty).scale(scale)
      )
    })

    return () => {
      simulation.stop()
    }
  }, [nodes, edges, handleNodeClick])

  // Empty state when no scans
  if (detail.scans.filter((s) => s.status === 'completed' || s.status === 'failed').length === 0) {
    return (
      <EmptyState
        icon={<GitBranch className="w-10 h-10" />}
        title="No attack path yet"
        description="Run scans against this target to build the attack path visualization."
      />
    )
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] font-sans text-text-muted flex-shrink-0">
        <span className="uppercase tracking-wider text-text-secondary">Legend:</span>
        {Object.entries(phaseColors).map(([phase, color]) => (
          <span key={phase} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: color, opacity: 0.7 }}
            />
            {phase}
          </span>
        ))}
        <span className="text-border">|</span>
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="-12 -12 24 24">
            <path d={kindShapes.target} fill="none" stroke="#888" strokeWidth="1" />
          </svg>
          target
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="-12 -12 24 24">
            <path d={kindShapes.scan} fill="none" stroke="#888" strokeWidth="1" />
          </svg>
          scan
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="-12 -12 24 24">
            <path d={kindShapes.service} fill="none" stroke="#888" strokeWidth="1" />
          </svg>
          service
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="-12 -12 24 24">
            <path d={kindShapes.vulnerability} fill="none" stroke="#888" strokeWidth="1" />
          </svg>
          vuln
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="-12 -12 24 24">
            <path d={kindShapes.credential} fill="none" stroke="#888" strokeWidth="1" />
          </svg>
          cred
        </span>
      </div>

      {/* Graph */}
      <div ref={containerRef} className="flex-1 min-h-0 rounded-lg border border-border bg-[#080808] relative overflow-hidden">
        <svg ref={svgRef} className="w-full h-full" />
      </div>
    </div>
  )
}
