"use client";

import { Handle, Position } from "@xyflow/react";

export const WorkflowNode = ({ data }: { data: { key: string; status: string; progress?: { completed: number; total: number } } }) => (
  <div className={`workflow-node status-${data.status}`}>
    <Handle type="target" position={Position.Top} />
    <strong>{data.key.replaceAll("_", " ")}</strong>
    <span>{data.status}</span>
    {data.progress ? <small>{data.progress.completed}/{data.progress.total}</small> : null}
    <Handle type="source" position={Position.Bottom} />
  </div>
);
