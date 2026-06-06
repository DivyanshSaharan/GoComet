const API_BASE = import.meta.env.VITE_API_BASE || "";

export async function requestJson(path, options) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
}

export async function analyzeFile(file) {
  const formData = new FormData();
  formData.append("document", file);
  return requestJson("/api/runs", { method: "POST", body: formData });
}

export async function listRuns(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  return requestJson(`/api/runs?${params.toString()}`);
}

export async function getRun(runId) {
  return requestJson(`/api/runs/${runId}`);
}

export async function getRunDocument(runId) {
  return requestJson(`/api/runs/${runId}/document`);
}

export async function updateRunAction(runId, action, note = "") {
  return requestJson(`/api/runs/${runId}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, note })
  });
}

