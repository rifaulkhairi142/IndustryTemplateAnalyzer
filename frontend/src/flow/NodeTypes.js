import WorkbookSourceNode from '../nodes/WorkbookSourceNode';
import SheetScopeNode from '../nodes/SheetScopeNode';
import CellRangeNode from '../nodes/CellRangeNode';
import FormulaDiscoveryNode from '../nodes/FormulaDiscoveryNode';
import FormulaTracerNode from '../nodes/FormulaTracerNode';
import FormulaEvaluatorNode from '../nodes/FormulaEvaluatorNode';
import RangeAnalysisNode from '../nodes/RangeAnalysisNode';
import HiddenTraceNode from '../nodes/HiddenTraceNode';
import SheetComparatorNode from '../nodes/SheetComparatorNode';
import AuditEngineNode from '../nodes/AuditEngineNode';
import SpreadsheetViewerNode from '../nodes/SpreadsheetViewerNode';
import DependencyGraphNode from '../nodes/DependencyGraphNode';
import DiffInspectorNode from '../nodes/DiffInspectorNode';
import AuditInspectorNode from '../nodes/AuditInspectorNode';
import ReportExportNode from '../nodes/ReportExportNode';

import HistoricalStatementNode from '../nodes/HistoricalStatementNode';
import HistoricalInspectorNode from '../nodes/HistoricalInspectorNode';
import AiInteractiveNode from '../nodes/AiInteractiveNode';

export const nodeTypes = {
  workbookSource: WorkbookSourceNode,
  sheetScope: SheetScopeNode,
  cellRange: CellRangeNode,
  formulaDiscovery: FormulaDiscoveryNode,
  formulaTracer: FormulaTracerNode,
  formulaEvaluator: FormulaEvaluatorNode,
  rangeAnalysis: RangeAnalysisNode,
  hiddenTrace: HiddenTraceNode,
  sheetComparator: SheetComparatorNode,
  historicalStatement: HistoricalStatementNode,
  historicalInspector: HistoricalInspectorNode,
  aiInteractive: AiInteractiveNode,
  auditEngine: AuditEngineNode,
  spreadsheetViewer: SpreadsheetViewerNode,
  dependencyGraph: DependencyGraphNode,
  diffInspector: DiffInspectorNode,
  auditInspector: AuditInspectorNode,
  reportExport: ReportExportNode,
};

