(function () {
  var DEFAULT_HASH = '#/dashboard';
  var routes = [
    {
      id: 'dashboard',
      hash: '#/dashboard',
      label: 'Dashboard',
      section: 'Visao geral',
      title: 'Dashboard',
      render: renderDashboard
    },
    {
      id: 'vehicles',
      hash: '#/vehicles',
      label: 'Veiculos',
      section: 'Modulo',
      title: 'Veiculos',
      render: renderVehicles
    },
    {
      id: 'drivers',
      hash: '#/drivers',
      label: 'Motoristas',
      section: 'Modulo',
      title: 'Motoristas',
      render: function () {
        return renderModulePlaceholder({
          title: 'Motoristas',
          summary: 'Placeholder simples do gestor. O fluxo do motorista final ainda nao foi implementado nesta rodada.',
          endpoint: 'GET /api/drivers',
          next: 'Proximo passo natural: lista autenticada com cadastro e edicao basica de documentos.'
        });
      }
    },
    {
      id: 'checklists',
      hash: '#/checklists',
      label: 'Checklists',
      section: 'Modulo',
      title: 'Checklists',
      render: function () {
        return renderModulePlaceholder({
          title: 'Checklists',
          summary: 'Base pronta para evoluir a abertura, registro de chegada e preenchimento por etapa.',
          endpoint: 'GET /api/checklists',
          next: 'Proximo passo natural: lista com status, acesso ao detalhe e formulario da etapa de saida.'
        });
      }
    },
    {
      id: 'occurrences',
      hash: '#/occurrences',
      label: 'Ocorrencias',
      section: 'Modulo',
      title: 'Ocorrencias',
      render: function () {
        return renderModulePlaceholder({
          title: 'Ocorrencias',
          summary: 'Placeholder do gestor para acompanhar problemas gerados por checklist e resolucao posterior.',
          endpoint: 'GET /api/occurrences',
          next: 'Proximo passo natural: lista com filtros por status, prioridade e resolucao.'
        });
      }
    }
  ];

  var state = {
    authenticated: false,
    renderId: 0,
    user: null,
    vehicleModule: createVehicleModuleState()
  };

  var elements = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    elements.bootScreen = document.getElementById('boot-screen');
    elements.bootMessage = document.getElementById('boot-message');
    elements.loginScreen = document.getElementById('login-screen');
    elements.loginForm = document.getElementById('login-form');
    elements.loginError = document.getElementById('login-error');
    elements.loginSubmit = document.getElementById('login-submit');
    elements.managerShell = document.getElementById('manager-shell');
    elements.navMenu = document.getElementById('nav-menu');
    elements.pageSection = document.getElementById('page-section');
    elements.pageTitle = document.getElementById('page-title');
    elements.userName = document.getElementById('user-name');
    elements.userMeta = document.getElementById('user-meta');
    elements.logoutButton = document.getElementById('logout-button');
    elements.viewRoot = document.getElementById('view-root');
    elements.username = document.getElementById('username');
    elements.password = document.getElementById('password');

    renderNavigation();
    bindEvents();
    bootstrapSession();
  }

  function bindEvents() {
    elements.loginForm.addEventListener('submit', handleLoginSubmit);
    elements.logoutButton.addEventListener('click', handleLogout);
    window.addEventListener('hashchange', handleRouteChange);
  }

  function renderNavigation() {
    elements.navMenu.innerHTML = routes.map(function (route) {
      return [
        '<a class="nav-link" data-route-id="', route.id, '" href="', route.hash, '">',
        '<span>', route.label, '</span>',
        '<span>&rsaquo;</span>',
        '</a>'
      ].join('');
    }).join('');
  }

  async function bootstrapSession() {
    var session = window.GestorApi.readSession();

    if (!session || !session.token) {
      showLogin();
      return;
    }

    setBootMessage('Validando sessao...');

    try {
      var user = await window.GestorApi.getMe();
      state.user = user;
      state.authenticated = true;
      showShell();
      handleRouteChange(true);
    } catch (error) {
      window.GestorApi.clearSession();
      showLogin('Sua sessao expirou. Entre novamente.');
    }
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    toggleLoginBusy(true);
    setLoginError('');

    var username = elements.username.value.trim();
    var password = elements.password.value;

    if (!username || !password) {
      setLoginError('Informe usuario e senha.');
      toggleLoginBusy(false);
      return;
    }

    try {
      var session = await window.GestorApi.login({
        username: username,
        password: password
      });

      state.user = session.user || await window.GestorApi.getMe();
      state.authenticated = true;
      elements.loginForm.reset();
      showShell();
      navigate(DEFAULT_HASH, true);
    } catch (error) {
      setLoginError(error.message || 'Nao foi possivel entrar.');
    } finally {
      toggleLoginBusy(false);
    }
  }

  function handleLogout() {
    window.GestorApi.clearSession();
    state.authenticated = false;
    state.user = null;
    showLogin();
    navigate(DEFAULT_HASH, true);
  }

  async function handleRouteChange(replaceMissingHash) {
    if (!state.authenticated) {
      return;
    }

    var route = getRouteByHash(window.location.hash);

    if (!window.location.hash && replaceMissingHash) {
      navigate(DEFAULT_HASH, true);
      return;
    }

    if (!route) {
      navigate(DEFAULT_HASH, true);
      return;
    }

    setActiveNav(route.id);
    elements.pageSection.textContent = route.section;
    elements.pageTitle.textContent = route.title;

    var currentRenderId = ++state.renderId;
    elements.viewRoot.innerHTML = '<section class="panel loading-card"><p class="muted">Carregando modulo...</p></section>';

    try {
      await route.render(currentRenderId);

      if (currentRenderId === state.renderId) {
        elements.viewRoot.focus();
      }
    } catch (error) {
      if (currentRenderId !== state.renderId) {
        return;
      }

      if (error.status === 401) {
        handleLogout();
        return;
      }

      elements.viewRoot.innerHTML = [
        '<section class="panel module-panel">',
        '<p class="eyebrow">Falha</p>',
        '<h2>O modulo nao pode ser carregado</h2>',
        '<p>', escapeHtml(error.message || 'Erro inesperado.'), '</p>',
        '</section>'
      ].join('');
    }
  }

  function getRouteByHash(hash) {
    for (var i = 0; i < routes.length; i += 1) {
      if (routes[i].hash === hash) {
        return routes[i];
      }
    }

    return null;
  }

  function navigate(hash, replace) {
    if (replace) {
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', hash);

        if (state.authenticated) {
          handleRouteChange(false);
        }

        return;
      }

      window.location.replace(hash);
      return;
    }

    window.location.hash = hash;
  }

  function setActiveNav(routeId) {
    var links = elements.navMenu.querySelectorAll('.nav-link');

    links.forEach(function (link) {
      link.classList.toggle('active', link.getAttribute('data-route-id') === routeId);
    });
  }

  function showShell() {
    var user = state.user || {};
    elements.bootScreen.classList.add('hidden');
    elements.loginScreen.classList.add('hidden');
    elements.managerShell.classList.remove('hidden');
    elements.userName.textContent = user.nome || user.username || 'Usuario autenticado';
    elements.userMeta.textContent = user.role || 'Sem role';
  }

  function showLogin(message) {
    state.authenticated = false;
    elements.bootScreen.classList.add('hidden');
    elements.managerShell.classList.add('hidden');
    elements.loginScreen.classList.remove('hidden');
    setLoginError(message || '');
    window.setTimeout(function () {
      elements.username.focus();
    }, 0);
  }

  function setBootMessage(message) {
    elements.bootMessage.textContent = message;
  }

  function setLoginError(message) {
    elements.loginError.textContent = message;
    elements.loginError.classList.toggle('hidden', !message);
  }

  function toggleLoginBusy(busy) {
    elements.loginSubmit.disabled = busy;
    elements.loginSubmit.textContent = busy ? 'Entrando...' : 'Entrar no gestor';
  }

  async function renderDashboard(renderId) {
    var results = await Promise.allSettled([
      window.GestorApi.listVehicles(),
      window.GestorApi.listDrivers(),
      window.GestorApi.listChecklists(),
      window.GestorApi.listOccurrences()
    ]);

    if (renderId !== state.renderId) {
      return;
    }

    var metrics = [
      makeMetric('Veiculos', results[0]),
      makeMetric('Motoristas', results[1]),
      makeMetric('Checklists', results[2]),
      makeMetric('Ocorrencias', results[3])
    ];

    elements.viewRoot.innerHTML = [
      '<section class="page-grid">',
      '<section class="panel hero-panel">',
      '<span class="status-chip">Base minima ativa</span>',
      '<h2>Frontend do gestor conectado ao backend</h2>',
      '<p>Login, sessao persistida, validacao por <code>/api/auth/me</code>, layout autenticado e navegacao base estao funcionando em uma pagina unica sem framework.</p>',
      '</section>',
      '<section class="metric-grid">',
      metrics.join(''),
      '</section>',
      '<section class="panel module-note">',
      '<p class="eyebrow">Estado atual</p>',
      '<h2>Fundacao pronta para evoluir</h2>',
      '<ul class="feature-list">',
      '<li>Dashboard com resumo inicial dos modulos ja expostos pela API.</li>',
      '<li>Navegacao base para Veiculos, Motoristas, Checklists e Ocorrencias.</li>',
      '<li>Logout limpando a sessao local.</li>',
      '<li>CRUD completo ainda nao implementado nesta camada.</li>',
      '</ul>',
      '</section>',
      '</section>'
    ].join('');
  }

  async function renderVehicles(renderId) {
    resetVehicleModuleFeedback();
    state.vehicleModule.submitting = false;
    await refreshVehiclesList(renderId);
  }

  function makeMetric(label, result) {
    var value = '--';
    var note = 'Ainda nao carregado';

    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      value = String(result.value.length);
      note = 'Itens retornados pela API';
    } else if (result.status === 'rejected') {
      note = escapeHtml(result.reason.message || 'Erro ao consultar');
    }

    return [
      '<article class="panel metric-card">',
      '<h3>', label, '</h3>',
      '<strong>', value, '</strong>',
      '<p class="muted">', note, '</p>',
      '</article>'
    ].join('');
  }

  function renderModulePlaceholder(config) {
    elements.viewRoot.innerHTML = [
      '<section class="page-grid">',
      '<section class="panel module-panel">',
      '<p class="eyebrow">Placeholder</p>',
      '<h2>', escapeHtml(config.title), '</h2>',
      '<p>', escapeHtml(config.summary), '</p>',
      '</section>',
      '<section class="panel module-note">',
      '<p class="eyebrow">Base tecnica</p>',
      '<ul class="module-list">',
      '<li>Endpoint principal atual: <code>', escapeHtml(config.endpoint), '</code></li>',
      '<li>Usuario autenticado: <strong>', escapeHtml(state.user ? state.user.nome : 'Nao identificado'), '</strong></li>',
      '<li>', escapeHtml(config.next), '</li>',
      '</ul>',
      '</section>',
      '</section>'
    ].join('');
  }

  function createVehicleModuleState() {
    return {
      items: [],
      loading: false,
      loadError: '',
      submitting: false,
      formMode: 'create',
      editingId: null,
      formData: getDefaultVehicleFormData(),
      formError: '',
      formSuccess: ''
    };
  }

  function getDefaultVehicleFormData() {
    return {
      placa: '',
      modelo: '',
      marca: '',
      ano: '',
      cor: '',
      km_atual: '',
      status: 'ATIVO'
    };
  }

  function resetVehicleModuleFeedback() {
    state.vehicleModule.formError = '';
    state.vehicleModule.formSuccess = '';
  }

  async function refreshVehiclesList(renderId) {
    var vehicleState = state.vehicleModule;
    vehicleState.loading = true;
    vehicleState.loadError = '';
    renderVehiclesView();

    try {
      var vehicles = await window.GestorApi.listVehicles();

      if (renderId !== state.renderId) {
        return;
      }

      if (!Array.isArray(vehicles)) {
        throw new Error('Resposta invalida ao carregar veiculos.');
      }

      vehicleState.items = vehicles;
      vehicleState.loading = false;
      vehicleState.loadError = '';
      renderVehiclesView();
    } catch (error) {
      if (renderId !== state.renderId) {
        return;
      }

      if (error.status === 401) {
        throw error;
      }

      vehicleState.items = [];
      vehicleState.loading = false;
      vehicleState.loadError = error.message || 'Erro ao carregar veiculos.';
      renderVehiclesView();
    }
  }

  function renderVehiclesView() {
    if (!isVehiclesRouteActive()) {
      return;
    }

    elements.viewRoot.innerHTML = buildVehiclesPageMarkup(state.vehicleModule);
    bindVehicleModuleEvents();
  }

  function bindVehicleModuleEvents() {
    var form = document.getElementById('vehicle-form');
    var cancelButton = document.getElementById('vehicle-form-cancel');
    var retryButton = document.getElementById('vehicle-retry-button');
    var editButtons = elements.viewRoot.querySelectorAll('[data-vehicle-edit-id]');
    var deleteButtons = elements.viewRoot.querySelectorAll('[data-vehicle-delete-id]');

    if (form) {
      form.addEventListener('submit', handleVehicleSubmit);
    }

    if (cancelButton) {
      cancelButton.addEventListener('click', handleVehicleFormCancel);
    }

    if (retryButton) {
      retryButton.addEventListener('click', handleVehicleRetry);
    }

    editButtons.forEach(function (button) {
      button.addEventListener('click', handleVehicleEdit);
    });

    deleteButtons.forEach(function (button) {
      button.addEventListener('click', handleVehicleDelete);
    });
  }

  function buildVehiclesPageMarkup(vehicleState) {
    return [
      '<section class="page-grid">',
      '<section class="panel module-panel">',
      '<div class="module-header-row">',
      '<div>',
      '<p class="eyebrow">Frota</p>',
      '<h2>Gestao de veiculos</h2>',
      '<p>Listagem, cadastro, edicao e exclusao integrados ao backend atual do gestor.</p>',
      '</div>',
      '<span class="status-chip">CRUD minimo ativo</span>',
      '</div>',
      '</section>',
      '<section class="vehicle-layout">',
      buildVehicleFormMarkup(vehicleState),
      buildVehicleListMarkup(vehicleState),
      '</section>',
      '</section>'
    ].join('');
  }

  function buildVehicleFormMarkup(vehicleState) {
    var isEditing = vehicleState.formMode === 'edit';
    var formData = vehicleState.formData;

    return [
      '<section class="panel vehicle-form-panel">',
      '<div class="module-header-row">',
      '<div>',
      '<p class="eyebrow">Formulario</p>',
      '<h2 class="section-title">', isEditing ? 'Editar veiculo' : 'Cadastrar veiculo', '</h2>',
      '</div>',
      '<span class="status-chip">', isEditing ? 'Modo edicao' : 'Novo cadastro', '</span>',
      '</div>',
      '<p class="muted">Campos conectados aos contratos atuais do backend.</p>',
      vehicleState.formError
        ? '<p class="feedback feedback-error">' + escapeHtml(vehicleState.formError) + '</p>'
        : '',
      vehicleState.formSuccess
        ? '<p class="feedback feedback-success">' + escapeHtml(vehicleState.formSuccess) + '</p>'
        : '',
      '<form id="vehicle-form" class="stack" novalidate>',
      '<div class="vehicle-form-grid">',
      buildVehicleField('Placa', 'placa', 'text', formData.placa, {
        required: true,
        maxlength: 8,
        placeholder: 'ABC1D23'
      }),
      buildVehicleField('Modelo', 'modelo', 'text', formData.modelo, {
        required: true,
        placeholder: 'Cargo 2429'
      }),
      buildVehicleField('Marca', 'marca', 'text', formData.marca, {
        placeholder: 'Volkswagen'
      }),
      buildVehicleField('Ano', 'ano', 'number', formData.ano, {
        min: 1900,
        max: 2100,
        placeholder: '2024'
      }),
      buildVehicleField('Cor', 'cor', 'text', formData.cor, {
        placeholder: 'Branco'
      }),
      buildVehicleField('Km Atual', 'km_atual', 'number', formData.km_atual, {
        min: 0,
        step: '1',
        placeholder: '152340'
      }),
      buildVehicleStatusField(formData.status),
      '</div>',
      '<p class="field-help">Placa e modelo sao obrigatorios. O restante pode ser ajustado conforme a frota evoluir.</p>',
      '<div class="vehicle-form-actions">',
      '<button type="submit" class="button button-primary" ', getDisabledAttr(vehicleState.submitting), '>',
      vehicleState.submitting ? 'Salvando...' : (isEditing ? 'Salvar alteracoes' : 'Cadastrar veiculo'),
      '</button>',
      '<button id="vehicle-form-cancel" type="button" class="button button-secondary" ', getDisabledAttr(vehicleState.submitting), '>',
      isEditing ? 'Cancelar edicao' : 'Limpar formulario',
      '</button>',
      '</div>',
      '</form>',
      '</section>'
    ].join('');
  }

  function buildVehicleField(label, name, type, value, options) {
    var attrs = [];
    var config = options || {};

    if (config.required) {
      attrs.push('required');
    }
    if (config.maxlength) {
      attrs.push('maxlength="' + escapeHtml(config.maxlength) + '"');
    }
    if (config.placeholder) {
      attrs.push('placeholder="' + escapeHtml(config.placeholder) + '"');
    }
    if (config.min !== undefined) {
      attrs.push('min="' + escapeHtml(config.min) + '"');
    }
    if (config.max !== undefined) {
      attrs.push('max="' + escapeHtml(config.max) + '"');
    }
    if (config.step !== undefined) {
      attrs.push('step="' + escapeHtml(config.step) + '"');
    }

    return [
      '<label class="field">',
      '<span>', escapeHtml(label), '</span>',
      '<input type="', escapeHtml(type), '" name="', escapeHtml(name), '" value="', escapeHtml(formatFormValue(value)), '" ', attrs.join(' '), '>',
      '</label>'
    ].join('');
  }

  function buildVehicleStatusField(value) {
    return [
      '<label class="field">',
      '<span>Status</span>',
      '<select name="status">',
      '<option value="ATIVO"', value === 'ATIVO' ? ' selected' : '', '>ATIVO</option>',
      '<option value="INATIVO"', value === 'INATIVO' ? ' selected' : '', '>INATIVO</option>',
      '</select>',
      '</label>'
    ].join('');
  }

  function buildVehicleListMarkup(vehicleState) {
    return [
      '<section class="panel table-panel">',
      '<div class="module-header-row">',
      '<div>',
      '<p class="eyebrow">Lista atual</p>',
      '<h2 class="section-title">Veiculos cadastrados</h2>',
      '</div>',
      '<span class="status-chip">', vehicleState.loading ? 'Atualizando...' : String(vehicleState.items.length) + ' registro(s)', '</span>',
      '</div>',
      buildVehicleListContent(vehicleState),
      '</section>'
    ].join('');
  }

  function buildVehicleListContent(vehicleState) {
    if (vehicleState.loading) {
      return [
        '<div class="table-state">',
        '<p class="muted">Carregando veiculos...</p>',
        '</div>'
      ].join('');
    }

    if (vehicleState.loadError) {
      return [
        '<div class="inline-error-state">',
        '<p class="eyebrow">Estado de erro</p>',
        '<h2>Falha ao consultar veiculos</h2>',
        '<p>', escapeHtml(vehicleState.loadError), '</p>',
        '<button id="vehicle-retry-button" type="button" class="button button-secondary">Tentar novamente</button>',
        '</div>'
      ].join('');
    }

    if (!vehicleState.items.length) {
      return [
        '<div class="empty-state">',
        '<p class="eyebrow">Estado vazio</p>',
        '<h2>Nenhum veiculo cadastrado</h2>',
        '<p>Cadastre o primeiro veiculo usando o formulario ao lado para preencher a frota inicial.</p>',
        '</div>'
      ].join('');
    }

    return [
      '<div class="table-wrapper">',
      '<table class="data-table">',
      '<thead>',
      '<tr>',
      '<th>Placa</th>',
      '<th>Modelo</th>',
      '<th>Marca</th>',
      '<th>Ano</th>',
      '<th>Cor</th>',
      '<th>Km Atual</th>',
      '<th>Status</th>',
      '<th>Acoes</th>',
      '</tr>',
      '</thead>',
      '<tbody>',
      vehicleState.items.map(function (vehicle) {
        return renderVehicleRow(vehicle, vehicleState.submitting);
      }).join(''),
      '</tbody>',
      '</table>',
      '</div>'
    ].join('');
  }

  function renderVehicleRow(vehicle, disabled) {
    return [
      '<tr>',
      '<td><strong>', escapeHtml(vehicle.placa || '-'), '</strong></td>',
      '<td>', escapeHtml(vehicle.modelo || '-'), '</td>',
      '<td>', escapeHtml(vehicle.marca || '-'), '</td>',
      '<td>', escapeHtml(formatYear(vehicle.ano)), '</td>',
      '<td>', escapeHtml(vehicle.cor || '-'), '</td>',
      '<td>', escapeHtml(formatKm(vehicle.km_atual)), '</td>',
      '<td><span class="table-status ', getStatusClass(vehicle.status), '">',
      escapeHtml(vehicle.status || 'SEM STATUS'),
      '</span></td>',
      '<td>',
      '<div class="table-actions">',
      '<button type="button" class="button button-secondary button-small" data-vehicle-edit-id="', escapeHtml(vehicle.id), '" ', getDisabledAttr(disabled), '>Editar</button>',
      '<button type="button" class="button button-danger button-small" data-vehicle-delete-id="', escapeHtml(vehicle.id), '" ', getDisabledAttr(disabled), '>Excluir</button>',
      '</div>',
      '</td>',
      '</tr>'
    ].join('');
  }

  async function handleVehicleSubmit(event) {
    event.preventDefault();

    var vehicleState = state.vehicleModule;
    var payload = readVehicleFormData(event.currentTarget);

    vehicleState.formData = payload;
    vehicleState.formError = '';
    vehicleState.formSuccess = '';

    if (!payload.placa || !payload.modelo) {
      vehicleState.formError = 'Placa e modelo sao obrigatorios.';
      renderVehiclesView();
      return;
    }

    vehicleState.submitting = true;
    renderVehiclesView();

    try {
      if (vehicleState.formMode === 'edit' && vehicleState.editingId !== null) {
        await window.GestorApi.updateVehicle(vehicleState.editingId, payload);
        vehicleState.formSuccess = 'Veiculo atualizado com sucesso.';
      } else {
        await window.GestorApi.createVehicle(payload);
        vehicleState.formSuccess = 'Veiculo cadastrado com sucesso.';
      }

      vehicleState.submitting = false;
      vehicleState.formMode = 'create';
      vehicleState.editingId = null;
      vehicleState.formData = getDefaultVehicleFormData();
      await refreshVehiclesList(state.renderId);
      renderVehiclesView();
    } catch (error) {
      if (error.status === 401) {
        handleLogout();
        return;
      }

      vehicleState.submitting = false;
      vehicleState.formError = error.message || 'Nao foi possivel salvar o veiculo.';
      renderVehiclesView();
    }
  }

  function handleVehicleFormCancel() {
    var vehicleState = state.vehicleModule;
    vehicleState.formMode = 'create';
    vehicleState.editingId = null;
    vehicleState.formData = getDefaultVehicleFormData();
    vehicleState.formError = '';
    vehicleState.formSuccess = '';
    vehicleState.submitting = false;
    renderVehiclesView();
  }

  function handleVehicleEdit(event) {
    var vehicleId = Number(event.currentTarget.getAttribute('data-vehicle-edit-id'));
    var vehicle = findVehicleById(vehicleId);

    if (!vehicle) {
      return;
    }

    state.vehicleModule.formMode = 'edit';
    state.vehicleModule.editingId = vehicle.id;
    state.vehicleModule.formData = {
      placa: vehicle.placa || '',
      modelo: vehicle.modelo || '',
      marca: vehicle.marca || '',
      ano: formatFormValue(vehicle.ano),
      cor: vehicle.cor || '',
      km_atual: formatFormValue(vehicle.km_atual),
      status: vehicle.status || 'ATIVO'
    };
    state.vehicleModule.formError = '';
    state.vehicleModule.formSuccess = '';
    renderVehiclesView();
  }

  async function handleVehicleDelete(event) {
    var vehicleId = Number(event.currentTarget.getAttribute('data-vehicle-delete-id'));
    var vehicle = findVehicleById(vehicleId);

    if (!vehicle) {
      return;
    }

    if (!window.confirm('Excluir o veiculo ' + vehicle.placa + '?')) {
      return;
    }

    state.vehicleModule.submitting = true;
    state.vehicleModule.formError = '';
    state.vehicleModule.formSuccess = '';
    renderVehiclesView();

    try {
      await window.GestorApi.deleteVehicle(vehicleId);

      if (state.vehicleModule.editingId === vehicleId) {
        state.vehicleModule.formMode = 'create';
        state.vehicleModule.editingId = null;
        state.vehicleModule.formData = getDefaultVehicleFormData();
      }

      state.vehicleModule.submitting = false;
      state.vehicleModule.formSuccess = 'Veiculo removido com sucesso.';
      await refreshVehiclesList(state.renderId);
      renderVehiclesView();
    } catch (error) {
      if (error.status === 401) {
        handleLogout();
        return;
      }

      state.vehicleModule.submitting = false;
      state.vehicleModule.formError = error.message || 'Nao foi possivel remover o veiculo.';
      renderVehiclesView();
    }
  }

  function handleVehicleRetry() {
    resetVehicleModuleFeedback();
    refreshVehiclesList(state.renderId).catch(function (error) {
      if (error.status === 401) {
        handleLogout();
      }
    });
  }

  function readVehicleFormData(form) {
    var formData = new window.FormData(form);
    var ano = formData.get('ano');
    var kmAtual = formData.get('km_atual');

    return {
      placa: String(formData.get('placa') || '').trim().toUpperCase(),
      modelo: String(formData.get('modelo') || '').trim(),
      marca: normalizeOptionalText(formData.get('marca')),
      ano: ano === '' ? null : Number(ano),
      cor: normalizeOptionalText(formData.get('cor')),
      km_atual: kmAtual === '' ? 0 : Number(kmAtual),
      status: String(formData.get('status') || 'ATIVO').trim()
    };
  }

  function normalizeOptionalText(value) {
    var text = String(value || '').trim();
    return text ? text : null;
  }

  function findVehicleById(vehicleId) {
    for (var i = 0; i < state.vehicleModule.items.length; i += 1) {
      if (Number(state.vehicleModule.items[i].id) === vehicleId) {
        return state.vehicleModule.items[i];
      }
    }

    return null;
  }

  function isVehiclesRouteActive() {
    return window.location.hash === '#/vehicles';
  }

  function getDisabledAttr(disabled) {
    return disabled ? 'disabled' : '';
  }

  function formatFormValue(value) {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value);
  }

  function formatKm(value) {
    if (value === null || value === undefined || value === '') {
      return '-';
    }

    var number = Number(value);

    if (Number.isNaN(number)) {
      return String(value);
    }

    return new Intl.NumberFormat('pt-BR', {
      maximumFractionDigits: 0
    }).format(number) + ' km';
  }

  function formatYear(value) {
    if (value === null || value === undefined || value === '') {
      return '-';
    }

    return String(value);
  }

  function getStatusClass(status) {
    return status === 'ATIVO' ? 'is-active' : 'is-inactive';
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}());
