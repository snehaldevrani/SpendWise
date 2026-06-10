# Sample Bank Statement Fixtures

These files contain fake data for manual upload testing in SpendWise.

- `simple-sample.csv`: generic date/merchant/amount/type CSV.
- `hdfc-split-columns-sample.csv`: HDFC-style debit/credit split columns.
- `bankstatementwizard-sample.csv`: export style with `Source Date` overriding Excel serial `Date`.
- `simple-sample.xlsx`: generated XLSX version of the generic sample.

Expected result: each fixture imports 6 transactions with a mix of debit and credit rows.
