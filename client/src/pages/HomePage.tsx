import { Link } from 'react-router-dom';

const beats = [
  ['💥', 'Scandals, gossip & drama', 'The messier the paper trail, the better the front page.'],
  ['📯', 'Weddings & memorials', 'Declarations, farewells, obituaries and the beautiful in-between.'],
  ['🎉', 'Festivals & advertisements', 'Tournaments, openings, celebrations and businesses worth knowing.'],
  ['🔍', 'Missing & mysteriously found', 'People, possessions, stolen hearts and suspiciously adorable cats.'],
  ['📸', 'Receipts & reenactments', 'Witness statements, videos, screenshots and dramatic retellings.'],
  ['🛸', 'Oddities', 'Strange discoveries, basement mysteries and the unexplained.'],
  ['🎭', 'Satire & commentary', 'Political parody and creative interpretations of public relationships.'],
  ['🐝', 'Bee gifs', 'No further justification required.'],
];

export default function HomePage() {
  return (
    <div className="km-home">
      <section className="km-hero">
        <div className="km-hero__copy">
          <div className="km-kicker">EST. FOR WHATEVER HAPPENS NEXT</div>
          <h1>Know your enemies.<br />Know yourself.<br /><em>Know Morrow.</em></h1>
          <p>Tomorrow may always be a day away, but the details are already knocking. We publish the grand scandal, the quiet disappearance, the unlikely romance—and the unfortunate punch thrown at a leader.</p>
          <div className="row"><Link to="/tavern/compose" className="btn btn--primary">Tell us everything</Link><a className="btn km-btn-light" href="https://discord.gg/u7ujs2wbXV" target="_blank" rel="noreferrer">Join the Discord</a></div>
        </div>
        <div className="km-hero__art"><img src="/know-morrow-mark.webp" alt="A rising white moon beneath an arc of light" /><span>KETCHUP ON THE LATEST SCOOP!</span></div>
      </section>
      <section className="km-manifesto">
        <div className="km-section-number">01</div>
        <div><div className="km-kicker">TO OUR READERS &amp; CONTRIBUTORS</div><h2>The devil lives in the details.</h2><p>Welcome to Know Morrow Newspaper. In this house, we reject the great man theory. History is built from a thousand small choices, glorious mistakes and half-heard rumors. Every tale can prove useful to someone, and every story deserves to be told.</p></div>
      </section>
      <section className="km-beats">
        <div className="km-section-head"><div><div className="km-kicker">WHAT WE PRINT</div><h2>No scoop too small.</h2></div><p>Including—but certainly not limited to:</p></div>
        <div className="km-beat-grid">{beats.map(([icon, title, copy], index) => <article className="km-beat" key={title}><span className="km-beat__index">{String(index + 1).padStart(2, '0')}</span><span className="km-beat__icon">{icon}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </section>
      <section className="km-submit">
        <div><div className="km-kicker">HOW TO SUBMIT</div><h2>Tell our tomatoes to come ketchup on the latest scoop.</h2></div>
        <div><p>Photos, witness statements, epic reenactments and dramatic retellings are always appreciated. For confidential details, open a private ticket—our head editor will personally handle your submission with a full NDA.</p><div className="row"><Link to="/tavern/compose" className="btn btn--primary">Submit a story</Link><a href="https://discord.gg/u7ujs2wbXV" className="btn" target="_blank" rel="noreferrer">Open a private ticket</a></div></div>
      </section>
      <section className="km-friends" aria-labelledby="friend-links-title">
        <div>
          <div className="km-kicker">FRIEND LINKS</div>
          <h2 id="friend-links-title">Elsewhere tomorrow is being built.</h2>
        </div>
        <div className="km-friends__links">
          <a href="https://theciveventportal.online/" target="_blank" rel="noopener noreferrer">
            <span>The Civ Event Portal</span>
            <span aria-hidden="true">↗</span>
          </a>
          <a href="https://lordeaux.app/" target="_blank" rel="noopener noreferrer">
            <span>Lordeaux</span>
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>
    </div>
  );
}
