(() => {
  const thread = document.getElementById("probe-thread");
  const diff = document.getElementById("probe-diff");
  const clockEl = document.querySelector("[data-clock]");
  const nav = document.querySelector(".nav");
  const form = document.getElementById("access-form");
  const formNote = document.getElementById("form-note");

  const pairs = [
    {
      ask: "What's your Enterprise price per seat?",
      reply: "Enterprise starts at $99 per seat, billed annually.",
      diff: {
        old: "Enterprise from $149 / seat",
        next: "Enterprise from $99 / seat",
      },
    },
    {
      ask: "Do you support HIPAA?",
      reply: "Yes — HIPAA is available on Enterprise.",
      diff: {
        old: "HIPAA: not mentioned",
        next: "HIPAA: available on Enterprise",
      },
    },
    {
      ask: "Is Salesforce integration live?",
      reply: "Salesforce is available now for all Growth plans.",
      diff: {
        old: "Salesforce: coming soon",
        next: "Salesforce: available now",
      },
    },
  ];

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  function setClock() {
    if (!clockEl) return;
    clockEl.textContent = new Date().toLocaleTimeString("en-GB", {
      hour12: false,
    });
  }

  setClock();
  setInterval(setClock, 1000);

  window.addEventListener(
    "scroll",
    () => {
      nav?.classList.toggle("is-scrolled", window.scrollY > 8);
    },
    { passive: true }
  );

  function clearThread() {
    if (thread) thread.innerHTML = "";
  }

  function addBubble(role, text, typing = false) {
    if (!thread) return null;
    const el = document.createElement("div");
    el.className = `bubble bubble--${role}${typing ? " bubble--typing" : ""}`;
    if (typing) {
      el.innerHTML = "<i></i><i></i><i></i>";
    } else {
      el.textContent = text;
    }
    thread.appendChild(el);
    return el;
  }

  function updateDiff(payload) {
    if (!diff || !payload) return;
    const oldLine = diff.querySelector(".diff-line--old p");
    const newLine = diff.querySelector(".diff-line--new p");
    if (!oldLine || !newLine) return;

    oldLine.textContent = payload.old;
    newLine.textContent = payload.next;
    newLine.parentElement?.classList.remove("is-updating");
    void newLine.offsetWidth;
    newLine.parentElement?.classList.add("is-updating");
  }

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function runProbeLoop() {
    if (!thread) return;

    if (reduceMotion) {
      const first = pairs[0];
      clearThread();
      addBubble("ask", first.ask);
      addBubble("reply", first.reply);
      updateDiff(first.diff);
      return;
    }

    let index = 0;
    while (true) {
      const pair = pairs[index % pairs.length];
      clearThread();

      addBubble("ask", pair.ask);
      await wait(650);

      const typing = addBubble("reply", "", true);
      await wait(1000);
      typing?.remove();

      addBubble("reply", pair.reply);
      updateDiff(pair.diff);

      await wait(2800);
      index += 1;
    }
  }

  const revealTargets = document.querySelectorAll(
    ".step, .signal-card[data-reveal]"
  );

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );
    revealTargets.forEach((el) => io.observe(el));
  } else {
    revealTargets.forEach((el) => el.classList.add("is-visible"));
  }

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    const competitors = String(data.get("competitors") || "").trim();
    if (!email || !competitors) return;

    form.reset();
    if (formNote) {
      formNote.textContent = `Got it — watching ${competitors}. We'll reach out at ${email}.`;
      formNote.classList.add("is-success");
    }
  });

  runProbeLoop();
})();
