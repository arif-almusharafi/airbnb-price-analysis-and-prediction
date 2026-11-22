// Starts the page. The showcase text and charts are plain HTML, so they show at once.
// The results file is static too. Only after it is drawn do we call the API (F4).
(function (root) {
  async function start() {
    document.getElementById("year").textContent = String(new Date().getFullYear());
    await root.ResultsView.init();
    root.Predictor.init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})(window);
