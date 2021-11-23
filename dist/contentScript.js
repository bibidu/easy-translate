(function (factory) {
  typeof define === 'function' && define.amd ? define(factory) :
  factory();
})((function () { 'use strict';

  const equalFn = (a, b) => a === b;
  const signalOptions = {
    equals: equalFn
  };
  let runEffects = runQueue;
  const NOTPENDING = {};
  const STALE = 1;
  const PENDING = 2;
  const UNOWNED = {
    owned: null,
    cleanups: null,
    context: null,
    owner: null
  };
  var Owner = null;
  let Transition = null;
  let Listener = null;
  let Pending = null;
  let Updates = null;
  let Effects = null;
  let ExecCount = 0;

  function createRoot$1(fn, detachedOwner) {
    detachedOwner && (Owner = detachedOwner);
    const listener = Listener,
          owner = Owner,
          root = fn.length === 0 && !false ? UNOWNED : {
      owned: null,
      cleanups: null,
      context: null,
      owner,
      attached: !!detachedOwner
    };
    Owner = root;
    Listener = null;
    let result;

    try {
      runUpdates(() => result = fn(() => cleanNode(root)), true);
    } finally {
      Listener = listener;
      Owner = owner;
    }

    return result;
  }

  function createSignal(value, options) {
    options = options ? Object.assign({}, signalOptions, options) : signalOptions;
    const s = {
      value,
      observers: null,
      observerSlots: null,
      pending: NOTPENDING,
      comparator: options.equals || undefined
    };
    return [readSignal.bind(s), value => {
      if (typeof value === "function") {
        value = value(s.pending !== NOTPENDING ? s.pending : s.value);
      }

      return writeSignal(s, value);
    }];
  }

  function createRenderEffect(fn, value, options) {
    updateComputation(createComputation(fn, value, false));
  }

  function createEffect(fn, value, options) {
    runEffects = runUserEffects;
    const c = createComputation(fn, value, false);
    c.user = true;
    Effects && Effects.push(c);
  }

  function createMemo(fn, value, options) {
    options = options ? Object.assign({}, signalOptions, options) : signalOptions;
    const c = createComputation(fn, value, true);
    c.pending = NOTPENDING;
    c.observers = null;
    c.observerSlots = null;
    c.state = 0;
    c.comparator = options.equals || undefined;
    updateComputation(c);
    return readSignal.bind(c);
  }

  function batch(fn) {
    if (Pending) return fn();
    let result;
    const q = Pending = [];

    try {
      result = fn();
    } finally {
      Pending = null;
    }

    runUpdates(() => {
      for (let i = 0; i < q.length; i += 1) {
        const data = q[i];

        if (data.pending !== NOTPENDING) {
          const pending = data.pending;
          data.pending = NOTPENDING;
          writeSignal(data, pending);
        }
      }
    }, false);
    return result;
  }

  function untrack(fn) {
    let result,
        listener = Listener;
    Listener = null;
    result = fn();
    Listener = listener;
    return result;
  }

  function onMount(fn) {
    createEffect(() => untrack(fn));
  }

  function readSignal() {
    if (this.state && this.sources) {
      const updates = Updates;
      Updates = null;
      this.state === STALE ? updateComputation(this) : lookDownstream(this);
      Updates = updates;
    }

    if (Listener) {
      const sSlot = this.observers ? this.observers.length : 0;

      if (!Listener.sources) {
        Listener.sources = [this];
        Listener.sourceSlots = [sSlot];
      } else {
        Listener.sources.push(this);
        Listener.sourceSlots.push(sSlot);
      }

      if (!this.observers) {
        this.observers = [Listener];
        this.observerSlots = [Listener.sources.length - 1];
      } else {
        this.observers.push(Listener);
        this.observerSlots.push(Listener.sources.length - 1);
      }
    }
    return this.value;
  }

  function writeSignal(node, value, isComp) {
    if (node.comparator) {
      if (node.comparator(node.value, value)) return value;
    }

    if (Pending) {
      if (node.pending === NOTPENDING) Pending.push(node);
      node.pending = value;
      return value;
    }

    node.value = value;

    if (node.observers && (!Updates || node.observers.length)) {
      runUpdates(() => {
        for (let i = 0; i < node.observers.length; i += 1) {
          const o = node.observers[i];
          if (Transition && Transition.running && Transition.disposed.has(o)) ;
          if (o.observers && o.state !== PENDING) markUpstream(o);
          o.state = STALE;
          if (o.pure) Updates.push(o);else Effects.push(o);
        }

        if (Updates.length > 10e5) {
          Updates = [];
          if (false) ;
          throw new Error();
        }
      }, false);
    }

    return value;
  }

  function updateComputation(node) {
    if (!node.fn) return;
    cleanNode(node);
    const owner = Owner,
          listener = Listener,
          time = ExecCount;
    Listener = Owner = node;
    runComputation(node, node.value, time);

    Listener = listener;
    Owner = owner;
  }

  function runComputation(node, value, time) {
    let nextValue;

    try {
      nextValue = node.fn(value);
    } catch (err) {
      handleError(err);
    }

    if (!node.updatedAt || node.updatedAt <= time) {
      if (node.observers && node.observers.length) {
        writeSignal(node, nextValue);
      } else node.value = nextValue;

      node.updatedAt = time;
    }
  }

  function createComputation(fn, init, pure, options) {
    const c = {
      fn,
      state: STALE,
      updatedAt: null,
      owned: null,
      sources: null,
      sourceSlots: null,
      cleanups: null,
      value: init,
      owner: Owner,
      context: null,
      pure
    };
    if (Owner === null) ;else if (Owner !== UNOWNED) {
      {
        if (!Owner.owned) Owner.owned = [c];else Owner.owned.push(c);
      }
    }
    return c;
  }

  function runTop(node) {
    let top = node.state === STALE && node,
        pending;
    if (node.suspense && untrack(node.suspense.inFallback)) return node.suspense.effects.push(node);
    const runningTransition = Transition ;

    while ((node.fn || runningTransition ) && (node = node.owner)) {
      if (node.state === PENDING) pending = node;else if (node.state === STALE) {
        top = node;
        pending = undefined;
      }
    }

    if (pending) {
      const updates = Updates;
      Updates = null;
      lookDownstream(pending);
      Updates = updates;
      if (!top || top.state !== STALE) return;
    }

    top && updateComputation(top);
  }

  function runUpdates(fn, init) {
    if (Updates) return fn();
    let wait = false;
    if (!init) Updates = [];
    if (Effects) wait = true;else Effects = [];
    ExecCount++;

    try {
      fn();
    } catch (err) {
      handleError(err);
    } finally {
      completeUpdates(wait);
    }
  }

  function completeUpdates(wait) {
    if (Updates) {
      runQueue(Updates);
      Updates = null;
    }

    if (wait) return;

    if (Effects.length) batch(() => {
      runEffects(Effects);
      Effects = null;
    });else {
      Effects = null;
    }
  }

  function runQueue(queue) {
    for (let i = 0; i < queue.length; i++) runTop(queue[i]);
  }

  function runUserEffects(queue) {
    let i,
        userLength = 0;

    for (i = 0; i < queue.length; i++) {
      const e = queue[i];
      if (!e.user) runTop(e);else queue[userLength++] = e;
    }

    const resume = queue.length;

    for (i = 0; i < userLength; i++) runTop(queue[i]);

    for (i = resume; i < queue.length; i++) runTop(queue[i]);
  }

  function lookDownstream(node) {
    node.state = 0;

    for (let i = 0; i < node.sources.length; i += 1) {
      const source = node.sources[i];

      if (source.sources) {
        if (source.state === STALE) runTop(source);else if (source.state === PENDING) lookDownstream(source);
      }
    }
  }

  function markUpstream(node) {
    for (let i = 0; i < node.observers.length; i += 1) {
      const o = node.observers[i];

      if (!o.state) {
        o.state = PENDING;
        o.observers && markUpstream(o);
      }
    }
  }

  function cleanNode(node) {
    let i;

    if (node.sources) {
      while (node.sources.length) {
        const source = node.sources.pop(),
              index = node.sourceSlots.pop(),
              obs = source.observers;

        if (obs && obs.length) {
          const n = obs.pop(),
                s = source.observerSlots.pop();

          if (index < obs.length) {
            n.sourceSlots[s] = index;
            obs[index] = n;
            source.observerSlots[index] = s;
          }
        }
      }
    }

    if (node.owned) {
      for (i = 0; i < node.owned.length; i++) cleanNode(node.owned[i]);

      node.owned = null;
    }

    if (node.cleanups) {
      for (i = 0; i < node.cleanups.length; i++) node.cleanups[i]();

      node.cleanups = null;
    }

    node.state = 0;
    node.context = null;
  }

  function handleError(err) {
    throw err;
  }

  function createComponent(Comp, props) {

    return untrack(() => Comp(props));
  }

  function memo(fn, equals) {
    return createMemo(fn, undefined, !equals ? {
      equals
    } : undefined);
  }

  function reconcileArrays(parentNode, a, b) {
    let bLength = b.length,
        aEnd = a.length,
        bEnd = bLength,
        aStart = 0,
        bStart = 0,
        after = a[aEnd - 1].nextSibling,
        map = null;

    while (aStart < aEnd || bStart < bEnd) {
      if (a[aStart] === b[bStart]) {
        aStart++;
        bStart++;
        continue;
      }

      while (a[aEnd - 1] === b[bEnd - 1]) {
        aEnd--;
        bEnd--;
      }

      if (aEnd === aStart) {
        const node = bEnd < bLength ? bStart ? b[bStart - 1].nextSibling : b[bEnd - bStart] : after;

        while (bStart < bEnd) parentNode.insertBefore(b[bStart++], node);
      } else if (bEnd === bStart) {
        while (aStart < aEnd) {
          if (!map || !map.has(a[aStart])) parentNode.removeChild(a[aStart]);
          aStart++;
        }
      } else if (a[aStart] === b[bEnd - 1] && b[bStart] === a[aEnd - 1]) {
        const node = a[--aEnd].nextSibling;
        parentNode.insertBefore(b[bStart++], a[aStart++].nextSibling);
        parentNode.insertBefore(b[--bEnd], node);
        a[aEnd] = b[bEnd];
      } else {
        if (!map) {
          map = new Map();
          let i = bStart;

          while (i < bEnd) map.set(b[i], i++);
        }

        const index = map.get(a[aStart]);

        if (index != null) {
          if (bStart < index && index < bEnd) {
            let i = aStart,
                sequence = 1,
                t;

            while (++i < aEnd && i < bEnd) {
              if ((t = map.get(a[i])) == null || t !== index + sequence) break;
              sequence++;
            }

            if (sequence > index - bStart) {
              const node = a[aStart];

              while (bStart < index) parentNode.insertBefore(b[bStart++], node);
            } else parentNode.replaceChild(b[bStart++], a[aStart++]);
          } else aStart++;
        } else parentNode.removeChild(a[aStart++]);
      }
    }
  }

  const $$EVENTS = Symbol("delegated-events");

  function render(code, element, init) {
    let disposer;
    createRoot$1(dispose => {
      disposer = dispose;
      insert(element, code(), element.firstChild ? null : undefined, init);
    });
    return () => {
      disposer();
      element.textContent = "";
    };
  }

  function template(html, check, isSVG) {
    const t = document.createElement("template");
    t.innerHTML = html;
    let node = t.content.firstChild;
    if (isSVG) node = node.firstChild;
    return node;
  }

  function delegateEvents(eventNames, document = window.document) {
    const e = document[$$EVENTS] || (document[$$EVENTS] = new Set());

    for (let i = 0, l = eventNames.length; i < l; i++) {
      const name = eventNames[i];

      if (!e.has(name)) {
        e.add(name);
        document.addEventListener(name, eventHandler);
      }
    }
  }

  function classList(node, value, prev = {}) {
    const classKeys = Object.keys(value),
          prevKeys = Object.keys(prev);
    let i, len;

    for (i = 0, len = prevKeys.length; i < len; i++) {
      const key = prevKeys[i];
      if (!key || key === "undefined" || key in value) continue;
      toggleClassKey(node, key, false);
      delete prev[key];
    }

    for (i = 0, len = classKeys.length; i < len; i++) {
      const key = classKeys[i],
            classValue = !!value[key];
      if (!key || key === "undefined" || prev[key] === classValue) continue;
      toggleClassKey(node, key, classValue);
      prev[key] = classValue;
    }

    return prev;
  }

  function insert(parent, accessor, marker, initial) {
    if (marker !== undefined && !initial) initial = [];
    if (typeof accessor !== "function") return insertExpression(parent, accessor, initial, marker);
    createRenderEffect(current => insertExpression(parent, accessor(), current, marker), initial);
  }

  function toggleClassKey(node, key, value) {
    const classNames = key.split(/\s+/);

    for (let i = 0, nameLen = classNames.length; i < nameLen; i++) node.classList.toggle(classNames[i], value);
  }

  function eventHandler(e) {
    const key = `$$${e.type}`;
    let node = e.composedPath && e.composedPath()[0] || e.target;

    if (e.target !== node) {
      Object.defineProperty(e, "target", {
        configurable: true,
        value: node
      });
    }

    Object.defineProperty(e, "currentTarget", {
      configurable: true,

      get() {
        return node;
      }

    });

    while (node !== null) {
      const handler = node[key];

      if (handler) {
        const data = node[`${key}Data`];
        data !== undefined ? handler(data, e) : handler(e);
        if (e.cancelBubble) return;
      }

      node = node.host && node.host !== node && node.host instanceof Node ? node.host : node.parentNode;
    }
  }

  function insertExpression(parent, value, current, marker, unwrapArray) {
    while (typeof current === "function") current = current();

    if (value === current) return current;
    const t = typeof value,
          multi = marker !== undefined;
    parent = multi && current[0] && current[0].parentNode || parent;

    if (t === "string" || t === "number") {
      if (t === "number") value = value.toString();

      if (multi) {
        let node = current[0];

        if (node && node.nodeType === 3) {
          node.data = value;
        } else node = document.createTextNode(value);

        current = cleanChildren(parent, current, marker, node);
      } else {
        if (current !== "" && typeof current === "string") {
          current = parent.firstChild.data = value;
        } else current = parent.textContent = value;
      }
    } else if (value == null || t === "boolean") {
      current = cleanChildren(parent, current, marker);
    } else if (t === "function") {
      createRenderEffect(() => {
        let v = value();

        while (typeof v === "function") v = v();

        current = insertExpression(parent, v, current, marker);
      });
      return () => current;
    } else if (Array.isArray(value)) {
      const array = [];

      if (normalizeIncomingArray(array, value, unwrapArray)) {
        createRenderEffect(() => current = insertExpression(parent, array, current, marker, true));
        return () => current;
      }

      if (array.length === 0) {
        current = cleanChildren(parent, current, marker);
        if (multi) return current;
      } else {
        if (Array.isArray(current)) {
          if (current.length === 0) {
            appendNodes(parent, array, marker);
          } else reconcileArrays(parent, current, array);
        } else if (current == null || current === "") {
          appendNodes(parent, array);
        } else {
          reconcileArrays(parent, multi && current || [parent.firstChild], array);
        }
      }

      current = array;
    } else if (value instanceof Node) {
      if (Array.isArray(current)) {
        if (multi) return current = cleanChildren(parent, current, marker, value);
        cleanChildren(parent, current, null, value);
      } else if (current == null || current === "" || !parent.firstChild) {
        parent.appendChild(value);
      } else parent.replaceChild(value, parent.firstChild);

      current = value;
    } else ;

    return current;
  }

  function normalizeIncomingArray(normalized, array, unwrap) {
    let dynamic = false;

    for (let i = 0, len = array.length; i < len; i++) {
      let item = array[i],
          t;

      if (item instanceof Node) {
        normalized.push(item);
      } else if (item == null || item === true || item === false) ;else if (Array.isArray(item)) {
        dynamic = normalizeIncomingArray(normalized, item) || dynamic;
      } else if ((t = typeof item) === "string") {
        normalized.push(document.createTextNode(item));
      } else if (t === "function") {
        if (unwrap) {
          while (typeof item === "function") item = item();

          dynamic = normalizeIncomingArray(normalized, Array.isArray(item) ? item : [item]) || dynamic;
        } else {
          normalized.push(item);
          dynamic = true;
        }
      } else normalized.push(document.createTextNode(item.toString()));
    }

    return dynamic;
  }

  function appendNodes(parent, array, marker) {
    for (let i = 0, len = array.length; i < len; i++) parent.insertBefore(array[i], marker);
  }

  function cleanChildren(parent, current, marker, replacement) {
    if (marker === undefined) return parent.textContent = "";
    const node = replacement || document.createTextNode("");

    if (current.length) {
      let inserted = false;

      for (let i = current.length - 1; i >= 0; i--) {
        const el = current[i];

        if (node !== el) {
          const isParent = el.parentNode === parent;
          if (!inserted && !i) isParent ? parent.replaceChild(node, el) : parent.insertBefore(node, marker);else isParent && parent.removeChild(el);
        } else inserted = true;
      }
    } else parent.insertBefore(node, marker);

    return [node];
  }

  function styleInject(css, ref) {
    if (ref === void 0) ref = {};
    var insertAt = ref.insertAt;

    if (!css || typeof document === 'undefined') {
      return;
    }

    var head = document.head || document.getElementsByTagName('head')[0];
    var style = document.createElement('style');
    style.type = 'text/css';

    if (insertAt === 'top') {
      if (head.firstChild) {
        head.insertBefore(style, head.firstChild);
      } else {
        head.appendChild(style);
      }
    } else {
      head.appendChild(style);
    }

    if (style.styleSheet) {
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }
  }

  var css_248z = ".tp_full-container {\n  position: fixed;\n  top: 0;\n  left: 0;\n  width: 100%;\n  height: 100%;\n  z-index: 99998;\n  transition: transform 0.5s ease;\n  transform: translateX(100%);\n}\n.tp_side-btn {\n  position: fixed;\n  cursor: pointer;\n  z-index: 99999;\n  top: 0;\n  right: 0;\n  width: 45px;\n  height: 25px;\n  border-radius: 30px 0 0 30px;\n  box-shadow: -1px 0px 6px 2px #4e76ea;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  font-size: 15px;\n  font-weight: bold;\n  color: #4e76ea;\n}\n.tp_container {\n  font-family: PingFang SC;\n  position: fixed;\n  background: #fff;\n  z-index: 99999;\n  right: 0;\n  top: 0;\n  bottom: 0;\n  width: 500px;\n  box-shadow: 0px 0px 7px 2px #ddd;\n  box-sizing: border-box;\n}\niframe {\n  width: 100%;\n  height: 100%;\n  border: none;\n}\n.tp_close-button {\n  position: fixed;\n  z-index: 999999;\n  top: 24px;\n  right: 20px;\n  font-size: 24px;\n  width: 25px;\n  height: 25px;\n}\n.tp_close-button:hover {\n  background: rgb(209 209 209 / 60%);\n  border-radius: 6px;\n  cursor: pointer;\n}\n.tp_container-visible {\n  transform: translateX(0);\n}\n\n.tp_main-container {\n  padding: 20px;\n  height: 100%;\n}\n.tp_title {\n  border-bottom: 1px solid #efeded;\n  padding-bottom: 10px;\n  font-weight: 700;\n  font-size: 24px;\n  margin-bottom: 1.5em;\n}\n.tp_translate-item {\n  margin: 20px 0;\n}\n.tp_sub-title {\n  margin-bottom: 0.5em;\n  font-weight: 700;\n}\n.tp_input-area {\n  border-radius: 0px;\n  border: 1px solid rgb(219, 219, 219);\n  margin: 0px;\n  resize: none;\n  box-shadow: none;\n  outline: none;\n  width: 100%;\n  height: 130px;\n  padding: 10px;\n  box-sizing: border-box;\n  font-size: 16px;\n  letter-spacing: 0.1px;\n}\n.tp_notification {\n  color: #4db1f4;\n  font-weight: bold;\n  padding: 4px 10px;\n  border: 1px dashed #4db1f4;\n  border-radius: 4px;\n  text-align: center;\n  margin: 0 auto;\n}\n";
  styleInject(css_248z);

  const _tmpl$ = template(`<div><div class="tp_container"><div class="tp_main-container"><div class="tp_title">Translate </div><div class="tp_translate-item"><div class="tp_sub-title">Enter</div><textarea class="tp_input-area"></textarea></div><div class="tp_translate-item"><div class="tp_sub-title">Result</div><textarea readonly style="font-size:15px;cursor:auto;" class="tp_input-area"></textarea></div></div><div class="tp_close-button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" style="width: 28px;height: 28px;"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg></div></div></div>`),
        _tmpl$2 = template(`<div class="tp_side-btn">译</div>`),
        _tmpl$3 = template(`<div class="tp_notification"></div>`);
  const API_KEY = 'AIzaSyB1KA8ILwBfyQSPqyPA-R8oWVx4j8UV6iY';

  const getLanguage = value => {
    return /[a-zA-Z\s]+/.test(value) ? {
      source: 'en',
      target: 'zh-CN'
    } : {
      target: 'en',
      source: 'zh-CN'
    };
  }; // https://script.google.com/macros/s/AKfycbyhDbCo1ZjaGJ1XT1xQOwoHtW7FE6QDK-LoSDe19K__SW7adBA/exec?text=${encodeURIComponent(value)}&source=en&target=zh-CN


  const translate = async value => {
    try {
      const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`, {
        method: 'POST',
        body: JSON.stringify({
          q: value,
          ...getLanguage(value)
        })
      });
      const {
        data
      } = await res.json();
      return data.translations[0].translatedText;
    } catch (error) {
      return '';
    }
  };

  const App = () => {
    let container;
    let inputElement;
    let resultElement;
    let translateTimer;
    const [isLoading, setLoading] = createSignal(false);
    const [notiText, setNotiText] = createSignal('');
    const [containerVisible, setContainerVisible] = createSignal(false);
    const [transResult, setTransResult] = createSignal('');

    const onCloseButtonTap = () => {
      setContainerVisible(false);
    };

    const onInnerContainerTap = e => {
      e.stopPropagation();
    };

    const onInputChange = event => {
      const {
        target: {
          value
        }
      } = event;

      if (!value) {
        transResult() && setTransResult('');
        return;
      }

      setLoading(true);
      clearTimeout(translateTimer);
      translateTimer = setTimeout(async () => {
        const result = await translate(value);
        setLoading(false);
        setTransResult(result);
      }, 300);
    };

    const onOuterContainerTap = () => {
      setContainerVisible(false);
    };

    const onResultInputTap = () => {
      resultElement.select();
      document.execCommand('copy');
      setNotiText('Already copied!');
      setTimeout(() => {
        setNotiText('');
      }, 1000);
    };

    const showWithFocused = () => {
      setContainerVisible(true);
      inputElement.focus();
    };

    onMount(() => {
      inputElement.focus();
      document.addEventListener('keydown', ({
        metaKey,
        keyCode
      }) => {
        const isPressCommand = metaKey;
        const isPressSemicolon = keyCode === 186;

        if (isPressCommand && isPressSemicolon) {
          const next = !containerVisible();

          if (next) {
            inputElement.focus();
          }

          setContainerVisible(next);
        }
      });
    });
    return [memo((() => {
      const _c$ = memo(() => !!!containerVisible(), true);

      return () => _c$() && (() => {
        const _el$13 = _tmpl$2.cloneNode(true);

        _el$13.$$click = showWithFocused;
        return _el$13;
      })();
    })()), (() => {
      const _el$ = _tmpl$.cloneNode(true),
            _el$2 = _el$.firstChild,
            _el$3 = _el$2.firstChild,
            _el$4 = _el$3.firstChild;
            _el$4.firstChild;
            const _el$6 = _el$4.nextSibling,
            _el$7 = _el$6.firstChild,
            _el$8 = _el$7.nextSibling,
            _el$9 = _el$6.nextSibling,
            _el$10 = _el$9.firstChild,
            _el$11 = _el$10.nextSibling,
            _el$12 = _el$3.nextSibling;

      _el$.$$click = onOuterContainerTap;
      const _ref$ = container;
      typeof _ref$ === "function" ? _ref$(_el$2) : container = _el$2;
      _el$3.$$click = onInnerContainerTap;

      insert(_el$4, () => isLoading() && '......', null);

      insert(_el$3, (() => {
        const _c$2 = memo(() => !!notiText(), true);

        return () => _c$2() && (() => {
          const _el$14 = _tmpl$3.cloneNode(true);

          insert(_el$14, notiText);

          return _el$14;
        })();
      })(), _el$6);

      _el$8.$$input = onInputChange;
      const _ref$2 = inputElement;
      typeof _ref$2 === "function" ? _ref$2(_el$8) : inputElement = _el$8;
      _el$11.$$click = onResultInputTap;
      const _ref$3 = resultElement;
      typeof _ref$3 === "function" ? _ref$3(_el$11) : resultElement = _el$11;
      _el$12.$$click = onCloseButtonTap;

      createRenderEffect(_p$ => {
        const _v$ = {
          'tp_full-container': true,
          ['tp_container-visible']: containerVisible()
        },
              _v$2 = transResult();

        _p$._v$ = classList(_el$, _v$, _p$._v$);
        _v$2 !== _p$._v$2 && (_el$11.value = _p$._v$2 = _v$2);
        return _p$;
      }, {
        _v$: undefined,
        _v$2: undefined
      });

      return _el$;
    })()];
  };

  const rootId = 'translate-plugin';

  const createRoot = () => {
    const root = document.body.appendChild(document.createElement('div'));
    console.log('create', root);
    root.setAttribute('id', rootId);
    return root;
  };

  const root = document.querySelector(`#${rootId}`) || createRoot();
  render(() => createComponent(App, {}), root);

  delegateEvents(["click", "input"]);

}));
