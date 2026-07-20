const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const readResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) throw new Error((await response.json() as { error?: string }).error ?? "Stage command failed");
  return response.json() as Promise<T>;
};

export const getProjectWorkflow = async <T>(projectId: string): Promise<T> =>
  readResponse<T>(await fetch(`${apiBaseUrl}/projects/${projectId}/workflow`));

export const sendStageCommand = async <T>(projectId: string, stage: string, type: string): Promise<T> =>
  readResponse<T>(await fetch(`${apiBaseUrl}/projects/${projectId}/stages/${stage}/commands`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type }) }));
