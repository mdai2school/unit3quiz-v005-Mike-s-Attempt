# Unit 3 — Graphing (React/Vite)

## What this app does

- Loads a CSV dataset (supports large files via stream parsing)
- Graphs **monthly totals** on a single webpage (default: most recent 24 months)
- Includes a **Statement of Intent** at the bottom explaining the data and taking a stance

## Run locally

```bash
npm i
npm run dev
```

## Load the CSV

- Use the **Choose File** picker in the UI and select your CSV file.
- Optional auto-load: put your dataset at `public/Warehouse_and_Retail_Sales.csv`.
