(function () {
  var STORAGE_KEY = 'gestor_frontend_session';

  function readSession() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function writeSession(session) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  function clearSession() {
    window.localStorage.removeItem(STORAGE_KEY);
  }

  function getToken() {
    var session = readSession();
    return session && session.token ? session.token : '';
  }

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  async function request(path, options) {
    var config = options || {};
    var headers = Object.assign({}, config.headers || {});
    var token = hasOwn(config, 'token') ? config.token : getToken();
    var body = config.body;

    if (body && !(body instanceof window.FormData) && typeof body !== 'string') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }

    if (token) {
      headers.Authorization = 'Bearer ' + token;
    }

    var response = await window.fetch(path, {
      method: config.method || 'GET',
      headers: headers,
      body: body
    });

    var contentType = response.headers.get('content-type') || '';
    var payload = contentType.indexOf('application/json') >= 0
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      var message = payload && payload.error ? payload.error : 'Falha na requisicao.';
      var error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  async function login(credentials) {
    var session = await request('/api/auth/login', {
      method: 'POST',
      body: credentials,
      token: null
    });

    writeSession(session);
    return session;
  }

  async function getMe() {
    var user = await request('/api/auth/me');
    var current = readSession();

    if (current && current.token) {
      writeSession({
        token: current.token,
        user: user
      });
    }

    return user;
  }

  function listVehicles() {
    return request('/api/vehicles');
  }

  function createVehicle(payload) {
    return request('/api/vehicles', {
      method: 'POST',
      body: payload
    });
  }

  function updateVehicle(id, payload) {
    return request('/api/vehicles/' + encodeURIComponent(id), {
      method: 'PUT',
      body: payload
    });
  }

  function deleteVehicle(id) {
    return request('/api/vehicles/' + encodeURIComponent(id), {
      method: 'DELETE'
    });
  }

  function listDrivers() {
    return request('/api/drivers');
  }

  function listChecklists() {
    return request('/api/checklists');
  }

  function listOccurrences() {
    return request('/api/occurrences');
  }

  window.GestorApi = {
    clearSession: clearSession,
    createVehicle: createVehicle,
    deleteVehicle: deleteVehicle,
    getMe: getMe,
    getToken: getToken,
    listChecklists: listChecklists,
    listDrivers: listDrivers,
    listOccurrences: listOccurrences,
    listVehicles: listVehicles,
    login: login,
    readSession: readSession,
    request: request,
    updateVehicle: updateVehicle,
    writeSession: writeSession
  };
}());
