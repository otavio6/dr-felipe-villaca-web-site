/* Shared location UI; each campaign keeps its own form serializer and endpoint. */
(function () {
  'use strict';

  var cityCache = { BR: Object.create(null), US: Object.create(null) };
  var normalize = function (value) {
    return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
  };
  function requestJson(url) {
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer;
    var timeout = new Promise(function (_, reject) {
      timer = window.setTimeout(function () {
        if (controller) controller.abort();
        reject(new Error('Tempo de consulta esgotado'));
      }, 8000);
    });
    var request = Promise.resolve().then(function () {
      return fetch(url, controller ? { signal: controller.signal } : {});
    }).then(function (response) {
      if (!response.ok) throw new Error('Dados indisponíveis');
      return response.json();
    });
    return Promise.race([request, timeout]).finally(function () { window.clearTimeout(timer); });
  }
  var adapters = {
    BR: {
      countryName: 'Brasil',
      source: 'ibge',
      refreshStates: function (stateElement) {
        requestJson('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome').then(function (items) {
            if (!Array.isArray(items) || items.length !== 27) return;
            items.forEach(function (item) {
              if (!Number.isInteger(item.id) || typeof item.sigla !== 'string' || typeof item.nome !== 'string') return;
              var option = Array.from(stateElement.options).find(function (candidate) { return candidate.value === item.sigla; });
              if (option) { option.textContent = item.nome; option.dataset.id = String(item.id); }
            });
          }).catch(function () { /* A lista local continua selecionável. */ });
      },
      loadCities: function (state) {
        if (cityCache.BR[state.code]) return Promise.resolve(cityCache.BR[state.code]);
        return requestJson('https://servicodados.ibge.gov.br/api/v1/localidades/estados/' + encodeURIComponent(state.code) + '/municipios').then(function (items) {
            if (!Array.isArray(items) || !items.length) throw new Error('Lista de municípios vazia');
            var cities = items.filter(function (item) { return Number.isInteger(item.id) && typeof item.nome === 'string'; })
              .map(function (item) { return { id: String(item.id), name: item.nome }; });
            if (!cities.length) throw new Error('Lista de municípios inválida');
            cityCache.BR[state.code] = cities;
            return cities;
          });
      }
    },
    US: { countryName: 'United States', source: 'manual', loadCities: null }
  };

  function initLocationSelector(config) {
    var adapter = adapters[config.country];
    var form = document.querySelector(config.form);
    var state = document.querySelector(config.state);
    var city = document.querySelector(config.city);
    var field = city.closest('.location-field');
    var wrap = city.closest('.location-input-wrap');
    var message = field.querySelector('.location-message');
    var manualButton = field.querySelector('.location-manual');
    var list = document.createElement('div');
    var listId = city.id + '-list';
    var cities = [];
    var matches = [];
    var active = -1;
    var renderedCount = 0;
    var selected = null;
    var manual = !adapter.loadCities;
    var loading = false;
    var requestNumber = 0;
    var suppressOpen = false;

    list.id = listId;
    list.className = 'location-list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Cidades');
    wrap.appendChild(list);

    function selectedState() {
      var option = state.selectedOptions[0];
      return state.value ? { code: state.value, name: option.textContent, id: option.dataset.id || null } : null;
    }
    function setMessage(text, error) {
      message.textContent = text || '';
      message.classList.toggle('is-error', !!error);
      city.setAttribute('aria-invalid', error ? 'true' : 'false');
    }
    function close() {
      field.classList.remove('is-open', 'is-up');
      city.setAttribute('aria-expanded', 'false');
      city.removeAttribute('aria-activedescendant');
      active = -1;
    }
    function setManual(note) {
      manual = true;
      loading = false;
      cities = [];
      selected = null;
      close();
      field.classList.remove('is-loading');
      field.classList.add('is-manual');
      city.removeAttribute('role');
      city.removeAttribute('aria-expanded');
      city.removeAttribute('aria-controls');
      city.removeAttribute('aria-autocomplete');
      city.removeAttribute('aria-activedescendant');
      city.placeholder = 'Digite sua cidade';
      city.disabled = !state.value;
      city.setCustomValidity('');
      manualButton.hidden = true;
      setMessage(note || '', false);
    }
    function setStructured(data) {
      manual = false;
      loading = false;
      cities = data;
      field.classList.remove('is-loading', 'is-manual', 'is-disabled');
      city.disabled = false;
      city.placeholder = 'Pesquise sua cidade...';
      city.setAttribute('role', 'combobox');
      city.setAttribute('aria-autocomplete', 'list');
      city.setAttribute('aria-controls', listId);
      city.setAttribute('aria-expanded', 'false');
      manualButton.hidden = false;
      setMessage('', false);
    }
    function render() {
      list.replaceChildren();
      var query = normalize(city.value);
      matches = cities.filter(function (item) { return normalize(item.name).includes(query); });
      renderedCount = 0;
      if (!matches.length) {
        var empty = document.createElement('p');
        empty.className = 'location-empty';
        empty.textContent = 'Nenhuma cidade encontrada.';
        list.appendChild(empty);
        active = -1;
        city.removeAttribute('aria-activedescendant');
        return;
      }
      appendMatches();
      active = -1;
      city.removeAttribute('aria-activedescendant');
    }
    function appendMatches(throughIndex) {
      var end = Math.min(matches.length, Math.max(renderedCount + 40, typeof throughIndex === 'number' ? throughIndex + 1 : 0));
      for (let index = renderedCount; index < end; index += 1) {
        let item = matches[index];
        var option = document.createElement('div');
        option.className = 'location-option';
        option.id = listId + '-option-' + index;
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', selected === item ? 'true' : 'false');
        option.textContent = item.name;
        option.addEventListener('pointerdown', function (event) { if (event.pointerType === 'mouse') event.preventDefault(); });
        option.addEventListener('click', function () { choose(item); });
        list.appendChild(option);
      }
      renderedCount = end;
    }
    list.addEventListener('scroll', function () {
      if (list.scrollTop + list.clientHeight >= list.scrollHeight - 80 && renderedCount < matches.length) appendMatches();
    });
    function open() {
      if (manual || loading || city.disabled || suppressOpen) return;
      render();
      var rectangle = city.getBoundingClientRect();
      var visibleBottom = window.visualViewport ? window.visualViewport.offsetTop + window.visualViewport.height : window.innerHeight;
      field.classList.toggle('is-up', visibleBottom - rectangle.bottom < 250 && rectangle.top > visibleBottom - rectangle.bottom);
      field.classList.add('is-open');
      city.setAttribute('aria-expanded', 'true');
    }
    function activate(index) {
      if (!matches.length) return;
      active = (index + matches.length) % matches.length;
      if (active >= renderedCount) appendMatches(active);
      Array.from(list.querySelectorAll('.location-option')).forEach(function (option, i) {
        option.classList.toggle('is-active', i === active);
      });
      var option = list.querySelectorAll('.location-option')[active];
      city.setAttribute('aria-activedescendant', option.id);
      option.scrollIntoView({ block: 'nearest' });
    }
    function choose(item) {
      selected = item;
      city.value = item.name;
      city.setCustomValidity('');
      setMessage('', false);
      suppressOpen = true;
      city.focus();
      close();
      window.setTimeout(function () { suppressOpen = false; }, 250);
    }
    function resetCity() {
      selected = null;
      city.value = '';
      city.setCustomValidity('');
      setMessage('', false);
      close();
    }
    function changeState() {
      var currentRequest = ++requestNumber;
      suppressOpen = false;
      resetCity();
      state.removeAttribute('aria-invalid');
      field.classList.toggle('is-disabled', !state.value);
      if (!state.value) {
        city.disabled = true;
        city.placeholder = 'Escolha primeiro um estado';
        manualButton.hidden = true;
        return;
      }
      if (!adapter.loadCities) {
        setManual('');
        return;
      }
      loading = true;
      city.disabled = true;
      city.placeholder = 'Carregando cidades...';
      field.classList.add('is-loading');
      manualButton.hidden = false;
      setMessage('', false);
      adapter.loadCities(selectedState()).then(function (data) {
        if (currentRequest !== requestNumber) return;
        setStructured(data);
      }).catch(function () {
        if (currentRequest !== requestNumber) return;
        setManual('Não foi possível carregar as cidades automaticamente. Digite sua cidade.');
      });
    }

    state.addEventListener('change', changeState);
    city.addEventListener('focus', open);
    city.addEventListener('click', open);
    city.addEventListener('input', function () {
      selected = null;
      city.setCustomValidity('');
      setMessage('', false);
      if (!manual) open();
    });
    city.addEventListener('keydown', function (event) {
      if (manual) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!field.classList.contains('is-open')) open();
        activate(active + (event.key === 'ArrowDown' ? 1 : -1));
      } else if (event.key === 'Enter' && field.classList.contains('is-open')) {
        if (active >= 0) { event.preventDefault(); choose(matches[active]); }
      } else if (event.key === 'Escape') {
        close();
      }
    });
    city.addEventListener('blur', function () {
      close();
      if (!manual && city.value.trim() && !selected) {
        city.setCustomValidity('Selecione uma cidade da lista.');
        setMessage('Selecione uma cidade da lista.', true);
      }
    });
    document.addEventListener('pointerdown', function (event) {
      if (!field.contains(event.target)) close();
    });
    manualButton.addEventListener('click', function () {
      ++requestNumber;
      resetCity();
      setManual('Cidade manual ativada.');
      city.focus();
    });
    form.addEventListener('submit', function (event) {
      if (loading) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setMessage('Aguarde o carregamento ou escolha digitar a cidade manualmente.', true);
        return;
      }
      if (manual && !city.value.trim()) {
        city.setCustomValidity('Digite sua cidade.');
        setMessage('Digite sua cidade.', true);
        event.preventDefault();
        event.stopImmediatePropagation();
        city.reportValidity();
        return;
      }
      if (!manual && (!selected || city.value !== selected.name)) {
        city.setCustomValidity('Selecione uma cidade da lista.');
        setMessage('Selecione uma cidade da lista.', true);
        event.preventDefault();
        event.stopImmediatePropagation();
        city.reportValidity();
      }
    }, true);

    if (manual) field.classList.add('is-manual');
    changeState();
    if (adapter.refreshStates) adapter.refreshStates(state);
    return {
      getValue: function () {
        var region = selectedState();
        return {
          countryCode: config.country,
          countryName: adapter.countryName,
          stateCode: region ? region.code : '',
          stateName: region ? region.name : '',
          stateId: region ? region.id : null,
          cityName: selected ? selected.name : city.value.trim(),
          cityId: selected ? selected.id : null,
          source: manual ? 'manual' : adapter.source
        };
      },
      serializeLegacy: function () {
        var value = this.getValue();
        return value.cityName && value.stateCode ? value.cityName + ' - ' + value.stateCode : value.cityName;
      }
    };
  }

  window.FVGLocation = { initLocationSelector: initLocationSelector };
})();
