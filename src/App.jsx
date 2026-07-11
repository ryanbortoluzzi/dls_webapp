import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import './App.css'

// Normalizer function to convert land descriptions into standard format: [QUARTER]-SEC-TWP-RGE-MER
// E.g., "ne-1-1-1-w3" -> "NE-01-01-01-W3"
// E.g., "ne 1 1 1 w 3" -> "NE-01-01-01-W3"
function normalizeDLS(input) {
  if (!input) return '';
  
  // Trim and split by any common delimiters: spaces, hyphens, slashes, commas, underscores, periods
  const parts = input.trim().split(/[\s\-/,._]+/).filter(Boolean);
  
  const tokens = [...parts];
  
  // Handle case where meridian is split: e.g. NE 1 1 1 W 3 (6 parts) -> NE 1 1 1 W3 (5 parts)
  if (tokens.length === 6) {
    const fifth = tokens[4].toUpperCase();
    const sixth = tokens[5];
    if ((fifth === 'W' || fifth === 'E') && /^\d+$/.test(sixth)) {
      tokens[4] = fifth + sixth;
      tokens.splice(5, 1);
    }
  }
  
  if (tokens.length === 5) {
    // 5-part Quarter format: QUARTER-SEC-TWP-RGE-MER
    const quarter = tokens[0].toUpperCase();
    const sec = tokens[1].padStart(2, '0');
    const twp = tokens[2].padStart(2, '0');
    const rge = tokens[3].padStart(2, '0');
    const mer = tokens[4].toUpperCase();
    
    return `${quarter}-${sec}-${twp}-${rge}-${mer}`;
  }
  
  if (tokens.length === 4) {
    // Legacy/Alternative 4-part format: SEC-TWP-RGE-MER
    const sec = tokens[0].padStart(2, '0');
    const twp = tokens[1].padStart(2, '0');
    const rge = tokens[2].padStart(2, '0');
    const mer = tokens[3].toUpperCase();
    
    return `${sec}-${twp}-${rge}-${mer}`;
  }
  
  // Fallback: return uppercase with hyphens
  return tokens.join('-').toUpperCase();
}

function App() {
  const [landData, setLandData] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [normalizedQuery, setNormalizedQuery] = useState('')
  const [result, setResult] = useState(null)
  const [searchError, setSearchError] = useState(null)
  const [copied, setCopied] = useState(false)

  // Parse CSV on component mount
  useEffect(() => {
    Papa.parse('/land_data.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        // Clean up parsed rows
        const cleaned = results.data.filter(row => row.land_description && row.latitude && row.longitude);
        setLandData(cleaned);
        setLoading(false);
      },
      error: (err) => {
        console.error('Error loading CSV:', err);
        setLoadError('Could not load the CSV database (land_data.csv).');
        setLoading(false);
      }
    });
  }, []);

  // Update real-time normalization preview as user types
  useEffect(() => {
    if (searchQuery.trim()) {
      setNormalizedQuery(normalizeDLS(searchQuery));
    } else {
      setNormalizedQuery('');
    }
  }, [searchQuery]);

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    setSearchError(null);
    setResult(null);
    setCopied(false);

    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchError('Please enter a land description.');
      return;
    }

    const normQuery = normalizeDLS(trimmed);

    // Look for normalized match
    const match = landData.find(row => {
      return normalizeDLS(row.land_description) === normQuery;
    });

    if (match) {
      setResult({
        original: match.land_description,
        normalized: normQuery,
        latitude: parseFloat(match.latitude).toFixed(6),
        longitude: parseFloat(match.longitude).toFixed(6)
      });
    } else {
      setSearchError('Description not found');
    }
  };

  const copyToClipboard = () => {
    if (!result) return;
    const text = `${result.latitude}, ${result.longitude}`;
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
      });
  };

  const handleSampleClick = (sample) => {
    setSearchQuery(sample);
    // Auto-trigger search in next tick after setting state
    setTimeout(() => {
      // Direct call search using normalizer from sample
      setSearchError(null);
      setResult(null);
      setCopied(false);
      
      const normQuery = normalizeDLS(sample);
      const match = landData.find(row => normalizeDLS(row.land_description) === normQuery);
      if (match) {
        setResult({
          original: match.land_description,
          normalized: normQuery,
          latitude: parseFloat(match.latitude).toFixed(6),
          longitude: parseFloat(match.longitude).toFixed(6)
        });
      } else {
        setSearchError('Description not found');
      }
    }, 50);
  };

  return (
    <main className="app-container">
      <header className="app-header">
        <h1 className="app-title">DLS Coord Finder</h1>
        <p className="app-subtitle">
          Instantly convert Dominion Land Survey (DLS) legal land descriptions to coordinates.
        </p>
      </header>

      <section className="search-section">
        {loadError && (
          <div className="alert alert-danger" id="load-error-alert">
            {loadError}
          </div>
        )}

        <form onSubmit={handleSearch} className="search-form">
          <div className="input-group">
            <input
              id="search-input"
              type="text"
              placeholder="e.g., NE-12-34-56-W4 or ne 1 2 3 w 3"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              disabled={loading || !!loadError}
            />
            <button
              id="search-button"
              type="submit"
              className="search-button"
              disabled={loading || !!loadError}
            >
              {loading ? 'Loading Database...' : 'Search'}
            </button>
          </div>

          {normalizedQuery && (
            <div className="normalization-preview">
              Normalized as: <code>{normalizedQuery}</code>
            </div>
          )}
        </form>

        <div className="samples-container">
          <span className="samples-label">Try samples:</span>
          <button 
            id="sample-btn-1"
            type="button" 
            className="sample-btn"
            onClick={() => handleSampleClick('NE-09-56-18-W4')}
            disabled={loading}
          >
            NE-12-34-56-W4
          </button>
          <button 
            id="sample-btn-2"
            type="button" 
            className="sample-btn"
            onClick={() => handleSampleClick('sw 9 55 19 w 4')}
            disabled={loading}
          >
            SW 1 2 3 w 3
          </button>
        </div>
      </section>

      <section className="result-section" aria-live="polite">
        {searchError && (
          <div className="result-card error-card" id="search-error-card">
            <div className="card-icon error-icon">✕</div>
            <h3 className="error-title">{searchError}</h3>
            <p className="error-text">
              Please double check the format. The database contains a subset of AB, SK and MB.
            </p>
          </div>
        )}

        {result && (
          <div className="result-card success-card" id="search-success-card">
            <div className="card-header">
              <span className="success-badge">Match Found</span>
              <h3 className="result-description">{result.normalized}</h3>
              {result.original !== result.normalized && (
                <span className="original-label">Original: {result.original}</span>
              )}
            </div>

            <div className="coordinates-grid">
              <div className="coord-box">
                <span className="coord-label">Latitude</span>
                <span className="coord-value">{result.latitude}</span>
              </div>
              <div className="coord-box">
                <span className="coord-label">Longitude</span>
                <span className="coord-value">{result.longitude}</span>
              </div>
            </div>

            <div className="dls-details-grid">
              <div className="detail-item">
                <span className="detail-label">QTR</span>
                <span className="detail-value">{result.normalized.split('-').length === 5 ? result.normalized.split('-')[0] : 'N/A'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Section</span>
                <span className="detail-value">{result.normalized.split('-').length === 5 ? result.normalized.split('-')[1] : result.normalized.split('-')[0]}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Township</span>
                <span className="detail-value">{result.normalized.split('-').length === 5 ? result.normalized.split('-')[2] : result.normalized.split('-')[1]}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Range</span>
                <span className="detail-value">{result.normalized.split('-').length === 5 ? result.normalized.split('-')[3] : result.normalized.split('-')[2]}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Meridian</span>
                <span className="detail-value">{result.normalized.split('-').length === 5 ? result.normalized.split('-')[4] : result.normalized.split('-')[3]}</span>
              </div>
            </div>

            <div className="card-actions">
              <button 
                id="copy-coords-button"
                type="button" 
                className={`action-btn copy-btn ${copied ? 'copied' : ''}`}
                onClick={copyToClipboard}
              >
                {copied ? (
                  <>
                    <svg className="action-icon" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="action-icon" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                    </svg>
                    Copy Coordinates
                  </>
                )}
              </button>
              <a
                id="map-link"
                href={`https://www.google.com/maps/search/?api=1&query=${result.latitude},${result.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="action-btn map-btn"
              >
                <svg className="action-icon" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
                View on Google Maps
              </a>
            </div>
          </div>
        )}
      </section>
      
      <footer className="app-footer">
        <p>Database: contains {landData.length} records</p>
      </footer>
    </main>
  )
}

export default App
