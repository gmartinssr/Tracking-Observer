(function () {
  "use strict";
  const startedAt = performance.now();
  const originalFetch = window.fetch;
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  function emit(type, data) {
    const event = { type, page: location.pathname + location.search, title: document.title, elapsedMs: Math.round(performance.now() - startedAt), ...data };
    navigator.sendBeacon("/__tracker/event", new Blob([JSON.stringify(event)], { type: "application/json" }));
  }

  window.__trackingObserver = {
    mark(label, data) { emit("mark", { label: String(label), ...data }); },
    wrap(label, callback) {
      if (typeof callback !== "function") throw new TypeError("callback precisa ser uma função");
      return function () {
        const started = performance.now();
        emit("function:start", { label: String(label) });
        try {
          const result = callback.apply(this, arguments);
          const finish = () => emit("function:end", { label: String(label), durationMs: Math.round(performance.now() - started) });
          if (result && typeof result.finally === "function") return result.finally(finish);
          finish();
          return result;
        } catch (error) {
          emit("error", { label: String(label), message: error.message });
          throw error;
        }
      };
    },
  };

  window.fetch = function (input, options) {
    const url = typeof input === "string" ? input : input.url;
    const method = (options && options.method) || "GET";
    const started = performance.now();
    emit("fetch:start", { method, url });
    return originalFetch.apply(this, arguments).then((response) => {
      emit("fetch:end", { method, url, status: response.status, durationMs: Math.round(performance.now() - started) });
      return response;
    }, (error) => {
      emit("fetch:error", { url, message: error.message });
      throw error;
    });
  };

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__trackingObserverRequest = { method, url };
    return originalOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    const request = this.__trackingObserverRequest || { method: "GET", url: "desconhecida" };
    const started = performance.now();
    emit("xhr:start", request);
    this.addEventListener("loadend", () => emit("xhr:end", { ...request, status: this.status, durationMs: Math.round(performance.now() - started) }), { once: true });
    return originalSend.apply(this, arguments);
  };

  document.addEventListener("click", (event) => {
    const element = event.target.closest && event.target.closest("button, a, input, [role='button']");
    if (!element) return;
    emit("click", {
      element: element.tagName.toLowerCase(),
      label: (element.innerText || element.value || element.getAttribute("aria-label") || "").trim().slice(0, 120),
      id: element.id || undefined, file: location.pathname,
    });
  }, true);
  window.addEventListener("error", (event) => emit("error", { message: event.message, file: event.filename, line: event.lineno }));
  window.addEventListener("unhandledrejection", (event) => emit("error", { message: String(event.reason && event.reason.message || event.reason) }));
  window.addEventListener("load", () => {
    performance.getEntriesByType("resource").forEach((resource) => {
      const extension = resource.name.split("?")[0].split(".").pop().toLowerCase();
      if (["js", "css"].includes(extension)) emit("resource", { resourceType: extension.toUpperCase(), url: resource.name, durationMs: Math.round(resource.duration) });
    });
    emit("page:ready", { file: location.pathname });
  });
})();
