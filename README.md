# La Notte delle Maschere

Pagina statica in italiano per iscrizioni, voti e classifica live. Si apre anche senza Supabase in modalita' anteprima locale; per condividere i dati tra telefoni e computer va collegato il progetto Supabase.

## Collegare Supabase

1. Crea un progetto gratuito su [supabase.com](https://supabase.com).
2. In **SQL Editor**, esegui tutto il contenuto di `supabase.sql`.
3. In **Project Settings → API**, copia Project URL e la chiave `anon` / `publishable`.
4. Incolla i valori in `config.js` nei campi `supabaseUrl` e `supabaseAnonKey`. Non inserire mai la chiave `service_role` in una pagina pubblica.
5. Pubblica i file statici su un hosting e apri l'indirizzo da telefono o PC. La classifica si aggiorna in tempo reale.

Per chiudere le votazioni, esegui nel SQL Editor: `update public.contest_settings set voting_closed = true where id = true;`. La chiusura viene applicata anche dal database e la pagina mostra il vincitore in diretta. Per riaprire la gara, imposta `voting_closed = false`.

## Anteprima locale

Avvia un server statico dalla cartella, per esempio con `python -m http.server 8000`, poi apri `http://localhost:8000`. Senza chiavi, le iscrizioni restano nel browser e servono solo a provare la grafica: non sono condivise e i voti non vengono salvati.