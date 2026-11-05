"use strict";

// On each page load, compare the saved drawings with New York Lottery open data
// and prepend any newer dates before the rest of the app starts.
(function () {
  const STORE_KEY = "lottery-live-rows-v1";
  const PAGE = 1000;
  const MAX_ROWS = 8000;

  const SOURCES = [
    { id: "powerball", label: "Powerball", resource: "d6yy-54nr", bucket: "powerball" },
    { id: "megamillions", label: "Mega Millions", resource: "5xaw-6ayf", bucket: "game" },
    { id: "lotto", label: "New York Lotto", resource: "6nbc-h7bj", bucket: "game" },
    { id: "millionaire", label: "Millionaire for Life", resource: "a4w9-a3tp", bucket: "game" },
    { id: "take5", label: "Take 5", resource: "dg63-4siq", bucket: "game", session: true },
    { id: "daily", label: "Numbers and Win 4", resource: "hsys-3def", bucket: "daily", session: true },
    { id: "pick10", label: "Pick 10", resource: "bycu-cw7c", bucket: "game" },
  ];

  function isoDate(value) {
    return String(value || "").slice(0, 10);
  }

  function ints(text) {
    return String(text || "").trim().split(/\s+/).filter(Boolean).map(Number);
  }

  function digits(text, width) {
    const raw = String(text || "").trim();
    if (!raw) return [];
    return raw.padStart(width, "0").slice(-width).split("").map(Number);
  }

  function uniqueInRange(nums, min, max, count) {
    if (nums.length !== count) return false;
    if (nums.some((n) => !Number.isInteger(n) || n < min || n > max)) return false;
    return new Set(nums).size === nums.length;
  }

  function sorted(nums) {
    return nums.slice().sort((a, b) => a - b);
  }

  function newestDate(rows) {
    let best = "";
    (rows || []).forEach((row) => {
      if (row && row[0] > best) best = row[0];
    });
    return best;
  }

  function rowKey(row, session) {
    return session ? `${row[0]}|${row[1]}` : row[0];
  }

  function sortRows(rows, session) {
    rows.sort((a, b) => {
      if (a[0] !== b[0]) return a[0] < b[0] ? 1 : -1;
      if (!session) return 0;
      const rank = (name) => (name === "Evening" ? 0 : 1);
      return rank(a[1]) - rank(b[1]);
    });
    return rows;
  }

  function merge(existing, incoming, session) {
    const rows = existing.slice();
    const seen = new Set(rows.map((row) => rowKey(row, session)));
    let added = 0;
    incoming.forEach((row) => {
      const key = rowKey(row, session);
      if (seen.has(key)) return;
      seen.add(key);
      rows.push(row);
      added += 1;
    });
    if (added) sortRows(rows, session);
    return { rows, added };
  }

  function extras(rows, originalKeys, session) {
    return rows.filter((row) => !originalKeys.has(rowKey(row, session)));
  }

  function readStore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (err) {
      return {};
    }
  }

  function writeStore(data) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (err) {
      /* Private browsing can refuse storage. The live rows still apply this visit. */
    }
  }

  async function fetchSince(resource, since) {
    const rows = [];
    const where = encodeURIComponent(`draw_date >= '${since}T00:00:00.000'`);
    for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
      const url = `https://data.ny.gov/resource/${resource}.json?$where=${where}&$order=draw_date%20DESC&$limit=${PAGE}&$offset=${offset}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error(`${resource} ${res.status}`);
      const batch = await res.json();
      if (!Array.isArray(batch)) throw new Error(`${resource} payload`);
      rows.push(...batch);
      if (batch.length < PAGE) break;
    }
    return rows;
  }

  function powerballRows(raw) {
    return raw.map((row) => {
      const nums = ints(row.winning_numbers);
      const whites = sorted(nums.slice(0, 5));
      const pb = nums[5];
      const mult = Number(row.multiplier);
      if (!uniqueInRange(whites, 1, 69, 5)) return null;
      if (!Number.isInteger(pb) || pb < 1 || pb > 26) return null;
      return [isoDate(row.draw_date), ...whites, pb, Number.isInteger(mult) ? mult : 1];
    }).filter(Boolean);
  }

  function megaRows(raw) {
    return raw.map((row) => {
      const whites = sorted(ints(row.winning_numbers));
      const ball = Number(row.mega_ball);
      if (!uniqueInRange(whites, 1, 70, 5)) return null;
      if (!Number.isInteger(ball) || ball < 1 || ball > 24) return null;
      return [isoDate(row.draw_date), ...whites, ball];
    }).filter(Boolean);
  }

  function millionaireRows(raw) {
    return raw.map((row) => {
      const whites = sorted(ints(row.winning_numbers));
      const ball = Number(row.mill_ball);
      if (!uniqueInRange(whites, 1, 58, 5)) return null;
      if (!Number.isInteger(ball) || ball < 1 || ball > 5) return null;
      return [isoDate(row.draw_date), ...whites, ball];
    }).filter(Boolean);
  }

  function lottoRows(raw) {
    return raw.map((row) => {
      const whites = sorted(ints(row.winning_numbers));
      const bonus = Number(row.bonus);
      if (!uniqueInRange(whites, 1, 59, 6)) return null;
      if (!Number.isInteger(bonus) || bonus < 1 || bonus > 59 || whites.includes(bonus)) return null;
      return [isoDate(row.draw_date), ...whites, bonus];
    }).filter(Boolean);
  }

  function take5Rows(raw) {
    const rows = [];
    raw.forEach((row) => {
      const date = isoDate(row.draw_date);
      [["Evening", row.evening_winning_numbers], ["Midday", row.midday_winning_numbers]].forEach(([session, text]) => {
        const nums = sorted(ints(text));
        if (!date || !uniqueInRange(nums, 1, 39, 5)) return;
        rows.push([date, session, ...nums]);
      });
    });
    return rows;
  }

  function digitSessions(raw, field, width) {
    const rows = [];
    raw.forEach((row) => {
      const date = isoDate(row.draw_date);
      [["Evening", row[`evening_${field}`]], ["Midday", row[`midday_${field}`]]].forEach(([session, text]) => {
        const nums = digits(text, width);
        if (!date || nums.length !== width || nums.some((n) => !Number.isInteger(n) || n < 0 || n > 9)) return;
        rows.push([date, session, ...nums]);
      });
    });
    return rows;
  }

  function pick10Rows(raw) {
    return raw.map((row) => {
      const nums = sorted(ints(row.winning_numbers));
      if (!uniqueInRange(nums, 1, 80, 20)) return null;
      return [isoDate(row.draw_date), ...nums];
    }).filter(Boolean);
  }

  function convert(source, raw) {
    if (source.id === "powerball") return powerballRows(raw);
    if (source.id === "megamillions") return megaRows(raw);
    if (source.id === "lotto") return lottoRows(raw);
    if (source.id === "millionaire") return millionaireRows(raw);
    if (source.id === "take5") return take5Rows(raw);
    if (source.id === "pick10") return pick10Rows(raw);
    return [];
  }

  function gameList(id) {
    const games = window.GAME_DRAWS || {};
    return Array.isArray(games[id]) ? games[id] : [];
  }

  function setGameList(id, rows) {
    if (!window.GAME_DRAWS) window.GAME_DRAWS = {};
    window.GAME_DRAWS[id] = rows;
  }

  function cleanRows(rows) {
    return Array.isArray(rows) ? rows.filter((row) => Array.isArray(row) && typeof row[0] === "string") : [];
  }

  function applySaved(store) {
    const power = merge(window.POWERBALL_DRAWS, cleanRows(store.powerball), false);
    window.POWERBALL_DRAWS = power.rows;
    ["megamillions", "lotto", "millionaire", "take5", "win4", "numbers", "pick10"].forEach((id) => {
      const session = id === "take5" || id === "win4" || id === "numbers";
      const merged = merge(gameList(id), cleanRows(store[id]), session);
      setGameList(id, merged.rows);
    });
  }

  async function refreshOne(source) {
    if (source.bucket === "daily") {
      const sinceNumbers = newestDate(gameList("numbers"));
      const sinceWin = newestDate(gameList("win4"));
      const since = sinceNumbers < sinceWin ? sinceNumbers : sinceWin;
      const raw = await fetchSince(source.resource, since || "1980-01-01");
      const numbers = merge(gameList("numbers"), digitSessions(raw, "daily", 3), true);
      const win4 = merge(gameList("win4"), digitSessions(raw, "win_4", 4), true);
      setGameList("numbers", numbers.rows);
      setGameList("win4", win4.rows);
      return [
        { id: "numbers", label: "Numbers", added: numbers.added },
        { id: "win4", label: "Win 4", added: win4.added },
      ];
    }

    const current = source.bucket === "powerball" ? window.POWERBALL_DRAWS : gameList(source.id);
    const since = newestDate(current);
    const raw = await fetchSince(source.resource, since || "1980-01-01");
    const incoming = convert(source, raw);
    const session = !!source.session;
    const merged = merge(current, incoming, session);
    if (source.bucket === "powerball") window.POWERBALL_DRAWS = merged.rows;
    else setGameList(source.id, merged.rows);
    return [{ id: source.id, label: source.label, added: merged.added }];
  }

  function remember(store, original) {
    store.powerball = extras(window.POWERBALL_DRAWS, original.powerball, false);
    ["megamillions", "lotto", "millionaire", "take5", "win4", "numbers", "pick10"].forEach((id) => {
      const session = id === "take5" || id === "win4" || id === "numbers";
      store[id] = extras(gameList(id), original[id], session);
    });
    writeStore(store);
  }

  function keysOf(rows, session) {
    return new Set((rows || []).map((row) => rowKey(row, session)));
  }

  function startApp() {
    const script = document.createElement("script");
    script.src = "app.js";
    document.body.appendChild(script);
  }

  const note = document.getElementById("main");
  if (note) note.textContent = "Checking for new lottery drawings…";

  const original = {
    powerball: keysOf(window.POWERBALL_DRAWS, false),
    megamillions: keysOf(gameList("megamillions"), false),
    lotto: keysOf(gameList("lotto"), false),
    millionaire: keysOf(gameList("millionaire"), false),
    take5: keysOf(gameList("take5"), true),
    win4: keysOf(gameList("win4"), true),
    numbers: keysOf(gameList("numbers"), true),
    pick10: keysOf(gameList("pick10"), false),
  };

  const store = readStore();
  applySaved(store);

  const jobs = SOURCES.map((source) => refreshOne(source).then(
    (games) => ({ ok: true, games }),
    () => ({ ok: false, games: [] })
  ));

  Promise.all(jobs).then((results) => {
    const games = results.flatMap((result) => result.games);
    const added = games.reduce((sum, game) => sum + game.added, 0);
    const ok = results.some((result) => result.ok);
    window.LOTTERY_UPDATE = {
      checked: true,
      failed: results.some((result) => !result.ok),
      ok,
      added,
      games,
    };
    if (ok) remember(store, original);
    startApp();
  });
}());
