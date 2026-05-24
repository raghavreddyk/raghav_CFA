import React, { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const FORMULAS_METADATA = [
  {
    id: 'capm',
    name: 'Capital Asset Pricing Model (CAPM)',
    notation: 'E(R_i) = R_f + \\beta_i \\times [E(R_m) - R_f]',
    desc: 'CAPM estimates the required rate of return for a security based on its systematic risk (beta) relative to the broader market portfolio. Essential for equity valuation and portfolio hurdle rate adjustments.',
    fields: [
      { key: 'rf', label: 'Risk-free Rate (Rf) - e.g. 0.045 for 4.5%', defaultValue: 0.045, step: 0.001 },
      { key: 'beta', label: 'Systematic Risk (Beta) - e.g. 1.25', defaultValue: 1.25, step: 0.01 },
      { key: 'mkt', label: 'Expected Market Return (Rm) - e.g. 0.09 for 9%', defaultValue: 0.09, step: 0.001 }
    ]
  },
  {
    id: 'sharpe',
    name: 'Sharpe Ratio',
    notation: 'Sharpe\\ Ratio = \\frac{R_p - R_f}{\\sigma_p}',
    desc: 'The Sharpe ratio measures the excess return earned per unit of total risk (standard deviation). A cornerstone ratio for evaluating risk-adjusted portfolio performance in Portfolio Management.',
    fields: [
      { key: 'rp', label: 'Expected Portfolio Return (Rp) - e.g. 0.12 for 12%', defaultValue: 0.12, step: 0.001 },
      { key: 'rf', label: 'Risk-free Rate (Rf) - e.g. 0.04 for 4%', defaultValue: 0.04, step: 0.001 },
      { key: 'std', label: 'Portfolio Std Deviation (σp) - e.g. 0.15 for 15%', defaultValue: 0.15, step: 0.001 }
    ]
  },
  {
    id: 'wacc',
    name: 'Weighted Average Cost of Capital (WACC)',
    notation: 'WACC = \\left(\\frac{E}{V} \\times R_e\\right) + \\left(\\frac{D}{V} \\times R_d \\times (1 - T_c)\\right)',
    desc: "WACC calculates a firm's blended cost of capital across equity and debt weighting proportions. It acts as the primary hurdle rate for corporate capital budgeting decisions.",
    fields: [
      { key: 'equity', label: 'Total Market Value of Equity (E) - e.g. 600000', defaultValue: 600000, step: 1000 },
      { key: 'debt', label: 'Total Market Value of Debt (D) - e.g. 400000', defaultValue: 400000, step: 1000 },
      { key: 're', label: 'Cost of Equity (Re) - e.g. 0.10 for 10%', defaultValue: 0.10, step: 0.001 },
      { key: 'rd', label: 'Cost of Debt (Rd) - e.g. 0.06 for 6%', defaultValue: 0.06, step: 0.001 },
      { key: 'tax', label: 'Corporate Tax Rate (Tc) - e.g. 0.21 for 21%', defaultValue: 0.21, step: 0.01 }
    ]
  },
  {
    id: 'tvm',
    name: 'Time Value of Money (Present Value)',
    notation: 'PV = \\frac{FV}{(1 + r)^n}',
    desc: 'Discounting future cash flows back to today is the absolute fundamental core of finance. This calculation computes the PV of a single lump sum payout.',
    fields: [
      { key: 'fv', label: 'Future Value (FV) - e.g. 10000', defaultValue: 10000, step: 10 },
      { key: 'rate', label: 'Discount Rate per period (r) - e.g. 0.06 for 6%', defaultValue: 0.06, step: 0.001 },
      { key: 'n', label: 'Number of Periods (n) - e.g. 5', defaultValue: 5, step: 0.1 }
    ]
  }
];

export default function FormulaWorkspace() {
  const [activeFormula, setActiveFormula] = useState(FORMULAS_METADATA[0]);
  const [inputs, setInputs] = useState(
    FORMULAS_METADATA[0].fields.reduce((acc, field) => {
      acc[field.key] = field.defaultValue;
      return acc;
    }, {})
  );
  
  const [calculationResult, setCalculationResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState('gemini');

  const handleFormulaChange = (formula) => {
    setActiveFormula(formula);
    setInputs(
      formula.fields.reduce((acc, field) => {
        acc[field.key] = field.defaultValue;
        return acc;
      }, {})
    );
    setCalculationResult(null);
  };

  const handleInputChange = (key, value) => {
    setInputs((prev) => ({
      ...prev,
      [key]: parseFloat(value) || 0
    }));
  };

  const handleCalculate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setCalculationResult(null);

    try {
      const response = await fetch(`${API_BASE}/formula/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formula_name: activeFormula.id,
          variables: inputs,
          provider: provider
        })
      });

      if (!response.ok) {
        throw new Error('Calculation endpoint error');
      }

      const data = await response.json();
      setCalculationResult(data);
    } catch (error) {
      console.error('Calculation error:', error);
      alert('Could not connect to financial solver API.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="formula-container">
      {/* Sidebar Formula List */}
      <div className="formula-sidebar">
        <h3 style={{ color: 'var(--text-primary)', padding: '0 8px', marginBottom: '8px', fontFamily: 'var(--font-display)', fontWeight: '700' }}>CFA Formula Studio</h3>
        {FORMULAS_METADATA.map((f) => (
          <div 
            key={f.id} 
            className={`formula-card ${activeFormula.id === f.id ? 'active' : ''}`}
            onClick={() => handleFormulaChange(f)}
          >
            <div className="formula-card-title">{f.name}</div>
            <div className="formula-card-notation">$ {f.notation} $</div>
          </div>
        ))}

        <div style={{ marginTop: '20px', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tutor AI Provider:</span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            style={{
              background: 'var(--bg-panel-solid)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-glass)',
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-display)',
              fontWeight: '600'
            }}
          >
            <option value="gemini">Gemini Flash (Instant)</option>
            <option value="groq">Groq Llama 3 (Sub-Second)</option>
            <option value="openai">OpenAI GPT-4 (Scholarly)</option>
          </select>
        </div>
      </div>

      {/* Main Solver Workspace */}
      <div className="glass-card formula-workspace">
        <h2 style={{ color: 'var(--accent-blue)' }}>{activeFormula.name}</h2>
        <p className="formula-desc">{activeFormula.desc}</p>
        
        {/* Math Block Display */}
        <div className="formula-latex-preview">
          $${activeFormula.notation}$$
        </div>

        {/* Inputs Form */}
        <form onSubmit={handleCalculate} className="variables-form">
          {activeFormula.fields.map((field) => (
            <div key={field.key} className="input-group">
              <label className="input-label">{field.label}</label>
              <input
                type="number"
                step={field.step}
                className="input-field"
                value={inputs[field.key] !== undefined ? inputs[field.key] : ''}
                onChange={(e) => handleInputChange(field.key, e.target.value)}
                required
              />
            </div>
          ))}
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button type="submit" className="btn-blue" disabled={isLoading}>
              {isLoading ? 'Computing & Explaining...' : 'Compute & Explain'}
            </button>
          </div>
        </form>

        {/* Solver Output */}
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '30px 0' }}>
            <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
            <span style={{ color: 'var(--gold-light)', fontStyle: 'italic' }}>Deterministic solver completed. AI is formulating curriculum explanation...</span>
          </div>
        )}

        {calculationResult && (
          <div className="formula-result-card">
            <div className="result-header">
              🔢 Solved Value: <span style={{ color: 'var(--text-primary)', fontSize: '1.25rem' }}>
                {activeFormula.id === 'tvm' || activeFormula.id === 'wacc' || activeFormula.id === 'capm'
                  ? `${(calculationResult.calculated_value * (activeFormula.id === 'tvm' ? 1 : 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}${activeFormula.id === 'tvm' ? '' : '%'}`
                  : calculationResult.calculated_value.toFixed(4)
                }
              </span>
            </div>
            
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>ARITHMETIC EXECUTION:</div>
            <div className="result-steps">
              {calculationResult.math_details}
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>AI TUTOR CONCEPT REVIEW:</div>
            <div className="result-explanation" style={{ whiteSpace: 'pre-line' }}>
              {calculationResult.ai_explanation}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
