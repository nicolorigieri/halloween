(() => {
  const config = window.HALLOWEEN_CONFIG || {};
  const hasSupabaseConfig = config.supabaseUrl?.startsWith("https://") && config.supabaseAnonKey && !config.supabaseAnonKey.includes("INCOLLA_QUI");
  const storageKey = "notte-delle-maschere-voter";
  const form = document.querySelector("#registration-form");
  const registrationMessage = document.querySelector("#registration-message");
  const costumeList = document.querySelector("#costume-list");
  const leaderboard = document.querySelector("#leaderboard");
  const entrantCount = document.querySelector("#entrant-count");
  const connectionStatus = document.querySelector("#connection-status");
  const winnerScreen = document.querySelector("#winner-screen");
  let client = null;
  let contestants = [];
  let hasVoted = false;
  let votingClosed = Boolean(config.votingClosed);

  function getVoterId() {
    let id = localStorage.getItem(`${storageKey}-id`);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(`${storageKey}-id`, id);
    }
    return id;
  }

  function showMessage(message, isError = false) {
    registrationMessage.textContent = message;
    registrationMessage.style.color = isError ? "#b63b21" : "#54564c";
  }

  function render() {
    entrantCount.textContent = String(contestants.length);
    if (contestants.length === 0) {
      costumeList.innerHTML = '<p class="empty-state">La sfilata sta per cominciare. Iscriviti per aprire le danze.</p>';
      leaderboard.innerHTML = '<li class="empty-state">Ancora nessun voto. La suspense e\' gia\' nell\'aria.</li>';
      winnerScreen.hidden = true;
      return;
    }

    const sorted = [...contestants].sort((a, b) => b.vote_count - a.vote_count || a.name.localeCompare(b.name, "it"));
    costumeList.replaceChildren(...sorted.map((person, index) => {
      const row = document.createElement("article");
      row.className = "costume-row";
      row.innerHTML = `<span class="costume-index">${String(index + 1).padStart(2, "0")}</span><span class="costume-person"><strong></strong><span></span></span><button class="vote-button" type="button" data-id="${person.id}"></button>`;
      row.querySelector(".costume-person strong").textContent = person.name;
      row.querySelector(".costume-person span").textContent = person.costume;
      const button = row.querySelector("button");
      button.textContent = votingClosed ? "CHIUSO" : hasVoted ? "VOTATO" : "VOTA";
      button.disabled = votingClosed || hasVoted;
      button.addEventListener("click", () => vote(person.id));
      return row;
    }));

    leaderboard.replaceChildren(...sorted.map((person, index) => {
      const item = document.createElement("li");
      item.innerHTML = `<span class="rank">${String(index + 1).padStart(2, "0")}</span><span class="rank-name"><strong></strong><small></small></span><span class="rank-votes"></span>`;
      item.querySelector(".rank-name strong").textContent = person.name;
      item.querySelector(".rank-name small").textContent = person.costume;
      item.querySelector(".rank-votes").textContent = `${person.vote_count} ${person.vote_count === 1 ? "VOTO" : "VOTI"}`;
      return item;
    }));

    const winner = sorted[0];
    winnerScreen.hidden = !votingClosed;
    if (votingClosed) {
      document.querySelector("#winner-costume").textContent = winner.costume;
      document.querySelector("#winner-name").textContent = winner.name;
      document.querySelector("#winner-votes").textContent = `${winner.vote_count} ${winner.vote_count === 1 ? "VOTO" : "VOTI"}`;
    }
  }

  async function loadContestants() {
    const { data, error } = await client.from("contestants").select("id, name, costume, vote_count").order("created_at", { ascending: true });
    if (error) throw error;
    contestants = data || [];
    render();
  }

  async function loadVotingStatus() {
    const { data, error } = await client.from("contest_settings").select("voting_closed").eq("id", true).single();
    if (error) throw error;
    votingClosed = data.voting_closed;
    render();
  }

  async function vote(contestantId) {
    if (hasVoted || votingClosed) return;
    if (!client) {
      const contestant = contestants.find((person) => person.id === contestantId);
      if (!contestant) return;
      contestant.vote_count += 1;
      hasVoted = true;
      render();
      showMessage("Voto di anteprima registrato solo in questo browser.");
      return;
    }
    const buttons = costumeList.querySelectorAll("button");
    buttons.forEach((button) => { button.disabled = true; });
    const { error } = await client.from("votes").insert({ contestant_id: contestantId, voter_id: getVoterId() });
    if (error) {
      if (error.code === "P0001" && error.message.toLowerCase().includes("closed")) {
        votingClosed = true;
        render();
        showMessage("Le votazioni sono chiuse.");
        return;
      }
      if (error.code === "23505") {
        hasVoted = true;
        localStorage.setItem(storageKey, "done");
        render();
        showMessage("Hai gia' votato da questo dispositivo.");
      } else {
        buttons.forEach((button) => { button.disabled = false; });
        showMessage("Il voto non e' partito. Riprova tra un momento.", true);
      }
      return;
    }
    hasVoted = true;
    localStorage.setItem(storageKey, "done");
    render();
    showMessage("Voto registrato. Che vinca il piu' mostruoso!");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const name = String(formData.get("name")).trim();
    const costume = String(formData.get("costume")).trim();
    if (!name || !costume) return;

    if (!client) {
      const id = crypto.randomUUID();
      contestants.push({ id, name, costume, vote_count: 0 });
      render();
      form.reset();
      showMessage("Iscrizione aggiunta in modalita' anteprima.");
      return;
    }

    const submitButton = form.querySelector("button[type=submit]");
    submitButton.disabled = true;
    const { error } = await client.from("contestants").insert({ name, costume });
    submitButton.disabled = false;
    if (error) {
      showMessage("Non riesco a salvare l'iscrizione. Riprova.", true);
      return;
    }
    form.reset();
    showMessage("Ci sei! Il tuo costume e' in gara.");
  });

  async function start() {
    if (!hasSupabaseConfig || !window.supabase?.createClient) {
      connectionStatus.textContent = "ANTEPRIMA LOCALE · CONFIGURA SUPABASE PER LA DIRETTA";
      render();
      return;
    }
    client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    try {
      await loadContestants();
      await loadVotingStatus();
      const { data: alreadyVoted, error } = await client.rpc("has_voted", { voter: getVoterId() });
      if (!error) {
        hasVoted = alreadyVoted;
      }
      if (hasVoted) {
        localStorage.setItem(storageKey, "done");
      }
      render();
      connectionStatus.textContent = "AGGIORNAMENTO IN DIRETTA";
      client.channel("contest-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "contestants" }, loadContestants)
        .on("postgres_changes", { event: "*", schema: "public", table: "contest_settings" }, loadVotingStatus)
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") connectionStatus.textContent = "CONNESSIONE IN AGGIORNAMENTO";
        });
    } catch (error) {
      console.error("Errore caricamento gara:", error);
      connectionStatus.textContent = "CONNESSIONE NON DISPONIBILE";
      showMessage("Controlla configurazione e tabelle Supabase.", true);
    }
  }

  start();
})();