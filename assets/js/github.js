// GitHub connection for the Admin page.
//
// GitHub Pages has no server, so the Admin page signs in with a GitHub fine-grained
// personal access token. GitHub checks it on every request: only people with write
// access to the repository can sign in and publish changes. The token stays in this
// browser (this tab only, unless "remember" is ticked) and is sent only to api.github.com.

const API = 'https://api.github.com';
const TOKEN_KEY = 'ii-admin-token';
const REPO_KEY = 'ii-admin-repo';

// Used when the site isn't served from <owner>.github.io/<repo>/ (for example a local preview).
const DEFAULT_REPO = { owner: 'TheSamuraiDrag', repo: 'TheAncientKid', branch: '' };

const store = {
  get(k) {
    try { return sessionStorage.getItem(k) || localStorage.getItem(k); } catch { return null; }
  },
  set(k, v, remember) {
    try {
      (remember ? localStorage : sessionStorage).setItem(k, v);
      (remember ? sessionStorage : localStorage).removeItem(k);
    } catch { /* storage blocked: stay signed in for this page only */ }
  },
  clear(k) {
    try { sessionStorage.removeItem(k); localStorage.removeItem(k); } catch { /* ignore */ }
  },
};

let memoryToken = null;

export function repoConfig() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(REPO_KEY) || 'null'); } catch { /* ignore */ }
  if (saved && saved.owner && saved.repo) return saved;
  const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
  const first = location.pathname.split('/').filter(Boolean)[0];
  if (m && first) return { owner: m[1], repo: first, branch: '' };
  return { ...DEFAULT_REPO };
}

export function saveRepoConfig(cfg) {
  try { localStorage.setItem(REPO_KEY, JSON.stringify(cfg)); } catch { /* ignore */ }
}

export const getToken = () => memoryToken || store.get(TOKEN_KEY);

// Short status for the Admin page header.
export const statusHtml = () => (getToken()
  ? '· GitHub connected for publishing (<button type="button" class="link-btn" data-gh-disconnect>disconnect</button>)'
  : '· GitHub not connected yet (only needed to publish)');
export function setToken(token, remember) { memoryToken = token; store.set(TOKEN_KEY, token, remember); }
export function signOut() { memoryToken = null; store.clear(TOKEN_KEY); }

export class GitHubError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function api(path, { method = 'GET', body, token = getToken() } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).message || msg; } catch { /* ignore */ }
    throw new GitHubError(msg, res.status);
  }
  return res.status === 204 ? null : res.json();
}

const repoPath = (cfg) => `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`;

// Check the token can see the repository and push to it. Returns { login, branch }.
export async function verify(cfg, token) {
  let repo;
  try {
    repo = await api(repoPath(cfg), { token });
  } catch (e) {
    if (e.status === 401) throw new GitHubError('GitHub didn’t accept that token. Check it was copied in full and hasn’t expired.', 401);
    if (e.status === 404 || e.status === 403) throw new GitHubError('That token can’t see the website’s repository. When creating it, choose that repository under “Repository access”.', e.status);
    throw e;
  }
  if (repo.permissions && !repo.permissions.push) {
    throw new GitHubError('Your GitHub account can view the website’s repository but can’t edit it. Ask the owner to add you as a collaborator.', 403);
  }
  let branch = cfg.branch;
  if (!branch) {
    try { branch = (await api(`${repoPath(cfg)}/pages`, { token })).source.branch; } catch { branch = repo.default_branch; }
  }
  let login = '';
  try { login = (await api('/user', { token })).login; } catch { /* fine-grained tokens may not read the profile */ }
  return { login, branch };
}

const b64ToText = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));
export function textToB64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export const blobToB64 = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1]);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

export async function headSha(cfg) {
  return (await api(`${repoPath(cfg)}/git/ref/heads/${encodeURIComponent(cfg.branch)}`)).object.sha;
}

// Latest version of a text file on the branch (not the cached copy GitHub Pages serves).
export async function readText(cfg, path, ref = cfg.branch) {
  const f = await api(`${repoPath(cfg)}/contents/${path}?ref=${encodeURIComponent(ref)}`);
  return b64ToText(f.content);
}

// One commit: files = [{ path, b64 }] to add or replace, remove = [path].
export async function commit(cfg, { message, parent, files = [], remove = [] }) {
  const base = await api(`${repoPath(cfg)}/git/commits/${parent}`);
  const tree = [];
  for (const f of files) {
    const blob = await api(`${repoPath(cfg)}/git/blobs`, { method: 'POST', body: { content: f.b64, encoding: 'base64' } });
    tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  remove.forEach((path) => tree.push({ path, mode: '100644', type: 'blob', sha: null }));
  const newTree = await api(`${repoPath(cfg)}/git/trees`, { method: 'POST', body: { base_tree: base.tree.sha, tree } });
  const c = await api(`${repoPath(cfg)}/git/commits`, { method: 'POST', body: { message, tree: newTree.sha, parents: [parent] } });
  await api(`${repoPath(cfg)}/git/refs/heads/${encodeURIComponent(cfg.branch)}`, { method: 'PATCH', body: { sha: c.sha } });
  return c;
}

/* ---------- Activity (Admin logbook) ---------- */

// Works without a token for a public repository (GitHub allows about 60 requests an hour per
// visitor without one); with a connected token it also works for a private repository.
export async function repoInfo(cfg) {
  const r = await api(repoPath(cfg));
  return { defaultBranch: r.default_branch, isPrivate: Boolean(r.private) };
}

export const listCommits = (cfg, { branch, page = 1, perPage = 30 }) =>
  api(`${repoPath(cfg)}/commits?sha=${encodeURIComponent(branch)}&per_page=${perPage}&page=${page}`);

export const getCommit = (cfg, sha) => api(`${repoPath(cfg)}/commits/${encodeURIComponent(sha)}`);

export const rawUrl = (cfg, ref, path) =>
  `https://raw.githubusercontent.com/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/${ref}/${path}`;
