import { useEffect, useMemo, useState } from 'react';
import './App.css';
import LineChart from './components/LineChart.jsx';
import { aggregateMonthlySalesFromStream } from './utils/csvStream.js';

const DATASET_URL = '/drug_overdose.csv';

function App() {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [datasetName, setDatasetName] = useState('');

  const [agg, setAgg] = useState(null);
  const [selectedDrug, setSelectedDrug] = useState('All');

  // Auto-load from /public (copied into dist on build).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setLoadError('');
        const res = await fetch(DATASET_URL);
        if (!res.ok || !res.body) throw new Error(`Failed to load dataset at ${DATASET_URL}`);
        const parsed = await aggregateMonthlySalesFromStream(res.body);
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
            <div className="pill">{loading ? 'Loading…' : agg ? 'Ready' : 'Error'}</div>
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
              <div className="cardSubtle">What this data shows + my stance</div>
            </div>
          </div>
          <div className="noteText">
            This webpage graphs recent monthly totals from the provided dataset and lets you segment
            the results by “Drug”. Looking at month-to-month changes helps highlight trends,
            seasonality, and unusual spikes that can signal increased risk and harm.
            <br />
            <br />
            <div className="stanceBlock">
              <div className="stanceLabel">My stance</div>
              <div className="stanceText">
                Communities should treat sustained increases in alcohol sales as a signal to invest
                more in prevention, education, and accessible support services—because higher
                consumption correlates with higher risk for harm even if sales alone don’t prove
                causation.
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
