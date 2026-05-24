# CFA Core High-Yield Formula Reference Sheet

This reference sheet captures core formulas from the CFA Level I and Level II curriculum. These formulas are critical for quantitative reasoning, equity valuation, corporate finance, and portfolio management.

---

## 1. Quantitative Methods & Portfolio Management

### A. Capital Asset Pricing Model (CAPM)
The Capital Asset Pricing Model defines the expected rate of return on an asset based on its systematic risk (beta) relative to the market.
* **Formula**:
  $$E(R_i) = R_f + \beta_i \times [E(R_m) - R_f]$$
* **Variables**:
  - $E(R_i)$: Expected return of security $i$
  - $R_f$: Risk-free rate of return
  - $\beta_i$: Beta coefficient of security $i$ (systematic risk)
  - $E(R_m)$: Expected return of the market portfolio
  - $[E(R_m) - R_f]$: Market Risk Premium (MRP)

### B. Sharpe Ratio
The Sharpe Ratio measures the excess return per unit of total risk (standard deviation) in a portfolio.
* **Formula**:
  $$Sharpe\ Ratio = \frac{R_p - R_f}{\sigma_p}$$
* **Variables**:
  - $R_p$: Expected portfolio return
  - $R_f$: Risk-free rate of return
  - $\sigma_p$: Standard deviation of portfolio excess returns (total risk)

### C. Treynor Ratio
Similar to the Sharpe Ratio, but measures excess return per unit of systematic risk (beta) instead of total risk.
* **Formula**:
  $$Treynor\ Ratio = \frac{R_p - R_f}{\beta_p}$$
* **Variables**:
  - $\beta_p$: Portfolio beta coefficient

---

## 2. Corporate Finance & Issuers

### A. Weighted Average Cost of Capital (WACC)
WACC represents a company's average cost of capital from all sources (equity, debt, preferred shares), weighted by their respective proportions in the capital structure.
* **Formula**:
  $$WACC = \left(w_d \times r_d \times (1 - t)\right) + \left(w_e \times r_e\right) + \left(w_p \times r_p\right)$$
* **Simplified Version** (Equity & Debt only):
  $$WACC = \left(\frac{E}{V} \times R_e\right) + \left(\frac{D}{V} \times R_d \times (1 - T_c)\right)$$
* **Variables**:
  - $E$: Market value of equity
  - $D$: Market value of debt
  - $V$: Total market value of firm capital structure ($E + D$)
  - $R_e$: Cost of equity (often calculated via CAPM)
  - $R_d$: Cost of debt (yield to maturity on outstanding debt)
  - $T_c$: Marginal corporate tax rate (debt interest payments are tax-deductible)

---

## 3. Equity Valuation

### A. Dividend Discount Model (DDM) - Gordon Growth Model
The Gordon Growth Model values a stock by discounting its future dividends, assuming they grow at a constant rate infinitely.
* **Formula**:
  $$V_0 = \frac{D_1}{r - g} = \frac{D_0 \times (1 + g)}{r - g}$$
* **Variables**:
  - $V_0$: Intrinsic value of the stock today
  - $D_0$: Dividend just paid
  - $D_1$: Expected dividend in period 1
  - $r$: Required rate of return on equity
  - $g$: Constant dividend growth rate (must be strictly less than $r$)

### B. DuPont Analysis (3-Step & 5-Step)
DuPont analysis breaks down Return on Equity (ROE) to analyze the core drivers of profitability, asset efficiency, and financial leverage.
* **3-Step DuPont Formula**:
  $$ROE = Net\ Profit\ Margin \times Asset\ Turnover \times Financial\ Leverage$$
  $$ROE = \left(\frac{Net\ Income}{Revenue}\right) \times \left(\frac{Revenue}{Assets}\right) \times \left(\frac{Assets}{Equity}\right)$$
* **5-Step DuPont Formula**:
  $$ROE = Tax\ Burden \times Interest\ Burden \times EBIT\ Margin \times Asset\ Turnover \times Financial\ Leverage$$
  $$ROE = \left(\frac{NI}{EBT}\right) \times \left(\frac{EBT}{EBIT}\right) \times \left(\frac{EBIT}{Revenue}\right) \times \left(\frac{Revenue}{Assets}\right) \times \left(\frac{Assets}{Equity}\right)$$

---

## 4. Fixed Income Valuation

### A. Bond Pricing
The value of a coupon-bearing bond is the sum of the present values of its future coupon payments plus the present value of its par value at maturity.
* **Formula**:
  $$Price = \sum_{t=1}^{n} \frac{PMT}{(1 + r)^t} + \frac{FV}{(1 + r)^n}$$
* **Variables**:
  - $PMT$: Coupon payment per period
  - $FV$: Face value of the bond (Par value, typically 1,000)
  - $r$: Discount rate per period (Yield to Maturity)
  - $n$: Number of compounding periods to maturity
