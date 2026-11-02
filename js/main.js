/* Direito Delas
   Script clássico (sem módulos), para a página abrir também com duplo clique.
   Nada aqui guarda dados: sem cookies, sem localStorage, sem pedidos a terceiros.
   O GSAP é local (js/vendor) e só é carregado quando a linha do tempo está perto da tela. */
(function () {
  'use strict';

  var doc = document;
  var reduceMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Sair rápido ---------- */
  // replace() troca a página atual no histórico, então "voltar" não retorna para cá.
  var EXIT_URL = 'https://www.google.com/';

  function quickExit() {
    window.location.replace(EXIT_URL);
  }

  Array.prototype.forEach.call(doc.querySelectorAll('[data-exit]'), function (el) {
    el.addEventListener('click', function (event) {
      event.preventDefault();
      quickExit();
    });
  });

  // Atalho de teclado: Shift três vezes seguidas. Não conflita com leitores de tela.
  var shiftPresses = 0;
  var shiftTimer = null;

  doc.addEventListener('keyup', function (event) {
    if (event.key !== 'Shift') {
      shiftPresses = 0;
      return;
    }
    shiftPresses += 1;
    clearTimeout(shiftTimer);
    if (shiftPresses >= 3) {
      quickExit();
      return;
    }
    shiftTimer = setTimeout(function () {
      shiftPresses = 0;
    }, 1500);
  });

  /* ---------- Menu no celular ---------- */
  var toggle = doc.querySelector('.menu-toggle');
  var nav = doc.getElementById('menu');

  function setMenu(open) {
    if (!toggle || !nav) return;
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });
    doc.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        toggle.focus();
      }
    });
  }

  /* ---------- Tema claro ou escuro ---------- */
  // Sem escolha, o site segue o tema do sistema. O botão força o oposto só nesta
  // visita: nada é guardado no aparelho (regra de segurança do site).
  var root = doc.documentElement;
  var themeBtn = doc.querySelector('[data-theme-toggle]');
  var systemDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var themeMetas = doc.querySelectorAll('meta[name="theme-color"]');

  function isDark() {
    var chosen = root.getAttribute('data-theme');
    if (chosen) return chosen === 'dark';
    return !!(systemDark && systemDark.matches);
  }

  function syncTheme() {
    var dark = isDark();
    if (themeBtn) themeBtn.setAttribute('aria-checked', dark ? 'true' : 'false');
    // depois de uma escolha, a barra do navegador acompanha a escolha, não o sistema
    if (root.hasAttribute('data-theme')) {
      Array.prototype.forEach.call(themeMetas, function (m) {
        m.setAttribute('content', dark ? '#16111E' : '#FDFBFF');
      });
    }
  }

  if (themeBtn) {
    syncTheme();
    themeBtn.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      var apply = function () {
        // sem transições pela metade: todas as cores trocam juntas
        root.classList.add('theme-swap');
        root.setAttribute('data-theme', next);
        syncTheme();
        void root.offsetWidth;
        root.classList.remove('theme-swap');
      };
      if (doc.startViewTransition && !reduceMotion) doc.startViewTransition(apply);
      else apply();
    });
    var onSystemTheme = function () {
      if (!root.hasAttribute('data-theme')) syncTheme();
    };
    if (systemDark && systemDark.addEventListener) systemDark.addEventListener('change', onSystemTheme);
    else if (systemDark && systemDark.addListener) systemDark.addListener(onSystemTheme);
  }

  /* ---------- Preciso de ajuda: escolha da situação ---------- */
  // No desktop é lista e painel lado a lado, sempre com um caminho aberto.
  // No celular é sanfona: abrir um fecha o anterior, e tocar no aberto o fecha.
  var header = doc.querySelector('.site-header');
  var paths = doc.querySelector('[data-paths]');
  var pathButtons = paths ? Array.prototype.slice.call(paths.querySelectorAll('.path-btn')) : [];
  var wide = window.matchMedia ? window.matchMedia('(min-width: 900px)') : null;

  function isWide() {
    return !!(wide && wide.matches);
  }

  function showPath(btn) {
    pathButtons.forEach(function (b) {
      var open = b === btn;
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
      var panel = doc.getElementById(b.getAttribute('aria-controls'));
      if (panel) panel.hidden = !open;
    });
  }

  function pathButtonFor(id) {
    if (!paths || !id) return null;
    for (var i = 0; i < pathButtons.length; i++) {
      if (pathButtons[i].getAttribute('aria-controls') === id) return pathButtons[i];
    }
    return null;
  }

  if (paths && pathButtons.length) {
    paths.classList.add('is-enhanced');
    showPath(pathButtonFor(window.location.hash.slice(1)) || pathButtons[0]);

    pathButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.getAttribute('aria-expanded') === 'true') {
          if (isWide()) return;
          btn.setAttribute('aria-expanded', 'false');
          doc.getElementById(btn.getAttribute('aria-controls')).hidden = true;
          return;
        }
        showPath(btn);
        // no celular o painel anterior fecha acima; mantém o botão escolhido à vista
        if (!isWide()) {
          var top = btn.getBoundingClientRect().top;
          var offset = (header ? header.offsetHeight : 64) + 12;
          if (top < offset) window.scrollBy(0, top - offset);
        }
      });
    });

    // ao passar do celular para o desktop sem nada aberto, abre o primeiro
    var onWide = function () {
      if (!isWide()) return;
      var anyOpen = pathButtons.some(function (b) {
        return b.getAttribute('aria-expanded') === 'true';
      });
      if (!anyOpen) showPath(pathButtons[0]);
    };
    if (wide && wide.addEventListener) wide.addEventListener('change', onWide);
    else if (wide && wide.addListener) wide.addListener(onWide);
  }

  /* ---------- Perto de você: endereço procurado fica marcado ---------- */
  // No desktop os endereços ficam em duas colunas; sem a marca, quem chega por
  // "Onde fica em Porto Velho" não sabe qual dos dois do topo procurou.
  var markedPlace = null;
  function markPlace(el) {
    if (markedPlace) markedPlace.classList.remove('is-target');
    markedPlace = el && el.closest ? el.closest('.place') : null;
    if (markedPlace) markedPlace.classList.add('is-target');
  }
  markPlace(doc.getElementById(window.location.hash.slice(1)));

  /* ---------- Âncoras sem empilhar histórico ---------- */
  // Cada clique em âncora criaria uma entrada no histórico e o "voltar" do
  // Sair rápido cairia de novo no site. Por isso a rolagem é feita aqui.
  doc.addEventListener('click', function (event) {
    var link = event.target.closest ? event.target.closest('a[href^="#"]') : null;
    if (!link) return;

    var id = link.getAttribute('href').slice(1);
    var target = id ? doc.getElementById(id) : null;
    event.preventDefault();
    setMenu(false);
    if (!target) return;

    // link para um caminho de "Preciso de ajuda": abre o caminho antes de rolar
    var pathBtn = pathButtonFor(id);
    if (pathBtn) {
      showPath(pathBtn);
      target = isWide() ? paths : pathBtn;
    }
    markPlace(target);

    // rolagem suave só para perto; para longe ela levaria segundos, então o salto é direto
    var far = Math.abs(target.getBoundingClientRect().top) > window.innerHeight * 1.5;
    target.scrollIntoView({ behavior: reduceMotion || far ? 'auto' : 'smooth', block: 'start' });
    if (target.tabIndex < 0 && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    try {
      window.history.replaceState(null, '', '#' + id);
    } catch (error) {
      /* alguns navegadores bloqueiam isso em arquivos locais; a rolagem já aconteceu */
    }
  });

  /* ---------- Estados ligados à rolagem ---------- */
  var sentinel = doc.querySelector('.scroll-sentinel');
  var callbar = doc.getElementById('callbar');
  var heroCall = doc.querySelector('[data-hero-call]');
  var footerCalls = doc.querySelector('[data-footer-calls]');

  if (!('IntersectionObserver' in window)) {
    if (callbar) callbar.classList.add('is-visible');
    return;
  }

  if (header && sentinel) {
    new IntersectionObserver(function (entries) {
      header.classList.toggle('is-stuck', !entries[0].isIntersecting);
    }).observe(sentinel);
  }

  // a barra some quando outros botões de ligar já estão na tela (abertura e rodapé)
  if (callbar && heroCall) {
    var callsInView = {};
    var callObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        callsInView[entry.target === heroCall ? 'hero' : 'footer'] = entry.isIntersecting;
      });
      callbar.classList.toggle('is-visible', !callsInView.hero && !callsInView.footer);
    });
    callObserver.observe(heroCall);
    if (footerCalls) callObserver.observe(footerCalls);
  }

  /* ---------- Seção atual no menu ---------- */
  // Só observa as seções que existem na página.
  var navTargets = [];
  Array.prototype.forEach.call(doc.querySelectorAll('.nav a[href^="#"]'), function (link) {
    var el = doc.getElementById(link.getAttribute('href').slice(1));
    if (el) navTargets.push({ link: link, el: el });
  });

  if (navTargets.length) {
    var inView = {};
    var sectionObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          inView[entry.target.id] = entry.isIntersecting;
        });
        var current = null;
        navTargets.forEach(function (t) {
          if (inView[t.el.id]) current = t;
        });
        navTargets.forEach(function (t) {
          if (t === current) t.link.setAttribute('aria-current', 'true');
          else t.link.removeAttribute('aria-current');
        });
      },
      // a faixa de leitura é o terço de cima da tela
      { rootMargin: '-30% 0px -60% 0px' }
    );
    navTargets.forEach(function (t) {
      sectionObserver.observe(t.el);
    });
  }

  /* ---------- Linha do tempo (GSAP + ScrollTrigger) ---------- */
  // A linha se desenha conforme a pessoa lê e cada etapa acende quando a linha chega
  // nela. Sem JavaScript, com movimento reduzido ou se o GSAP falhar, a linha do
  // tempo fica pronta e completa: o conteúdo nunca depende da animação.
  var timeline = doc.querySelector('[data-timeline]');

  function loadScript(src, done, fail) {
    var s = doc.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = done;
    s.onerror = fail;
    doc.head.appendChild(s);
  }

  function buildTimeline(el) {
    var gsap = window.gsap;
    var ScrollTrigger = window.ScrollTrigger;
    if (!gsap || !ScrollTrigger) {
      el.classList.remove('tl-anim');
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    var fill = el.querySelector('.tl-fill');
    var stages = Array.prototype.slice.call(el.querySelectorAll('.tl-stage'));
    var RAIL_TOP = 24; // mesmos valores do CSS: .tl-rail { top: 24px; bottom: 28px }
    var RAIL_BOTTOM = 28;
    var MARKER_CENTER = 24;
    var points = [];

    // em que ponto do percurso (0 a 1) a linha encosta no marcador de cada etapa
    function measure() {
      var length = el.offsetHeight - RAIL_TOP - RAIL_BOTTOM;
      points = stages.map(function (stage) {
        return (stage.offsetTop + MARKER_CENTER - RAIL_TOP) / length;
      });
    }

    // a primeira etapa acende assim que a linha começa a se desenhar, não antes
    function light(progress) {
      stages.forEach(function (stage, i) {
        stage.classList.toggle('is-reached', progress >= Math.max(points[i] - 0.001, 0.003));
      });
    }

    measure();
    gsap.fromTo(
      fill,
      { scaleY: 0 },
      {
        scaleY: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top 70%',
          end: 'bottom 60%',
          scrub: 0.3,
          onRefresh: function (self) {
            measure();
            light(self.progress);
          },
          onUpdate: function (self) {
            light(self.progress);
          }
        }
      }
    );
  }

  if (timeline && !reduceMotion) {
    timeline.classList.add('tl-anim');

    var giveUp = function () {
      timeline.classList.remove('tl-anim');
    };
    var started = false;
    var start = function () {
      if (started) return;
      started = true;
      loadScript(
        'js/vendor/gsap.min.js',
        function () {
          loadScript(
            'js/vendor/ScrollTrigger.min.js',
            function () {
              buildTimeline(timeline);
            },
            giveUp
          );
        },
        giveUp
      );
    };

    // só baixa o GSAP quando a linha do tempo está a menos de duas telas
    new IntersectionObserver(
      function (entries, observer) {
        if (entries[0].isIntersecting) {
          observer.disconnect();
          start();
        }
      },
      { rootMargin: '200% 0px' }
    ).observe(timeline);
  }
})();
