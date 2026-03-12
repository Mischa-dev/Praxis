import { ResultsView } from '../results'
export default function ScanResults({ params }: { params: Record<string, unknown> }) {
  return <ResultsView scanId={(params.scanId as number) ?? 0} />
}
