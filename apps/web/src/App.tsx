export function App() {
  return (
    <main className="shell">
      <header className="masthead">
        <a className="wordmark" href="/" aria-label="Jovia home">
          Jovia
        </a>
        <span className="eyebrow">Foundation preview</span>
      </header>
      <section className="hero" aria-labelledby="hero-title">
        <p className="kicker">Your work, intelligently orchestrated.</p>
        <h1 id="hero-title">The AI operating system for freelancers.</h1>
        <p className="lede">
          Jovia is building a quieter way to discover opportunities, prepare stronger work, and make
          better career decisions.
        </p>
      </section>
      <section className="status" role="status" aria-live="polite">
        <span className="status-dot" aria-hidden="true" />
        <span>Foundation systems are ready.</span>
      </section>
    </main>
  );
}
