import Vuex from 'vuex';
import Vue from 'vue';
import { fromState, toModel } from './jsonapi';
import * as a from './action-types';
import * as m from './mutation-types';
import axios from 'axios';

if (process.env.NODE_ENV !== 'testing') {
  var csrfToken = document.querySelector('meta[name="csrf-token"]').content;
  axios.defaults.headers.common = {
    'X-Requested-With': 'XMLHttpRequest',
    'X-CSRF-TOKEN': csrfToken
  };
  axios.interceptors.response.use(
      response => { return response; },
      function (error) {
        console.log(error);
        if (error.response.status === 401) {
          window.location = process.env.LOGIN_URL;
        }
      }
  );
}

Vue.use(Vuex);

var apiPrefix = process.env.MOCK
    ? process.env.MOCK_API_PREFIX
    : process.env.API_PREFIX;

const ACTION_NONE = 'action:none';
const ACTION_PENDING = 'action:pending';
const ACTION_REQUESTED = 'action:requested';

const state = {
  repository: {
    reports: {},
    processors: {},
    profiles: {},
    dataResources: {},
    users: {}
  },
  dataResources: [],
  loggedInUser: null,
  currentUser: null,
  currentProfile: null,
  currentReport: null,
  currentDataResource: null,
  currentProcessor: null,
  pageDataResources: 1,
  pageLengthDataResources: 25,
  sortDataResources: 'filename',
  orderDataResources: 'asc',
  filtersDataResources: {},
  inProgressDataResources: {},
  pagesRequestedDataResources: [],
  pageCountDataResources: {},
  refreshRequestedDataResources: false
};
const actions = {
  [a.STORE_SETTING_PROFILE_ID_FOR_DATA_RESOURCES] ({ commit, state, dispatch }, { profileId, resources }) {
    var dataResourceUrls = resources.map(function (resource) {
      return {'id': resource.id, 'providerId': resource.providerId, 'url': resource.url, 'filetype': resource.filetype};
    });
    var settingMap = {
      dataProfileId: profileId,
      dataResourceUrls: dataResourceUrls
    };

    var url = apiPrefix + '/dataResources/settings';

    return axios.post(url, settingMap).then((response) => {
      commit(m.SET_DATA_RESOURCES_PAGE, 1);
      dispatch(a.LOAD_DATA_RESOURCES, { reset: true, page: 1 });
    }, error => {
      console.log('Couldnt get data resources for account.:' + error);
    });
  },
  [a.UPDATE_DATA_RESOURCES_FILTERS] ({ commit, state, dispatch }, filters) {
    if (filters !== state.filtersDataResources) {
      commit(m.SET_DATA_RESOURCES_FILTERS, filters);
      commit(m.SET_DATA_RESOURCES_PAGE, 1);
      dispatch(a.LOAD_DATA_RESOURCES, { reset: true, page: 1 });
    }
  },
  [a.UPDATE_DATA_RESOURCES_PAGE] ({ state, commit, dispatch }, page) {
    if (page !== state.pageDataResources) {
      commit(m.SET_DATA_RESOURCES_PAGE, page);
      dispatch(a.LOAD_DATA_RESOURCES, { reset: false, page: page });
    }
  },
  [a.UPDATE_DATA_RESOURCES_ORDER] ({ state, commit, dispatch }, order) {
    if (order !== state.orderDataResources) {
      commit(m.SET_DATA_RESOURCES_PAGE, 1);
      commit(m.SET_DATA_RESOURCES_ORDER, order);
      dispatch(a.LOAD_DATA_RESOURCES, { reset: true, page: 1 });
    }
  },
  [a.UPDATE_DATA_RESOURCES_SORT] ({ state, commit, dispatch }, sort) {
    if (sort !== state.sortDataResources) {
      commit(m.SET_DATA_RESOURCES_PAGE, 1);
      commit(m.SET_DATA_RESOURCES_SORT, sort);
      dispatch(a.LOAD_DATA_RESOURCES, { reset: true, page: 1 });
    }
  },
  [a.LOAD_DATA_RESOURCES] ({ commit, state, dispatch }, { reset, page, skipInterpolation, ignoreProgress }) {
    if (!skipInterpolation) {
      for (var provider in state.inProgressDataResources) {
        var stat = state.inProgressDataResources;
        if (stat === ACTION_PENDING) {
          commit(m.SET_DATA_RESOURCE_PROVIDER_IN_PROGRESS, [provider, ACTION_REQUESTED]);
        } else if (stat === ACTION_REQUESTED) {
          /* Wait until this completes */
          return;
        }
      }
    }

    var filtersDataResources = Object.keys(state.filtersDataResources)
        .filter((key) => { console.debug('filtersDataResources:', state.filtersDataResources[key]); return state.filtersDataResources[key]; })
        .map((key) => { return key + ':' + state.filtersDataResources[key]; })
        .join(',');

    var query = 'page=' + page +
        '&count=' + state.pageLengthDataResources +
        '&filters=' + filtersDataResources +
        '&sortBy=' + state.sortDataResources +
        '&order=' + state.orderDataResources;

    var providers = ['_local', '_remote'];
    if (state.filtersDataResources && state.filtersDataResources.source) {
      providers = [state.filtersDataResources.source];
    }

    var search = state.filtersDataResources.search;
    if (search) {
      query += '&search=' + search;
    }

    if (reset) {
      commit(m.SET_DATA_RESOURCES_REFRESH_REQUESTED);
    }

    commit(m.ADD_DATA_RESOURCE_PAGE_REQUEST, page);
    if (!skipInterpolation) {
      for (var i = 1; i < page; i++) {
        if (state.pagesRequestedDataResources.indexOf(i) === -1) {
          dispatch(a.LOAD_DATA_RESOURCES, { reset: false, page: i, skipInterpolation: true });
        }
      }
    }
    providers.forEach(function (provider) {
      if (!skipInterpolation && state.inProgressDataResources[provider] === ACTION_PENDING) {
        commit(m.SET_DATA_RESOURCE_PROVIDER_IN_PROGRESS, [provider, ACTION_REQUESTED]);
      } else if (!skipInterpolation && state.inProgressDataResources[provider] === ACTION_REQUESTED) {
        /* Already pending and requested */
      } else {
        if (!skipInterpolation) {
          commit(m.SET_DATA_RESOURCE_PROVIDER_IN_PROGRESS, [provider, ACTION_PENDING]);
        }
        axios.get(apiPrefix + '/dataResources' + '?provider=' + provider + '&' + query).then((response) => {
          var resources = response.data;
          /* While this approach works for stepping through,
           * further investigation may be required around jumping cold into page N>1 */
          if (state.refreshRequestedDataResources) {
            commit(m.RESET_DATA_RESOURCES);
          }
          commit(m.APPEND_DATA_RESOURCES, resources);

          if (!skipInterpolation) {
            var actionRequested = (state.inProgressDataResources === ACTION_REQUESTED);
            commit(m.SET_DATA_RESOURCE_PROVIDER_IN_PROGRESS, [provider, ACTION_NONE]);
            commit(m.SET_DATA_RESOURCE_PROVIDER_PAGE_COUNT, [provider, resources.meta.pagination.total_pages]);
            if (actionRequested) {
              dispatch(a.LOAD_DATA_RESOURCES, { reset: true, page: 1 });
            }
          }
        }).catch((error) => {
          console.log('Couldnt get data resources for account.:' + error);
          if (!skipInterpolation) {
            commit(m.SET_DATA_RESOURCE_PROVIDER_IN_PROGRESS, [provider, ACTION_NONE]);
          }
        });
      }
    });
  },
  [a.SAVE_DATA_RESOURCE] ({ commit }, resource) {
    var url = apiPrefix + '/dataResources/' + resource.id;
    var jsonDataResource = toModel('dataResources', resource);

    return axios.put(url, jsonDataResource).then((response) => {
      var resource = response.data;
      commit(m.SET_CURRENT_DATA_RESOURCE, resource);
    }).catch(function (error) {
      console.log('Error saving data resource:' + error);
    });
  },
  [a.DELETE_DATA_RESOURCE] ({ commit }, resource) {
    var url = apiPrefix + '/dataResources/' + resource.id;
    return axios.delete(url).then((response) => {
      var resource = response.data;
      commit(m.UNSET_CURRENT_DATA_RESOURCE, resource);
    }).catch(function (error) {
      console.log('Error deleting data resource:' + error);
    });
  },
  [a.LOAD_PROFILES] ({ commit }) {
    axios.get(apiPrefix + '/profiles/').then((response) => {
      var profiles = response.data;
      commit(m.SET_PROFILES, profiles);
    }, error => {
      console.log('Couldnt get data profiles for account.:' + error);
    });
  },
  [a.LOAD_PROFILE] ({ commit }, profileId) {
    return axios.get(apiPrefix + '/profiles/' + profileId + '?include=configurations.processor').then((response) => {
      var profile = response.data;
      commit(m.SET_CURRENT_PROFILE, profile);
    }, error => {
      console.log('Couldnt get data profiles for account.:' + error);
    });
  },
  [a.SAVE_PROFILE] ({ commit }, { profile, configurations }) {
    var url = apiPrefix + '/profiles/' + profile.id;

    var jsonProfile = toModel('profiles', profile, {
      configurations: { type: 'processorConfigurations', relations: configurations }
    });

    return axios.put(url, jsonProfile).then((response) => {
      var profile = response.data;
      commit(m.SET_CURRENT_PROFILE, profile);
    }).catch(function (error) {
      console.log('Error adding profile:' + error);
    });
  },
  [a.STORE_PROFILE] ({ commit }, { profile, configurations }) {
    var jsonProfile = toModel('profiles', profile, {
      configurations: { type: 'processorConfigurations', relations: configurations }
    });

    var url = apiPrefix + '/profiles';

    return axios.post(url, jsonProfile).then((response) => {
      var profile = response.data;
      commit(m.SET_CURRENT_PROFILE, profile);
    }).catch(function (error) {
      console.log('Error adding profile:' + error);
    });
  },
  [a.LOAD_USERS] ({ commit }) {
    axios.get(apiPrefix + '/users/').then((response) => {
      var users = response.data;
      commit(m.SET_USERS, users);
    }, error => {
      console.log('Couldnt get users.:' + error);
    });
  },
  [a.LOAD_USER] ({ commit }, userId) {
    return axios.get(apiPrefix + '/users/' + userId).then((response) => {
      var user = response.data;
      commit(m.SET_CURRENT_USER, user);
    }, error => {
      console.log('Couldnt get user.:' + error);
    });
  },

  [a.LOAD_REPORTS] ({ commit }) {
    axios.get(apiPrefix + '/reports/').then((response) => {
      var reports = response.data;
      commit(m.SET_REPORTS, reports);
    }, error => {
      console.log('Couldnt get reports.:' + error);
    });
  },
  [a.LOAD_REPORT] ({ commit }, reportId) {
    return axios.get(apiPrefix + '/reports/' + reportId + '?include=dataResource,profile').then((response) => {
      var report = response.data;
      commit(m.SET_CURRENT_REPORT, report);
    }, error => {
      console.log('Couldnt get report.:' + error);
    });
  },

  [a.LOAD_PROCESSORS] ({ commit }) {
    var url = apiPrefix + '/processors/';

    axios(url).then((response) => {
      var processors = response.data;
      commit(m.SET_PROCESSORS, processors);
    }).catch(function (error) {
      console.log('Error get processors:' + error);
    });
  },
  [a.STORE_PROCESSOR] ({ commit }, processor) {
    var url = apiPrefix + '/processors';

    axios.post(url, processor).then((response) => {
      console.log('Added processor');
    }).catch(function (error) {
      console.log('Error adding processor:' + error);
    });
  },

  [a.STORE_DATA_RESOURCE] ({ commit }, dataResource) {
    var url = apiPrefix + '/dataResources';

    return axios.post(url, dataResource).then((response) => {
      console.log('Added data resource');
    }).catch(function (error) {
      console.log('Error adding data resource:' + error);
    });
  },

  [a.LOAD_LOGGED_IN_USER] ({ commit, state }) {
    if (!state.loggedInUser) {
      return axios.get(apiPrefix + '/users/me').then((response) => {
        var user = response.data;
        commit(m.SET_LOGGED_IN_USER, user);
      }, error => {
        console.log('Couldnt get logged in user:' + error);
      });
    }
  }
};
const getters = {
  users: state => {
    return fromState(state).findAll('users');
  },
  reports: state => {
    return fromState(state).findAll('reports');
  },
  processors: state => {
    return fromState(state).findAll('processors');
  },
  profiles: state => {
    return fromState(state).findAll('profiles');
  },
  dataResourcePageCount: state => {
    var pages = 0;
    Object.values(state.pageCountDataResources).forEach(function (count) {
      pages += count;
    });
    return pages;
  },
  dataResources: state => {
    /* Newer approach: compatible with dataResources reactivity rules.
     * However, related objects may have issues when using this style. */
    console.debug('dataResources');
    var column = state.sortDataResources;
    var direction = (state.orderDataResources === 'asc' ? 1 : -1);
    var resources = state.dataResources.sort(function (a, b) {
      if (a[column] < b[column]) {
        return direction * -1;
      }
      if (a[column] > b[column]) {
        return direction;
      }
      return 0;
    });
    var to = state.pageDataResources * state.pageLengthDataResources;
    var from = to - state.pageLengthDataResources;

    return resources.slice(from, to);
  }
};
const mutations = {
  [m.SET_PROFILES] (state, profiles) {
    state.repository.profiles = {};
    fromState(state).sync(profiles);
  },
  [m.RESET_PROFILES] (state) {
    state.repository.profiles = {};
  },
  [m.SET_CURRENT_PROFILE] (state, profile) {
    var store = fromState(state);
    store.sync(profile);
    state.currentProfile = store.find('profiles', profile.data.id);
  },
  [m.UNSET_CURRENT_PROFILE] (state) {
    state.currentProfile = null;
  },

  [m.SET_REPORTS] (state, reports) {
    state.repository.reports = {};
    fromState(state).sync(reports);
  },
  [m.RESET_REPORTS] (state) {
    state.repository.reports = {};
  },
  [m.SET_CURRENT_REPORT] (state, report) {
    var store = fromState(state);
    store.sync(report);
    state.currentReport = store.find('reports', report.data.id);
  },
  [m.UNSET_CURRENT_REPORT] (state) {
    state.currentReport = null;
  },

  [m.SET_PROCESSORS] (state, processors) {
    state.repository.processors = {};
    fromState(state).sync(processors);
  },
  [m.RESET_PROCESSORS] (state) {
    state.repository.processors = {};
  },
  [m.SET_CURRENT_PROCESSOR] (state, processor) {
    var store = fromState(state);
    store.sync(processor);
    state.currentProcessor = store.find('processors', processor.data.id);
  },
  [m.UNSET_CURRENT_PROCESSOR] (state) {
    state.currentProcessor = null;
  },

  [m.SET_USERS] (state, users) {
    state.repository.users = {};
    fromState(state).sync(users);
  },
  [m.RESET_USERS] (state) {
    state.repository.users = {};
  },
  [m.SET_CURRENT_USER] (state, user) {
    var store = fromState(state);
    store.sync(user);
    state.currentUser = store.find('users', user.data.id);
  },
  [m.UNSET_CURRENT_USER] (state) {
    state.currentUser = null;
  },

  [m.SET_DATA_RESOURCES_FILTERS] (state, filters) {
    state.filtersDataResources = filters;
  },
  [m.SET_DATA_RESOURCES_PAGE] (state, page) {
    state.pageDataResources = page;
  },
  [m.SET_DATA_RESOURCES_SORT] (state, sort) {
    state.sortDataResources = sort;
  },
  [m.SET_DATA_RESOURCES_ORDER] (state, order) {
    state.orderDataResources = order;
  },
  [m.APPEND_DATA_RESOURCES] (state, dataResources) {
    var store = fromState(state);
    store.sync(dataResources);
    state.dataResources = store.findAll('dataResources');
  },
  [m.RESET_DATA_RESOURCES] (state) {
    state.repository.dataResources = {};
    state.refreshRequestedDataResources = false;
    state.dataResources = [];
  },
  [m.SET_CURRENT_DATA_RESOURCE] (state, dataResource) {
    var store = fromState(state);
    state.currentDataResource = store.find('dataResources', dataResource.data.id);
  },
  [m.UNSET_CURRENT_DATA_RESOURCE] (state) {
    state.currentDataResource = null;
  },

  [m.SET_LOGGED_IN_USER] (state, user) {
    var store = fromState(state);
    store.sync(user);
    state.loggedInUser = store.find('users', user.data.id);
  },
  [m.UNSET_LOGGED_IN_USER] (state) {
    state.loggedInUser = null;
  },

  [m.SET_DATA_RESOURCE_PROVIDER_IN_PROGRESS] (state, setting) {
    state.inProgressDataResources[setting[0]] = setting[1];
  },

  [m.SET_DATA_RESOURCE_PROVIDER_PAGE_COUNT] (state, setting) {
    Vue.set(state.pageCountDataResources, setting[0], setting[1]);
  },

  [m.ADD_DATA_RESOURCE_PAGE_REQUEST] (state, pageNumber) {
    state.pagesRequestedDataResources.push(pageNumber);
  },

  [m.SET_DATA_RESOURCES_REFRESH_REQUESTED] (state) {
    state.refreshRequestedDataResources = true;
  }
};

const store = new Vuex.Store({
  state,
  actions,
  getters,
  mutations
});

export default store;
export {store, actions};
