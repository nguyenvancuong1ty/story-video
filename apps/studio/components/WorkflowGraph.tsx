"use client";

import { useEffect, useMemo, useState } from "react";
import { Background, Controls, ReactFlow, type Node } from "@xyflow/react";

import { getProjectWorkflow, sendStageCommand } from "../lib/api";
import { toFlowEdges, toFlowNodes, type WorkflowItem } from "../lib/workflow";
import { ArtifactPanel } from "./ArtifactPanel";
import { ConfigPanel } from "./ConfigPanel";
import { ReviewPanel } from "./ReviewPanel";
import { WorkflowNode } from "./WorkflowNode";

const INITIAL_WORKFLOW: WorkflowItem[] = ["INPUT", "RESEARCH", "FACT_CHECK", "EDITORIAL_ANGLE", "LOCALIZATION", "SCRIPT", "STORYBOARD", "ASSET_PLANNING", "IMAGE_GENERATION", "TTS", "TIMING_SUBTITLE", "COMPOSITION", "RENDER", "QA", "PUBLISHING_PACKAGE"].map((key) => ({ key, status: key === "RESEARCH" ? "pending" : "pending", progress: key === "IMAGE_GENERATION" ? { completed: 18, total: 24 } : undefined, costUsd: key === "RESEARCH" ? 0.02 : 0, log: "Awaiting stage command" }));
const COMMANDS = ["run", "retry", "rerun_from_here", "approve", "reject", "cancel"] as const;

export const WorkflowGraph = () => {
  const [workflow, setWorkflow] = useState(INITIAL_WORKFLOW);
  const [selectedKey, setSelectedKey] = useState<string>("RESEARCH");
  const [notice, setNotice] = useState<string>();
  const nodes = useMemo(() => toFlowNodes(workflow).map((node) => ({ ...node, type: "workflow" })), [workflow]);
  const selected = workflow.find((stage) => stage.key === selectedKey);

  useEffect(() => {
    void getProjectWorkflow<WorkflowItem[]>("demo")
      .then(setWorkflow)
      .catch(() => setNotice("API unavailable; showing the local workflow shape."));
  }, []);

  const submitCommand = async (type: (typeof COMMANDS)[number]) => {
    if (!selected) return;
    setNotice("Submitting command...");
    try {
      const result = await sendStageCommand<{ status: string; log: string }>("demo", selected.key, type);
      setWorkflow((current) => current.map((stage) => stage.key === selected.key ? { ...stage, status: result.status, log: result.log } : stage));
      setNotice(`Command accepted: ${type}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Stage command failed");
    }
  };

  return <main className="studio-shell"><header className="topbar"><div><p className="eyebrow">Knowledge Story Video Factory</p><span>Production control room</span></div><div className="system-status"><i /> Pipeline online</div></header><div className="studio-grid"><ConfigPanel /><section className="graph-panel"><div className="panel-heading"><div><p className="eyebrow">Workflow</p><h2>Artifact production</h2></div><div className="command-actions">{COMMANDS.map((command) => <button key={command} type="button" onClick={() => submitCommand(command)} disabled={!selected}>{command.replaceAll("_", " ")}</button>)}</div></div><div className="notice" aria-live="polite">{notice ?? "Select a stage to inspect or run."}</div><div className="flow-canvas"><ReactFlow nodes={nodes as Node[]} edges={toFlowEdges(workflow)} nodeTypes={{ workflow: WorkflowNode }} onNodeClick={(_, node) => setSelectedKey(node.id)} fitView minZoom={0.45}><Background gap={22} size={1} /><Controls showInteractive={false} /></ReactFlow></div></section><div className="right-rail"><ArtifactPanel stage={selected} /><ReviewPanel /></div></div></main>;
};
