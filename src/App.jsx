import { useEffect, useMemo, useState } from 'react';
import './App.css';
import LineChart from './components/LineChart.jsx';
import { aggregateMonthlySalesFromStream } from './utils/csvStream.js';
import {
  getUserVote,
  isFirebaseConfigured,
  saveUserVote,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  signOutUser,
  subscribeToAuth,
} from './firebase.js';

const DATASET_URL = '/drug_overdose.csv';

function App() {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [datasetName, setDatasetName] = useState('');
  const [parseProgress, setParseProgress] = useState({ rowsParsed: 0 });

  const [agg, setAgg] = useState(null);
  const [selectedDrug, setSelectedDrug] = useState('All');

  const [user, setUser] = useState(null);
  const [vote, setVote] = useState(''); // "yes" | "no" | ""
  const [voteStatus, setVoteStatus] = useState({ kind: 'idle', message: '' });

  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');

  // Auto-load from /public (copied into dist on build).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setLoadError('');
        setParseProgress({ rowsParsed: 0 });
        const res = await fetch(DATASET_URL);
        if (!res.ok || !res.body) throw new Error(`Failed to load dataset at ${DATASET_URL}`);
        const parsed = await aggregateMonthlySalesFromStream(res.body, {
          progressEvery: 20000,
          onProgress: (p) => {
            if (!cancelled) setParseProgress(p);
          },
        });
        if (cancelled) return;
        setDatasetName(DATASET_URL);
        setAgg(parsed);
        setSelectedDrug('All');
      } catch {
        setLoadError(`Could not load ${DATASET_URL}. Make sure it exists in /public.`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsub = subscribeToAuth(async (u) => {
      setUser(u ?? null);
      setVoteStatus({ kind: 'idle', message: '' });
      if (!u) {
        setVote('');
        return;
      }
      try {
        setVoteStatus({ kind: 'pending', message: 'Loading your saved vote…' });
        const existing = await getUserVote(u.uid);
        const v = existing?.vote;
        setVote(v === 'yes' || v === 'no' ? v : '');
        setVoteStatus({ kind: 'idle', message: '' });
      } catch (e) {
        setVoteStatus({ kind: 'error', message: e?.message || 'Failed to load vote.' });
      }
    });
    return () => unsub?.();
  }, []);

  const drugs = useMemo(() => {
    if (!agg) return ['All'];
    const filtered = agg.typeList.filter(
      (d) => String(d).trim().toLowerCase() !== 'dunnage',
    );
    return ['All', ...filtered];
  }, [agg]);

  const monthsForDisplay = useMemo(() => {
    if (!agg) return [];
    const N = 24;
    return agg.months.slice(Math.max(0, agg.months.length - N));
  }, [agg]);

  const valueForBucket = (b) => {
    if (!b) return 0;
    // Treat "Total" as sum of the 3 numeric columns.
    return (b.retailSales ?? 0) + (b.retailTransfers ?? 0) + (b.warehouseSales ?? 0);
  };

  const chartSeries = useMemo(() => {
    if (!agg) return { months: [], series: [] };
    const months = monthsForDisplay;
    const bucketMap =
      selectedDrug === 'All' ? agg.totalsByMonth : agg.byTypeMonth.get(selectedDrug) ?? new Map();
    const series = months.map((m) => ({
      month: m,
      value: valueForBucket(bucketMap.get(m)),
    }));

    return { months, series };
  }, [agg, monthsForDisplay, selectedDrug]);

  const totals = useMemo(() => {
    if (!agg) return { months: 0, rowsParsed: 0, total: 0 };
    const total = monthsForDisplay.reduce((sum, m) => {
      const bucketMap =
        selectedDrug === 'All'
          ? agg.totalsByMonth
          : agg.byTypeMonth.get(selectedDrug) ?? new Map();
      return sum + valueForBucket(bucketMap.get(m));
    }, 0);
    return { months: monthsForDisplay.length, rowsParsed: agg.rowsParsed, total };
  }, [agg, monthsForDisplay, selectedDrug]);

  return (
    <div className="appShell">
      <header className="topBar">
        <div>
          <h1 className="title">Drug Data (Recent, Per Month)</h1>
          <p className="subtitle">
            Auto-loaded dataset • segmented by Drug • shown per month (most recent 24 months).
          </p>
        </div>
      </header>

      <main className="grid">
        <section className="card span2">
          <div className="cardHeader">
            <div>
              <div className="cardTitle">Chart</div>
              <div className="cardSubtle">
                {datasetName ? `Loaded: ${datasetName}` : 'Loading dataset…'}
              </div>
            </div>
            <div className="pill">
              {loading
                ? `Loading… (${parseProgress.rowsParsed.toLocaleString()} rows)`
                : agg
                  ? 'Ready'
                  : 'Error'}
            </div>
          </div>

          {loadError && <div className="errorBox">Error: {loadError}</div>}

          {agg && (
            <div className="controls singleRow">
              <label className="field">
                <div className="fieldLabel">Drug</div>
                <select
                  className="select"
                  value={selectedDrug}
                  onChange={(e) => setSelectedDrug(e.target.value)}
                >
                  {drugs.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>

              <div className="stat inline">
                <div className="statLabel">Rows parsed</div>
                <div className="statValue">{totals.rowsParsed.toLocaleString()}</div>
              </div>
              <div className="stat inline">
                <div className="statLabel">Months shown</div>
                <div className="statValue">{totals.months.toLocaleString()}</div>
              </div>
              <div className="stat inline">
                <div className="statLabel">Total (shown range)</div>
                <div className="statValue">{Math.round(totals.total).toLocaleString()}</div>
              </div>
            </div>
          )}

          {agg && (
            <LineChart
              title={selectedDrug === 'All' ? 'All Drugs (Monthly Total)' : `${selectedDrug} (Monthly Total)`}
              months={chartSeries.months}
              series={chartSeries.series}
              yLabel="sum"
            />
          )}
        </section>

        <section className="card span2 statementBottom">
          <div className="cardHeader">
            <div>
              <div className="cardTitle">Statement of Intent</div>
              <div className="cardSubtle">Simple vote (saved per signed-in user)</div>
            </div>
            <div className="pill">{isFirebaseConfigured ? 'Login enabled' : 'Setup needed'}</div>
          </div>
          <div className="noteText">
            This webpage graphs recent monthly totals from the provided dataset and lets you segment
            the results by “Drug”. Looking at month-to-month changes helps highlight trends,
            seasonality, and unusual spikes that can signal increased risk and harm.

            <div className="stanceBlock">
              <div className="stanceLabel">Vote</div>
              <div className="stanceText">Should we invest more in drug/alcohol harm reduction?</div>

              {!isFirebaseConfigured && (
                <div className="smallNote">
                  Firebase isn’t configured yet. Paste your Firebase Web App config into
                  <code> src/firebaseConfig.js</code>, then refresh.
                </div>
              )}

              <div className="authRow">
                {user ? (
                  <>
                    <div className="userChip">
                      Signed in as <b>{user.displayName || user.email}</b>
                    </div>
                    <button className="secondaryBtn" type="button" onClick={() => signOutUser()}>
                      Sign out
                    </button>
                  </>
                ) : (
                  <div className="authBox">
                    <div className="emailAuth">
                      <input
                        className="input"
                        placeholder="Email"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        type="email"
                        autoComplete="email"
                      />
                      <input
                        className="input"
                        placeholder="Password"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        type="password"
                        autoComplete="current-password"
                      />
                      <div className="emailAuthActions">
                        <button
                          className="primaryBtn"
                          type="button"
                          disabled={!authEmail || !authPassword}
                          onClick={async () => {
                            try {
                              setVoteStatus({ kind: 'pending', message: 'Signing in…' });
                              await signInWithEmailPassword(authEmail, authPassword);
                              setVoteStatus({ kind: 'idle', message: '' });
                            } catch (e) {
                              setVoteStatus({
                                kind: 'error',
                                message: e?.message || 'Sign-in failed.',
                              });
                            }
                          }}
                        >
                          Sign in
                        </button>
                        <button
                          className="secondaryBtn"
                          type="button"
                          disabled={!authEmail || !authPassword}
                          onClick={async () => {
                            try {
                              setVoteStatus({ kind: 'pending', message: 'Creating account…' });
                              await signUpWithEmailPassword(authEmail, authPassword);
                              setVoteStatus({
                                kind: 'ok',
                                message: 'Account created. You are signed in.',
                              });
                            } catch (e) {
                              setVoteStatus({
                                kind: 'error',
                                message: e?.message || 'Sign-up failed.',
                              });
                            }
                          }}
                        >
                          Sign up
                        </button>
                      </div>
                      <div className="smallNote">
                        Make sure Firebase Console → <b>Authentication</b> → <b>Sign-in method</b> has
                        <b> Email/Password</b> enabled.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="voteRow">
                <label className="radio">
                  <input
                    type="radio"
                    name="vote"
                    value="yes"
                    checked={vote === 'yes'}
                    onChange={() => setVote('yes')}
                    disabled={!user}
                  />
                  <span>Yes</span>
                </label>
                <label className="radio">
                  <input
                    type="radio"
                    name="vote"
                    value="no"
                    checked={vote === 'no'}
                    onChange={() => setVote('no')}
                    disabled={!user}
                  />
                  <span>No</span>
                </label>

                <button
                  className="primaryBtn"
                  type="button"
                  disabled={!user || (vote !== 'yes' && vote !== 'no')}
                  onClick={async () => {
                    try {
                      setVoteStatus({ kind: 'pending', message: 'Saving your vote…' });
                      await saveUserVote({
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName,
                        vote,
                      });
                      setVoteStatus({ kind: 'ok', message: 'Saved! (Your vote is tied to your login.)' });
                    } catch (e) {
                      setVoteStatus({ kind: 'error', message: e?.message || 'Save failed.' });
                    }
                  }}
                >
                  Save my vote
                </button>
              </div>

              {voteStatus.kind !== 'idle' && (
                <div
                  className={
                    voteStatus.kind === 'ok'
                      ? 'status ok'
                      : voteStatus.kind === 'error'
                        ? 'status error'
                        : 'status'
                  }
                >
                  {voteStatus.message}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
