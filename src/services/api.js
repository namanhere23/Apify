async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = (response.headers.get('content-type') || '').includes('application/json') ? await response.json() : null;
  if (!response.ok) throw new Error(data?.error || data?.message || `Request failed (${response.status}). Please try again.`);
  if (!data) throw new Error('The server returned an unexpected response. Check that the API is running.');
  return data;
}
export const api = {
  getStatus: signal => request('/status', { signal }),
  getPeople: async signal => (await request('/people', { signal })).people,
  getPerson: (id, signal) => request(`/people/${encodeURIComponent(id)}`, { signal }),
  getRankings: (id, signal) => request(`/people/${encodeURIComponent(id)}/rankings`, { signal }),
  getDate: (id, signal) => request(`/dates/${encodeURIComponent(id)}`, { signal }),
  simulateDate: (personAId, personBId, signal) => request('/date', { method: 'POST', body: JSON.stringify({ personAId, personBId }), signal }),
  ingestPerson: (data, signal) => request('/ingest', { method: 'POST', body: JSON.stringify(data), signal }),
  updateSettings: (apifyToken, signal) => request('/settings', { method: 'POST', body: JSON.stringify({ apifyToken }), signal }),
  getExport: signal => request('/export', { signal }),
};
export function downloadJSON(data, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

