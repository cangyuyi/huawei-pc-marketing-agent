/* Rednote workspace (M1): brief -> hotspot -> directions -> samples -> design -> review. */
(() => {
  const WS = 'default';
  const BASE = '/api/v1/workspaces/' + WS + '/apps/rednote';
  const $ = (id) => document.getElementById(id);
  const state = {
    section: 'brief',
    itemId: null,
    snapshotId: null,
    brief: null,
    selectionId: null,
    directions: [],
    selected: [],
    boardId: null,
    candidates: [],
    documentId: null,
    documentVersion: null,
    revisionId: null,
    approvalId: null,
    planId: null,
  };

  function setStatus(text, kind) {
    const node = $('ws-status');
    node.textContent = text;
    node.style.color = kind === 'error' ? 'var(--danger)' : (kind === 'ok' ? 'var(--success)' : '');
  }

  async function api(path, options) {
    const opts = options || {};
    const response = await fetch(BASE + path, {
      method: opts.method || 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json', 'X-Workspace-Id': WS }, opts.headers || {}),
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data = null;
    try { data = await response.json(); } catch (error) { data = null; }
    if (!response.ok) {
      const message = (data && (data.message || (data.detail && data.detail.message))) || ('请求失败 ' + response.status);
      const code = (data && (data.code || (data.detail && data.detail.code))) || '';
      throw new Error(code ? code + '：' + message : message);
    }
    return data;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  function requireItem() {
    if (!state.itemId) throw new Error('请先在“简报与产品”里从当前对话生成简报');
  }

  // ------------------------------------------------------------ sections
  function renderBrief() {
    const box = $('ws-content');
    if (!state.brief) {
      box.innerHTML = '<div class="empty-state"><div class="empty-icon">▤</div><h3>还没有简报</h3>' +
        '<p>优先在上方点“从当前对话生成简报”，产品、场景、利益点和事实会按服务端引用带入，不需要重复填写。</p>' +
        '<div class="ws-inline"><input id="ws-product" placeholder="没有对话时，可先填产品型号（降级路径）">' +
        '<button type="button" class="btn-secondary" id="ws-manual-brief">生成简版简报</button></div></div>';
      return;
    }
    const brief = state.brief;
    const products = (brief.products || []).map(p => '<li>' + escapeHtml(p.model_name || '') +
      ' ' + escapeHtml(p.configuration || '') + '</li>').join('');
    const facts = (brief.facts || []).slice(0, 6).map(f => '<li>' + escapeHtml(f.text) +
      ' <span class="hint">' + escapeHtml(f.source || '') + '</span></li>').join('');
    box.innerHTML = '<div class="ws-card"><h3>简报快照</h3>' +
      '<p class="hint">content hash：' + escapeHtml(state.snapshotId ? state.snapshotId.slice(0, 12) : '') + '</p>' +
      '<p><strong>内容目标：</strong>' + escapeHtml(brief.objective || '未设置') + '</p>' +
      '<p><strong>场景：</strong>' + escapeHtml((brief.scenarios || []).join('、') || '未提供') + '</p>' +
      '<p><strong>产品：</strong></p><ul>' + (products || '<li>未提供</li>') + '</ul>' +
      '<p><strong>已核实事实：</strong></p><ul>' + (facts || '<li>未提供</li>') + '</ul>' +
      '<p class="hint">上游事实仍保留来源与核实状态；本区修正默认不改上游。</p></div>';
  }

  function renderTrend() {
    const topics = (window.AgentApp && window.AgentApp.getHotTopics && window.AgentApp.getHotTopics()) || [];
    const box = $('ws-content');
    if (!topics.length) {
      box.innerHTML = '<div class="empty-state"><div class="empty-icon">🔥</div><h3>还没有热点</h3>' +
        '<p>先在左侧“热点搜索”刷新热点，再回到这里选择主热点。</p></div>';
      return;
    }
    box.innerHTML = '<div class="ws-card"><h3>选择主热点</h3><p class="hint">用户明确选择一个主热点；可选最多两个辅助话题。' +
      '来源与观测时间随选择一起冻结。</p>' +
      topics.map((topic, index) => '<button type="button" class="ws-topic" data-topic-index="' + index + '">' +
        '<strong>' + escapeHtml(topic.title) + '</strong><span class="hint">' +
        escapeHtml(topic.source || '') + (topic.url ? ' · ' + escapeHtml(topic.url) : '') + '</span></button>').join('') +
      '</div>';
  }

  function renderIdeas() {
    const box = $('ws-content');
    if (!state.directions.length) {
      box.innerHTML = '<div class="ws-card"><h3>创意方向</h3>' +
        '<p class="hint">生成 6 个真正不同的方向，至少覆盖 3 类表达机制和 3 个视觉家族。</p>' +
        '<button type="button" class="btn-primary" id="ws-make-ideas">生成 6 个创意方向</button></div>';
      return;
    }
    box.innerHTML = '<div class="ws-card"><h3>选择最多 3 个方向进入样张比较</h3>' +
      state.directions.map(row => '<label class="ws-direction"><input type="checkbox" data-direction="' + row.id + '"' +
        (state.selected.includes(row.id) ? ' checked' : '') + '><span><strong>' + escapeHtml(row.title) + '</strong>' +
        '<span class="hint">' + escapeHtml(row.expression_id) + ' · ' + escapeHtml(row.family_id) + ' · ' +
        escapeHtml(row.narrative_id) + ' · ' + escapeHtml(row.product_mode_id) + '</span>' +
        '<span class="hint">' + escapeHtml(row.hook) + '</span>' +
        '<span class="hint">风险：' + escapeHtml(row.risk) + '</span></span></label>').join('') +
      '<button type="button" class="btn-primary" id="ws-make-samples">制作比较样张</button></div>';
  }

  function renderSamples() {
    const box = $('ws-content');
    if (!state.candidates.length) {
      box.innerHTML = '<div class="empty-state"><div class="empty-icon">▦</div><h3>还没有样张</h3>' +
        '<p>在“创意方向”里选最多 3 个方向并制作比较样张。</p></div>';
      return;
    }
    box.innerHTML = '<div class="ws-card"><h3>样张比较</h3><p class="hint">当前为模板样张（未使用真实产品图），' +
      '接入快图编辑器后替换为可编辑设计文档。</p><div class="ws-samples">' +
      state.candidates.map(row => '<figure><img src="' + escapeHtml(row.asset_url) + '" alt="' + escapeHtml(row.role) + '">' +
        '<figcaption>' + escapeHtml(row.role) + '</figcaption></figure>').join('') + '</div></div>';
  }

  function renderDesign() {
    const box = $('ws-content');
    const payload = {
      engine: 'vue-fabric-editor',
      pages: state.candidates.map(row => ({ role: row.role, asset: row.asset_url, bindings: [] })),
    };
    box.innerHTML = '<div class="ws-card"><h3>设计文档</h3>' +
      '<p class="hint">保存原生编辑器 payload + 语义绑定 sidecar + 资产/字体 manifest；' +
      '快图编辑器构建产物就绪后由 <code>/studio</code> 打开，未就绪时保留 JSON 往返。</p>' +
      '<textarea id="ws-design-json" rows="10">' + escapeHtml(JSON.stringify(payload, null, 2)) + '</textarea>' +
      '<div class="hot-actions"><button type="button" class="btn-primary" id="ws-save-design">保存设计文档</button>' +
      '<a class="btn-secondary" href="/studio" target="_blank" rel="noreferrer">打开编辑器</a></div>' +
      (state.documentId ? '<p class="hint">当前文档：' + escapeHtml(state.documentId) +
        ' · version ' + escapeHtml(String(state.documentVersion)) + '</p>' : '') + '</div>';
  }

  function renderReview() {
    const box = $('ws-content');
    box.innerHTML = '<div class="ws-card"><h3>审核与发布（人工路径）</h3>' +
      '<p class="hint">发布需要有效审批绑定 revision + manifest hash；连接器写发布登记为待联调。</p>' +
      '<div class="hot-actions">' +
      '<button type="button" class="btn-secondary" id="ws-submit-review">提交审核</button>' +
      '<button type="button" class="btn-secondary" id="ws-approve">批准当前版本</button>' +
      '<button type="button" class="btn-secondary" id="ws-plan">创建人工发布计划</button>' +
      '<button type="button" class="btn-secondary" id="ws-execute">生成发布包</button></div>' +
      '<div class="ws-inline"><input id="ws-note-url" placeholder="回填小红书笔记链接" value="">' +
      '<button type="button" class="btn-secondary" id="ws-report">回填链接</button></div>' +
      '<p class="hint" id="ws-review-state">' + escapeHtml(
        state.revisionId ? '当前 revision：' + state.revisionId : '还没有提交审核的版本') + '</p></div>';
  }

  function renderAnalytics() {
    const box = $('ws-content');
    box.innerHTML = '<div class="ws-card"><h3>运营监控</h3><p class="hint">正在读取数据合同…</p></div>';
    api('/analytics/overview').then(data => {
      box.innerHTML = '<div class="ws-card"><h3>运营监控（合同与空态）</h3>' +
        '<p class="hint">' + escapeHtml(data.note) + '</p>' +
        '<pre>' + escapeHtml(JSON.stringify(data, null, 2)) + '</pre></div>';
    }).catch(error => {
      box.innerHTML = '<div class="ws-card"><h3>运营监控</h3><p class="hint">' + escapeHtml(error.message) + '</p></div>';
    });
  }

  function render() {
    $('ws-nav').querySelectorAll('button[data-ws]').forEach(button => {
      button.classList.toggle('active', button.dataset.ws === state.section);
    });
    const renderers = { brief: renderBrief, trend: renderTrend, ideas: renderIdeas,
                        samples: renderSamples, design: renderDesign, review: renderReview,
                        analytics: renderAnalytics };
    (renderers[state.section] || renderBrief)();
  }

  // ------------------------------------------------------------ actions
  async function createBrief() {
    const conversationId = window.AgentApp && window.AgentApp.getSessionId && window.AgentApp.getSessionId();
    const manual = $('ws-product') ? $('ws-product').value.trim() : '';
    if (!conversationId && !manual) {
      setStatus('当前没有进行中的对话；先填一个产品型号，或在对话里生成方案后再回来。', 'error');
      return;
    }
    setStatus('正在生成简报…');
    try {
      const body = conversationId ? { conversation_id: conversationId } : { product_model: manual };
      const data = await api('/brief-handoffs/consume', { method: 'POST', body });
      state.itemId = data.content_item_id;
      state.snapshotId = data.snapshot_id;
      state.brief = data.brief;
      setStatus('简报已生成：产品/场景/利益点已带入。', 'ok');
      state.section = 'brief';
      render();
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  async function selectTopic(topic) {
    try {
      requireItem();
      const data = await api('/trend-selections', { method: 'POST', body: {
        content_item_id: state.itemId,
        main_topic: topic,
        aux_topics: [],
        scenario: (state.brief && (state.brief.scenarios || [])[0]) || '',
        benefits: (state.brief && state.brief.benefits) || [],
        evidence_ids: topic.url ? [topic.url] : [],
      } });
      state.selectionId = data.selection_id;
      setStatus('已固定主热点：' + topic.title, 'ok');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  async function makeIdeas() {
    try {
      requireItem();
      if (!state.selectionId) throw new Error('请先在“热点选择”里固定一个主热点');
      setStatus('正在生成创意方向…');
      const data = await api('/creative-directions', { method: 'POST', body: {
        content_item_id: state.itemId, count: 6 } });
      state.directions = data.directions;
      state.selected = [];
      setStatus('已生成 ' + data.directions.length + ' 个方向；家族 ' + data.diversity.families +
        ' 个、表达 ' + data.diversity.expressions + ' 个。', 'ok');
      state.section = 'ideas';
      render();
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  async function makeSamples() {
    try {
      if (!state.selected.length) throw new Error('请选择 1–3 个方向');
      setStatus('正在制作样张…');
      const board = await api('/creative-boards', { method: 'POST', body: {
        content_item_id: state.itemId, direction_ids: state.selected } });
      state.boardId = board.board_id;
      const preview = await api('/creative-boards/' + board.board_id + '/preview', { method: 'POST' });
      state.candidates = preview.candidates;
      setStatus('已生成 ' + preview.candidates.length + ' 张比较样张。', 'ok');
      state.section = 'samples';
      render();
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  async function saveDesign() {
    try {
      requireItem();
      const payload = JSON.parse($('ws-design-json').value || '{}');
      if (!state.documentId) {
        const data = await api('/design-documents', { method: 'POST', body: {
          content_item_id: state.itemId, engine: 'vue-fabric-editor', engine_version: 'm1',
          native_payload: payload, sidecar: { bindings: [] }, manifest: { fonts: ['Noto Sans SC'] } } });
        state.documentId = data.id;
        state.documentVersion = data.version;
      } else {
        const data = await api('/design-documents/' + state.documentId, { method: 'PATCH', body: {
          expected_version: state.documentVersion, native_payload: payload } });
        state.documentVersion = data.version;
      }
      setStatus('设计文档已保存，version ' + state.documentVersion, 'ok');
      render();
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  async function submitReview() {
    try {
      requireItem();
      if (!state.documentId) throw new Error('请先在“设计文档”里保存一次');
      const data = await api('/review-submissions', { method: 'POST', body: {
        content_item_id: state.itemId, design_document_id: state.documentId } });
      state.revisionId = data.revision_id;
      setStatus('已提交审核：' + state.revisionId, 'ok');
      render();
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  async function approve() {
    try {
      if (!state.revisionId) throw new Error('请先提交审核');
      const data = await api('/approvals', { method: 'POST', body: {
        content_item_id: state.itemId, revision_id: state.revisionId,
        account_ref: (state.brief && state.brief.account_ref) || 'demo-account',
        approved_window: 'manual', approved_by: 'local-operator' } });
      state.approvalId = data.approval_id;
      setStatus('已批准当前版本。', 'ok');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  async function createPlan() {
    try {
      if (!state.revisionId) throw new Error('请先提交审核');
      const data = await api('/publish-plans', { method: 'POST', body: {
        content_item_id: state.itemId, revision_id: state.revisionId,
        account_ref: (state.brief && state.brief.account_ref) || 'demo-account', mode: 'manual' } });
      state.planId = data.plan_id;
      setStatus('已创建人工发布计划；预约是本站任务，不代表平台提供预约 API。', 'ok');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  async function executePlan() {
    try {
      if (!state.planId) throw new Error('请先创建发布计划');
      const data = await api('/publish-plans/' + state.planId + '/execute', { method: 'POST' });
      setStatus(data.message || data.status, 'ok');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  async function reportNote() {
    try {
      if (!state.planId) throw new Error('请先创建发布计划');
      const url = $('ws-note-url').value.trim();
      if (!url) throw new Error('请填写笔记链接');
      const data = await api('/publish-plans/' + state.planId + '/manual-results', { method: 'POST', body: { url } });
      setStatus(data.message, 'ok');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  // ------------------------------------------------------------ wiring
  $('ws-nav').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-ws]');
    if (!button || button.disabled) return;
    state.section = button.dataset.ws;
    render();
  });

  $('ws-content').addEventListener('click', (event) => {
    const topic = event.target.closest('button[data-topic-index]');
    if (topic) {
      const topics = (window.AgentApp && window.AgentApp.getHotTopics && window.AgentApp.getHotTopics()) || [];
      selectTopic(topics[Number(topic.dataset.topicIndex)]);
      return;
    }
    if (event.target.closest('#ws-make-ideas')) { makeIdeas(); return; }
    if (event.target.closest('#ws-manual-brief')) { createBrief(); return; }
    if (event.target.closest('#ws-make-samples')) { makeSamples(); return; }
    if (event.target.closest('#ws-save-design')) { saveDesign(); return; }
    if (event.target.closest('#ws-submit-review')) { submitReview(); return; }
    if (event.target.closest('#ws-approve')) { approve(); return; }
    if (event.target.closest('#ws-plan')) { createPlan(); return; }
    if (event.target.closest('#ws-execute')) { executePlan(); return; }
    if (event.target.closest('#ws-report')) { reportNote(); }
  });

  $('ws-content').addEventListener('change', (event) => {
    const checkbox = event.target.closest('input[data-direction]');
    if (!checkbox) return;
    const id = checkbox.dataset.direction;
    if (checkbox.checked) {
      if (state.selected.length >= 3) {
        checkbox.checked = false;
        setStatus('最多选择 3 个方向。', 'error');
        return;
      }
      state.selected.push(id);
    } else {
      state.selected = state.selected.filter(value => value !== id);
    }
  });

  $('ws-brief').addEventListener('click', createBrief);
  $('ws-back').addEventListener('click', () => window.AgentApp.switchView('chat'));

  window.WorkspaceApp = { open: render };
})();
